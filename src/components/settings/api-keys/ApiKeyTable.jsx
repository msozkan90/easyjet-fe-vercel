"use client";

import { useMemo } from "react";
import { Table, Tooltip } from "antd";
import { StopOutlined, SyncOutlined } from "@ant-design/icons";
import RowActions from "@/components/ui/RowActions";
import StatusTag from "@/components/ui/StatusTag";
import { DateTimeCell } from "@/components/ui/TableCells";
import { useTranslations } from "@/i18n/use-translations";

const STATUS_TONES = { active: "success", expired: "neutral", revoked: "danger" };
const ENVIRONMENT_TONES = { test: "waiting", live: "info" };

/** API keys of one customer. Rotate/revoke actions appear when handlers are given. */
export default function ApiKeyTable({ keys, loading, onRotate, onRevoke, emptyText }) {
  const t = useTranslations("dashboard.settings.apiKeys");

  const columns = useMemo(
    () => [
      {
        title: t("fields.name"),
        dataIndex: "name",
        render: (name, key) => (
          <span className="flex flex-col gap-1">
            <span className="font-medium text-text">{name}</span>
            <span className="ej-mono text-xs text-text-secondary">{key.masked_key}</span>
          </span>
        ),
      },
      {
        title: t("fields.environment"),
        dataIndex: "environment",
        render: (environment) => (
          <StatusTag tone={ENVIRONMENT_TONES[environment]} size="small">
            {t(`environment.${environment}`)}
          </StatusTag>
        ),
      },
      {
        title: t("fields.scopes"),
        dataIndex: "scopes",
        render: (scopes = []) => (
          <span className="flex max-w-[280px] flex-wrap gap-1">
            {scopes.map((scope) => (
              <Tooltip key={scope} title={t(`scopes.${scope}`)}>
                <span className="ej-mono rounded border border-line px-1.5 text-[11px] leading-5 text-text-secondary">
                  {scope}
                </span>
              </Tooltip>
            ))}
          </span>
        ),
      },
      {
        title: t("fields.status"),
        dataIndex: "status",
        render: (status, key) => (
          <Tooltip title={status === "revoked" ? key.revoked_reason : null}>
            <span>
              <StatusTag tone={STATUS_TONES[status]} size="small">
                {t(`status.${status}`)}
              </StatusTag>
            </span>
          </Tooltip>
        ),
      },
      {
        title: t("fields.lastUsedAt"),
        dataIndex: "last_used_at",
        render: (value) => <DateTimeCell value={value} empty={t("never")} />,
      },
      {
        title: t("fields.expiresAt"),
        dataIndex: "expires_at",
        render: (value) => <DateTimeCell value={value} empty={t("noExpiry")} />,
      },
      {
        title: t("fields.createdAt"),
        dataIndex: "created_at",
        render: (value, key) => (
          <span className="flex flex-col gap-0.5">
            <DateTimeCell value={value} />
            {key.created_by?.name ? (
              <span className="text-xs text-text-secondary">{key.created_by.name}</span>
            ) : null}
          </span>
        ),
      },
      ...(onRotate || onRevoke
        ? [
            {
              title: t("fields.actions"),
              key: "actions",
              width: 96,
              render: (_, key) =>
                key.status === "active" ? (
                  <RowActions
                    actions={[
                      onRotate && {
                        key: "rotate",
                        iconOnly: true,
                        icon: <SyncOutlined />,
                        label: t("actions.rotate"),
                        onClick: () => onRotate(key),
                        confirm: {
                          title: t("confirm.rotateTitle"),
                          description: t("confirm.rotateDescription"),
                          okText: t("actions.rotate"),
                        },
                      },
                      onRevoke && {
                        key: "revoke",
                        iconOnly: true,
                        danger: true,
                        icon: <StopOutlined />,
                        label: t("actions.revoke"),
                        onClick: () => onRevoke(key),
                        confirm: {
                          title: t("confirm.revokeTitle"),
                          description: t("confirm.revokeDescription"),
                          okText: t("actions.revoke"),
                        },
                      },
                    ]}
                  />
                ) : null,
            },
          ]
        : []),
    ],
    [onRevoke, onRotate, t],
  );

  return (
    <Table
      rowKey="id"
      size="middle"
      columns={columns}
      dataSource={keys}
      loading={loading}
      pagination={false}
      scroll={{ x: true }}
      locale={{ emptyText: emptyText ?? t("empty") }}
    />
  );
}
