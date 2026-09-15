"use client";

import { Divider, Space, Typography } from "antd";
import NormalProductionUrgencyDashboard from "./NormalProductionUrgencyDashboard";
import CompanyCompletedWorkerTransferDashboard from "./worker/CompanyCompletedWorkerTransferDashboard";
import { useTranslations } from "@/i18n/use-translations";

const { Title } = Typography;

export default function CompanyCompletedWorkerOperationsDashboard() {
  const t = useTranslations("dashboard.overview.urgency");
  return (
    <Space direction="vertical" size={32} style={{ width: "100%" }}>
      <NormalProductionUrgencyDashboard />
      <Divider />
      <Title level={3} style={{ margin: 0 }}>{t("transferSection")}</Title>
      <CompanyCompletedWorkerTransferDashboard />
    </Space>
  );
}
