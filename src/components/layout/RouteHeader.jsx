"use client";

import { useSelector } from "react-redux";
import PageHeader from "@/components/ui/PageHeader";

/**
 * Default page heading for dashboard routes, derived from the active sidebar
 * entry. Hidden when the page renders its own PageHeader.
 */
export default function RouteHeader() {
  const activeNav = useSelector((s) => s.ui.activeNav);
  const customHeaderCount = useSelector((s) => s.ui.customHeaderCount);

  if (customHeaderCount > 0 || !activeNav?.exact || !activeNav?.title) {
    return null;
  }

  const breadcrumb = activeNav.trail.length
    ? [
        ...activeNav.trail.map((title) => ({ title })),
        { title: activeNav.title },
      ]
    : undefined;

  return (
    <PageHeader
      title={activeNav.title}
      breadcrumb={breadcrumb}
      replacesRouteHeader={false}
    />
  );
}
