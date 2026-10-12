"use client";

import { formatMoney } from "@/utils/formatMoney";

export default function MoneyText({ value, currency, strong, className = "" }) {
  return (
    <span
      className={`ej-mono whitespace-nowrap ${strong ? "font-semibold" : ""} ${className}`.trim()}
    >
      {formatMoney(value, { currency })}
    </span>
  );
}
