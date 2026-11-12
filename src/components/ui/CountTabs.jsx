"use client";

/**
 * In-page filter tabs with a count next to each label. Looks like RouteTabs
 * but switches a filter on the current page instead of navigating.
 */
export default function CountTabs({ items, activeKey, onChange, ariaLabel }) {
  if (!Array.isArray(items) || !items.length) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className="-mt-1 mb-5 overflow-x-auto border-b border-line"
    >
      <ul role="tablist" className="m-0 flex min-w-max list-none gap-1 p-0">
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <li key={item.key} role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (!active) onChange?.(item.key);
                }}
                className={`flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap border-0 bg-transparent px-3 text-sm font-medium transition-colors ${
                  active
                    ? "text-text shadow-[inset_0_-2px_0_var(--ej-orange-600)]"
                    : "text-text-secondary hover:text-text"
                }`}
              >
                <span>{item.title}</span>
                {item.count !== undefined && item.count !== null ? (
                  <span
                    className={`min-w-5 rounded-full px-1.5 text-center text-xs leading-5 tabular-nums ${
                      active
                        ? "bg-[var(--ej-orange-600)] text-white"
                        : "bg-subtle text-text-secondary"
                    }`}
                  >
                    {item.count}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
