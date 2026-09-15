"use client";

import { Divider, Space, Typography } from "antd";
import NormalProductionUrgencyDashboard from "./NormalProductionUrgencyDashboard";
import CompanyShipmentWorkerTransferDashboard from "./worker/CompanyShipmentWorkerTransferDashboard";
import { useTranslations } from "@/i18n/use-translations";

const { Title } = Typography;

export default function CompanyShipmentWorkerOperationsDashboard() {
  const t = useTranslations("dashboard.overview.urgency");
  return (
    <Space direction="vertical" size={32} style={{ width: "100%" }}>
      <NormalProductionUrgencyDashboard />
      <Divider />
      <Title level={3} style={{ margin: 0 }}>{t("transferShipmentSection")}</Title>
      <CompanyShipmentWorkerTransferDashboard />
    </Space>
  );
}
