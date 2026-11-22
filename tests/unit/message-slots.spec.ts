// Every message a slot can show is reserved in that slot (lib/message-slots.ts, ui-kit D007): an error key no
// slot lists would appear in a slot sized without it and move the page below. The exception is an error the
// browser already prevents, which is listed as such. Listed keys must exist.
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import { BROWSER_PREVENTED, MESSAGE_SLOTS } from "@/lib/message-slots";

type Catalog = { [key: string]: string | Catalog };
const catalog = en as Catalog;

function lookup(namespace: string, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Catalog | undefined)?.[part], catalog[namespace]);
}

describe("message slots", () => {
  it("lists only keys that exist", () => {
    for (const [namespace, slots] of Object.entries(MESSAGE_SLOTS)) {
      for (const key of Object.values(slots).flat()) {
        expect(typeof lookup(namespace, key), `${namespace}.${key}`).toBe("string");
      }
    }
    for (const [namespace, keys] of Object.entries(BROWSER_PREVENTED)) {
      for (const key of Object.keys(keys)) expect(typeof lookup(namespace, key), `${namespace}.${key}`).toBe("string");
    }
  });

  it("never both reserves and calls an error browser-prevented", () => {
    for (const [namespace, keys] of Object.entries(BROWSER_PREVENTED)) {
      const listed = Object.values((MESSAGE_SLOTS as Record<string, Record<string, readonly string[]>>)[namespace] ?? {}).flat();
      expect(
        listed.filter((key) => key in keys),
        namespace
      ).toEqual([]);
    }
  });

  it("reserves every error key of every namespace in some slot, or marks it browser-prevented", () => {
    const missing: string[] = [];
    for (const [namespace, node] of Object.entries(catalog)) {
      const errors = typeof node === "object" ? node.errors : undefined;
      if (typeof errors !== "object") continue;
      const listed = new Set<string>([
        ...Object.keys(BROWSER_PREVENTED[namespace] ?? {}),
        ...Object.values((MESSAGE_SLOTS as Record<string, Record<string, readonly string[]>>)[namespace] ?? {}).flat(),
      ]);
      for (const key of Object.keys(errors)) if (!listed.has(`errors.${key}`)) missing.push(`${namespace}.errors.${key}`);
    }
    expect(missing).toEqual([]);
  });
});
