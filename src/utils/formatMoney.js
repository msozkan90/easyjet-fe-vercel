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

/**
 * Formats a plain amount with two decimals in the browser locale
 * ("1,234.50"), without a currency symbol. Empty input returns `fallback`;
 * non-numeric input is returned unchanged.
 */
export function formatAmount(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return value;
  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Currency in the browser locale (used by transfer order screens).
 * Non-numeric input returns "-".
 */
export function formatCurrency(value, currency = "USD") {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  } catch {
    return formatAmount(numericValue);
  }
}
