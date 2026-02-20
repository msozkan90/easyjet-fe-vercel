"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Space, Tag, Button, Modal, App as AntdApp, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { CategoriesAPI, CompanyAdminsAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import CompanyUserForm from "@/components/common/forms/CompanyUserForm";
import { makeListRequest } from "@/utils/listPayload";
import moment from "moment";
import { useTranslations } from "@/i18n/use-translations";
import { RoleEnum } from "@/utils/consts";

const ROLE_FILTERS = [
  RoleEnum.COMPANY_ADMIN,
  RoleEnum.COMPANY_SHIPMENT_WORKER,
  RoleEnum.COMPANY_COMPLETED_WORKER,
];

export default function CompanyUsersPage() {
  const { message } = AntdApp.useApp();
  const tableRef = useRef(null);
  const t = useTranslations("dashboard.companyUsers");
  const tStatus = useTranslations("common.status");
  const tRoles = useTranslations("forms.common.roles");
  const user = useSelector((s) => s.auth.user);
  const companyId = user?.entity?.id;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let alive = true;

    const loadCategories = async () => {
      try {
        const resp = await CategoriesAPI.list();
        if (!alive) return;
        const payload = resp?.data ?? resp;
        const list =
          payload?.items ??
          payload?.data?.data ??
          payload?.data ??
          payload ??
          [];
        setCategories(Array.isArray(list) ? list : []);
      } catch {
        if (alive) {
          message.error(t("messages.loadCategoriesError"));
        }
      }
    };

    loadCategories();
    return () => {
      alive = false;
    };
  }, [message, t]);

  const request = makeListRequest(
    CompanyAdminsAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
      numericArrayKeys: ["categories"],
      fixedFilters: { role_code: ROLE_FILTERS },
    },
    normalizeListAndMeta,
  );

  const roleLabels = useMemo(
    () => ({
      [RoleEnum.COMPANY_ADMIN]: tRoles("companyAdmin"),
      [RoleEnum.COMPANY_SHIPMENT_WORKER]: tRoles("companyShipmentWorker"),
      [RoleEnum.COMPANY_COMPLETED_WORKER]: tRoles("companyCompletedWorker"),
    }),
    [tRoles],
  );

  const columns = useMemo(
    () => [
      { title: t("columns.id"), dataIndex: "id", width: 90, sorter: true },
      {
        title: t("columns.firstName"),
        dataIndex: "first_name",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.searchFirstName") },
      },
      {
        title: t("columns.lastName"),
        dataIndex: "last_name",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.searchLastName") },
      },
      {
        title: t("columns.email"),
        dataIndex: "email",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.searchEmail") },
      },
      {
        title: t("columns.mobile"),
        dataIndex: "mobile_phone",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.searchMobile") },
      },
      {
        title: t("columns.role"),
        dataIndex: "role",
        width: 200,
        render: (value) => {
          return roleLabels[value.code] || value.code || t("common.none");
        },
      },
      {
        title: t("columns.categories"),
        dataIndex: "user_categories",
        width: 260,
        filter: {
          type: "multi",
          placeholder: t("filters.selectCategories"),
          options: categories.map((category) => ({
            value: category.id,
            label: category.name,
          })),
          width: 260,
        },
        render: (list) =>
          Array.isArray(list) && list.length ? (
            <Space wrap>
              {list.map((category) => (
                <Tag key={category.id}>{category.name}</Tag>
              ))}
            </Space>
          ) : (
            t("common.none")
          ),
      },
      {
        title: t("columns.createdAt"),
        dataIndex: "created_at",
        width: 180,
        sorter: true,
        render: (value) => moment(value).format("LLL"),
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
          width: 220,
        },
        render: (value) =>
          value === "active" ? (
            <Tag color="green">{tStatus("active")}</Tag>
          ) : (
            <Tag color="red">{tStatus("inactive")}</Tag>
          ),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        width: 220,
        render: (_, record) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(record);
                setOpen(true);
              }}
            >
              {t("actions.edit")}
            </Button>
            <Popconfirm
              title={t("actions.confirmDeleteTitle")}
              okText={t("actions.confirmDeleteOk")}
              okButtonProps={{ danger: true }}
              onConfirm={() => onDelete(record.id)}
            >
              <Button icon={<DeleteOutlined />} danger>
                {t("actions.delete")}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [categories, roleLabels, t, tStatus],
  );

  const buildPayload = (values, isEditing) => {
    const payload = {
      first_name: values.first_name,
      last_name: values.last_name,
      mobile_phone: values.mobile_phone,
      role_code: values.role_code,
    };

    if (!isEditing && values.email) payload.email = values.email;
    if (!isEditing && values.password) payload.password = values.password;
    if (isEditing && values.status) payload.status = values.status;
    if (!isEditing && companyId) payload.company_id = companyId;

    if (values.role_code !== RoleEnum.COMPANY_ADMIN) {
      payload.categories = Array.isArray(values.categories)
        ? values.categories
        : [];
    }

    return payload;
  };

  const onSubmit = async (values) => {
    try {
      const payload = buildPayload(values, Boolean(editing));
      if (editing) {
        await CompanyAdminsAPI.update(editing.id, payload);
        message.success(t("messages.updateSuccess"));
      } else {
        await CompanyAdminsAPI.create(payload);
        message.success(t("messages.createSuccess"));
      }
      setOpen(false);
      setEditing(null);
      tableRef.current?.setPage(1);
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.operationFailed"),
      );
    }
  };

  const onDelete = async (id) => {
    try {
      await CompanyAdminsAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload();
    } catch {
      message.error(t("messages.deleteError"));
    }
  };

  return (
    <RequireRole anyOfRoles={["companyadmin"]}>
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          first_name: "",
          last_name: "",
          email: "",
          mobile_phone: "",
          status: undefined,
          categories: [],
        }}
        toolbarRight={
          <RequireRole anyOfRoles={["companyadmin"]}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              {t("actions.new")}
            </Button>
          </RequireRole>
        }
        tableProps={{
          locale: { emptyText: t("table.noData") },
          scroll: { x: true },
        }}
      />

      <Modal
        title={editing ? t("modal.editTitle") : t("modal.createTitle")}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        footer={null}
        destroyOnHidden
      >
        <CompanyUserForm
          mode={editing ? "edit" : "create"}
          categories={categories}
          initialValues={
            editing
              ? {
                  first_name: editing.first_name,
                  last_name: editing.last_name,
                  email: editing.email,
                  mobile_phone: editing.mobile_phone,
                  status: editing.status || "active",
                  role_code: editing.role.code,
                  categories: (editing?.user_categories || []).map(
                    (category) => category.id,
                  ),
                }
              : { role_code: RoleEnum.COMPANY_ADMIN }
          }
          onSubmit={onSubmit}
          onCancel={() => {
            setOpen(false);
            setEditing(null);
          }}
        />
      </Modal>
    </RequireRole>
  );
}
