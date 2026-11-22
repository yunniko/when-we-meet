// Layout stability (COMPANY/UI_STANDARDS.md §4): records every layout shift on the page, including the ones the
// browser leaves out of CLS because they followed input (`hadRecentInput`). A message that appears after a click
// and pushes content down is exactly such a shift, so CLS alone would never see it. Chromium only: the Layout
// Instability API is not implemented in Firefox or WebKit.
import type { Page } from "@playwright/test";

export type Shift = { value: number; hadRecentInput: boolean; sources: string[] };

declare global {
  interface Window {
    __uiKitShifts?: Shift[];
  }
}

/** Call before `page.goto`: installs the observer for every document the page loads. */
export async function recordLayoutShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__uiKitShifts = [];
    const describe = (node: Node | null): string => {
      if (!(node instanceof Element)) return node?.nodeName ?? "?";
      const id = node.id ? `#${node.id}` : "";
      const testId = node.getAttribute("data-testid");
      return `${node.tagName.toLowerCase()}${id}${testId ? `[data-testid=${testId}]` : ""}`;
    };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node: Node | null }[] }[]) {
        window.__uiKitShifts!.push({
          value: e.value,
          hadRecentInput: e.hadRecentInput,
          sources: (e.sources ?? []).map((s) => describe(s.node)),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

/** Every shift so far, and their sum. Waits two frames so a shift caused by the last action is reported. */
export async function layoutShifts(page: Page): Promise<{ total: number; shifts: Shift[] }> {
  const shifts = await page.evaluate(
    () => new Promise<Shift[]>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.__uiKitShifts ?? []))))
  );
  return { total: shifts.reduce((a, s) => a + s.value, 0), shifts };
}

/** Forgets the shifts so far, e.g. those of the first render, so a step can be measured alone. */
export async function resetLayoutShifts(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__uiKitShifts = [];
  });
}

/**
 * Fails when the shifts since recording (or the last reset) exceed the budget, naming what moved.
 * The budget is the standard's, calibrated in ui-kit G-001 M5; pass a different one only with a Dnnn.
 */
export async function expectStableLayout(page: Page, budget = 0.01): Promise<void> {
  const { total, shifts } = await layoutShifts(page);
  if (total > budget) {
    const detail = shifts
      .map((s) => `  ${s.value.toFixed(4)}${s.hadRecentInput ? " (after input)" : ""} ${s.sources.join(", ")}`)
      .join("\n");
    throw new Error(`layout shifted by ${total.toFixed(4)}, budget ${budget}:\n${detail}`);
  }
}
