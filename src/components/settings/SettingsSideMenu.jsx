"use client";

import { Card, Menu } from "antd";
import { ApiOutlined, BellOutlined } from "@ant-design/icons";
import { SETTINGS_SECTIONS } from "@/components/settings/settings.constants";
import { translateOrFallback } from "@/components/settings/settings.helpers";

export default function SettingsSideMenu({ activeKey, onChange, tSettings }) {
  const title = translateOrFallback(tSettings, "sidebar.title", "Settings Menu");

  const items = [
    {
      key: SETTINGS_SECTIONS.API_CONF,
      icon: <ApiOutlined />,
      label: translateOrFallback(tSettings, "sidebar.items.apiConf", "Api Conf"),
    },
    {
      key: SETTINGS_SECTIONS.NOTIFICATION,
      icon: <BellOutlined />,
      label: translateOrFallback(
        tSettings,
        "sidebar.items.notification",
        "Notification"
      ),
    },
  ];

  return (
    <Card title={title} className="shadow-sm">
      <Menu
        selectedKeys={[activeKey]}
        mode="inline"
        items={items}
        onClick={({ key }) => onChange?.(key)}
      />
    </Card>
  );
}
