"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  Descriptions,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import { OrdersDesignFlawsAPI } from "@/utils/api";
import { getBlobErrorMessage } from "@/utils/apiHelpers";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";
import { useOrdersPdfDesignUploadQueue } from "@/components/orders-pdf/OrdersPdfDesignUploadQueueProvider";
import { useDownloadQueue } from "@/components/downloads/DownloadQueueProvider";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

export default function DesignFlawRecordsPage({ categoryId, subCategoryId }) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders.designFlaws");
  const tActions = useTranslations("common.actions");
  const { enqueueUploads, tasks } = useOrdersPdfDesignUploadQueue();
  const { enqueueDownload, isDownloading } = useDownloadQueue();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [designs, setDesigns] = useState([]);
  const [designsLoading, setDesignsLoading] = useState(false);
  const handledTaskIds = useRef(new Set());

  const filters = useMemo(
    () => ({
      category_id: categoryId,
      sub_category_id: subCategoryId || null,
    }),
    [categoryId, subCategoryId],
  );

  const loadRows = useCallback(
    async (next = pagination) => {
      setLoading(true);
      try {
        const response = await OrdersDesignFlawsAPI.list({
          pagination: {
            page: next.current,
            pageSize: next.pageSize,
            orderBy: [{ field: "created_at", direction: "desc" }],
          },
          filters,
        });
        const normalized = normalizeListAndMeta(response);
        setRows(normalized.list);
        setTotal(normalized.total);
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            t("messages.recordsLoadFailed"),
        );
      } finally {
        setLoading(false);
      }
    },
    [filters, message, pagination, t],
  );

  const loadDesigns = useCallback(
    async (batch) => {
      if (!batch?.id) return;
      setDesignsLoading(true);
      try {
        const response = await OrdersDesignFlawsAPI.designsList(batch.id, {
          pagination: { page: 1, pageSize: 100 },
          filters: { status: "active" },
        });
        setDesigns(normalizeListAndMeta(response).list);
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            t("messages.designLoadFailed"),
        );
      } finally {
        setDesignsLoading(false);
      }
    },
    [message, t],
  );

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    const completed = tasks.filter(
      (task) => task.kind === "designFlaw" && task.status === "success",
    );
    if (!completed.some((task) => !handledTaskIds.current.has(task.id))) return;
    completed.forEach((task) => handledTaskIds.current.add(task.id));
    void loadRows();
    if (selectedBatch) void loadDesigns(selectedBatch);
  }, [loadDesigns, loadRows, selectedBatch, tasks]);

  const handleUpload = (batch, fileList) => {
    const files = fileList
      .map((item) => item.originFileObj || item)
      .filter(Boolean);
    if (!files.length) return;
    enqueueUploads({
      ordersDesignFlawId: batch.id,
      batchName: batch.batch_name,
      files,
    });
    message.success(t("messages.uploadQueued", { count: files.length }));
  };

  const refreshDesigns = useCallback(async () => {
    await Promise.all([
      loadRows(),
      selectedBatch ? loadDesigns(selectedBatch) : Promise.resolve(),
    ]);
  }, [loadDesigns, loadRows, selectedBatch]);

  const downloadDesign = useCallback(
    (design) => {
      enqueueDownload({
        key: `design-flaw:design:${design.id}`,
        title: design.design_name || t("empty.unnamedDesign"),
        fallbackFilename: design.design_name || "design-flaw-design",
        request: (config) =>
          OrdersDesignFlawsAPI.downloadDesign(design.id, config),
        onSuccess: refreshDesigns,
        getErrorMessage: (error) =>
          getBlobErrorMessage(error, t("messages.designDownloadFailed")),
      });
    },
    [enqueueDownload, refreshDesigns, t],
  );

  const downloadAllDesigns = useCallback(() => {
    if (!selectedBatch?.id) return;
    enqueueDownload({
      key: `design-flaw:designs:${selectedBatch.id}`,
      title: t("actions.downloadUploaded"),
      fallbackFilename: "design-flaw-designs.zip",
      request: (config) =>
        OrdersDesignFlawsAPI.downloadDesigns(selectedBatch.id, config),
      onSuccess: refreshDesigns,
      getErrorMessage: (error) =>
        getBlobErrorMessage(error, t("messages.designDownloadFailed")),
    });
  }, [enqueueDownload, refreshDesigns, selectedBatch, t]);

  const downloadSourceDesigns = useCallback(
    (batch) => {
      if (!batch?.id) return;
      enqueueDownload({
        key: `design-flaw:source-designs:${batch.id}`,
        title: t("actions.download"),
        subtitle: batch.batch_name || null,
        fallbackFilename: "design-flaw-designs.zip",
        request: (config) =>
          OrdersDesignFlawsAPI.downloadSourceDesigns(batch.id, config),
        onSuccess: () => message.success(t("messages.sourceDesignsDownloaded")),
        getErrorMessage: (error) =>
          getBlobErrorMessage(error, t("messages.downloadFailed")),
      });
    },
    [enqueueDownload, message, t],
  );

  const deleteDesign = async (design) => {
    try {
      await OrdersDesignFlawsAPI.deleteDesign(design.id);
      message.success(t("messages.designDeleted"));
      await refreshDesigns();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          t("messages.designDeleteFailed"),
      );
    }
  };

  const uploadButton = (batch, primary = false) => (
    <Upload
      multiple
      showUploadList={false}
      beforeUpload={(file, fileList) => {
        if (file?.uid === fileList?.[0]?.uid) handleUpload(batch, fileList);
        return false;
      }}
    >
      <Button type={primary ? "primary" : "default"} icon={<UploadOutlined />}>
        {t("actions.addDesign")}
      </Button>
    </Upload>
  );

  const columns = [
    { title: t("fields.batchName"), dataIndex: "batch_name" },
    {
      title: t("fields.items"),
      dataIndex: "item_count",
      width: 100,
      render: (value) => <Tag>{value || 0}</Tag>,
    },
    {
      title: t("fields.designs"),
      width: 110,
      render: (_, row) => <Tag>{row?.designs?.length || 0}</Tag>,
    },
    {
      title: t("fields.uploadStatus"),
      dataIndex: "is_downloaded",
      width: 140,
      render: (value) => (
        <Tag color={value ? "success" : "default"}>
          {value ? t("status.downloaded") : t("status.uploaded")}
        </Tag>
      ),
    },
    {
      title: t("fields.downloadedAt"),
      dataIndex: "downloaded_at",
      render: formatDate,
    },
    {
      title: t("fields.actions"),
      fixed: "right",
      width: 410,
      render: (_, row) => (
        <Space>
          <Button
            icon={<DownloadOutlined />}
            loading={isDownloading(`design-flaw:source-designs:${row.id}`)}
            disabled={!row?.source_design_ids?.length}
            onClick={() => downloadSourceDesigns(row)}
          >
            {t("actions.download")}
          </Button>
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedBatch(row);
              void loadDesigns(row);
            }}
          >
            {tActions("detail")}
          </Button>
          {uploadButton(row)}
        </Space>
      ),
    },
  ];

  const designColumns = [
    {
      title: t("fields.designName"),
      dataIndex: "design_name",
      render: (value, row) => (
        <Button
          type="link"
          icon={<DownloadOutlined />}
          loading={isDownloading(`design-flaw:design:${row.id}`)}
          onClick={() => downloadDesign(row)}
        >
          {value || t("empty.unnamedDesign")}
        </Button>
      ),
    },
    {
      title: t("fields.uploadStatus"),
      dataIndex: "design_status",
      render: (value) => (
        <Tag color={value === "downloaded" ? "success" : "processing"}>
          {value === "downloaded"
            ? t("status.downloaded")
            : t("status.uploaded")}
        </Tag>
      ),
    },
    {
      title: t("fields.createdAt"),
      dataIndex: "created_at",
      render: formatDate,
    },
    {
      title: t("fields.actions"),
      width: 120,
      render: (_, row) => (
        <Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => downloadDesign(row)}
          />
          <Popconfirm
            title={t("confirm.deleteDesign")}
            onConfirm={() => deleteDesign(row)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const itemColumns = [
    {
      title: t("fields.orderNumber"),
      render: (_, flaw) => flaw?.order_item?.order?.order_number || "-",
    },
    {
      title: t("fields.sku"),
      render: (_, flaw) =>
        flaw?.order_item?.affilated_sku || flaw?.order_item?.sku || "-",
    },
    {
      title: t("fields.missingGroups"),
      render: (_, flaw) => (
        <Space wrap size={[4, 4]}>
          {(flaw?.groups || []).map((group, index) => (
            <Tag key={group.id || group.group_key} color="volcano">
              {group.is_legacy
                ? t("groups.legacy")
                : t("groups.number", { number: index + 1 })}
              : {group.missing_quantity}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <RequireRole anyOfRoles={["companyAdmin", "companyCompletedWorker"]}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {t("records.title")}
            </Typography.Title>
            <Typography.Text type="secondary">
              {t("records.subtitle")}
            </Typography.Text>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadRows()}
            loading={loading}
          >
            {tActions("refresh")}
          </Button>
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          locale={{ emptyText: t("empty.records") }}
          pagination={{ ...pagination, total, showSizeChanger: true }}
          onChange={(next) => {
            const page = {
              current: next.current || 1,
              pageSize: next.pageSize || 10,
            };
            setPagination(page);
            void loadRows(page);
          }}
        />
      </Space>

      <Modal
        open={Boolean(selectedBatch)}
        title={selectedBatch?.batch_name || t("records.detailTitle")}
        width={960}
        footer={null}
        onCancel={() => {
          setSelectedBatch(null);
          setDesigns([]);
          void loadRows();
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Descriptions size="small" bordered column={2}>
            <Descriptions.Item label={t("fields.items")}>
              {selectedBatch?.item_count || 0}
            </Descriptions.Item>
            <Descriptions.Item label={t("fields.downloadedAt")}>
              {formatDate(selectedBatch?.downloaded_at)}
            </Descriptions.Item>
          </Descriptions>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t("fields.items")}
          </Typography.Title>
          <Table
            rowKey="id"
            columns={itemColumns}
            dataSource={selectedBatch?.item_flaws || []}
            size="small"
            pagination={false}
          />
          <Space wrap>
            {selectedBatch ? uploadButton(selectedBatch, true) : null}
            <Button
              icon={<DownloadOutlined />}
              loading={isDownloading(
                `design-flaw:source-designs:${selectedBatch?.id}`,
              )}
              disabled={!selectedBatch?.source_design_ids?.length}
              onClick={() => downloadSourceDesigns(selectedBatch)}
            >
              {t("actions.download")}
            </Button>
            <Button
              icon={<DownloadOutlined />}
              disabled={!designs.length}
              loading={isDownloading(
                `design-flaw:designs:${selectedBatch?.id}`,
              )}
              onClick={downloadAllDesigns}
            >
              {t("actions.downloadUploaded")}
            </Button>
          </Space>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t("fields.designs")}
          </Typography.Title>
          <Table
            rowKey="id"
            columns={designColumns}
            dataSource={designs}
            loading={designsLoading}
            locale={{ emptyText: t("empty.designs") }}
            pagination={false}
          />
        </Space>
      </Modal>
    </RequireRole>
  );
}
