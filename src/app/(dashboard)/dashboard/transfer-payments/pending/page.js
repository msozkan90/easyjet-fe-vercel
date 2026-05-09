"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  App as AntdApp,
  Button,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  DownloadOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useDispatch } from "react-redux";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { TransferOrdersAPI, WalletAPI } from "@/utils/api";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { saveBlobAsFile } from "@/utils/apiHelpers";
import { useLocaleInfo, useTranslations } from "@/i18n/use-translations";
import { setBalance } from "@/redux/features/balanceSlice";

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

export default function CustomerTransferPaymentProcessingPage({
  status = "processing",
}) {
  const { message } = AntdApp.useApp();
  const dispatch = useDispatch();
  const { locale } = useLocaleInfo();
  const t = useTranslations("dashboard.financial.transferPayments");
  const isCompleted = status === "completed";
  const tableRef = useRef(null);
  const [downloadingGroupId, setDownloadingGroupId] = useState(null);
  const [selectedPaymentGroup, setSelectedPaymentGroup] = useState(null);
  const [completingGroupId, setCompletingGroupId] = useState(null);

  const listRequest = useMemo(
    () =>
      makeListRequest(
        isCompleted
          ? TransferOrdersAPI.customerPaymentCompletedList
          : TransferOrdersAPI.customerPaymentProcessingList,
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
    [isCompleted],
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

  const handleDownloadReceipt = useCallback(
    async (groupId) => {
      if (!groupId) return;
      setDownloadingGroupId(groupId);
      try {
        const { blob, filename } =
          await TransferOrdersAPI.customerPaymentReceipt({
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

  const handleCompletePayment = useCallback(async () => {
    const groupId = selectedPaymentGroup?.group_id;
    if (!groupId) return;
    setCompletingGroupId(groupId);
    try {
      if (isCompleted) return;
      await TransferOrdersAPI.completeCustomerPayment({ group_id: groupId });
      try {
        const walletResp = await WalletAPI.getBalance();
        const nextBalance = walletResp?.data?.balance ?? walletResp?.balance;
        if (nextBalance !== null && nextBalance !== undefined) {
          dispatch(setBalance(nextBalance));
        }
      } catch {
        // Balance refresh is best-effort; the payment completion already succeeded.
      }
      message.success(t("messages.completeSuccess"));
      setSelectedPaymentGroup(null);
      tableRef.current?.reload?.();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.completeError"),
      );
    } finally {
      setCompletingGroupId(null);
    }
  }, [dispatch, isCompleted, message, selectedPaymentGroup, t]);

  const selectedSummaryRows = useMemo(
    () =>
      (selectedPaymentGroup?.records || []).map((record) => ({
        id: record.id,
        order_number: record.order_number || "-",
        item_count: record.item_count || 0,
        order_price: Number(record.total_transfer_order_price || 0),
        shipment_price: Number(record.shipment_price || 0),
        total:
          Number(record.total_transfer_order_price || 0) +
          Number(record.shipment_price || 0),
      })),
    [selectedPaymentGroup],
  );

  const selectedSummaryTotal = useMemo(
    () => selectedSummaryRows.reduce((total, row) => total + row.total, 0),
    [selectedSummaryRows],
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
              <Space size={8}>
                <Tooltip
                  title={
                    isCompleted
                      ? t("actions.downloadPaidInvoice")
                      : t("actions.downloadReceipt")
                  }
                >
                  <Button
                    icon={<DownloadOutlined />}
                    loading={downloadingGroupId === record.group_id}
                    onClick={() => handleDownloadReceipt(record.group_id)}
                  />
                </Tooltip>
                {!isCompleted ? (
                  <Tooltip title={t("actions.completePayment")}>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => setSelectedPaymentGroup(record)}
                    />
                  </Tooltip>
                ) : null}
              </Space>
            );
          }
          if (record.__rowType !== "order" || !record.transfer_order_id)
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
    ],
    [downloadingGroupId, handleDownloadReceipt, isCompleted, t],
  );

  return (
    <RequireRole anyOfRoles={["customerAdmin"]}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Title level={3} style={{ margin: 0 }}>
          {isCompleted ? t("completedTitle") : t("title")}
        </Title>
        <CrudTable
          ref={tableRef}
          rowKey="id"
          columns={columns}
          request={request}
        />
        {!isCompleted ? (
          <Modal
            title={t("summary.title")}
            open={!!selectedPaymentGroup}
            okText={t("summary.confirm")}
            cancelText={t("summary.cancel")}
            confirmLoading={
              completingGroupId === selectedPaymentGroup?.group_id
            }
            onOk={handleCompletePayment}
            onCancel={() => setSelectedPaymentGroup(null)}
            width={760}
          >
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Typography.Text type="secondary">
                {t("summary.group")}: {shortId(selectedPaymentGroup?.group_id)}
              </Typography.Text>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={selectedSummaryRows}
                columns={[
                  {
                    title: t("summary.transferOrder"),
                    dataIndex: "order_number",
                  },
                  {
                    title: t("summary.items"),
                    dataIndex: "item_count",
                    width: 80,
                  },
                  {
                    title: t("summary.order"),
                    dataIndex: "order_price",
                    width: 120,
                    render: formatMoney,
                  },
                  {
                    title: t("summary.shipment"),
                    dataIndex: "shipment_price",
                    width: 120,
                    render: formatMoney,
                  },
                  {
                    title: t("summary.total"),
                    dataIndex: "total",
                    width: 120,
                    render: formatMoney,
                  },
                ]}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <Typography.Text strong>
                        {t("summary.total")}
                      </Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>
                      <Typography.Text strong>
                        {formatMoney(selectedSummaryTotal)}
                      </Typography.Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </Space>
          </Modal>
        ) : null}
      </Space>
    </RequireRole>
  );
}
