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
import ProductPriceForm from "@/components/common/forms/ProductPriceForm";
import ImportResultModal from "@/components/common/Modal/ImportResultModal";
import { ProductPricesAPI } from "@/utils/api";
import { saveBlobAsFile } from "@/utils/apiHelpers";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { useTranslations } from "@/i18n/use-translations";

export default function ProductPricesPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.productPrice");
  const tStatus = useTranslations("common.status");
  const tableRef = useRef(null);
  const importInputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [partners, setPartners] = useState([]);
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

    const loadCustomers = async () => {
      try {
        const list = await fetchGenericList("customer");
        if (alive) {
          setCustomers(Array.isArray(list) ? list : []);
        }
      } catch {
        if (alive) {
          message.error(t("messages.loadCustomersError"));
        }
      }
    };

    const loadPartners = async () => {
      try {
        const list = await fetchGenericList("partner");
        if (alive) {
          setPartners(Array.isArray(list) ? list : []);
        }
      } catch {
        if (alive) {
          message.error(t("messages.loadPartnersError"));
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
    loadCustomers();
    loadPartners();
    loadSizes();
    loadColors();

    return () => {
      alive = false;
    };
  }, [message, t]);

  const request = makeListRequest(
    ProductPricesAPI.list,
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
        title: t("columns.customer"),
        dataIndex: "customer_id",
        sorter: true,
        filter: {
          type: "select",
          options: customers.map((customer) => ({
            value: customer.id,
            label: customer.name,
          })),
          placeholder: t("filters.selectCustomer"),
        },
        render: (_, record) => record?.customer?.name || t("common.none"),
      },
      {
        title: t("columns.partner"),
        dataIndex: "partner_id",
        sorter: true,
        filter: {
          type: "select",
          options: partners.map((partner) => ({
            value: partner.id,
            label: partner.name,
          })),
          placeholder: t("filters.selectPartner"),
        },
        render: (_, record) => record?.partner?.name || t("common.none"),
      },
      {
        title: t("columns.size"),
        dataIndex: "size_name",
        sorter: true,
        filter: {
          type: "select",
          options: sizes.map((size) => ({
            value: size.name,
            label: size.name,
          })),
          placeholder: t("filters.selectSize"),
        },
        render: (_, record) => record?.size?.name || t("common.none"),
      },
      {
        title: t("columns.color"),
        dataIndex: "color_name",
        sorter: true,
        filter: {
          type: "select",
          options: colors.map((color) => ({
            value: color.name,
            label: color.name,
          })),
          placeholder: t("filters.selectColor"),
        },
        render: (_, record) => record?.color?.name || t("common.none"),
      },
      {
        title: t("columns.price"),
        dataIndex: "price",
        sorter: true,
        render: (value) =>
          value !== null && value !== undefined
            ? value.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : t("common.none"),
      },
      {
        title: t("columns.sku"),
        dataIndex: "sku",
        sorter: true,
        render: (value) => value || t("common.none"),
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
    [colors, customers, partners, products, sizes, t, tStatus],
  );

  const onSubmit = async (values) => {
    try {
      if (editingRow) {
        const payload = {
          price: values.price,
          sku: values.sku,
          status: values.status,
        };
        await ProductPricesAPI.update(editingRow.id, payload);
        message.success(t("messages.updateSuccess"));
        tableRef.current?.reload();
      } else {
        await ProductPricesAPI.create(values);
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
      await ProductPricesAPI.remove(id);
      message.success(t("messages.deleteSuccess"));
      tableRef.current?.reload();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.deleteError"),
      );
    }
  };

  const handleExistsDownload = async (format) => {
    setTemplateLoading(true);
    try {
      const { blob, filename } = await ProductPricesAPI.downloadExists({
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

  const handleTemplateDownload = async (format) => {
    setTemplateLoading(true);
    try {
      const { blob, filename } = await ProductPricesAPI.downloadTemplate({
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
      const response = await ProductPricesAPI.import(file);
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
          product_id: undefined,
          customer_id: undefined,
          partner_id: undefined,
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
                onClick: ({ key }) => handleExistsDownload(key),
              }}
            >
              <Button loading={templateLoading}>
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
        <ProductPriceForm
          onFinish={onSubmit}
          submitText={
            editingRow ? t("modal.submitUpdate") : t("modal.submitCreate")
          }
          isEdit={Boolean(editingRow)}
          products={products}
          customers={customers}
          partners={partners}
          initialValues={
            editingRow
              ? {
                  price: editingRow?.price,
                  sku: editingRow?.sku,
                  status: editingRow?.status,
                  product_id: editingRow?.product_id ?? editingRow?.product?.id,
                  customer_id:
                    editingRow?.customer_id ?? editingRow?.customer?.id,
                  partner_id: editingRow?.partner_id ?? editingRow?.partner?.id,
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
