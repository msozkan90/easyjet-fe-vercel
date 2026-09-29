"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  Alert,
  App as AntdApp,
  Button,
  Divider,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  CopyOutlined,
  EditOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { TransferOrdersAPI } from "@/utils/api";
import AddressEditorModal from "@/components/modals/AddressEditorModal";
import { useTranslations } from "@/i18n/use-translations";
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt";
import {
  getQuotedShippingPrice,
  toProductionCarrierService,
} from "@/utils/productionCarrierService";

const SERVICE_TABS = {
  EASYJET: "easyjet",
  COMPANY: "company",
  PARTNER: "partner",
  CUSTOMER: "customer",
};

const SOURCE_BY_TAB = {
  [SERVICE_TABS.EASYJET]: "easyjet",
  [SERVICE_TABS.COMPANY]: "shipStationCompany",
  [SERVICE_TABS.PARTNER]: "shipStationPartner",
  [SERVICE_TABS.CUSTOMER]: "shipStationCustomer",
};

const PRODUCTION_OPTIONS = {
  LABEL_PURCHASE: "label_purchase",
  HAS_LABEL: "has_label",
  NO_LABEL: "no_label",
  LOCAL_PICKUP: "local_pickup",
};

const LABEL_FILE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const MAX_LABEL_FILE_SIZE = 20 * 1024 * 1024;

const getRateKey = (rate) =>
  [
    rate?.carrier || "carrier",
    rate?.carrierServiceId ||
      rate?.serviceCode ||
      rate?.serviceName ||
      "service",
    rate?.packageTypeId || "pkg",
  ].join("-");

const formatAmount = (value, fallback = "-") => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const normalizeAddress = (order) => {
  const nested = order?.shipping_address || {};
  return {
    bill_to_name: order?.bill_to_name || nested?.bill_to_name || "",
    ship_to_name: nested?.ship_to_name || order?.ship_to_name || "",
    ship_to_company: nested?.ship_to_company || order?.ship_to_company || "",
    ship_to_street1: nested?.ship_to_street1 || order?.ship_to_street1 || "",
    ship_to_street2: nested?.ship_to_street2 || order?.ship_to_street2 || "",
    ship_to_street3: "",
    ship_to_city: nested?.ship_to_city || order?.ship_to_city || "",
    ship_to_state: nested?.ship_to_state || order?.ship_to_state || "",
    ship_to_postal_code:
      nested?.ship_to_postal_code || order?.ship_to_postal_code || "",
    ship_to_country: nested?.ship_to_country || order?.ship_to_country || "",
    ship_to_phone: nested?.ship_to_phone || order?.ship_to_phone || "",
    customer_email: nested?.customer_email || order?.customer_email || "",
  };
};

export default function TransferProductionModal({
  open,
  transferOrder,
  onClose,
  onSuccess,
}) {
  const { message } = AntdApp.useApp();
  const tOrders = useTranslations("dashboard.orders");
  const tModal = useTranslations(
    "dashboard.orders.transferProductionLabelModal",
  );
  const tShipping = useTranslations("dashboard.orders.transferShippingModal");
  const tCommonActions = useTranslations("common.actions");
  const user = useSelector((state) => state.auth.user);
  const [form] = Form.useForm();
  const { confirmIfDirty, unsavedChangesModalContextHolder } =
    useUnsavedChangesPrompt();

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
    [SERVICE_TABS.CUSTOMER]: [],
  });
  const [selectedRateKey, setSelectedRateKey] = useState(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [productionOption, setProductionOption] = useState(
    PRODUCTION_OPTIONS.LABEL_PURCHASE,
  );
  const [labelFiles, setLabelFiles] = useState([]);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressEditorOpen, setAddressEditorOpen] = useState(false);
  const [addressInfo, setAddressInfo] = useState(
    normalizeAddress(transferOrder),
  );

  const parentEntity = user?.parent_entity || {};
  const entity = user?.entity || {};
  const companyInfo = parentEntity?.company || entity;
  const partnerInfo = parentEntity?.partner;
  const customerInfo = entity?.entity_type === "customer" ? entity : null;
  const hasCompanySSApi =
    Boolean(companyInfo?.has_shipstation_shipping) &&
    Boolean(companyInfo?.permissions?.CAN_USE_SS_SHIPMENT);
  const hasPartnerSSApi =
    Boolean(partnerInfo?.has_shipstation_shipping) &&
    Boolean(partnerInfo?.permissions?.CAN_USE_SS_SHIPMENT);
  const hasCustomerSSApi =
    Boolean(customerInfo?.has_shipstation_shipping) &&
    Boolean(customerInfo?.permissions?.CAN_USE_SS_SHIPMENT);
  const hasSystemApi = Boolean(companyInfo?.permissions?.CAN_USE_NS_SHIPMENT);
  const companyTabLabel =
    companyInfo?.company_name ||
    companyInfo?.name ||
    companyInfo?.entity_name ||
    tShipping("tabs.company");
  const partnerTabLabel =
    partnerInfo?.company_name ||
    partnerInfo?.name ||
    partnerInfo?.entity_name ||
    tShipping("tabs.partner");
  const tabs = useMemo(() => {
    const items = [];
    if (hasSystemApi) {
      items.push({
        key: SERVICE_TABS.EASYJET,
        label: tShipping("tabs.easyjet"),
      });
    }
    if (hasCompanySSApi) {
      items.push({
        key: SERVICE_TABS.COMPANY,
        label: companyTabLabel,
      });
    }
    if (hasPartnerSSApi) {
      items.push({
        key: SERVICE_TABS.PARTNER,
        label: partnerTabLabel,
      });
    }
    if (hasCustomerSSApi) {
      items.push({
        key: SERVICE_TABS.CUSTOMER,
        label: customerInfo?.entity_name || tShipping("tabs.customer"),
      });
    }
    return items;
  }, [
    companyTabLabel,
    hasCompanySSApi,
    hasPartnerSSApi,
    hasCustomerSSApi,
    hasSystemApi,
    partnerTabLabel,
    customerInfo?.entity_name,
    tShipping,
  ]);

  const items = useMemo(
    () => (Array.isArray(transferOrder?.items) ? transferOrder.items : []),
    [transferOrder?.items],
  );
  const transferOrderId = transferOrder?.id || transferOrder?.transfer_order_id;

  useEffect(() => {
    if (!open) return;
    const normalizedAddress = normalizeAddress(transferOrder);
    setAddressInfo(normalizedAddress);
    form.setFieldsValue(normalizedAddress);
    setRatesByTab({
      [SERVICE_TABS.EASYJET]: [],
      [SERVICE_TABS.COMPANY]: [],
      [SERVICE_TABS.PARTNER]: [],
      [SERVICE_TABS.CUSTOMER]: [],
    });
    setSelectedRateKey(null);
    setProductionOption(PRODUCTION_OPTIONS.LABEL_PURCHASE);
    setLabelFiles([]);
    setWeightLb(null);
    setWeightOz(null);
    setLengthIn(null);
    setWidthIn(null);
    setHeightIn(null);
    setAddressEditorOpen(false);
  }, [form, open, transferOrder]);

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [tabs, activeTab]);

  const activeRates = ratesByTab[activeTab] || [];
  const sortedActiveRates = useMemo(
    () =>
      [...activeRates].sort((a, b) => {
        const left = Number.isFinite(Number(a?.amount))
          ? getQuotedShippingPrice(a, activeTab === SERVICE_TABS.EASYJET)
          : Number.POSITIVE_INFINITY;
        const right = Number.isFinite(Number(b?.amount))
          ? getQuotedShippingPrice(b, activeTab === SERVICE_TABS.EASYJET)
          : Number.POSITIVE_INFINITY;
        return (
          (Number.isFinite(left) ? left : Number.POSITIVE_INFINITY) -
          (Number.isFinite(right) ? right : Number.POSITIVE_INFINITY)
        );
      }),
    [activeRates, activeTab],
  );
  const selectedRate = useMemo(
    () =>
      activeRates.find((rate) => getRateKey(rate) === selectedRateKey) || null,
    [activeRates, selectedRateKey],
  );

  const validateInputs = useCallback(() => {
    if (!transferOrderId) {
      message.error(tShipping("messages.transferOrderNotFound"));
      return false;
    }
    if (!lengthIn || !widthIn || !heightIn) {
      message.warning(tShipping("validation.packageDimensionsRequired"));
      return false;
    }
    const hasOz = Number(weightOz) > 0;
    const hasLb = Number(weightLb) > 0;
    if (hasOz === hasLb) {
      message.warning(tShipping("validation.weightExclusive"));
      return false;
    }
    if (!tabs.length || !SOURCE_BY_TAB[activeTab]) {
      message.warning(tShipping("validation.shippingSourceInvalid"));
      return false;
    }
    return true;
  }, [
    activeTab,
    heightIn,
    lengthIn,
    message,
    tabs.length,
    transferOrderId,
    tShipping,
    weightLb,
    weightOz,
    widthIn,
  ]);

  const handleQuoteRates = useCallback(async () => {
    if (!validateInputs()) return;
    setLoadingRates(true);
    try {
      const response = await TransferOrdersAPI.productionShippingQuoteRates({
        transfer_order_id: transferOrderId,
        source: SOURCE_BY_TAB[activeTab],
        ...(Number(weightOz) > 0
          ? { weightOz: Number(weightOz) }
          : { weightLb: Number(weightLb) }),
        lengthIn: Number(lengthIn),
        widthIn: Number(widthIn),
        heightIn: Number(heightIn),
      });
      const rates = Array.isArray(response?.data?.rates)
        ? response.data.rates
        : [];
      setRatesByTab((prev) => ({ ...prev, [activeTab]: rates }));
      setSelectedRateKey(rates.length ? getRateKey(rates[0]) : null);
      if (!rates.length) {
        message.warning(tShipping("messages.noRatesFound"));
      }
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          tShipping("messages.rateQuoteError"),
      );
    } finally {
      setLoadingRates(false);
    }
  }, [
    activeTab,
    heightIn,
    lengthIn,
    message,
    transferOrderId,
    validateInputs,
    weightLb,
    weightOz,
    widthIn,
    tShipping,
  ]);

  const handleCreateLabel = useCallback(async () => {
    if (!validateInputs()) return;
    if (!selectedRate) {
      message.warning(tShipping("validation.selectRateFirst"));
      return;
    }
    setCreatingLabel(true);
    try {
      const { baseAmount } = selectedRate;
      const response = await TransferOrdersAPI.createProductionShipmentLabel({
        transfer_order_id: transferOrderId,
        order_price: Number(transferOrder?.design_total_price || 0),
        shipping_price: getQuotedShippingPrice(
          selectedRate,
          activeTab === SERVICE_TABS.EASYJET,
        ),
        ...(activeTab === SERVICE_TABS.EASYJET
          ? { postage_fee: Number(selectedRate.postageFee || 0) }
          : {}),
        ...(Number.isFinite(Number(baseAmount))
          ? { base_shipping_price: Number(baseAmount) }
          : {}),
        carrier_service: toProductionCarrierService(selectedRate),
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
      message.success(tModal("messages.labelCreated"));
      onSuccess?.(response?.data || null);
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          tModal("messages.labelCreateError"),
      );
    } finally {
      setCreatingLabel(false);
    }
  }, [
    activeTab,
    heightIn,
    lengthIn,
    message,
    onSuccess,
    selectedRate,
    tModal,
    transferOrder,
    transferOrderId,
    validateInputs,
    weightLb,
    weightOz,
    widthIn,
    tShipping,
  ]);

  const validateLabelFile = useCallback(
    (file) => {
      if (!LABEL_FILE_TYPES.has(file?.type)) {
        message.error(tModal("validation.invalidLabelType"));
        return Upload.LIST_IGNORE;
      }
      if (Number(file?.size || 0) > MAX_LABEL_FILE_SIZE) {
        message.error(tModal("validation.invalidLabelSize"));
        return Upload.LIST_IGNORE;
      }
      return false;
    },
    [message, tModal],
  );

  const handleSendWithoutPurchase = useCallback(async () => {
    if (!transferOrderId) {
      message.error(tShipping("messages.transferOrderNotFound"));
      return;
    }
    const selectedLabelFile = labelFiles[0]?.originFileObj;
    if (
      productionOption === PRODUCTION_OPTIONS.HAS_LABEL &&
      !selectedLabelFile
    ) {
      message.error(tModal("validation.labelImageRequired"));
      return;
    }

    const payload = new FormData();
    payload.append("transfer_order_id", String(transferOrderId));
    payload.append("label_purchase_option", productionOption);
    if (selectedLabelFile) {
      payload.append("label_image", selectedLabelFile);
    }

    setCreatingLabel(true);
    try {
      const response = await TransferOrdersAPI.sendToProduction(payload);
      message.success(tModal("messages.productionSuccess"));
      onSuccess?.(response?.data || null);
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          tModal("messages.productionError"),
      );
    } finally {
      setCreatingLabel(false);
    }
  }, [
    labelFiles,
    message,
    onSuccess,
    productionOption,
    tModal,
    transferOrderId,
    tShipping,
  ]);

  const handleSubmit = useCallback(() => {
    if (productionOption === PRODUCTION_OPTIONS.LABEL_PURCHASE) {
      return handleCreateLabel();
    }
    return handleSendWithoutPurchase();
  }, [handleCreateLabel, handleSendWithoutPurchase, productionOption]);

  const handleAddressSave = useCallback(async () => {
    setSavingAddress(true);
    try {
      const values = await form.validateFields();
      const payload = {
        transfer_order_id: transferOrderId,
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
      await TransferOrdersAPI.updateProductionShippingAddress(payload);
      const normalized = normalizeAddress({ ...transferOrder, ...values });
      setAddressInfo(normalized);
      message.success(tShipping("messages.addressUpdated"));
      setAddressEditorOpen(false);
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          tShipping("messages.addressUpdateError"),
      );
    } finally {
      setSavingAddress(false);
    }
  }, [form, message, tShipping, transferOrder, transferOrderId]);

  const handleAddressSelect = useCallback(
    (payload) => {
      if (!payload) return;
      const updates = {};
      if (payload.street1 !== undefined)
        updates.ship_to_street1 = payload.street1;
      if (payload.street2 !== undefined)
        updates.ship_to_street2 = payload.street2;
      if (payload.street3 !== undefined)
        updates.ship_to_street3 = payload.street3;
      if (payload.city !== undefined) updates.ship_to_city = payload.city;
      if (payload.state !== undefined) updates.ship_to_state = payload.state;
      if (payload.postalCode !== undefined)
        updates.ship_to_postal_code = payload.postalCode;
      if (payload.country !== undefined)
        updates.ship_to_country = payload.country;
      if (Object.keys(updates).length) form.setFieldsValue(updates);
    },
    [form],
  );

  const renderAddress = () => {
    const addressLines = [
      [
        addressInfo?.ship_to_street1,
        addressInfo?.ship_to_street2,
        addressInfo?.ship_to_street3,
      ]
        .filter(Boolean)
        .join(", "),
      [
        addressInfo?.ship_to_city,
        addressInfo?.ship_to_state,
        addressInfo?.ship_to_postal_code,
      ]
        .filter(Boolean)
        .join(", "),
      addressInfo?.ship_to_country,
    ].filter(Boolean);

    return (
      <div className="space-y-1 text-sm text-gray-700">
        <div className="font-semibold text-gray-900">
          {addressInfo?.ship_to_name || addressInfo?.bill_to_name || "-"}
        </div>
        {addressLines.length
          ? addressLines.map((line) => <div key={line}>{line}</div>)
          : "-"}
        {addressInfo?.ship_to_phone ? (
          <div>
            {tShipping("address.phone")}: {addressInfo.ship_to_phone}
          </div>
        ) : null}
        {addressInfo?.customer_email ? (
          <div>
            {tShipping("address.email")}: {addressInfo.customer_email}
          </div>
        ) : null}
      </div>
    );
  };

  const deliveryMethod = transferOrder?.delivery_method || null;
  const isPurchaseMode = productionOption === PRODUCTION_OPTIONS.LABEL_PURCHASE;
  const selectedLabelFile = labelFiles[0]?.originFileObj;
  const selectedShippingPrice = getQuotedShippingPrice(
    selectedRate,
    activeTab === SERVICE_TABS.EASYJET,
  );
  const orderPrice = Number(transferOrder?.design_total_price || 0);
  const displayedShippingPrice = isPurchaseMode ? selectedShippingPrice : 0;
  const totalItemQuantity = items.reduce(
    (total, item) => total + (Number(item?.quantity) || 0),
    0,
  );
  const canSubmit =
    Boolean(transferOrderId) &&
    (isPurchaseMode
      ? Boolean(tabs.length && selectedRate)
      : productionOption === PRODUCTION_OPTIONS.HAS_LABEL
        ? Boolean(selectedLabelFile)
        : true);
  const submitText = isPurchaseMode
    ? tShipping("actions.createLabel")
    : tModal("actions.sendToProduction");

  return (
    <>
      {unsavedChangesModalContextHolder}
      <Modal
        open={open}
        onCancel={() =>
          confirmIfDirty({
            isDirty: form.isFieldsTouched(true),
            onDiscard: onClose,
          })
        }
        title={tModal("title")}
        width={1120}
        footer={[
          <Button
            key="close"
            onClick={() =>
              confirmIfDirty({
                isDirty: form.isFieldsTouched(true),
                onDiscard: onClose,
              })
            }
          >
            {tCommonActions("close")}
          </Button>,
          <Popconfirm
            key="create"
            title={tModal(
              isPurchaseMode
                ? "confirm.createTitle"
                : "confirm.productionTitle",
            )}
            description={tModal(
              isPurchaseMode
                ? "confirm.createDescription"
                : `confirm.${productionOption}Description`,
            )}
            okText={submitText}
            cancelText={tCommonActions("cancel")}
            okButtonProps={{ type: "primary", loading: creatingLabel }}
            disabled={creatingLabel || !canSubmit}
            onConfirm={handleSubmit}
          >
            <Button
              type="primary"
              loading={creatingLabel}
              disabled={!canSubmit}
            >
              {submitText}
            </Button>
          </Popconfirm>,
        ]}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={16}>
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-md">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {tShipping("items.title")}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {tShipping("items.subtitle")}
                </Typography.Text>
              </div>
              <div className="text-right">
                <Typography.Text type="secondary" style={{ display: "block" }}>
                  {tModal("summary.orderTotal")}
                </Typography.Text>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  $ {formatAmount(orderPrice, "0.00")}
                </Typography.Title>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-start gap-1">
              <Tag className="rounded-full" color="geekblue">
                {tOrders("columns.orderNumber")}:{" "}
                {transferOrder?.order_number || "-"}
              </Tag>
              <Tag className="rounded-full" color="gold">
                {tOrders("columns.customerName")}:{" "}
                {transferOrder?.bill_to_name || "-"}
              </Tag>
              <Tag className="rounded-full" color="purple">
                {tShipping("items.itemCount")}: {items.length}
              </Tag>
              <Tag className="rounded-full" color="green">
                {tOrders("columns.quantity")}: {totalItemQuantity}
              </Tag>
              {deliveryMethod ? (
                <Tag className="rounded-full" color="cyan">
                  <Space size={4}>
                    <span>
                      {tOrders("columns.deliveryMethod")}: {deliveryMethod}
                    </span>
                    <Button
                      size="small"
                      type="text"
                      icon={<CopyOutlined />}
                      aria-label={tCommonActions("copy")}
                      title={tCommonActions("copy")}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void navigator.clipboard?.writeText?.(deliveryMethod);
                      }}
                    />
                  </Space>
                </Tag>
              ) : null}
            </div>

            <div className="mt-4 max-h-[285px] space-y-3 overflow-y-auto pr-1">
              {items.map((item, index) => (
                <div
                  key={item?.id || `item-${index}`}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900">
                      {item?.name || "-"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {tOrders("columns.product")}:{" "}
                      {item?.transfer_product?.name || "-"}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {tOrders("columns.quantity")}: {item?.quantity ?? "-"}
                  </div>
                  {item?.status ? <Tag color="blue">{item.status}</Tag> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm">
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              {tModal("fields.labelPurchaseOption")}
            </Typography.Title>
            <Tabs
              activeKey={productionOption}
              onChange={(option) => {
                setProductionOption(option);
                setLabelFiles([]);
                setRatesByTab({
                  [SERVICE_TABS.EASYJET]: [],
                  [SERVICE_TABS.COMPANY]: [],
                  [SERVICE_TABS.PARTNER]: [],
                  [SERVICE_TABS.CUSTOMER]: [],
                });
                setSelectedRateKey(null);
              }}
              items={[
                {
                  key: PRODUCTION_OPTIONS.LABEL_PURCHASE,
                  label: tModal("options.labelPurchase"),
                },
                {
                  key: PRODUCTION_OPTIONS.HAS_LABEL,
                  label: tModal("options.hasLabel"),
                },
                {
                  key: PRODUCTION_OPTIONS.NO_LABEL,
                  label: tModal("options.noLabel"),
                },
                {
                  key: PRODUCTION_OPTIONS.LOCAL_PICKUP,
                  label: tModal("options.localPickup"),
                },
              ]}
            />
          </div>

          {isPurchaseMode ? (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-md space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      {tShipping("package.title")}
                    </Typography.Title>
                    <Button
                      icon={<ReloadOutlined />}
                      type="primary"
                      ghost
                      onClick={handleQuoteRates}
                      loading={loadingRates}
                    >
                      {tShipping("package.refreshRates")}
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {tShipping("package.weightLb")}
                      </div>
                      <InputNumber
                        placeholder="0"
                        min={0}
                        style={{ width: "100%" }}
                        value={weightLb}
                        onChange={setWeightLb}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {tShipping("package.weightOz")}
                      </div>
                      <InputNumber
                        placeholder="0"
                        min={0}
                        style={{ width: "100%" }}
                        value={weightOz}
                        onChange={setWeightOz}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {tShipping("package.lengthIn")}
                      </div>
                      <InputNumber
                        placeholder="0"
                        min={0}
                        style={{ width: "100%" }}
                        value={lengthIn}
                        onChange={setLengthIn}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {tShipping("package.widthIn")}
                      </div>
                      <InputNumber
                        placeholder="0"
                        min={0}
                        style={{ width: "100%" }}
                        value={widthIn}
                        onChange={setWidthIn}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {tShipping("package.heightIn")}
                      </div>
                      <InputNumber
                        placeholder="0"
                        min={0}
                        style={{ width: "100%" }}
                        value={heightIn}
                        onChange={setHeightIn}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-md space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      {tShipping("service.title")}
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      {tShipping("service.subtitle")}
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
                      placeholder={tShipping("service.selectPlaceholder")}
                      options={sortedActiveRates.map((rate) => ({
                        label: `${rate.carrier || "-"} - ${rate.serviceName || "-"} ($${formatAmount(getQuotedShippingPrice(rate, activeTab === SERVICE_TABS.EASYJET), "0.00")})`,
                        value: getRateKey(rate),
                      }))}
                      value={selectedRateKey || undefined}
                      onChange={setSelectedRateKey}
                      style={{ width: "100%" }}
                      showSearch
                      optionFilterProp="label"
                    />
                  </Spin>
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>{tShipping("summary.selectedShippingRate")}</span>
                      <strong>
                        ${" "}
                        {formatAmount(
                          getQuotedShippingPrice(
                            selectedRate,
                            activeTab === SERVICE_TABS.EASYJET,
                          ),
                          "0.00",
                        )}
                      </strong>
                    </div>
                    <Typography.Text type="secondary">
                      {tShipping("summary.selectedService")}:{" "}
                      {selectedRate
                        ? `${selectedRate?.carrier || "-"} / ${selectedRate?.serviceName || selectedRate?.serviceCode || "-"}`
                        : "-"}
                    </Typography.Text>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {productionOption === PRODUCTION_OPTIONS.HAS_LABEL ? (
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-md">
              <Typography.Title level={4} style={{ marginTop: 0 }}>
                {tModal("upload.title")}
              </Typography.Title>
              <Typography.Paragraph type="secondary">
                {tModal("upload.help")}
              </Typography.Paragraph>
              <Upload
                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                maxCount={1}
                fileList={labelFiles}
                beforeUpload={validateLabelFile}
                onChange={({ fileList }) => setLabelFiles(fileList.slice(-1))}
              >
                <Button icon={<UploadOutlined />}>
                  {tModal("actions.uploadLabel")}
                </Button>
              </Upload>
            </div>
          ) : null}

          {productionOption === PRODUCTION_OPTIONS.NO_LABEL ? (
            <Alert
              type="info"
              showIcon
              message={tModal("noLabel.title")}
              description={tModal("noLabel.description")}
            />
          ) : null}

          {productionOption === PRODUCTION_OPTIONS.LOCAL_PICKUP ? (
            <Alert
              type="warning"
              showIcon
              message={tModal("localPickup.title")}
              description={tModal("localPickup.description")}
            />
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {tShipping("address.title")}
                </Typography.Title>
                <Button
                  icon={<EditOutlined />}
                  type="text"
                  onClick={() => setAddressEditorOpen(true)}
                >
                  {tCommonActions("edit")}
                </Button>
              </div>
              <Divider style={{ margin: "16px 0" }} />
              {renderAddress()}
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 shadow-inner space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {tModal("summary.orderTotal")}
                </span>
                <span className="text-base font-semibold text-gray-900">
                  $ {formatAmount(orderPrice, "0.00")}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {tModal("summary.shippingTotal")}
                </span>
                <span className="text-base font-semibold text-gray-900">
                  $ {formatAmount(displayedShippingPrice, "0.00")}
                </span>
              </div>
              <Divider style={{ margin: "8px 0" }} />
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">
                  {tModal("summary.grandTotal")}
                </span>
                <span className="text-2xl font-bold text-gray-900">
                  $ {formatAmount(orderPrice + displayedShippingPrice, "0.00")}
                </span>
              </div>
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
            transferOrder?.order_date
              ? new Date(transferOrder.order_date).toLocaleString()
              : "-"
          }
          showRecipientFields
          requireShipToPhone
          zIndex={1500}
        />
      </Modal>
    </>
  );
}
