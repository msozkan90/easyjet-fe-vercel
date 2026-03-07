"use client";

import { useMemo } from "react";
import { Card, Switch, Table, Tag, Typography } from "antd";
import { translateOrFallback } from "@/components/settings/settings.helpers";

const { Text } = Typography;

export default function NotificationSettingsTable({ rows, onToggle, tSettings }) {
  const title = translateOrFallback(
    tSettings,
    "notification.title",
    "Notification Settings"
  );
  const subtitle = translateOrFallback(
    tSettings,
    "notification.subtitle",
    "Control who gets notified and through which channel."
  );

  const columns = useMemo(
    () => [
      {
        title: translateOrFallback(tSettings, "notification.table.event", "Event"),
        dataIndex: "event",
        key: "event",
      },
      {
        title: translateOrFallback(
          tSettings,
          "notification.table.channel",
          "Channel"
        ),
        dataIndex: "channel",
        key: "channel",
        render: (value) => <Tag color="geekblue">{value}</Tag>,
      },
      {
        title: translateOrFallback(tSettings, "notification.table.owner", "Owner"),
        dataIndex: "owner",
        key: "owner",
      },
      {
        title: translateOrFallback(
          tSettings,
          "notification.table.enabled",
          "Enabled"
        ),
        dataIndex: "enabled",
        key: "enabled",
        width: 130,
        render: (value, row) => (
          <Switch checked={value} onChange={(checked) => onToggle(row.key, checked)} />
        ),
      },
    ],
    [onToggle, tSettings]
  );

  return (
    <Card
      title={title}
      extra={<Text type="secondary">{subtitle}</Text>}
      className="shadow-sm"
    >
      <Table
        rowKey="key"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 640 }}
      />
    </Card>
  );
}
