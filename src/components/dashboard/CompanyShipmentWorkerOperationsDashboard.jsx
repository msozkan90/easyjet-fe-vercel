"use client";

import { Divider, Space } from "antd";
import NormalProductionUrgencyDashboard from "./NormalProductionUrgencyDashboard";
import CompanyShipmentWorkerTransferDashboard from "./worker/CompanyShipmentWorkerTransferDashboard";
import { useTranslations } from "@/i18n/use-translations";

export default function CompanyShipmentWorkerOperationsDashboard() {
  const t = useTranslations("dashboard.overview.urgency");
  return (
    <Space direction="vertical" size={32} style={{ width: "100%" }}>
      <NormalProductionUrgencyDashboard />
      <Divider />
      <h2 className="m-0 text-xl font-semibold">{t("transferShipmentSection")}</h2>
      <CompanyShipmentWorkerTransferDashboard />
    </Space>
  );
}
