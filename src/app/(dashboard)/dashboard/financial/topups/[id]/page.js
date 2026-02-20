"use client";

import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Button,
  Card,
  Descriptions,
  Space,
  Tag,
  Typography,
  App as AntdApp,
  Popconfirm,
} from "antd";
import { useParams } from "next/navigation";
import RequireRole from "@/components/common/Access/RequireRole";
import { WalletTopupsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const { Title, Text } = Typography;

const statusColor = {
  pending: "gold",
  approved: "green",
  rejected: "red",
  canceled: "default",
};

const formatPerson = (person, fallbackId) => {
  if (person) {
    const name = [person.first_name, person.last_name].filter(Boolean).join(" ");
    const email = person.email ? ` (${person.email})` : "";
    return `${name || person.id || "-"}${email}`;
  }
  return fallbackId || "-";
};

const resolveOwnerName = (record) => {
  if (!record) return "-";
  switch (record.owner_type) {
    case "company":
      return (
        record?.company?.name ||
        record?.company?.id ||
        record?.company_id ||
        "-"
      );
    case "partner":
      return (
        record?.partner?.name ||
        record?.partner?.id ||
        record?.partner_id ||
        "-"
      );
    case "customer":
      return (
        record?.customer?.name ||
        record?.customer?.id ||
        record?.customer_id ||
        "-"
      );
    default:
      return "-";
  }
};

export default function WalletTopupDetailPage() {
  const { message } = AntdApp.useApp();
  const params = useParams();
  const t = useTranslations("dashboard.financial");
  const tCommon = useTranslations("common.actions");
  const tStatus = useTranslations("common.status");

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await WalletTopupsAPI.getById(params.id);
      const payload = resp?.data ?? resp;
      setRecord(payload);
    } catch {
      message.error(t("messages.loadDetailError"));
    } finally {
      setLoading(false);
    }
  }, [message, params.id, t]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      await WalletTopupsAPI.cancel(params.id, {});
      message.success(t("messages.cancelSuccess"));
      fetchDetail();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.cancelError")
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <RequireRole anyOfRoles={["companyAdmin", "partnerAdmin", "customerAdmin"]}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Title level={3} style={{ margin: 0 }}>
          {t("topupDetail.title")}
        </Title>
        <Card loading={loading} className="shadow-sm">
          <Descriptions column={{ xs: 1, sm: 2, md: 2 }} bordered size="small">
            <Descriptions.Item label={t("columns.id")}>
              {record?.id || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("columns.status")}>
              <Tag color={statusColor[record?.status] || "default"}>
                {record?.status ? tStatus(record.status) : "-"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t("columns.ownerType")}>
              {record?.owner_type
                ? (() => {
                    const label = t(`ownerTypes.${record.owner_type}`);
                    return label === `ownerTypes.${record.owner_type}`
                      ? record.owner_type
                      : label;
                  })()
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("fields.owner")}>
              {resolveOwnerName(record)}
            </Descriptions.Item>
            <Descriptions.Item label={t("columns.amount")}>
              {record?.amount ?? "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("fields.approvedAmount")}>
              {record?.approved_amount ?? "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("columns.currency")}>
              {record?.currency || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("columns.fundingAccount")}>
              {record?.funding_account?.display_name ||
                record?.funding_account?.account_identifier ||
                record?.funding_account_id ||
                "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("fields.bankReference")}>
              {record?.bank_reference || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("fields.receiptUrl")}>
              {record?.receipt_url ? (
                <a href={record.receipt_url} target="_blank" rel="noreferrer">
                  {record.receipt_url}
                </a>
              ) : (
                "-"
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t("fields.note")}>
              {record?.note || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("fields.requestedBy")}>
              {formatPerson(record?.requested_by, record?.requested_by_user_id)}
            </Descriptions.Item>
            <Descriptions.Item label={t("fields.reviewedBy")}>
              {formatPerson(record?.reviewed_by, record?.reviewed_by_user_id)}
            </Descriptions.Item>
            <Descriptions.Item label={t("fields.reviewedAt")}>
              {record?.reviewed_at
                ? dayjs(record.reviewed_at).format("YYYY-MM-DD HH:mm")
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("fields.rejectReason")}>
              {record?.reject_reason || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("columns.createdAt")}>
              {record?.created_at
                ? dayjs(record.created_at).format("YYYY-MM-DD HH:mm")
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("fields.updatedAt")}>
              {record?.updated_at
                ? dayjs(record.updated_at).format("YYYY-MM-DD HH:mm")
                : "-"}
            </Descriptions.Item>
          </Descriptions>
          <Space style={{ marginTop: 16 }}>
            {record?.status === "pending" ? (
              <Popconfirm
                title={t("actions.confirmCancel")}
                okText={t("actions.confirmOk")}
                cancelText={tCommon("cancel")}
                onConfirm={handleCancel}
              >
                <Button danger loading={actionLoading}>
                  {t("actions.cancel")}
                </Button>
              </Popconfirm>
            ) : (
              <Text type="secondary">{t("messages.noActions")}</Text>
            )}
          </Space>
        </Card>
      </Space>
    </RequireRole>
  );
}
