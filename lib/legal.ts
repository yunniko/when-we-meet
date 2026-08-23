import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

// The single About/Terms/Privacy page (Owner-directed, 2026-08-23) renders
// this doc as its source of truth, same pattern as listing-studio's
// docs/legal — content stays editable markdown, not JSX. The Dockerfile
// copies docs/legal into the runtime image alongside the build output.
const DOC_PATH = path.join(process.cwd(), "docs", "legal", "about-terms-privacy.md");

export async function legalDocHtml(): Promise<string> {
  const markdown = await readFile(DOC_PATH, "utf8");
  return marked.parse(markdown, { async: false });
}
