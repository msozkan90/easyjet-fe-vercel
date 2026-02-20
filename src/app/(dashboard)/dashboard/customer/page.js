"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { Space, Tag, Button, Modal, App as AntdApp, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { CustomersAPI, CategoriesAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import CustomerForm from "@/components/common/forms/CustomerForm";
import { makeListRequest } from "@/utils/listPayload";
import { useTranslations } from "@/i18n/use-translations";
import { useSelector } from "react-redux";
import {
  percentToMultiplier,
  multiplierToPercent,
  getPrimaryProductMultiplier,
  getPrimaryShipmentMultiplier,
} from "@/utils/multiplier";

export default function CustomersPage() {
  const { message } = AntdApp.useApp();
  const tableRef = useRef(null);
  const t = useTranslations("dashboard.customer");
  const user = useSelector((s) => s.auth.user);
  const isPartnerEntity = user?.entity?.entity_type === "partner";
  const isShippingOwner = user?.entity?.is_shipping_owner || false;

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
    CustomersAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
      filterMap: {},
      numericArrayKeys: ["customer_categories"],
      fixedFilters: {},
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
        dataIndex: "customer_categories",
        width: 260,
        filter: {
          type: "multi",
          placeholder: t("filters.selectCategories"),
          options: categories.map((c) => ({ value: c.id, label: c.name })),
          width: 260,
        },
        render: (cats) =>
          Array.isArray(cats) && cats.length ? (
            <Space wrap>
              {cats.map((c) => (
                <Tag key={c.id}>{c.name}</Tag>
              ))}
            </Space>
          ) : (
            t("common.none")
          ),
      },

      isShippingOwner
        ? {
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
                      return <Tag key={item?.id || index}>{label}</Tag>;
                    })}
                  </Space>
                );
              }

              const fallback = getPrimaryShipmentMultiplier(record);
              if (fallback !== undefined) {
                const percent = multiplierToPercent(fallback);
                return typeof percent === "number" ? `%${percent}` : fallback;
              }
              return t("common.none");
            },
          }
        : {},

      isPartnerEntity
        ? {
            title: t("columns.productMultiplier"),
            dataIndex: "product_multipliers",
            width: 200,
            render: (_, record) => {
              const multipliers = Array.isArray(record?.product_multipliers)
                ? record.product_multipliers.filter(
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
                      return <Tag key={item?.id || index}>{label}</Tag>;
                    })}
                  </Space>
                );
              }

              const fallback = getPrimaryProductMultiplier(record);
              if (fallback !== undefined) {
                const percent = multiplierToPercent(fallback);
                return typeof percent === "number" ? `%${percent}` : fallback;
              }
              return t("common.none");
            },
          }
        : {},

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
                setEditingRow(record);
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
    [categories, t, isPartnerEntity, isShippingOwner]
  );

  const buildPayload = (values) => {
    const payload = { ...values };

    if (isPartnerEntity) {
      const normalizedProductMultiplier = percentToMultiplier(
        values?.product_multiplier
      );
      delete payload.product_multiplier;
      if (normalizedProductMultiplier !== undefined) {
        payload.product_multiplier = normalizedProductMultiplier;
      }
    } else {
      delete payload.product_multiplier;
    }

    if (isShippingOwner) {
      const normalizedShipmentMultiplier = percentToMultiplier(
        values?.shipment_multiplier
      );
      delete payload.shipment_multiplier;

      if (normalizedShipmentMultiplier !== undefined) {
        payload.shipment_multiplier = normalizedShipmentMultiplier;
  
 
      } else {
        delete payload.shipment_multipliers;
      }
    } else {
      delete payload.shipment_multiplier;
      delete payload.shipment_multipliers;
    }

    return payload;
  };

  const onSubmit = async (values) => {
    const payload = buildPayload(values);
    try {
      if (editingRow) {
        await CustomersAPI.update(editingRow.id, payload);
        message.success(t("messages.updateSuccess"));
        setOpen(false);
        setEditingRow(null);
        tableRef.current?.reload();
      } else {
        await CustomersAPI.create(payload);
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

  const onDelete = async (id) => {
    try {
      await CustomersAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload();
    } catch {
      message.error(t("messages.deleteError"));
    }
  };

  return (
    <RequireRole anyOfRoles={["companyAdmin", "partnerAdmin"]}>
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          name: "",
          description: "",
          status: undefined,
          customer_categories: [],
        }}
        toolbarRight={
          <RequireRole anyOfRoles={["companyAdmin", "partnerAdmin"]}>
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
        tableProps={{
          locale: { emptyText: t("table.noData") },
          scroll: { x: true },
        }}
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
      >
        <CustomerForm
          onFinish={onSubmit}
          submitText={
            editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")
          }
          categories={categories}
          has_api_key={editingRow?.has_api_key}
          initialValues={
            editingRow
              ? {
                  name: editingRow?.name,
                  description: editingRow?.description,
                  categories: (editingRow?.customer_categories || []).map(
                    (c) => c.id
                  ),
                  status: editingRow?.status,
                  store_id: editingRow?.store_id,
                  ...(isPartnerEntity
                    ? {
                        product_multiplier: multiplierToPercent(
                          getPrimaryProductMultiplier(editingRow)
                        ),
                      }
                    : {}),
                  ...(isShippingOwner
                    ? {
                        shipment_multiplier: multiplierToPercent(
                          getPrimaryShipmentMultiplier(editingRow)
                        ),
                      }
                    : {}),
                }
              : { status: "active" }
          }
          showProductMultiplier={isPartnerEntity}
          showShipmentMultiplier={isShippingOwner}
        />
      </Modal>
    </RequireRole>
  );
}
