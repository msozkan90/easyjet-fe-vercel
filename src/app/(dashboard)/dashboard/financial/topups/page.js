"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Popconfirm,
  Upload,
  App as AntdApp,
  Typography,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useDispatch } from "react-redux";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { FundingAccountsAPI, WalletTopupsAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { makeListRequest } from "@/utils/listPayload";
import { extractUploadFileList } from "@/utils/formDataHelpers";
import { refreshWalletBalance } from "@/utils/walletBalance";
import { useTranslations } from "@/i18n/use-translations";

const { Title } = Typography;

const statusColor = {
  pending: "gold",
  approved: "green",
  rejected: "red",
  canceled: "default",
};

export default function WalletTopupsListPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.financial");
  const tCommon = useTranslations("common.actions");
  const tStatus = useTranslations("common.status");
  const tFunding = useTranslations("dashboard.fundingAccounts");
  const dispatch = useDispatch();

  const tableRef = useRef(null);
  const [form] = Form.useForm();
  const selectedFundingId = Form.useWatch("funding_account_id", form);
  const [open, setOpen] = useState(false);
  const [fundingAccounts, setFundingAccounts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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

  const normalizeUpload = useCallback((event) => {
    if (Array.isArray(event)) return event;
    return event?.fileList || [];
  }, []);

  const selectedFundingAccount = useMemo(() => {
    if (!selectedFundingId) return null;
    return fundingAccounts.find((account) => account.id === selectedFundingId);
  }, [fundingAccounts, selectedFundingId]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const fileList = extractUploadFileList(values.receipt);
      const receiptFile = fileList[0]?.originFileObj;
      const formData = new FormData();
      formData.append("amount", String(values.amount));
      formData.append("currency", values.currency);
      formData.append("funding_account_id", values.funding_account_id);
      if (values.bank_reference) {
        formData.append("bank_reference", values.bank_reference);
      }
      if (values.note) {
        formData.append("note", values.note);
      }
      if (receiptFile) {
        formData.append("receipt", receiptFile);
      }
      setSubmitting(true);
      await WalletTopupsAPI.create(formData);
      message.success(t("messages.createSuccess"));
      form.resetFields();
      setOpen(false);
      tableRef.current?.reload();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(
        error?.response?.data?.error?.message || t("messages.createError")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (record) => {
    try {
      setActionLoading(true);
      await WalletTopupsAPI.cancel(record.id, {});
      message.success(t("messages.cancelSuccess"));
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.cancelError")
      );
    } finally {
      setActionLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      { title: t("columns.id"), dataIndex: "id", width: 90 },
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
        width: 200,
        render: (_, record) => (
          <Space>
            <Button type="link">
              <Link href={`/dashboard/financial/topups/${record.id}`}>
                {t("actions.view")}
              </Link>
            </Button>
            {record.status === "pending" ? (
              <Popconfirm
                title={t("actions.confirmCancel")}
                okText={t("actions.confirmOk")}
                cancelText={tCommon("cancel")}
                onConfirm={() => handleCancel(record)}
              >
                <Button danger loading={actionLoading}>
                  {t("actions.cancel")}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ),
      },
    ],
    [fundingOptions, handleCancel, t, tCommon, tStatus, actionLoading]
  );

  return (
    <RequireRole anyOfRoles={["companyAdmin", "partnerAdmin", "customerAdmin"]}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Title level={3} style={{ margin: 0 }}>
          {t("topupList.title")}
        </Title>
        <CrudTable
          ref={tableRef}
          rowKey="id"
          columns={columns}
          request={request}
          toolbarRight={
            <Button type="primary" onClick={() => setOpen(true)}>
              {t("actions.new")}
            </Button>
          }
        />
        <Modal
          title={t("form.title")}
          open={open}
          onCancel={() => setOpen(false)}
          footer={null}
          destroyOnHidden
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{ currency: "USD" }}
            onFinish={handleCreate}
          >
            <Form.Item
              label={t("fields.fundingAccount")}
              name="funding_account_id"
              rules={[{ required: true, message: t("validation.required") }]}
            >
              <Select
                placeholder={t("placeholders.selectFundingAccount")}
                options={fundingOptions}
              />
            </Form.Item>
            {selectedFundingAccount ? (
              <Descriptions
                bordered
                size="small"
                column={1}
                style={{ marginBottom: 16 }}
              >
                <Descriptions.Item label={tFunding("columns.displayName")}>
                  {selectedFundingAccount.display_name || "-"}
                </Descriptions.Item>
                <Descriptions.Item label={tFunding("columns.accountIdentifier")}>
                  {selectedFundingAccount.account_identifier || "-"}
                </Descriptions.Item>
                <Descriptions.Item label={tFunding("columns.type")}>
                  {selectedFundingAccount.type || "-"}
                </Descriptions.Item>
              </Descriptions>
            ) : null}
            <Form.Item
              label={t("fields.amount")}
              name="amount"
              rules={[{ required: true, message: t("validation.required") }]}
            >
              <InputNumber
                min={0.01}
                step={0.01}
                style={{ width: "100%" }}
                placeholder={t("placeholders.amount")}
              />
            </Form.Item>
            <Form.Item
              label={t("fields.currency")}
              name="currency"
              rules={[{ required: true, message: t("validation.required") }]}
            >
              <Select
                placeholder={t("placeholders.currency")}
                options={[
                  { value: "USD", label: "USD" },
                  { value: "EUR", label: "EUR" },
                  { value: "GBP", label: "GBP" },
                ]}
              />
            </Form.Item>
            <Form.Item label={t("fields.bankReference")} name="bank_reference">
              <Input placeholder={t("placeholders.bankReference")} />
            </Form.Item>
            <Form.Item label={t("fields.note")} name="note">
              <Input.TextArea rows={3} placeholder={t("placeholders.note")} />
            </Form.Item>
            <Form.Item
              label={t("fields.receipt")}
              name="receipt"
              valuePropName="fileList"
              getValueFromEvent={normalizeUpload}
              rules={[{ required: true, message: t("validation.required") }]}
            >
              <Upload beforeUpload={() => false} maxCount={1}>
                <Button icon={<UploadOutlined />}>
                  {t("actions.uploadReceipt")}
                </Button>
              </Upload>
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {tCommon("save")}
              </Button>
              <Button onClick={() => form.resetFields()}>
                {tCommon("reset")}
              </Button>
            </Space>
          </Form>
        </Modal>
      </Space>
    </RequireRole>
  );
}
