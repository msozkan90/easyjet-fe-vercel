"use client";

import Link from "next/link";

/**
 * Horizontal tabs for sibling routes of the same sidebar group (for example
 * Pending / In production / Completed orders). Each tab is a normal link, so
 * routes, permissions and data loading stay exactly as they are.
 */
export default function RouteTabs({ items, activeKey, ariaLabel }) {
  if (!Array.isArray(items) || items.length < 2) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className="-mt-1 mb-5 overflow-x-auto border-b border-line"
    >
      <ul className="m-0 flex min-w-max list-none gap-1 p-0">
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center whitespace-nowrap px-3 text-sm font-medium no-underline transition-colors ${
                  active
                    ? "text-text! shadow-[inset_0_-2px_0_var(--ej-orange-600)]"
                    : "text-text-secondary! hover:text-text!"
                }`}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
