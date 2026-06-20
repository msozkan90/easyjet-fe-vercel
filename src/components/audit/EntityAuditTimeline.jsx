"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import moment from "moment";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Empty,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import { FileSearchOutlined } from "@ant-design/icons";
import { AuditLogsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = ["success", "failed"];
const ACTION_OPTIONS = ["create", "update", "replace", "delete"];
const STATUS_COLORS = {
  success: "green",
  failed: "red",
};

function normalizeText(value, fallback = "-") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

function truncate(value, maxLength = 72) {
  const text = normalizeText(value, "");
  if (!text) return "-";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function JsonPreview({ title, value, emptyText, onCopy, copyLabel }) {
  const hasValue = value !== null && value !== undefined;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Typography.Text strong>{title}</Typography.Text>
        {hasValue ? (
          <Button size="small" onClick={onCopy}>
            {copyLabel}
          </Button>
        ) : null}
      </div>
      {hasValue ? (
        <pre className="max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          {emptyText}
        </div>
      )}
    </div>
  );
}

export default function EntityAuditTimeline({
  entityType,
  entityKey,
  visible = true,
}) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders.audit");
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [actionFilter, setActionFilter] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);

  const translateOrFallback = (key, fallback, variables) => {
    const translated = t(key, variables);
    return translated === `dashboard.orders.audit.${key}` ? fallback : translated;
  };

  const handleCopyJson = async (value) => {
    if (value === null || value === undefined) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      message.success(t("messages.copySuccess"));
    } catch {
      message.error(t("messages.copyError"));
    }
  };

  useEffect(() => {
    if (!visible || !entityKey) return undefined;

    let active = true;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const fetcher =
          entityType === "transfer_order"
            ? AuditLogsAPI.transferOrderTimeline
            : AuditLogsAPI.orderTimeline;
        const response = await fetcher(entityKey, {
          page,
          limit: PAGE_SIZE,
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(actionFilter ? { action: actionFilter } : {}),
        });

        if (!active) return;

        startTransition(() => {
          setEntries(Array.isArray(response?.data) ? response.data : []);
          setTotal(Number(response?.pagination?.total || 0));
        });
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.data?.error?.message ||
            t("messages.loadError"),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [actionFilter, entityKey, entityType, page, statusFilter, t, visible]);

  const columns = useMemo(
    () => [
      {
        title: t("columns.date"),
        dataIndex: "occurred_at",
        key: "occurred_at",
        width: 190,
        render: (value) => (value ? moment(value).format("LLL") : "-"),
      },
      {
        title: t("columns.subject"),
        dataIndex: "subject_key",
        key: "subject",
        width: 160,
        render: (_, record) => (
          <Tag color="blue">
            {translateOrFallback(
              `subjects.${record?.subject_key}`,
              record?.subject || "-",
            )}
          </Tag>
        ),
      },
      {
        title: t("columns.activity"),
        dataIndex: "title",
        key: "title",
        render: (_, record) => <Typography.Text strong>{record?.title || "-"}</Typography.Text>,
      },
      {
        title: t("detailModal.fields.summary"),
        dataIndex: "description",
        key: "description",
        render: (value) => (
          <Typography.Text>{value || "-"}</Typography.Text>
        ),
      },
      {
        title: t("columns.actor"),
        dataIndex: "actor",
        key: "actor",
        width: 220,
        render: (_, record) =>
          record?.actor?.name ||
          record?.actor?.email ||
          t("values.unknownUser"),
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (value) => (
          <Tag color={STATUS_COLORS[value] || "default"}>
            {t(`status.${value || "success"}`)}
          </Tag>
        ),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        width: 140,
        fixed: "right",
        render: (_, record) => (
          <Button
            icon={<FileSearchOutlined />}
            size="small"
            type="default"
            onClick={() => setSelectedEntry(record)}
          >
            {t("actions.viewDetail")}
          </Button>
        ),
      },
    ],
    [t],
  );

  if (!visible) return null;

  return (
    <>
      <Card
        title={t("sectionTitle")}
        extra={
          <Space wrap size={8}>
            <Select
              allowClear
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value || undefined);
                setPage(1);
              }}
              placeholder={t("filters.allStatuses")}
              options={STATUS_OPTIONS.map((value) => ({
                value,
                label: t(`status.${value}`),
              }))}
              style={{ minWidth: 160 }}
            />
            <Select
              allowClear
              value={actionFilter}
              onChange={(value) => {
                setActionFilter(value || undefined);
                setPage(1);
              }}
              placeholder={t("filters.allActions")}
              options={ACTION_OPTIONS.map((value) => ({
                value,
                label: t(`actions.${value}`),
              }))}
              style={{ minWidth: 160 }}
            />
          </Space>
        }
        className="rounded-2xl border border-slate-100 shadow-sm"
        styles={{ body: { padding: 20 } }}
      >
        <div className="mb-4 flex flex-col gap-1">
          <Typography.Text strong>{t("sectionTitle")}</Typography.Text>
          <Typography.Text type="secondary">
            {t("sectionSubtitle")}
          </Typography.Text>
        </div>

        {error ? (
          <Alert className="mb-4" type="error" showIcon message={error} />
        ) : null}

        {loading ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : !entries.length ? (
          <Empty description={t("messages.empty")} />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={entries}
            size="middle"
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total,
              onChange: (nextPage) => setPage(nextPage),
              showSizeChanger: false,
            }}
            scroll={{ x: 980 }}
            locale={{ emptyText: t("messages.empty") }}
          />
        )}
      </Card>

      <Modal
        open={Boolean(selectedEntry)}
        title={t("detailModal.title")}
        onCancel={() => setSelectedEntry(null)}
        footer={null}
        width={980}
      >
        {selectedEntry ? (
          <div className="space-y-6">
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, sm: 2, md: 2 }}
            >
              <Descriptions.Item label={t("detailModal.fields.title")}>
                {selectedEntry?.title || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.summary")}>
                {selectedEntry?.description || "-"}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.date")}>
                {selectedEntry?.occurred_at
                  ? moment(selectedEntry.occurred_at).format("LLLL")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.subject")}>
                {translateOrFallback(
                  `subjects.${selectedEntry?.subject_key}`,
                  selectedEntry?.subject || "-",
                )}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.status")}>
                <Tag color={STATUS_COLORS[selectedEntry?.status] || "default"}>
                  {t(`status.${selectedEntry?.status || "success"}`)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.action")}>
                {t(`actions.${selectedEntry?.action || "update"}`)}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.actor")}>
                {selectedEntry?.actor?.name ||
                  selectedEntry?.actor?.email ||
                  t("values.unknownUser")}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.actorEmail")}>
                {normalizeText(selectedEntry?.actor?.email)}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.company")}>
                {normalizeText(selectedEntry?.company?.name)}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.customer")}>
                {normalizeText(selectedEntry?.customer?.name)}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.partner")}>
                {normalizeText(selectedEntry?.partner?.name)}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.route")}>
                {normalizeText(selectedEntry?.route)}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.requestType")}>
                {normalizeText(selectedEntry?.request_type)}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.targetTable")}>
                {normalizeText(selectedEntry?.target_table_name)}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.ip")}>
                {normalizeText(selectedEntry?.ip_address)}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.userAgent")}>
                {truncate(selectedEntry?.user_agent, 220)}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.httpStatus")}>
                {normalizeText(selectedEntry?.status_code)}
              </Descriptions.Item>
              <Descriptions.Item label={t("detailModal.fields.duration")}>
                {selectedEntry?.duration_ms != null
                  ? `${selectedEntry.duration_ms} ms`
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item
                label={t("detailModal.fields.error")}
                span={2}
              >
                {normalizeText(selectedEntry?.error_message)}
              </Descriptions.Item>
            </Descriptions>

            {Array.isArray(selectedEntry?.metadata) && selectedEntry.metadata.length ? (
              <div className="space-y-2">
                <Typography.Text strong>
                  {t("detailModal.sections.metadata")}
                </Typography.Text>
                <div className="flex flex-wrap gap-2">
                  {selectedEntry.metadata.map((item, index) => (
                    <Tag key={`${selectedEntry?.id}-meta-${index}`}>
                      {translateOrFallback(
                        `metadata.${item?.key}`,
                        item?.key || "-",
                      )}
                      : {normalizeText(item?.value)}
                    </Tag>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <JsonPreview
                title={t("detailModal.sections.payload")}
                value={selectedEntry?.payload}
                emptyText={t("detailModal.messages.noPayload")}
                copyLabel={t("detailModal.actions.copy")}
                onCopy={() => handleCopyJson(selectedEntry?.payload)}
              />
              <JsonPreview
                title={t("detailModal.sections.response")}
                value={selectedEntry?.response}
                emptyText={t("detailModal.messages.noResponse")}
                copyLabel={t("detailModal.actions.copy")}
                onCopy={() => handleCopyJson(selectedEntry?.response)}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
