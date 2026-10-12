"use client";

import { Skeleton } from "antd";
import PageHeader from "@/components/ui/PageHeader";
import StatusTag from "@/components/ui/StatusTag";

export default function SettingsHero({ title, subtitle, user, roles, isLoading }) {
  const userName = user
    ? `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
      user.displayName ||
      user.email
    : "-";

  return (
    <PageHeader
      className="mb-4"
      title={title}
      description={subtitle}
      extra={
        isLoading ? (
          <Skeleton.Input active size="small" style={{ width: 200 }} />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-text">{userName}</span>
            {roles.map((role) => (
              <StatusTag key={role} tone="neutral">
                {role}
              </StatusTag>
            ))}
          </div>
        )
      }
    />
  );
}
