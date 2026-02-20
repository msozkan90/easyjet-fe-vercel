import { cookies } from "next/headers";
import { createTranslator } from "./translator";
import { getDictionary } from "./get-dictionary";
import { defaultLocale, locales } from "./settings";

function isSupportedLocale(value) {
  return typeof value === "string" && locales.includes(value);
}

export function getLocale() {
  const store = cookies();
  const cookieLocale = store.get("NEXT_LOCALE")?.value;

  if (isSupportedLocale(cookieLocale)) {
    return cookieLocale;
  }

  return defaultLocale;
}

export async function getTranslations(namespace) {
  const locale = getLocale();
  const messages = await getDictionary(locale);

  return {
    locale,
    t: createTranslator(messages, namespace),
    messages,
  };
}
