"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  App as AntdApp,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Popover,
  Select,
  Space,
  Tag,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
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
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [form] = Form.useForm();

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
                  form.setFieldsValue({
                    category_id: record?.category_id || undefined,
                    name: record?.name || "",
                    status: record?.status || "active",
                  });
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
    [categories, form, t, tStatus],
  );

  const openCreateModal = () => {
    setEditingRow(null);
    form.setFieldsValue({ category_id: undefined, name: "", status: "active" });
    setOpen(true);
  };

  const closeModal = () => {
    setOpen(false);
    setEditingRow(null);
    form.resetFields();
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

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
      if (error?.errorFields) return;
      message.error(error?.response?.data?.error?.message || t("messages.operationFailed"));
    } finally {
      setSubmitting(false);
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
      anyOfCategories={["Dtf", "Uvdtf"]}
    >
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          name: "",
          category_id: undefined,
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
        onOk={onSubmit}
        okButtonProps={{ loading: submitting }}
        okText={editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")}
        title={editingRow ? t("modal.editTitle", { name: editingRow?.name || "" }) : t("modal.createTitle")}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t("columns.category")}
            name="category_id"
            rules={[{ required: true, message: t("validation.categoryRequired") }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t("filters.selectCategory")}
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          </Form.Item>

          <Form.Item
            label={t("columns.name")}
            name="name"
            rules={[{ required: true, message: t("validation.nameRequired") }]}
          >
            <Input maxLength={200} />
          </Form.Item>

          <Form.Item label={t("columns.status")} name="status">
            <Select
              options={[
                { value: "active", label: tStatus("active") },
                { value: "inactive", label: tStatus("inactive") },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </RequireRole>
  );
}
