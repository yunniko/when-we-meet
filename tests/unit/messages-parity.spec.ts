// Every locale has exactly English's keys, and each message uses the same ICU arguments: a dropped `{name}`
// renders wrongly and no type check sees it.
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import cs from "../../messages/cs.json";
import de from "../../messages/de.json";

type Tree = { [k: string]: string | Tree };
const flatten = (t: Tree, prefix = ""): [string, string][] =>
  Object.entries(t).flatMap(([k, v]) => (typeof v === "string" ? [[prefix + k, v]] : flatten(v, `${prefix}${k}.`)));

/** Argument names: `{name}` or `{count, plural, ...}`; plural branch text (`=0 {...}`) is not an argument. */
const args = (s: string) => [...new Set([...s.matchAll(/\{\s*(\w+)\s*[},]/g)].map((m) => m[1]))].sort();

const source = new Map(flatten(en as Tree));

describe.each([
  ["ru", ru],
  ["cs", cs],
  ["de", de],
])("messages/%s.json", (_locale, catalog) => {
  const messages = new Map(flatten(catalog as Tree));

  it("has exactly the English keys", () => {
    expect([...messages.keys()].sort()).toEqual([...source.keys()].sort());
  });

  it("uses the same ICU arguments as English in every message", () => {
    const mismatched = [...source].filter(([k, v]) => messages.has(k) && args(v).join() !== args(messages.get(k)!).join());
    expect(mismatched.map(([k]) => k)).toEqual([]);
  });
});
