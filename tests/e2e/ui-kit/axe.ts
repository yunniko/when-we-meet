// Accessibility (COMPANY/UI_STANDARDS.md §5): runs axe-core on the page as it is now and fails on any serious or
// critical violation of WCAG 2.2 A/AA, naming the rule and the elements. Needs `@axe-core/playwright` as a dev
// dependency of the project (MPL-2.0).
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export async function expectNoSeriousA11yViolations(page: Page, options: { include?: string; exclude?: string[] } = {}): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  if (options.include) builder = builder.include(options.include);
  for (const e of options.exclude ?? []) builder = builder.exclude(e);
  const { violations } = await builder.analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (serious.length) {
    const detail = serious
      .map((v) => `  ${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `    ${n.target.join(" ")}`).join("\n")}`)
      .join("\n");
    throw new Error(`${serious.length} serious accessibility violation(s):\n${detail}`);
  }
}
