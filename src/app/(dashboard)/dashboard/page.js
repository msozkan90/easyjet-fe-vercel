"use client";

import { Typography } from "antd";
import { useSelector } from "react-redux";
import { useTranslations } from "@/i18n/use-translations";
import { resolveDashboard } from "@/components/dashboard/dashboardRegistry";

const { Title } = Typography;

export default function DashboardHome() {
  const t = useTranslations("dashboard.overview");
  const user = useSelector((state) => state.auth.user);
  const dashboard = resolveDashboard(user);

  if (dashboard) {
    const DashboardComponent = dashboard.Component;
    return <DashboardComponent />;
  }

  const entityName = String(user?.entity?.entity_name || "").trim();
  const userName =
    String(user?.displayName || "").trim() ||
    [user?.first_name, user?.last_name]
      .filter(Boolean)
      .map((part) => String(part).trim())
      .filter(Boolean)
      .join(" ") ||
    String(user?.email || "").trim();

  return <Title level={2}>{entityName || userName || t("fallbackTitle")}</Title>;
}
