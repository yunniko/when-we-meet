// One component per message kind (COMPANY/UI_STANDARDS.md §2, §3): on the web, live regions exist only in the
// kit's components, and a file that shows a message kind (hint, error, result, …) imports those components
// instead of rendering the text its own way. See D003 for why this is a script and not an ESLint rule.
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { declaredKind, MESSAGE_KINDS } from "./kinds.mjs";
import { walk } from "./raw-values.mjs";

const LIVE = /\baria-live=|\brole=["'{](?:alert|status|alertdialog|log)\b|\brole=\{?["'](?:alert|status|alertdialog|log)["']/;
/** `t("a.b")`, `t.rich("a.b")`, `t.markup(…)`, `$t('a.b')` (Vue). */
const CALL = /(?:\bt|\$t)(?:\.(?:rich|markup|raw))?\(\s*["'`]([\w.-]+)["'`]/g;

/** @returns {string[]} problems as `file:line  reason` */
export function checkMessageSites(root, config) {
  if (!config.kitDir) return [];
  const importsKit = new RegExp(`from\\s+["'][^"']*${config.kitImport.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}[^"']*["']`);
  const problems = [];
  for (const source of config.sources) {
    for (const file of walk(join(root, source), root)) {
      if (![".tsx", ".jsx", ".vue"].includes(extname(file)) || file.startsWith(`${config.kitDir}/`)) continue;
      if (config.allow.messageSites?.[file]) continue;
      const text = readFileSync(join(root, file), "utf8");
      const lines = text.split(/\r?\n/);
      const usesKit = importsKit.test(text);
      lines.forEach((line, i) => {
        if (/ui-kit-allow:\s*\S/.test(line)) return;
        if (LIVE.test(line)) problems.push(`${file}:${i + 1}  a live region outside the kit; announce through the kit's components`);
        if (usesKit) return;
        for (const m of line.matchAll(CALL)) {
          const kind = declaredKind(m[1].split("."));
          if (MESSAGE_KINDS.includes(kind))
            problems.push(
              `${file}:${i + 1}  shows ${/^[aeiou]/.test(kind) ? "an" : "a"} ${kind} message ("${m[1]}") without the kit's components; use the kit's ${kind} component`
            );
        }
      });
    }
  }
  return problems;
}
