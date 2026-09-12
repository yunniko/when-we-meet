# D008 · Multi-language UI reuses listing-studio's next-intl pattern with a fixed four-locale list
Date: 2026-08-17 · Goal: G-002 · Status: active
Context: listing-studio already solved cookie-based locale, English deep-merge fallback and the select-remount trick.
Decision: Copied as-is; `enabledUiLocales()` returns a hardcoded en/ru/cs/de instead of an env var. Validation messages are i18n keys resolved client-side; plurals use ICU categories; day/month labels and hour digits deliberately stay unlocalized ("translations, not formats"). Geist gets latin-ext and cyrillic subsets.
Rejected: URL locale segments (a shared room URL would differ per language).
Consequence: `Room.timezone`, slugs and formatting are orthogonal to locale.
Evidence: `lib/ui-locales.ts`; `i18n/request.ts`.
