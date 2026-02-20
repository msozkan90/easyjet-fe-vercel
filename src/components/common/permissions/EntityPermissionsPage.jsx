"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Spin,
} from "antd";
import { EditOutlined } from "@ant-design/icons";
import CrudTable from "@/components/common/table/CrudTable";
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

  const columns = useMemo(
    () => [
      { title: t("columns.id"), dataIndex: "id", width: 160 },
      {
        title: t("columns.name"),
        dataIndex: "name",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.searchName") },
      },
      {
        title: t("columns.permissions"),
        dataIndex: "permissions",
        render: (items) => {
          const list = Array.isArray(items) ? items : [];
          if (!list.length) return t("common.none");
          return (
            <Space wrap>
              {list.map((perm) => (
                <Tag
                  key={perm.permission_id || perm.key}
                  color={perm.value_bool ? "green" : "red"}
                >
                  {perm.key}
                </Tag>
              ))}
            </Space>
          );
        },
      },
      {
        title: t("columns.actions"),
        key: "actions",
        width: 160,
        render: (_, record) => (
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setActiveEntity(record);
              setOpen(true);
            }}
          >
            {t("actions.edit")}
          </Button>
        ),
      },
    ],
    [t]
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

  const permissionColumns = useMemo(
    () => [
      {
        title: t("modal.columns.permission"),
        dataIndex: "key",
        width: 280,
      },
      {
        title: t("modal.columns.value"),
        key: "value",
        width: 140,
        render: (_, record) => (
          <Switch
            checked={!!record.value_bool}
            disabled={record.is_locked}
            onChange={(checked) => updatePermissionValue(record, checked)}
          />
        ),
      },
      {
        title: t("modal.columns.flags"),
        key: "flags",
        render: (_, record) => (
          <Space wrap>
            {record.inherited_bool ? (
              <Tag color="blue">{t("labels.inherited")}</Tag>
            ) : null}
            {record.is_overridden ? (
              <Tag color="gold">{t("labels.overridden")}</Tag>
            ) : null}
            {record.is_locked ? (
              <Tag color="red">{t("labels.locked")}</Tag>
            ) : null}
          </Space>
        ),
      },
    ],
    [t, updatePermissionValue]
  );

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
        width={760}
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Spin />
          </div>
        ) : (
          <Table
            dataSource={permissions}
            columns={permissionColumns}
            rowKey={(row) => row.permission_id || row.key}
            pagination={false}
            size="small"
            locale={{ emptyText: t("table.noData") }}
          />
        )}
      </Modal>
    </>
  );
}
