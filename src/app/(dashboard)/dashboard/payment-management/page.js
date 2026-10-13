"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  App as AntdApp,
  Button,
  Popconfirm,
  Select,
  Space,
  Typography,
} from "antd";
import { DollarOutlined, FileSearchOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import {
  CustomersAPI,
  PartnersAPI,
  TransferOrdersAPI,
} from "@/utils/api";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import PageHeader from "@/components/ui/PageHeader";
import { useTranslations } from "@/i18n/use-translations";
import StatusTag from "@/components/ui/StatusTag";
import RowActions from "@/components/ui/RowActions";
import { formatMoney as formatMoneyShared } from "@/utils/formatMoney";

const { Text } = Typography;

const formatMoney = (value) =>
  formatMoneyShared(value ?? 0, { fallback: formatMoneyShared(0) });

const listAll = async (apiFn) => {
  const resp = await apiFn({
    pagination: { page: 1, pageSize: 500 },
    filters: {},
  });
  return normalizeListAndMeta(resp).list || [];
};

export default function TransferPaymentManagementPage() {
  const t = useTranslations("dashboard.paymentManagement");
  const tStatus = useTranslations("common.status");
  const tCommon = useTranslations("common.actions");
  const { message } = AntdApp.useApp();
  const tableRef = useRef(null);
  const [selectedRowMap, setSelectedRowMap] = useState({});
  const [customerOptions, setCustomerOptions] = useState([]);
  const [partnerOptions, setPartnerOptions] = useState([]);
  const [entityFilter, setEntityFilter] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [customers, partners] = await Promise.all([
          listAll(CustomersAPI.list),
          listAll(PartnersAPI.list),
        ]);
        if (!alive) return;
        setCustomerOptions(
          customers.map((row) => ({ value: row.id, label: row.name || row.id })),
        );
        setPartnerOptions(
          partners.map((row) => ({ value: row.id, label: row.name || row.id })),
        );
      } catch {
        if (alive) message.error(t("filterLoadError"));
      }
    })();
    return () => {
      alive = false;
    };
  }, [message, t]);

  const listRequest = useMemo(
    () =>
      makeListRequest(
        TransferOrdersAPI.paymentPendingList,
        {
          defaultSort: [{ field: "created_at", direction: "desc" }],
          filterTransform: (filters = {}) => {
            const next = { ...filters };
            const orderDate = next.order_date;
            if (orderDate?.gte || orderDate?.lte) {
              next.date_from = orderDate.gte;
              next.date_to = orderDate.lte;
            }
            delete next.order_date;
            return next;
          },
        },
        normalizeListAndMeta,
      ),
    [],
  );

  const entityOptions = useMemo(
    () => [
      ...customerOptions.map((option) => ({
        value: `customer:${option.value}`,
        label: `Customer: ${option.label}`,
      })),
      ...partnerOptions.map((option) => ({
        value: `partner:${option.value}`,
        label: `Partner: ${option.label}`,
      })),
    ],
    [customerOptions, partnerOptions],
  );

  const request = useCallback(
    async (ctx) => {
      if (!ctx?.filters?.customer_id && !ctx?.filters?.partner_id) {
        return { list: [], total: 0 };
      }
      const result = await listRequest(ctx);
      const list = (result?.list || []).map((row) => {
        const order = row?.transfer_order || {};
        const children = Array.isArray(order.items)
          ? order.items.map((item) => ({
              id: `item-${item.id}`,
              __isChild: true,
              transfer_order_id: row.transfer_order_id,
              order_number: row.order_number,
              item_name: item.name,
              quantity: item.quantity,
              product_name: item?.transfer_product?.name || null,
              category_name: item?.transfer_product?.category?.name || null,
              sub_category_name: item?.transfer_product?.sub_category?.name || null,
            }))
          : [];

        return {
          ...row,
          __isChild: false,
          children,
        };
      });
      return { ...result, list };
    },
    [listRequest],
  );

  const selectedRowKeys = useMemo(
    () => Object.keys(selectedRowMap),
    [selectedRowMap],
  );

  const selectedRows = useMemo(
    () => Object.values(selectedRowMap),
    [selectedRowMap],
  );

  const handleEntityFilterChange = useCallback((value) => {
    setEntityFilter(value || null);
    setSelectedRowMap({});

    if (!value) {
      tableRef.current?.setFilters?.({
        customer_id: undefined,
        partner_id: undefined,
      });
      tableRef.current?.setPage?.(1);
      return;
    }

    const [type, id] = String(value).split(":");
    tableRef.current?.setFilters?.({
      customer_id: type === "customer" ? id : undefined,
      partner_id: type === "partner" ? id : undefined,
    });
    tableRef.current?.setPage?.(1);
  }, []);

  const selectedTotal = useMemo(
    () =>
      selectedRows.reduce(
        (sum, row) => sum + Number(row?.total_transfer_order_price || 0),
        0,
      ),
    [selectedRows],
  );

  const handleCreatePaymentRequest = async () => {
    if (!entityFilter) {
      message.warning(t("selectEntity"));
      return;
    }
    const transferOrderIds = selectedRows
      .map((row) => row?.transfer_order_id)
      .filter(Boolean);
    if (!transferOrderIds.length) {
      message.warning(t("selectOrders"));
      return;
    }

    try {
      setSubmitting(true);
      const resp = await TransferOrdersAPI.createPaymentRequest({
        transfer_order_ids: transferOrderIds,
      });
      message.success(
        t("createSuccess", { group: resp?.data?.group_id || "-" }),
      );
      setSelectedRowMap({});
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          t("createError"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        title: t("columns.order"),
        dataIndex: "order_number",
        filter: { type: "text", placeholder: t("filters.orderSearch") },
        render: (value, record) => {
          if (record?.__isChild) return null;
          return value || record?.transfer_order_id || "-";
        },
      },
      {
        title: t("columns.item"),
        dataIndex: "item_name",
        render: (value, record) => {
          if (!record?.__isChild) {
            return record?.item_count ? t("itemCount", { count: record.item_count }) : "-";
          }
          return value || "-";
        },
      },
      {
        title: t("columns.product"),
        dataIndex: "product_name",
        render: (value, record) => (record?.__isChild ? value || "-" : null),
      },
      {
        title: t("columns.quantity"),
        dataIndex: "quantity",
        width: 80,
        render: (value, record) => (record?.__isChild ? value ?? "-" : null),
      },
      {
        title: t("columns.customer"),
        dataIndex: "customer_id",
        render: (_, record) => (record?.__isChild ? null : record?.customer?.name || "-"),
      },
      {
        title: t("columns.partner"),
        dataIndex: "partner_id",
        render: (_, record) => (record?.__isChild ? null : record?.partner?.name || "-"),
      },
      {
        title: t("columns.orderPrice"),
        dataIndex: "total_transfer_order_price",
        width: 140,
        render: (value, record) => (record?.__isChild ? null : formatMoney(value)),
      },
      {
        title: t("columns.shipmentPrice"),
        dataIndex: "shipment_price",
        width: 140,
        render: (value, record) => (record?.__isChild ? null : formatMoney(value)),
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        width: 120,
        render: (value, record) => {
          if (record?.__isChild) return null;
          if (!value) return "-";
          const label = tStatus(value);
          return (
            <StatusTag status={value}>
              {label.startsWith("common.status.") ? value : label}
            </StatusTag>
          );
        },
      },
      {
        title: t("columns.orderDate"),
        dataIndex: "order_date",
        sorter: true,
        filter: { type: "dateRange", placeholder: t("filters.orderDate") },
        render: (value, record) =>
          record?.__isChild
            ? null
            : value
              ? dayjs(value).format("YYYY-MM-DD HH:mm")
              : "-",
      },
      {
        title: t("columns.actions"),
        key: "actions",
        width: 100,
        render: (_, record) => {
          if (record?.__isChild) return null;
          const transferOrderId = record?.transfer_order_id;
          if (!transferOrderId) return null;
          return (
            <RowActions
              actions={[
                {
                  key: "detail",
                  iconOnly: true,
                  label: t("detail"),
                  icon: <FileSearchOutlined />,
                  href: `/dashboard/transfer-orders/orders/${encodeURIComponent(
                    transferOrderId,
                  )}`,
                },
              ]}
            />
          );
        },
      },
    ],
    [t, tStatus],
  );

  return (
    <RequireRole anyOfRoles={["companyAdmin"]}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <PageHeader
          className=""
          title={t("title")}
          extra={
            <Text type="secondary">
              {t("selectedSummary", {
                count: selectedRows.length,
                total: formatMoney(selectedTotal),
              })}
            </Text>
          }
        />

        <CrudTable
          ref={tableRef}
          rowKey="id"
          columns={columns}
          request={request}
          tableProps={{
            rowSelection: {
              selectedRowKeys,
              preserveSelectedRowKeys: true,
              getCheckboxProps: (record) => ({
                disabled: Boolean(record?.__isChild),
              }),
              onSelect: (record, selected) => {
                if (record?.__isChild) return;
                setSelectedRowMap((prev) => {
                  const next = { ...prev };
                  if (selected) {
                    next[record.id] = record;
                  } else {
                    delete next[record.id];
                  }
                  return next;
                });
              },
              onSelectAll: (selected, _selectedRows, changeRows) => {
                setSelectedRowMap((prev) => {
                  const next = { ...prev };
                  (changeRows || [])
                    .filter((row) => !row?.__isChild)
                    .forEach((row) => {
                      if (selected) {
                        next[row.id] = row;
                      } else {
                        delete next[row.id];
                      }
                    });
                  return next;
                });
              },
            },
          }}
          toolbarLeft={
            <Select
              allowClear
              showSearch
              value={entityFilter}
              placeholder={t("entityPlaceholder")}
              options={entityOptions}
              optionFilterProp="label"
              onChange={handleEntityFilterChange}
              style={{ minWidth: 320 }}
            />
          }
          toolbarRight={
            <Popconfirm
              title={t("confirmCreate")}
              okText={t("confirmOk")}
              cancelText={tCommon("cancel")}
              okButtonProps={{ type: "primary", loading: submitting }}
              disabled={!entityFilter || !selectedRows.length || submitting}
              onConfirm={handleCreatePaymentRequest}
            >
              <Button
                type="primary"
                icon={<DollarOutlined />}
                disabled={!entityFilter || !selectedRows.length}
                loading={submitting}
              >
                {t("createButton")}
              </Button>
            </Popconfirm>
          }
        />
      </Space>
    </RequireRole>
  );
}
