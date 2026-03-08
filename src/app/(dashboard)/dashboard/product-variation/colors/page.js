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
import ProductColorForm from "@/components/common/forms/ProductColorForm";
import ImportResultModal from "@/components/common/Modal/ImportResultModal";
import { ProductColorsAPI } from "@/utils/api";
import { saveBlobAsFile } from "@/utils/apiHelpers";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export default function ProductColorsPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.productColor");
  const tStatus = useTranslations("common.status");
  const tableRef = useRef(null);
  const importInputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [products, setProducts] = useState([]);
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
        if (alive) setProducts(list);
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
    ProductColorsAPI.list,
    {
      defaultSort: [{ field: "created_at", direction: "desc" }],
    },
    normalizeListAndMeta,
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
        title: t("columns.name"),
        dataIndex: "name",
        sorter: true,
        filter: { type: "text", placeholder: t("filters.searchName") },
      },
      {
        title: t("columns.hex"),
        dataIndex: "hex_code",
        width: 160,
        render: (_, record) => {
          const rawHex =
            (typeof record?.hex_code === "string" && record.hex_code.trim()) ||
            (typeof record?.hex === "string" && record.hex.trim()) ||
            (typeof record?.code === "string" && record.code.trim()) ||
            "";
          if (!HEX_COLOR_REGEX.test(rawHex)) {
            return rawHex || t("common.none");
          }
          const normalizedHex = rawHex.toUpperCase();
          return (
            <Space size={8}>
              <span
                style={{
                  display: "inline-block",
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: "1px solid #d9d9d9",
                  backgroundColor: normalizedHex,
                }}
              />
              <span>{normalizedHex}</span>
            </Space>
          );
        },
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
        width: 90,
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
    [products, t, tStatus],
  );

  const onSubmit = async (values) => {
    try {
      if (editingRow) {
        const trimmedName =
          typeof values?.name === "string" ? values.name.trim() : "";
        const payload = {
          product_id: values?.product_id,
          status: values?.status,
          name: trimmedName,
        };
        if (
          values?.hex_code === undefined ||
          values?.hex_code === null ||
          (typeof values?.hex_code === "string" && !values.hex_code.trim())
        ) {
          payload.hex_code = null;
        } else if (typeof values?.hex_code === "string") {
          const hex = values.hex_code.trim().toUpperCase();
          if (hex) {
            payload.hex_code = `#${hex.replace(/^#/, "")}`;
          }
        }
        await ProductColorsAPI.update(editingRow.id, payload);
        message.success(t("messages.updateSuccess"));
        tableRef.current?.reload();
      } else {
        const colorList = [];
        const seen = new Set();
        for (const entry of Array.isArray(values?.colorList)
          ? values.colorList
          : []) {
          const name = typeof entry?.name === "string" ? entry.name.trim() : "";
          const hex =
            typeof entry?.hex_code === "string"
              ? entry.hex_code.trim().toUpperCase()
              : "";
          if (!name) {
            continue;
          }
          const normalizedHex = hex ? `#${hex.replace(/^#/, "")}` : null;
          const key = `${name.toLowerCase()}|${normalizedHex || "transparent"}`;
          if (seen.has(key)) continue;
          seen.add(key);
          colorList.push({ name, hex_code: normalizedHex });
        }
        await ProductColorsAPI.create({
          product_id: values?.product_id,
          status: values?.status,
          colorList,
        });
        message.success(t("messages.createSuccess"));
        tableRef.current?.setPage(1);
        tableRef.current?.reload();
      }
      setOpen(false);
      setEditingRow(null);
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.operationFailed"),
      );
    }
  };

  const onDelete = async (id) => {
    try {
      await ProductColorsAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.deleteError"),
      );
    }
  };

  const handleTemplateDownload = async (format) => {
    setTemplateLoading(true);
    try {
      const { blob, filename } = await ProductColorsAPI.downloadExists({
        format,
        filters: listFilters,
      });
      saveBlobAsFile(blob, filename);
      message.success(t("messages.templateDownloadSuccess"));
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          t("messages.templateDownloadError"),
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
      const response = await ProductColorsAPI.import(file);
      const payload = response?.data ?? response;
      const resultData = payload?.data ?? payload;
      setImportResult(resultData);
      setImportResultOpen(true);

      const failedCount = resultData?.failed ?? 0;
      if (failedCount > 0) {
        message.warning(
          t("messages.importCompletedWithErrors", { failed: failedCount }),
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
          error?.response?.data?.error?.message || t("messages.importFailed"),
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
    [t],
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
    [t],
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
          name: "",
          product_id: undefined,
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
                {t("actions.existsDownload")}
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
            ? t("modal.editTitle", { name: editingRow?.name || "" })
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
        <ProductColorForm
          onFinish={onSubmit}
          submitText={
            editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")
          }
          products={products}
          isEdit={Boolean(editingRow)}
          initialValues={
            editingRow
              ? {
                  name: editingRow?.name,
                  status: editingRow?.status,
                  product_id: editingRow?.product_id ?? editingRow?.product?.id,
                  hex_code: (() => {
                    const existingHex =
                      (typeof editingRow?.hex_code === "string" &&
                        editingRow.hex_code) ||
                      (typeof editingRow?.hex === "string" && editingRow.hex) ||
                      (typeof editingRow?.code === "string" &&
                        editingRow.code) ||
                      "";
                    const trimmed = existingHex.trim();
                    return trimmed
                      ? `#${trimmed.replace(/^#/, "")}`.toUpperCase()
                      : null;
                  })(),
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
