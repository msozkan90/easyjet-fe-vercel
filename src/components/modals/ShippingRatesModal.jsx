"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  App as AntdApp,
  Button,
  Divider,
  Empty,
  Image,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { EditOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  NestShipperAPI,
  OrdersAPI,
  ShipStationAPI,
  WalletAPI,
} from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { setBalance } from "@/redux/features/balanceSlice";

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const dimensionToInches = (dimensions, key) => {
  if (!dimensions) return null;
  const units = String(dimensions?.units || "").toLowerCase();
  const allowed = ["inch", "inches", "in"];
  if (units && !allowed.includes(units)) {
    return null;
  }
  return normalizeNumber(dimensions?.[key]);
};

const extractWeightByUnit = (weight) => {
  if (!weight) return { weightLb: null, weightOz: null };
  const value = Number(weight?.value);
  if (!Number.isFinite(value)) {
    return { weightLb: null, weightOz: null };
  }
  const units = String(weight?.units || "").toLowerCase();
  if (["ounce", "ounces", "oz"].includes(units)) {
    return { weightLb: null, weightOz: value };
  }
  if (["pound", "pounds", "lb", "lbs"].includes(units)) {
    return { weightLb: value, weightOz: null };
  }
  return { weightLb: null, weightOz: null };
};

const flattenOrderItems = (record) => {
  if (!record) return [];
  const items = [];
  if (record) {
    items.push(record);
  }
  if (Array.isArray(record?.children)) {
    record.children.forEach((child) => items.push(child));
  }
  return items;
};

const sumOrderItemWeights = (items = []) => {
  let totalOz = 0;
  let hasWeight = false;
  let hasLb = false;
  let hasOz = false;

  items.forEach((item) => {
    const weightSource = item?.order?.weight ?? item?.weight;
    const { weightLb, weightOz } = extractWeightByUnit(weightSource);
    if (weightLb !== null) {
      totalOz += weightLb * 16;
      hasWeight = true;
      hasLb = true;
    }
    if (weightOz !== null) {
      totalOz += weightOz;
      hasWeight = true;
      hasOz = true;
    }
  });

  if (!hasWeight) {
    return { weightLb: null, weightOz: null };
  }
  if (hasLb && !hasOz) {
    return { weightLb: totalOz / 16, weightOz: null };
  }
  return { weightLb: null, weightOz: totalOz };
};

const createQuoteDefaults = (record) => {
  const items = flattenOrderItems(record);
  const dimensions = record?.order?.dimensions;
  if (items.length > 1) {
    const baseWeight = sumOrderItemWeights(items);
    return {
      ...baseWeight,
      lengthIn: dimensionToInches(dimensions, "length"),
      widthIn: dimensionToInches(dimensions, "width"),
      heightIn: dimensionToInches(dimensions, "height"),
    };
  }
  const baseWeight = extractWeightByUnit(record?.order?.weight);
  return {
    ...baseWeight,
    lengthIn: dimensionToInches(dimensions, "length"),
    widthIn: dimensionToInches(dimensions, "width"),
    heightIn: dimensionToInches(dimensions, "height"),
  };
};

const sanitizeQuotePayload = (payload = {}) => {
  const result = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    const numericValue = Number(value);
    if (!Number.isNaN(numericValue)) {
      result[key] = numericValue;
    }
  });
  return result;
};

const getRateKey = (rate) => {
  if (!rate) return undefined;
  return [
    rate.carrier || "carrier",
    rate.carrierServiceId || rate.serviceCode || rate.serviceName || "service",
    rate.packageTypeId || "pkg",
  ].join("-");
};

const getRateAmountForSort = (rate) => {
  const amount = Number(rate?.amount);
  return Number.isFinite(amount) ? amount : Number.POSITIVE_INFINITY;
};

const getSortedRates = (rates = []) =>
  [...rates].sort((a, b) => getRateAmountForSort(a) - getRateAmountForSort(b));

const extractBalanceValue = (response) => {
  const candidate = response?.data?.balance ?? response?.balance;
  const numeric = Number(candidate);
  return Number.isFinite(numeric) ? numeric : null;
};

const SERVICE_TABS = {
  EASYJET: "easyjet",
  COMPANY: "company",
  PARTNER: "partner",
};

const createServiceEntry = () => ({
  rates: [],
  loading: false,
  selectedRateKey: null,
  isQuoteFresh: false,
  hasFetched: false,
});

const createInitialServiceState = () => ({
  [SERVICE_TABS.EASYJET]: createServiceEntry(),
  [SERVICE_TABS.COMPANY]: createServiceEntry(),
  [SERVICE_TABS.PARTNER]: createServiceEntry(),
});

const ShippingRatesModal = ({
  open,
  record,
  onClose,
  formatAmount,
  onEditAddress,
  onSendSuccess,
}) => {
  const { message } = AntdApp.useApp();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const tCommon = useTranslations("common");
  const tCommonActions = useTranslations("common.actions");
  const tShipping = useTranslations("dashboard.orders.shippingModal");
  const [quoteValues, setQuoteValues] = useState(() =>
    createQuoteDefaults(record),
  );
  const [serviceState, setServiceState] = useState(() =>
    createInitialServiceState(),
  );
  const [activeServiceTab, setActiveServiceTab] = useState(
    SERVICE_TABS.EASYJET,
  );
  const [sendingProduction, setSendingProduction] = useState(false);

  const orderId = record?.order?.id ?? record?.order_id;
  const quoteDefaults = useMemo(() => createQuoteDefaults(record), [record]);

  const parentEntity = user?.parent_entity || {};
  const companyInfo = parentEntity?.company;
  const partnerInfo = parentEntity?.partner;
  const hasCompanySSApi =
    Boolean(companyInfo?.has_api_v2) &&
    Boolean(companyInfo?.permissions?.CAN_USE_SS_SHIPMENT);
  const hasPartnerSSApi =
    Boolean(partnerInfo?.has_api_v2) &&
    Boolean(partnerInfo?.permissions?.CAN_USE_SS_SHIPMENT);
  const hasSystemApi = Boolean(companyInfo?.permissions?.CAN_USE_NS_SHIPMENT);

  const serviceTabs = useMemo(() => {
    const tabs = [];
    if (hasSystemApi) {
      tabs.push({
        key: SERVICE_TABS.EASYJET,
        label: tShipping("service.tabs.easyjet"),
      });
    }

    if (hasCompanySSApi) {
      tabs.push({
        key: SERVICE_TABS.COMPANY,
        label: tShipping("service.tabs.company", {
          name: companyInfo?.name || tCommon("none"),
        }),
      });
    }
    if (hasPartnerSSApi) {
      tabs.push({
        key: SERVICE_TABS.PARTNER,
        label: tShipping("service.tabs.partner", {
          name: partnerInfo?.name || tCommon("none"),
        }),
      });
    }
    return tabs;
  }, [
    companyInfo?.name,
    hasCompanySSApi,
    hasPartnerSSApi,
    partnerInfo?.name,
    tCommon,
    tShipping,
  ]);

  useEffect(() => {
    if (!serviceTabs.length) return;
    setActiveServiceTab((prev) => {
      const exists = serviceTabs.some((tab) => tab.key === prev);
      return exists ? prev : serviceTabs[0].key;
    });
  }, [serviceTabs]);

  const resetServiceState = useCallback(() => {
    setServiceState(createInitialServiceState());
  }, []);

  useEffect(() => {
    setQuoteValues(quoteDefaults);
  }, [quoteDefaults]);

  useEffect(() => {
    resetServiceState();
  }, [orderId, resetServiceState]);

  useEffect(() => {
    if (!open) {
      resetServiceState();
    }
  }, [open, resetServiceState]);

  const safeFormatAmount = useCallback(
    (value, fallback) =>
      typeof formatAmount === "function"
        ? formatAmount(value, fallback)
        : (value ?? fallback ?? "-"),
    [formatAmount],
  );

  const orderItems = useMemo(() => flattenOrderItems(record), [record]);

  const orderItemsTotal = useMemo(
    () =>
      orderItems.reduce((total, item) => {
        const price = Number(item?.price);
        return total + (Number.isFinite(price) ? price : 0);
      }, 0),
    [orderItems],
  );

  const fetchRates = useCallback(
    async (serviceKey, values) => {
      if (!orderId || !serviceKey) return;
      const payload = {
        order_id: orderId,
        ...sanitizeQuotePayload(values),
      };
      setServiceState((prev) => {
        const prevEntry = prev[serviceKey] || createServiceEntry();
        return {
          ...prev,
          [serviceKey]: {
            ...prevEntry,
            loading: true,
            hasFetched: true,
          },
        };
      });
      try {
        let resp;
        if (serviceKey === SERVICE_TABS.EASYJET) {
          resp = await NestShipperAPI.quoteRates(payload);
        } else {
          resp = await ShipStationAPI.quoteRates({
            ...payload,
            entity_type: serviceKey,
          });
        }
        const list = Array.isArray(resp?.data?.rates)
          ? resp.data.rates
          : Array.isArray(resp?.data)
            ? resp.data
            : [];
        const sortedRates = getSortedRates(list);
        const firstSortedRateKey = sortedRates.length
          ? getRateKey(sortedRates[0])
          : null;
        setServiceState((prev) => {
          const prevEntry = prev[serviceKey] || createServiceEntry();
          const hasPrev = list.some(
            (rate) => getRateKey(rate) === prevEntry.selectedRateKey,
          );
          return {
            ...prev,
            [serviceKey]: {
              ...prevEntry,
              rates: list,
              selectedRateKey: hasPrev
                ? prevEntry.selectedRateKey
                : firstSortedRateKey,
              isQuoteFresh: true,
              loading: false,
              hasFetched: true,
            },
          };
        });
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || "Kargo fiyatları alınamadı.",
        );
        setServiceState((prev) => {
          const prevEntry = prev[serviceKey] || createServiceEntry();
          return {
            ...prev,
            [serviceKey]: {
              ...prevEntry,
              loading: false,
              isQuoteFresh: false,
              hasFetched: true,
            },
          };
        });
      }
    },
    [message, orderId],
  );

  useEffect(() => {
    if (!open || !record || !orderId || !activeServiceTab) return;
    if (!serviceTabs.length) return;
    const isTabAvailable = serviceTabs.some(
      (tab) => tab.key === activeServiceTab,
    );
    if (!isTabAvailable) return;
    const currentService = serviceState[activeServiceTab];
    if (currentService?.hasFetched || currentService?.loading) return;
    fetchRates(activeServiceTab, quoteDefaults);
  }, [
    activeServiceTab,
    fetchRates,
    open,
    orderId,
    quoteDefaults,
    record,
    serviceState,
    serviceTabs,
  ]);

  const handleRefresh = useCallback(() => {
    if (!orderId || !activeServiceTab) return;
    const isTabAvailable = serviceTabs.some(
      (tab) => tab.key === activeServiceTab,
    );
    if (!isTabAvailable) return;
    fetchRates(activeServiceTab, quoteValues);
  }, [activeServiceTab, fetchRates, orderId, quoteValues, serviceTabs]);

  const handleInputChange = useCallback((field, value) => {
    setQuoteValues((prev) => ({
      ...prev,
      [field]: value ?? null,
    }));
    setServiceState((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        next[key] = {
          ...prev[key],
          isQuoteFresh: false,
        };
      });
      return next;
    });
  }, []);

  const activeServiceData =
    serviceState[activeServiceTab] || createServiceEntry();

  const selectedRate = useMemo(
    () =>
      activeServiceData.rates.find(
        (rate) => getRateKey(rate) === activeServiceData.selectedRateKey,
      ),
    [activeServiceData.rates, activeServiceData.selectedRateKey],
  );

  const selectedRateAmount = useMemo(() => {
    const amount = Number(selectedRate?.amount);
    return Number.isFinite(amount) ? amount : 0;
  }, [selectedRate]);

  const grandTotal = orderItemsTotal + selectedRateAmount;
  const canSendToProduction =
    Boolean(selectedRate) &&
    selectedRateAmount > 0 &&
    activeServiceData.isQuoteFresh;

  const handleSendToProduction = useCallback(async () => {
    if (!orderId || !selectedRate) return;
    if (!activeServiceData.isQuoteFresh) {
      message.warning(tShipping("errors.mustRefreshRates"));
      return;
    }
    const oz = normalizeNumber(quoteValues.weightOz);
    const lb = normalizeNumber(quoteValues.weightLb);
    const weightValue =
      oz !== null && oz > 0 ? oz : lb !== null && lb > 0 ? lb * 16 : 0;

    const payload = {
      carrier_service: selectedRate,
      order_id: orderId,
      shipping_price: selectedRateAmount,
      order_price: orderItemsTotal,
      weight: {
        units: "ounces",
        value: weightValue,
        WeightUnits: 1,
      },
      dimensions: {
        units: "inches",
        width: normalizeNumber(quoteValues.widthIn) ?? 0,
        height: normalizeNumber(quoteValues.heightIn) ?? 0,
        length: normalizeNumber(quoteValues.lengthIn) ?? 0,
      },
      source: (() => {
        if (activeServiceTab === SERVICE_TABS.EASYJET) return "easyjet";
        if (activeServiceTab === SERVICE_TABS.COMPANY)
          return "shipStationCompany";
        if (activeServiceTab === SERVICE_TABS.PARTNER)
          return "shipStationPartner";
      })(),
    };

    setSendingProduction(true);
    try {
      await OrdersAPI.sendToProduction(payload);
      message.success(tShipping("actions.sendSuccess"));
      try {
        const walletResp = await WalletAPI.getBalance();
        const balance = extractBalanceValue(walletResp);
        if (balance !== null) {
          dispatch(setBalance(balance));
        }
      } catch {
        // Bakiye çekilemezse sessizce devam et
      }
      onSendSuccess();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || tShipping("actions.sendError"),
      );
    } finally {
      setSendingProduction(false);
    }
  }, [
    message,
    orderId,
    orderItemsTotal,
    activeServiceData.isQuoteFresh,
    activeServiceTab,
    quoteValues.heightIn,
    quoteValues.lengthIn,
    quoteValues.weightLb,
    quoteValues.weightOz,
    quoteValues.widthIn,
    selectedRate,
    selectedRateAmount,
    dispatch,
    onClose,
    onSendSuccess,
    tShipping,
  ]);

  const renderAddress = () => {
    if (!record?.order) return tCommon("none");
    const order = record.order;
    const addressLines = [
      [order.ship_to_street1, order.ship_to_street2, order.ship_to_street3]
        .filter(Boolean)
        .join(", "),
      [order.ship_to_city, order.ship_to_state, order.ship_to_postal_code]
        .filter(Boolean)
        .join(", "),
      order.ship_to_country,
    ].filter(Boolean);
    return (
      <div className="space-y-1 text-sm text-gray-700">
        <div className="font-semibold text-gray-900">
          {order.bill_to_name || tCommon("none")}
        </div>
        {addressLines.length
          ? addressLines.map((line, idx) => (
              <div key={`${line}-${idx}`}>{line}</div>
            ))
          : tCommon("none")}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1280}
      title={tShipping("title")}
      footer={[
        <Popconfirm
          key="send"
          title={tShipping("actions.confirmSendTitle")}
          description={tShipping("actions.confirmSendDescription")}
          okText={tShipping("actions.confirmSendOk")}
          cancelText={tCommonActions("cancel")}
          onConfirm={handleSendToProduction}
          disabled={!canSendToProduction || sendingProduction}
        >
          <Button
            type="primary"
            disabled={!canSendToProduction || sendingProduction}
            loading={sendingProduction}
          >
            {tShipping("actions.sendToProduction")}
          </Button>
        </Popconfirm>,
        <Button key="close" onClick={onClose} type="primary">
          {tCommonActions("close")}
        </Button>,
      ]}
    >
      {!record ? (
        <Empty description={tShipping("empty")} />
      ) : (
        <div className="space-y-6">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-start gap-1">
                <div>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {tShipping("items.title")}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {tShipping("items.subtitle")}
                  </Typography.Text>
                </div>
                <div>
                  <Tag className="rounded-full" color="geekblue">
                    {tShipping("items.orderNumber")}:
                    {orderItems[0].order.order_number}
                  </Tag>
                </div>
                <div>
                  <Tag className="rounded-full" color="gold">
                    {tShipping("items.orderAmount")} : $
                    {safeFormatAmount(
                      orderItems[0].order.order_total,
                      tCommon("none"),
                    )}
                  </Tag>
                </div>
                <div>
                  <Tag className="rounded-full" color="red">
                    {tShipping("items.amountPaid")} : $
                    {safeFormatAmount(
                      orderItems[0].order.amount_paid,
                      tCommon("none"),
                    )}
                  </Tag>
                </div>
                <div>
                  <Tag className="rounded-full" color="orange">
                    {tShipping("items.taxAmount")} : $
                    {safeFormatAmount(
                      orderItems[0].order.tax_amount,
                      tCommon("none"),
                    )}
                  </Tag>
                </div>
                <div>
                  <Tag className="rounded-full" color="green">
                    {tShipping("items.shippingAmount")} : $
                    {safeFormatAmount(
                      orderItems[0].order.shipping_amount,
                      tCommon("none"),
                    )}
                  </Tag>
                </div>
              </div>
              <div className="text-right">
                <Typography.Text type="secondary" style={{ display: "block" }}>
                  {tShipping("items.total")}
                </Typography.Text>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  $ {safeFormatAmount(orderItemsTotal, tCommon("none"))}
                </Typography.Title>
              </div>
            </div>
            <div className="mt-4 space-y-3 max-h-[285px] overflow-y-auto pr-1">
              {orderItems.map((item, index) => {
                const key = item?.id ?? `${item?.sku || "item"}-${index}`;
                const imageUrl =
                  item?.image_url ||
                  item?.image ||
                  item?.product_image ||
                  record?.image_url ||
                  "";
                return (
                  <div
                    key={key}
                    className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 shadow-sm"
                  >
                    <div className="h-10 w-10 overflow-hidden rounded-xl bg-white">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item?.name || item?.sku || "order-item"}
                          preview={{ mask: tShipping("items.preview") }}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-400">
                          {tShipping("items.noImage")}
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                      <div className="font-semibold text-gray-900">
                        {item?.name || item?.sku || tCommon("none")}
                      </div>
                      <div className="text-xs text-gray-500">
                        SKU: {item?.sku || tCommon("none")}
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                      <div className="font-semibold text-gray-900">
                       {tShipping("items.quantity")} : {item?.quantity || tCommon("none")}
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                      <div className="font-semibold text-gray-900">
                       {tShipping("items.unitPrice")} : $ {item?.unit_price || tCommon("none")}
                      </div>
                    </div>
                    <div className="text-base font-semibold text-gray-900">
                      $ {safeFormatAmount(item?.price, tCommon("none"))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

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
                  onClick={handleRefresh}
                  loading={activeServiceData.loading}
                >
                  {tShipping("package.refresh")}
                </Button>
              </div>
              {!activeServiceData.isQuoteFresh && selectedRate && (
                <div className="text-xs text-orange-500">
                  {tShipping("package.warning")}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {tShipping("package.labels.weightLb")}
                  </div>
                  <InputNumber
                    min={0}
                    style={{ width: "100%" }}
                    value={quoteValues.weightLb}
                    onChange={(value) => handleInputChange("weightLb", value)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {tShipping("package.labels.weightOz")}
                  </div>
                  <InputNumber
                    min={0}
                    style={{ width: "100%" }}
                    value={quoteValues.weightOz}
                    onChange={(value) => handleInputChange("weightOz", value)}
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {tShipping("package.labels.lengthIn")}
                  </div>
                  <InputNumber
                    min={0}
                    style={{ width: "100%" }}
                    value={quoteValues.lengthIn}
                    onChange={(value) => handleInputChange("lengthIn", value)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {tShipping("package.labels.widthIn")}
                  </div>
                  <InputNumber
                    min={0}
                    style={{ width: "100%" }}
                    value={quoteValues.widthIn}
                    onChange={(value) => handleInputChange("widthIn", value)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {tShipping("package.labels.heightIn")}
                  </div>
                  <InputNumber
                    min={0}
                    style={{ width: "100%" }}
                    value={quoteValues.heightIn}
                    onChange={(value) => handleInputChange("heightIn", value)}
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
              {serviceTabs.length ? (
                <Tabs
                  activeKey={activeServiceTab}
                  onChange={setActiveServiceTab}
                  items={serviceTabs.map((tab) => {
                    const currentService =
                      serviceState[tab.key] || createServiceEntry();
                    const sortedRates = getSortedRates(currentService.rates);
                    const options = sortedRates.map((rate) => ({
                      value: getRateKey(rate),
                      label: `${rate.carrier || "-"} • ${
                        rate.serviceName || rate.serviceCode || "-"
                      } ($${safeFormatAmount(rate.amount, "-")})  ${
                        rate.deliveryDays
                          ? "• " +
                            tShipping("service.deliveryDaysLabelSelector", {
                              days: rate.deliveryDays,
                            })
                          : ""
                      }`,
                    }));
                    const currentSelected = sortedRates.find(
                      (rate) =>
                        getRateKey(rate) === currentService.selectedRateKey,
                    );
                    return {
                      key: tab.key,
                      label: tab.label,
                      children: (
                        <div className="space-y-4">
                          <Spin spinning={currentService.loading}>
                            <Select
                              placeholder={tShipping("service.placeholder")}
                              options={options}
                              style={{ width: "100%" }}
                              value={
                                currentService.selectedRateKey || undefined
                              }
                              onChange={(value) =>
                                setServiceState((prev) => ({
                                  ...prev,
                                  [tab.key]: {
                                    ...(prev[tab.key] || createServiceEntry()),
                                    selectedRateKey: value || null,
                                  },
                                }))
                              }
                              notFoundContent={
                                currentService.loading ? (
                                  <Spin size="small" />
                                ) : (
                                  tShipping("service.notFound")
                                )
                              }
                              showSearch
                              optionFilterProp="label"
                            />
                          </Spin>
                          {currentSelected ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                              <div className="flex flex-wrap justify-between gap-2">
                                <span className="font-semibold text-gray-900">
                                  {currentSelected.carrier} •{" "}
                                  {currentSelected.serviceName ||
                                    currentSelected.serviceCode}
                                </span>
                                <span className="text-base font-semibold text-gray-900">
                                  ${" "}
                                  {safeFormatAmount(
                                    Number(currentSelected.amount),
                                    tCommon("none"),
                                  )}
                                </span>
                              </div>
                              {currentSelected.zone ? (
                                <div className="text-xs text-gray-500">
                                  {tShipping("service.zoneLabel", {
                                    zone: currentSelected.zone,
                                  })}
                                </div>
                              ) : null}
                              {currentSelected.deliveryDays ? (
                                <div className="text-xs text-gray-500">
                                  {tShipping("service.deliveryDaysLabel", {
                                    days: currentSelected.deliveryDays,
                                  })}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ),
                    };
                  })}
                />
              ) : null}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {tShipping("address.title")}
                </Typography.Title>
                {onEditAddress ? (
                  <Button
                    icon={<EditOutlined />}
                    type="text"
                    onClick={() => onEditAddress(record)}
                  >
                    {tCommonActions("edit")}
                  </Button>
                ) : null}
              </div>
              <Divider style={{ margin: "16px 0" }} />
              {renderAddress()}
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4 shadow-inner space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {tShipping("summary.orderTotal")}
                </span>
                <span className="text-base font-semibold text-gray-900">
                  $ {safeFormatAmount(orderItemsTotal, tCommon("none"))}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {tShipping("summary.shipping")}
                </span>
                <span className="text-base font-semibold text-gray-900">
                  $ {safeFormatAmount(selectedRateAmount, tCommon("none"))}
                </span>
              </div>
              <Divider style={{ margin: "8px 0" }} />
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">
                  {tShipping("summary.grandTotal")}
                </span>
                <span className="text-2xl font-bold text-gray-900">
                  $ {safeFormatAmount(grandTotal, tCommon("none"))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ShippingRatesModal;
