"use client";

import { Button } from "antd";
import {
  InboxOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useTranslations } from "@/i18n/use-translations";

function StateFrame({ icon, iconClass, title, description, action, compact }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-center ${
        compact ? "px-4 py-8" : "px-6 py-14"
      }`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${iconClass}`}
        aria-hidden="true"
      >
        {icon}
      </div>
      {title ? (
        <div className="text-[15px] font-semibold text-text">{title}</div>
      ) : null}
      {description ? (
        <div className="max-w-sm text-[13px] text-text-secondary">
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action, icon, compact }) {
  const t = useTranslations("common.states");
  return (
    <StateFrame
      icon={icon || <InboxOutlined />}
      iconClass="bg-brand-50 text-brand-600"
      title={title ?? t("emptyTitle")}
      description={description}
      action={action}
      compact={compact}
    />
  );
}

export function ErrorState({ title, description, onRetry, compact }) {
  const t = useTranslations("common.states");
  const tActions = useTranslations("common.actions");
  return (
    <div role="alert">
      <StateFrame
        icon={<WarningOutlined />}
        iconClass="bg-danger-bg text-danger"
        title={title ?? t("errorTitle")}
        description={description ?? t("errorDescription")}
        compact={compact}
        action={
          onRetry ? (
            <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
              {tActions("retry")}
            </Button>
          ) : null
        }
      />
    </div>
  );
}
