import { useMemo } from "react";
import { useI18nContext } from "./I18nProvider";

export function useTranslations(namespace) {
  const { getTranslator } = useI18nContext();

  return useMemo(() => getTranslator(namespace), [getTranslator, namespace]);
}

export function useLocaleInfo() {
  const { locale, localeLabel, changeLocale, isChangingLocale } =
    useI18nContext();

  return {
    locale,
    localeLabel,
    changeLocale,
    isChangingLocale,
  };
}
