"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Space, Tag, Button, Modal, App as AntdApp, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { CompaniesAPI, CategoriesAPI, CompanyAdminsAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import CompanyAdminForm from "@/components/common/forms/CompanyAdminForm";
import { makeListRequest } from "@/utils/listPayload";
import moment from "moment";
import { useTranslations } from "@/i18n/use-translations";
import { RoleEnum } from "@/utils/consts";

export default function CompanyAdminsPage() {
  const { message } = AntdApp.useApp();
  const tableRef = useRef(null);
  const t = useTranslations("dashboard.companyAdmins");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let alive = true;

    const loadCompanies = async () => {
      try {
        const resp = await CompaniesAPI.list({ page: 1, pageSize: 200 });
        if (!alive) return;
        const { list } = normalizeListAndMeta(resp);
        setCompanies(list);
      } catch {
        if (alive) {
          message.error(t("messages.loadCompaniesError"));
        }
      }
    };

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

    loadCompanies();
    loadCategories();
    return () => {
      alive = false;
    };
  }, [message, t]);

  const request = makeListRequest(
    CompanyAdminsAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
      filterMap: { company: "company_id" },
      numericArrayKeys: ["user_categories"],
      fixedFilters: { role_code: RoleEnum.COMPANY_ADMIN },
    },
    normalizeListAndMeta
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
        title: t("columns.company"),
        dataIndex: "company",
        sorter: true,
        filter: {
          type: "select",
          placeholder: t("filters.selectCompany"),
          options: companies.map((company) => ({
            value: company.id,
            label: company.name,
          })),
          width: 260,
        },
        render: (_, record) => record?.company?.name || t("common.none"),
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
            { value: "active", label: t("status.active") },
            { value: "inactive", label: t("status.inactive") },
          ],
          placeholder: t("filters.selectStatus"),
          width: 220,
        },
        render: (value) =>
          value === "active" ? (
            <Tag color="green">{t("status.active")}</Tag>
          ) : (
            <Tag color="red">{t("status.inactive")}</Tag>
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
    [categories, companies, t]
  );

  const onSubmit = async (values) => {
    try {
      if (editing) {
        const payload = {
          first_name: values.first_name,
          last_name: values.last_name,
          mobile_phone: values.mobile_phone,
          role_code: RoleEnum.COMPANY_ADMIN,
          status: values.status,
        };
        await CompanyAdminsAPI.update(editing.id, payload);
        message.success(t("messages.updateSuccess"));
      } else {
        const payload = {
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          password: values.password,
          mobile_phone: values.mobile_phone,
          company_id: values.company_id,
          role_code: RoleEnum.COMPANY_ADMIN,
        };
        await CompanyAdminsAPI.create(payload);
        message.success(t("messages.createSuccess"));
      }
      setOpen(false);
      setEditing(null);
      tableRef.current?.setPage(1);
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.operationFailed")
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
    <RequireRole anyOfRoles={["systemadmin"]}>
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
          role_code: undefined,
          companyId: undefined,
          user_categories: [],
        }}
        toolbarRight={
          <RequireRole anyOfRoles={["systemadmin"]}>
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
        <CompanyAdminForm
          mode={editing ? "edit" : "create"}
          companies={companies}
          categories={categories}
          initialValues={
            editing
              ? {
                  first_name: editing.first_name,
                  last_name: editing.last_name,
                  email: editing.email,
                  mobile_phone: editing.mobile_phone,
                  status: editing.status || "active",
                  role_code: RoleEnum.COMPANY_ADMIN,
                  categories: (editing?.user_categories || []).map(
                    (category) => category.id
                  ),
                }
              : { status: "active", role_code: RoleEnum.COMPANY_ADMIN }
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
