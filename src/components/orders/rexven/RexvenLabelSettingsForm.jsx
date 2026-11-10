"use client";

import { useEffect, useMemo } from "react";
import {
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Typography,
} from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { getRexvenLabelDefaults } from "./rexvenLabelDefaults.mjs";

const CHOICES = {
  arrangementOption: ["optimal", "sequential-optimal"],
  labelOrder: ["product-name", "order-number", "date", "variant-color"],
  outputType: ["label_only", "order_info_only", "label_and_order_info"],
  mockupSize: ["normal", "large"],
  printType: ["normal", "ornament"],
};

export default function RexvenLabelSettingsForm({
  form,
  defaults,
  orderCount,
}) {
  const t = useTranslations("dashboard.orders.rexvenLabels.settings");
  const initialValues = useMemo(() => {
    const values = getRexvenLabelDefaults(defaults);
    return {
      ...values,
      printConfig: {
        ...values.printConfig,
        ornament: {
          pageWidth: 24,
          pageHeight: 17,
          spacing: 0.1,
          ...values.printConfig.ornament,
        },
      },
    };
  }, [defaults]);
  useEffect(() => {
    form.resetFields();
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);
  const printType =
    Form.useWatch(["printConfig", "printType"], form) ??
    initialValues.printConfig.printType;
  const required = [{ required: true, message: t("required") }];
  const selectOptions = (field) =>
    CHOICES[field].map((value) => ({
      value,
      label: t(`choices.${field}.${value}`),
    }));

  return (
    <Form
      form={form}
      layout="vertical"
      size="large"
      initialValues={initialValues}
      clearOnDestroy
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 28 }}>
        {t("description", { count: orderCount })}
      </Typography.Paragraph>
      {["labelOrder", "outputType", "mockupSize"].map((field) => (
        <Form.Item
          key={field}
          name={field}
          label={t(`fields.${field}`)}
          rules={required}
        >
          <Select options={selectOptions(field)} />
        </Form.Item>
      ))}
      <Form.Item name={["printConfig", "printType"]} rules={required}>
        <Segmented
          block
          options={selectOptions("printType")}
          aria-label={t("fields.printType")}
        />
      </Form.Item>
      {printType === "ornament" ? (
        <>
          <Form.Item name={["printConfig", "ornament", "spacing"]} hidden>
            <InputNumber />
          </Form.Item>
          <Row gutter={16}>
            {["pageWidth", "pageHeight"].map((field) => (
              <Col key={field} xs={24} sm={12}>
                <Form.Item
                  name={["printConfig", "ornament", field]}
                  label={t(`fields.${field}`)}
                  rules={[
                    ...required,
                    {
                      validator: (_, value) =>
                        typeof value === "number" &&
                        Number.isFinite(value) &&
                        value > 0
                          ? Promise.resolve()
                          : Promise.reject(new Error(t("invalidDimension"))),
                    },
                  ]}
                >
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            ))}
          </Row>
        </>
      ) : (
        <>
          <Form.Item
            name="dtfMachineWidth"
            label={t("fields.dtfMachineWidth")}
            rules={[
              ...required,
              { type: "number", min: 1, message: t("invalidWidth") },
            ]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="arrangementOption"
            label={t("fields.arrangementOption")}
            rules={required}
          >
            <Select options={selectOptions("arrangementOption")} />
          </Form.Item>
          <Form.Item
            name="designSpacing"
            label={t("fields.designSpacing")}
            rules={[
              ...required,
              {
                validator: (_, value) =>
                  /^\d+([.,]\d+)?$/.test(String(value)) &&
                  Number.isFinite(Number(String(value).replace(",", ".")))
                    ? Promise.resolve()
                    : Promise.reject(new Error(t("invalidSpacing"))),
              },
            ]}
          >
            <Input inputMode="decimal" />
          </Form.Item>
        </>
      )}
    </Form>
  );
}
