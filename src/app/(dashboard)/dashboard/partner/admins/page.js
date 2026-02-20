"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Space, Button, Modal, App as AntdApp, Tag, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { CategoriesAPI, PartnerAdminsAPI, PartnersAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import PartnerAdminForm from "@/components/common/forms/PartnerAdminForm";
import { makeListRequest } from "@/utils/listPayload";
import moment from "moment";
import { useTranslations } from "@/i18n/use-translations";
import { RoleEnum } from "@/utils/consts";

export default function PartnerAdminsPage() {
  const { message } = AntdApp.useApp();
  const tableRef = useRef(null);
  const t = useTranslations("dashboard.partnerAdmins");
  const tStatus = useTranslations("common.status");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [partners, setPartners] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let alive = true;

    const loadPartners = async () => {
      try {
        const resp = await PartnersAPI.list({ page: 1, pageSize: 200 });
        if (!alive) return;
        const { list } = normalizeListAndMeta(resp);
        setPartners(Array.isArray(list) ? list : []);
      } catch {
        if (alive) {
          message.error(t("messages.loadPartnersError"));
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

    loadPartners();
    loadCategories();
    return () => {
      alive = false;
    };
  }, [message, t]);

  const request = makeListRequest(
    PartnerAdminsAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
      filterMap: { partner: "partner_id" },
      numericArrayKeys: ["user_categories"],
      fixedFilters: { role_code: RoleEnum.PARTNER_ADMIN },
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
        title: t("columns.partner"),
        dataIndex: "partner",
        sorter: true,
        filter: {
          type: "select",
          placeholder: t("filters.selectPartner"),
          options: partners.map((partner) => ({
            value: partner.id,
            label: partner.name,
          })),
          width: 260,
        },
        render: (_, record) => record?.partner?.name || t("common.none"),
      },
      {
        title: t("columns.categories"),
        dataIndex: "user_categories",
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
    [categories, partners, t]
  );

  const onSubmit = async (values) => {
    try {
      if (editing) {
        const payload = {
          first_name: values.first_name,
          last_name: values.last_name,
          mobile_phone: values.mobile_phone,
          role_code: RoleEnum.PARTNER_ADMIN,
          status: values.status,
        };
        await PartnerAdminsAPI.update(editing.id, payload);
        message.success(t("messages.updateSuccess"));
      } else {
        const payload = {
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          password: values.password,
          mobile_phone: values.mobile_phone,
          partner_id: values.partner_id,
          role_code: RoleEnum.PARTNER_ADMIN,
        };
        await PartnerAdminsAPI.create(payload);
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
      await PartnerAdminsAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload();
    } catch {
      message.error(t("messages.deleteError"));
    }
  };

  return (
    <RequireRole anyOfRoles={["companyAdmin"]}>
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
          partnerId: undefined,
          user_categories: [],
        }}
        toolbarRight={
          <RequireRole anyOfRoles={["companyAdmin"]}>
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
        <PartnerAdminForm
          mode={editing ? "edit" : "create"}
          partners={partners}
          categories={categories}
          initialValues={
            editing
              ? {
                  first_name: editing.first_name,
                  last_name: editing.last_name,
                  email: editing.email,
                  mobile_phone: editing.mobile_phone,
                  status: editing.status || "active",
                  role_code: editing.role_code,
                  categories: (editing?.user_categories || []).map(
                    (category) => category.id
                  ),
                }
              : { status: "active", role_code: RoleEnum.PARTNER_ADMIN }
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
