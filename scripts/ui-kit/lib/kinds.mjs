// Message kinds (COMPANY/UI_STANDARDS.md §3): a message's key says what kind of text it is, and the kind
// decides its component, place and length cap. Shared by copy-lint and message-sites.

/** Default caps in characters, measured on the source language. `null` is uncapped. */
export const CAPS = {
  label: 30,
  title: 60,
  placeholder: 40,
  hint: 80,
  error: 120,
  result: 60,
  status: 60,
  confirm: 160,
  empty: 120,
  sr: 120,
  alt: 200,
  detail: 400,
  prose: null,
};

export const KINDS = Object.keys(CAPS);
/** Kinds that are messages shown in response to state, so they must be rendered by the kit's components. */
export const MESSAGE_KINDS = ["hint", "error", "result", "status", "confirm", "empty", "detail"];

const word = (w) => {
  const lower = w.toLowerCase();
  return lower === "errors" ? "error" : KINDS.includes(lower) ? lower : null;
};
const camelWords = (s) => s.split(/(?<=[a-z0-9])(?=[A-Z])/);

/**
 * The kind a key declares, or null when it declares none (then it is a label by default).
 * Accepted forms: a segment (`upload.size.hint`), a camelCase suffix (`roomNameHint`), the parent segment of
 * a variant (`errors.tooLarge`, `delete.confirm.title`), and for Android a snake_case prefix or suffix
 * (`hint_upload_size`, `upload_size_hint`).
 * @param {string[]} segments the key split on dots
 */
export function declaredKind(segments) {
  const last = segments.at(-1);
  if (last.includes("_")) {
    const parts = last.split("_");
    return word(parts.at(-1)) ?? word(parts[0]);
  }
  const fromLast = word(last) ?? word(camelWords(last).at(-1));
  if (fromLast) return fromLast;
  if (segments.length > 1) {
    const parent = segments.at(-2);
    return word(parent) ?? word(camelWords(parent).at(-1));
  }
  return null;
}

/**
 * The visible length of an ICU message: an argument counts as 6 characters, a plural or select as its
 * longest branch, `#` as 2, and rich-text tags are not counted.
 */
export function visibleLength(message) {
  return flatten(message.replace(/<\/?[a-zA-Z][\w-]*>/g, "")).length;
}

function flatten(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "'" && s[i + 1] === "'") {
      out += "'";
      i += 2;
      continue;
    }
    if (c === "#") {
      out += "##";
      i++;
      continue;
    }
    if (c !== "{") {
      out += c;
      i++;
      continue;
    }
    const end = matching(s, i);
    const inner = s.slice(i + 1, end);
    const parts = inner.split(",").map((p) => p.trim());
    if (parts.length >= 3 && /^(plural|select|selectordinal)$/.test(parts[1])) {
      const branches = [];
      const body = inner.slice(inner.indexOf(",", inner.indexOf(",") + 1) + 1);
      for (let j = 0; j < body.length; j++) {
        if (body[j] === "{") {
          const close = matching(body, j);
          branches.push(flatten(body.slice(j + 1, close)));
          j = close;
        }
      }
      out += branches.reduce((a, b) => (b.length > a.length ? b : a), "");
    } else out += "xxxxxx";
    i = end + 1;
  }
  return out;
}

function matching(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i;
  }
  return s.length - 1;
}
