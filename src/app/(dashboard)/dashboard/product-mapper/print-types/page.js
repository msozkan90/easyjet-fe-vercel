"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  Alert,
  App as AntdApp,
  Button,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import ProductPrintTypeMapperForm from "@/components/common/forms/ProductPrintTypeMapperForm";
import { PrintTypeMappersAPI } from "@/utils/api";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";
import StatusTag from "@/components/ui/StatusTag";
import { useDirtyGuard } from "@/hooks/useDirtyGuard";

const normalizeMapperNames = (value) =>
  Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];

const renderMapperNames = (value) => {
  const names = normalizeMapperNames(value);
  if (!names.length) return null;
  return (
    <Space size={[4, 4]} wrap>
      {names.map((name) => (
        <Tag key={name}>{name}</Tag>
      ))}
    </Space>
  );
};

const formatSubCategory = (subCategory) =>
  subCategory
    ? [subCategory?.category?.name, subCategory?.name].filter(Boolean).join(" / ")
    : "";

export default function ProductMapperPrintTypesPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.productPrintTypeMapper");
  const tStatus = useTranslations("common.status");
  const tableRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [context, setContext] = useState({ loaded: false, isRexven: false, subCategories: [] });

  useEffect(() => {
    let alive = true;
    PrintTypeMappersAPI.context()
      .then((response) => {
        if (!alive) return;
        const data = response?.data ?? {};
        setContext({
          loaded: true,
          isRexven: Boolean(data.is_rexven_customer),
          subCategories: Array.isArray(data.sub_categories) ? data.sub_categories : [],
        });
      })
      .catch(() => {
        if (!alive) return;
        setContext({ loaded: true, isRexven: false, subCategories: [] });
        message.error(t("messages.loadContextError"));
      });
    return () => {
      alive = false;
    };
  }, [message, t]);

  const request = makeListRequest(
    PrintTypeMappersAPI.list,
    { defaultSort: [{ field: "created_at", direction: "desc" }] },
    normalizeListAndMeta,
  );

  const subCategoryOptions = useMemo(
    () =>
      context.subCategories
        .filter((subCategory) => subCategory?.id)
        .map((subCategory) => ({
          value: subCategory.id,
          label: formatSubCategory(subCategory),
        })),
    [context.subCategories],
  );

  const { onDirtyChange, guardClose } = useDirtyGuard(open);

  const closeModal = useCallback(() => {
    setOpen(false);
    setEditingRow(null);
  }, []);

  const onDelete = useCallback(
    async (id) => {
      try {
        await PrintTypeMappersAPI.remove(id);
        message.success(t("messages.deleteSuccess"));
        tableRef.current?.reload();
      } catch (error) {
        message.error(error?.response?.data?.error?.message || t("messages.deleteError"));
      }
    },
    [message, t],
  );

  const columns = useMemo(
    () => [
      {
        title: t("columns.subCategory"),
        dataIndex: "sub_category_id",
        filter: {
          type: "select",
          options: subCategoryOptions,
          placeholder: t("filters.selectSubCategory"),
        },
        render: (_, record) => formatSubCategory(record?.sub_category) || t("common.none"),
      },
      {
        title: t("columns.mapper"),
        dataIndex: "print_type_mapper",
        filter: { type: "text", placeholder: t("filters.searchMapper") },
        render: renderMapperNames,
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        width: 140,
        filter: {
          type: "select",
          options: [
            { value: "active", label: tStatus("active") },
            { value: "inactive", label: tStatus("inactive") },
          ],
          placeholder: t("filters.selectStatus"),
        },
        render: (value) =>
          value === "active" ? (
            <StatusTag status="active">{tStatus("active")}</StatusTag>
          ) : (
            <StatusTag status="inactive">{tStatus("inactive")}</StatusTag>
          ),
      },
      {
        title: t("columns.createdAt"),
        dataIndex: "created_at",
        width: 180,
        sorter: true,
        render: (value) => (value ? moment(value).format("LLL") : t("common.none")),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        width: 110,
        fixed: "right",
        render: (_, record) => (
          <Space>
            <Tooltip title={t("actions.edit")}>
              <Button
                aria-label={t("actions.edit")}
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingRow(record);
                  setOpen(true);
                }}
              />
            </Tooltip>
            <Tooltip title={t("actions.delete")}>
              <Popconfirm
                title={t("actions.confirmDeleteTitle")}
                okText={t("actions.confirmDeleteOk")}
                okButtonProps={{ danger: true }}
                onConfirm={() => onDelete(record.id)}
              >
                <Button aria-label={t("actions.delete")} icon={<DeleteOutlined />} danger />
              </Popconfirm>
            </Tooltip>
          </Space>
        ),
      },
    ],
    [onDelete, subCategoryOptions, t, tStatus],
  );

  const onSubmit = async (values) => {
    try {
      if (editingRow) {
        await PrintTypeMappersAPI.update(editingRow.id, values);
        message.success(t("messages.updateSuccess"));
        tableRef.current?.reload();
      } else {
        await PrintTypeMappersAPI.create(values);
        message.success(t("messages.createSuccess"));
        tableRef.current?.setPage(1);
        tableRef.current?.reload();
      }
      closeModal();
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("messages.operationFailed"));
    }
  };

  return (
    <RequireRole anyOfRoles={["customerAdmin"]}>
      {context.loaded && !context.isRexven ? (
        <Alert className="mb-4" type="info" showIcon message={t("messages.notRexvenCustomer")} />
      ) : null}
      <Alert className="mb-4" type="info" showIcon message={t("description")} />
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{ sub_category_id: undefined, print_type_mapper: "", status: undefined }}
        toolbarRight={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingRow(null);
              setOpen(true);
            }}
          >
            {t("actions.new")}
          </Button>
        }
        tableProps={{
          locale: { emptyText: t("table.noData") },
          scroll: { x: true },
        }}
      />

      <Modal
        title={
          editingRow
            ? t("modal.editTitle", { name: formatSubCategory(editingRow?.sub_category) })
            : t("modal.createTitle")
        }
        open={open}
        onCancel={guardClose(closeModal)}
        footer={null}
        destroyOnHidden
      >
        <ProductPrintTypeMapperForm
          onDirtyChange={onDirtyChange}
          onCancel={guardClose(closeModal)}
          onFinish={onSubmit}
          submitText={editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")}
          subCategoryOptions={subCategoryOptions}
          isEdit={Boolean(editingRow)}
          initialValues={
            editingRow
              ? {
                  sub_category_id: editingRow?.sub_category_id ?? editingRow?.sub_category?.id,
                  print_type_mapper: normalizeMapperNames(editingRow?.print_type_mapper),
                  status: editingRow?.status,
                }
              : undefined
          }
        />
      </Modal>
    </RequireRole>
  );
}
