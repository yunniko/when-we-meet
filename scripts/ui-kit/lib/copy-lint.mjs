// Checks the source-language message catalogs against the message policy (COMPANY/UI_STANDARDS.md §3):
// every message's kind and length cap, labels that read as sentences (a message with no kind), banned
// phrases, the project glossary's banned words, and repeated text (a warning). Problems name file and line.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CAPS, declaredKind, visibleLength } from "./kinds.mjs";

/** Phrases that explain the obvious or pad the text (§3 "Never"). Matched case-insensitively on whole words. */
export const BANNED = [
  ["please note", "say the thing itself"],
  ["note:", "say the thing itself"],
  ["simply", "drop it"],
  ["easily", "drop it"],
  ["click here", "name the destination in the link"],
  ["allows you to", "say what it does, or nothing"],
  ["lets you", "say what it does, or nothing"],
  ["feel free", "drop it"],
  ["don't worry", "say what happens"],
];

/** @returns {{key: string, segments: string[], text: string, line: number}[]} */
export function readCatalog(format, raw) {
  const lines = raw.split(/\r?\n/);
  const lineOf = (index) => raw.slice(0, index).split("\n").length;
  if (format === "next-intl" || format === "arb") {
    const data = JSON.parse(raw);
    const out = [];
    const walk = (node, segments, from) => {
      for (const [k, v] of Object.entries(node)) {
        if (format === "arb" && k.startsWith("@")) continue;
        // Find this key after its parent's position, so a repeated name resolves to the right line.
        const at = raw.indexOf(`"${k}"`, from);
        if (typeof v === "string")
          out.push({ key: [...segments, k].join("."), segments: [...segments, k], text: v, line: at >= 0 ? lineOf(at) : 0 });
        else if (v && typeof v === "object") walk(v, [...segments, k], at >= 0 ? at : from);
      }
    };
    walk(data, [], 0);
    return out;
  }
  if (format === "android") {
    const out = [];
    const unescape = (s) =>
      s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/<[^>]+>/g, "")
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\n/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .trim();
    for (const m of raw.matchAll(/<string\s+name="([^"]+)"([^>]*)>([\s\S]*?)<\/string>/g)) {
      if (/translatable="false"/.test(m[2])) continue;
      out.push({ key: m[1], segments: [m[1]], text: unescape(m[3]), line: lineOf(m.index) });
    }
    for (const m of raw.matchAll(/<plurals\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/plurals>/g)) {
      const items = [...m[2].matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)].map((i) => unescape(i[1]));
      const longest = items.reduce((a, b) => (b.length > a.length ? b : a), "");
      out.push({ key: m[1], segments: [m[1]], text: longest, line: lineOf(m.index) });
    }
    return out;
  }
  throw new Error(`unknown catalog format "${format}" (next-intl, arb or android)`);
}

/** The glossary's "## Words" table: | Use | Not | Except |, the format cross-stitch's check-words reads. */
export function readGlossary(text) {
  const start = text.indexOf("## Words");
  if (start < 0) return [];
  const rows = text
    .slice(start)
    .split(/\r?\n/)
    .filter((l) => l.startsWith("| ") && !/^\|\s*Use\s*\|/.test(l) && !l.startsWith("|---") && !l.startsWith("| ---"))
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim())
    );
  const escape = (w) => w.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return rows
    .filter((r) => r.length >= 2 && r[1])
    .map(([use, not, except]) => ({
      use,
      banned: new RegExp(
        `(?<![\\w.-])(?:${not
          .split(/,\s*/)
          .map((v) => escape(v.replace(/\*$/, "")).replace(/ /g, "\\s+") + (v.endsWith("*") ? "\\w*" : ""))
          .join("|")})(?![\\w-])`,
        "i"
      ),
      allowed: except ? except.split(/;\s*/).map((p) => new RegExp(escape(p).replace(/ /g, "\\s+"), "gi")) : [],
    }));
}

/**
 * @param {string} root project directory
 * @param {ReturnType<import("./config.mjs").loadConfig>} config
 * @returns {{problems: string[], warnings: string[], inventory: {file: string, key: string, kind: string, length: number}[]}}
 */
export function lintCopy(root, config) {
  const problems = [];
  const warnings = [];
  const inventory = [];
  const caps = { ...CAPS, ...config.caps };
  const banned = [...BANNED, ...config.banned.map((b) => (Array.isArray(b) ? b : [b, "the project bans it"]))];
  const glossaryPath = join(root, "docs/glossary.md");
  const glossary = existsSync(glossaryPath) ? readGlossary(readFileSync(glossaryPath, "utf8")) : [];
  const allowed = config.allow.copy ?? {};

  for (const catalog of config.catalogs) {
    const raw = readFileSync(join(root, catalog.path), "utf8");
    const entries = readCatalog(catalog.format, raw);
    const seen = new Map();
    for (const e of entries) {
      const namespace = e.segments[0];
      if (config.ignoreNamespaces.includes(namespace)) continue;
      const at = `${catalog.path}:${e.line}`;
      const declared = declaredKind(e.segments);
      const content = config.contentNamespaces.includes(namespace);
      const kind = declared ?? (content ? "prose" : "label");
      const length = visibleLength(e.text);
      inventory.push({ file: catalog.path, key: e.key, kind, length });
      if (allowed[e.key]) continue;
      const fail = (msg) => problems.push(`${at}  ${e.key}: ${msg}`);

      if (kind === "prose" && !content)
        fail(`prose is allowed only in content namespaces (${config.contentNamespaces.join(", ") || "none configured"})`);
      const cap = caps[kind];
      // An untagged sentence is one problem, not two: the fix is to give it a kind, which changes its cap.
      if (kind === "label" && !declared && (/[.?!:;]$/.test(e.text.trim()) || /[.?!]\s+\S/.test(e.text)))
        fail("reads as a sentence but its key declares no kind; give the key its kind (hint, error, …) or shorten it to a label");
      else if (cap != null && length > cap) fail(`${kind} is ${length} characters, the cap is ${cap}`);
      if (/!/.test(e.text.replace(/\{[^}]*\}/g, ""))) fail("no exclamation marks");
      for (const [phrase, advice] of banned) {
        const re = new RegExp(`(?<![\\w])${phrase.replace(/[.+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`, "i");
        if (re.test(e.text)) fail(`"${phrase}": ${advice}`);
      }
      for (const rule of glossary) {
        const bare = rule.allowed.reduce((t, p) => t.replace(p, " "), e.text);
        const m = rule.banned.exec(bare);
        if (m) fail(`"${m[0]}": the glossary says ${rule.use}`);
      }
      const norm = e.text.trim().toLowerCase();
      const dupKey = `${namespace}\u0000${norm}`;
      if (norm.length > 0 && seen.has(dupKey))
        warnings.push(`${at}  ${e.key}: same text as ${seen.get(dupKey)} in ${namespace}; one key, or different words`);
      else seen.set(dupKey, e.key);
    }
  }
  return { problems, warnings, inventory };
}
