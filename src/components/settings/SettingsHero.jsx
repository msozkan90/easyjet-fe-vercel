"use client";

import { Card, Typography, Skeleton, Space, Divider } from "antd";
import { SettingOutlined } from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

export default function SettingsHero({ title, subtitle, user, roles, isLoading }) {
  return (
    <Card className="shadow-sm !bg-gradient-to-r !from-slate-900 !to-slate-700 text-white overflow-hidden">
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <Title level={3} className="!text-white mb-1 flex items-center gap-2">
              <SettingOutlined />
              <span>{title}</span>
            </Title>
            <Paragraph className="!text-white/80 mb-0">{subtitle}</Paragraph>
          </div>

          <Divider className="!my-2 !border-white/20" />

          <Space direction="vertical" size={4} className="text-white/90">
            <Text className="!text-white text-lg font-semibold">
              {user
                ? `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                  user.displayName ||
                  user.email
                : "-"}
            </Text>
            <Space size={[8, 8]} wrap>
              {roles.map((role) => (
                <span
                  key={role}
                  className="px-3 py-1 rounded-full bg-white/20 text-xs uppercase tracking-wide"
                >
                  {role}
                </span>
              ))}
            </Space>
          </Space>
        </div>
      )}
    </Card>
  );
}
