"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { App as AntdApp, Button, Space, Tag, Tooltip, Typography } from "antd";
import { DownloadOutlined, FileSearchOutlined } from "@ant-design/icons";
import Link from "next/link";
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

const shortId = (value) => {
  if (!value) return "-";
  const text = String(value);
  return text.length > 12 ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
};

export default function CustomerTransferPaymentProcessingPage() {
  const { message } = AntdApp.useApp();
  const { locale } = useLocaleInfo();
  const t = useTranslations("dashboard.financial.transferPayments");
  const tableRef = useRef(null);
  const [downloadingGroupId, setDownloadingGroupId] = useState(null);

  const listRequest = useMemo(
    () =>
      makeListRequest(
        TransferOrdersAPI.customerPaymentProcessingList,
        {
          defaultSort: [{ field: "created_at", direction: "desc" }],
          filterTransform: (filters = {}) => {
            const next = { ...filters };
            const orderDate = next.created_at;
            if (orderDate?.gte || orderDate?.lte) {
              next.date_from = orderDate.gte;
              next.date_to = orderDate.lte;
            }
            delete next.created_at;
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
              item_name: item.name,
              quantity: item.quantity,
              product_name: item?.transfer_product?.name || null,
              sub_category_name: item?.transfer_product?.sub_category?.name || null,
            })),
          };
        }),
      }));
      return { ...result, list };
    },
    [listRequest],
  );

  const handleDownloadReceipt = useCallback(
    async (groupId) => {
      if (!groupId) return;
      setDownloadingGroupId(groupId);
      try {
        const { blob, filename } = await TransferOrdersAPI.customerPaymentReceipt({
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

  const columns = useMemo(
    () => [
      {
        title: "Group",
        dataIndex: "group_id",
        width: 150,
        render: (value, record) => {
          if (record.__rowType === "item") return null;
          if (record.__rowType === "order") return record.order_number || "-";
          return shortId(value) || "-";
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
            return `${record.item_count || 0} items`;
          }
          return value || "-";
        },
      },
      {
        title: "Product",
        dataIndex: "product_name",
        render: (value, record) => (record.__rowType === "item" ? value || "-" : null),
      },
      {
        title: "Qty",
        dataIndex: "quantity",
        width: 80,
        render: (value, record) => (record.__rowType === "item" ? value ?? "-" : null),
      },
      {
        title: "Company",
        dataIndex: "company",
        render: (_, record) =>
          record.__rowType === "item" ? null : record?.company?.name || "-",
      },
      {
        title: "Partner",
        dataIndex: "partner",
        render: (_, record) =>
          record.__rowType === "item" ? null : record?.partner?.name || "-",
      },
      {
        title: "Order Price",
        dataIndex: "total_transfer_order_price",
        width: 140,
        render: (value, record) => {
          if (record.__rowType === "item") return null;
          if (record.__rowType === "group") return formatMoney(value);
          return formatMoney(record.total_transfer_order_price);
        },
      },
      {
        title: "Shipment Price",
        dataIndex: "total_shipment_price",
        width: 150,
        render: (value, record) => {
          if (record.__rowType === "item") return null;
          if (record.__rowType === "group") return formatMoney(value);
          return formatMoney(record.shipment_price);
        },
      },
      {
        title: "Status",
        dataIndex: "status",
        width: 120,
        render: (value, record) => {
          if (record.__rowType === "item") return null;
          return value ? <Tag color="gold">{value}</Tag> : "-";
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
        width: 140,
        render: (_, record) => {
          if (record.__rowType === "group" && record.group_id) {
            return (
              <Tooltip title={t("actions.downloadReceipt")}>
                <Button
                  icon={<DownloadOutlined />}
                  loading={downloadingGroupId === record.group_id}
                  onClick={() => handleDownloadReceipt(record.group_id)}
                />
              </Tooltip>
            );
          }
          if (record.__rowType !== "order" || !record.transfer_order_id) return null;
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
    ],
    [downloadingGroupId, handleDownloadReceipt, t],
  );

  return (
    <RequireRole anyOfRoles={["customerAdmin"]}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Title level={3} style={{ margin: 0 }}>
          {t("title")}
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
