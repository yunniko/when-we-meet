// Reads a project's design/tokens.json, resolves {group.name} references, and checks the structure every
// project shares (COMPANY/UI_STANDARDS.md §1). The format is described in docs/token-format.md.
// Zero dependencies on purpose: this file is copied into projects (D001).

/** Colour roles every project defines; the ui-kit components style themselves with these names. */
export const REQUIRED_COLOURS = [
  "surface",
  "surface-raised",
  "text",
  "text-muted",
  "border",
  "accent",
  "on-accent",
  "danger",
  "warning",
  "success",
  "info",
  "focus",
];

/** Groups and their limits. `min`/`max` count entries; `required` names entries that must exist. */
export const GROUPS = {
  color: { type: "color", min: REQUIRED_COLOURS.length, required: REQUIRED_COLOURS },
  font: { type: "fontFamily", min: 1, max: 3, required: ["body"] },
  fontSize: { type: "dimension", min: 3, max: 6 },
  fontWeight: { type: "number", min: 0, max: 4 },
  space: { type: "dimension", min: 3, max: 8 },
  radius: { type: "dimension", min: 1, max: 3 },
  shadow: { type: "shadow", min: 0, max: 3 },
  duration: { type: "duration", min: 2, max: 3, required: ["fast", "normal"] },
  breakpoint: { type: "dimension", min: 0, max: 5 },
};

/**
 * Pairs checked for contrast: [foreground, background, minimum ratio]. WCAG 2.2 AA: 4.5 for text (1.4.3), 3 for
 * focus indicators and other non-text parts that must be seen (1.4.11). A project adds pairs under "contrast".
 */
export const DEFAULT_PAIRS = [
  ["text", "surface", 4.5],
  ["text", "surface-raised", 4.5],
  ["text-muted", "surface", 4.5],
  ["text-muted", "surface-raised", 4.5],
  ["on-accent", "accent", 4.5],
  ["danger", "surface", 4.5],
  ["danger", "surface-raised", 4.5],
  ["focus", "surface", 3],
  ["accent", "surface", 3],
];

const NAME = /^[a-z0-9][a-z0-9-]*$/;
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const DIMENSION = /^(?:0|\d+(?:\.\d+)?(?:px|rem))$/;
const DURATION = /^\d+ms$/;
const REFERENCE = /^\{([a-zA-Z]+)\.([a-z0-9-]+)\}$/;
const TOP_LEVEL = new Set([...Object.keys(GROUPS), "modes", "contrast", "$description"]);

export class TokenError extends Error {
  /** @param {{path: string, message: string}[]} problems */
  constructor(problems) {
    super(problems.map((p) => `${p.path}: ${p.message}`).join("\n"));
    this.problems = problems;
  }
}

/**
 * Validates and resolves a parsed tokens.json.
 * @returns {{groups: Record<string, Record<string, {value: any, dp?: number}>>, modes: Record<string, Record<string, Record<string, {value: any}>>>, pairs: [string, string, number][]}}
 * @throws {TokenError} listing every problem found, not only the first.
 */
export function resolveTokens(raw) {
  const problems = [];
  const report = (path, message) => problems.push({ path, message });
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    throw new TokenError([{ path: "(root)", message: "must be an object" }]);

  for (const key of Object.keys(raw)) if (!TOP_LEVEL.has(key)) report(key, `unknown group; groups are ${[...TOP_LEVEL].join(", ")}`);

  /** First pass: collect raw entries, so references can point anywhere. */
  const entries = {};
  for (const [group, rule] of Object.entries(GROUPS)) {
    const block = raw[group] ?? {};
    if (typeof block !== "object" || Array.isArray(block)) {
      report(group, "must be an object of named tokens");
      continue;
    }
    entries[group] = {};
    const names = Object.keys(block).filter((n) => !n.startsWith("$"));
    for (const name of names) {
      if (!NAME.test(name)) report(`${group}.${name}`, "names are lower-case letters, digits and hyphens");
      const token = block[name];
      if (token === null || typeof token !== "object" || !("$value" in token)) {
        report(`${group}.${name}`, 'must be an object with a "$value"');
        continue;
      }
      if (token.$type !== undefined && token.$type !== rule.type) report(`${group}.${name}`, `$type must be "${rule.type}" in ${group}`);
      entries[group][name] = token;
    }
    if (names.length < rule.min) report(group, `needs at least ${rule.min} tokens, has ${names.length}`);
    if (rule.max !== undefined && names.length > rule.max) report(group, `allows at most ${rule.max} tokens, has ${names.length}`);
    for (const required of rule.required ?? []) if (!(required in (block ?? {}))) report(`${group}.${required}`, "is required");
  }

  const lookup = (group, name) => entries[group]?.[name];

  /** Resolves a value, following references (with cycle detection), then checks it against the group's type. */
  function resolve(group, name, token, path, seen = new Set()) {
    let value = token.$value;
    const ref = typeof value === "string" ? REFERENCE.exec(value) : null;
    if (ref) {
      const [, refGroup, refName] = ref;
      const key = `${refGroup}.${refName}`;
      if (seen.has(key)) {
        report(path, `reference cycle through {${key}}`);
        return undefined;
      }
      const target = refGroup === group || GROUPS[refGroup]?.type === GROUPS[group].type ? lookup(refGroup, refName) : undefined;
      if (!target) {
        report(path, `references {${key}}, which is not a ${GROUPS[group].type} token`);
        return undefined;
      }
      return resolve(refGroup, refName, target, path, new Set([...seen, key]));
    }
    const type = GROUPS[group].type;
    const ok =
      (type === "color" && typeof value === "string" && HEX.test(value)) ||
      (type === "dimension" && typeof value === "string" && DIMENSION.test(value)) ||
      (type === "duration" && typeof value === "string" && DURATION.test(value)) ||
      (type === "number" && typeof value === "number" && value > 0) ||
      (type === "fontFamily" &&
        (typeof value === "string" || (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string")))) ||
      (type === "shadow" && typeof value === "string" && value.length > 0);
    if (!ok) {
      const expected = {
        color: "a hex colour (#rgb, #rrggbb or #rrggbbaa)",
        dimension: "a length in px or rem",
        duration: "a duration in ms",
        number: "a positive number",
        fontFamily: "a font name or a list of them",
        shadow: "a CSS box-shadow",
      }[type];
      report(path, `${JSON.stringify(value)} is not ${expected}`);
      return undefined;
    }
    if (type === "color") return normaliseHex(value);
    if (type === "fontFamily") return Array.isArray(value) ? value : [value];
    return value;
  }

  const groups = {};
  for (const group of Object.keys(GROUPS)) {
    groups[group] = {};
    for (const [name, token] of Object.entries(entries[group] ?? {})) {
      const value = resolve(group, name, token, `${group}.${name}`);
      if (value === undefined) continue;
      const out = { value };
      if (group === "shadow") {
        const dp = token.$extensions?.dp;
        if (typeof dp !== "number" || dp < 0) report(`${group}.${name}`, 'needs "$extensions": {"dp": <elevation>} for native platforms');
        else out.dp = dp;
      }
      groups[group][name] = out;
    }
  }

  // Modes override colours only: a theme changes colour, not spacing (docs/token-format.md).
  const modes = {};
  for (const [mode, block] of Object.entries(raw.modes ?? {})) {
    if (!NAME.test(mode)) report(`modes.${mode}`, "mode names are lower-case letters, digits and hyphens");
    const extra = Object.keys(block ?? {}).filter((k) => k !== "color");
    for (const k of extra) report(`modes.${mode}.${k}`, "a mode overrides colours only");
    modes[mode] = { color: {} };
    for (const [name, token] of Object.entries(block?.color ?? {})) {
      const path = `modes.${mode}.color.${name}`;
      if (!(name in groups.color) && !(name in (entries.color ?? {}))) report(path, "overrides a colour the base does not define");
      if (token === null || typeof token !== "object" || !("$value" in token)) {
        report(path, 'must be an object with a "$value"');
        continue;
      }
      // A reference inside a mode means the mode's value of that colour when it overrides it, else the base.
      const ref = typeof token.$value === "string" ? REFERENCE.exec(token.$value) : null;
      if (ref && ref[1] === "color" && block.color[ref[2]] && ref[2] !== name) {
        const inner = block.color[ref[2]];
        const value = resolve("color", ref[2], inner, path);
        if (value !== undefined) modes[mode].color[name] = { value };
        continue;
      }
      const value = resolve("color", name, token, path);
      if (value !== undefined) modes[mode].color[name] = { value };
    }
  }

  const pairs = [...DEFAULT_PAIRS];
  for (const [i, pair] of (raw.contrast ?? []).entries()) {
    const valid =
      Array.isArray(pair) && pair.length === 3 && typeof pair[0] === "string" && typeof pair[1] === "string" && typeof pair[2] === "number";
    if (!valid) {
      report(`contrast[${i}]`, 'must be ["foreground", "background", minimumRatio]');
      continue;
    }
    for (const role of pair.slice(0, 2)) if (!(role in groups.color)) report(`contrast[${i}]`, `"${role}" is not a colour token`);
    pairs.push(pair);
  }

  if (problems.length > 0) throw new TokenError(problems);
  return { groups, modes, pairs };
}

/** #abc → #aabbcc, upper-case removed, alpha kept only when not opaque. */
export function normaliseHex(hex) {
  let h = hex.slice(1).toLowerCase();
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (h.length === 8 && h.endsWith("ff")) h = h.slice(0, 6);
  return `#${h}`;
}

/** The colours of one mode: the base with the mode's overrides on top. `mode` undefined is the base. */
export function coloursOf(resolved, mode) {
  const base = Object.fromEntries(Object.entries(resolved.groups.color).map(([k, v]) => [k, v.value]));
  if (!mode) return base;
  const over = Object.fromEntries(Object.entries(resolved.modes[mode]?.color ?? {}).map(([k, v]) => [k, v.value]));
  return { ...base, ...over };
}

/** A dimension in CSS pixels, with 1rem = 16px (the root size projects pin; see when-we-meet's globals.css). */
export function toPx(dimension) {
  if (dimension === "0") return 0;
  const n = parseFloat(dimension);
  return dimension.endsWith("rem") ? n * 16 : n;
}
