import { getLocale, getTranslations } from "next-intl/server";
import { setLocaleAction } from "@/lib/locale-actions";
import { enabledUiLocales, localeDisplayName } from "@/lib/ui-locales";
import { LocaleSelect } from "./locale-select";

export async function LocaleSwitcher() {
  const locales = enabledUiLocales();
  const current = await getLocale();
  const t = await getTranslations("LocaleSwitcher");
  const options = locales.map((code) => ({ code, label: localeDisplayName(code) }));
  return (
    <LocaleSelect current={current} options={options} action={setLocaleAction} label={t("label")} />
  );
}
