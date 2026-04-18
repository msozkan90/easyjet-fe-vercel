"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  App as AntdApp,
  Button,
  Divider,
  Form,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { EditOutlined, ReloadOutlined } from "@ant-design/icons";
import { TransferOrdersAPI } from "@/utils/api";
import AddressEditorModal from "@/components/modals/AddressEditorModal";

const SERVICE_TABS = {
  EASYJET: "easyjet",
  COMPANY: "company",
  PARTNER: "partner",
};

const SOURCE_BY_TAB = {
  [SERVICE_TABS.EASYJET]: "easyjet",
  [SERVICE_TABS.COMPANY]: "shipStationCompany",
  [SERVICE_TABS.PARTNER]: "shipStationPartner",
};

const STATUS_COLORS = {
  newOrder: "geekblue",
  processing: "purple",
  downloaded: "blue",
  printed: "green",
  shipped: "gold",
  waitingForDesign: "orange",
  cancel: "red",
  refund: "volcano",
  remake: "magenta",
};

const formatAmount = (value, fallback = "-") => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getRateKey = (rate) =>
  [
    rate?.carrier || "carrier",
    rate?.carrierServiceId || rate?.serviceCode || rate?.serviceName || "service",
    rate?.packageTypeId || "pkg",
  ].join("-");

const normalizeAddress = (order) => ({
  bill_to_name: order?.bill_to_name || "",
  ship_to_name: order?.shipping_address?.ship_to_name || "",
  ship_to_company: order?.shipping_address?.ship_to_company || "",
  ship_to_street1: order?.shipping_address?.ship_to_street1 || "",
  ship_to_street2: order?.shipping_address?.ship_to_street2 || "",
  ship_to_street3: "",
  ship_to_city: order?.shipping_address?.ship_to_city || "",
  ship_to_state: order?.shipping_address?.ship_to_state || "",
  ship_to_postal_code: order?.shipping_address?.ship_to_postal_code || "",
  ship_to_country: order?.shipping_address?.ship_to_country || "",
  ship_to_phone: order?.shipping_address?.ship_to_phone || "",
  customer_email: order?.shipping_address?.customer_email || "",
});

export default function TransferShippingRatesModal({
  open,
  transferOrder,
  orderTotal = 0,
  onClose,
  onLabelCreated,
}) {
  const { message } = AntdApp.useApp();
  const user = useSelector((state) => state.auth.user);
  const [form] = Form.useForm();

  const [weightLb, setWeightLb] = useState(null);
  const [weightOz, setWeightOz] = useState(null);
  const [lengthIn, setLengthIn] = useState(null);
  const [widthIn, setWidthIn] = useState(null);
  const [heightIn, setHeightIn] = useState(null);
  const [activeTab, setActiveTab] = useState(SERVICE_TABS.EASYJET);
  const [ratesByTab, setRatesByTab] = useState({
    [SERVICE_TABS.EASYJET]: [],
    [SERVICE_TABS.COMPANY]: [],
    [SERVICE_TABS.PARTNER]: [],
  });
  const [loadingRates, setLoadingRates] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [selectedRateKey, setSelectedRateKey] = useState(null);
  const [addressEditorOpen, setAddressEditorOpen] = useState(false);
  const [addressInfo, setAddressInfo] = useState(
    normalizeAddress(transferOrder),
  );

  const parentEntity = user?.parent_entity || {};
  const entity = user?.entity || {};
  const companyInfo = parentEntity?.company || entity;
  const partnerInfo = parentEntity?.partner;
  const hasCompanySSApi =
    Boolean(companyInfo?.has_api_v2) &&
    Boolean(companyInfo?.permissions?.CAN_USE_SS_SHIPMENT);
  const hasPartnerSSApi =
    Boolean(partnerInfo?.has_api_v2) &&
    Boolean(partnerInfo?.permissions?.CAN_USE_SS_SHIPMENT);
  const hasSystemApi = Boolean(companyInfo?.permissions?.CAN_USE_NS_SHIPMENT);
  console.log(companyInfo, "companyinfgo");
  const tabs = useMemo(() => {
    const items = [];
    if (hasSystemApi) items.push({ key: SERVICE_TABS.EASYJET, label: "EasyJet" });
    if (hasCompanySSApi) items.push({ key: SERVICE_TABS.COMPANY, label: "Company" });
    if (hasPartnerSSApi) items.push({ key: SERVICE_TABS.PARTNER, label: "Partner" });
    return items;
  }, [hasCompanySSApi, hasPartnerSSApi, hasSystemApi]);

  const items = useMemo(
    () => (Array.isArray(transferOrder?.items) ? transferOrder.items : []),
    [transferOrder?.items],
  );

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    if (!open) return;
    const normalizedAddress = normalizeAddress(transferOrder);
    setAddressInfo(normalizedAddress);
    form.setFieldsValue(normalizedAddress);
    setRatesByTab({
      [SERVICE_TABS.EASYJET]: [],
      [SERVICE_TABS.COMPANY]: [],
      [SERVICE_TABS.PARTNER]: [],
    });
    setSelectedRateKey(null);
    setAddressEditorOpen(false);
  }, [form, open, transferOrder]);

  const activeRates = ratesByTab[activeTab] || [];
  const sortedActiveRates = useMemo(
    () =>
      [...activeRates].sort((a, b) => {
        const left = Number(a?.amount);
        const right = Number(b?.amount);
        return (Number.isFinite(left) ? left : Number.POSITIVE_INFINITY) -
          (Number.isFinite(right) ? right : Number.POSITIVE_INFINITY);
      }),
    [activeRates],
  );
  const selectedRate = useMemo(
    () => activeRates.find((rate) => getRateKey(rate) === selectedRateKey) || null,
    [activeRates, selectedRateKey],
  );

  const shippingAmount = Number(selectedRate?.amount || 0);
  const grandTotal = Number(orderTotal || 0) + (Number.isFinite(shippingAmount) ? shippingAmount : 0);

  const validateInputs = useCallback(() => {
    if (!transferOrder?.id) {
      message.error("Transfer order bulunamadı.");
      return false;
    }
    if (!lengthIn || !widthIn || !heightIn) {
      message.warning("Length, width ve height zorunludur.");
      return false;
    }
    const hasOz = Number(weightOz) > 0;
    const hasLb = Number(weightLb) > 0;
    if (hasOz === hasLb) {
      message.warning("Sadece bir weight alanı girin: lb veya oz.");
      return false;
    }
    if (!SOURCE_BY_TAB[activeTab]) {
      message.warning("Geçerli shipping source bulunamadı.");
      return false;
    }
    return true;
  }, [activeTab, heightIn, lengthIn, message, transferOrder?.id, weightLb, weightOz, widthIn]);

  const handleAddressSave = useCallback(async () => {
    setSavingAddress(true);
    try {
      const values = await form.validateFields();
      const payload = {
        transfer_order_id: transferOrder.id,
        bill_to_name: values?.bill_to_name || undefined,
        ship_to_name: values?.ship_to_name || undefined,
        ship_to_company: values?.ship_to_company || null,
        ship_to_street1: values?.ship_to_street1 || undefined,
        ship_to_street2: values?.ship_to_street2 || null,
        ship_to_city: values?.ship_to_city || undefined,
        ship_to_state: values?.ship_to_state || undefined,
        ship_to_postal_code: values?.ship_to_postal_code || undefined,
        ship_to_country: values?.ship_to_country || undefined,
        ship_to_phone: values?.ship_to_phone || null,
        customer_email: values?.customer_email || null,
      };
      await TransferOrdersAPI.updateWorkerShippingAddress({
        ...payload,
      });
      const normalized = {
        ...values,
        bill_to_name: values?.bill_to_name || "",
        ship_to_name: values?.ship_to_name || "",
        ship_to_company: values?.ship_to_company || "",
        ship_to_street1: values?.ship_to_street1 || "",
        ship_to_street2: values?.ship_to_street2 || "",
        ship_to_street3: values?.ship_to_street3 || "",
        ship_to_city: values?.ship_to_city || "",
        ship_to_state: values?.ship_to_state || "",
        ship_to_postal_code: values?.ship_to_postal_code || "",
        ship_to_country: values?.ship_to_country || "",
        ship_to_phone: values?.ship_to_phone || "",
        customer_email: values?.customer_email || "",
      };
      setAddressInfo(normalized);
      message.success("Shipping address updated.");
      setAddressEditorOpen(false);
    } catch (error) {
      message.error(error?.response?.data?.error?.message || "Address could not be updated.");
    } finally {
      setSavingAddress(false);
    }
  }, [form, message, transferOrder?.id]);

  const handleAddressSelect = useCallback(
    (payload) => {
      if (!payload) return;
      const updates = {};
      if (payload.street1 !== undefined) updates.ship_to_street1 = payload.street1;
      if (payload.street2 !== undefined) updates.ship_to_street2 = payload.street2;
      if (payload.street3 !== undefined) updates.ship_to_street3 = payload.street3;
      if (payload.city !== undefined) updates.ship_to_city = payload.city;
      if (payload.state !== undefined) updates.ship_to_state = payload.state;
      if (payload.postalCode !== undefined) updates.ship_to_postal_code = payload.postalCode;
      if (payload.country !== undefined) updates.ship_to_country = payload.country;
      if (Object.keys(updates).length) {
        form.setFieldsValue(updates);
      }
    },
    [form],
  );

  const renderAddress = useCallback(() => {
    const addressLines = [
      [addressInfo?.ship_to_street1, addressInfo?.ship_to_street2, addressInfo?.ship_to_street3]
        .filter(Boolean)
        .join(", "),
      [addressInfo?.ship_to_city, addressInfo?.ship_to_state, addressInfo?.ship_to_postal_code]
        .filter(Boolean)
        .join(", "),
      addressInfo?.ship_to_country,
    ].filter(Boolean);

    return (
      <div className="space-y-1 text-sm text-gray-700">
        <div className="font-semibold text-gray-900">
          {addressInfo?.ship_to_name || addressInfo?.bill_to_name || transferOrder?.bill_to_name || "-"}
        </div>
        {addressLines.length
          ? addressLines.map((line, idx) => (
              <div key={`${line}-${idx}`}>{line}</div>
            ))
          : "-"}
        {addressInfo?.ship_to_phone ? <div>Phone: {addressInfo.ship_to_phone}</div> : null}
        {addressInfo?.customer_email ? <div>Email: {addressInfo.customer_email}</div> : null}
      </div>
    );
  }, [addressInfo, transferOrder?.bill_to_name]);

  const handleQuoteRates = useCallback(async () => {
    if (!validateInputs()) return;
    setLoadingRates(true);
    try {
      const response = await TransferOrdersAPI.workerShippingQuoteRates({
        transfer_order_id: transferOrder.id,
        source: SOURCE_BY_TAB[activeTab],
        ...(Number(weightOz) > 0 ? { weightOz: Number(weightOz) } : { weightLb: Number(weightLb) }),
        lengthIn: Number(lengthIn),
        widthIn: Number(widthIn),
        heightIn: Number(heightIn),
      });
      const rates = Array.isArray(response?.data?.rates) ? response.data.rates : [];
      setRatesByTab((prev) => ({ ...prev, [activeTab]: rates }));
      setSelectedRateKey(rates.length ? getRateKey(rates[0]) : null);
      if (!rates.length) {
        message.warning("Bu seçenek için rate bulunamadı.");
      }
    } catch (error) {
      message.error(error?.response?.data?.error?.message || "Rate alınamadı.");
    } finally {
      setLoadingRates(false);
    }
  }, [
    activeTab,
    heightIn,
    lengthIn,
    message,
    transferOrder?.id,
    validateInputs,
    weightLb,
    weightOz,
    widthIn,
  ]);

  const handleCreateLabel = useCallback(async () => {
    if (!validateInputs()) return;
    if (!selectedRate) {
      message.warning("Önce bir shipping rate seçin.");
      return;
    }
    setCreatingLabel(true);
    try {
      await TransferOrdersAPI.createWorkerShipmentLabel({
        transfer_order_id: transferOrder.id,
        order_price: Number(orderTotal || 0),
        shipping_price: Number(selectedRate.amount || 0),
        carrier_service: selectedRate,
        weight: {
          units: Number(weightOz) > 0 ? "ounces" : "pounds",
          value: Number(weightOz) > 0 ? Number(weightOz) : Number(weightLb),
          WeightUnits: 1,
        },
        dimensions: {
          units: "inches",
          width: Number(widthIn),
          height: Number(heightIn),
          length: Number(lengthIn),
        },
        source: SOURCE_BY_TAB[activeTab],
      });
      message.success("Label başarıyla oluşturuldu.");
      onLabelCreated?.();
    } catch (error) {
      message.error(error?.response?.data?.error?.message || "Label oluşturulamadı.");
    } finally {
      setCreatingLabel(false);
    }
  }, [
    activeTab,
    heightIn,
    lengthIn,
    message,
    onLabelCreated,
    orderTotal,
    selectedRate,
    transferOrder?.id,
    validateInputs,
    weightLb,
    weightOz,
    widthIn,
  ]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Create Transfer Label"
      width={1280}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        <Button key="create" type="primary" loading={creatingLabel} onClick={handleCreateLabel}>
          Create Label
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: "100%" }} size={16}>
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-start gap-1">
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  Transfer Items
                </Typography.Title>
                <Typography.Text type="secondary">
                  Order items and shipping preparation
                </Typography.Text>
              </div>
              <div>
                <Tag className="rounded-full" color="geekblue">
                  Order: {transferOrder?.order_number || "-"}
                </Tag>
              </div>
              <div>
                <Tag className="rounded-full" color="gold">
                  Customer: {transferOrder?.bill_to_name || "-"}
                </Tag>
              </div>
              <div>
                <Tag className="rounded-full" color="green">
                  Item Count: {items.length}
                </Tag>
              </div>
            </div>
            <div className="text-right">
              <Typography.Text type="secondary" style={{ display: "block" }}>
                Order Total
              </Typography.Text>
              <Typography.Title level={4} style={{ margin: 0 }}>
                $ {formatAmount(orderTotal, "0.00")}
              </Typography.Title>
            </div>
          </div>
          <div className="mt-4 space-y-3 max-h-[285px] overflow-y-auto pr-1">
            {items.map((item, index) => (
              <div
                key={item?.id ?? `transfer-item-${index}`}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 shadow-sm"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <div className="font-semibold text-gray-900">
                    {item?.name || "-"}
                  </div>
                  <div className="text-xs text-gray-500">
                    Product: {item?.transfer_product?.name || "-"}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <div className="font-semibold text-gray-900">
                    Qty: {item?.quantity ?? "-"}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                  <div className="font-semibold text-gray-900">
                    Status:{" "}
                    <Tag color={STATUS_COLORS[item?.status] || "default"} style={{ marginInlineEnd: 0 }}>
                      {item?.status || "-"}
                    </Tag>
                  </div>
                </div>
                <div className="text-base font-semibold text-gray-900">
                  $ {formatAmount(item?.price, "0.00")}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Typography.Title level={4} style={{ margin: 0 }}>
                Package
              </Typography.Title>
              <Button
                icon={<ReloadOutlined />}
                type="primary"
                ghost
                onClick={handleQuoteRates}
                loading={loadingRates}
              >
                Refresh Rates
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Weight (lb)
                </div>
                <InputNumber placeholder="0" min={0} style={{ width: "100%" }} value={weightLb} onChange={setWeightLb} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Weight (oz)
                </div>
                <InputNumber placeholder="0" min={0} style={{ width: "100%" }} value={weightOz} onChange={setWeightOz} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Length (in)
                </div>
                <InputNumber placeholder="0" min={0} style={{ width: "100%" }} value={lengthIn} onChange={setLengthIn} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Width (in)
                </div>
                <InputNumber placeholder="0" min={0} style={{ width: "100%" }} value={widthIn} onChange={setWidthIn} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Height (in)
                </div>
                <InputNumber placeholder="0" min={0} style={{ width: "100%" }} value={heightIn} onChange={setHeightIn} />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Typography.Title level={4} style={{ margin: 0 }}>
                Carrier Service
              </Typography.Title>
              <Typography.Text type="secondary">
                Select and review shipping rates
              </Typography.Text>
            </div>
            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                setActiveTab(key);
                setSelectedRateKey(null);
              }}
              items={tabs}
            />
            <Spin spinning={loadingRates}>
              <Select
                placeholder="Select carrier service"
                options={sortedActiveRates.map((rate) => ({
                  label: `${rate.carrier || "-"} • ${rate.serviceName || "-"} ($${formatAmount(rate.amount, "0.00")})`,
                  value: getRateKey(rate),
                }))}
                value={selectedRateKey || undefined}
                onChange={setSelectedRateKey}
                style={{ width: "100%" }}
                showSearch
                optionFilterProp="label"
              />
            </Spin>
            {selectedRate ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold text-gray-900">
                    {selectedRate.carrier} • {selectedRate.serviceName || selectedRate.serviceCode}
                  </span>
                  <span className="text-base font-semibold text-gray-900">
                    $ {formatAmount(selectedRate.amount, "0.00")}
                  </span>
                </div>
                {selectedRate.zone ? (
                  <div className="text-xs text-gray-500">Zone: {selectedRate.zone}</div>
                ) : null}
                {selectedRate.deliveryDays ? (
                  <div className="text-xs text-gray-500">Delivery days: {selectedRate.deliveryDays}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-md">
            <div className="flex items-center justify-between gap-3">
              <Typography.Title level={4} style={{ margin: 0 }}>
                Shipping Address
              </Typography.Title>
              <Button
                icon={<EditOutlined />}
                type="text"
                onClick={() => setAddressEditorOpen(true)}
              >
                Edit
              </Button>
            </div>
            <Divider style={{ margin: "16px 0" }} />
            {renderAddress()}
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 shadow-inner space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Order Total</span>
              <span className="text-base font-semibold text-gray-900">$ {formatAmount(orderTotal, "0.00")}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Selected Shipping Rate</span>
              <span className="text-base font-semibold text-gray-900">$ {formatAmount(shippingAmount, "0.00")}</span>
            </div>
            <Divider style={{ margin: "8px 0" }} />
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-900">Grand Total</span>
              <span className="text-2xl font-bold text-gray-900">$ {formatAmount(grandTotal, "0.00")}</span>
            </div>
            <Typography.Text type="secondary">
              Selected Service:{" "}
              {selectedRate
                ? `${selectedRate?.carrier || "-"} / ${selectedRate?.serviceName || selectedRate?.serviceCode || "-"}`
                : "-"}
            </Typography.Text>
          </div>
        </div>
      </Space>
      <AddressEditorModal
        open={addressEditorOpen}
        loading={false}
        saving={savingAddress}
        onCancel={() => setAddressEditorOpen(false)}
        onSave={handleAddressSave}
        editForm={form}
        editingOrder={transferOrder}
        onAddressSelect={handleAddressSelect}
        orderDateLabel={
          transferOrder?.order_date ? new Date(transferOrder.order_date).toLocaleString() : "-"
        }
        zIndex={1500}
      />
    </Modal>
  );
}
