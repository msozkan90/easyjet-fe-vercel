"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Modal, Select, Space, Typography, Upload } from "antd";
import { EditOutlined, UploadOutlined } from "@ant-design/icons";
import RequireRole from "@/components/common/Access/RequireRole";
import CrudTable from "@/components/common/table/CrudTable";
import { GuardedPreviewImage } from "@/components/common/media/ImagePreviewGate";
import { ProductCatalogAPI } from "@/utils/api";
import { makeListRequest } from "@/utils/listPayload";
import { normalizeListAndMeta } from "@/utils/normalizeListAndMeta";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { formatPrice } from "@/utils/priceHelpers";
import { useTranslations } from "@/i18n/use-translations";
import { useDirtyGuard } from "@/hooks/useDirtyGuard";

export default function ProductCatalogTable({ customer = false, partner = false, selectCustomer = false }) {
  const showPrices = customer || partner;
  const t = useTranslations("dashboard.productCatalog");
  const { message } = App.useApp();
  const tableRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ product: [], size: [], color: [] });
  useEffect(() => {
    let alive = true;
    const fields = ["product", "size", "color"];
    Promise.allSettled([
      fetchGenericList("product"),
      fetchGenericList("product_size"),
      fetchGenericList("product_color"),
    ]).then(results => {
      if (!alive) return;
      const options = {};
      results.forEach((result, index) => {
        const field = fields[index];
        options[field] = result.status === "fulfilled"
          ? result.value.map(item => ({ value: field === "product" ? item.id : item.name, label: item.name }))
          : [];
      });
      setFilterOptions(options);
      if (results.some(result => result.status === "rejected")) message.error(t("loadFiltersError"));
    });
    return () => { alive = false; };
  }, [message, t]);
  useEffect(() => {
    if (!partner || !selectCustomer) return;
    let alive = true;
    setCustomersLoading(true);
    fetchGenericList("customer")
      .then(list => { if (alive) setCustomers(list.map(item => ({ value: item.id, label: item.name }))); })
      .catch(() => { if (alive) message.error(t("loadCustomersError")); })
      .finally(() => { if (alive) setCustomersLoading(false); });
    return () => { alive = false; };
  }, [partner, selectCustomer, message, t]);
  const { onDirtyChange, guardClose } = useDirtyGuard(Boolean(editing));
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const request = useMemo(() => {
    if (partner && selectCustomer && !selectedCustomerId) {
      return async () => ({ list: [], total: 0 });
    }
    const list = partner
      ? selectCustomer
        ? payload => ProductCatalogAPI.partnerCustomerPrices(payload, selectedCustomerId)
        : ProductCatalogAPI.partnerPrices
      : customer ? ProductCatalogAPI.customerPrices : ProductCatalogAPI.list;
    return makeListRequest(list, {
      defaultSort: [],
      filterTransform: filters => ({
        ...filters,
        ...(filters.size_name ? { size_name: { eq: filters.size_name } } : {}),
        ...(filters.color_name ? { color_name: { eq: filters.color_name } } : {}),
      }),
    }, normalizeListAndMeta);
  }, [customer, partner, selectCustomer, selectedCustomerId]);
  const close = () => { setEditing(null); setFile(null); };
  const columns = [
    { title: t("image"), dataIndex: "image_url", width: 120, render: (url, row) => url ? (
      <GuardedPreviewImage src={url} alt={row.product_name} width={64} height={64}
        openLabel={t("open")} emptyText={t("noImage")} style={{ objectFit: "contain", borderRadius: 8 }} />
    ) : <Typography.Text type="secondary">{t("noImage")}</Typography.Text> },
    ...["product", "size", "color"].map(field => ({
      title: t(field), dataIndex: field === "product" ? "product_id" : `${field}_name`,
      render: (_, row) => row[`${field}_name`],
      filter: { type: "select", options: filterOptions[field], placeholder: t(`select${field[0].toUpperCase()}${field.slice(1)}`) },
    })),
    ...(showPrices ? [{ title: t("price"), dataIndex: "price", sorter: true, render: value => formatPrice(value) }] : [{
      title: t("actions"), key: "actions", width: 100,
      render: (_, row) => <Button aria-label={t("edit")} title={t("edit")} icon={<EditOutlined />}
        onClick={() => { setFile(null); setEditing(row); }} />,
    }]),
  ];
  const save = async () => {
    if (!file) { message.error(t("selectImage")); return; }
    setSaving(true);
    try {
      const data = new FormData();
      ["product_id", "size_id", "color_id"].forEach(key => data.append(key, editing[key]));
      data.append("image", file);
      await ProductCatalogAPI.saveImage(data);
      message.success(t("saved"));
      onDirtyChange(false);
      close();
      tableRef.current?.reload();
    } catch { message.error(t("saveError")); }
    finally { setSaving(false); }
  };
  return (
    <RequireRole anyOfRoles={[partner ? "partnerAdmin" : customer ? "customerAdmin" : "companyAdmin"]}>
      <CrudTable key={selectedCustomerId || "unselected"} ref={tableRef} columns={columns} request={request}
        toolbarLeft={partner && selectCustomer ? (
          <Space wrap>
            <Typography.Text>{t("customer")}</Typography.Text>
            <Select aria-label={t("selectCustomer")} placeholder={t("selectCustomer")} allowClear showSearch
              optionFilterProp="label" options={customers} loading={customersLoading}
              value={selectedCustomerId || undefined} onChange={value => setSelectedCustomerId(value || null)}
              style={{ width: 260, maxWidth: "100%" }} />
          </Space>
        ) : undefined}
        tableProps={{ scroll: { x: true }, ...(partner && selectCustomer && !selectedCustomerId
          ? { locale: { emptyText: t("selectCustomerToView") } } : {}) }} />
      {!showPrices && <Modal title={t("editTitle")} open={Boolean(editing)} onCancel={guardClose(close)}
        onOk={save} confirmLoading={saving} okText={t("save")} cancelText={t("cancel")}
        closable={!saving} maskClosable={!saving} keyboard={!saving} cancelButtonProps={{ disabled: saving }} destroyOnHidden>
        <Space direction="vertical" size="middle">
          <Typography.Text>{[editing?.product_name, editing?.size_name, editing?.color_name].filter(Boolean).join(" / ")}</Typography.Text>
          {(preview || editing?.image_url) && <GuardedPreviewImage src={preview || editing.image_url}
            alt={editing?.product_name} width={200} height={200} openLabel={t("open")} style={{ objectFit: "contain" }} />}
          <Upload accept="image/png,image/jpeg,image/webp" maxCount={1} disabled={saving}
            fileList={file ? [{ uid: "image", name: file.name, status: "done" }] : []}
            beforeUpload={next => {
              if (!["image/png", "image/jpeg", "image/webp"].includes(next.type) || next.size > 5 * 1024 * 1024) {
                message.error(t("invalidImage")); return Upload.LIST_IGNORE;
              }
              setFile(next); onDirtyChange(true); return false;
            }} onRemove={() => { setFile(null); onDirtyChange(false); }}>
            <Button icon={<UploadOutlined />}>{t("upload")}</Button>
          </Upload>
        </Space>
      </Modal>}
    </RequireRole>
  );
}
