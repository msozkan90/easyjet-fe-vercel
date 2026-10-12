"use client";

import { Skeleton } from "antd";

/**
 * Neutral metric card: label, large tabular value and an optional hint.
 * `accent` draws a small dot next to the label (never a colored background).
 */
export default function StatCard({
  label,
  value,
  hint,
  accent,
  loading = false,
  className = "",
}) {
  return (
    <div
      className={`flex h-full flex-col gap-1.5 rounded-xl border border-line bg-surface p-5 ${className}`.trim()}
    >
      <div className="flex items-center gap-2 text-[13px] font-medium text-text-secondary">
        {accent ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: accent }}
            aria-hidden="true"
          />
        ) : null}
        <span>{label}</span>
      </div>
      {loading ? (
        <Skeleton.Input active size="small" style={{ width: 120 }} />
      ) : (
        <div className="ej-mono text-[26px] font-semibold leading-9 text-text">
          {value}
        </div>
      )}
      {hint ? <div className="text-xs text-text-secondary">{hint}</div> : null}
    </div>
  );
}
