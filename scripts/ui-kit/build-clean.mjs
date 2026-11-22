#!/usr/bin/env node
// Fails when a production build contains the kitchen sink (COMPANY/UI_STANDARDS.md §2; STANDARDS.md "Nothing
// test-only ships"). The kitchen sink's root element carries `data-ui-kit-sink`; this looks for that marker in
// every file of the build directory.
// Usage: node scripts/ui-kit/build-clean.mjs <buildDir>   (e.g. .next, dist, build/web)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const MARKER = "data-ui-kit-sink";

/** @returns {string[]} files (relative to dir) containing the marker */
export function findSink(dir) {
  const hits = [];
  const visit = (d, rel) => {
    for (const name of readdirSync(d)) {
      if (name === "cache") continue; // Next's build cache keeps development compilations.
      const path = join(d, name);
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(path).isDirectory()) visit(path, r);
      else if (readFileSync(path).includes(MARKER)) hits.push(r);
    }
  };
  visit(dir, "");
  return hits;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: build-clean.mjs <buildDir>");
    process.exit(2);
  }
  const hits = findSink(dir);
  if (hits.length) {
    console.error(`build-clean: the kitchen sink is in the production build:\n${hits.map((h) => `  ${dir}/${h}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`build-clean: no kitchen sink in ${dir}`);
}
