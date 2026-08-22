"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Spin,
  Switch,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  DeleteOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useSelector } from "react-redux";
import { OrdersAPI, ProductPositionsAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { useUnsavedChangesPrompt } from "@/hooks/useUnsavedChangesPrompt";
import { extractUploadFileList } from "@/utils/formDataHelpers";
import { extractDesignAreaFromRecord } from "@/utils/designArea";
import {
  GuardedPreviewImage,
  isFilePreviewAllowed,
} from "@/components/common/media/ImagePreviewGate";
import { useOrderDesignUploadQueue } from "@/components/orders/OrderDesignUploadQueueProvider";

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
const ACCEPT_ATTR = ".png,.jpg,.jpeg,.webp,.pdf,.dst";
const MAX_FILE_SIZE_MB = 2000;

const hasFileExtension = (file, extension) =>
  String(file?.name || "")
    .trim()
    .toLowerCase()
    .endsWith(extension);

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

const normalizeDesignFilesForSnapshot = (designFiles = {}) =>
  Object.keys(designFiles)
    .sort()
    .reduce((acc, positionId) => {
      acc[positionId] = extractUploadFileList(designFiles[positionId]).map(
        (file) => ({
          name: file?.name || "",
          size: file?.size ?? file?.originFileObj?.size ?? null,
          type: file?.type ?? file?.originFileObj?.type ?? "",
          url: file?.url || "",
          hasNewFile: Boolean(file?.originFileObj),
        }),
      );
      return acc;
    }, {});

const createEntryId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createPersonalizedPositionDesign = (positionId = "") => ({
  id: createEntryId(),
  positionId: String(positionId || ""),
  fileList: [],
  existingDesignId: null,
});

const createPersonalizedDesignGroup = () => ({
  id: createEntryId(),
  quantity: 1,
  designs: [],
  locked: false,
  legacy: false,
});

const normalizePersonalizedEntriesForSnapshot = (groups = []) =>
  groups.map((group) => ({
    quantity: Number(group?.quantity || 0),
    locked: Boolean(group?.locked),
    designs: (group?.designs || []).map((design) => ({
      positionId: String(design?.positionId || ""),
      files: normalizeDesignFilesForSnapshot({ entry: design?.fileList || [] })
        .entry,
    })),
  }));

const createDesignSnapshot = ({
  note,
  selectedPositionIds,
  designFiles,
  isSubCategory,
  routingSubCategoryId,
  personalizedDesignEntries,
}) =>
  JSON.stringify({
    note: note || "",
    isSubCategory: Boolean(isSubCategory),
    routingSubCategoryId: routingSubCategoryId
      ? String(routingSubCategoryId)
      : null,
    selectedPositionIds: [...(selectedPositionIds || [])].map(String).sort(),
    designFiles: normalizeDesignFilesForSnapshot(designFiles),
    personalizedDesignEntries: normalizePersonalizedEntriesForSnapshot(
      personalizedDesignEntries,
    ),
  });

const markUploadFilesAsReady = (fileList = []) =>
  fileList.map((file) => {
    if (!file?.originFileObj) {
      return file;
    }
    return {
      ...file,
      status: "done",
      percent: 100,
    };
  });

export default function OrderDesignModal({
  open,
  orderItemId,
  onCancel,
  onSaved,
  zIndex = 1300,
}) {
  const { message } = AntdApp.useApp();
  const { enqueueUpload } = useOrderDesignUploadQueue();
  const t = useTranslations("dashboard.orders.design");
  const tOrders = useTranslations("dashboard.orders");
  const tCommon = useTranslations("common");
  const { confirmIfDirty, unsavedChangesModalContextHolder } =
    useUnsavedChangesPrompt();
  const itemId = orderItemId ? String(orderItemId) : "";
  const initialSnapshotRef = useRef("");
  const user = useSelector((state) => state.auth.user);
  const categoriesData = useSelector(
    (state) => state.categories?.listWithSubCategories,
  );

  const [orderDetail, setOrderDetail] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [note, setNote] = useState("");
  const [selectedPositionIds, setSelectedPositionIds] = useState([]);
  const [designFiles, setDesignFiles] = useState({});
  const [personalizedDesignEntries, setPersonalizedDesignEntries] = useState(
    [],
  );
  const [isSubCategory, setIsSubCategory] = useState(false);
  const [routingSubCategoryId, setRoutingSubCategoryId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [shouldHydrateFromOrder, setShouldHydrateFromOrder] = useState(false);
  const [deletingDesignIds, setDeletingDesignIds] = useState({});
  const [isDirty, setIsDirty] = useState(false);

  const resetState = useCallback(() => {
    setOrderDetail(null);
    setOrderLoading(false);
    setPositions([]);
    setPositionsLoading(false);
    setNote("");
    setSelectedPositionIds([]);
    setDesignFiles({});
    setPersonalizedDesignEntries([]);
    setIsSubCategory(false);
    setRoutingSubCategoryId(null);
    setSaving(false);
    setShouldHydrateFromOrder(false);
    setDeletingDesignIds({});
    setIsDirty(false);
    initialSnapshotRef.current = "";
  }, []);

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
          error?.response?.data?.error?.message || t("messages.loadOrderError"),
        );
      } finally {
        if (withLoading) {
          setOrderLoading(false);
        }
      }
    },
    [itemId, message, t],
  );

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    if (!itemId) return;
    loadOrderDetail({ hydrate: true });
  }, [itemId, loadOrderDetail, open, resetState]);

  const existingDesigns = useMemo(() => {
    if (!Array.isArray(orderDetail?.designs)) return [];
    return orderDetail.designs.filter((design) => design?.product_position_id);
  }, [orderDetail]);

  const itemQuantity = Math.max(1, Number(orderDetail?.quantity || 1));
  const isPersonalizedQuantityMode = Boolean(
    orderDetail?.has_personalization && itemQuantity > 1,
  );

  const existingDesignMap = useMemo(() => {
    const map = new Map();
    existingDesigns.forEach((design) => {
      map.set(String(design.product_position_id), design);
    });
    return map;
  }, [existingDesigns]);

  const lockedPositionIds = useMemo(
    () =>
      Array.from(
        new Set(
          existingDesigns
            .filter((design) => Boolean(design?.design_url))
            .map((design) => String(design.product_position_id)),
        ),
      ),
    [existingDesigns],
  );

  const lockedPositionSet = useMemo(
    () => new Set(lockedPositionIds),
    [lockedPositionIds],
  );

  useEffect(() => {
    if (!shouldHydrateFromOrder) return;
    if (!orderDetail) {
      setNote("");
      setRoutingSubCategoryId(null);
      setSelectedPositionIds([]);
      setDesignFiles({});
      setPersonalizedDesignEntries([]);
      setShouldHydrateFromOrder(false);
      return;
    }

    const nextNote = orderDetail?.notes || "";
    const nextIsSubCategory = Boolean(orderDetail?.is_sub_category);
    const nextRoutingSubCategoryId =
      orderDetail?.routing_sub_category_id ??
      orderDetail?.routing_sub_category?.id ??
      null;
    let nextSelectedPositionIds = [];
    let nextDesignFiles = {};
    let nextPersonalizedEntries = [];

    if (existingDesigns.length && isPersonalizedQuantityMode) {
      const groups = new Map();
      existingDesigns.forEach((design) => {
        const key = design?.design_group_id
          ? `group-${design.design_group_id}`
          : "legacy";
        const current = groups.get(key) || [];
        current.push(design);
        groups.set(key, current);
      });
      nextPersonalizedEntries = Array.from(groups.entries()).map(
        ([key, group]) => {
          const legacy = key === "legacy";
          const designsByPosition = new Map();
          group.forEach((design) => {
            const positionId = String(design.product_position_id);
            const current = designsByPosition.get(positionId) || [];
            current.push(design);
            designsByPosition.set(positionId, current);
          });
          const quantity = legacy
            ? itemQuantity
            : Math.max(
                1,
                ...Array.from(designsByPosition.values()).map(
                  (positionDesigns) => positionDesigns.length,
                ),
              );
          return {
            id: key,
            quantity,
            designs: Array.from(designsByPosition.entries()).map(
              ([positionId, positionDesigns]) => {
                const design = positionDesigns[0];
                const url = design?.design_url;
                return {
                  id: `${key}-${positionId}`,
                  positionId,
                  fileList: url
                    ? [
                        {
                          uid: `existing-${design.id}`,
                          name:
                            design?.file_name ||
                            url.split("/").pop() ||
                            t("positions.designUploadLabel"),
                          status: "done",
                          url,
                          thumbUrl: design?.thumbnail_url || undefined,
                          thumbnailStatus: design?.thumbnail_status,
                        },
                      ]
                    : [],
                  existingDesignId: design.id,
                };
              },
            ),
            existingDesignIds: group.map((design) => design.id),
            locked: true,
            legacy,
          };
        },
      );
      nextSelectedPositionIds = Array.from(
        new Set(
          nextPersonalizedEntries.flatMap((entry) =>
            entry.designs.map((design) => design.positionId),
          ),
        ),
      );
    } else if (isPersonalizedQuantityMode) {
      nextPersonalizedEntries = [createPersonalizedDesignGroup()];
    } else if (existingDesigns.length) {
      nextSelectedPositionIds = Array.from(
        new Set(
          existingDesigns.map((design) => String(design.product_position_id)),
        ),
      );
      nextDesignFiles = nextSelectedPositionIds.reduce((acc, positionId) => {
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
              thumbUrl: designInfo?.thumbnail_url || undefined,
              thumbnailStatus: designInfo?.thumbnail_status,
            },
          ];
        }
        return acc;
      }, {});
    }

    setNote(nextNote);
    setIsSubCategory(nextIsSubCategory);
    setRoutingSubCategoryId(nextRoutingSubCategoryId);
    setSelectedPositionIds(nextSelectedPositionIds);
    setDesignFiles(nextDesignFiles);
    setPersonalizedDesignEntries(nextPersonalizedEntries);
    initialSnapshotRef.current = createDesignSnapshot({
      note: nextNote,
      isSubCategory: nextIsSubCategory,
      routingSubCategoryId: nextRoutingSubCategoryId,
      selectedPositionIds: nextSelectedPositionIds,
      designFiles: nextDesignFiles,
      personalizedDesignEntries: nextPersonalizedEntries,
    });
    setIsDirty(false);
    setShouldHydrateFromOrder(false);
  }, [
    existingDesignMap,
    existingDesigns,
    isPersonalizedQuantityMode,
    itemQuantity,
    orderDetail,
    shouldHydrateFromOrder,
    t,
  ]);

  useEffect(() => {
    if (!open || !orderDetail || shouldHydrateFromOrder) return;
    if (!initialSnapshotRef.current) return;
    const currentSnapshot = createDesignSnapshot({
      note,
      isSubCategory,
      routingSubCategoryId,
      selectedPositionIds,
      designFiles,
      personalizedDesignEntries,
    });
    setIsDirty(currentSnapshot !== initialSnapshotRef.current);
  }, [
    designFiles,
    isSubCategory,
    note,
    open,
    orderDetail,
    personalizedDesignEntries,
    routingSubCategoryId,
    selectedPositionIds,
    shouldHydrateFromOrder,
  ]);

  const derivedProductId = useMemo(() => {
    const candidate = orderDetail?.product_id ?? orderDetail?.product?.id;
    if (candidate === undefined || candidate === null) {
      return undefined;
    }
    return candidate;
  }, [orderDetail]);

  const productSubCategoryOptions = useMemo(() => {
    const subCategories = Array.isArray(orderDetail?.product?.sub_categories)
      ? orderDetail.product.sub_categories
      : [];
    return subCategories
      .filter((item) => item?.id && (!item?.status || item.status === "active"))
      .map((item) => ({
        value: String(item.id),
        label: item.name || `#${item.id}`,
      }));
  }, [orderDetail]);
  const requiresProductSubCategoryRouting =
    productSubCategoryOptions.length > 1;
  const hasValidProductSubCategoryRouting =
    !requiresProductSubCategoryRouting ||
    productSubCategoryOptions.some(
      (option) => option.value === String(routingSubCategoryId || ""),
    );
  const canRouteToPrint =
    (user?.roles || []).includes("customeradmin") &&
    !requiresProductSubCategoryRouting &&
    String(orderDetail?.product?.category?.name || "")
      .trim()
      .toLowerCase() === "engraving";
  const printSubCategoryOptions = useMemo(() => {
    const categories = Array.isArray(categoriesData)
      ? categoriesData
      : Array.isArray(categoriesData?.items)
        ? categoriesData.items
        : Array.isArray(categoriesData?.data)
          ? categoriesData.data
          : [];
    const printCategory = categories.find(
      (category) =>
        String(category?.name || "")
          .trim()
          .toLowerCase() === "print" &&
        (!category?.status || category.status === "active"),
    );
    const subCategories = Array.isArray(printCategory?.sub_categories)
      ? printCategory.sub_categories
      : [];
    return subCategories
      .filter((item) => item?.id && (!item?.status || item.status === "active"))
      .map((item) => ({
        value: String(item.id),
        label: item.name || `#${item.id}`,
      }));
  }, [categoriesData]);

  useEffect(() => {
    if (!open || !derivedProductId) {
      setPositions([]);
      return;
    }
    let active = true;
    setPositionsLoading(true);
    const loadPositions = async () => {
      try {
        const response = await ProductPositionsAPI.flatList({
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
            t("messages.loadPositionsError"),
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
  }, [derivedProductId, message, open, t]);

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
    [positionMap, selectedPositionIds],
  );

  const personalizedTotalQuantity = useMemo(() => {
    return personalizedDesignEntries.reduce(
      (sum, group) => sum + Number(group?.quantity || 0),
      0,
    );
  }, [personalizedDesignEntries]);

  const personalizedQuantityIncomplete = Boolean(
    isPersonalizedQuantityMode && personalizedTotalQuantity !== itemQuantity,
  );

  const handlePositionChange = useCallback(
    (values) => {
      const lockedRemoved = lockedPositionIds.filter(
        (id) => !values.includes(id),
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
    [lockedPositionIds, message, t],
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
    [lockedPositionSet],
  );

  const enrichFileListWithPreview = useCallback(async (fileList = []) => {
    const mapped = await Promise.all(
      fileList.map(async (file) => {
        if (file?.thumbUrl || !file?.originFileObj) {
          return file;
        }
        if (!isFilePreviewAllowed(file.originFileObj)) {
          return file;
        }
        try {
          const preview = await fileToDataUrl(file.originFileObj);
          return { ...file, thumbUrl: preview };
        } catch {
          return file;
        }
      }),
    );
    return mapped;
  }, []);

  const handleUploadChange = useCallback(
    (positionId, fileList) => {
      enrichFileListWithPreview(markUploadFilesAsReady(fileList)).then(
        (processed) => {
          setDesignFiles((prev) => ({
            ...prev,
            [positionId]: processed,
          }));
        },
      );
    },
    [enrichFileListWithPreview],
  );

  const handlePersonalizedUploadChange = useCallback(
    (groupId, designId, fileList) => {
      enrichFileListWithPreview(markUploadFilesAsReady(fileList)).then(
        (processed) => {
          setPersonalizedDesignEntries((prev) =>
            prev.map((group) =>
              group.id === groupId
                ? {
                    ...group,
                    designs: group.designs.map((design) =>
                      design.id === designId
                        ? { ...design, fileList: processed }
                        : design,
                    ),
                  }
                : group,
            ),
          );
        },
      );
    },
    [enrichFileListWithPreview],
  );

  const handlePersonalizedQuantityChange = useCallback(
    (groupId, value) => {
      setPersonalizedDesignEntries((prev) => {
        const current = prev.find((group) => group.id === groupId);
        if (!current || current.locked) return prev;
        const usedByOthers = prev.reduce(
          (sum, group) =>
            group.id !== groupId ? sum + Number(group.quantity || 0) : sum,
          0,
        );
        const max = Math.max(1, itemQuantity - usedByOthers);
        const nextQuantity = Math.min(
          max,
          Math.max(1, Number.parseInt(value || 1, 10) || 1),
        );
        return prev.map((group) =>
          group.id === groupId ? { ...group, quantity: nextQuantity } : group,
        );
      });
    },
    [itemQuantity],
  );

  const handlePersonalizedGroupPositionsChange = useCallback(
    (groupId, values) => {
      setPersonalizedDesignEntries((prev) =>
        prev.map((group) => {
          if (group.id !== groupId || group.locked) return group;
          const designs = group.designs.filter((design) =>
            values.includes(design.positionId),
          );
          values.forEach((positionId) => {
            if (!designs.some((design) => design.positionId === positionId)) {
              designs.push(createPersonalizedPositionDesign(positionId));
            }
          });
          return { ...group, designs };
        }),
      );
    },
    [],
  );

  const handleAddPersonalizedDesign = useCallback(() => {
    if (personalizedTotalQuantity >= itemQuantity) return;
    setPersonalizedDesignEntries((prev) => [
      ...prev,
      createPersonalizedDesignGroup(),
    ]);
  }, [itemQuantity, personalizedTotalQuantity]);

  const handleRemovePersonalizedDesign = useCallback((groupId) => {
    setPersonalizedDesignEntries((prev) =>
      prev.filter((group) => group.id !== groupId || group.locked),
    );
  }, []);

  const validateFile = useCallback(
    (file) => {
      const isAllowedType =
        ACCEPTED_FILE_TYPES.includes(file.type) ||
        hasFileExtension(file, ".dst") ||
        (hasFileExtension(file, ".pdf") && file.type === "");
      if (!isAllowedType) {
        message.error(t("positions.invalidFileType"));
        return Upload.LIST_IGNORE;
      }
      const sizeInMb = file.size / 1024 / 1024;
      if (sizeInMb > MAX_FILE_SIZE_MB) {
        message.error(
          t("positions.invalidFileSize", { size: MAX_FILE_SIZE_MB }),
        );
        return Upload.LIST_IGNORE;
      }
      return true;
    },
    [message, t],
  );

  const canSave = Boolean(
    itemId && orderDetail?.id && hasValidProductSubCategoryRouting,
  );

  const handleSave = useCallback(async () => {
    if (!orderDetail?.id) {
      message.error(t("messages.missingParams"));
      return;
    }
    if (!hasValidProductSubCategoryRouting) {
      message.error(t("messages.productSubCategoryRequired"));
      return;
    }
    if (isPersonalizedQuantityMode) {
      if (!personalizedDesignEntries.length) {
        message.error(t("positions.noSelectionError"));
        return;
      }
      const hasGroupWithoutPosition = personalizedDesignEntries.some(
        (group) => !group.designs.length,
      );
      if (hasGroupWithoutPosition) {
        message.error(t("positions.noSelectionError"));
        return;
      }
      const hasMissingPersonalizedFile = personalizedDesignEntries.some(
        (group) =>
          group.designs.some(
            (design) => extractUploadFileList(design.fileList).length === 0,
          ),
      );
      if (hasMissingPersonalizedFile) {
        message.error(t("positions.missingFile"));
        return;
      }
      if (personalizedQuantityIncomplete) {
        message.error(t("positions.incompleteQuantity"));
        return;
      }

      const files = personalizedDesignEntries.flatMap((group) =>
        group.locked
          ? []
          : group.designs.map((design) => {
              const fileItem = extractUploadFileList(design.fileList).find(
                (file) => Boolean(file.originFileObj),
              );
              return {
                clientId: design.id,
                groupId: group.id,
                positionId: design.positionId,
                positionName:
                  positionMap.get(design.positionId)?.name ||
                  `#${design.positionId}`,
                quantity: Number(group.quantity || 1),
                file: fileItem?.originFileObj,
              };
            }),
      );

      if (files.length) {
        const taskId = enqueueUpload({
          orderItemId: orderDetail.id,
          orderId: orderDetail.order_id,
          orderNumber:
            orderDetail?.order?.order_number ||
            orderDetail?.order_number ||
            "-",
          note,
          isSubCategory,
          includeRoutingSubCategory:
            canRouteToPrint || requiresProductSubCategoryRouting,
          routingSubCategoryId,
          positions: Array.from(new Set(files.map((file) => file.positionId))),
          files,
        });
        if (!taskId) {
          message.error(t("messages.saveError"));
          return;
        }
        message.success(t("messages.uploadQueued", { count: files.length }));
        onSaved?.({ queued: true, taskId });
        return;
      }
    }

    if (!isPersonalizedQuantityMode) {
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

      if (positionsToSubmit.length) {
        const files = positionsToSubmit.map((positionId) => {
          const fileList = extractUploadFileList(designFiles[positionId]);
          const fileItem = fileList.find((file) => Boolean(file.originFileObj));
          return {
            positionId,
            positionName:
              positionMap.get(String(positionId))?.name || `#${positionId}`,
            file: fileItem?.originFileObj,
          };
        });
        const taskId = enqueueUpload({
          orderItemId: orderDetail.id,
          orderId: orderDetail.order_id,
          orderNumber:
            orderDetail?.order?.order_number ||
            orderDetail?.order_number ||
            "-",
          note,
          isSubCategory,
          includeRoutingSubCategory:
            canRouteToPrint || requiresProductSubCategoryRouting,
          routingSubCategoryId,
          positions: positionsToSubmit,
          files,
        });
        if (!taskId) {
          message.error(t("messages.saveError"));
          return;
        }
        message.success(
          t("messages.uploadQueued", { count: positionsToSubmit.length }),
        );
        onSaved?.({ queued: true, taskId });
        return;
      }
    }

    const formData = new FormData();
    formData.append("order_item_id", String(orderDetail.id));
    formData.append("order_id", String(orderDetail.order_id));
    formData.append("note", note || "");
    formData.append("is_sub_category", String(Boolean(isSubCategory)));
    if (canRouteToPrint || requiresProductSubCategoryRouting) {
      formData.append(
        "routing_sub_category_id",
        routingSubCategoryId ? String(routingSubCategoryId) : "",
      );
    }

    setSaving(true);
    try {
      await OrdersAPI.saveDesign(formData);
      message.success(t("messages.saveSuccess"));
      onSaved?.();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("messages.saveError"),
      );
    } finally {
      setSaving(false);
    }
  }, [
    canRouteToPrint,
    designFiles,
    enqueueUpload,
    hasValidProductSubCategoryRouting,
    isSubCategory,
    isPersonalizedQuantityMode,
    message,
    note,
    onSaved,
    orderDetail,
    personalizedDesignEntries,
    personalizedQuantityIncomplete,
    positionMap,
    routingSubCategoryId,
    requiresProductSubCategoryRouting,
    selectedPositionIds,
    t,
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
          prev.filter((selectedId) => selectedId !== positionId),
        );
        await loadOrderDetail({ hydrate: !isDirty, withLoading: false });
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.deleteError"),
        );
      } finally {
        setDeletingDesignIds((prev) => {
          const next = { ...prev };
          delete next[designId];
          return next;
        });
      }
    },
    [isDirty, loadOrderDetail, message, t],
  );

  const handleDeletePersonalizedGroup = useCallback(
    async (group) => {
      const designIds = Array.from(new Set(group?.existingDesignIds || []));
      if (!designIds.length) return;
      const loadingId = designIds[0];
      setDeletingDesignIds((prev) => ({ ...prev, [loadingId]: true }));
      try {
        await OrdersAPI.deleteDesign(loadingId);
        message.success(t("messages.deleteSuccess"));
        setPersonalizedDesignEntries((prev) =>
          prev.filter((entry) => entry.id !== group.id),
        );
        await loadOrderDetail({ hydrate: false, withLoading: false });
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message || t("messages.deleteError"),
        );
      } finally {
        setDeletingDesignIds((prev) => {
          const next = { ...prev };
          delete next[loadingId];
          return next;
        });
      }
    },
    [loadOrderDetail, message, t],
  );

  const handleCancel = useCallback(() => {
    confirmIfDirty({
      isDirty,
      onDiscard: onCancel,
    });
  }, [confirmIfDirty, isDirty, onCancel]);

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
    return file?.thumbUrl || file?.response?.thumbnail_url;
  };

  const getDesignPreviewFallback = (fileList, defaultText) => {
    const file = Array.isArray(fileList) ? fileList[0] : null;
    if (file?.thumbUrl || file?.originFileObj) return defaultText;
    if (file?.thumbnailStatus === "failed") {
      return tCommon("designThumbnail.failed");
    }
    if (file?.thumbnailStatus === "not_applicable") {
      return tCommon("designThumbnail.notApplicable");
    }
    if (file?.url) return tCommon("designThumbnail.preparing");
    return defaultText;
  };

  const renderPositionCard = (position) => {
    if (!position) return null;
    const positionId = String(position.id);
    const existingDesign = existingDesignMap.get(positionId);
    const canDeleteDesign = Boolean(
      existingDesign?.id && existingDesign?.design_url,
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
      extractUploadFileList(fileList),
    );
    const designPreviewFallback = getDesignPreviewFallback(
      extractUploadFileList(fileList),
      t("positions.designAreaPlaceholder"),
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
                      <Image
                        src={designPreviewUrl}
                        alt="design preview"
                        width="100%"
                        height="100%"
                        preview={{ src: designPreviewUrl }}
                        style={{ objectFit: "contain", borderRadius: 8 }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                        {designPreviewFallback}
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

  const renderPersonalizedPositionCard = (group, design) => {
    const position = positionMap.get(design.positionId);
    const fileList = design.fileList || [];
    const designPreviewUrl = getDesignPreviewUrl(
      extractUploadFileList(fileList),
    );
    const designPreviewFallback = getDesignPreviewFallback(
      extractUploadFileList(fileList),
      t("positions.designAreaPlaceholder"),
    );
    const designArea = position ? extractDesignAreaFromRecord(position) : null;
    const positionImageUrl =
      position?.images?.[0]?.image_url || orderDetail?.image_url;
    return (
      <Card key={design.id} title={position?.name || t("positions.untitled")}>
        <div className="flex flex-col gap-4">
          <div className="relative flex min-h-36 w-full items-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
            {positionImageUrl ? (
              <div className="relative w-full">
                <img
                  src={positionImageUrl}
                  alt={position?.name || "position"}
                  className="block w-full rounded-lg object-contain"
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
                        <Image
                          src={designPreviewUrl}
                          alt="design preview"
                          width="100%"
                          height="100%"
                          preview={{ src: designPreviewUrl }}
                          style={{ objectFit: "contain", borderRadius: 8 }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                          {designPreviewFallback}
                        </div>
                      )}
                    </div>
                  ) : designPreviewUrl ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Image
                        src={designPreviewUrl}
                        alt="design preview"
                        width={96}
                        height={96}
                        preview={{ src: designPreviewUrl }}
                        style={{ objectFit: "contain", borderRadius: 8 }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : designPreviewUrl ? (
              <Image
                src={designPreviewUrl}
                alt="design preview"
                width="100%"
                height={144}
                preview={{ src: designPreviewUrl }}
                style={{ objectFit: "contain" }}
              />
            ) : (
              <Empty description={t("positions.noPreview")} />
            )}
          </div>

          <Upload
            accept={ACCEPT_ATTR}
            maxCount={1}
            disabled={group.locked}
            fileList={fileList}
            customRequest={({ onSuccess }) => onSuccess?.("ok")}
            onChange={({ fileList: nextList }) =>
              handlePersonalizedUploadChange(group.id, design.id, nextList)
            }
            beforeUpload={validateFile}
          >
            <Button block icon={<UploadOutlined />} disabled={group.locked}>
              {t("positions.designUploadLabel")}
            </Button>
          </Upload>
        </div>
      </Card>
    );
  };

  const renderPersonalizedDesignGroup = (group, index) => {
    const usedByOthers = Math.max(
      0,
      personalizedTotalQuantity - Number(group.quantity || 0),
    );
    const maxQuantity = Math.max(1, itemQuantity - usedByOthers);
    const loadingId = group.existingDesignIds?.[0];
    const deleteLoading = loadingId
      ? Boolean(deletingDesignIds[loadingId])
      : false;

    return (
      <Card
        key={group.id}
        title={t("positions.groupTitle", { number: index + 1 })}
        extra={
          group.locked ? (
            <Popconfirm
              title={t("positions.deleteGroupConfirmTitle")}
              okText={tCommon("actions.delete")}
              cancelText={tCommon("actions.cancel")}
              okButtonProps={{ loading: deleteLoading }}
              onConfirm={() => handleDeletePersonalizedGroup(group)}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={deleteLoading}
                aria-label={t("positions.deleteLabel")}
              />
            </Popconfirm>
          ) : (
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleRemovePersonalizedDesign(group.id)}
              aria-label={t("positions.removeGroup")}
            />
          )
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Typography.Text strong>
                {t("positions.quantityLabel")}
              </Typography.Text>
              <InputNumber
                className="mt-2 w-full"
                min={1}
                max={maxQuantity}
                precision={0}
                disabled={group.locked}
                value={group.quantity}
                onChange={(value) =>
                  handlePersonalizedQuantityChange(group.id, value)
                }
              />
            </div>
            <div>
              <Typography.Text strong>
                {t("positions.groupPositionsLabel")}
              </Typography.Text>
              <Select
                mode="multiple"
                className="mt-2 w-full"
                value={group.designs.map((design) => design.positionId)}
                disabled={group.locked}
                onChange={(values) =>
                  handlePersonalizedGroupPositionsChange(group.id, values)
                }
                options={positions.map((position) => ({
                  value: String(position.id),
                  label: position?.name || `#${position.id}`,
                }))}
                placeholder={t("fields.positionsPlaceholder")}
                optionFilterProp="label"
              />
            </div>
          </div>

          {group.designs.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.designs.map((design) =>
                renderPersonalizedPositionCard(group, design),
              )}
            </div>
          ) : (
            <Empty description={t("positions.noSelection")} />
          )}

          {group.legacy ? (
            <Typography.Text type="secondary">
              {t("positions.legacyQuantityHelp")}
            </Typography.Text>
          ) : null}
        </div>
      </Card>
    );
  };

  const subCategory = orderDetail?.product?.sub_category;
  const showSubCategorySwitch = Boolean(subCategory?.optional);

  return (
    <>
      {unsavedChangesModalContextHolder}
      <Modal
        open={open}
        title={t("title")}
        onCancel={handleCancel}
        width="min(1200px, 95vw)"
        zIndex={zIndex}
        destroyOnClose={false}
        styles={{
          body: {
            maxHeight: "calc(100vh - 220px)",
            overflowY: "auto",
          },
        }}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            {tCommon("actions.cancel")}
          </Button>,
          <Popconfirm
            key="save"
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
          </Popconfirm>,
        ]}
      >
        {!itemId ? (
          <Alert type="error" message={t("messages.missingParams")} showIcon />
        ) : orderLoading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        ) : !orderDetail ? (
          <Alert type="error" message={t("messages.noItemFound")} showIcon />
        ) : (
          <div className="space-y-4">
            <Card
              title={t("orderInfo.title")}
              bodyStyle={{ padding: 24 }}
              className="shadow-md w-full"
            >
              <div className="mx-auto flex w-full flex-col gap-6">
                <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <span>{t("orderInfo.preview")}</span>
                      <span className="text-gray-400">
                        {t("orderInfo.imageHint")}
                      </span>
                    </div>

                    <div className="mt-4 flex aspect-[3/4] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-3">
                      {orderDetail?.image_url ? (
                        <GuardedPreviewImage
                          src={orderDetail.image_url}
                          alt="order item"
                          openLabel={tCommon("actions.open")}
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

                  <div className="rounded-3xl border border-gray-100 bg-white p-5  shadow-sm">
                    <div className="flex flex-col gap-3">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            {tOrders("columns.sku")}
                          </span>
                          <span className="text-lg font-semibold text-gray-900">
                            {orderDetail?.sku || tOrders("common.none")}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            {tOrders("columns.price")}
                          </span>
                          <span className="text-lg font-semibold text-gray-900">
                            {formatAmount(orderDetail?.price)}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {tOrders("columns.product")}
                        </span>
                        <p className="mt-1 text-base font-semibold text-gray-900">
                          {orderDetail?.product?.name || tOrders("common.none")}
                        </p>

                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {tOrders("columns.size")}
                        </span>
                        <p className="mt-1 text-base font-semibold text-gray-900">
                          {orderDetail?.size?.name || tOrders("common.none")}
                        </p>

                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {tOrders("columns.color")}
                        </span>
                        <p className="mt-1 text-base font-semibold text-gray-900">
                          {orderDetail?.color?.name || tOrders("common.none")}
                        </p>
                      </div>

                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        {tOrders("columns.options")}
                      </span>
                      <div className="mt-2 text-base font-semibold text-gray-900">
                        {renderOptions(orderDetail?.options)}
                      </div>

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
              {requiresProductSubCategoryRouting ? (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <Typography.Text strong>
                    {t("fields.productSubCategoryRouting")}
                  </Typography.Text>
                  <Select
                    className="mt-2 w-full"
                    value={
                      hasValidProductSubCategoryRouting
                        ? routingSubCategoryId || undefined
                        : undefined
                    }
                    onChange={(value) => setRoutingSubCategoryId(value || null)}
                    options={productSubCategoryOptions}
                    placeholder={t(
                      "fields.productSubCategoryRoutingPlaceholder",
                    )}
                    optionFilterProp="label"
                    showSearch
                    status={
                      hasValidProductSubCategoryRouting ? undefined : "error"
                    }
                  />
                  <Typography.Text type="secondary" className="mt-2 block">
                    {t("fields.productSubCategoryRoutingHelp")}
                  </Typography.Text>
                </div>
              ) : null}
              {canRouteToPrint ? (
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <Typography.Text strong>
                    {t("fields.printRouting")}
                  </Typography.Text>
                  <Select
                    allowClear
                    className="mt-2 w-full"
                    value={routingSubCategoryId || undefined}
                    onChange={(value) => setRoutingSubCategoryId(value || null)}
                    options={printSubCategoryOptions}
                    placeholder={t("fields.printRoutingPlaceholder")}
                    optionFilterProp="label"
                    showSearch
                    notFoundContent={t("fields.printRoutingEmpty")}
                  />
                  <Typography.Text type="secondary" className="mt-2 block">
                    {t("fields.printRoutingHelp")}
                  </Typography.Text>
                </div>
              ) : null}
              {positionsLoading ? (
                <Spin />
              ) : positions.length ? (
                isPersonalizedQuantityMode ? (
                  <div className="space-y-4">
                    {showSubCategorySwitch ? (
                      <div className="flex items-center justify-end gap-2">
                        <Typography.Text>
                          {subCategory?.name || "-"}
                        </Typography.Text>
                        <Switch
                          checked={isSubCategory}
                          onChange={setIsSubCategory}
                          disabled={Boolean(routingSubCategoryId)}
                        />
                      </div>
                    ) : null}
                    <Alert
                      type={
                        personalizedQuantityIncomplete ? "warning" : "success"
                      }
                      showIcon
                      message={
                        personalizedQuantityIncomplete
                          ? t("positions.quantityIncompleteSummary")
                          : t("positions.quantityCompleteSummary")
                      }
                      description={t("positions.groupQuantitySummary", {
                        assigned: personalizedTotalQuantity,
                        total: itemQuantity,
                      })}
                    />
                    {personalizedDesignEntries.map((group, index) =>
                      renderPersonalizedDesignGroup(group, index),
                    )}
                    {personalizedTotalQuantity < itemQuantity ? (
                      <Button
                        type="dashed"
                        block
                        icon={<PlusOutlined />}
                        onClick={handleAddPersonalizedDesign}
                      >
                        {t("positions.addNewGroup")}
                      </Button>
                    ) : null}
                  </div>
                ) : (
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
                            disabled={Boolean(routingSubCategoryId)}
                          />
                        </div>
                      ) : null}
                    </div>
                    {selectedPositions.length ? (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {selectedPositions.map((position) =>
                          renderPositionCard(position),
                        )}
                      </div>
                    ) : (
                      <Empty description={t("positions.noSelection")} />
                    )}
                  </>
                )
              ) : (
                <Alert
                  type="info"
                  message={t("fields.positionsEmpty")}
                  showIcon
                />
              )}
            </Card>
          </div>
        )}
      </Modal>
    </>
  );
}
