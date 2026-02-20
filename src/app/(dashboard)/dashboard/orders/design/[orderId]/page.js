"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  Image,
  Input,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  Upload,
} from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { useParams } from "next/navigation";
import RequireRole from "@/components/common/Access/RequireRole";
import { OrdersAPI, ProductPositionsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { extractUploadFileList } from "@/utils/formDataHelpers";
import { extractDesignAreaFromRecord } from "@/utils/designArea";

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

const ACCEPTED_FILE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
];
const ACCEPT_ATTR = ".png,.jpg,.jpeg,.webp,.pdf";
const MAX_FILE_SIZE_MB = 25;

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

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function OrderDesignPage() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders.design");
  const tOrders = useTranslations("dashboard.orders");
  const tCommon = useTranslations("common");
  const params = useParams();
  const itemId = params?.orderId;

  const [orderDetail, setOrderDetail] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [note, setNote] = useState("");
  const [selectedPositionIds, setSelectedPositionIds] = useState([]);
  const [designFiles, setDesignFiles] = useState({});
  const [isSubCategory, setIsSubCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shouldHydrateFromOrder, setShouldHydrateFromOrder] = useState(false);
  const [deletingDesignIds, setDeletingDesignIds] = useState({});

  const loadOrderDetail = useCallback(
    async ({ hydrate = false, withLoading = true } = {}) => {
      if (!itemId) return;
      if (withLoading) {
        setOrderLoading(true);
      }
      try {
        const response = await OrdersAPI.details(itemId);
        setOrderDetail(response.data);
        if (hydrate) {
          setShouldHydrateFromOrder(true);
        }
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.loadOrderError")
        );
      } finally {
        if (withLoading) {
          setOrderLoading(false);
        }
      }
    },
    [itemId, message, t]
  );

  useEffect(() => {
    if (!itemId) return;
    loadOrderDetail({ hydrate: true });
  }, [itemId, loadOrderDetail]);

  const existingDesigns = useMemo(() => {
    if (!Array.isArray(orderDetail?.designs)) return [];
    return orderDetail.designs.filter((design) => design?.product_position_id);
  }, [orderDetail]);

  const existingDesignMap = useMemo(() => {
    const map = new Map();
    existingDesigns.forEach((design) => {
      map.set(String(design.product_position_id), design);
    });
    return map;
  }, [existingDesigns]);

  const lockedPositionIds = useMemo(
    () =>
      existingDesigns
        .filter((design) => Boolean(design?.design_url))
        .map((design) => String(design.product_position_id)),
    [existingDesigns]
  );

  const lockedPositionSet = useMemo(
    () => new Set(lockedPositionIds),
    [lockedPositionIds]
  );

  useEffect(() => {
    if (!shouldHydrateFromOrder) return;
    if (!orderDetail) {
      setNote("");
      setSelectedPositionIds([]);
      setDesignFiles({});
      setShouldHydrateFromOrder(false);
      return;
    }

    setNote(orderDetail?.notes || "");
    setIsSubCategory(Boolean(orderDetail?.is_sub_category));
    if (existingDesigns.length) {
      const initialIds = existingDesigns.map((design) =>
        String(design.product_position_id)
      );
      setSelectedPositionIds(initialIds);
      const initialFiles = initialIds.reduce((acc, positionId) => {
        const designInfo = existingDesignMap.get(positionId);
        const url = designInfo?.design_url;
        if (url) {
          acc[positionId] = [
            {
              uid: `existing-${positionId}`,
              name:
                designInfo?.file_name ||
                url.split("/").pop() ||
                t("positions.designUploadLabel"),
              status: "done",
              url,
            },
          ];
        }
        return acc;
      }, {});
      setDesignFiles(initialFiles);
    } else {
      setSelectedPositionIds([]);
      setDesignFiles({});
    }
    setShouldHydrateFromOrder(false);
  }, [
    existingDesignMap,
    existingDesigns,
    orderDetail,
    shouldHydrateFromOrder,
    t,
  ]);

  const derivedProductId = useMemo(() => {
    const candidate = orderDetail?.product_id ?? orderDetail?.product?.id;
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    return candidate;
  }, [orderDetail]);

  useEffect(() => {
    if (!derivedProductId) {
      setPositions([]);
      return;
    }
    let active = true;
    setPositionsLoading(true);
    const loadPositions = async () => {
      try {
        const response = await ProductPositionsAPI.list({
          pagination: { page: 1, pageSize: 100 },
          filters: { product_id: derivedProductId, status: "active" },
        });
        if (!active) return;
        const list = extractPositionList(response);
        setPositions(Array.isArray(list) ? list : []);
      } catch (error) {
        if (!active) return;
        message.error(
          error?.response?.data?.error?.message ||
            t("messages.loadPositionsError")
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
  }, [derivedProductId, message, t]);

  const positionMap = useMemo(() => {
    const map = new Map();
    (positions || []).forEach((position) => {
      if (position?.id) {
        map.set(String(position.id), position);
      }
    });
    return map;
  }, [positions]);

  const selectedPositions = useMemo(
    () =>
      selectedPositionIds
        .map((id) => positionMap.get(id))
        .filter((position) => Boolean(position)),
    [positionMap, selectedPositionIds]
  );

  const handlePositionChange = useCallback(
    (values) => {
      const lockedRemoved = lockedPositionIds.filter(
        (id) => !values.includes(id)
      );
      if (lockedRemoved.length) {
        message.warning(t("positions.lockedSelectionWarning"));
      }
      const nextValues = Array.from(new Set([...lockedPositionIds, ...values]));
      setSelectedPositionIds(nextValues);
      setDesignFiles((prev) => {
        const next = {};
        nextValues.forEach((id) => {
          if (prev?.[id]) {
            next[id] = prev[id];
          }
        });
        return next;
      });
    },
    [lockedPositionIds, message, t]
  );

  const renderPositionTag = useCallback(
    (props) => {
      const { label, value, closable, onClose } = props;
      const locked = lockedPositionSet.has(value);
      return (
        <Tag
          color={locked ? "blue" : undefined}
          closable={!locked && closable}
          onClose={onClose}
          style={{ marginRight: 3 }}
        >
          {label}
        </Tag>
      );
    },
    [lockedPositionSet]
  );

  const enrichFileListWithPreview = useCallback(async (fileList = []) => {
    const mapped = await Promise.all(
      fileList.map(async (file) => {
        if (file?.thumbUrl || !file?.originFileObj) {
          return file;
        }
        try {
          const preview = await fileToDataUrl(file.originFileObj);
          return { ...file, thumbUrl: preview };
        } catch {
          return file;
        }
      })
    );
    return mapped;
  }, []);

  const handleUploadChange = useCallback(
    (positionId, fileList) => {
      enrichFileListWithPreview(fileList).then((processed) => {
        setDesignFiles((prev) => ({
          ...prev,
          [positionId]: processed,
        }));
      });
    },
    [enrichFileListWithPreview]
  );

  const validateFile = useCallback(
    (file) => {
      const isAllowedType =
        ACCEPTED_FILE_TYPES.includes(file.type) ||
        (file.name &&
          file.name.toLowerCase().endsWith(".pdf") &&
          file.type === "");
      if (!isAllowedType) {
        message.error(t("positions.invalidFileType"));
        return Upload.LIST_IGNORE;
      }
      const sizeInMb = file.size / 1024 / 1024;
      if (sizeInMb > MAX_FILE_SIZE_MB) {
        message.error(
          t("positions.invalidFileSize", { size: MAX_FILE_SIZE_MB })
        );
        return Upload.LIST_IGNORE;
      }
      return true;
    },
    [message, t]
  );

  const canSave = Boolean(itemId && orderDetail?.id);

  const handleSave = useCallback(async () => {
    if (!orderDetail?.id) {
      message.error(t("messages.missingParams"));
      return;
    }
    // if (selectedPositionIds.length === 0) {
    //   message.error(t("positions.noSelectionError"));
    //   return;
    // }
    const hasMissingFile = selectedPositionIds.some((positionId) => {
      const fileList = extractUploadFileList(designFiles[positionId]);
      return fileList.length === 0;
    });
    if (hasMissingFile) {
      message.error(t("positions.missingFile"));
      return;
    }

    const positionsToSubmit = selectedPositionIds.filter((positionId) => {
      const fileList = extractUploadFileList(designFiles[positionId]);
      return fileList.some((file) => Boolean(file.originFileObj));
    });

    // if (positionsToSubmit.length === 0) {
    //   message.error(t("positions.noNewDesignError"));
    //   return;
    // }

    const formData = new FormData();

    // bigint'e coerce edileceği için string göndermek daha temiz
    formData.append("order_item_id", String(orderDetail.id));
    formData.append("order_id", String(orderDetail.order_id));
    formData.append("note", note || "");
    formData.append("is_sub_category", String(Boolean(isSubCategory)));

    // 1) JSON.stringify yerine HER position için ayrı field gönder:
    positionsToSubmit.forEach((positionId) => {
      formData.append("positions", String(positionId));
    });

    // 2) Dosyalar aynı kalabilir
    positionsToSubmit.forEach((positionId) => {
      const fileList = extractUploadFileList(designFiles[positionId]);
      const fileItem = fileList.find((file) => Boolean(file.originFileObj));

      if (fileItem?.originFileObj) {
        formData.append(`design_files[${positionId}]`, fileItem.originFileObj);
      }
    });

    setSaving(true);
    try {
      await OrdersAPI.saveDesign(formData);
      message.success(t("messages.saveSuccess"));
      await loadOrderDetail({ hydrate: true, withLoading: false });
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.saveError")
      );
    } finally {
      setSaving(false);
    }
  }, [
    designFiles,
    loadOrderDetail,
    message,
    note,
    orderDetail,
    selectedPositionIds,
    t,
    isSubCategory,
  ]);

  const handleDeleteDesign = useCallback(
    async (designId, positionId) => {
      if (!designId) return;
      setDeletingDesignIds((prev) => ({ ...prev, [designId]: true }));
      try {
        await OrdersAPI.deleteDesign(designId);
        message.success(t("messages.deleteSuccess"));
        setDesignFiles((prev) => ({
          ...prev,
          [positionId]: [],
        }));
        setSelectedPositionIds((prev) =>
          prev.filter((selectedId) => selectedId !== positionId)
        );
        await loadOrderDetail({ hydrate: false, withLoading: false });
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.deleteError")
        );
      } finally {
        setDeletingDesignIds((prev) => {
          const next = { ...prev };
          delete next[designId];
          return next;
        });
      }
    },
    [loadOrderDetail, message, t]
  );

  const renderOptions = (options) => {
    if (!Array.isArray(options) || !options.length) {
      return tOrders("values.noOptions");
    }
    return (
      <div className="space-y-1">
        {options.map((option, index) => {
          const key = `${option?.name ?? "option"}-${index}`;
          return (
            <div
              key={key}
              className="flex flex-wrap gap-1 text-sm text-gray-700 "
            >
              <span className="font-semibold">{option?.name || "-"}</span>
              <span>:</span>
              <span>{option?.value || "-"}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const getDesignPreviewUrl = (fileList) => {
    if (!Array.isArray(fileList) || !fileList.length) return undefined;
    const file = fileList[0];
    return file?.thumbUrl || file?.url || file?.response?.url;
  };

  const renderPositionCard = (position) => {
    if (!position) return null;
    const positionId = String(position.id);
    const existingDesign = existingDesignMap.get(positionId);
    const canDeleteDesign = Boolean(
      existingDesign?.id && existingDesign?.design_url
    );
    const deleteLoading = existingDesign?.id
      ? Boolean(deletingDesignIds[existingDesign.id])
      : false;
    const images = Array.isArray(position?.images)
      ? position.images
      : position?.image
      ? [position.image]
      : [];
    const firstImage = images.find((img) => {
      if (typeof img === "string") return true;
      return Boolean(img?.image_url || img?.url);
    });
    const previewImageUrl =
      typeof firstImage === "string"
        ? firstImage
        : firstImage?.image_url || firstImage?.url || "";
    const fileList = designFiles[positionId] || [];
    const designPreviewUrl = getDesignPreviewUrl(
      extractUploadFileList(fileList)
    );
    const designArea = extractDesignAreaFromRecord(position);
    return (
      <Card
        key={positionId}
        className="flex h-full flex-col"
        title={position?.name || t("positions.untitled")}
        extra={
          canDeleteDesign ? (
            <Popconfirm
              title={t("positions.deleteConfirmTitle")}
              okText={tCommon("actions.delete")}
              cancelText={tCommon("actions.cancel")}
              okButtonProps={{ loading: deleteLoading }}
              onConfirm={() =>
                handleDeleteDesign(existingDesign.id, positionId)
              }
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={deleteLoading}
                aria-label={t("positions.deleteLabel")}
              />
            </Popconfirm>
          ) : null
        }
        bodyStyle={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          flex: 1,
        }}
      >
        <div className="relative flex w-full flex-1 items-center overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50 to-gray-100 shadow-sm">
          {previewImageUrl ? (
            <div className="relative  w-full">
              <img
                src={previewImageUrl}
                alt={position?.name || "position"}
                className={`block w-full rounded-2xl 
                    object-contain`}
                style={{ backgroundColor: orderDetail?.color?.hex_code }}
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
                        {t("positions.designAreaPlaceholder")}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center p-6">
              <Empty description={t("positions.noPreview")} />
            </div>
          )}
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <Upload
            accept={ACCEPT_ATTR}
            maxCount={1}
            fileList={fileList}
            customRequest={({ onSuccess }) => onSuccess?.("ok")}
            onChange={({ fileList: nextList }) =>
              handleUploadChange(positionId, nextList)
            }
            beforeUpload={validateFile}
          >
            <Button block icon={<UploadOutlined />}>
              {t("positions.designUploadLabel")}
            </Button>
          </Upload>
          <Typography.Paragraph
            type="secondary"
            style={{ margin: 0, fontSize: 13 }}
          >
            {t("positions.designUploadHelp")}
          </Typography.Paragraph>
        </div>
      </Card>
    );
  };

  const pageTitle = t("title");
  const subCategory = orderDetail?.product?.sub_category;
  const showSubCategorySwitch = Boolean(subCategory?.optional);

  return (
    <RequireRole anyOfRoles={["companyAdmin", "customerAdmin"]}>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Typography.Title level={3} style={{ margin: 0 }}>
            {pageTitle}
          </Typography.Title>
          <Space>
            <Popconfirm
              title={t("actions.saveConfirmTitle")}
              okText={t("actions.save")}
              cancelText={tCommon("actions.cancel")}
              okButtonProps={{ loading: saving }}
              disabled={!canSave}
              onConfirm={handleSave}
            >
              <Button type="primary" disabled={!canSave} loading={saving}>
                {t("actions.save")}
              </Button>
            </Popconfirm>
          </Space>
        </div>

        {!itemId ? (
          <Alert type="error" message={t("messages.missingParams")} showIcon />
        ) : orderLoading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        ) : !orderDetail ? (
          <Alert type="error" message={t("messages.noItemFound")} showIcon />
        ) : (
          <>
            <Card
              title={t("orderInfo.title")}
              bodyStyle={{ padding: 24 }}
              className="shadow-md w-full"
            >
              <div className="mx-auto flex w-full flex-col gap-6">
                <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                  {/* Sol - Product Preview */}
                  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <span>{t("orderInfo.preview")}</span>
                      <span className="text-gray-400">
                        {t("orderInfo.imageHint")}
                      </span>
                    </div>

                    <div className="mt-4 flex aspect-[3/4] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-3">
                      {orderDetail?.image_url ? (
                        <Image
                          src={orderDetail.image_url}
                          alt="order item"
                          preview={true}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            borderRadius: 20,
                          }}
                        />
                      ) : (
                        <Empty description={t("orderInfo.noImage")} />
                      )}
                    </div>
                  </div>

                  {/* Sağ - Info Section */}
                  <div className="rounded-3xl border border-gray-100 bg-white p-5  shadow-sm">
                    <div className="flex flex-col gap-3">
                      {/* Üst başlık alanı */}

                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {/* Order Number */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            {tOrders("columns.orderNumber")}
                          </span>
                          <span className="text-lg font-semibold text-gray-900">
                            {orderDetail?.order?.order_number ||
                              orderDetail?.order_number ||
                              tOrders("common.none")}
                          </span>
                        </div>

                        {/* SKU */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            {tOrders("columns.sku")}
                          </span>
                          <span className="text-lg font-semibold text-gray-900">
                            {orderDetail?.sku || tOrders("common.none")}
                          </span>
                        </div>

                        {/* Price */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            {tOrders("columns.price")}
                          </span>
                          <span className="text-lg font-semibold text-gray-900">
                            {formatAmount(orderDetail?.price)}
                          </span>
                        </div>
                      </div>

                      {/* Product Detail Blocks */}

                      <div className="grid gap-4 md:grid-cols-3">
                        {/* Product */}

                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {tOrders("columns.product")}
                        </span>
                        <p className="mt-1 text-base font-semibold text-gray-900">
                          {orderDetail?.product?.name || tOrders("common.none")}
                        </p>

                        {/* Size */}

                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {tOrders("columns.size")}
                        </span>
                        <p className="mt-1 text-base font-semibold text-gray-900">
                          {orderDetail?.size?.name || tOrders("common.none")}
                        </p>

                        {/* Color */}

                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {tOrders("columns.color")}
                        </span>
                        <p className="mt-1 text-base font-semibold text-gray-900">
                          {orderDetail?.color?.name || tOrders("common.none")}
                        </p>
                      </div>

                      {/* Options */}

                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {tOrders("columns.options")}
                      </span>
                      <div className="mt-2 text-base font-semibold text-gray-900">
                        {renderOptions(orderDetail?.options)}
                      </div>

                      {/* Notes (designer note görsün ama değiştirmesin istersen disabled yapılabilir) */}

                      <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                        <span>{t("fields.note")}</span>
                      </div>

                      <Input.TextArea
                        rows={4}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        className="rounded-2xl border-none bg-white shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card title={t("fields.positions")}>
              {positionsLoading ? (
                <Spin />
              ) : positions.length ? (
                <>
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                    <Select
                      mode="multiple"
                      value={selectedPositionIds}
                      onChange={handlePositionChange}
                      placeholder={t("fields.positionsPlaceholder")}
                      options={positions.map((position) => ({
                        value: String(position.id),
                        label: position?.name || `#${position.id}`,
                      }))}
                      style={{ width: "100%" }}
                      optionFilterProp="label"
                      tagRender={renderPositionTag}
                    />
                    {showSubCategorySwitch ? (
                      <div className="flex items-center gap-2">
                        <Typography.Text>
                          {subCategory?.name || "-"}
                        </Typography.Text>
                        <Switch
                          checked={isSubCategory}
                          onChange={setIsSubCategory}
                        />
                      </div>
                    ) : null}
                  </div>
                  {selectedPositions.length ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {selectedPositions.map((position) =>
                        renderPositionCard(position)
                      )}
                    </div>
                  ) : (
                    <Empty description={t("positions.noSelection")} />
                  )}
                </>
              ) : (
                <Alert
                  type="info"
                  message={t("fields.positionsEmpty")}
                  showIcon
                />
              )}
            </Card>
          </>
        )}
      </div>
    </RequireRole>
  );
}
