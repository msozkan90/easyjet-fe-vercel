"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { CopyOutlined, KeyOutlined, PlusOutlined, StopOutlined } from "@ant-design/icons";
import Link from "next/link";
import { useLocaleInfo } from "@/i18n/use-translations";
import { CustomerApiCredentialsAPI } from "@/utils/api";

const { Paragraph, Text, Title } = Typography;

const dataOf = (response) => response?.data ?? response ?? [];

export default function CustomerApiKeysCard() {
  const { locale } = useLocaleInfo();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(dataOf(await CustomerApiCredentialsAPI.list()));
    } catch (error) {
      message.error(error?.response?.data?.error?.message || "API keys could not be loaded");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = useMemo(
    () => rows.filter((row) => row.state === "active").length,
    [rows],
  );

  const createKey = async () => {
    const values = await form.validateFields();
    setCreating(true);
    try {
      const created = dataOf(await CustomerApiCredentialsAPI.create(values));
      setCreatedKey(created);
      setCreateOpen(false);
      form.resetFields();
      await load();
    } catch (error) {
      message.error(error?.response?.data?.error?.message || "API key could not be created");
    } finally {
      setCreating(false);
    }
  };

  const revoke = (record) => {
    Modal.confirm({
      title: "Revoke API key?",
      content: `Requests using “${record.label}” will stop working immediately.`,
      okText: "Revoke",
      okButtonProps: { danger: true },
      onOk: async () => {
        await CustomerApiCredentialsAPI.revoke(record.id);
        message.success("API key revoked");
        await load();
      },
    });
  };

  const columns = [
    { title: "Name", dataIndex: "label", key: "label" },
    { title: "Key", dataIndex: "key_prefix", key: "key_prefix", render: (value) => <Text code>{value}…</Text> },
    {
      title: "Status",
      dataIndex: "state",
      key: "state",
      render: (value) => <Tag color={value === "active" ? "green" : value === "expired" ? "orange" : "red"}>{value}</Tag>,
    },
    {
      title: "Expires",
      dataIndex: "expires_at",
      key: "expires_at",
      render: (value, record) => {
        const remainingDays = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
        const warning = record.state === "active" && remainingDays <= 30;
        return (
          <Space direction="vertical" size={0}>
            <Text>{new Date(value).toLocaleDateString()}</Text>
            {warning ? <Text type={remainingDays <= 7 ? "danger" : "warning"}>{remainingDays} days remaining</Text> : null}
          </Space>
        );
      },
    },
    { title: "Last used", dataIndex: "last_used_at", key: "last_used_at", render: (value) => value ? new Date(value).toLocaleString() : "Never" },
    {
      title: "",
      key: "actions",
      render: (_, record) => record.state === "active" ? (
        <Button danger type="text" icon={<StopOutlined />} onClick={() => revoke(record)}>Revoke</Button>
      ) : null,
    },
  ];

  return (
    <>
      <Card className="shadow-sm" style={{ marginTop: 16 }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <Title level={4} className="!mb-1"><KeyOutlined /> EasyJet Customer API</Title>
            <Paragraph type="secondary" className="!mb-0">
              Server-to-server credentials for transfer order automation. Keys expire after 180 days.
            </Paragraph>
          </div>
          <Space wrap>
            <Link href="/dashboard/settings/customer-api-docs">
              <Button>{locale === "en" ? "Integration documentation" : "Entegrasyon dokümantasyonu"}</Button>
            </Link>
            <Button type="primary" icon={<PlusOutlined />} disabled={activeCount >= 2} onClick={() => setCreateOpen(true)}>
              Create API key
            </Button>
          </Space>
        </div>
        {activeCount >= 2 ? <Alert className="mb-4" type="info" showIcon message="Revoke an active key before creating another." /> : null}
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={false} scroll={{ x: 760 }} />
      </Card>

      <Modal title="Create API key" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={createKey} confirmLoading={creating} okText="Create">
        <Alert className="mb-4" type="warning" showIcon message="The secret will be shown only once." />
        <Form form={form} layout="vertical">
          <Form.Item name="label" label="Key name" rules={[{ required: true }, { max: 120 }]}>
            <Input autoComplete="off" placeholder="Production integration" />
          </Form.Item>
          <Form.Item name="current_password" label="Current password" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Copy your API key now" open={Boolean(createdKey)} closable={false} footer={[
        <Button key="done" type="primary" onClick={() => setCreatedKey(null)}>I have saved it</Button>,
      ]}>
        <Alert className="mb-4" type="error" showIcon message="This key cannot be displayed again." />
        <Space.Compact block>
          <Input readOnly value={createdKey?.api_key || ""} />
          <Button icon={<CopyOutlined />} onClick={async () => {
            await navigator.clipboard.writeText(createdKey?.api_key || "");
            message.success("API key copied");
          }}>Copy</Button>
        </Space.Compact>
      </Modal>
    </>
  );
}
