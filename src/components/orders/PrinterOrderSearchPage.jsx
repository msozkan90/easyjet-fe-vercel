"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import RequireRole from "@/components/common/Access/RequireRole";
import { OrdersAPI, ProductPositionsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { downloadOrderItemDesigns } from "@/utils/orderItemDesignDownloads";
import { extractDesignAreaFromRecord } from "@/utils/designArea";

const STATUS_COLORS = {
  newOrder: "geekblue",
  processing: "purple",
  pdf: "blue",
  completed: "green",
  shipped: "gold",
  waitingForDesign: "orange",
  cancel: "red",
};

const SCRAP_REASON_OPTIONS = [
  { value: "wrong_print", labelKey: "wrongPrint" },
  { value: "damaged_product", labelKey: "damagedProduct" },
  { value: "other", labelKey: "other" },
];

const formatAmount = (value, fallback = "-") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return value;
  }
  return numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

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

const extractWorkerCompletedGroups = (response) => {
  const root = response?.data ?? response;
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.items)) return root.items;
  if (Array.isArray(root?.data)) return root.data;
  if (Array.isArray(root?.data?.items)) return root.data.items;
  if (Array.isArray(root?.list)) return root.list;
  return [];
};

const flattenGroupedItems = (group) => {
  if (!group) return [];
  const children = Array.isArray(group?.children) ? group.children : [];
  return [group, ...children];
};

const buildVariantLabel = (item, tOrders) => {
  const parts = [
    item?.product?.name,
    item?.size?.name,
    item?.color?.name,
    item?.sku ? `SKU: ${item.sku}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" / ") : tOrders("columns.item");
};

const ItemDesignPreview = ({
  item,
  designs,
  positionMap,
  tDetail,
  fallbackText,
}) => {
  if (!designs.length) {
    return <Empty description={tDetail("designs.empty")} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {designs.map((design) => {
        const positionId = String(design?.product_position_id || "");
        const position = positionMap.get(positionId);
        const designArea = position ? extractDesignAreaFromRecord(position) : null;
        const positionImageUrl = position?.images?.[0]?.image_url;
        const previewImageUrl = positionImageUrl || item?.image_url;
        const designPreviewUrl = design?.design_url;
        const positionName =
          position?.name || design?.product_position?.name || tDetail("designs.unknownPosition");

        return (
          <Card
            key={design?.id || positionId}
            title={positionName}
            className="rounded-2xl border border-slate-100 shadow-sm"
            bodyStyle={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              flex: 1,
              padding: 16,
            }}
          >
            <div className="relative flex w-full flex-1 items-center overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-slate-100">
              {previewImageUrl ? (
                <div className="relative w-full">
                  <img
                    src={previewImageUrl}
                    alt={positionName}
                    className="block w-full rounded-2xl object-contain"
                  />
                  <div className="absolute inset-0">
                    {designArea ? (
                      <div
                        className="absolute rounded-xl border-2 border-blue-500/70 bg-blue-500/10 shadow-inner"
                        style={{
                          left: `${designArea.x * 100}%`,
                          top: `${designArea.y * 100}%`,
                          width: `${designArea.width * 100}%`,
                          height: `${designArea.height * 100}%`,
                        }}
                      >
                        {designPreviewUrl ? (
                          <img
                            src={designPreviewUrl}
                            alt="design preview"
                            className="h-full w-full rounded-lg object-contain"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                            {fallbackText}
                          </div>
                        )}
                      </div>
                    ) : designPreviewUrl ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <img
                          src={designPreviewUrl}
                          alt="design preview"
                          className="h-24 w-24 rounded-lg object-contain"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : designPreviewUrl ? (
                <div className="flex aspect-[4/5] items-center justify-center p-6">
                  <img
                    src={designPreviewUrl}
                    alt="design preview"
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center p-6">
                  <Empty description={tDetail("designs.noPreview")} />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {tDetail("designs.positionLabel")}
              </Typography.Text>
              <Typography.Text>{positionName}</Typography.Text>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const OrderItemCard = ({ item, positionMap, tOrders, tDetail, fallbackText }) => {
  const options = Array.isArray(item?.options) ? item.options : [];
  const designs = Array.isArray(item?.designs) ? item.designs : [];
  const statusKey = item?.status || "";
  const statusLabel = statusKey
    ? tOrders(`status.values.${statusKey}`) || statusKey
    : tOrders("common.none");

  return (
    <Card className="rounded-2xl border border-slate-100 shadow-sm" bodyStyle={{ padding: 20 }}>
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full max-w-[240px] rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50">
            {item?.image_url ? (
              <Image
                src={item.image_url}
                alt={item?.name || "order item"}
                preview
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <Empty description={tDetail("designs.noImage")} />
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Typography.Title level={5} style={{ margin: 0 }}>
              {item?.name || tOrders("columns.item")}
            </Typography.Title>
            <Tag color="geekblue">SKU: {item?.sku || tOrders("common.none")}</Tag>
            <Tag color="gold">
              {tOrders("columns.quantity")}: {item?.quantity ?? tOrders("common.none")}
            </Tag>
            <Tag color="green">
              {tOrders("columns.price")}: {formatAmount(item?.price || item?.unit_price)}
            </Tag>
            <Tag color={STATUS_COLORS[statusKey] || "default"}>
              {tOrders("columns.status")}: {statusLabel}
            </Tag>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Typography.Text type="secondary">{tOrders("columns.product")}</Typography.Text>
              <div className="font-medium">{item?.product?.name || tOrders("common.none")}</div>
            </div>
            <div>
              <Typography.Text type="secondary">{tOrders("columns.size")}</Typography.Text>
              <div className="font-medium">{item?.size?.name || tOrders("common.none")}</div>
            </div>
            <div>
              <Typography.Text type="secondary">{tOrders("columns.color")}</Typography.Text>
              <div className="font-medium">{item?.color?.name || tOrders("common.none")}</div>
            </div>
          </div>

          <div>
            <Typography.Text type="secondary">{tOrders("columns.options")}</Typography.Text>
            {options.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {options.map((option, index) => (
                  <span
                    key={`${option?.name || "option"}-${index}`}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                  >
                    {option?.name || tOrders("common.none")}: {option?.value || tOrders("common.none")}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-sm">{tOrders("values.noOptions")}</div>
            )}
          </div>

          <div>
            <Typography.Text type="secondary">{tOrders("columns.notes")}</Typography.Text>
            <div className="mt-1 text-sm">{item?.notes || tOrders("common.none")}</div>
          </div>

          <div>
            <Typography.Text type="secondary">{tDetail("designs.title")}</Typography.Text>
            <div className="mt-2">
              <ItemDesignPreview
                item={item}
                designs={designs}
                positionMap={positionMap}
                tDetail={tDetail}
                fallbackText={fallbackText}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function PrinterOrderSearchPage({ categoryId, subCategoryId }) {
  const { message } = AntdApp.useApp();
  const [scrapForm] = Form.useForm();
  const tOrders = useTranslations("dashboard.orders");
  const tDetail = useTranslations("dashboard.orders.detail");
  const tCommonActions = useTranslations("common.actions");
  const fallbackText = tDetail("designs.designAreaPlaceholder");

  const [orderNumber, setOrderNumber] = useState("");
  const [searching, setSearching] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [submittingScrap, setSubmittingScrap] = useState(false);
  const [downloadingDesign, setDownloadingDesign] = useState(false);
  const [searched, setSearched] = useState(false);
  const [orderSummary, setOrderSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [positionsByProductId, setPositionsByProductId] = useState({});
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [scrapModalOpen, setScrapModalOpen] = useState(false);

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
          .map((id) => String(id))
      )
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
            const response = await ProductPositionsAPI.list({
              pagination: { page: 1, pageSize: 100 },
              filters: { product_id: productId, status: "active" },
            });
            return [productId, extractPositionList(response)];
          })
        );

        if (!active) return;

        const nextMap = results.reduce((acc, [productId, list]) => {
          acc[productId] = Array.isArray(list) ? list : [];
          return acc;
        }, {});

        setPositionsByProductId(nextMap);
      } catch (error) {
        if (!active) return;
        message.error(
          error?.response?.data?.error?.message || tDetail("messages.loadPositionsError")
        );
      } finally {
        if (active) {
          setPositionsLoading(false);
        }
      }
    };

    loadPositions();
    return () => {
      active = false;
    };
  }, [items, message, tDetail]);

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: String(item?.id),
        label: buildVariantLabel(item, tOrders),
        item,
      })),
    [items, tOrders]
  );

  const reasonOptions = useMemo(
    () =>
      SCRAP_REASON_OPTIONS.map((option) => ({
        value: option.value,
        label: tOrders(`scanner.scrap.reasonOptions.${option.labelKey}`),
      })),
    [tOrders]
  );

  const loadPreview = useCallback(
    async (rawOrderNumber) => {
      const nextOrderNumber = String(rawOrderNumber || orderNumber).trim();
      if (!nextOrderNumber) {
        message.warning(tOrders("filters.searchOrderNumber"));
        return;
      }

      setSearching(true);
      setSearched(true);

      try {
        const response = await OrdersAPI.workerCompletedItemsList({
          pagination: { page: 1, pageSize: 1 },
          filters: {
            order_number: nextOrderNumber,
            category: categoryId,
            ...(subCategoryId ? { sub_category: subCategoryId } : {}),
          },
        });

        const groups = extractWorkerCompletedGroups(response);
        const firstGroup = Array.isArray(groups) ? groups[0] : null;
        const nextItems = flattenGroupedItems(firstGroup);

        setOrderSummary(
          firstGroup
            ? {
                order_number:
                  firstGroup?.order?.order_number || firstGroup?.order_number || nextOrderNumber,
                customer_name:
                  firstGroup?.order?.customer?.name || firstGroup?.customer?.name || null,
              }
            : null
        );
        setItems(nextItems);
      } catch (error) {
        setOrderSummary(null);
        setItems([]);
        message.error(error?.response?.data?.error?.message || tDetail("messages.loadOrderError"));
      } finally {
        setSearching(false);
      }
    },
    [categoryId, message, orderNumber, subCategoryId, tDetail, tOrders]
  );

  const finalizeCompletion = useCallback(
    async (scrapPayload) => {
      const nextOrderNumber = String(orderSummary?.order_number || orderNumber).trim();
      if (!nextOrderNumber) {
        message.warning(tOrders("filters.searchOrderNumber"));
        return;
      }

      setCompleting(true);
      try {
        const payload = {
          category_id: categoryId,
          order_number: nextOrderNumber,
          ...(subCategoryId ? { sub_category_id: subCategoryId } : {}),
          ...(scrapPayload ? { scrap: scrapPayload } : {}),
        };

        const response = await OrdersAPI.completedItems(payload);
        const responseOrder = response?.data?.order || null;
        const designDownload = response?.data?.design_download;

        setOrderSummary(
          responseOrder
            ? { order_number: responseOrder?.order_number || nextOrderNumber }
            : { order_number: nextOrderNumber }
        );
        setItems(Array.isArray(responseOrder?.items) ? responseOrder.items : []);

        if (designDownload?.should_download && Array.isArray(designDownload?.designs)) {
          setDownloadingDesign(true);
          try {
            const downloadResult = await downloadOrderItemDesigns({
              orderNumber: responseOrder?.order_number || nextOrderNumber,
              designs: designDownload.designs,
            });
            if (downloadResult?.downloaded) {
              message.success(tOrders("scanner.messages.designDownloadSuccess"));
            }
          } catch (downloadError) {
            message.error(
              downloadError?.message || tOrders("scanner.messages.designDownloadError")
            );
          } finally {
            setDownloadingDesign(false);
          }
        }

        message.success(
          scrapPayload?.has_scrap
            ? tOrders("scanner.messages.completeWithScrapSuccess")
            : tOrders("scanner.messages.completeSuccess")
        );
      } catch (error) {
        message.error(error?.response?.data?.error?.message || tDetail("messages.loadOrderError"));
      } finally {
        setCompleting(false);
      }
    },
    [categoryId, message, orderNumber, orderSummary, subCategoryId, tDetail, tOrders]
  );

  const handleComplete = useCallback(async () => {
    await finalizeCompletion({
      has_scrap: false,
      entries: [],
    });
  }, [finalizeCompletion]);

  const handlePaste = useCallback(
    (event) => {
      const pastedValue = event?.clipboardData?.getData("text") || "";
      const normalizedOrderNumber = String(pastedValue).trim();
      if (!normalizedOrderNumber) return;
      event.preventDefault();
      setOrderNumber(normalizedOrderNumber);
      loadPreview(normalizedOrderNumber);
    },
    [loadPreview]
  );

  const openScrapModal = useCallback(() => {
    if (!items.length) {
      message.warning(tOrders("scanner.messages.loadBeforeScrap"));
      return;
    }
    scrapForm.setFieldsValue({
      entries: [
        {
          quantity: 1,
          reason_detail: "wrong_print",
        },
      ],
    });
    setScrapModalOpen(true);
  }, [items.length, message, scrapForm, tOrders]);

  const handleSubmitScrap = useCallback(async () => {
    try {
      setSubmittingScrap(true);
      const values = await scrapForm.validateFields();
      const entries = (values?.entries || []).map((entry) => {
        const selected = itemOptions.find((option) => option.value === entry.order_item_id)?.item;
        if (!selected?.product_id || !selected?.size_id || !selected?.color_id) {
          throw new Error(tOrders("scanner.messages.invalidScrapItem"));
        }
        return {
          order_item_id: entry.order_item_id,
          product_id: selected.product_id,
          size_id: selected.size_id,
          color_id: selected.color_id,
          quantity: entry.quantity,
          reason: "production_scrap",
          reason_detail: entry.reason_detail,
          note: entry.note || undefined,
        };
      });

      await finalizeCompletion({
        has_scrap: true,
        entries,
      });
      setScrapModalOpen(false);
      scrapForm.resetFields();
    } catch (error) {
      const errorMessage =
        error?.errorFields?.length > 0
          ? null
          : error?.message || error?.response?.data?.error?.message;
      if (errorMessage) {
        message.error(errorMessage);
      }
    } finally {
      setSubmittingScrap(false);
    }
  }, [finalizeCompletion, itemOptions, message, scrapForm, tOrders]);

  return (
    <RequireRole anyOfRoles={["companyCompletedWorker", "companyadmin"]}>
      <div className="space-y-4 p-4">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {tOrders("scanner.title")}
        </Typography.Title>

        <Card className="rounded-2xl">
          <div className="space-y-4">
            <Input.Search
              allowClear
              enterButton={
                <Button type="primary" loading={searching}>
                  {tCommonActions("search")}
                </Button>
              }
              placeholder={tOrders("filters.searchOrderNumber")}
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              onSearch={loadPreview}
              onPaste={handlePaste}
            />

            {orderSummary?.order_number ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="space-y-1">
                  <Typography.Text type="secondary">
                    {tOrders("columns.orderNumber")}
                  </Typography.Text>
                  <div className="text-base font-semibold text-slate-900">
                    #{orderSummary.order_number}
                  </div>
                </div>
                <Space wrap>
                  <Button
                    type="primary"
                    loading={completing}
                    onClick={handleComplete}
                    disabled={!items.length}
                  >
                    {tOrders("scanner.actions.complete")}
                  </Button>
                  <Button
                    danger
                    onClick={openScrapModal}
                    disabled={!items.length || completing}
                  >
                    {tOrders("scanner.actions.scrap")}
                  </Button>
                </Space>
              </div>
            ) : null}
          </div>
        </Card>

        {downloadingDesign ? (
          <Alert
            type="info"
            showIcon
            message={tOrders("scanner.messages.designPreparing")}
          />
        ) : null}

        {searching && !items.length ? (
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
              const productId = String(item?.product_id || item?.product?.id || "");
              const positions = positionsByProductId[productId] || [];
              const positionMap = new Map(
                positions.map((position) => [String(position?.id), position])
              );

              return (
                <OrderItemCard
                  key={item?.id}
                  item={item}
                  positionMap={positionMap}
                  tOrders={tOrders}
                  tDetail={tDetail}
                  fallbackText={fallbackText}
                />
              );
            })}
          </div>
        ) : null}

        {searched && !searching && !items.length ? (
          <Empty description={tDetail("messages.noItems")} />
        ) : null}

        <Modal
          open={scrapModalOpen}
          title={tOrders("scanner.scrap.title")}
          onCancel={() => {
            setScrapModalOpen(false);
            scrapForm.resetFields();
          }}
          onOk={handleSubmitScrap}
          okText={tOrders("scanner.scrap.confirm")}
          cancelText={tCommonActions("cancel")}
          confirmLoading={submittingScrap}
          width={760}
        >
          <Form form={scrapForm} layout="vertical">
            <Form.List name="entries">
              {(fields, { add, remove }) => (
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <Card
                      key={field.key}
                      size="small"
                      className="rounded-2xl border border-slate-100"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <Typography.Text strong>
                          {tOrders("scanner.scrap.entryTitle", { index: index + 1 })}
                        </Typography.Text>
                        {fields.length > 1 ? (
                          <Button danger type="text" onClick={() => remove(field.name)}>
                            {tCommonActions("remove")}
                          </Button>
                        ) : null}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Form.Item
                          name={[field.name, "order_item_id"]}
                          label={tOrders("scanner.scrap.fields.item")}
                          rules={[{ required: true, message: tOrders("scanner.scrap.validation.item") }]}
                        >
                          <Select
                            showSearch
                            optionFilterProp="label"
                            options={itemOptions}
                            placeholder={tOrders("scanner.scrap.placeholders.item")}
                          />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, "quantity"]}
                          label={tOrders("scanner.scrap.fields.quantity")}
                          rules={[
                            { required: true, message: tOrders("scanner.scrap.validation.quantity") },
                          ]}
                        >
                          <InputNumber min={1} precision={0} className="w-full" />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, "reason_detail"]}
                          label={tOrders("scanner.scrap.fields.reason")}
                          rules={[{ required: true, message: tOrders("scanner.scrap.validation.reason") }]}
                        >
                          <Select
                            options={reasonOptions}
                            placeholder={tOrders("scanner.scrap.placeholders.reason")}
                          />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, "note"]}
                          label={tOrders("scanner.scrap.fields.note")}
                        >
                          <Input.TextArea
                            autoSize={{ minRows: 2, maxRows: 4 }}
                            placeholder={tOrders("scanner.scrap.placeholders.note")}
                          />
                        </Form.Item>
                      </div>
                    </Card>
                  ))}

                  <Button type="dashed" block onClick={() => add({ quantity: 1 })}>
                    {tOrders("scanner.scrap.actions.addEntry")}
                  </Button>
                </div>
              )}
            </Form.List>
          </Form>
        </Modal>
      </div>
    </RequireRole>
  );
}
