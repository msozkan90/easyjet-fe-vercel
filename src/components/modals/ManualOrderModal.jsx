"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  App as AntdApp,
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Spin,
  Typography,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { OrdersAPI, ProductVariationAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import AddressEditorModal from "@/components/modals/AddressEditorModal";
import { isValidOrderNumber } from "@/utils/orderNumberValidation";

const EMPTY_ITEM = {
  sku: "",
  name: "",
  quantity: 1,
  product_id: undefined,
  size_id: undefined,
  color_id: undefined,
  options: [],
};

const nullable = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const sameId = (left, right) => String(left ?? "") === String(right ?? "");

const findPrice = (products, item) => {
  if (!item?.product_id || !item?.size_id || !item?.color_id) return undefined;
  const product = products.find((entry) => sameId(entry?.id, item.product_id));
  const match = (product?.prices || []).find(
    (entry) =>
      sameId(entry?.size_id, item.size_id) &&
      sameId(entry?.color_id, item.color_id),
  );
  return match?.price === null || match?.price === undefined || match?.price === ""
    ? undefined
    : match.price;
};

function ManualOrderItemFields({ field, form, products, loading, remove, canRemove, t }) {
  const productId = Form.useWatch(["items", field.name, "product_id"], form);
  const sizeId = Form.useWatch(["items", field.name, "size_id"], form);
  const colorId = Form.useWatch(["items", field.name, "color_id"], form);
  const selectedProduct = useMemo(
    () => products.find((product) => sameId(product?.id, productId)) || null,
    [productId, products],
  );
  const selectedPrice = useMemo(
    () => findPrice(products, { product_id: productId, size_id: sizeId, color_id: colorId }),
    [colorId, productId, products, sizeId],
  );
  const complete = Boolean(productId && sizeId && colorId);

  const productOptions = useMemo(
    () => products.map((item) => ({ value: item.id, label: item.name })),
    [products],
  );
  const sizeOptions = useMemo(
    () => (selectedProduct?.sizes || []).map((item) => ({ value: item.id, label: item.name })),
    [selectedProduct],
  );
  const colorOptions = useMemo(
    () => (selectedProduct?.colors || []).map((item) => ({ value: item.id, label: item.name })),
    [selectedProduct],
  );

  const handleProductChange = (value) => {
    form.setFieldsValue({
      items: (form.getFieldValue("items") || []).map((item, index) =>
        index === field.name
          ? { ...item, product_id: value, size_id: undefined, color_id: undefined }
          : item,
      ),
    });
  };

  return (
    <div className="space-y-3 rounded border border-slate-200 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Form.Item
          name={[field.name, "sku"]}
          label={t("fields.itemSku")}
          rules={[{ required: true, message: t("validation.itemSkuRequired") }]}
        >
          <Input disabled={loading} />
        </Form.Item>
        <Form.Item
          name={[field.name, "name"]}
          label={t("fields.itemName")}
          rules={[{ required: true, message: t("validation.itemNameRequired") }]}
        >
          <Input disabled={loading} />
        </Form.Item>
        <Form.Item
          name={[field.name, "quantity"]}
          label={t("fields.quantity")}
          rules={[{ required: true, message: t("validation.quantityRequired") }]}
        >
          <InputNumber min={1} precision={0} className="w-full" disabled={loading} />
        </Form.Item>
        <Form.Item
          name={[field.name, "product_id"]}
          label={t("fields.product")}
          rules={[{ required: true, message: t("validation.productRequired") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={productOptions}
            onChange={handleProductChange}
            loading={loading}
          />
        </Form.Item>
        <Form.Item
          name={[field.name, "size_id"]}
          label={t("fields.size")}
          rules={[{ required: true, message: t("validation.sizeRequired") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={sizeOptions}
            disabled={!productId || loading}
          />
        </Form.Item>
        <Form.Item
          name={[field.name, "color_id"]}
          label={t("fields.color")}
          rules={[{ required: true, message: t("validation.colorRequired") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            options={colorOptions}
            disabled={!productId || loading}
          />
        </Form.Item>
      </div>

      {complete ? (
        selectedPrice === undefined ? (
          <Alert type="warning" showIcon message={t("validation.priceMissing")} />
        ) : (
          <Alert
            type="success"
            showIcon
            message={`${t("fields.customerPrice")}: ${String(selectedPrice)}`}
          />
        )
      ) : null}

      <Form.List name={[field.name, "options"]}>
        {(optionFields, { add, remove: removeOption }) => (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Typography.Text strong>{t("fields.options")}</Typography.Text>
              <Button size="small" icon={<PlusOutlined />} onClick={() => add({ name: "", value: "" })}>
                {t("actions.addOption")}
              </Button>
            </div>
            {optionFields.map((optionField) => (
              <div key={optionField.key} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr_auto]">
                <Form.Item
                  name={[optionField.name, "name"]}
                  rules={[{ required: true, message: t("validation.optionNameRequired") }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input placeholder={t("fields.optionName")} />
                </Form.Item>
                <Form.Item
                  name={[optionField.name, "value"]}
                  rules={[{ required: true, message: t("validation.optionValueRequired") }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} placeholder={t("fields.optionValue")} />
                </Form.Item>
                <Button danger icon={<DeleteOutlined />} onClick={() => removeOption(optionField.name)} />
              </div>
            ))}
          </div>
        )}
      </Form.List>

      <div className="flex justify-end">
        <Button danger disabled={!canRemove} onClick={() => remove(field.name)}>{t("actions.removeItem")}</Button>
      </div>
    </div>
  );
}

export default function ManualOrderModal({ open, onCancel, onCreated }) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders.manualNormalOrderModal");
  const [form] = Form.useForm();
  const [addressForm] = Form.useForm();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const address = Form.useWatch([], form) || {};

  const reset = useCallback(() => {
    form.resetFields();
    addressForm.resetFields();
    setAddressOpen(false);
  }, [addressForm, form]);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ order_date: dayjs(), gift: false, items: [{ ...EMPTY_ITEM }] });
    setLoading(true);
    ProductVariationAPI.list()
      .then((response) => setProducts(Array.isArray(response?.data) ? response.data : []))
      .catch((error) => {
        setProducts([]);
        message.error(error?.response?.data?.error?.message || t("messages.productsError"));
      })
      .finally(() => setLoading(false));
  }, [form, message, open, t]);

  const handleCancel = useCallback(() => {
    if (saving) return;
    reset();
    onCancel?.();
  }, [onCancel, reset, saving]);

  const openAddress = useCallback(() => {
    addressForm.setFieldsValue({
      ship_to_name: address.ship_to_name || "",
      ship_to_company: address.ship_to_company || "",
      ship_to_street1: address.ship_to_street1 || "",
      ship_to_street2: address.ship_to_street2 || "",
      ship_to_street3: address.ship_to_street3 || "",
      ship_to_city: address.ship_to_city || "",
      ship_to_state: address.ship_to_state || "",
      ship_to_postal_code: address.ship_to_postal_code || "",
      ship_to_country: address.ship_to_country || "",
      ship_to_phone: address.ship_to_phone || "",
    });
    setAddressOpen(true);
  }, [address, addressForm]);

  const selectAddress = useCallback((payload) => {
    if (!payload) return;
    addressForm.setFieldsValue({
      ...(payload.street1 !== undefined ? { ship_to_street1: payload.street1 } : {}),
      ...(payload.street2 !== undefined ? { ship_to_street2: payload.street2 } : {}),
      ...(payload.street3 !== undefined ? { ship_to_street3: payload.street3 } : {}),
      ...(payload.city !== undefined ? { ship_to_city: payload.city } : {}),
      ...(payload.state !== undefined ? { ship_to_state: payload.state } : {}),
      ...(payload.postalCode !== undefined ? { ship_to_postal_code: payload.postalCode } : {}),
      ...(payload.country !== undefined ? { ship_to_country: payload.country } : {}),
    });
  }, [addressForm]);

  const saveAddress = useCallback(async () => {
    try {
      const values = await addressForm.validateFields();
      form.setFieldsValue(values);
      setAddressOpen(false);
    } catch {
      // Ant Design renders field errors.
    }
  }, [addressForm, form]);

  const submit = useCallback(async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    if (!isValidOrderNumber(values.order_number)) {
      message.error(t("validation.orderNumberWhitespace"));
      return;
    }
    if ((values.items || []).some((item) => findPrice(products, item) === undefined)) {
      message.error(t("validation.priceMissing"));
      return;
    }

    const payload = {
      order_number: values.order_number.trim(),
      order_date: values.order_date.toISOString(),
      requested_service: nullable(values.requested_service),
      carrier_code: nullable(values.carrier_code),
      service_code: nullable(values.service_code),
      package_code: nullable(values.package_code),
      customer_email: nullable(values.customer_email),
      customer_notes: nullable(values.customer_notes),
      gift: Boolean(values.gift),
      gift_message: nullable(values.gift_message),
      ship_to_name: nullable(values.ship_to_name),
      ship_to_company: nullable(values.ship_to_company),
      ship_to_street1: values.ship_to_street1.trim(),
      ship_to_street2: nullable(values.ship_to_street2),
      ship_to_street3: nullable(values.ship_to_street3),
      ship_to_city: values.ship_to_city.trim(),
      ship_to_state: values.ship_to_state.trim(),
      ship_to_postal_code: values.ship_to_postal_code.trim(),
      ship_to_country: values.ship_to_country.trim(),
      ship_to_phone: nullable(values.ship_to_phone),
      items: values.items.map((item) => ({
        sku: item.sku.trim(),
        name: item.name.trim(),
        quantity: item.quantity,
        product_id: item.product_id,
        size_id: item.size_id,
        color_id: item.color_id,
        options: (item.options || []).map((option) => ({
          name: option.name.trim(),
          value: option.value.trim(),
        })),
      })),
    };

    setSaving(true);
    try {
      const response = await OrdersAPI.createManual(payload);
      message.success(t("messages.success"));
      reset();
      onCreated?.(response?.data);
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("messages.error"));
    } finally {
      setSaving(false);
    }
  }, [form, message, onCreated, products, reset, t]);

  const addressSummary = [
    address.ship_to_street1,
    address.ship_to_street2,
    address.ship_to_street3,
    address.ship_to_city,
    address.ship_to_state,
    address.ship_to_postal_code,
    address.ship_to_country,
  ].filter(Boolean).join(", ");

  return (
    <>
      <Modal
        open={open}
        title={t("title")}
        okText={t("actions.create")}
        cancelText={t("actions.cancel")}
        confirmLoading={saving}
        onOk={submit}
        onCancel={handleCancel}
        width={1100}
        destroyOnHidden
      >
        <Spin spinning={loading}>
          <Form form={form} layout="vertical">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Form.Item name="order_number" label={t("fields.orderNumber")} rules={[
                { required: true, message: t("validation.orderNumberRequired") },
                { validator: (_, value) => !value || isValidOrderNumber(value) ? Promise.resolve() : Promise.reject(new Error(t("validation.orderNumberWhitespace"))) },
              ]}>
                <Input prefix="MO-" />
              </Form.Item>
              <Form.Item name="order_date" label={t("fields.orderDate")} rules={[{ required: true, message: t("validation.orderDateRequired") }]}>
                <DatePicker showTime className="w-full" format="YYYY-MM-DD HH:mm:ss" />
              </Form.Item>
              <Form.Item name="customer_email" label={t("fields.customerEmail")} rules={[{ type: "email", message: t("validation.emailInvalid") }]}>
                <Input />
              </Form.Item>
              <Form.Item name="gift" valuePropName="checked" label={t("fields.gift")}>
                <Checkbox>{t("fields.gift")}</Checkbox>
              </Form.Item>
              <Form.Item name="requested_service" label={t("fields.requestedService")}><Input /></Form.Item>
              <Form.Item name="carrier_code" label={t("fields.carrierCode")}><Input /></Form.Item>
              <Form.Item name="service_code" label={t("fields.serviceCode")}><Input /></Form.Item>
              <Form.Item name="package_code" label={t("fields.packageCode")}><Input /></Form.Item>
            </div>

            <div className="mb-4 rounded border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <Typography.Text strong>{t("fields.address")}</Typography.Text>
                <Button onClick={openAddress}>{t("actions.address")}</Button>
              </div>
              <div>{[address.ship_to_name, address.ship_to_company].filter(Boolean).join(" — ") || "-"}</div>
              <div className="text-slate-500">{addressSummary || "-"}</div>
              <div className="text-slate-500">{address.ship_to_phone || "-"}</div>
            </div>

            {["ship_to_name", "ship_to_company", "ship_to_street1", "ship_to_street2", "ship_to_street3", "ship_to_city", "ship_to_state", "ship_to_postal_code", "ship_to_country", "ship_to_phone"].map((name) => (
              <Form.Item
                key={name}
                name={name}
                hidden
                rules={
                  ["ship_to_street1", "ship_to_city", "ship_to_state", "ship_to_postal_code", "ship_to_country"].includes(name)
                    ? [{ required: true, message: t("validation.addressRequired") }]
                    : undefined
                }
              >
                <Input />
              </Form.Item>
            ))}

            <Form.Item name="customer_notes" label={t("fields.customerNotes")}><Input.TextArea rows={2} /></Form.Item>
            <Form.Item name="gift_message" label={t("fields.giftMessage")}><Input.TextArea rows={2} /></Form.Item>

            <Form.List
              name="items"
              rules={[{
                validator: (_, items) => Array.isArray(items) && items.length > 0
                  ? Promise.resolve()
                  : Promise.reject(new Error(t("validation.itemsRequired"))),
              }]}
            >
              {(fields, { add, remove }) => (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Typography.Title level={5} style={{ margin: 0 }}>{t("fields.items")}</Typography.Title>
                    <Button icon={<PlusOutlined />} onClick={() => add({ ...EMPTY_ITEM })}>{t("actions.addItem")}</Button>
                  </div>
                  {fields.map((field) => (
                    <ManualOrderItemFields key={field.key} field={field} form={form} products={products} loading={loading || saving} remove={remove} canRemove={fields.length > 1} t={t} />
                  ))}
                </div>
              )}
            </Form.List>
          </Form>
        </Spin>
      </Modal>

      <AddressEditorModal
        open={addressOpen}
        loading={false}
        saving={false}
        onCancel={() => setAddressOpen(false)}
        onSave={saveAddress}
        editForm={addressForm}
        editingOrder={{ order_number: form.getFieldValue("order_number") || "-", order_date: form.getFieldValue("order_date") || "-" }}
        onAddressSelect={selectAddress}
        showBillToName={false}
        showRecipientFields
        orderDateLabel={form.getFieldValue("order_date")?.format?.("YYYY-MM-DD HH:mm:ss") || "-"}
        zIndex={1600}
      />
    </>
  );
}
