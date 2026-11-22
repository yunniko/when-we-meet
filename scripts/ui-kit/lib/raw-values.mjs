// Fails on a visual value written in code instead of taken from the project's tokens (COMPANY/UI_STANDARDS.md
// §1), generalised from cross-stitch's scripts/check-skin.mjs. A file that draws content (a chart, a photo) is
// exempt through `allow.rawValues` in design/ui-kit.json, with the reason; a single line through a trailing
// comment `ui-kit-allow: <reason>`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const HUES =
  "white|black|zinc|slate|gray|grey|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|pink|rose|fuchsia";
const UTILS = "bg|text|border|ring|outline|decoration|fill|stroke|accent|caret|from|via|to|divide|placeholder|shadow";

/** [pattern, what is wrong] per file type. */
const RULES = {
  web: [
    [
      new RegExp(`(?<![\\w-])(?:[a-z-]+:)*(?:${UTILS})-(?:${HUES})(?:-\\d+)?(?:\\/\\d+)?(?![\\w-])`),
      "a Tailwind palette colour; use a colour role",
    ],
    [/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b|#[0-9a-fA-F]{3}(?![0-9a-zA-Z])/, "a literal colour; use a colour role"],
    [/\b(?:rgba?|hsla?|oklch|oklab)\(\s*[\d.][^)]*\)?/, "a literal colour; use a colour role"],
    [/(?<![\w-])[a-z][\w:-]*-\[(?:-?\d+(?:\.\d+)?(?:px|rem|em)|#|rgb|hsl)[^\]]*\]/, "a Tailwind arbitrary value; use a token step"],
  ],
  dart: [
    [/\bColor\(\s*0x/, "a literal colour; use UiPalette"],
    [/\bColor\.from(?:ARGB|RGBO)\(/, "a literal colour; use UiPalette"],
    [/\bColors\.(?!transparent\b)\w+/, "a Material palette colour; use UiPalette"],
    [/\bEdgeInsets\.\w+\(\s*(?:\w+:\s*)?\d/, "a literal spacing; use UiTokens.space…"],
  ],
  kotlin: [
    [/\bColor\.(?:parseColor|rgb|argb)\(/, "a literal colour; use @color/ui_color_…"],
    [/\b0x[Ff]{2}[0-9a-fA-F]{6}\b/, "a literal colour; use @color/ui_color_…"],
  ],
  xml: [
    [/"#[0-9a-fA-F]{3,8}"/, "a literal colour; use @color/ui_color_…"],
    [/"(?!0dp")\d+(?:\.\d+)?(?:dp|sp)"/, "a literal dimension; use @dimen/ui_…"],
  ],
  axaml: [[/"#[0-9a-fA-F]{3,8}"/, "a literal colour; use {DynamicResource UiColor…}"]],
};

const TYPE_BY_EXT = {
  ".ts": "web",
  ".tsx": "web",
  ".js": "web",
  ".jsx": "web",
  ".mjs": "web",
  ".vue": "web",
  ".css": "web",
  ".scss": "web",
  ".dart": "dart",
  ".kt": "kotlin",
  ".xml": "xml",
  ".axaml": "axaml",
};

const COMMENT_ONLY = /^\s*(?:\/\/|\/\*|\*|<!--|#\s)/;
const ALLOW = /ui-kit-allow:\s*\S/;

export function* walk(dir, root) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === "node_modules" || name.startsWith(".") || name === "build" || name === "dist") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path, root);
    else yield relative(root, path).split(sep).join("/");
  }
}

/** @returns {string[]} problems as `file:line  text: reason` */
export function checkRawValues(root, config) {
  const generated = new Set(Object.values(config.outputs).filter(Boolean));
  const androidRes = config.outputs.android?.replace(/\/$/, "");
  const allowed = config.allow.rawValues ?? {};
  const problems = [];
  for (const source of config.sources) {
    for (const file of walk(join(root, source), root)) {
      const type = TYPE_BY_EXT[extname(file)];
      if (!type || generated.has(file) || allowed[file]) continue;
      if (androidRes && file.startsWith(`${androidRes}/`) && /\/values(?:-night)?\/ui_tokens\.xml$/.test(file)) continue;
      // Android XML outside res/ (manifests, Gradle files) holds no interface values.
      if (type === "xml" && !/\/res\//.test(`/${file}`)) continue;
      if (config.kitDir && file.startsWith(`${config.kitDir}/`)) continue;
      readFileSync(join(root, file), "utf8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (COMMENT_ONLY.test(line) || ALLOW.test(line)) return;
          for (const [pattern, why] of RULES[type]) {
            const m = pattern.exec(line);
            if (m) {
              problems.push(`${file}:${i + 1}  ${m[0].replace(/^"|"$/g, "")}: ${why}`);
              break;
            }
          }
        });
    }
  }
  return problems;
}
