const formatters = new Map();

const getFormatter = (currency, fractionDigits) => {
  const key = `${currency}-${fractionDigits}`;
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
    );
  }
  return formatters.get(key);
};

/**
 * Formats an amount as currency ("$1,234.50"). Returns `fallback` for empty
 * or non-numeric input so tables never show "NaN".
 */
export function formatMoney(
  value,
  { currency = "USD", fractionDigits = 2, fallback = "-" } = {},
) {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  try {
    return getFormatter(currency || "USD", fractionDigits).format(numeric);
  } catch {
    return getFormatter("USD", fractionDigits).format(numeric);
  }
}
