"use client";

import { CalendarOutlined } from "@ant-design/icons";
import { DatePicker, Space, Typography } from "antd";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;
const { Text } = Typography;

export default function DashboardDateFilter({ value, onChange, t }) {
  const presets = [
    { label: t("filters.today"), value: [dayjs().startOf("day"), dayjs().endOf("day")] },
    { label: t("filters.last7Days"), value: [dayjs().subtract(6, "day").startOf("day"), dayjs().endOf("day")] },
    { label: t("filters.last30Days"), value: [dayjs().subtract(29, "day").startOf("day"), dayjs().endOf("day")] },
    { label: t("filters.thisMonth"), value: [dayjs().startOf("month"), dayjs().endOf("month")] },
  ];

  return (
    <Space direction="vertical" size={4} style={{ width: "100%" }}>
      <Text type="secondary"><CalendarOutlined /> {t("filters.dateRange")}</Text>
      <RangePicker
        allowClear={false}
        value={value}
        presets={presets}
        onChange={(dates) => dates?.[0] && dates?.[1] && onChange(dates)}
        style={{ width: "100%", maxWidth: 360 }}
      />
    </Space>
  );
}
