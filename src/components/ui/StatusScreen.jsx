"use client";

import Image from "next/image";
import {
  CheckCircleFilled,
  CloseCircleFilled,
  WarningFilled,
} from "@ant-design/icons";

const TONES = {
  success: {
    icon: <CheckCircleFilled />,
    className: "bg-success-bg text-success",
  },
  error: { icon: <CloseCircleFilled />, className: "bg-danger-bg text-danger" },
  warning: { icon: <WarningFilled />, className: "bg-warning-bg text-warning" },
};

/**
 * Centered full-page message used for verification results and errors.
 */
export default function StatusScreen({
  tone = "success",
  title,
  description,
  note,
  actions,
}) {
  const config = TONES[tone] || TONES.success;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-canvas p-6">
      <Image
        src="/logo.png"
        alt="EasyJet"
        width={40}
        height={40}
        className="rounded-lg bg-ink-900 p-1.5"
      />
      <div
        role={tone === "success" ? "status" : "alert"}
        className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-8 py-10 text-center"
      >
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl text-[28px] ${config.className}`}
          aria-hidden="true"
        >
          {config.icon}
        </div>
        <h1 className="m-0 text-xl font-semibold text-text">{title}</h1>
        {description ? (
          <p className="m-0 text-sm leading-relaxed text-text-secondary">
            {description}
          </p>
        ) : null}
        {actions ? (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {actions}
          </div>
        ) : null}
        {note ? <p className="m-0 text-xs text-ink-400">{note}</p> : null}
      </div>
    </div>
  );
}
