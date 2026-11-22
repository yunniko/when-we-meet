#!/usr/bin/env node
// Generates the platform files from design/tokens.json, or with --check verifies they are current and that the
// tokens pass validation and contrast (COMPANY/UI_STANDARDS.md §1). Exit 1 names every problem.
// Usage: node scripts/ui-kit/ui-tokens.mjs [--check] [projectDir]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig, readJson } from "./lib/config.mjs";
import { checkContrast } from "./lib/contrast.mjs";
import { plannedOutputs } from "./lib/outputs.mjs";
import { resolveTokens, TokenError } from "./lib/tokens.mjs";

/** @returns {{problems: string[], notes: string[], written: string[]}} */
export function runTokens(root, { check }) {
  const config = loadConfig(root);
  const problems = [];
  let resolved;
  try {
    resolved = resolveTokens(readJson(root, config.tokens));
  } catch (e) {
    if (e instanceof TokenError)
      return { problems: e.problems.map((p) => `${config.tokens} ${p.path}: ${p.message}`), notes: [], written: [] };
    throw e;
  }
  for (const f of checkContrast(resolved)) problems.push(`${config.tokens} contrast ${f.message}`);
  const { files, notes } = plannedOutputs(resolved, config);
  const written = [];
  for (const [rel, text] of Object.entries(files)) {
    const path = join(root, rel);
    const current = existsSync(path) ? readFileSync(path, "utf8").replace(/\r\n/g, "\n") : null;
    if (current === text) continue;
    if (check) problems.push(`${rel}: ${current === null ? "missing" : "out of date"}; run node scripts/ui-kit/ui-tokens.mjs`);
    else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
      written.push(rel);
    }
  }
  return { problems, notes, written };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const root = args.find((a) => !a.startsWith("--")) ?? ".";
  const { problems, notes, written } = runTokens(root, { check });
  for (const n of notes) console.log(`note: ${n}`);
  for (const w of written) console.log(`wrote ${w}`);
  if (problems.length) {
    console.error(problems.join("\n"));
    console.error(`\nui-tokens: ${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log(check ? "ui-tokens: tokens valid, contrast passes, generated files current" : "ui-tokens: done");
}
