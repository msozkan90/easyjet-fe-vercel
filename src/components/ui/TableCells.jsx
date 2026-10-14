"use client";

import moment from "moment";
import StatusTag from "@/components/ui/StatusTag";
import { useTranslations } from "@/i18n/use-translations";

const ENTITY_TONES = {
  company: "info",
  partner: "printed",
  customer: "neutral",
};

/** Date on the first line, time below it; never wraps mid-date. */
export function DateTimeCell({ value, empty = "-" }) {
  const date = value ? moment(value) : null;
  if (!date?.isValid()) return <span className="text-text-secondary">{empty}</span>;
  return (
    <span className="flex flex-col whitespace-nowrap leading-5">
      <span className="tabular-nums text-text">{date.format("ll")}</span>
      <span className="tabular-nums text-xs text-text-secondary">
        {date.format("LT")}
      </span>
    </span>
  );
}

/**
 * Yes as a green pill; no as quiet text so it does not look like an error,
 * unless `noTone` marks a missing value as a problem (e.g. "danger").
 */
export function YesNoCell({ value, noTone }) {
  const t = useTranslations("common.boolean");
  if (value) {
    return (
      <StatusTag tone="success" size="small">
        {t("yes")}
      </StatusTag>
    );
  }
  return noTone ? (
    <StatusTag tone={noTone} size="small">
      {t("no")}
    </StatusTag>
  ) : (
    <span className="text-text-secondary">{t("no")}</span>
  );
}

/** Entity name with its translated type as a small pill underneath. */
export function EntityCell({ name, type, empty = "-" }) {
  const t = useTranslations("common.entityTypes");
  const normalizedType = String(type || "").toLowerCase();
  if (!name && !normalizedType) {
    return <span className="text-text-secondary">{empty}</span>;
  }
  const typeLabel = normalizedType ? t(normalizedType) : null;
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="text-text">{name || empty}</span>
      {typeLabel ? (
        <StatusTag tone={ENTITY_TONES[normalizedType] || "neutral"} size="small">
          {typeLabel.startsWith("common.entityTypes.") ? normalizedType : typeLabel}
        </StatusTag>
      ) : null}
    </span>
  );
}

/** Neutral pill for counts, sizes and prices (e.g. "Qty 2", "$1.06"). */
export function MetaChip({ children, className = "" }) {
  return <span className={`ej-chip ${className}`.trim()}>{children}</span>;
}
