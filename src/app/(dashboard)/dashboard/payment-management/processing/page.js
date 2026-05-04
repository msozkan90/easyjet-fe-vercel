"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  App as AntdApp,
  Button,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { FileSearchOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useSelector } from "react-redux";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { CustomersAPI, PartnersAPI, TransferOrdersAPI } from "@/utils/api";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";

const { Title } = Typography;

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatMoney = (value) => {
  const number = Number(value ?? 0);
  return moneyFormatter.format(Number.isFinite(number) ? number : 0);
};

const listAll = async (apiFn) => {
  const resp = await apiFn({
    pagination: { page: 1, pageSize: 500 },
    filters: {},
  });
  return normalizeListAndMeta(resp).list || [];
};

export default function TransferPaymentProcessingPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.financial.transferPayments");
  const roles = useSelector((state) => state.auth.user?.roles || []);
  const isPartnerAdmin = roles.includes("partneradmin");
  const tableRef = useRef(null);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [partnerOptions, setPartnerOptions] = useState([]);
  const [entityFilter, setEntityFilter] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [customers, partners] = await Promise.all([
          listAll(CustomersAPI.list),
          isPartnerAdmin ? Promise.resolve([]) : listAll(PartnersAPI.list),
        ]);
        if (!alive) return;
        setCustomerOptions(
          customers.map((row) => ({
            value: row.id,
            label: row.name || row.id,
          })),
        );
        setPartnerOptions(
          partners.map((row) => ({ value: row.id, label: row.name || row.id })),
        );
      } catch {
        if (alive) message.error("Filter options could not be loaded");
      }
    })();
    return () => {
      alive = false;
    };
  }, [isPartnerAdmin, message]);

  const listRequest = useMemo(
    () =>
      makeListRequest(
        TransferOrdersAPI.paymentProcessingList,
        {
          defaultSort: [{ field: "updated_at", direction: "desc" }],
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

  const request = useCallback(
    async (ctx) => {
      if (!ctx?.filters?.customer_id && !ctx?.filters?.partner_id) {
        return { list: [], total: 0 };
      }
      const result = await listRequest(ctx);
      const list = (result?.list || []).map((group) => ({
        ...group,
        __rowType: "group",
        children: (group.records || []).map((record) => {
          const order = record?.transfer_order || {};
          return {
            ...record,
            id: `order-${record.id}`,
            __rowType: "order",
            children: (order.items || []).map((item) => ({
              id: `item-${item.id}`,
              __rowType: "item",
              transfer_order_id: record.transfer_order_id,
              order_number: record.order_number,
              item_name: item.name,
              quantity: item.quantity,
              product_name: item?.transfer_product?.name || null,
              category_name: item?.transfer_product?.category?.name || null,
              sub_category_name:
                item?.transfer_product?.sub_category?.name || null,
            })),
          };
        }),
      }));
      return { ...result, list };
    },
    [listRequest],
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

  const handleEntityFilterChange = useCallback((value) => {
    setEntityFilter(value || null);

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

  useEffect(() => {
    if (!isPartnerAdmin || entityFilter || customerOptions.length !== 1) return;
    const onlyCustomer = customerOptions[0];
    if (!onlyCustomer?.value) return;
    const value = `customer:${onlyCustomer.value}`;
    setEntityFilter(value);
    tableRef.current?.setFilters?.({
      customer_id: onlyCustomer.value,
      partner_id: undefined,
    });
    tableRef.current?.setPage?.(1);
  }, [customerOptions, entityFilter, isPartnerAdmin]);

  const columns = useMemo(() => {
    const priceColumns = isPartnerAdmin
      ? [
          {
            title: "Base Price",
            dataIndex: "base_transfer_order_price",
            width: 130,
            render: (value, record) =>
              record.__rowType === "item" ? null : formatMoney(value),
          },
          {
            title: "Multiplier",
            dataIndex: "product_multiplier",
            width: 110,
            render: (value, record) => {
              if (record.__rowType === "item") return null;
              if (value === null || value === undefined || value === "")
                return "-";
              return Number(value).toFixed(4);
            },
          },
          {
            title: "Customer Price",
            dataIndex: "customer_transfer_order_price",
            width: 140,
            render: (value, record) =>
              record.__rowType === "item" ? null : formatMoney(value),
          },
          {
            title: "Partner Credit",
            dataIndex: "partner_markup",
            width: 140,
            render: (value, record) =>
              record.__rowType === "item" ? null : formatMoney(value),
          },
        ]
      : [
          {
            title: "Price",
            dataIndex: "base_transfer_order_price",
            width: 130,
            render: (value, record) =>
              record.__rowType === "item" ? null : formatMoney(value),
          },
        ];

    return [
      {
        title: "Group",
        dataIndex: "group_id",
        filter: { type: "text", placeholder: "Search order/customer" },
        render: (value, record) => {
          if (record.__rowType === "item") return null;
          if (record.__rowType === "order") return record.order_number || "-";
          return value || "-";
        },
      },
      {
        title: "Item",
        dataIndex: "item_name",
        render: (value, record) => {
          if (record.__rowType === "group") {
            return `${record.transfer_order_count || 0} transfer orders`;
          }
          if (record.__rowType === "order") {
            return record?.item_count ? `${record.item_count} items` : "-";
          }
          return value || "-";
        },
      },
      {
        title: "Product",
        dataIndex: "product_name",
        render: (value, record) =>
          record.__rowType === "item" ? value || "-" : null,
      },
      {
        title: "Qty",
        dataIndex: "quantity",
        width: 80,
        render: (value, record) =>
          record.__rowType === "item" ? (value ?? "-") : null,
      },
      {
        title: "Customer",
        dataIndex: "customer_id",
        render: (_, record) =>
          record.__rowType === "item" ? null : record?.customer?.name || "-",
      },
      {
        title: "Partner",
        dataIndex: "partner_id",
        render: (_, record) =>
          record.__rowType === "item" ? null : record?.partner?.name || "-",
      },
      ...priceColumns,
      {
        title: "Shipment",
        dataIndex: "shipment_price",
        width: 120,
        render: (value, record) =>
          record.__rowType === "item" ? null : formatMoney(value),
      },
      {
        title: "Status",
        dataIndex: "status",
        width: 120,
        render: (value, record) => {
          if (record.__rowType === "item") return null;
          return value ? <Tag color="green">{value}</Tag> : "-";
        },
      },
      {
        title: "Created",
        dataIndex: "created_at",
        sorter: true,
        filter: { type: "dateRange", placeholder: "Created date" },
        render: (value, record) =>
          record.__rowType === "item"
            ? null
            : value
              ? dayjs(value).format("YYYY-MM-DD HH:mm")
              : "-",
      },
      {
        title: "Actions",
        key: "actions",
        width: 120,
        render: (_, record) => {
          if (record.__rowType === "group") return null;
          if (record.__rowType !== "order" || !record?.transfer_order_id)
            return null;
          return (
            <Tooltip title="Detail">
              <Link
                href={`/dashboard/transfer-orders/orders/${encodeURIComponent(
                  record.transfer_order_id,
                )}`}
              >
                <Button icon={<FileSearchOutlined />} />
              </Link>
            </Tooltip>
          );
        },
      },
    ];
  }, [isPartnerAdmin]);

  return (
    <RequireRole anyOfRoles={["companyAdmin", "partnerAdmin"]}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Title level={3} style={{ margin: 0 }}>
          {t("processingCompanyTitle")}
        </Title>
        <CrudTable
          ref={tableRef}
          rowKey="id"
          columns={columns}
          request={request}
          toolbarLeft={
            <Select
              allowClear
              showSearch
              value={entityFilter}
              placeholder={
                isPartnerAdmin
                  ? "Select customer"
                  : "Select customer or partner"
              }
              options={entityOptions}
              optionFilterProp="label"
              onChange={handleEntityFilterChange}
              style={{ minWidth: 320 }}
            />
          }
        />
      </Space>
    </RequireRole>
  );
}
