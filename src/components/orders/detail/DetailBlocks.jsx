"use client";

// Building blocks shared by the order and transfer order detail pages.

export const InfoField = ({ label, value, className, valueClassName }) => (
  <div className={`flex min-w-0 flex-col gap-0.5 ${className || ""}`}>
    <span className="text-xs text-text-secondary">{label}</span>
    <span
      className={`break-words text-[13px] font-medium text-text ${valueClassName || ""}`}
    >
      {value}
    </span>
  </div>
);

export const SectionHeader = ({ title, subtitle, count, extra }) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <h2 className="m-0 text-base font-semibold text-text">{title}</h2>
        {typeof count === "number" ? (
          <span className="ej-mono rounded-full bg-muted px-2 text-xs leading-5 text-text-secondary">
            {count}
          </span>
        ) : null}
      </div>
      {subtitle ? (
        <span className="text-xs text-text-secondary">{subtitle}</span>
      ) : null}
    </div>
    {extra}
  </div>
);

export const SectionEmpty = ({ children }) => (
  <div className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-text-secondary">
    {children}
  </div>
);

// Compact titled panel used in the overview side column.
export const SideCard = ({ title, children }) => (
  <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
    <h2 className="m-0 text-[15px] font-semibold text-text">{title}</h2>
    {children}
  </section>
);

export const KeyValueList = ({ rows }) => (
  <dl className="m-0 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2">
    {rows
      .filter(Boolean)
      .map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-xs leading-5 text-text-secondary">{row.label}</dt>
          <dd className="m-0 min-w-0 break-words text-[13px] font-medium leading-5 text-text">
            {row.value}
          </dd>
        </div>
      ))}
  </dl>
);

// Postal-style address block; `prefix` is "ship_to" or "bill_to".
export const AddressCard = ({ title, order, prefix, emptyText }) => {
  const field = (name) => String(order?.[`${prefix}_${name}`] || "").trim();
  const cityLine = [
    field("city"),
    [field("state"), field("postal_code")].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const lines = [
    field("company"),
    field("street1"),
    field("street2"),
    cityLine,
    field("country"),
  ].filter(Boolean);
  const name = field("name");

  return (
    <SideCard title={title}>
      {name || lines.length ? (
        <address className="flex flex-col gap-0.5 text-[13px] not-italic leading-5 text-text">
          {name ? <span className="font-semibold">{name}</span> : null}
          {lines.map((line, index) => (
            <span key={`${line}-${index}`} className="text-text-secondary">
              {line}
            </span>
          ))}
        </address>
      ) : (
        <span className="text-[13px] text-text-secondary">{emptyText}</span>
      )}
    </SideCard>
  );
};
