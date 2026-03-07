export function translateOrFallback(translator, key, fallback) {
  const value = translator(key);
  return value === key ? fallback : value;
}
