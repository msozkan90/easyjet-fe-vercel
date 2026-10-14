"use client";

import { useSelector } from "react-redux";
import PageHeader from "@/components/ui/PageHeader";
import RouteTabs from "@/components/layout/RouteTabs";

// Sidebar groups whose items are steps of the same order list; their routes
// are shown as tabs under the page title.
const TABBED_GROUPS = new Set([
  "order",
  "transfer-orders",
  "orders-affiliated",
  "transfer-orders-affiliated",
]);

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

  // A parent group that repeats the page title adds nothing to the trail.
  const trail = activeNav.trail.filter((title) => title !== activeNav.title);
  const breadcrumb = trail.length
    ? [...trail.map((title) => ({ title })), { title: activeNav.title }]
    : undefined;
  const showTabs = TABBED_GROUPS.has(activeNav.parentKey);

  return (
    <>
      <PageHeader
        title={activeNav.title}
        breadcrumb={breadcrumb}
        replacesRouteHeader={false}
      />
      {showTabs ? (
        <RouteTabs
          items={activeNav.siblings}
          activeKey={activeNav.selectedKey}
          ariaLabel={trail[trail.length - 1] || activeNav.title}
        />
      ) : null}
    </>
  );
}
