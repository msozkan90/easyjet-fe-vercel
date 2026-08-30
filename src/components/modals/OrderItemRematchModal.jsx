"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Form,
  Modal,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import { OrdersAPI, ProductVariationAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const getRecordId = (record, field) =>
  record?.[`${field}_id`] ?? record?.[field]?.id ?? undefined;

const normalizeId = (value) =>
  value === undefined || value === null ? "" : String(value);

export default function OrderItemRematchModal({
  open,
  record,
  onCancel,
  onSaved,
}) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders");
  const [form] = Form.useForm();
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const productId = Form.useWatch("product_id", form);
  const sizeId = Form.useWatch("size_id", form);
  const colorId = Form.useWatch("color_id", form);

  const loadVariations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ProductVariationAPI.list();
      setVariations(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      setVariations([]);
      message.error(
        error?.response?.data?.error?.message ||
          t("messages.loadVariationsError"),
      );
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      product_id: getRecordId(record, "product"),
      size_id: getRecordId(record, "size"),
      color_id: getRecordId(record, "color"),
    });
    void loadVariations();
  }, [form, loadVariations, open, record]);

  const selectedProduct = useMemo(
    () =>
      variations.find(
        (product) => normalizeId(product?.id) === normalizeId(productId),
      ) || null,
    [productId, variations],
  );

  const productOptions = useMemo(
    () =>
      variations
        .filter((product) => product?.id)
        .map((product) => ({ value: product.id, label: product.name })),
    [variations],
  );

  const sizeOptions = useMemo(
    () =>
      (selectedProduct?.sizes || [])
        .filter((size) => size?.id)
        .map((size) => ({ value: size.id, label: size.name })),
    [selectedProduct],
  );

  const colorOptions = useMemo(
    () =>
      (selectedProduct?.colors || [])
        .filter((color) => color?.id)
        .map((color) => ({ value: color.id, label: color.name })),
    [selectedProduct],
  );

  const selectedPrice = useMemo(() => {
    if (!selectedProduct || !sizeId || !colorId) return undefined;
    const price = (selectedProduct.prices || []).find(
      (entry) =>
        normalizeId(entry?.size_id) === normalizeId(sizeId) &&
        normalizeId(entry?.color_id) === normalizeId(colorId),
    )?.price;
    return price === null || price === undefined || price === ""
      ? undefined
      : price;
  }, [colorId, selectedProduct, sizeId]);

  const hasCompleteVariation = Boolean(productId && sizeId && colorId);

  const handleProductChange = useCallback(
    (value) => {
      form.setFieldsValue({
        product_id: value,
        size_id: undefined,
        color_id: undefined,
      });
    },
    [form],
  );

  const handleSave = useCallback(async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    if (selectedPrice === undefined) {
      message.warning(t("messages.rematchPriceMissing"));
      return;
    }
    if (!record?.id) return;

    setSaving(true);
    try {
      const response = await OrdersAPI.rematchItem(record.id, values);
      message.success(t("messages.rematchSuccess"));
      onSaved?.(response?.data);
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.rematchError"),
      );
    } finally {
      setSaving(false);
    }
  }, [form, message, onSaved, record, selectedPrice, t]);

  return (
    <Modal
      open={open}
      title={t("rematch.title")}
      okText={t("rematch.submit")}
      cancelText={t("rematch.cancel")}
      confirmLoading={saving}
      onOk={handleSave}
      onCancel={saving ? undefined : onCancel}
      afterClose={() => form.resetFields()}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="product_id"
            label={t("columns.product")}
            rules={[{ required: true, message: t("rematch.productRequired") }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t("filters.selectProduct")}
              options={productOptions}
              onChange={handleProductChange}
              disabled={loading || saving}
            />
          </Form.Item>
          <Form.Item
            name="size_id"
            label={t("columns.size")}
            rules={[{ required: true, message: t("rematch.sizeRequired") }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t("filters.selectSize")}
              options={sizeOptions}
              disabled={!productId || loading || saving}
            />
          </Form.Item>
          <Form.Item
            name="color_id"
            label={t("columns.color")}
            rules={[{ required: true, message: t("rematch.colorRequired") }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t("filters.selectColor")}
              options={colorOptions}
              disabled={!productId || loading || saving}
            />
          </Form.Item>
        </Form>

        {hasCompleteVariation ? (
          selectedPrice === undefined ? (
            <Alert
              type="warning"
              showIcon
              message={t("messages.rematchPriceMissing")}
            />
          ) : (
            <Alert
              type="success"
              showIcon
              message={
                <Space>
                  <Typography.Text>
                    {t("rematch.customerPrice")}
                  </Typography.Text>
                  <Typography.Text strong>
                    {String(selectedPrice)}
                  </Typography.Text>
                </Space>
              }
            />
          )
        ) : null}
      </Spin>
    </Modal>
  );
}
