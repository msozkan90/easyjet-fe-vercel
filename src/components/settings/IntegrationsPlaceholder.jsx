"use client";

import { Card, Space, Typography } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import { translateOrFallback } from "@/components/settings/settings.helpers";

const { Title, Paragraph } = Typography;

export default function IntegrationsPlaceholder({ tSettings }) {
  const title = translateOrFallback(
    tSettings,
    "integrations.restrictedTitle",
    "ShipStation is managed by your company"
  );
  const description = translateOrFallback(
    tSettings,
    "integrations.restrictedDescription",
    "Contact your EasyJet administrator to request access."
  );

  return (
    <Card className="shadow-sm text-center py-16">
      <Space direction="vertical">
        <SafetyCertificateOutlined style={{ fontSize: 36, color: "#8c8c8c" }} />
        <Title level={4}>{title}</Title>
        <Paragraph type="secondary" className="mb-0">
          {description}
        </Paragraph>
      </Space>
    </Card>
  );
}
