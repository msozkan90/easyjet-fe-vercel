"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { dictionaries } from "./dictionaries";
import { createTranslator } from "./translator";
import { defaultLocale, localeLabels } from "./settings";

const LocaleContext = createContext(null);

export function I18nProvider({ locale: initialLocale, dictionary, children }) {
  const router = useRouter();
  const [locale, setLocale] = useState(initialLocale);
  const [messages, setMessages] = useState(dictionary);
  const [isPending, startTransition] = useTransition();

  const applyLocale = useCallback(async (nextLocale) => {
    const loader = dictionaries[nextLocale] || dictionaries[defaultLocale];
    const nextMessages = await loader();
    setLocale(nextLocale);
    setMessages(nextMessages);
  }, []);

  const changeLocale = useCallback(
    async (nextLocale) => {
      if (nextLocale === locale) return;

      document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000`;

      await applyLocale(nextLocale);

      startTransition(() => {
        router.refresh();
      });
    },
    [applyLocale, locale, router]
  );

  const getTranslator = useCallback(
    (namespace) => createTranslator(messages, namespace),
    [messages]
  );

  const value = useMemo(
    () => ({
      locale,
      messages,
      changeLocale,
      isChangingLocale: isPending,
      getTranslator,
      localeLabel:
        localeLabels[locale] || localeLabels[defaultLocale] || locale,
    }),
    [changeLocale, getTranslator, isPending, locale, messages]
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useI18nContext() {
  const ctx = useContext(LocaleContext);

  if (!ctx) {
    throw new Error("useI18nContext must be used within I18nProvider.");
  }

  return ctx;
}
