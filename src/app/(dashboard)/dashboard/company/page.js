"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { Space, Tag, Button, Modal, App as AntdApp } from "antd";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { CompaniesAPI, CategoriesAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import CompanyForm from "@/components/common/forms/CompanyForm";
import { makeListRequest } from "@/utils/listPayload";
import { useTranslations } from "@/i18n/use-translations";
import {
  percentToMultiplier,
  multiplierToPercent,
  getPrimaryShipmentMultiplier,
} from "@/utils/multiplier";

export default function CompaniesPage() {
  const { message } = AntdApp.useApp();
  const tableRef = useRef(null);
  const t = useTranslations("dashboard.company");

  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
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
    })();
    return () => {
      alive = false;
    };
  }, [message, t]);

  const request = makeListRequest(
    CompaniesAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
      filterMap: {},
      numericArrayKeys: ["company_categories"],
    },
    normalizeListAndMeta
  );

  const columns = useMemo(
    () => [
      { title: t("columns.id"), dataIndex: "id", width: 90, sorter: true },
      {
        title: t("columns.name"),
        dataIndex: "name",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.searchName") },
      },
      {
        title: t("columns.description"),
        dataIndex: "description",
        width: 200,
        sorter: true,
        filter: { type: "text", placeholder: t("filters.searchDescription") },
      },
      {
        title: t("columns.categories"),
        dataIndex: "company_categories",
        width: 260,
        filter: {
          type: "multi",
          placeholder: t("filters.selectCategories"),
          options: categories.map((c) => ({ value: c.id, label: c.name })),
          width: 260,
        },
        render: (cats) =>
          Array.isArray(cats) && cats.length > 0 ? (
            <Space wrap>
              {cats.map((c) => (
                <Tag key={c.id}>{c.name}</Tag>
              ))}
            </Space>
          ) : (
            t("common.none")
          ),
      },
      {
        title: t("columns.shipmentMultiplier"),
        dataIndex: "shipment_multipliers",
        width: 180,
        render: (_, record) => {
          const multipliers = Array.isArray(record?.shipment_multipliers)
            ? record.shipment_multipliers.filter(
                (item) =>
                  item?.multiplier !== undefined &&
                  item?.multiplier !== null &&
                  item?.multiplier !== ""
              )
            : [];

          if (multipliers.length > 0) {
            return (
              <Space wrap>
                {multipliers.map((item, index) => {
                  const percent = multiplierToPercent(item?.multiplier);
                  const label =
                    typeof percent === "number"
                      ? `%${percent}`
                      : item?.multiplier ?? "-";
                  return (
                    <Tag key={item?.id || index}>
                      {label}
                    </Tag>
                  );
                })}
              </Space>
            );
          }

          const fallbackMultiplier = getPrimaryShipmentMultiplier(record);
          if (fallbackMultiplier !== undefined) {
            const percent = multiplierToPercent(fallbackMultiplier);
            return typeof percent === "number"
              ? `%${percent}`
              : fallbackMultiplier;
          }
          return t("common.none");
        },
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
        width: 200,
        render: (_, record) => (
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => {
                setEditingRow(record);
                setOpen(true);
              }}
            >
              {t("actions.edit")}
            </Button>
          </Space>
        ),
      },
    ],
    [categories, t]
  );

  const buildPayload = (values) => {
    const payload = { ...values };
    const normalizedMultiplier = percentToMultiplier(values?.shipment_multiplier);
    delete payload.shipment_multiplier;

    if (normalizedMultiplier === undefined) {
      delete payload.shipment_multipliers;
    } else {
      payload.shipment_multiplier = normalizedMultiplier;
    }

    const addressPayload = values?.address;
    if (addressPayload) {
      payload.address = {
        name: addressPayload.name,
        phone: addressPayload.phone,
        company_name: addressPayload.company_name,
        address_line1: addressPayload.address_line1,
        city_locality: addressPayload.city_locality,
        state_province: addressPayload.state_province,
        postal_code: addressPayload.postal_code,
        country_code: addressPayload.country_code,
      };
    }

    return payload;
  };

  const formInitialValues = useMemo(
    () =>
      editingRow
        ? {
            name: editingRow?.name,
            description: editingRow?.description,
            categories: (editingRow?.company_categories || []).map((c) => c.id),
            status: editingRow?.status,
            shipment_multiplier: multiplierToPercent(
              getPrimaryShipmentMultiplier(editingRow)
            ),
            address: editingRow?.address
              ? {
                  name: editingRow.address.name,
                  phone: editingRow.address.phone,
                  company_name: editingRow.address.company_name,
                  address_line1: editingRow.address.address_line1,
                  city_locality: editingRow.address.city_locality,
                  state_province: editingRow.address.state_province,
                  postal_code: editingRow.address.postal_code,
                  country_code: editingRow.address.country_code,
                }
              : {},
          }
        : { status: "active", address: {} },
    [editingRow, open]
  );

  const onSubmit = async (values) => {
    const payload = buildPayload(values);
    try {
      if (editingRow) {
        await CompaniesAPI.update(editingRow.id, payload);
        message.success(t("messages.updateSuccess"));
        setOpen(false);
        setEditingRow(null);
        tableRef.current?.reload();
      } else {
        await CompaniesAPI.create(payload);
        message.success(t("messages.createSuccess"));
        setOpen(false);
        tableRef.current?.setPage(1);
        tableRef.current?.reload();
      }
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.operationFailed")
      );
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
          name: "",
          description: "",
          status: undefined,
          company_categories: [],
        }}
        toolbarRight={
          <RequireRole anyOfRoles={["systemadmin"]}>
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
          </RequireRole>
        }
        tableProps={{ locale: { emptyText: t("table.noData") } }}
      />

      <Modal
        title={
          editingRow
            ? t("modal.editTitle", { name: editingRow?.name || "" })
            : t("modal.createTitle")
        }
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditingRow(null);
        }}
        footer={null}
        destroyOnHidden
        width={1040}
      >
        <CompanyForm
          onFinish={onSubmit}
          submitText={
            editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")
          }
          categories={categories}
          initialValues={formInitialValues}
        />
      </Modal>
    </RequireRole>
  );
}
