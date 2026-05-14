"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import {
  App as AntdApp,
  Button,
  Dropdown,
  Modal,
  Popconfirm,
  Popover,
  Space,
  Tag,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import ProductMapperForm from "@/components/common/forms/ProductMapperForm";
import ImportResultModal from "@/components/common/Modal/ImportResultModal";
import { ProductMappersAPI } from "@/utils/api";
import { saveBlobAsFile } from "@/utils/apiHelpers";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";

const normalizeMapperNames = (value) =>
  Array.isArray(value)
    ? value.filter(Boolean)
    : value
    ? [value]
    : [];

const formatMapperTitle = (value) => normalizeMapperNames(value).join(", ");

const renderMapperNames = (value) => {
  const names = normalizeMapperNames(value);
  if (!names.length) return null;
  return (
    <Space size={[4, 4]} wrap>
      {names.map((name) => (
        <Tag key={name}>{name}</Tag>
      ))}
    </Space>
  );
};

export default function ProductMapperProductsPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.productMapper");
  const tStatus = useTranslations("common.status");
  const tableRef = useRef(null);
  const importInputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [products, setProducts] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [existingLoading, setExistingLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [listFilters, setListFilters] = useState({});

  useEffect(() => {
    let alive = true;

    const loadProducts = async () => {
      try {
        const list = await fetchGenericList("product");
        if (alive) setProducts(list || []);
      } catch {
        if (alive) {
          message.error(t("messages.loadProductsError"));
        }
      }
    };

    loadProducts();

    return () => {
      alive = false;
    };
  }, [message, t]);

  const request = makeListRequest(
    ProductMappersAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
    },
    normalizeListAndMeta
  );

  const productOptions = useMemo(
    () =>
      products
        .filter((product) => product?.id)
        .map((product) => ({
          value: product.id,
          label: product.name,
        })),
    [products]
  );

  const columns = useMemo(
    () => [
      {
        title: t("columns.product"),
        dataIndex: "product_id",
        sorter: true,
        filter: {
          type: "select",
          options: productOptions,
          placeholder: t("filters.selectProduct"),
        },
        render: (_, record) => record?.product?.name || t("common.none"),
      },
      {
        title: t("columns.mapper"),
        dataIndex: "product_mapper",
        filter: {
          type: "text",
          placeholder: t("filters.searchMapper"),
        },
        render: renderMapperNames,
      },
      {
        title: t("columns.status"),
        dataIndex: "status",
        width: 140,
        sorter: true,
        filter: {
          type: "select",
          options: [
            { value: "active", label: tStatus("active") },
            { value: "inactive", label: tStatus("inactive") },
          ],
          placeholder: t("filters.selectStatus"),
        },
        render: (value) =>
          value === "active" ? (
            <Tag color="green">{tStatus("active")}</Tag>
          ) : (
            <Tag color="red">{tStatus("inactive")}</Tag>
          ),
      },
      {
        title: t("columns.createdAt"),
        dataIndex: "created_at",
        width: 180,
        sorter: true,
        render: (value) =>
          value ? moment(value).format("LLL") : t("common.none"),
      },
      {
        title: t("columns.actions"),
        key: "actions",
        width: 110,
        fixed: "right",
        render: (_, record) => (
          <Space>
            <Popover content={t("actions.edit")}>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingRow(record);
                  setOpen(true);
                }}
              />
            </Popover>
            <Popover content={t("actions.delete")}>
              <Popconfirm
                title={t("actions.confirmDeleteTitle")}
                okText={t("actions.confirmDeleteOk")}
                okButtonProps={{ danger: true }}
                onConfirm={() => onDelete(record.id)}
              >
                <Button icon={<DeleteOutlined />} danger />
              </Popconfirm>
            </Popover>
          </Space>
        ),
      },
    ],
    [productOptions, t, tStatus]
  );

  const onSubmit = async (values) => {
    try {
      if (editingRow) {
        await ProductMappersAPI.update(editingRow.id, values);
        message.success(t("messages.updateSuccess"));
        tableRef.current?.reload();
      } else {
        await ProductMappersAPI.create(values);
        message.success(t("messages.createSuccess"));
        tableRef.current?.setPage(1);
        tableRef.current?.reload();
      }
      setOpen(false);
      setEditingRow(null);
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.operationFailed")
      );
    }
  };

  const onDelete = async (id) => {
    try {
      await ProductMappersAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.deleteError")
      );
    }
  };

  const handleExistingDownload = async (format) => {
    setExistingLoading(true);
    try {
      const { blob, filename } = await ProductMappersAPI.downloadExists({
        format,
        filters: listFilters,
      });
      saveBlobAsFile(blob, filename);
      message.success(t("messages.templateDownloadSuccess"));
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          t("messages.templateDownloadError")
      );
    } finally {
      setExistingLoading(false);
    }
  };

  const handleTemplateDownload = async (format) => {
    setTemplateLoading(true);
    try {
      const { blob, filename } = await ProductMappersAPI.downloadTemplate({
        format,
      });
      saveBlobAsFile(blob, filename);
      message.success(t("messages.templateDownloadSuccess"));
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          t("messages.templateDownloadError")
      );
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleFiltersChange = useCallback((filters) => {
    setListFilters(filters || {});
  }, []);

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx"].includes(extension)) {
      message.error(t("messages.importInvalidFile"));
      return;
    }

    setImporting(true);
    try {
      const response = await ProductMappersAPI.import(file);
      const payload = response?.data ?? response;
      const resultData = payload?.data ?? payload;
      setImportResult(resultData);
      setImportResultOpen(true);

      const failedCount = resultData?.failed ?? 0;
      if (failedCount > 0) {
        message.warning(
          t("messages.importCompletedWithErrors", { failed: failedCount })
        );
      } else {
        message.success(t("messages.importSuccess"));
      }
      tableRef.current?.reload();
    } catch (error) {
      const payload = error?.response?.data;
      const resultData = payload?.data ?? payload;
      if (resultData && typeof resultData === "object") {
        setImportResult(resultData);
        setImportResultOpen(true);
        message.warning(t("messages.importCompletedWithErrorsFallback"));
      } else {
        message.error(
          error?.response?.data?.error?.message || t("messages.importFailed")
        );
      }
    } finally {
      setImporting(false);
    }
  };

  const importModalLabels = useMemo(
    () => ({
      row: t("import.errorRow"),
      field: t("import.errorField"),
      value: t("import.errorValue"),
      message: t("import.errorMessage"),
      noErrors: t("import.noErrors"),
    }),
    [t]
  );

  const buildImportSummary = useCallback(
    (resultData) => {
      if (!resultData) return "";
      const total = resultData?.total ?? 0;
      const created = resultData?.created ?? 0;
      const updated = resultData?.updated ?? 0;
      const failed = resultData?.failed ?? 0;
      return t("import.summary", { total, created, updated, failed });
    },
    [t]
  );

  return (
    <RequireRole anyOfRoles={["customerAdmin"]}>
      <input
        ref={importInputRef}
        type="file"
        accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        style={{ display: "none" }}
        onChange={handleImportFileChange}
      />
      <CrudTable
        ref={tableRef}
        columns={columns}
        request={request}
        initialPageSize={10}
        initialFilters={{
          product_id: undefined,
          product_mapper: "",
          status: undefined,
        }}
        onFiltersChange={handleFiltersChange}
        toolbarRight={
          <Space>
            <Dropdown
              menu={{
                items: [
                  { key: "csv", label: "CSV" },
                  { key: "xlsx", label: "XLSX" },
                ],
                onClick: ({ key }) => handleExistingDownload(key),
              }}
            >
              <Button loading={existingLoading}>
                {t("actions.existsDownload")}
              </Button>
            </Dropdown>
            <Dropdown
              menu={{
                items: [
                  { key: "csv", label: "CSV" },
                  { key: "xlsx", label: "XLSX" },
                ],
                onClick: ({ key }) => handleTemplateDownload(key),
              }}
            >
              <Button loading={templateLoading}>
                {t("actions.templateDownload")}
              </Button>
            </Dropdown>
            <Button onClick={handleImportClick} loading={importing}>
              {t("actions.bulkImport")}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingRow(null);
                setOpen(true);
              }}
            >
              {t("actions.new")}
            </Button>
          </Space>
        }
        tableProps={{
          locale: { emptyText: t("table.noData") },
          scroll: { x: true },
        }}
      />

      <Modal
        title={
          editingRow
            ? t("modal.editTitle", {
                name: formatMapperTitle(editingRow?.product_mapper),
              })
            : t("modal.createTitle")
        }
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditingRow(null);
        }}
        footer={null}
        destroyOnHidden
      >
        <ProductMapperForm
          onFinish={onSubmit}
          submitText={
            editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")
          }
          products={products}
          isEdit={Boolean(editingRow)}
          initialValues={
            editingRow
              ? {
                  product_id: editingRow?.product_id ?? editingRow?.product?.id,
                  product_mapper: normalizeMapperNames(editingRow?.product_mapper),
                  status: editingRow?.status,
                }
              : undefined
          }
        />
      </Modal>
      <ImportResultModal
        open={importResultOpen}
        result={importResult}
        onClose={() => setImportResultOpen(false)}
        title={t("import.resultTitle")}
        summaryBuilder={buildImportSummary}
        labels={importModalLabels}
      />
    </RequireRole>
  );
}
