"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  Button,
  Space,
  Tag,
  Popconfirm,
  Modal,
  Form,
  Input,
  Select,
  App as AntdApp,
  Typography,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { FundingAccountsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const statusColor = {
  active: "green",
  inactive: "red",
};

const { Title } = Typography;

const buildListFromResponse = (resp) => {
  const payload = resp?.data ?? resp;
  const list =
    payload?.items || payload?.data?.data || payload?.data || payload || [];
  return Array.isArray(list) ? list : [];
};

const matchesText = (value, term) =>
  String(value || "").toLowerCase().includes(String(term).toLowerCase());

const sortList = (list, orderBy, orderDir) => {
  if (!orderBy) return list;
  const dir = orderDir === "desc" ? -1 : 1;
  return [...list].sort((a, b) => {
    const left = a?.[orderBy];
    const right = b?.[orderBy];
    if (left == null && right == null) return 0;
    if (left == null) return 1 * dir;
    if (right == null) return -1 * dir;
    if (orderBy.includes("_at")) {
      return (dayjs(left).valueOf() - dayjs(right).valueOf()) * dir;
    }
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * dir;
    }
    return String(left).localeCompare(String(right)) * dir;
  });
};

export default function FundingAccountsAdminPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.fundingAccounts");
  const tCommon = useTranslations("common.actions");
  const tStatus = useTranslations("common.status");

  const tableRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const typeOptions = useMemo(
    () => [
      { value: "zelle", label: "zelle" },
      { value: "ach", label: "ach" },
      { value: "wire", label: "wire" },
      { value: "other", label: "other" },
    ],
    []
  );

  const request = useCallback(async ({ page, pageSize, sort, filters }) => {
    const resp = await FundingAccountsAPI.list();
    let list = buildListFromResponse(resp);

    if (filters?.display_name) {
      list = list.filter((item) =>
        matchesText(item?.display_name, filters.display_name)
      );
    }

    if (filters?.account_identifier) {
      list = list.filter((item) =>
        matchesText(item?.account_identifier, filters.account_identifier)
      );
    }

    if (filters?.type) {
      list = list.filter((item) => item?.type === filters.type);
    }

    if (filters?.status) {
      list = list.filter((item) => item?.status === filters.status);
    }

    const sorted = sortList(list, sort?.orderBy, sort?.orderDir);
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return { list: sorted.slice(start, end), total };
  }, []);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingRow) {
        await FundingAccountsAPI.update(editingRow.id, values);
        message.success(t("messages.updateSuccess"));
      } else {
        await FundingAccountsAPI.create(values);
        message.success(t("messages.createSuccess"));
      }
      setOpen(false);
      setEditingRow(null);
      tableRef.current?.reload();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(
        error?.response?.data?.error?.message || t("messages.operationFailed")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record) => {
    try {
      await FundingAccountsAPI.delete(record.id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.deleteError")
      );
    }
  };

  const columns = useMemo(
    () => [
      { title: t("columns.id"), dataIndex: "id", width: 90, sorter: true },
      {
        title: t("columns.displayName"),
        dataIndex: "display_name",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.displayName") },
      },
      {
        title: t("columns.accountIdentifier"),
        dataIndex: "account_identifier",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.accountIdentifier") },
      },
      {
        title: t("columns.type"),
        dataIndex: "type",
        filter: {
          type: "select",
          placeholder: t("filters.type"),
          options: typeOptions,
        },
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        width: 120,
        filter: {
          type: "select",
          placeholder: t("filters.status"),
          options: [
            { value: "active", label: tStatus("active") },
            { value: "inactive", label: tStatus("inactive") },
          ],
        },
        render: (value) => (
          <Tag color={statusColor[value] || "default"}>
            {tStatus(value) || value}
          </Tag>
        ),
      },
      {
        title: t("columns.createdAt"),
        dataIndex: "created_at",
        sorter: true,
        render: (value) => (value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-"),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        width: 180,
        render: (_, record) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingRow(record);
                form.setFieldsValue({
                  display_name: record?.display_name,
                  account_identifier: record?.account_identifier,
                  type: record?.type,
                  status: record?.status || "active",
                });
                setOpen(true);
              }}
            >
              {t("actions.edit")}
            </Button>
            <Popconfirm
              title={t("actions.confirmDeleteTitle")}
              okText={t("actions.confirmDeleteOk")}
              cancelText={tCommon("cancel")}
              onConfirm={() => handleDelete(record)}
            >
              <Button icon={<DeleteOutlined />} danger>
                {t("actions.delete")}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [form, handleDelete, t, tCommon, tStatus, typeOptions]
  );

  return (
    <RequireRole anyOfRoles={["systemadmin"]}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Title level={3} style={{ margin: 0 }}>
          {t("title")}
        </Title>
        <CrudTable
          ref={tableRef}
          rowKey="id"
          columns={columns}
          request={request}
          initialPageSize={10}
          initialFilters={{
            display_name: "",
            account_identifier: "",
            type: "",
            status: undefined,
          }}
          toolbarRight={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingRow(null);
                form.resetFields();
                form.setFieldsValue({ status: "active" });
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
      </Space>

      <Modal
        title={
          editingRow
            ? t("modal.editTitle", { name: editingRow?.display_name || "" })
            : t("modal.createTitle")
        }
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditingRow(null);
        }}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label={t("fields.displayName")}
            name="display_name"
            rules={[{ required: true, message: t("validation.required") }]}
          >
            <Input placeholder={t("placeholders.displayName")} />
          </Form.Item>
          <Form.Item
            label={t("fields.accountIdentifier")}
            name="account_identifier"
            rules={[{ required: true, message: t("validation.required") }]}
          >
            <Input placeholder={t("placeholders.accountIdentifier")} />
          </Form.Item>
          <Form.Item
            label={t("fields.type")}
            name="type"
            rules={[{ required: true, message: t("validation.required") }]}
          >
            <Select
              placeholder={t("placeholders.type")}
              options={typeOptions}
            />
          </Form.Item>
          <Form.Item
            label={t("fields.status")}
            name="status"
            rules={[{ required: true, message: t("validation.required") }]}
          >
            <Select
              placeholder={t("placeholders.status")}
              options={[
                { value: "active", label: tStatus("active") },
                { value: "inactive", label: tStatus("inactive") },
              ]}
            />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")}
            </Button>
            <Button onClick={() => form.resetFields()}>
              {tCommon("reset")}
            </Button>
          </Space>
        </Form>
      </Modal>
    </RequireRole>
  );
}
