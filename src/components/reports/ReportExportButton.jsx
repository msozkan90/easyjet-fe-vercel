"use client";

import { Button, Dropdown } from "antd";
import { DownloadOutlined } from "@ant-design/icons";

export default function ReportExportButton({ onExport, loading, disabled, label }) {
  return <Dropdown menu={{ items: [
    { key: "csv", label: "CSV" },
    { key: "xlsx", label: "XLSX" },
  ], onClick: ({ key }) => onExport(key) }} trigger={["click"]} disabled={disabled || loading}>
    <Button icon={<DownloadOutlined />} loading={loading} disabled={disabled}>{label}</Button>
  </Dropdown>;
}
