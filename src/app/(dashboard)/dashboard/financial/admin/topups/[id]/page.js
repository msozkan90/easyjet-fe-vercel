"use client";

import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Space,
  App as AntdApp,
} from "antd";
import { useParams } from "next/navigation";
import { useDispatch } from "react-redux";
import RequireRole from "@/components/common/Access/RequireRole";
import { WalletTopupsAPI } from "@/utils/api";
import { refreshWalletBalance } from "@/utils/walletBalance";
import { useTranslations } from "@/i18n/use-translations";
import PageHeader from "@/components/ui/PageHeader";
import StatusTag from "@/components/ui/StatusTag";
import MoneyText from "@/components/ui/MoneyText";


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

export default function WalletTopupAdminDetailPage() {
  const { message, modal } = AntdApp.useApp();
  const params = useParams();
  const t = useTranslations("dashboard.financial");
  const tStatus = useTranslations("common.status");
  const tCommon = useTranslations("common.actions");
  const dispatch = useDispatch();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await WalletTopupsAPI.getById(params.id);
      const payload = resp?.data ?? resp;
      setRecord(payload);
      approveForm.setFieldsValue({
        approved_amount: payload?.amount,
      });
    } catch {
      message.error(t("messages.loadDetailError"));
    } finally {
      setLoading(false);
    }
  }, [approveForm, message, params.id, t]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleApprove = async () => {
    let values;
    try {
      values = await approveForm.validateFields();
    } catch {
      return;
    }
    modal.confirm({
      title: t("actions.confirmApproveTitle"),
      content: t("actions.confirmApproveBody"),
      okText: t("actions.approve"),
      cancelText: tCommon("cancel"),
      onOk: () => submitApprove(values),
    });
  };

  const submitApprove = async (values) => {
    try {
      setActionLoading(true);
      await WalletTopupsAPI.approve(params.id, {
        approved_amount: values.approved_amount || undefined,
      });
      await refreshWalletBalance(dispatch);
      message.success(t("messages.approveSuccess"));
      fetchDetail();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(
        error?.response?.data?.error?.message || t("messages.actionError")
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    let values;
    try {
      values = await rejectForm.validateFields();
    } catch {
      return;
    }
    modal.confirm({
      title: t("actions.confirmRejectTitle"),
      content: t("actions.confirmRejectBody"),
      okText: t("actions.reject"),
      okButtonProps: { danger: true },
      cancelText: tCommon("cancel"),
      onOk: () => submitReject(values),
    });
  };

  const submitReject = async (values) => {
    try {
      setActionLoading(true);
      await WalletTopupsAPI.reject(params.id, {
        reject_reason: values.reject_reason,
      });
      message.success(t("messages.rejectSuccess"));
      fetchDetail();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(
        error?.response?.data?.error?.message || t("messages.actionError")
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <RequireRole anyOfRoles={["systemadmin"]}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <PageHeader
          className=""
          breadcrumb={[
            {
              title: t("adminTopups.title"),
              href: "/dashboard/financial/admin/topups",
            },
            { title: t("topupDetail.adminTitle") },
          ]}
          title={t("topupDetail.adminTitle")}
        />
        <Card loading={loading} className="">
          <Descriptions column={{ xs: 1, sm: 2, md: 2 }} bordered size="small">
            <Descriptions.Item label={t("columns.id")}>
              {record?.id || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("columns.status")}>
              <StatusTag status={record?.status}>
                {record?.status ? tStatus(record.status) : "-"}
              </StatusTag>
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
              <MoneyText value={record?.amount} currency={record?.currency} />
            </Descriptions.Item>
            <Descriptions.Item label={t("fields.approvedAmount")}>
              <MoneyText value={record?.approved_amount} currency={record?.currency} />
            </Descriptions.Item>
            <Descriptions.Item label={t("columns.currency")}>
              {record?.currency || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={t("columns.fundingAccount")}>
              {record?.funding_account?.display_name ||
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
        </Card>
        {record?.status === "pending" ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card className="" title={t("actions.approveTitle")}>
              <Form form={approveForm} layout="vertical">
                <Form.Item
                  label={t("actions.approvedAmount")}
                  name="approved_amount"
                >
                  <InputNumber min={0.01} step={0.01} style={{ width: "100%" }} />
                </Form.Item>
                <Button
                  type="primary"
                  onClick={handleApprove}
                  loading={actionLoading}
                >
                  {t("actions.approve")}
                </Button>
              </Form>
            </Card>
            <Card className="" title={t("actions.rejectTitle")}>
              <Form form={rejectForm} layout="vertical">
                <Form.Item
                  label={t("actions.rejectReason")}
                  name="reject_reason"
                  rules={[{ required: true, message: t("validation.required") }]}
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Button
                  danger
                  onClick={handleReject}
                  loading={actionLoading}
                >
                  {t("actions.reject")}
                </Button>
              </Form>
            </Card>
          </Space>
        ) : null}
      </Space>
    </RequireRole>
  );
}
