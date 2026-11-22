// A project's ui-kit settings: design/ui-kit.json (docs/usage.md lists every field).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_PATH = "design/ui-kit.json";

/** @param {string} root the project directory */
export function loadConfig(root) {
  const path = join(root, CONFIG_PATH);
  if (!existsSync(path)) throw new Error(`${CONFIG_PATH} not found in ${root}: every project using ui-kit has one (docs/usage.md)`);
  const config = JSON.parse(readFileSync(path, "utf8"));
  return {
    tokens: "design/tokens.json",
    outputs: {},
    modeSelectors: {},
    sources: [],
    catalogs: [],
    contentNamespaces: [],
    ignoreNamespaces: [],
    allow: {},
    caps: {},
    banned: [],
    kitDir: null,
    kitImport: "ui-kit",
    e2eHelpers: "e2e/ui-kit",
    ...config,
  };
}

export function readJson(root, rel) {
  const path = join(root, rel);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`${rel}: ${e.code === "ENOENT" ? "not found" : `not valid JSON (${e.message})`}`);
  }
}
