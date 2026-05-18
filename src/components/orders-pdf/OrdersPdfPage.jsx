"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
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
import { OrdersPdfAPI } from "@/utils/api";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";
import { useOrdersPdfDesignUploadQueue } from "./OrdersPdfDesignUploadQueueProvider";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const openUrl = (url) => {
  if (!url || typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
};

export default function OrdersPdfPage({ categoryId, subCategoryId }) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders.ordersPdf");
  const tActions = useTranslations("common.actions");
  const { enqueueUploads, tasks } = useOrdersPdfDesignUploadQueue();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [designs, setDesigns] = useState([]);
  const [designsLoading, setDesignsLoading] = useState(false);
  const latestSuccessCountRef = useRef(0);

  const fixedFilters = useMemo(
    () => ({
      ...(categoryId ? { category_id: categoryId } : {}),
      ...(categoryId ? { sub_category_id: subCategoryId || null } : {}),
    }),
    [categoryId, subCategoryId],
  );

  const scopeLabel = subCategoryId
    ? t("scope.subCategory")
    : t("scope.categoryOnly");

  const loadRows = useCallback(
    async (nextPagination = pagination) => {
      setLoading(true);
      try {
        const resp = await OrdersPdfAPI.list({
          pagination: {
            page: nextPagination.current,
            pageSize: nextPagination.pageSize,
            orderBy: [{ field: "created_at", direction: "desc" }],
          },
          filters: fixedFilters,
        });
        const normalized = normalizeListAndMeta(resp);
        setRows(normalized.list);
        setTotal(normalized.total);
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.loadFailed"),
        );
      } finally {
        setLoading(false);
      }
    },
    [fixedFilters, message, pagination, t],
  );

  const loadDesigns = useCallback(
    async (pdf) => {
      if (!pdf?.id) return;
      setDesignsLoading(true);
      try {
        const resp = await OrdersPdfAPI.designsList(pdf.id, {
          pagination: {
            page: 1,
            pageSize: 100,
            orderBy: [{ field: "created_at", direction: "desc" }],
          },
          filters: { status: "active" },
        });
        setDesigns(normalizeListAndMeta(resp).list);
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
    const successCount = tasks.filter(
      (task) => task.status === "success",
    ).length;
    if (successCount > latestSuccessCountRef.current) {
      latestSuccessCountRef.current = successCount;
      if (selectedPdf) void loadDesigns(selectedPdf);
    }
  }, [loadDesigns, selectedPdf, tasks]);

  const handleTableChange = (nextPagination) => {
    const next = {
      current: nextPagination.current || 1,
      pageSize: nextPagination.pageSize || 10,
    };
    setPagination(next);
    void loadRows(next);
  };

  const handleDeletePdf = async (row) => {
    try {
      await OrdersPdfAPI.remove(row.id);
      message.success(t("messages.deleted"));
      void loadRows();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.deleteFailed"),
      );
    }
  };

  const handleDeleteDesign = async (row) => {
    try {
      await OrdersPdfAPI.deleteDesign(row.id);
      message.success(t("messages.designDeleted"));
      if (selectedPdf) void loadDesigns(selectedPdf);
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          t("messages.designDeleteFailed"),
      );
    }
  };

  const handleUpload = (pdf, fileList) => {
    const files = fileList
      .map((item) => item.originFileObj || item)
      .filter(Boolean);
    if (!files.length) return;
    enqueueUploads({ ordersPdfId: pdf.id, pdfName: pdf.pdf_name, files });
    message.success(t("messages.uploadQueued", { count: files.length }));
  };

  const columns = [
    {
      title: t("fields.pdfName"),
      dataIndex: "pdf_name",
      render: (value, row) => (
        <Button
          type="link"
          icon={<DownloadOutlined />}
          onClick={() => openUrl(row.pdf_url)}
        >
          {value || t("empty.unnamedPdf")}
        </Button>
      ),
    },
    {
      title: t("fields.category"),
      render: (_, row) => row?.category?.name || "-",
      responsive: ["md"],
    },
    {
      title: t("fields.subCategory"),
      render: (_, row) =>
        row?.subCategory?.name || row?.sub_category?.name || "-",
      responsive: ["lg"],
    },
    {
      title: t("fields.designs"),
      render: (_, row) => (
        <Tag>{Array.isArray(row.designs) ? row.designs.length : 0}</Tag>
      ),
      width: 110,
    },
    {
      title: t("fields.status"),
      dataIndex: "status",
      render: (value) => (
        <Tag color={value === "active" ? "success" : "default"}>
          {value === "active"
            ? t("status.active")
            : value === "inactive"
              ? t("status.inactive")
              : value || "-"}
        </Tag>
      ),
      width: 120,
    },
    {
      title: t("fields.createdAt"),
      dataIndex: "created_at",
      render: formatDate,
      responsive: ["lg"],
    },
    {
      title: t("fields.actions"),
      key: "actions",
      width: 240,
      render: (_, row) => (
        <Space wrap>
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedPdf(row);
              void loadDesigns(row);
            }}
          >
            {tActions("detail")}
          </Button>
          <Upload
            multiple
            showUploadList={false}
            beforeUpload={(file, fileList) => {
              if (file?.uid === fileList?.[0]?.uid) handleUpload(row, fileList);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />}>{t("actions.addDesign")}</Button>
          </Upload>
          <Popconfirm
            title={t("confirm.deleteTitle")}
            description={t("confirm.deleteDescription")}
            onConfirm={() => handleDeletePdf(row)}
          >
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
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
          onClick={() => openUrl(row.design_url)}
        >
          {value || t("empty.unnamedDesign")}
        </Button>
      ),
    },
    {
      title: t("fields.status"),
      dataIndex: "status",
      render: (value) => (
        <Tag color={value === "active" ? "success" : "default"}>
          {value === "active"
            ? t("status.active")
            : value === "inactive"
              ? t("status.inactive")
              : value || "-"}
        </Tag>
      ),
      width: 120,
    },
    {
      title: t("fields.createdAt"),
      dataIndex: "created_at",
      render: formatDate,
      responsive: ["md"],
    },
    {
      title: t("fields.actions"),
      width: 80,
      render: (_, row) => (
        <Popconfirm
          title={t("confirm.designDeleteTitle")}
          description={t("confirm.designDeleteDescription")}
          onConfirm={() => handleDeleteDesign(row)}
        >
          <Button danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <RequireRole anyOfRoles={["companyAdmin", "companyCompletedWorker"]}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <div>
            <Space size="small" wrap style={{ marginBottom: 4 }}>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {t("title")}
              </Typography.Title>
              <Tag color={subCategoryId ? "blue" : "default"}>{scopeLabel}</Tag>
            </Space>
            <Typography.Text type="secondary">{t("subtitle")}</Typography.Text>
          </div>
          <Space wrap>
            <Typography.Text type="secondary">
              {t("summary.total", { count: total })}
            </Typography.Text>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadRows()}
              loading={loading}
            >
              {tActions("refresh")}
            </Button>
          </Space>
        </Space>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          size="middle"
          locale={{ emptyText: t("empty.pdfs") }}
          pagination={{
            ...pagination,
            total,
            showSizeChanger: true,
            showTotal: (count) => t("summary.total", { count }),
          }}
          onChange={handleTableChange}
        />
      </Space>

      <Modal
        open={Boolean(selectedPdf)}
        onCancel={() => {
          setSelectedPdf(null);
          setDesigns([]);
        }}
        footer={null}
        width={900}
        title={selectedPdf?.pdf_name || t("detailTitle")}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {selectedPdf ? (
            <Space wrap>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => openUrl(selectedPdf.pdf_url)}
              >
                {t("actions.downloadPdf")}
              </Button>
              <Upload
                multiple
                showUploadList={false}
                beforeUpload={(file, fileList) => {
                  if (file?.uid === fileList?.[0]?.uid)
                    handleUpload(selectedPdf, fileList);
                  return false;
                }}
              >
                <Button type="primary" icon={<PlusOutlined />}>
                  {t("actions.addDesign")}
                </Button>
              </Upload>
            </Space>
          ) : null}
          <Table
            rowKey="id"
            columns={designColumns}
            dataSource={designs}
            loading={designsLoading}
            size="middle"
            locale={{ emptyText: t("empty.designs") }}
            pagination={false}
          />
        </Space>
      </Modal>
    </RequireRole>
  );
}
