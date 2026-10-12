"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { RightOutlined } from "@ant-design/icons";
import {
  registerCustomHeader,
  unregisterCustomHeader,
} from "@/redux/features/uiSlice";

/**
 * Standard page heading: optional breadcrumb, title, one-line description and
 * right-aligned actions. Every dashboard route should start with it.
 */
export default function PageHeader({
  title,
  description,
  breadcrumb,
  extra,
  meta,
  className = "mb-5",
  // Route-level headers set this to false; page-owned headers hide the
  // automatic header rendered by the dashboard layout.
  replacesRouteHeader = true,
}) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!replacesRouteHeader) return undefined;
    dispatch(registerCustomHeader());
    return () => {
      dispatch(unregisterCustomHeader());
    };
  }, [dispatch, replacesRouteHeader]);

  const crumbs = Array.isArray(breadcrumb) ? breadcrumb.filter(Boolean) : [];
  return (
    <header className={`flex flex-col gap-3 ${className}`.trim()}>
      {crumbs.length ? (
        <nav aria-label="Breadcrumb">
          <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-[13px] text-text-secondary">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <li
                  key={`${crumb.title}-${index}`}
                  className="flex items-center gap-1.5"
                >
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="text-text-secondary no-underline hover:text-text"
                    >
                      {crumb.title}
                    </Link>
                  ) : (
                    <span
                      className={isLast ? "text-text" : undefined}
                      aria-current={isLast ? "page" : undefined}
                    >
                      {crumb.title}
                    </span>
                  )}
                  {!isLast ? (
                    <RightOutlined
                      className="text-[10px] text-ink-300"
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-2xl font-semibold leading-8 tracking-tight text-text">
              {title}
            </h1>
            {meta}
          </div>
          {description ? (
            <p className="m-0 text-sm text-text-secondary">{description}</p>
          ) : null}
        </div>
        {extra ? (
          <div className="flex flex-wrap items-center gap-2">{extra}</div>
        ) : null}
      </div>
    </header>
  );
}
