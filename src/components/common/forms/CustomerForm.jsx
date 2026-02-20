// src/components/companies/CustomerForm.jsx
"use client";

import { ShipStationAPI } from "@/utils/api";
import { Form, Input, Select, App as AntdApp, InputNumber } from "antd";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslations } from "@/i18n/use-translations";

export default function CustomerForm({
  initialValues,
  onFinish,
  submitText,
  has_api_key = false,
  categories = [],
  showProductMultiplier = false,
  showShipmentMultiplier = false,
}) {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [storeList, setStoreList] = useState([]);
  const user = useSelector((s) => s.auth.user);
  const hasOwnKey = user?.entity?.has_own_key || false;

  const tCommonForms = useTranslations("forms.common");
  const tForm = useTranslations("forms.customer");
  const tStatus = useTranslations("common.status");
  const submitButtonLabel = submitText || tCommonForms("buttons.save");

  useEffect(() => {
    let alive = true;
    if (!hasOwnKey) return;
    (async () => {
      try {
        const resp = await ShipStationAPI.storeList();
        if (!alive) return;
        const payload = resp?.data ?? resp;
        const list =
          payload?.items ??
          payload?.data?.data ??
          payload?.data ??
          payload ??
          [];
        setStoreList(Array.isArray(list) ? list : []);
      } catch {
        if (alive) {
          message.error(tForm("messages.storeListLoadError"));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [hasOwnKey, message, tForm]);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onFinish}
    >
      <Form.Item
        name="name"
        label={tForm("labels.name")}
        rules={[
          {
            required: true,
            message: tCommonForms("validation.required", {
              field: tForm("labels.name"),
            }),
          },
        ]}
      >
        <Input placeholder={tForm("placeholders.name")} />
      </Form.Item>

      <Form.Item
        name="description"
        label={tForm("labels.description")}
        rules={[
          {
            required: true,
            message: tCommonForms("validation.required", {
              field: tForm("labels.description"),
            }),
          },
        ]}
      >
        <Input placeholder={tForm("placeholders.description")} />
      </Form.Item>

      <Form.Item
        name="categories"
        label={tForm("labels.categories")}
        rules={[
          {
            required: true,
            message: tCommonForms("validation.multiRequired", {
              field: tForm("labels.categories"),
            }),
          },
        ]}
      >
        <Select
          placeholder={tForm("placeholders.categories")}
          mode="multiple"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
      </Form.Item>

      {hasOwnKey && !has_api_key && (
        <Form.Item
          name="store_id"
          label={tForm("labels.store")}
          rules={[
            {
              message: tCommonForms("validation.storeRequired"),
            },
          ]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            filterOption={(input, option) =>
              option?.label?.toLowerCase().includes(input.toLowerCase())
            }
            options={storeList?.map((s) => ({
              value: s.storeId.toString(),
              label: `${s.storeName} - ${s.marketplaceName}`,
            }))}
            loading={storeList.length === 0}
            placeholder={tCommonForms("placeholders.selectStore")}
          />
        </Form.Item>
      )}

      {showShipmentMultiplier && (
        <Form.Item
          name="shipment_multiplier"
          label={tForm("labels.shipmentMultiplier")}
          tooltip={tForm("tooltips.shipmentMultiplier")}
        >
          <InputNumber
            className="w-full"
            min={0}
            step={0.1}
            placeholder={tForm("placeholders.shipmentMultiplier")}
          />
        </Form.Item>
      )}

      {showProductMultiplier && (
        <Form.Item
          name="product_multiplier"
          label={tForm("labels.productMultiplier")}
          tooltip={tForm("tooltips.productMultiplier")}
        >
          <InputNumber
            className="w-full"
            min={0}
            step={0.1}
            placeholder={tForm("placeholders.productMultiplier")}
          />
        </Form.Item>
      )}

      <Form.Item
        name="status"
        label={tForm("labels.status")}
        rules={[
          {
            required: true,
            message: tCommonForms("validation.required", {
              field: tForm("labels.status"),
            }),
          },
        ]}
      >
        <Select
          placeholder={tCommonForms("placeholders.selectStatus")}
          options={[
            { value: "active", label: tStatus("active") },
            { value: "inactive", label: tStatus("inactive") },
          ]}
        />
      </Form.Item>

      <Form.Item className="mb-0">
        <button
          type="submit"
          className="w-full rounded-md px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          {submitButtonLabel}
        </button>
      </Form.Item>
    </Form>
  );
}
