"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  App as AntdApp,
  Button,
  Modal,
  Popconfirm,
  Popover,
  Space,
  Tag,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import ProductForm from "@/components/common/forms/ProductForm";
import { CategoriesAPI, TransferProductsAPI } from "@/utils/api";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";

export default function TransferProductsPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.transferProduct");
  const tStatus = useTranslations("common.status");
  const tableRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        const response = await CategoriesAPI.list();
        const payload = response?.data ?? response;
        const list =
          payload?.items ??
          payload?.data?.data ??
          payload?.data ??
          payload ??
          [];
        if (active) setCategories(Array.isArray(list) ? list : []);
      } catch (error) {
        if (active) {
          message.error(
            error?.response?.data?.error?.message ||
              t("messages.loadCategoriesError"),
          );
        }
      }
    };

    loadCategories();
    return () => {
      active = false;
    };
  }, [message, t]);

  const request = makeListRequest(
    TransferProductsAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
      filterMap: {
        name: "q",
        category_id: "category_id",
        without_design: "without_design",
      },
    },
    normalizeListAndMeta,
  );

  const columns = useMemo(
    () => [
      {
        title: t("columns.name"),
        dataIndex: "name",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.searchName") },
      },
      {
        title: t("columns.category"),
        dataIndex: "category_id",
        sorter: true,
        filter: {
          type: "select",
          options: categories.map((category) => ({
            value: category.id,
            label: category.name,
          })),
          placeholder: t("filters.selectCategory"),
        },
        render: (_, record) => record?.category?.name || t("common.none"),
      },
      {
        title: t("columns.subCategory"),
        dataIndex: "sub_category_id",
        sorter: true,
        render: (_, record) => record?.subCategory?.name || t("common.none"),
      },
      {
        title: t("columns.withoutDesign"),
        dataIndex: "without_design",
        sorter: true,
        filter: {
          type: "select",
          options: [
            { value: true, label: t("filters.withoutDesignYes") },
            { value: false, label: t("filters.withoutDesignNo") },
          ],
          placeholder: t("filters.selectWithoutDesign"),
        },
        render: (value) =>
          value ? (
            <CheckOutlined style={{ color: "#16a34a", fontSize: 16 }} />
          ) : (
            <CloseOutlined style={{ color: "#dc2626", fontSize: 16 }} />
          ),
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        width: 140,
        sorter: true,
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
            <Tag color="green">{tStatus("active")}</Tag>
          ) : (
            <Tag color="red">{tStatus("inactive")}</Tag>
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
        fixed: "right",
        width: 90,
        render: (_, record) => (
          <Space>
            <Popover content={t("actions.edit")}>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingRow(record);
                  setOpen(true);
                }}
              />
            </Popover>
            <Popover content={t("actions.delete")}>
              <Popconfirm
                title={t("actions.confirmDeleteTitle")}
                okText={t("actions.confirmDeleteOk")}
                okButtonProps={{ danger: true }}
                onConfirm={() => onDelete(record.id)}
              >
                <Button icon={<DeleteOutlined />} danger />
              </Popconfirm>
            </Popover>
          </Space>
        ),
      },
    ],
    [categories, t, tStatus],
  );

  const openCreateModal = () => {
    setEditingRow(null);
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditingRow(null);
  };

  const onSubmit = async (values) => {
    try {
      if (editingRow) {
        await TransferProductsAPI.update(editingRow.id, values);
        message.success(t("messages.updateSuccess"));
      } else {
        await TransferProductsAPI.create(values);
        message.success(t("messages.createSuccess"));
      }

      closeModal();
      tableRef.current?.setPage?.(1);
      tableRef.current?.reload?.();
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("messages.operationFailed"));
    }
  };

  const onDelete = async (id) => {
    try {
      await TransferProductsAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload?.();
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("messages.deleteError"));
    }
  };

  return (
    <RequireRole
      anyOfRoles={["companyAdmin"]}
      anyOfCategories={["Transfers"]}
    >
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          name: "",
          category_id: undefined,
          without_design: undefined,
          status: undefined,
        }}
        toolbarRight={
          <Button icon={<PlusOutlined />} type="primary" onClick={openCreateModal}>
            {t("actions.new")}
          </Button>
        }
      />

      <Modal
        open={open}
        onCancel={closeModal}
        title={editingRow ? t("modal.editTitle", { name: editingRow?.name || "" }) : t("modal.createTitle")}
        footer={null}
        destroyOnHidden
      >
        <ProductForm
          onFinish={onSubmit}
          submitText={
            editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")
          }
          categories={categories}
          initialValues={
            editingRow
              ? {
                  name: editingRow?.name,
                  category_id:
                    editingRow?.category_id ?? editingRow?.category?.id,
                  sub_category_id:
                    editingRow?.sub_category_id ??
                    editingRow?.subCategory?.id,
                  sub_category_name:
                    editingRow?.sub_category?.name ??
                    editingRow?.subCategory?.name ??
                    undefined,
                  sub_category:
                    editingRow?.sub_category ?? editingRow?.subCategory,
                  without_design: !!editingRow?.without_design,
                  status: editingRow?.status,
                }
              : undefined
          }
          showWithoutDesign
        />
      </Modal>
    </RequireRole>
  );
}
