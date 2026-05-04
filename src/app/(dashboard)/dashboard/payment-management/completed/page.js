"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { App as AntdApp, Button, Space, Tag, Tooltip, Typography } from "antd";
import { DownloadOutlined, FileSearchOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useSelector } from "react-redux";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { TransferOrdersAPI } from "@/utils/api";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { saveBlobAsFile } from "@/utils/apiHelpers";
import { useLocaleInfo, useTranslations } from "@/i18n/use-translations";

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

export default function TransferPaymentCompletedPage() {
  const { message } = AntdApp.useApp();
  const { locale } = useLocaleInfo();
  const t = useTranslations("dashboard.financial.transferPayments");
  const roles = useSelector((state) => state.auth.user?.roles || []);
  const isPartnerAdmin = roles.includes("partneradmin");
  const tableRef = useRef(null);
  const [downloadingGroupId, setDownloadingGroupId] = useState(null);

  const listRequest = useMemo(
    () =>
      makeListRequest(
        TransferOrdersAPI.paymentCompletedList,
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

  const handleDownloadInvoice = useCallback(
    async (groupId) => {
      if (!groupId) return;
      setDownloadingGroupId(groupId);
      try {
        const { blob, filename } =
          await TransferOrdersAPI.completedPaymentReceipt({
            group_id: groupId,
            locale,
          });
        saveBlobAsFile(blob, filename);
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.receiptError"),
        );
      } finally {
        setDownloadingGroupId(null);
      }
    },
    [locale, message, t],
  );

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
          if (record.__rowType === "group" && record.group_id) {
            return record.status === "approved" ? (
              <Tooltip title={t("actions.downloadPaidInvoice")}>
                <Button
                  icon={<DownloadOutlined />}
                  loading={downloadingGroupId === record.group_id}
                  onClick={() => handleDownloadInvoice(record.group_id)}
                />
              </Tooltip>
            ) : null;
          }
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
  }, [downloadingGroupId, handleDownloadInvoice, isPartnerAdmin, t]);

  return (
    <RequireRole anyOfRoles={["companyAdmin", "partnerAdmin"]}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Title level={3} style={{ margin: 0 }}>
          {t("completedCompanyTitle")}
        </Title>
        <CrudTable
          ref={tableRef}
          rowKey="id"
          columns={columns}
          request={request}
        />
      </Space>
    </RequireRole>
  );
}
