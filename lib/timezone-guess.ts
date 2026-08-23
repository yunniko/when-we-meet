// Best-effort mapping from a UTC offset (in minutes, using
// `Date.prototype.getTimezoneOffset()`'s convention: positive when local
// time is BEHIND UTC) to a fixed-offset IANA zone that's present in every
// Intl implementation we've seen (unlike named zones, which some hardened
// browsers refuse to resolve — see pickGuessedTimezone). Etc/GMT signs are
// POSIX-inverted from everyday usage (Etc/GMT+5 means UTC-5), hence the
// extra negation. Half/quarter-hour offsets (India, Nepal, ...) round to
// the nearest whole hour — an acceptable loss of precision for a fallback
// path that only runs when better sources failed.
export function offsetMinutesToEtcZone(offsetMinutes: number): string {
  const utcOffsetHours = Math.round(-offsetMinutes / 60);
  if (utcOffsetHours === 0) return "UTC";
  const clamped = Math.max(-12, Math.min(14, utcOffsetHours));
  const sign = clamped > 0 ? "-" : "+";
  return `Etc/GMT${sign}${Math.abs(clamped)}`;
}

// Picks the best available timezone guess from whatever sources the caller
// managed to read. Each source is nullable because it can fail or be
// unavailable depending on the browser (some privacy-hardened browsers
// normalize Intl's resolved zone to a generic value; `Intl.supportedValuesOf`
// itself is unsupported on some older engines). Preference order:
//   1. A live Intl reading — most accurate, reflects where the visitor
//      actually is right now.
//   2. A remembered previous choice — could be stale if they've since
//      traveled, but still better than an arbitrary default.
//   3. A coarse UTC-offset mapping — works even where Intl's zone-*name*
//      resolution is unavailable, since it only needs `Date`.
//   4. Plain UTC.
// Every candidate is checked against the actual set of zones the running
// browser supports, so we never select a value the <select> doesn't have
// as an option.
export function pickGuessedTimezone(input: {
  intlZone: string | null;
  rememberedZone: string | null;
  offsetMinutes: number | null;
  supportedZones: ReadonlySet<string>;
}): string {
  const { intlZone, rememberedZone, offsetMinutes, supportedZones } = input;
  if (intlZone && supportedZones.has(intlZone)) return intlZone;
  if (rememberedZone && supportedZones.has(rememberedZone)) return rememberedZone;
  if (offsetMinutes !== null) {
    const etcZone = offsetMinutesToEtcZone(offsetMinutes);
    if (supportedZones.has(etcZone)) return etcZone;
  }
  return "UTC";
}
