"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Checkbox,
  Drawer,
  Form,
  Input,
  Modal,
  Segmented,
  Table,
  Tooltip,
} from "antd";
import {
  ApiOutlined,
  DeleteOutlined,
  HistoryOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SendOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import RowActions from "@/components/ui/RowActions";
import StatusTag from "@/components/ui/StatusTag";
import { DateTimeCell } from "@/components/ui/TableCells";
import { EmptyState } from "@/components/ui/StateView";
import { useTranslations } from "@/i18n/use-translations";
import { ApiKeysAPI } from "@/utils/api";
import ApiKeySecretModal from "./ApiKeySecretModal";

const EVENTS = [
  "order.status_changed",
  "order.shipped",
  "shipment.label_created",
  "design_import.completed",
  "design_import.failed",
];
const DELIVERY_TONES = {
  succeeded: "success",
  pending: "waiting",
  failed: "danger",
};

const errorMessage = (error, fallback) =>
  error?.response?.data?.error?.message || fallback;

function DeliveriesDrawer({ endpoint, environment, onClose }) {
  const t = useTranslations("dashboard.settings.apiKeys.webhooks");
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    try {
      const resp = await ApiKeysAPI.webhooks.deliveries(
        environment,
        endpoint.id,
      );
      setRows(Array.isArray(resp?.data) ? resp.data : []);
    } catch (error) {
      message.error(errorMessage(error, t("messages.loadError")));
    } finally {
      setLoading(false);
    }
  }, [endpoint, environment, message, t]);

  useEffect(() => {
    setRows([]);
    load();
  }, [load]);

  const retry = async (row) => {
    try {
      await ApiKeysAPI.webhooks.retry(environment, endpoint.id, row.id);
      message.success(t("messages.retryQueued"));
      load();
    } catch (error) {
      message.error(errorMessage(error, t("messages.actionError")));
    }
  };

  return (
    <Drawer
      open={Boolean(endpoint)}
      onClose={onClose}
      width="min(960px, 100vw)"
      title={t("deliveries.title")}
      extra={
        <Button
          icon={<SyncOutlined />}
          onClick={load}
          loading={loading}
          aria-label={t("actions.refresh")}
        />
      }
      destroyOnHidden
    >
      <p className="mt-0 break-all text-[13px] text-text-secondary">
        {endpoint?.url}
      </p>
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={rows}
        pagination={false}
        scroll={{ x: true }}
        locale={{ emptyText: t("deliveries.empty") }}
        columns={[
          {
            title: t("deliveries.event"),
            dataIndex: "event_type",
            render: (value) => <span className="ej-mono text-xs">{value}</span>,
          },
          {
            title: t("fields.status"),
            dataIndex: "status",
            render: (status) => (
              <StatusTag tone={DELIVERY_TONES[status]} size="small">
                {t(`deliveries.status.${status}`)}
              </StatusTag>
            ),
          },
          { title: t("deliveries.attempts"), dataIndex: "attempts" },
          {
            title: t("deliveries.response"),
            dataIndex: "response_status",
            render: (value) => value ?? "-",
          },
          {
            title: t("deliveries.error"),
            dataIndex: "error",
            render: (value) =>
              value ? (
                <Tooltip title={value}>
                  <span className="block max-w-[220px] truncate text-xs text-[var(--ej-danger)]">
                    {value}
                  </span>
                </Tooltip>
              ) : (
                "-"
              ),
          },
          {
            title: t("deliveries.createdAt"),
            dataIndex: "created_at",
            render: (value) => <DateTimeCell value={value} />,
          },
          {
            key: "actions",
            width: 56,
            render: (_, row) =>
              row.status === "succeeded" ? null : (
                <RowActions
                  actions={[
                    {
                      key: "retry",
                      iconOnly: true,
                      icon: <SendOutlined />,
                      label: t("actions.retry"),
                      onClick: () => retry(row),
                    },
                  ]}
                />
              ),
          },
        ]}
      />
    </Drawer>
  );
}

function CreateWebhookModal({ open, environment, onClose, onCreated }) {
  const t = useTranslations("dashboard.settings.apiKeys.webhooks");
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ events: EVENTS });
  }, [form, open]);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const resp = await ApiKeysAPI.webhooks.create(environment, {
        url: values.url.trim(),
        events: values.events,
        description: values.description?.trim() || null,
      });
      onCreated?.(resp?.data);
    } catch (error) {
      message.error(errorMessage(error, t("messages.createError")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t("create.title")}
      okText={t("create.submit")}
      onOk={submit}
      onCancel={onClose}
      confirmLoading={saving}
      destroyOnHidden
      width={600}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        className="mt-2"
      >
        <Form.Item
          name="url"
          label={t("fields.url")}
          extra={t("create.urlHelp")}
          rules={[
            { required: true, whitespace: true },
            { pattern: /^https:\/\//i, message: t("create.httpsOnly") },
          ]}
        >
          <Input
            placeholder="https://erp.example.com/easyjet/webhooks"
            maxLength={2048}
          />
        </Form.Item>
        <Form.Item name="description" label={t("fields.description")}>
          <Input
            maxLength={200}
            placeholder={t("create.descriptionPlaceholder")}
          />
        </Form.Item>
        <Form.Item
          name="events"
          label={t("fields.events")}
          rules={[
            {
              required: true,
              type: "array",
              min: 1,
              message: t("create.eventsRequired"),
            },
          ]}
        >
          <Checkbox.Group className="flex flex-col gap-2">
            {EVENTS.map((event) => (
              <Checkbox key={event} value={event}>
                <span className="flex flex-col">
                  <span className="ej-mono text-[13px]">{event}</span>
                  <span className="text-xs text-text-secondary">
                    {t(`events.${event.replace(".", "_")}`)}
                  </span>
                </span>
              </Checkbox>
            ))}
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function WebhooksCard({ access }) {
  const t = useTranslations("dashboard.settings.apiKeys.webhooks");
  const { message } = AntdApp.useApp();
  const [environment, setEnvironment] = useState("test");
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState(null);
  const [deliveriesOf, setDeliveriesOf] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await ApiKeysAPI.webhooks.list(environment);
      setEndpoints(Array.isArray(resp?.data) ? resp.data : []);
    } catch (error) {
      message.error(errorMessage(error, t("messages.loadError")));
    } finally {
      setLoading(false);
    }
  }, [environment, message, t]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action, successKey) => {
    try {
      const result = await action();
      if (successKey) message.success(t(successKey));
      load();
      return result;
    } catch (error) {
      message.error(errorMessage(error, t("messages.actionError")));
      return null;
    }
  };

  const columns = useMemo(
    () => [
      {
        title: t("fields.url"),
        dataIndex: "url",
        render: (url, row) => (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="ej-mono break-all text-[12.5px] text-text">
              {url}
            </span>
            {row.description ? (
              <span className="text-xs text-text-secondary">
                {row.description}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        title: t("fields.events"),
        dataIndex: "events",
        render: (events = []) => (
          <span className="flex max-w-[260px] flex-wrap gap-1">
            {events.map((event) => (
              <span
                key={event}
                className="ej-mono rounded border border-line px-1.5 text-[11px] leading-5 text-text-secondary"
              >
                {event}
              </span>
            ))}
          </span>
        ),
      },
      {
        title: t("fields.status"),
        dataIndex: "enabled",
        render: (enabled, row) => (
          <Tooltip title={row.disabled_reason}>
            <span>
              <StatusTag tone={enabled ? "success" : "neutral"} size="small">
                {enabled ? t("status.enabled") : t("status.disabled")}
              </StatusTag>
            </span>
          </Tooltip>
        ),
      },
      {
        title: t("fields.lastDelivery"),
        key: "last",
        render: (_, row) => {
          const success = row.last_success_at
            ? new Date(row.last_success_at)
            : null;
          const failure = row.last_failure_at
            ? new Date(row.last_failure_at)
            : null;
          if (!success && !failure)
            return <span className="text-text-secondary">-</span>;
          const failed = failure && (!success || failure > success);
          return (
            <span className="flex flex-col gap-1">
              <StatusTag tone={failed ? "danger" : "success"} size="small">
                {failed
                  ? t("deliveries.status.failed")
                  : t("deliveries.status.succeeded")}
              </StatusTag>
              <DateTimeCell
                value={failed ? row.last_failure_at : row.last_success_at}
              />
            </span>
          );
        },
      },
      {
        title: t("fields.actions"),
        key: "actions",
        width: 112,
        render: (_, row) => (
          <RowActions
            actions={[
              {
                key: "test",
                iconOnly: true,
                icon: <SendOutlined />,
                label: t("actions.test"),
                disabled: !row.enabled,
                onClick: () =>
                  run(
                    () => ApiKeysAPI.webhooks.test(environment, row.id),
                    "messages.testQueued",
                  ),
              },
              {
                key: "deliveries",
                iconOnly: true,
                icon: <HistoryOutlined />,
                label: t("actions.deliveries"),
                onClick: () => setDeliveriesOf(row),
              },
            ]}
            menuItems={[
              {
                key: "toggle",
                icon: row.enabled ? (
                  <PauseCircleOutlined />
                ) : (
                  <PlayCircleOutlined />
                ),
                label: row.enabled ? t("actions.disable") : t("actions.enable"),
                onClick: () =>
                  run(
                    () =>
                      ApiKeysAPI.webhooks.update(environment, row.id, {
                        enabled: !row.enabled,
                      }),
                    "messages.updated",
                  ),
              },
              {
                key: "rotate",
                icon: <SyncOutlined />,
                label: t("actions.rotate"),
                confirm: {
                  title: t("confirm.rotateTitle"),
                  description: t("confirm.rotateDescription"),
                  okText: t("actions.rotate"),
                },
                onClick: async () => {
                  const resp = await run(() =>
                    ApiKeysAPI.webhooks.rotate(environment, row.id),
                  );
                  if (resp?.data?.secret)
                    setSecret({
                      apiKey: resp.data.secret,
                      rotated: true,
                      kind: "webhook",
                    });
                },
              },
              { type: "divider" },
              {
                key: "delete",
                danger: true,
                icon: <DeleteOutlined />,
                label: t("actions.delete"),
                confirm: {
                  title: t("confirm.deleteTitle"),
                  description: t("confirm.deleteDescription"),
                  okText: t("actions.delete"),
                },
                onClick: () =>
                  run(
                    () => ApiKeysAPI.webhooks.remove(environment, row.id),
                    "messages.deleted",
                  ),
              },
            ]}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [environment, t],
  );

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="m-0 text-base font-semibold text-text">
            {t("title")}
          </h2>
          <p className="m-0 max-w-[640px] text-[13px] text-text-secondary">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={environment}
            onChange={setEnvironment}
            options={[
              { value: "test", label: t("environment.test") },
              {
                value: "live",
                label: t("environment.live"),
                disabled: !access?.live_enabled,
              },
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            {t("actions.create")}
          </Button>
        </div>
      </header>

      {environment === "test" ? (
        <Alert type="info" showIcon message={t("testNote")} />
      ) : null}

      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={endpoints}
        pagination={false}
        scroll={{ x: true }}
        locale={{
          emptyText: (
            <EmptyState compact icon={<ApiOutlined />} title={t("empty")} />
          ),
        }}
      />

      <CreateWebhookModal
        open={createOpen}
        environment={environment}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          setCreateOpen(false);
          if (created?.secret)
            setSecret({ apiKey: created.secret, kind: "webhook" });
          load();
        }}
      />
      <ApiKeySecretModal secret={secret} onClose={() => setSecret(null)} />
      <DeliveriesDrawer
        endpoint={deliveriesOf}
        environment={environment}
        onClose={() => setDeliveriesOf(null)}
      />
    </section>
  );
}
