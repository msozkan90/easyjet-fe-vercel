"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App as AntdApp, Drawer, Switch } from "antd";
import { EditOutlined, KeyOutlined } from "@ant-design/icons";
import CrudTable from "@/components/common/table/CrudTable";
import ApiKeyTable from "@/components/settings/api-keys/ApiKeyTable";
import RowActions from "@/components/ui/RowActions";
import StatusTag from "@/components/ui/StatusTag";
import { useTranslations } from "@/i18n/use-translations";
import { ApiKeysAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import ApiAccessGrantModal from "./ApiAccessGrantModal";

const accessState = (grant) => {
  if (!grant?.enabled) return "disabled";
  return grant.live_enabled ? "live" : "test";
};
const ACCESS_TONES = { disabled: "neutral", test: "waiting", live: "success" };

function CustomerKeysDrawer({ customer, onClose, onChanged }) {
  const t = useTranslations("dashboard.apiAccess");
  const { message } = AntdApp.useApp();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!customer) return;
    setLoading(true);
    try {
      const resp = await ApiKeysAPI.adminCustomerKeys(customer.id);
      setKeys(Array.isArray(resp?.data) ? resp.data : []);
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("messages.keysLoadError"));
    } finally {
      setLoading(false);
    }
  }, [customer, message, t]);

  useEffect(() => {
    setKeys([]);
    load();
  }, [load]);

  const revoke = async (key) => {
    try {
      await ApiKeysAPI.adminRevoke(key.id, "Revoked by EasyJet");
      message.success(t("messages.revokeSuccess"));
      load();
      onChanged?.();
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("messages.revokeError"));
    }
  };

  return (
    <Drawer
      open={Boolean(customer)}
      onClose={onClose}
      title={t("drawer.title", { name: customer?.name ?? "" })}
      width="min(1100px, 100vw)"
      destroyOnHidden
    >
      <ApiKeyTable keys={keys} loading={loading} onRevoke={revoke} emptyText={t("drawer.empty")} />
    </Drawer>
  );
}

export default function ApiAccessAdminPage() {
  const t = useTranslations("dashboard.apiAccess");
  const tableRef = useRef(null);
  const [onlyGranted, setOnlyGranted] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewingKeys, setViewingKeys] = useState(null);

  const request = useCallback(
    async ({ page, pageSize, filters }) => {
      const resp = await ApiKeysAPI.adminListGrants({
        page,
        page_size: pageSize,
        search: filters?.name?.trim() || undefined,
        only_granted: filters?.only_granted || undefined,
      });
      return normalizeListAndMeta(resp);
    },
    [],
  );

  const columns = useMemo(
    () => [
      {
        title: t("columns.customer"),
        dataIndex: "name",
        filter: { type: "text", placeholder: t("filters.searchCustomer") },
        render: (name, row) => (
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-text">{name}</span>
            <span className="text-xs text-text-secondary">
              {row.partner?.name ?? row.company?.name ?? "-"}
            </span>
          </span>
        ),
      },
      {
        title: t("columns.access"),
        key: "access",
        render: (_, row) => {
          const state = accessState(row.grant);
          return (
            <StatusTag tone={ACCESS_TONES[state]} size="small">
              {t(`access.${state}`)}
            </StatusTag>
          );
        },
      },
      {
        title: t("columns.tier"),
        key: "tier",
        render: (_, row) =>
          row.grant ? t(`tiers.${row.grant.rate_limit_tier}`) : <span className="text-text-secondary">-</span>,
      },
      {
        title: t("columns.keys"),
        key: "keys",
        render: (_, row) => (
          <span className="tabular-nums">
            {row.active_keys}
            {row.grant ? ` / ${row.grant.max_keys}` : ""}
          </span>
        ),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        width: 96,
        render: (_, row) => (
          <RowActions
            actions={[
              {
                key: "edit",
                iconOnly: true,
                icon: <EditOutlined />,
                label: t("actions.edit"),
                onClick: () => setEditing(row),
              },
              {
                key: "keys",
                iconOnly: true,
                icon: <KeyOutlined />,
                label: t("actions.viewKeys"),
                onClick: () => setViewingKeys(row),
              },
            ]}
          />
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <CrudTable
        ref={tableRef}
        rowKey="id"
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{ name: "", only_granted: false }}
        toolbarLeft={
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
            <Switch
              size="small"
              checked={onlyGranted}
              onChange={(checked) => {
                setOnlyGranted(checked);
                tableRef.current?.setFilters({ only_granted: checked });
              }}
            />
            {t("filters.onlyGranted")}
          </label>
        }
        tableProps={{ locale: { emptyText: t("table.noData") } }}
      />
      <ApiAccessGrantModal
        customer={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          tableRef.current?.reload();
        }}
      />
      <CustomerKeysDrawer
        customer={viewingKeys}
        onClose={() => setViewingKeys(null)}
        onChanged={() => tableRef.current?.reload()}
      />
    </>
  );
}
