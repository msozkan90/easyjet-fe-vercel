"use client";

import { Card, Statistic, theme } from "antd";

export default function DashboardSummaryCard({ title, value, color, icon, suffix, precision = 0 }) {
  const { token } = theme.useToken();
  return (
    <Card bordered={false} style={{ height: "100%", boxShadow: token.boxShadowTertiary }}>
      <Statistic
        title={title}
        value={value}
        precision={precision}
        suffix={suffix}
        prefix={icon}
        valueStyle={{ color }}
      />
    </Card>
  );
}
