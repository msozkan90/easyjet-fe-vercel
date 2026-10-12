"use client";

import StatCard from "@/components/ui/StatCard";

const formatValue = (value, precision) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value ?? "-";
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
};

export default function DashboardSummaryCard({ title, value, color, icon, suffix, precision = 0 }) {
  return (
    <StatCard
      label={
        <span className="inline-flex items-center gap-1.5">
          {icon ? <span style={{ color }} aria-hidden="true">{icon}</span> : null}
          {title}
        </span>
      }
      value={
        <>
          {formatValue(value, precision)}
          {suffix ? <span className="ml-1 text-base text-text-secondary">{suffix}</span> : null}
        </>
      }
    />
  );
}
