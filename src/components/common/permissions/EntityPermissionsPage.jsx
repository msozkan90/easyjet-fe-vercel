"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App as AntdApp, Empty, Modal, Switch, Spin } from "antd";
import { EditOutlined, LockOutlined } from "@ant-design/icons";
import CrudTable from "@/components/common/table/CrudTable";
import RowActions from "@/components/ui/RowActions";
import StatusTag from "@/components/ui/StatusTag";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";

const normalizePermissions = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.permissions)) return payload.permissions;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.permissions)) return payload.data.permissions;
  return [];
};

// "CAN_USE_SS_SHIPMENT" -> "Use ss shipment" when no translation exists.
const humanizeKey = (key) => {
  const words = String(key || "")
    .replace(/^CAN_/, "")
    .split(/[_.\s]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  if (!words.length) return String(key || "");
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
};

const buildUpdatePayload = (permissions) => ({
  permissions: (permissions || [])
    .filter((perm) => perm.key)
    .map((perm) => ({
      key: perm.key,
      value_bool: !!perm.value_bool,
    })),
});

export default function EntityPermissionsPage({
  listApi,
  getPermissionsApi,
  updatePermissionsApi,
  translationKey,
}) {
  const { message } = AntdApp.useApp();
  const t = useTranslations(translationKey);
  const tPerm = useTranslations("common.entityPermissions");
  const tableRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeEntity, setActiveEntity] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const request = useMemo(
    () =>
      makeListRequest(
        listApi,
        {
          defaultSort: [{ field: "name", direction: "asc" }],
          filterMap: {},
        },
        normalizeListAndMeta
      ),
    [listApi]
  );

  const permissionLabel = useCallback(
    (key) => {
      const translated = tPerm(`keys.${key}`);
      return translated === `common.entityPermissions.keys.${key}`
        ? humanizeKey(key)
        : translated;
    },
    [tPerm],
  );

  const columns = useMemo(
    () => [
      {
        title: t("columns.name"),
        dataIndex: "name",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.searchName") },
        render: (value) => (
          <span className="font-medium text-text">{value || "-"}</span>
        ),
      },
      {
        title: t("columns.permissions"),
        dataIndex: "permissions",
        render: (items) => {
          const list = Array.isArray(items) ? items : [];
          if (!list.length) return t("common.none");
          const enabled = list.filter((perm) => perm.value_bool).length;
          // Enabled permissions first so the meaningful ones lead the row.
          const sorted = [...list].sort(
            (a, b) => Number(!!b.value_bool) - Number(!!a.value_bool),
          );
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="ej-mono mr-1 text-xs text-text-secondary">
                {tPerm("enabledCount", { enabled, total: list.length })}
              </span>
              {sorted.map((perm) => (
                <StatusTag
                  key={perm.permission_id || perm.key}
                  tone={perm.value_bool ? "success" : "neutral"}
                  size="small"
                  title={`${perm.key}: ${perm.value_bool ? tPerm("on") : tPerm("off")}`}
                  className={perm.value_bool ? "" : "opacity-70"}
                >
                  {permissionLabel(perm.key)}
                </StatusTag>
              ))}
            </div>
          );
        },
      },
      {
        title: t("columns.actions"),
        key: "actions",
        width: 72,
        render: (_, record) => (
          <RowActions
            actions={[
              {
                key: "edit",
                iconOnly: true,
                icon: <EditOutlined />,
                label: t("actions.edit"),
                onClick: () => {
                  setActiveEntity(record);
                  setOpen(true);
                },
              },
            ]}
          />
        ),
      },
    ],
    [permissionLabel, t, tPerm],
  );

  const updatePermissionValue = useCallback((record, checked) => {
    setPermissions((prev) =>
      prev.map((perm) => {
        const match =
          perm.permission_id === record.permission_id ||
          perm.key === record.key;
        if (!match) return perm;
        return { ...perm, value_bool: checked };
      })
    );
  }, []);

  useEffect(() => {
    if (!open || !activeEntity?.id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const resp = await getPermissionsApi(activeEntity.id);
        if (!alive) return;
        const payload = resp?.data ?? resp;
        setPermissions(normalizePermissions(payload));
      } catch (error) {
        if (alive) {
          message.error(
            error?.response?.data?.error?.message || t("messages.loadError")
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeEntity, getPermissionsApi, message, open, t]);

  const closeModal = () => {
    setOpen(false);
    setActiveEntity(null);
    setPermissions([]);
  };

  const handleUpdate = async () => {
    if (!activeEntity?.id) return;
    setSaving(true);
    try {
      await updatePermissionsApi(
        activeEntity.id,
        buildUpdatePayload(permissions)
      );
      message.success(t("messages.updateSuccess"));
      closeModal();
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.updateError")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{ name: "" }}
        tableProps={{ locale: { emptyText: t("table.noData") } }}
      />

      <Modal
        title={t("modal.title", { name: activeEntity?.name || "" })}
        open={open}
        onCancel={closeModal}
        onOk={handleUpdate}
        okText={t("actions.update")}
        confirmLoading={saving}
        destroyOnHidden
        width={640}
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Spin />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-[13px] text-text-secondary">
              {tPerm("modalDescription")}
            </p>
            {permissions.length ? (
              <ul className="m-0 list-none divide-y divide-[var(--ej-border)] rounded-xl border border-line p-0">
                {permissions.map((perm) => {
                  const label = permissionLabel(perm.key);
                  return (
                    <li
                      key={perm.permission_id || perm.key}
                      className="flex items-center gap-4 px-4 py-3"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-sm font-medium text-text">
                          {label}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="ej-mono truncate text-xs text-text-secondary">
                            {perm.key}
                          </span>
                          <StatusTag tone="neutral" size="small">
                            {tPerm("defaultValue", {
                              value: perm.inherited_bool
                                ? tPerm("on")
                                : tPerm("off"),
                            })}
                          </StatusTag>
                          {perm.is_overridden ? (
                            <StatusTag tone="waiting" size="small">
                              {t("labels.overridden")}
                            </StatusTag>
                          ) : null}
                          {perm.is_locked ? (
                            <StatusTag tone="danger" size="small">
                              <LockOutlined /> {t("labels.locked")}
                            </StatusTag>
                          ) : null}
                        </div>
                      </div>
                      <Switch
                        checked={!!perm.value_bool}
                        disabled={perm.is_locked}
                        onChange={(checked) =>
                          updatePermissionValue(perm, checked)
                        }
                        aria-label={label}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={tPerm("empty")}
              />
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
