// Do a slot's messages fit the lines it should take? (COMPANY/UI_STANDARDS.md §4.) A character cap only guesses at
// this: the answer depends on the font, the slot's width and the language. Each message is rendered in a copy
// of the real slot, at the page's current width, and its height counted in lines.
import type { Locator } from "@playwright/test";

// The same font renders a few per cent wider on some platforms (Linux Chromium measured up to 4.6% wider than
// Windows), so a message must fit with this share of the slot to spare. See ui-kit D009.
export const FIT_HEADROOM = 0.06;

/**
 * The messages among `messages` that take more than `maxLines` lines in a copy of `slot` narrowed by `headroom`,
 * with their line count.
 */
export async function measureMessageLines(slot: Locator, messages: string[], maxLines = 1, headroom = FIT_HEADROOM): Promise<string[]> {
  return slot.evaluate(
    async (el, { messages, maxLines, headroom }) => {
      const probe = el.cloneNode(false) as HTMLElement;
      probe.removeAttribute("id");
      probe.removeAttribute("role");
      probe.setAttribute("aria-hidden", "true");
      probe.style.visibility = "hidden";
      probe.style.boxSizing = "border-box";
      probe.style.width = `${Math.floor(el.getBoundingClientRect().width * (1 - headroom))}px`;
      el.parentElement!.insertBefore(probe, el.nextSibling);
      const style = getComputedStyle(probe);
      const lineHeight = parseFloat(style.lineHeight);
      const primary = style.fontFamily
        .split(",")[0]
        .trim()
        .replace(/^["']|["']$/g, "");
      // A web font's subsets (Cyrillic, Latin Extended) load only once text needs them. Rendering every message
      // first makes the browser request them; fonts.ready waits for that and, unlike fonts.load, never rejects.
      probe.textContent = messages.join(" ");
      probe.getBoundingClientRect();
      await document.fonts.ready;
      // A face of the slot's own font that failed to load would mean measuring a fallback font, which wraps
      // differently on each OS. Other faces (a metric-adjusted local fallback, say) may fail harmlessly.
      const failed = [...document.fonts].filter((face) => face.status === "error" && face.family.replace(/^["']|["']$/g, "") === primary);
      if (failed.length > 0) {
        probe.remove();
        throw new Error(`web font failed to load, cannot measure: ${failed.map((f) => f.family).join(", ")}`);
      }
      const over: string[] = [];
      for (const message of messages) {
        probe.textContent = message;
        const lines = Math.round(probe.getBoundingClientRect().height / lineHeight);
        if (lines > maxLines) over.push(`${lines} lines: ${message}`);
      }
      probe.remove();
      return over;
    },
    { messages, maxLines, headroom }
  );
}

/** Fails, listing each offender, when any message takes more than `maxLines` lines in `slot`. */
export async function expectMessagesFit(slot: Locator, messages: string[], maxLines = 1, headroom = FIT_HEADROOM): Promise<void> {
  const over = await measureMessageLines(slot, messages, maxLines, headroom);
  if (over.length > 0) throw new Error(`messages longer than ${maxLines} line(s) at this width:\n  ${over.join("\n  ")}`);
}
