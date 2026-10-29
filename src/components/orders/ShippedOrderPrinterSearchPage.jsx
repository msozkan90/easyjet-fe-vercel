"use client";

import OrderNotesCard from "./OrderNotesCard";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PrinterOutlined, SettingOutlined } from "@ant-design/icons";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { GuardedPreviewImage } from "@/components/common/media/ImagePreviewGate";
import RequireRole from "@/components/common/Access/RequireRole";
import { OrdersAPI, ProductPositionsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import OrderItemDesignPreview from "@/components/orders/OrderItemDesignPreview";
import RemakeShippingRatesModal from "@/components/modals/RemakeShippingRatesModal";
import StatusTag from "@/components/ui/StatusTag";
import PageHeader from "@/components/ui/PageHeader";
import { formatAmount } from "@/utils/formatMoney";
import LabelPrinterSettings from "./LabelPrinterSettings";
import useLabelPrinter from "@/hooks/useLabelPrinter";

const extractPositionList = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.list)) return response.list;
  if (Array.isArray(response?.items)) return response.items;
  const nested = response?.data;
  if (Array.isArray(nested?.data)) return nested.data;
  if (Array.isArray(nested)) return nested;
  return [];
};

const OrderItemCard = ({
  item,
  positionMap,
  tOrders,
  tDetail,
  tCommonActions,
  fallbackText,
}) => {
  const options = Array.isArray(item?.options) ? item.options : [];
  const statusKey = item?.status || "";
  const statusLabel = statusKey
    ? tOrders(`status.values.${statusKey}`) || statusKey
    : tOrders("common.none");

  return (
    <Card
      className="rounded-xl border border-line"
      styles={{ body: { padding: 20 } }}
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full max-w-[240px] rounded-xl border border-line bg-surface p-3">
          <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-line bg-subtle">
            {item?.image_url ? (
              <GuardedPreviewImage
                src={item.image_url}
                alt={item?.name || "order item"}
                openLabel={tCommonActions("open")}
                emptyText={tOrders("common.none")}
                preview
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <Empty description={tOrders("common.none")} />
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {item?.name || tOrders("columns.item")}
            </Typography.Title>
            <Tag color="geekblue">
              SKU: {item?.sku || tOrders("common.none")}
            </Tag>
            <Tag color="gold">
              {tOrders("columns.quantity")}:{" "}
              {item?.quantity ?? tOrders("common.none")}
            </Tag>
            <Tag color="green">
              {tOrders("columns.price")}:{" "}
              {formatAmount(item?.price || item?.unit_price)}
            </Tag>
            <StatusTag status={statusKey}>
              {tOrders("columns.status")}: {statusLabel}
            </StatusTag>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Typography.Text type="secondary">
                {tOrders("columns.product")}
              </Typography.Text>
              <div className="font-medium">
                {item?.product?.name || tOrders("common.none")}
              </div>
            </div>
            <div>
              <Typography.Text type="secondary">
                {tOrders("columns.size")}
              </Typography.Text>
              <div className="font-medium">
                {item?.size?.name || tOrders("common.none")}
              </div>
            </div>
            <div>
              <Typography.Text type="secondary">
                {tOrders("columns.color")}
              </Typography.Text>
              <div className="font-medium">
                {item?.color?.name || tOrders("common.none")}
              </div>
            </div>
          </div>

          <div>
            <Typography.Text type="secondary">
              {tOrders("columns.options")}
            </Typography.Text>
            {options.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {options.map((option, index) => (
                  <span
                    key={`${option?.name || "option"}-${index}`}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-text-secondary"
                  >
                    {option?.name || tOrders("common.none")}:{" "}
                    {option?.value || tOrders("common.none")}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm">{tOrders("values.noOptions")}</div>
            )}
          </div>

          <div>
            <Typography.Text type="secondary">
              {tOrders("columns.designerNotes")}
            </Typography.Text>
            <div className="mt-1 text-sm">
              {item?.notes || tOrders("common.none")}
            </div>
          </div>

          <div>
            <Typography.Text type="secondary">
              {tDetail("designs.title")}
            </Typography.Text>
            <div className="mt-2">
              <OrderItemDesignPreview
                item={item}
                positionMap={positionMap}
                tDetail={tDetail}
                tOrders={tOrders}
                fallbackText={fallbackText}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function ShippedOrderPrinterSearchPage() {
  const { message } = AntdApp.useApp();
  const tOrders = useTranslations("dashboard.orders");
  const tDetail = useTranslations("dashboard.orders.detail");
  const tCommonActions = useTranslations("common.actions");
  const fallbackText = tDetail("designs.designAreaPlaceholder");
  const {
    autoPrint,
    preferencesReady,
    handleAutoPrintChange,
    printingLabel,
    printInFlightRef,
    requestLabelPrint,
  } = useLabelPrinter();

  const orderNumberInputRef = useRef(null);
  const searchInFlightRef = useRef(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [loadedOrderNumber, setLoadedOrderNumber] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [order, setOrder] = useState(null);
  const [positionsByProductId, setPositionsByProductId] = useState({});
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [shippingModalOpen, setShippingModalOpen] = useState(false);
  const [printerSettingsOpen, setPrinterSettingsOpen] = useState(false);
  const [labelUrl, setLabelUrl] = useState(null);
  const busy = searching || printingLabel;

  const items = useMemo(() => {
    if (!Array.isArray(order?.items)) return [];
    return order.items;
  }, [order]);

  useEffect(() => {
    if (!items.length) {
      setPositionsByProductId({});
      return;
    }

    const uniqueProductIds = Array.from(
      new Set(
        items
          .map((item) => item?.product_id || item?.product?.id)
          .filter(Boolean)
          .map((id) => String(id)),
      ),
    );

    if (!uniqueProductIds.length) {
      setPositionsByProductId({});
      return;
    }

    let active = true;
    setPositionsLoading(true);

    const loadPositions = async () => {
      try {
        const results = await Promise.all(
          uniqueProductIds.map(async (productId) => {
            const response = await ProductPositionsAPI.flatList({
              pagination: { page: 1, pageSize: 100 },
              filters: { product_id: productId, status: "active" },
            });
            return [productId, extractPositionList(response)];
          }),
        );

        if (!active) return;
        setPositionsByProductId(
          results.reduce((acc, [productId, positions]) => {
            acc[productId] = Array.isArray(positions) ? positions : [];
            return acc;
          }, {}),
        );
      } catch (error) {
        if (!active) return;
        message.error(
          error?.response?.data?.error?.message ||
            tDetail("messages.loadPositionsError"),
        );
      } finally {
        if (active) setPositionsLoading(false);
      }
    };

    loadPositions();
    return () => {
      active = false;
    };
  }, [items, message, tDetail]);

  const handleSearch = useCallback(
    async (rawOrderNumber) => {
      if (
        !preferencesReady ||
        searchInFlightRef.current ||
        printInFlightRef.current ||
        shippingModalOpen ||
        printerSettingsOpen
      ) return;
      const nextOrderNumber = String(rawOrderNumber || orderNumber).trim();
      if (!nextOrderNumber) {
        message.warning(tOrders("filters.searchOrderNumber"));
        return;
      }

      searchInFlightRef.current = true;
      setSearching(true);
      setSearched(true);
      setLabelUrl(null);

      try {
        const response = await OrdersAPI.shippedItems({
          shipment_number: nextOrderNumber,
        });

        const responseOrder = response?.data?.order || null;
        const nextLabelUrl = response?.data?.label_download?.label_url;

        setOrder(responseOrder);
        setLoadedOrderNumber(responseOrder ? nextOrderNumber : "");

        if (response?.data?.requires_label_creation === true) {
          setShippingModalOpen(true);
          message.warning(tOrders("scanner.messages.remakeLabelRequired"));
          return;
        }

        setLabelUrl(nextLabelUrl || null);
        if (nextLabelUrl && autoPrint) await requestLabelPrint(nextLabelUrl);

        setOrderNumber("");
        window.requestAnimationFrame(() => {
          orderNumberInputRef.current?.focus();
        });
      } catch (error) {
        setOrder(null);
        setLoadedOrderNumber("");
        message.error(
          error?.response?.data?.error?.message ||
            tDetail("messages.loadOrderError"),
        );
      } finally {
        searchInFlightRef.current = false;
        setSearching(false);
      }
    },
    [
      message,
      orderNumber,
      tDetail,
      tOrders,
      preferencesReady,
      shippingModalOpen,
      printerSettingsOpen,
      autoPrint,
      requestLabelPrint,
      printInFlightRef,
    ],
  );

  const handlePaste = useCallback(
    (event) => {
      const pastedValue = event?.clipboardData?.getData("text") || "";
      const normalizedOrderNumber = String(pastedValue).trim();
      if (!normalizedOrderNumber) return;
      event.preventDefault();
      setOrderNumber(normalizedOrderNumber);
      handleSearch(normalizedOrderNumber);
    },
    [handleSearch],
  );

  const handleLabelCreated = useCallback(
    async (payload) => {
      const responseOrder = payload?.order || null;
      const nextLabelUrl = payload?.label_download?.label_url;
      setOrder(responseOrder);
      setLabelUrl(nextLabelUrl || null);
      setShippingModalOpen(false);
      if (nextLabelUrl && autoPrint) await requestLabelPrint(nextLabelUrl);
      setOrderNumber("");
      window.requestAnimationFrame(() => orderNumberInputRef.current?.focus());
    },
    [autoPrint, requestLabelPrint],
  );

  return (
    <RequireRole anyOfRoles={["companyShipmentWorker", "companyadmin"]}>
      <div className="space-y-4">
        <PageHeader
          className=""
          title={tOrders("scanner.title")}
          description={tOrders("scanner.printing.defaultPrinter")}
          meta={
            <Tag>
              {tOrders(`scanner.printing.${autoPrint ? "automatic" : "manual"}`)}
            </Tag>
          }
          extra={
            <>
              <Button
                icon={<PrinterOutlined />}
                disabled={!labelUrl || searching || !preferencesReady}
                loading={printingLabel}
                onClick={() => requestLabelPrint(labelUrl)}
              >
                {tOrders("actions.printLabel")}
              </Button>
              <Button
                icon={<SettingOutlined />}
                disabled={busy || !preferencesReady}
                onClick={() => setPrinterSettingsOpen(true)}
              >
                {tOrders("scanner.printing.settings")}
              </Button>
            </>
          }
        />

        <Card className="rounded-xl">
          <Space.Compact style={{ width: "100%" }}>
            <Input
              ref={orderNumberInputRef}
              disabled={busy || !preferencesReady}
              allowClear
              placeholder={tOrders("filters.searchOrderNumber")}
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              onPressEnter={() => handleSearch(orderNumber)}
              onPaste={handlePaste}
            />
            <Button
              type="primary"
              loading={searching}
              disabled={printingLabel || !preferencesReady}
              onClick={() => handleSearch(orderNumber)}
            >
              {tCommonActions("search")}
            </Button>
          </Space.Compact>
          {order && loadedOrderNumber ? (
            <div
              className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-4"
              aria-live="polite"
            >
              <Typography.Text type="secondary">
                {tOrders("columns.orderNumber")}
              </Typography.Text>
              <Typography.Text strong copyable className="break-all text-lg!">
                {loadedOrderNumber}
              </Typography.Text>
            </div>
          ) : null}
        </Card>

        {printingLabel ? (
          <Alert
            type="info"
            showIcon
            message={tOrders("scanner.messages.labelPrintPreparing")}
          />
        ) : null}

        {searching && !order ? (
          <div className="flex justify-center py-6">
            <Spin />
          </div>
        ) : null}

        {positionsLoading ? (
          <Typography.Text type="secondary">
            {tDetail("messages.positionsLoading")}
          </Typography.Text>
        ) : null}

        {items.length ? (
          <div className="grid gap-6">
            {items.map((item) => {
              const productId = String(
                item?.product_id || item?.product?.id || "",
              );
              const positions = positionsByProductId[productId] || [];
              const positionMap = new Map(
                positions.map((position) => [String(position?.id), position]),
              );

              return (
                <OrderItemCard
                  key={item?.id}
                  item={item}
                  positionMap={positionMap}
                  tOrders={tOrders}
                  tDetail={tDetail}
                  tCommonActions={tCommonActions}
                  fallbackText={fallbackText}
                />
              );
            })}
          </div>
        ) : null}

        <OrderNotesCard order={order} />

        {searched && !searching && !items.length ? (
          <Empty description={tDetail("messages.noItems")} />
        ) : null}
        <RemakeShippingRatesModal
          open={shippingModalOpen}
          order={order}
          onClose={() => setShippingModalOpen(false)}
          onCreated={handleLabelCreated}
        />
        <LabelPrinterSettings
          open={printerSettingsOpen}
          onClose={() => setPrinterSettingsOpen(false)}
          autoPrint={autoPrint}
          onAutoPrintChange={handleAutoPrintChange}
        />
      </div>
    </RequireRole>
  );
}
