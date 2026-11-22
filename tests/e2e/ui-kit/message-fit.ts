// Do a slot's messages fit the lines it should take? (COMPANY/UI_STANDARDS.md §4.) A character cap only guesses at
// this: the answer depends on the font, the slot's width and the language. Each message is rendered in a copy
// of the real slot, at the page's current width, and its height counted in lines.
import type { Locator } from "@playwright/test";

/** The messages among `messages` that take more than `maxLines` lines in a copy of `slot`, with their line count. */
export async function measureMessageLines(slot: Locator, messages: string[], maxLines = 1): Promise<string[]> {
  return slot.evaluate(
    (el, { messages, maxLines }) => {
      const probe = el.cloneNode(false) as HTMLElement;
      probe.removeAttribute("id");
      probe.removeAttribute("role");
      probe.setAttribute("aria-hidden", "true");
      probe.style.visibility = "hidden";
      el.parentElement!.insertBefore(probe, el.nextSibling);
      const lineHeight = parseFloat(getComputedStyle(probe).lineHeight);
      const over: string[] = [];
      for (const message of messages) {
        probe.textContent = message;
        const lines = Math.round(probe.getBoundingClientRect().height / lineHeight);
        if (lines > maxLines) over.push(`${lines} lines: ${message}`);
      }
      probe.remove();
      return over;
    },
    { messages, maxLines }
  );
}

/** Fails, listing each offender, when any message takes more than `maxLines` lines in `slot`. */
export async function expectMessagesFit(slot: Locator, messages: string[], maxLines = 1): Promise<void> {
  const over = await measureMessageLines(slot, messages, maxLines);
  if (over.length > 0) throw new Error(`messages longer than ${maxLines} line(s) at this width:\n  ${over.join("\n  ")}`);
}
