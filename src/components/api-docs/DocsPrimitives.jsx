"use client";

import { Fragment, useState } from "react";
import { CheckOutlined, CopyOutlined } from "@ant-design/icons";

/** Inline markup used by the content files: `code` and **bold**. */
export function RichText({ text }) {
  const parts = String(text ?? "").split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="ej-mono rounded bg-subtle px-1 py-0.5 text-[0.85em] text-text">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-text">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

const JSON_TOKEN = /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;

function highlightJson(code) {
  const out = [];
  let last = 0;
  for (const match of code.matchAll(JSON_TOKEN)) {
    if (match.index > last) out.push(code.slice(last, match.index));
    const [token, key, string, literal] = match;
    const className = key
      ? "text-[var(--ej-info)]"
      : string
        ? "text-[var(--ej-success)]"
        : literal
          ? "text-[var(--ej-orange-600)]"
          : "text-[var(--ej-warning)]";
    out.push(
      <span key={match.index} className={className}>
        {token}
      </span>,
    );
    last = match.index + token.length;
  }
  out.push(code.slice(last));
  return out;
}

export function CodeBlock({ code, lang, copyLabel = "Copy", copiedLabel = "Copied" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (insecure context); the text stays selectable.
    }
  };
  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-line bg-subtle">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 flex cursor-pointer items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-xs text-text-secondary opacity-0 transition-opacity hover:text-text focus:opacity-100 group-hover:opacity-100"
        aria-label={copyLabel}
      >
        {copied ? <CheckOutlined /> : <CopyOutlined />}
        {copied ? copiedLabel : copyLabel}
      </button>
      <pre className="ej-mono m-0 overflow-x-auto p-4 text-[12.5px] leading-5 text-text">
        <code>{lang === "json" ? highlightJson(code) : code}</code>
      </pre>
    </div>
  );
}

export function DocTable({ head, rows }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="bg-subtle">
          <tr>
            {head.map((cell) => (
              <th key={cell} className="border-b border-line px-3 py-2 font-medium text-text-secondary">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line last:border-b-0 align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 text-text">
                  {typeof cell === "string" ? <RichText text={cell} /> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const METHOD_STYLES = {
  get: "bg-[var(--ej-info-bg)] text-[var(--ej-info)]",
  post: "bg-[var(--ej-success-bg)] text-[var(--ej-success)]",
  patch: "bg-[var(--ej-warning-bg)] text-[var(--ej-warning)]",
  put: "bg-[var(--ej-warning-bg)] text-[var(--ej-warning)]",
  delete: "bg-[var(--ej-danger-bg)] text-[var(--ej-danger)]",
};

export function MethodBadge({ method, small = false }) {
  return (
    <span
      className={`ej-mono inline-flex shrink-0 justify-center rounded font-semibold uppercase ${
        small ? "w-12 px-1 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"
      } ${METHOD_STYLES[method] ?? "bg-subtle text-text"}`}
    >
      {method}
    </span>
  );
}
