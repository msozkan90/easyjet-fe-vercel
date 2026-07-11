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

  return <Title level={2}>{t("title")}</Title>;
}
