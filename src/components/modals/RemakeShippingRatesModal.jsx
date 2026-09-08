"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Tabs,
  Typography,
  Upload,
} from "antd";
import { InboxOutlined, ReloadOutlined } from "@ant-design/icons";
import { NestShipperAPI, OrdersAPI, ShipStationAPI, WalletAPI } from "@/utils/api";
import { setBalance } from "@/redux/features/balanceSlice";
import { useTranslations } from "@/i18n/use-translations";

const SOURCES = {
  easyjet: "easyjet",
  company: "shipStationCompany",
  partner: "shipStationPartner",
};
const FILE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const idempotencyKey = () => crypto.randomUUID();
const rateKey = (rate) =>
  [rate?.rateId, rate?.carrier, rate?.serviceCode || rate?.serviceName].filter(Boolean).join(":");

const initialMeasurements = (order) => {
  const weight = order?.weight || {};
  const dimensions = order?.dimensions || {};
  const units = String(weight?.units || "").toLowerCase();
  return {
    weightLb: ["lb", "lbs", "pound", "pounds"].includes(units) ? Number(weight.value) : null,
    weightOz: ["oz", "ounce", "ounces"].includes(units) ? Number(weight.value) : null,
    lengthIn: Number(dimensions?.length) || null,
    widthIn: Number(dimensions?.width) || null,
    heightIn: Number(dimensions?.height) || null,
  };
};

export default function RemakeShippingRatesModal({ open, order, onClose, onCreated }) {
  const { message } = AntdApp.useApp();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const t = useTranslations("dashboard.orders.shippingModal");
  const tActions = useTranslations("common.actions");
  const [form] = Form.useForm();
  const [mode, setMode] = useState("purchase");
  const [activeTab, setActiveTab] = useState("easyjet");
  const [rates, setRates] = useState([]);
  const [selectedRateKey, setSelectedRateKey] = useState(null);
  const [labelFiles, setLabelFiles] = useState([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestKey, setRequestKey] = useState(idempotencyKey);

  const parent = user?.parent_entity || {};
  const company = parent?.company || user?.entity || {};
  const partner = parent?.partner || null;
  const tabs = useMemo(() => {
    const result = [];
    if (company?.permissions?.CAN_USE_NS_SHIPMENT) {
      result.push({ key: "easyjet", label: t("service.tabs.easyjet") });
    }
    if (company?.has_shipstation_shipping && company?.permissions?.CAN_USE_SS_SHIPMENT) {
      result.push({
        key: "company",
        label: t("service.tabs.company", { name: company?.name || company?.entity_name || "Company" }),
      });
    }
    if (partner?.has_shipstation_shipping && partner?.permissions?.CAN_USE_SS_SHIPMENT) {
      result.push({
        key: "partner",
        label: t("service.tabs.partner", { name: partner?.name || partner?.entity_name || "Partner" }),
      });
    }
    return result;
  }, [company, partner, t]);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(initialMeasurements(order));
    setMode("purchase");
    setRates([]);
    setSelectedRateKey(null);
    setLabelFiles([]);
    setRequestKey(idempotencyKey());
  }, [form, open, order]);

  useEffect(() => {
    if (tabs.length && !tabs.some((tab) => tab.key === activeTab)) setActiveTab(tabs[0].key);
  }, [activeTab, tabs]);

  const selectedRate = rates.find((rate) => rateKey(rate) === selectedRateKey) || null;
  const address = [
    order?.ship_to_name,
    [order?.ship_to_street1, order?.ship_to_street2, order?.ship_to_street3].filter(Boolean).join(", "),
    [order?.ship_to_city, order?.ship_to_state, order?.ship_to_postal_code].filter(Boolean).join(", "),
    order?.ship_to_country,
  ].filter(Boolean);

  const getMeasurements = useCallback(async () => {
    const values = await form.validateFields();
    const hasLb = Number(values.weightLb) > 0;
    const hasOz = Number(values.weightOz) > 0;
    if (hasLb === hasOz) {
      message.warning(t("errors.weightRequired"));
      return null;
    }
    return values;
  }, [form, message, t]);

  const fetchRates = useCallback(async () => {
    if (!order?.id || !SOURCES[activeTab]) return;
    const values = await getMeasurements();
    if (!values) return;
    setLoadingRates(true);
    try {
      const payload = {
        order_id: order.id,
        item_ids: (order.items || []).map((item) => item.id).filter(Boolean),
        weightLb: values.weightLb || undefined,
        weightOz: values.weightOz || undefined,
        lengthIn: values.lengthIn,
        widthIn: values.widthIn,
        heightIn: values.heightIn,
      };
      const response =
        activeTab === "easyjet"
          ? await NestShipperAPI.quoteRates(payload)
          : await ShipStationAPI.quoteRates({
              ...payload,
              entity_type: activeTab === "partner" ? "partner" : "company",
            });
      const list = Array.isArray(response?.data?.rates)
        ? response.data.rates
        : Array.isArray(response?.data)
          ? response.data
          : [];
      const sorted = [...list].sort((a, b) => Number(a?.amount || 0) - Number(b?.amount || 0));
      setRates(sorted);
      setSelectedRateKey(sorted[0] ? rateKey(sorted[0]) : null);
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("service.notFound"));
    } finally {
      setLoadingRates(false);
    }
  }, [activeTab, getMeasurements, message, order, t]);

  const submit = useCallback(async () => {
    if (!order?.id) return;
    setSubmitting(true);
    try {
      let response;
      if (mode === "upload") {
        const file = labelFiles[0]?.originFileObj || labelFiles[0];
        if (!file) {
          message.warning(t("upload.required"));
          return;
        }
        const payload = new FormData();
        payload.append("order_id", order.id);
        payload.append("idempotency_key", requestKey);
        payload.append("source", "self_label");
        payload.append("label_file", file);
        response = await OrdersAPI.createRemakeShipmentLabelWithFile(payload);
      } else {
        if (!selectedRate) return;
        const values = await getMeasurements();
        if (!values) return;
        response = await OrdersAPI.createRemakeShipmentLabel({
          order_id: order.id,
          idempotency_key: requestKey,
          source: SOURCES[activeTab],
          shipping_price: Number(selectedRate.amount),
          carrier_service: selectedRate,
          weight: {
            units: values.weightOz ? "ounces" : "pounds",
            value: Number(values.weightOz || values.weightLb),
            WeightUnits: 1,
          },
          dimensions: {
            units: "inches",
            length: Number(values.lengthIn),
            width: Number(values.widthIn),
            height: Number(values.heightIn),
          },
        });
      }
      try {
        const walletResponse = await WalletAPI.getBalance();
        const nextBalance = Number(walletResponse?.data?.balance ?? walletResponse?.data);
        if (Number.isFinite(nextBalance)) dispatch(setBalance(nextBalance));
      } catch {}
      message.success(t("actions.labelCreateSuccess"));
      onCreated?.(response?.data || {});
    } catch (error) {
      message.error(error?.response?.data?.error?.message || t("actions.labelCreateError"));
    } finally {
      setSubmitting(false);
    }
  }, [activeTab, dispatch, getMeasurements, labelFiles, message, mode, onCreated, order, requestKey, selectedRate, t]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={900}
      title={t("title")}
      footer={[
        <Button key="close" onClick={onClose}>{tActions("close")}</Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          disabled={mode === "upload" ? !labelFiles.length : !selectedRate}
          onClick={() => void submit()}
        >
          {t("actions.createShipmentLabel")}
        </Button>,
      ]}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card size="small" title={`${t("items.orderNumber")}: ${order?.order_number || "-"}`}>
          <Typography.Text>{address.join(" · ") || "-"}</Typography.Text>
        </Card>
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          options={[
            { value: "purchase", label: t("modes.purchase") },
            { value: "upload", label: t("modes.upload") },
          ]}
        />
        {mode === "upload" ? (
          <Upload.Dragger
            maxCount={1}
            fileList={labelFiles}
            beforeUpload={(file) => {
              if (!FILE_TYPES.has(file.type)) {
                message.error(t("upload.invalidType"));
                return Upload.LIST_IGNORE;
              }
              if (file.size > MAX_FILE_SIZE) {
                message.error(t("upload.invalidSize"));
                return Upload.LIST_IGNORE;
              }
              return false;
            }}
            onChange={({ fileList }) => setLabelFiles(fileList)}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p>{t("upload.action")}</p>
            <p className="ant-upload-hint">{t("upload.help")}</p>
          </Upload.Dragger>
        ) : (
          <>
            <Form
              form={form}
              layout="vertical"
              onValuesChange={() => {
                setRates([]);
                setSelectedRateKey(null);
              }}
            >
              <Row gutter={12}>
                {["weightLb", "weightOz", "lengthIn", "widthIn", "heightIn"].map((field) => (
                  <Col xs={12} md={field.startsWith("weight") ? 6 : 4} key={field}>
                    <Form.Item
                      name={field}
                      label={t(`package.labels.${field}`)}
                      rules={field.startsWith("weight") ? [] : [{ required: true }]}
                    >
                      <InputNumber min={0} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </Form>
            <Tabs activeKey={activeTab} onChange={(key) => { setActiveTab(key); setRates([]); setSelectedRateKey(null); }} items={tabs} />
            <Space.Compact style={{ width: "100%" }}>
              <Select
                style={{ width: "100%" }}
                placeholder={t("service.placeholder")}
                value={selectedRateKey}
                onChange={setSelectedRateKey}
                options={rates.map((rate) => ({
                  value: rateKey(rate),
                  label: `${rate.carrier || "-"} · ${rate.serviceName || rate.serviceCode || "-"} · $${Number(rate.amount || 0).toFixed(2)}`,
                }))}
              />
              <Button icon={<ReloadOutlined />} loading={loadingRates} onClick={() => void fetchRates()}>
                {t("package.refresh")}
              </Button>
            </Space.Compact>
          </>
        )}
      </Space>
    </Modal>
  );
}
