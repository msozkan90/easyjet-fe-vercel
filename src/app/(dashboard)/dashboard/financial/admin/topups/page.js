"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Button, Space, Tag, App as AntdApp, Typography } from "antd";
import Link from "next/link";
import { useDispatch } from "react-redux";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { FundingAccountsAPI, WalletTopupsAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { makeListRequest } from "@/utils/listPayload";
import { refreshWalletBalance } from "@/utils/walletBalance";
import { useTranslations } from "@/i18n/use-translations";

const { Title } = Typography;

const statusColor = {
  pending: "gold",
  approved: "green",
  rejected: "red",
  canceled: "default",
};

export default function WalletTopupsAdminListPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.financial");
  const tStatus = useTranslations("common.status");
  const dispatch = useDispatch();

  const [fundingAccounts, setFundingAccounts] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await FundingAccountsAPI.list();
        if (!alive) return;
        const list = Array.isArray(resp?.data) ? resp.data : resp?.data ?? resp;
        setFundingAccounts(Array.isArray(list) ? list : []);
      } catch {
        if (alive) {
          message.error(t("messages.loadFundingError"));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [message, t]);

  const listRequest = useMemo(
    () =>
      makeListRequest(
        WalletTopupsAPI.list,
        {
          defaultSort: [{ field: "created_at", direction: "desc" }],
        },
        normalizeListAndMeta
      ),
    []
  );

  const request = useCallback(
    async (ctx) => {
      const result = await listRequest(ctx);
      await refreshWalletBalance(dispatch);
      return result;
    },
    [dispatch, listRequest]
  );

  const fundingOptions = useMemo(
    () =>
      fundingAccounts.map((account) => ({
        value: account.id,
        label: account.display_name || account.account_identifier,
      })),
    [fundingAccounts]
  );

  const columns = useMemo(
    () => [
      { title: t("columns.id"), dataIndex: "id", width: 90 },
      {
        title: t("columns.ownerType"),
        dataIndex: "owner_type",
        width: 140,
        filter: {
          type: "select",
          placeholder: t("filters.ownerType"),
          options: [
            { value: "company", label: t("ownerTypes.company") },
            { value: "partner", label: t("ownerTypes.partner") },
            { value: "customer", label: t("ownerTypes.customer") },
          ],
        },
        render: (value) => {
          if (!value) return "-";
          const label = t(`ownerTypes.${value}`);
          return label === `ownerTypes.${value}` ? value : label;
        },
      },
      {
        title: t("columns.amount"),
        dataIndex: "amount",
        sorter: true,
      },
      {
        title: t("columns.approvedAmount"),
        dataIndex: "approved_amount",
        render: (value) => (value ?? "-"),
      },
      {
        title: t("columns.currency"),
        dataIndex: "currency",
        width: 100,
      },
      {
        title: t("columns.fundingAccount"),
        dataIndex: "funding_account_id",
        render: (_, record) =>
          record?.funding_account?.display_name ||
          record?.funding_account?.account_identifier ||
          record?.funding_account_id ||
          "-",
        filter: {
          type: "select",
          placeholder: t("filters.fundingAccount"),
          options: fundingOptions,
          width: 240,
        },
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        width: 140,
        filter: {
          type: "select",
          placeholder: t("filters.status"),
          options: [
            { value: "pending", label: tStatus("pending") },
            { value: "approved", label: tStatus("approved") },
            { value: "rejected", label: tStatus("rejected") },
            { value: "canceled", label: tStatus("canceled") },
          ],
        },
        render: (value) => (
          <Tag color={statusColor[value] || "default"}>
            {tStatus(value) || value}
          </Tag>
        ),
      },
      {
        title: t("columns.createdAt"),
        dataIndex: "created_at",
        sorter: true,
        filter: {
          type: "dateRange",
          placeholder: t("filters.createdAt"),
        },
        render: (value) => (value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-"),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        width: 160,
        render: (_, record) => (
          <Button type="link">
            <Link href={`/dashboard/financial/admin/topups/${record.id}`}>
              {t("actions.view")}
            </Link>
          </Button>
        ),
      },
    ],
    [fundingOptions, t, tStatus]
  );

  return (
    <RequireRole anyOfRoles={["systemadmin"]}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Title level={3} style={{ margin: 0 }}>
          {t("adminTopups.title")}
        </Title>
        <CrudTable rowKey="id" columns={columns} request={request} />
      </Space>
    </RequireRole>
  );
}
