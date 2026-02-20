"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { Space, Tag, Button, Modal, App as AntdApp, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { PartnersAPI, CategoriesAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import PartnerForm from "@/components/common/forms/PartnerForm";
import { makeListRequest } from "@/utils/listPayload";
import { useTranslations } from "@/i18n/use-translations";
import { useSelector } from "react-redux";
import {
  percentToMultiplier,
  multiplierToPercent,
  getPrimaryShipmentMultiplier,
} from "@/utils/multiplier";

export default function PartnersPage() {
  const { message } = AntdApp.useApp();
  const tableRef = useRef(null);
  const t = useTranslations("dashboard.partner");
  const tStatus = useTranslations("common.status");
  const user = useSelector((s) => s.auth.user);
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
    PartnersAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
      filterMap: {},
      numericArrayKeys: ["partner_categories"],
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
        dataIndex: "partner_categories",
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
      isShippingOwner ?
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
                  return <Tag key={item?.id || index}>{label}</Tag>;
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
    [categories, t, isShippingOwner]
  );

  const buildPayload = (values) => {
    const payload = { ...values };
    const normalizedMultiplier = percentToMultiplier(
      values?.shipment_multiplier
    );
    delete payload.shipment_multiplier;

    if (normalizedMultiplier !== undefined) {
      payload.shipment_multiplier = normalizedMultiplier;
    }

    return payload;
  };

  const onSubmit = async (values) => {
    const payload = buildPayload(values);
    try {
      if (editingRow) {
        await PartnersAPI.update(editingRow.id, payload);
        message.success(t("messages.updateSuccess"));
        setOpen(false);
        setEditingRow(null);
        tableRef.current?.reload();
      } else {
        await PartnersAPI.create(payload);
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
      await PartnersAPI.remove(id);
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
          name: "",
          description: "",
          status: undefined,
          partner_categories: [],
        }}
        toolbarRight={
          <RequireRole anyOfRoles={["companyAdmin"]}>
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
        <PartnerForm
          onFinish={onSubmit}
          submitText={
            editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")
          }
          categories={categories}
          initialValues={
            editingRow
              ? {
                  name: editingRow?.name,
                  description: editingRow?.description,
                  categories: (
                    editingRow?.partner_categories || editingRow?.categories || []
                  ).map((category) => category.id),
                  status: editingRow?.status,
                  shipment_multiplier: multiplierToPercent(
                    getPrimaryShipmentMultiplier(editingRow)
                  ),
                }
              : { status: "active" }
          }
        />
      </Modal>
    </RequireRole>
  );
}
