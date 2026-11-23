#!/usr/bin/env node
// Every static UI check in one command (COMPANY/UI_STANDARDS.md §5): tokens and contrast, generated files
// current, raw values, copy, message sites, ui-kit page coverage. The Playwright checks (axe, layout stability) run in the e2e suite.
// Usage: node scripts/ui-kit/ui-check.mjs [projectDir] [--inventory] [--write]
//   --write regenerates the ui-kit page's states registry first.
//   --inventory prints every message with its kind and length, for the milestone check-in's string review.
import { pathToFileURL } from "node:url";
import { loadConfig } from "./lib/config.mjs";
import { lintCopy } from "./lib/copy-lint.mjs";
import { checkMessageSites } from "./lib/message-sites.mjs";
import { checkRawValues } from "./lib/raw-values.mjs";
import { checkUiPage, writeRegistry } from "./lib/ui-page.mjs";
import { runTokens } from "./ui-tokens.mjs";

export function runAll(root) {
  const config = loadConfig(root);
  const sections = [];
  const tokens = runTokens(root, { check: true });
  sections.push(["tokens", tokens.problems, tokens.notes]);
  sections.push(["raw-values", checkRawValues(root, config), []]);
  const copy = lintCopy(root, config);
  sections.push(["copy", copy.problems, copy.warnings]);
  sections.push(["message-sites", checkMessageSites(root, config), []]);
  if (config.uiPage) sections.push(["ui-page", checkUiPage(root, config), []]);
  return { sections, inventory: copy.inventory };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const root = args.find((a) => !a.startsWith("--")) ?? ".";
  if (args.includes("--write") && writeRegistry(root, loadConfig(root))) console.log("ui-page: registry written");
  const { sections, inventory } = runAll(root);
  if (args.includes("--inventory")) {
    for (const m of inventory) console.log(`${m.kind.padEnd(11)} ${String(m.length).padStart(4)}  ${m.key}`);
    console.log("");
  }
  let failed = 0;
  for (const [name, problems, notes] of sections) {
    for (const n of notes) console.log(`${name}: warning: ${n}`);
    if (problems.length) {
      failed += problems.length;
      console.error(`${name}: ${problems.length} problem(s)\n${problems.map((p) => `  ${p}`).join("\n")}`);
    } else console.log(`${name}: ok`);
  }
  if (failed) {
    console.error(`\nui-check: ${failed} problem(s)`);
    process.exit(1);
  }
}
