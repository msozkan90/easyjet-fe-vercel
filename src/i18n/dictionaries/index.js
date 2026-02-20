export const dictionaries = {
  tr: () => import("./tr.json").then((mod) => mod.default),
  en: () => import("./en.json").then((mod) => mod.default),
};
