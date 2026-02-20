// src/components/companies/CompanyForm.jsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Form, Input, Select, InputNumber } from "antd";
import GooglePlacesAutocomplete from "@/components/common/forms/GooglePlacesAutocomplete";
import { useTranslations } from "@/i18n/use-translations";

export default function CompanyForm({
  initialValues,
  onFinish,
  submitText,
  categories = [],
}) {
  const [form] = Form.useForm();
  const [searchAddress, setSearchAddress] = useState("");
  const tCommonForms = useTranslations("forms.common");
  const tForm = useTranslations("forms.company");
  const tStatus = useTranslations("common.status");
  const submitButtonLabel = submitText || tCommonForms("buttons.save");

  useEffect(() => {
    form.resetFields();
    if (initialValues) {
      form.setFieldsValue(initialValues);
      setSearchAddress(
        initialValues?.address?.formatted_address ||
          initialValues?.address?.address_line1 ||
          ""
      );
    } else {
      setSearchAddress("");
    }
  }, [form, initialValues]);

  const handleAddressSelect = useCallback(
    (payload) => {
      const currentAddress = form.getFieldValue("address") || {};
      form.setFieldsValue({
        address: {
          ...currentAddress,
          address_line1: payload?.street1 || currentAddress.address_line1 || "",
          city_locality: payload?.city || currentAddress.city_locality || "",
          state_province: payload?.state || currentAddress.state_province || "",
          postal_code: payload?.postalCode || currentAddress.postal_code || "",
          country_code:
            payload?.country ||
            payload?.countryName ||
            currentAddress.country_code ||
            "",
        },
      });
      setSearchAddress(payload?.formattedAddress || "");
    },
    [form]
  );

  const handleSearchChange = useCallback((val) => {
    setSearchAddress(val);
  }, []);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onFinish}
    >
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex-1 space-y-4">
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
        </div>

        <div className="hidden w-px bg-gray-200 md:block" />

        <div className="flex-1 space-y-4">
          <div className="text-lg font-semibold">
            {tForm("labels.addressSection")}
          </div>

          <Form.Item label={tForm("labels.searchAddress")}>
            <GooglePlacesAutocomplete
              value={searchAddress}
              onChange={handleSearchChange}
              onPlaceSelect={handleAddressSelect}
              placeholder={tForm("placeholders.searchAddress")}
            />
          </Form.Item>

          <div className="flex flex-col gap-4 md:flex-row">
            <Form.Item
              className="md:flex-1"
              name={["address", "name"]}
              label={tForm("labels.addressName")}
              rules={[
                {
                  required: true,
                  message: tCommonForms("validation.required", {
                    field: tForm("labels.addressName"),
                  }),
                },
              ]}
            >
              <Input placeholder={tForm("placeholders.addressName")} />
            </Form.Item>

            <Form.Item
              className="md:flex-1"
              name={["address", "phone"]}
              label={tForm("labels.addressPhone")}
              rules={[
                {
                  required: true,
                  message: tCommonForms("validation.required", {
                    field: tForm("labels.addressPhone"),
                  }),
                },
              ]}
            >
              <Input placeholder={tForm("placeholders.addressPhone")} />
            </Form.Item>
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <Form.Item
              className="md:flex-1"
              name={["address", "company_name"]}
              label={tForm("labels.addressCompanyName")}
              rules={[
                {
                  required: true,
                  message: tCommonForms("validation.required", {
                    field: tForm("labels.addressCompanyName"),
                  }),
                },
              ]}
            >
              <Input placeholder={tForm("placeholders.addressCompanyName")} />
            </Form.Item>

            <Form.Item
              className="md:flex-1"
              name={["address", "address_line1"]}
              label={tForm("labels.addressLine1")}
              rules={[
                {
                  required: true,
                  message: tCommonForms("validation.required", {
                    field: tForm("labels.addressLine1"),
                  }),
                },
              ]}
            >
              <Input placeholder={tForm("placeholders.addressLine1")} />
            </Form.Item>
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <Form.Item
              className="md:flex-1"
              name={["address", "city_locality"]}
              label={tForm("labels.cityLocality")}
              rules={[
                {
                  required: true,
                  message: tCommonForms("validation.required", {
                    field: tForm("labels.cityLocality"),
                  }),
                },
              ]}
            >
              <Input placeholder={tForm("placeholders.cityLocality")} />
            </Form.Item>

            <Form.Item
              className="md:flex-1"
              name={["address", "state_province"]}
              label={tForm("labels.stateProvince")}
              rules={[
                {
                  required: true,
                  message: tCommonForms("validation.required", {
                    field: tForm("labels.stateProvince"),
                  }),
                },
              ]}
            >
              <Input placeholder={tForm("placeholders.stateProvince")} />
            </Form.Item>
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <Form.Item
              className="md:flex-1"
              name={["address", "postal_code"]}
              label={tForm("labels.postalCode")}
              rules={[
                {
                  required: true,
                  message: tCommonForms("validation.required", {
                    field: tForm("labels.postalCode"),
                  }),
                },
              ]}
            >
              <Input placeholder={tForm("placeholders.postalCode")} />
            </Form.Item>

            <Form.Item
              className="md:flex-1"
              name={["address", "country_code"]}
              label={tForm("labels.countryCode")}
              rules={[
                {
                  required: true,
                  message: tCommonForms("validation.required", {
                    field: tForm("labels.countryCode"),
                  }),
                },
              ]}
            >
              <Input placeholder={tForm("placeholders.countryCode")} />
            </Form.Item>
          </div>
        </div>
      </div>

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
