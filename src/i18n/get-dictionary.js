import { dictionaries } from "./dictionaries";
import { defaultLocale } from "./settings";

export async function getDictionary(locale) {
  const loader = dictionaries[locale] || dictionaries[defaultLocale];
  return loader();
}
