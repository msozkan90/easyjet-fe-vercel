"use client";

import { useCallback, useMemo } from "react";
import dayjs from "dayjs";
import { Card, Space, Statistic, Tag, Typography } from "antd";
import { useDispatch, useSelector } from "react-redux";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { TransactionsAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { makeListRequest } from "@/utils/listPayload";
import { refreshWalletBalance } from "@/utils/walletBalance";
import { useTranslations } from "@/i18n/use-translations";

const { Title } = Typography;

const directionColors = {
  credit: "green",
  debit: "red",
};

const statusColors = {
  completed: "green",
  pending: "gold",
  failed: "red",
  canceled: "default",
};

export default function WalletTransactionsPage() {
  const t = useTranslations("dashboard.financial.transactions");
  const dispatch = useDispatch();
  const balance = useSelector((s) => s.balance.value);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }),
    []
  );

  const safeBalance = useMemo(() => {
    const numericBalance = Number(balance);
    return Number.isFinite(numericBalance) ? numericBalance : 0;
  }, [balance]);

  const listRequest = useMemo(
    () =>
      makeListRequest(
        TransactionsAPI.list,
        {
          defaultSort: [{ field: "created_at", direction: "desc" }],
        },
        normalizeListAndMeta
      ),
    []
  );

  const request = useCallback(
    async (ctx) => {
      const [result] = await Promise.all([
        listRequest(ctx),
        refreshWalletBalance(dispatch),
      ]);
      return result;
    },
    [dispatch, listRequest]
  );

  const columns = useMemo(
    () => [
      { title: t("columns.id"), dataIndex: "id", width: 120 },
      {
        title: t("columns.type"),
        dataIndex: "transaction_type",
        filter: {
          type: "select",
          placeholder: t("filters.type"),
          options: [
            { value: "topup", label: t("types.topup") },
            { value: "order", label: t("types.order") },
            { value: "shipment", label: t("types.shipment") },
          ],
        },
        render: (value) => {
          if (!value) return "-";
          const label = t(`types.${value}`);
          return label === `types.${value}` ? value : label;
        },
      },
      {
        title: t("columns.direction"),
        dataIndex: "direction",
        width: 120,
        filter: {
          type: "select",
          placeholder: t("filters.direction"),
          options: [
            { value: "credit", label: t("directions.credit") },
            { value: "debit", label: t("directions.debit") },
          ],
        },
        render: (value) => {
          if (!value) return "-";
          const label = t(`directions.${value}`);
          const display = label === `directions.${value}` ? value : label;
          return (
            <Tag color={directionColors[value] || "default"}>{display}</Tag>
          );
        },
      },
      {
        title: t("columns.amount"),
        dataIndex: "amount",
        sorter: true,
        render: (value) => (value ?? "-"),
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        width: 140,
        filter: {
          type: "select",
          placeholder: t("filters.status"),
          options: [
            { value: "completed", label: t("statuses.completed") },
            { value: "pending", label: t("statuses.pending") },
            { value: "failed", label: t("statuses.failed") },
            { value: "canceled", label: t("statuses.canceled") },
          ],
        },
        render: (value) => {
          if (!value) return "-";
          const label = t(`statuses.${value}`);
          const display = label === `statuses.${value}` ? value : label;
          return <Tag color={statusColors[value] || "default"}>{display}</Tag>;
        },
      },
      {
        title: t("columns.orderNumber"),
        dataIndex: "order_number",
        render: (value) => {
          if (!value) return "-";
          const detailHref = `/dashboard/order/detail/${encodeURIComponent(value)}`;
          return (
            <a href={detailHref} target="_blank" rel="noreferrer">
              {value}
            </a>
          );
        },
      },
      {
        title: t("columns.createdAt"),
        dataIndex: "created_at",
        sorter: true,
        filter: {
          type: "dateRange",
          placeholder: t("filters.createdAt"),
        },
        render: (value) =>
          value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-",
      },
    ],
    [t]
  );

  return (
    <RequireRole anyOfRoles={["companyAdmin", "partnerAdmin", "customerAdmin"]}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Title level={3} style={{ margin: 0 }}>
          {t("title")}
        </Title>
        <Card>
          <Statistic
            title={t("currentBalance")}
            value={safeBalance}
            formatter={(value) =>
              currencyFormatter.format(Number(value || 0))
            }
          />
        </Card>
        <CrudTable rowKey="id" columns={columns} request={request} />
      </Space>
    </RequireRole>
  );
}
