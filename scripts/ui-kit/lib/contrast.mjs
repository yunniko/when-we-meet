// WCAG 2.2 contrast ratio (relative luminance per the WCAG definition), checked on every pair the tokens name,
// in the base and in every mode (COMPANY/UI_STANDARDS.md §1).
import { coloursOf } from "./tokens.mjs";

function channel(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of an opaque #rrggbb. */
export function luminance(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * @returns {{mode: string, fg: string, bg: string, ratio: number, min: number, message: string}[]} failing pairs.
 * A translucent colour in a pair is a failure of its own: its contrast depends on what is behind it.
 */
export function checkContrast(resolved) {
  const failures = [];
  for (const mode of [undefined, ...Object.keys(resolved.modes)]) {
    const colours = coloursOf(resolved, mode);
    const label = mode ?? "base";
    for (const [fg, bg, min] of resolved.pairs) {
      const a = colours[fg];
      const b = colours[bg];
      if (a.length > 7 || b.length > 7) {
        failures.push({
          mode: label,
          fg,
          bg,
          ratio: NaN,
          min,
          message: `${label}: ${fg} on ${bg} uses a translucent colour; pairs must be opaque`,
        });
        continue;
      }
      const r = ratio(a, b);
      // Compared at two decimals, as contrast checkers report it, so 4.499 does not pass as 4.5.
      if (Math.floor(r * 100) / 100 < min)
        failures.push({
          mode: label,
          fg,
          bg,
          ratio: r,
          min,
          message: `${label}: ${fg} ${a} on ${bg} ${b} is ${r.toFixed(2)}:1, needs ${min}:1`,
        });
    }
  }
  return failures;
}
