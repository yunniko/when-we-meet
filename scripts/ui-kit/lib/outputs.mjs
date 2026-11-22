// What the generator would write for a project, keyed by path relative to the project root.
import { toAndroid, toAvalonia, toCss, toDart } from "./generate.mjs";

/** @returns {{files: Record<string, string>, notes: string[]}} */
export function plannedOutputs(resolved, config) {
  const files = {};
  const notes = [];
  const { css, dart, android, avalonia } = config.outputs;
  if (css) files[css] = toCss(resolved, { modeSelectors: config.modeSelectors });
  if (dart) files[dart] = toDart(resolved);
  if (avalonia) files[avalonia] = toAvalonia(resolved);
  if (android) {
    const { files: res, skippedModes } = toAndroid(resolved);
    for (const [rel, text] of Object.entries(res)) files[`${android.replace(/\/$/, "")}/${rel}`] = text;
    for (const m of skippedModes) notes.push(`android: mode "${m}" has no Android resource qualifier and is not generated`);
  }
  if (Object.keys(files).length === 0) notes.push('no "outputs" in design/ui-kit.json: nothing is generated');
  return { files, notes };
}
