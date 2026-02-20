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
import ProductStockForm from "@/components/common/forms/ProductStockForm";
import ImportResultModal from "@/components/common/Modal/ImportResultModal";
import { ProductStockAPI } from "@/utils/api";
import { saveBlobAsFile } from "@/utils/apiHelpers";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";

export default function ProductStockPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.productStock");
  const tStatus = useTranslations("common.status");
  const tableRef = useRef(null);
  const importInputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [products, setProducts] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [listFilters, setListFilters] = useState({});

  useEffect(() => {
    let alive = true;

    const loadProducts = async () => {
      try {
        const list = await fetchGenericList("product");
        if (alive) {
          setProducts(Array.isArray(list) ? list : []);
        }
      } catch {
        if (alive) {
          message.error(t("messages.loadProductsError"));
        }
      }
    };

    const loadSizes = async () => {
      try {
        const list = await fetchGenericList("product_size");
        if (alive) {
          setSizes(Array.isArray(list) ? list : []);
        }
      } catch {
        if (alive) {
          message.error(t("messages.loadSizesError"));
        }
      }
    };

    const loadColors = async () => {
      try {
        const list = await fetchGenericList("product_color");
        if (alive) {
          setColors(Array.isArray(list) ? list : []);
        }
      } catch {
        if (alive) {
          message.error(t("messages.loadColorsError"));
        }
      }
    };

    loadProducts();
    loadSizes();
    loadColors();

    return () => {
      alive = false;
    };
  }, [message, t]);

  const request = makeListRequest(
    ProductStockAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
    },
    normalizeListAndMeta
  );

  const columns = useMemo(
    () => [
      {
        title: t("columns.product"),
        dataIndex: "product_id",
        sorter: true,
        filter: {
          type: "select",
          options: products.map((product) => ({
            value: product.id,
            label: product.name,
          })),
          placeholder: t("filters.selectProduct"),
        },
        render: (_, record) => record?.product?.name || t("common.none"),
      },
      {
        title: t("columns.size"),
        dataIndex: "size_id",
        sorter: true,
        filter: {
          type: "select",
          options: sizes.map((size) => ({
            value: size.id,
            label: size.name,
          })),
          placeholder: t("filters.selectSize"),
        },
        render: (_, record) => record?.size?.name || t("common.none"),
      },
      {
        title: t("columns.color"),
        dataIndex: "color_id",
        sorter: true,
        filter: {
          type: "select",
          options: colors.map((color) => ({
            value: color.id,
            label: color.name,
          })),
          placeholder: t("filters.selectColor"),
        },
        render: (_, record) => record?.color?.name || t("common.none"),
      },
      {
        title: t("columns.quantity"),
        dataIndex: "quantity",
        sorter: true,
        render: (value) =>
          value !== null && value !== undefined ? value : t("common.none"),
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
        fixed: "right",
        width: 200,
        render: (_, record) => (
          <Space>
            <Popover content={t("actions.edit")}>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingRow(record);
                  setOpen(true);
                }}
              ></Button>
            </Popover>
            <Popover content={t("actions.delete")}>
              <Popconfirm
                title={t("actions.confirmDeleteTitle")}
                okText={t("actions.confirmDeleteOk")}
                okButtonProps={{ danger: true }}
                onConfirm={() => onDelete(record.id)}
              >
                <Button icon={<DeleteOutlined />} danger></Button>
              </Popconfirm>
            </Popover>
          </Space>
        ),
      },
    ],
    [colors, products, sizes, t, tStatus]
  );

  const onSubmit = async (values) => {
    try {
      if (editingRow) {
        const payload = {
          status: values.status,
          quantity: values.quantity,
        };
        await ProductStockAPI.update(editingRow.id, payload);
        message.success(t("messages.updateSuccess"));
        tableRef.current?.reload();
      } else {
        await ProductStockAPI.create(values);
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
      await ProductStockAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.deleteError")
      );
    }
  };

  const handleTemplateDownload = async (format) => {
    setTemplateLoading(true);
    try {
      const { blob, filename } = await ProductStockAPI.downloadTemplate({
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
      const response = await ProductStockAPI.import(file);
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
    <RequireRole anyOfRoles={["companyAdmin"]}>
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
          size_id: undefined,
          color_id: undefined,
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
                name: editingRow?.product?.name || "",
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
        <ProductStockForm
          onFinish={onSubmit}
          submitText={
            editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")
          }
          isEdit={Boolean(editingRow)}
          products={products}
          initialValues={
            editingRow
              ? {
                  quantity: editingRow?.quantity,
                  status: editingRow?.status,
                  product_id: editingRow?.product_id ?? editingRow?.product?.id,
                  size_id: editingRow?.size_id ?? editingRow?.size?.id,
                  color_id: editingRow?.color_id ?? editingRow?.color?.id,
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
