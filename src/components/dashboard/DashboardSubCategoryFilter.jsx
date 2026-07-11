"use client";

import { FilterOutlined } from "@ant-design/icons";
import { Select, Space, Typography } from "antd";

const { Text } = Typography;

export default function DashboardSubCategoryFilter({ value, options, onChange, t }) {
  return (
    <Space direction="vertical" size={4} style={{ width: "100%" }}>
      <Text type="secondary"><FilterOutlined /> {t("filters.subCategories")}</Text>
      <Select
        mode="multiple"
        allowClear
        showSearch
        maxTagCount="responsive"
        value={value}
        options={options.map((item) => ({ value: item.id, label: item.name }))}
        optionFilterProp="label"
        placeholder={t("filters.allSubCategories")}
        onChange={onChange}
        style={{ width: "100%", maxWidth: 360 }}
      />
    </Space>
  );
}
