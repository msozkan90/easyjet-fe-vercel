"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  App as AntdApp,
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Popover,
  Radio,
  Select,
  Space,
  Switch,
  Upload,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  EditOutlined,
  FileSearchOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "@/i18n/use-translations";
import { fetchGenericList } from "@/utils/fetchGenericList";
import AddressEditorModal from "@/components/modals/AddressEditorModal";
import TransferProductionLabelPurchaseModal from "@/components/modals/TransferProductionLabelPurchaseModal";
import { TransferOrdersAPI } from "@/utils/api";
import { isValidOrderNumber } from "@/utils/orderNumberValidation";
import {
  MAX_TRANSFER_DESIGN_WIDTH_INCHES,
  validateTransferDesignWidth,
} from "@/utils/transferDesignValidation";
import TransferOrdersStatusListPage from "./TransferOrdersStatusListPage";
import { useTransferDesignUploadQueue } from "@/components/transfer-orders/TransferDesignUploadQueueProvider";

const toNullableString = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
};

const createDesignUploadEntry = () => ({
  id:
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  fileList: [],
  quantity: 1,
});

export default function TransferOrdersPage() {
  const { message, modal } = AntdApp.useApp();
  const t = useTranslations("dashboard.orders");
  const router = useRouter();
  const { enqueueUploads, tasks: uploadTasks } = useTransferDesignUploadQueue();
  const searchParams = useSearchParams();
  const tableRef = useRef(null);
  const [editForm] = Form.useForm();
  const [manualOrderForm] = Form.useForm();
  const [manualAddressForm] = Form.useForm();
  const [rowActionLoading, setRowActionLoading] = useState({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalLoading, setEditModalLoading] = useState(false);
  const [editModalSaving, setEditModalSaving] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingDetail, setEditingDetail] = useState(null);
  const [designUploadTarget, setDesignUploadTarget] = useState(null);
  const [designUploadModalOpen, setDesignUploadModalOpen] = useState(false);
  const [designUploadEntries, setDesignUploadEntries] = useState([
    createDesignUploadEntry(),
  ]);
  const [productionModalOpen, setProductionModalOpen] = useState(false);
  const [productionSubmitting, setProductionSubmitting] = useState(false);
  const [productionRecord, setProductionRecord] = useState(null);
  const [productionOption, setProductionOption] = useState("has_label");
  const [productionLabelFiles, setProductionLabelFiles] = useState([]);
  const [productionLabelPurchaseOpen, setProductionLabelPurchaseOpen] =
    useState(false);
  const [productionLabelPurchaseOrder, setProductionLabelPurchaseOrder] =
    useState(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualModalSubmitting, setManualModalSubmitting] = useState(false);
  const [manualAddressModalOpen, setManualAddressModalOpen] = useState(false);
  const [manualProductsLoading, setManualProductsLoading] = useState(false);
  const [manualProducts, setManualProducts] = useState([]);
  const handledSuccessUploadIdsRef = useRef(new Set());

  const setRowActionLoadingState = useCallback((rowId, action, nextState) => {
    if (!rowId || !action) return;
    const key = `${rowId}-${action}`;
    setRowActionLoading((prev) => {
      if (!nextState) {
        if (!prev?.[key]) return prev;
        const clone = { ...prev };
        delete clone[key];
        return clone;
      }
      if (prev?.[key]) return prev;
      return { ...prev, [key]: true };
    });
  }, []);

  const isRowActionLoading = useCallback(
    (rowId, action) => Boolean(rowActionLoading?.[`${rowId}-${action}`]),
    [rowActionLoading],
  );

  const setAddressFormValues = useCallback(
    (orderData = {}) => {
      editForm.setFieldsValue({
        bill_to_name: orderData?.bill_to_name || "",
        ship_to_street1: orderData?.ship_to_street1 || "",
        ship_to_street2: orderData?.ship_to_street2 || "",
        ship_to_city: orderData?.ship_to_city || "",
        ship_to_state: orderData?.ship_to_state || "",
        ship_to_postal_code: orderData?.ship_to_postal_code || "",
        ship_to_country: orderData?.ship_to_country || "",
      });
    },
    [editForm],
  );

  const handleEditModalClose = useCallback(() => {
    setEditModalOpen(false);
    setEditingRecord(null);
    setEditingDetail(null);
    setEditModalLoading(false);
    editForm.resetFields();
  }, [editForm]);

  const handleOpenAddressEditor = useCallback(
    async (record) => {
      const orderNumber = record?.order_number;
      if (!orderNumber) return;
      setEditingRecord(record);
      setEditModalOpen(true);
      setEditModalLoading(true);
      setEditingDetail(null);
      try {
        const response = await TransferOrdersAPI.detail(orderNumber);
        const detail = response?.data;
        setEditingDetail(detail);
        setAddressFormValues(detail || {});
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            t("messages.addressLoadError"),
        );
        handleEditModalClose();
      } finally {
        setEditModalLoading(false);
      }
    },
    [handleEditModalClose, message, setAddressFormValues, t],
  );

  const handleAddressSave = useCallback(async () => {
    const transferOrderId = editingDetail?.id ?? editingRecord?.transfer_order_id;
    if (!transferOrderId) {
      message.error(t("messages.addressMissingOrder"));
      return;
    }
    let values;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }
    const payload = {
      bill_to_name: toNullableString(values.bill_to_name),
      ship_to_street1: toNullableString(values.ship_to_street1),
      ship_to_street2: toNullableString(values.ship_to_street2),
      ship_to_city: toNullableString(values.ship_to_city),
      ship_to_state: toNullableString(values.ship_to_state),
      ship_to_postal_code: toNullableString(values.ship_to_postal_code),
      ship_to_country: toNullableString(values.ship_to_country),
    };
    setEditModalSaving(true);
    try {
      await TransferOrdersAPI.update(transferOrderId, payload);
      message.success(t("messages.addressUpdateSuccess"));
      handleEditModalClose();
      tableRef.current?.reload?.();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          t("messages.addressUpdateError"),
      );
    } finally {
      setEditModalSaving(false);
    }
  }, [editForm, editingDetail, editingRecord, handleEditModalClose, message, t]);

  const handleEditAddressSelect = useCallback(
    (payload) => {
      if (!payload) return;
      const updates = {};
      if (payload.street1 !== undefined) updates.ship_to_street1 = payload.street1;
      if (payload.street2 !== undefined) updates.ship_to_street2 = payload.street2;
      if (payload.city !== undefined) updates.ship_to_city = payload.city;
      if (payload.state !== undefined) updates.ship_to_state = payload.state;
      if (payload.postalCode !== undefined) updates.ship_to_postal_code = payload.postalCode;
      if (payload.country !== undefined) updates.ship_to_country = payload.country;
      if (Object.keys(updates).length) {
        editForm.setFieldsValue(updates);
      }
    },
    [editForm],
  );

  const handleStatusUpdate = useCallback(
    async (record, status) => {
      if (!record?.id || !status) return;
      const actionKey = status === "cancel" ? "cancel" : status;
      setRowActionLoadingState(record.id, actionKey, true);
      try {
        await TransferOrdersAPI.updateItem(record.id, { status });
        message.success(t("messages.statusUpdateSuccess"));
        tableRef.current?.reload?.();
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            t("messages.statusUpdateError"),
        );
      } finally {
        setRowActionLoadingState(record.id, actionKey, false);
      }
    },
    [message, setRowActionLoadingState, t],
  );

  const editingOrder = useMemo(
    () => editingDetail ?? editingRecord ?? null,
    [editingDetail, editingRecord],
  );

  const subCategoryId = useMemo(() => {
    const raw = searchParams?.get("subCategoryId");
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    return trimmed || undefined;
  }, [searchParams]);
  const withoutSubCategory = useMemo(
    () => searchParams?.get("withoutSubCategory") === "1",
    [searchParams],
  );

  const fixedFilters = useMemo(
    () => {
      if (withoutSubCategory) return { without_sub_category: true };
      return subCategoryId ? { sub_category_id: subCategoryId } : undefined;
    },
    [subCategoryId, withoutSubCategory],
  );
  const manualShipToName = Form.useWatch("ship_to_name", manualOrderForm);
  const manualShipToCompany = Form.useWatch("ship_to_company", manualOrderForm);
  const manualShipToStreet1 = Form.useWatch("ship_to_street1", manualOrderForm);
  const manualShipToStreet2 = Form.useWatch("ship_to_street2", manualOrderForm);
  const manualShipToCity = Form.useWatch("ship_to_city", manualOrderForm);
  const manualShipToState = Form.useWatch("ship_to_state", manualOrderForm);
  const manualShipToPostalCode = Form.useWatch("ship_to_postal_code", manualOrderForm);
  const manualShipToCountry = Form.useWatch("ship_to_country", manualOrderForm);
  const manualShipToPhone = Form.useWatch("ship_to_phone", manualOrderForm);

  const manualProductOptions = useMemo(
    () =>
      (Array.isArray(manualProducts) ? manualProducts : [])
        .filter((row) => row?.id)
        .map((row) => ({
          value: row.id,
          label: row?.name || row.id,
        })),
    [manualProducts],
  );

  const loadManualProducts = useCallback(async () => {
    if (!subCategoryId) {
      setManualProducts([]);
      return;
    }
    setManualProductsLoading(true);
    try {
      const list = await fetchGenericList("transfer_product", {
        filters: {
          status: "active",
          sub_category_id: subCategoryId,
        },
      });
      setManualProducts(Array.isArray(list) ? list : []);
    } catch (error) {
      setManualProducts([]);
      message.error(
        error?.response?.data?.error?.message || t("messages.loadVariationsError"),
      );
    } finally {
      setManualProductsLoading(false);
    }
  }, [message, subCategoryId, t]);

  const handleOpenDesignUpload = useCallback(
    (record) => {
      if (!subCategoryId) {
        message.error(t("messages.subCategoryRequiredForDesignUpload"));
        return;
      }
      const transferOrderId = record?.transfer_order_id;
      if (!transferOrderId) return;
      setDesignUploadTarget({
        orderId: transferOrderId,
        orderNumber: record?.order_number || "-",
      });
      setDesignUploadEntries([createDesignUploadEntry()]);
      setDesignUploadModalOpen(true);
    },
    [message, subCategoryId, t],
  );

  const handleCloseDesignUploadModal = useCallback(() => {
    setDesignUploadModalOpen(false);
    setDesignUploadTarget(null);
    setDesignUploadEntries([createDesignUploadEntry()]);
  }, []);

  const handleAddDesignUploadEntry = useCallback(() => {
    setDesignUploadEntries((prev) => [...prev, createDesignUploadEntry()]);
  }, []);

  const handleRemoveDesignUploadEntry = useCallback((entryId) => {
    setDesignUploadEntries((prev) =>
      prev.length <= 1
        ? [createDesignUploadEntry()]
        : prev.filter((entry) => entry.id !== entryId),
    );
  }, []);

  const handleDesignUploadFileChange = useCallback((entryId, fileList) => {
    setDesignUploadEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId ? { ...entry, fileList: fileList.slice(-1) } : entry,
      ),
    );
  }, []);

  const handleDesignUploadQuantityChange = useCallback((entryId, quantity) => {
    setDesignUploadEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              quantity: Math.max(1, Number.parseInt(quantity || 1, 10) || 1),
            }
          : entry,
      ),
    );
  }, []);

  const handleSubmitDesignUploads = useCallback(async () => {
    if (!designUploadTarget || !subCategoryId) {
      message.error(t("messages.subCategoryRequiredForDesignUpload"));
      return;
    }

    const uploadEntries = designUploadEntries
      .map((entry) => ({
        file: entry?.fileList?.[0]?.originFileObj || null,
        quantity: Math.max(1, Number.parseInt(entry?.quantity || 1, 10) || 1),
      }))
      .filter((entry) => entry.file instanceof File);

    if (!uploadEntries.length || uploadEntries.length !== designUploadEntries.length) {
      message.error(t("designUploadModal.validation.fileRequired"));
      return;
    }

    for (const entry of uploadEntries) {
      const validation = await validateTransferDesignWidth(entry.file);
      if (!validation.valid) {
        message.error(
          t("designUploadModal.validation.maxWidth", {
            fileName: entry.file.name || "-",
            width: validation.dimensions.widthInches.toFixed(2),
            max: MAX_TRANSFER_DESIGN_WIDTH_INCHES,
          }),
        );
        return;
      }
    }

    enqueueUploads({
      orderId: designUploadTarget.orderId,
      orderNumber: designUploadTarget.orderNumber,
      subCategoryId,
      files: uploadEntries,
    });
    message.success(t("messages.uploadQueued", { count: uploadEntries.length }));
    handleCloseDesignUploadModal();
  }, [
    designUploadEntries,
    designUploadTarget,
    enqueueUploads,
    handleCloseDesignUploadModal,
    message,
    subCategoryId,
    t,
  ]);

  useEffect(() => {
    if (!subCategoryId) return;
    let hasNewSuccess = false;
    for (const task of uploadTasks || []) {
      if (task?.status !== "success") continue;
      if (String(task?.subCategoryId || "") !== String(subCategoryId)) continue;
      if (handledSuccessUploadIdsRef.current.has(task.id)) continue;
      handledSuccessUploadIdsRef.current.add(task.id);
      hasNewSuccess = true;
    }
    if (hasNewSuccess) {
      tableRef.current?.reload?.();
    }
  }, [subCategoryId, uploadTasks]);

  const columnsBuilder = useCallback(
    (baseColumns) => [
      ...baseColumns,
      {
        title: t("columns.actions"),
        key: "actions",
        fixed: "right",
        width: 220,
        render: (_, record) => {
          const isParentRow = Boolean(record?.__hasChildren) && !record?.__isChild;
          const rowId = record?.id;
          const cancelLoading = isRowActionLoading(rowId, "cancel");
          const waitingLoading = isRowActionLoading(rowId, "waitingForDesign");
          const newOrderLoading = isRowActionLoading(rowId, "newOrder");
          const canUpdateItem = !isParentRow && Boolean(rowId);
          const disableActions =
            !canUpdateItem || cancelLoading || waitingLoading || newOrderLoading;
          const showWaitingAction = canUpdateItem && record?.status === "newOrder";
          const showNewOrderAction = canUpdateItem && record?.status === "waitingForDesign";
          const canEditRecord = Boolean(record?.transfer_order_id);
          const canUploadDesign = Boolean(
            isParentRow &&
              record?.transfer_order_id &&
              subCategoryId &&
              !withoutSubCategory,
          );
          const canSendToProduction = Boolean(isParentRow && record?.transfer_order_id);
          const orderNumber = record?.order_number;
          const canViewDetail = Boolean(orderNumber);
          const detailHref = canViewDetail
            ? `/dashboard/transfer-orders/orders/${encodeURIComponent(orderNumber)}`
            : "";

          return (
            <Space wrap>
              <Popover content={t("actions.viewDetail")}>
                <Button
                  icon={<FileSearchOutlined />}
                  type="default"
                  disabled={!canViewDetail}
                  onClick={() => {
                    if (!canViewDetail) return;
                    router.push(detailHref);
                  }}
                />
              </Popover>
              <Popover content={t("actions.editAddress")}>
                <Button
                  icon={<EditOutlined />}
                  type="default"
                  disabled={!canEditRecord}
                  onClick={() => handleOpenAddressEditor(record)}
                />
              </Popover>
              {isParentRow ? (
                <Popover content={t("actions.designUpload")}>
                  <Button
                    icon={<UploadOutlined />}
                    type="default"
                    disabled={!canUploadDesign}
                    onClick={() => handleOpenDesignUpload(record)}
                  />
                </Popover>
              ) : null}
              {isParentRow ? (
                <Popover content={t("actions.sendToProduction")}>
                  <Button
                    icon={<CheckCircleOutlined />}
                    type="primary"
                    disabled={!canSendToProduction}
                    onClick={() => {
                      if (!canSendToProduction) return;
                      setProductionRecord(record);
                      setProductionOption("has_label");
                      setProductionLabelFiles([]);
                      setProductionModalOpen(true);
                    }}
                  />
                </Popover>
              ) : null}
              <Popover content={t("actions.cancel")}>
                <Popconfirm
                  title={t("actions.confirmCancelTitle")}
                  okText={t("actions.confirmCancelOk")}
                  okButtonProps={{ danger: true, loading: cancelLoading }}
                  disabled={disableActions}
                  onConfirm={() => handleStatusUpdate(record, "cancel")}
                >
                  <Button
                    icon={<CloseOutlined />}
                    type="primary"
                    danger
                    loading={cancelLoading}
                    disabled={disableActions}
                  />
                </Popconfirm>
              </Popover>
              {showWaitingAction ? (
                <Popover content={t("actions.waitingForDesign")}>
                  <Popconfirm
                    title={t("actions.confirmWaitingTitle")}
                    okText={t("actions.confirmWaitingOk")}
                    okButtonProps={{ type: "primary", loading: waitingLoading }}
                    disabled={disableActions}
                    onConfirm={() =>
                      handleStatusUpdate(record, "waitingForDesign")
                    }
                  >
                    <Button
                      icon={<ClockCircleOutlined />}
                      type="primary"
                      color="orange"
                      variant="solid"
                      loading={waitingLoading}
                      disabled={disableActions}
                    />
                  </Popconfirm>
                </Popover>
              ) : null}
              {showNewOrderAction ? (
                <Popover content={t("actions.newOrder")}>
                  <Popconfirm
                    title={t("actions.confirmNewOrderTitle")}
                    okText={t("actions.confirmNewOrderOk")}
                    okButtonProps={{ type: "primary", loading: newOrderLoading }}
                    disabled={disableActions}
                    onConfirm={() => handleStatusUpdate(record, "newOrder")}
                  >
                    <Button
                      icon={<PlusOutlined />}
                      type="primary"
                      loading={newOrderLoading}
                      disabled={disableActions}
                    />
                  </Popconfirm>
                </Popover>
              ) : null}
            </Space>
          );
        },
      },
    ],
    [
      handleOpenDesignUpload,
      handleOpenAddressEditor,
      handleStatusUpdate,
      isRowActionLoading,
      router,
      subCategoryId,
      withoutSubCategory,
      t,
    ],
  );

  const handleProductionModalClose = useCallback(() => {
    setProductionModalOpen(false);
    setProductionSubmitting(false);
    setProductionRecord(null);
    setProductionOption("has_label");
    setProductionLabelFiles([]);
  }, []);

  const handleProductionLabelPurchaseClose = useCallback(() => {
    setProductionLabelPurchaseOpen(false);
    setProductionLabelPurchaseOrder(null);
  }, []);

  const handleOpenManualModal = useCallback(async () => {
    if (!subCategoryId) {
      message.error(t("messages.subCategoryRequiredForManualOrder"));
      return;
    }
    setManualModalOpen(true);
    manualOrderForm.setFieldsValue({
      order_number: "",
      order_date: dayjs(),
      local_pickup: false,
      ship_to_name: "",
      ship_to_company: "",
      ship_to_street1: "",
      ship_to_street2: "",
      ship_to_city: "",
      ship_to_state: "",
      ship_to_postal_code: "",
      ship_to_country: "",
      ship_to_phone: "",
      notes: "",
      items: [{ name: "", transfer_product_id: undefined }],
    });
    await loadManualProducts();
  }, [loadManualProducts, manualOrderForm, message, subCategoryId, t]);

  const handleOpenManualAddressModal = useCallback(() => {
    const values = manualOrderForm.getFieldsValue([
      "ship_to_name",
      "ship_to_company",
      "ship_to_street1",
      "ship_to_street2",
      "ship_to_city",
      "ship_to_state",
      "ship_to_postal_code",
      "ship_to_country",
      "ship_to_phone",
    ]);
    manualAddressForm.setFieldsValue({
      ship_to_name: values?.ship_to_name || "",
      ship_to_company: values?.ship_to_company || "",
      ship_to_street1: values?.ship_to_street1 || "",
      ship_to_street2: values?.ship_to_street2 || "",
      ship_to_city: values?.ship_to_city || "",
      ship_to_state: values?.ship_to_state || "",
      ship_to_postal_code: values?.ship_to_postal_code || "",
      ship_to_country: values?.ship_to_country || "",
      ship_to_phone: values?.ship_to_phone || "",
    });
    setManualAddressModalOpen(true);
  }, [manualAddressForm, manualOrderForm]);

  const handleCloseManualAddressModal = useCallback(() => {
    setManualAddressModalOpen(false);
  }, []);

  const handleManualAddressSelect = useCallback(
    (payload) => {
      if (!payload) return;
      const updates = {};
      if (payload.street1 !== undefined) updates.ship_to_street1 = payload.street1;
      if (payload.street2 !== undefined) updates.ship_to_street2 = payload.street2;
      if (payload.city !== undefined) updates.ship_to_city = payload.city;
      if (payload.state !== undefined) updates.ship_to_state = payload.state;
      if (payload.postalCode !== undefined) updates.ship_to_postal_code = payload.postalCode;
      if (payload.country !== undefined) updates.ship_to_country = payload.country;
      if (Object.keys(updates).length) {
        manualAddressForm.setFieldsValue(updates);
      }
    },
    [manualAddressForm],
  );

  const handleSaveManualAddress = useCallback(async () => {
    let values;
    try {
      values = await manualAddressForm.validateFields();
    } catch {
      return;
    }
    manualOrderForm.setFieldsValue({
      ship_to_name: values?.ship_to_name || "",
      ship_to_company: values?.ship_to_company || "",
      ship_to_street1: values?.ship_to_street1 || "",
      ship_to_street2: values?.ship_to_street2 || "",
      ship_to_city: values?.ship_to_city || "",
      ship_to_state: values?.ship_to_state || "",
      ship_to_postal_code: values?.ship_to_postal_code || "",
      ship_to_country: values?.ship_to_country || "",
      ship_to_phone: values?.ship_to_phone || "",
    });
    setManualAddressModalOpen(false);
  }, [manualAddressForm, manualOrderForm]);

  const handleCloseManualModal = useCallback(() => {
    setManualModalOpen(false);
    setManualModalSubmitting(false);
    setManualAddressModalOpen(false);
    manualOrderForm.resetFields();
    manualAddressForm.resetFields();
  }, [manualAddressForm, manualOrderForm]);

  const handleCreateManualOrder = useCallback(async () => {
    if (!subCategoryId) {
      message.error(t("messages.subCategoryRequiredForManualOrder"));
      return;
    }
    let values;
    try {
      values = await manualOrderForm.validateFields();
    } catch {
      return;
    }

    const toNullableField = (value) => {
      if (value === undefined || value === null) return null;
      const text = String(value).trim();
      return text.length ? text : null;
    };

    const normalizedItems = (Array.isArray(values?.items) ? values.items : [])
      .map((item) => ({
        name: toNullableField(item?.name),
        transfer_product_id: toNullableField(item?.transfer_product_id),
      }))
      .filter((item) => item.name && item.transfer_product_id);

    if (!normalizedItems.length) {
      message.error(t("manualOrderModal.validation.itemsRequired"));
      return;
    }

    const payload = {
      order_number: String(values.order_number || "").trim(),
      order_date: values.order_date?.toISOString?.() || new Date().toISOString(),
      ship_to_name: toNullableField(values.ship_to_name),
      ship_to_company: toNullableField(values.ship_to_company),
      local_pickup: Boolean(values.local_pickup),
      ship_to_street1: toNullableField(values.ship_to_street1),
      ship_to_street2: toNullableField(values.ship_to_street2),
      ship_to_city: toNullableField(values.ship_to_city),
      ship_to_state: toNullableField(values.ship_to_state),
      ship_to_postal_code: toNullableField(values.ship_to_postal_code),
      ship_to_country: toNullableField(values.ship_to_country),
      ship_to_phone: toNullableField(values.ship_to_phone),
      notes: toNullableField(values.notes),
      items: normalizedItems,
    };
    if (!isValidOrderNumber(payload.order_number)) {
      message.error(t("manualOrderModal.validation.orderNumberWhitespace"));
      return;
    }

    setManualModalSubmitting(true);
    try {
      await TransferOrdersAPI.createManual(payload);
      message.success(t("manualOrderModal.messages.success"));
      handleCloseManualModal();
      tableRef.current?.reload?.();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("manualOrderModal.messages.error"),
      );
    } finally {
      setManualModalSubmitting(false);
    }
  }, [handleCloseManualModal, manualOrderForm, message, subCategoryId, t]);

  const handleSendToProduction = useCallback(async () => {
    const transferOrderId = productionRecord?.transfer_order_id;
    if (!transferOrderId) return;

    if (productionOption === "label_purchase") {
      setProductionSubmitting(true);
      try {
        await TransferOrdersAPI.validateProduction({
          transfer_order_id: transferOrderId,
          label_purchase_option: productionOption,
        });
        const detailResponse = await TransferOrdersAPI.detail(
          productionRecord?.order_number,
        );
        setProductionLabelPurchaseOrder(detailResponse?.data || null);
        setProductionModalOpen(false);
        setProductionLabelPurchaseOpen(true);
      } catch (error) {
        message.error(
          error?.response?.data?.error?.message ||
            t("productionModal.messages.error"),
        );
      } finally {
        setProductionSubmitting(false);
      }
      return;
    }

    if (productionOption === "has_label" && productionLabelFiles.length === 0) {
      message.error(t("productionModal.validation.labelImageRequired"));
      return;
    }

    const payload = new FormData();
    payload.append("transfer_order_id", String(transferOrderId));
    payload.append("label_purchase_option", productionOption);
    if (productionOption === "has_label" && productionLabelFiles[0]?.originFileObj) {
      payload.append("label_image", productionLabelFiles[0].originFileObj);
    }

    setProductionSubmitting(true);
    try {
      await TransferOrdersAPI.sendToProduction(payload);
      message.success(t("productionModal.messages.success"));
      handleProductionModalClose();
      tableRef.current?.reload?.();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          t("productionModal.messages.error"),
      );
    } finally {
      setProductionSubmitting(false);
    }
  }, [
    handleProductionModalClose,
    message,
    productionLabelFiles,
    productionOption,
    productionRecord,
    t,
  ]);

  const handleProductionLabelCreated = useCallback(() => {
    message.success(t("productionModal.messages.success"));
    handleProductionLabelPurchaseClose();
    handleProductionModalClose();
    tableRef.current?.reload?.();
  }, [
    handleProductionLabelPurchaseClose,
    handleProductionModalClose,
    message,
    t,
  ]);

  const handleConfirmSendToProduction = useCallback(() => {
    modal.confirm({
      title: t("shippingRates.actions.confirmSendTitle"),
      content: t("shippingRates.actions.confirmSendDescription"),
      okText: t("shippingRates.actions.confirmSendOk"),
      cancelText: "Cancel",
      onOk: handleSendToProduction,
    });
  }, [handleSendToProduction, modal, t]);

  return (
    <>
      <TransferOrdersStatusListPage
        key={
          withoutSubCategory
            ? "transfer-orders-without-subcategory"
            : subCategoryId
              ? `transfer-orders-sub-${subCategoryId}`
              : "transfer-orders-all"
        }
        listApiFn={TransferOrdersAPI.pendingItemsList}
        allowedStatuses={["newOrder", "waitingForDesign"]}
        initialFilters={{ status: ["newOrder", "waitingForDesign"] }}
        fixedFilters={fixedFilters}
        showOptionsInsteadOfSku
        columnsBuilder={columnsBuilder}
        tableRefExternal={tableRef}
        toolbarRight={
          subCategoryId && !withoutSubCategory ? (
            <Button type="primary" onClick={handleOpenManualModal}>
              {t("actions.manualOrder")}
            </Button>
          ) : null
        }
      />
      <AddressEditorModal
        open={editModalOpen}
        loading={editModalLoading}
        saving={editModalSaving}
        onCancel={handleEditModalClose}
        onSave={handleAddressSave}
        editForm={editForm}
        editingOrder={editingOrder}
        onAddressSelect={handleEditAddressSelect}
        orderDateLabel={
          editingOrder?.order_date
            ? new Date(editingOrder.order_date).toLocaleString()
            : "-"
        }
        zIndex={1500}
      />
      <AddressEditorModal
        open={manualAddressModalOpen}
        loading={false}
        saving={false}
        onCancel={handleCloseManualAddressModal}
        onSave={handleSaveManualAddress}
        editForm={manualAddressForm}
        editingOrder={{
          order_number: manualOrderForm.getFieldValue("order_number") || "-",
          order_date: manualOrderForm.getFieldValue("order_date")
            ? dayjs(manualOrderForm.getFieldValue("order_date")).format("YYYY-MM-DD HH:mm:ss")
            : "-",
          bill_to_name: "-",
        }}
        onAddressSelect={handleManualAddressSelect}
        showBillToName={false}
        showRecipientFields
        zIndex={1600}
      />
      <Modal
        open={designUploadModalOpen}
        title={t("designUploadModal.title")}
        onCancel={handleCloseDesignUploadModal}
        onOk={handleSubmitDesignUploads}
        okText={t("designUploadModal.actions.queue")}
        cancelText={t("designUploadModal.actions.cancel")}
        destroyOnHidden
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Descriptions
            size="small"
            bordered
            column={1}
            items={[
              {
                key: "orderNumber",
                label: t("designUploadModal.fields.orderNumber"),
                children: designUploadTarget?.orderNumber || "-",
              },
            ]}
          />
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {designUploadEntries.map((entry, index) => (
              <div
                key={entry.id}
                style={{
                  border: "1px solid #f0f0f0",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <Space
                  direction="vertical"
                  size={12}
                  style={{ width: "100%" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <strong>
                      {t("designUploadModal.fields.design")} #{index + 1}
                    </strong>
                    <Button
                      danger
                      size="small"
                      onClick={() => handleRemoveDesignUploadEntry(entry.id)}
                    >
                      {t("designUploadModal.actions.remove")}
                    </Button>
                  </div>
                  <Upload
                    accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff,.tif"
                    beforeUpload={() => false}
                    maxCount={1}
                    fileList={entry.fileList}
                    onChange={({ fileList }) =>
                      handleDesignUploadFileChange(entry.id, fileList)
                    }
                  >
                    <Button icon={<UploadOutlined />}>
                      {t("designUploadModal.actions.selectFile")}
                    </Button>
                  </Upload>
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      {t("designUploadModal.fields.quantity")}
                    </div>
                    <InputNumber
                      min={1}
                      precision={0}
                      value={entry.quantity}
                      onChange={(value) =>
                        handleDesignUploadQuantityChange(entry.id, value)
                      }
                      style={{ width: "100%" }}
                    />
                  </div>
                </Space>
              </div>
            ))}
          </Space>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddDesignUploadEntry}
            block
          >
            {t("designUploadModal.actions.add")}
          </Button>
        </Space>
      </Modal>
      <Modal
        open={productionModalOpen}
        onCancel={handleProductionModalClose}
        title={t("productionModal.title")}
        onOk={handleConfirmSendToProduction}
        okText={t("productionModal.actions.send")}
        confirmLoading={productionSubmitting}
        destroyOnHidden
      >
        <Descriptions
          size="small"
          bordered
          column={1}
          items={[
            {
              key: "order_number",
              label: t("productionModal.summary.orderNumber"),
              children: productionRecord?.order_number || "-",
            },
            {
              key: "customer_name",
              label: t("productionModal.summary.customerName"),
              children: productionRecord?.bill_to_name || "-",
            },
            {
              key: "item_count",
              label: t("productionModal.summary.itemCount"),
              children:
                productionRecord?.item_count ??
                productionRecord?.children?.length ??
                "-",
            },
          ]}
        />

        <div className="mt-4">
          <div className="mb-2 font-medium">
            {t("productionModal.fields.labelPurchaseOption")}
          </div>
          <Radio.Group
            value={productionOption}
            onChange={(event) => {
              const next = event?.target?.value;
              setProductionOption(next);
              if (next !== "has_label") {
                setProductionLabelFiles([]);
              }
            }}
          >
            <Space direction="vertical">
              <Radio value="has_label">
                {t("productionModal.options.hasLabel")}
              </Radio>
              <Radio value="no_label">
                {t("productionModal.options.noLabel")}
              </Radio>
              <Radio value="label_purchase">
                {t("productionModal.options.labelPurchase")}
              </Radio>
              <Radio value="local_pickup">
                {t("productionModal.options.localPickup")}
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        {productionOption === "has_label" ? (
          <div className="mt-4">
            <div className="mb-2 font-medium">
              {t("productionModal.fields.labelImage")}
            </div>
            <Upload
              accept="image/*"
              maxCount={1}
              fileList={productionLabelFiles}
              beforeUpload={() => false}
              onChange={({ fileList }) => setProductionLabelFiles(fileList)}
            >
              <Button icon={<UploadOutlined />}>
                {t("productionModal.actions.uploadLabel")}
              </Button>
            </Upload>
          </div>
        ) : null}
      </Modal>
      <TransferProductionLabelPurchaseModal
        open={productionLabelPurchaseOpen}
        transferOrder={productionLabelPurchaseOrder}
        onClose={handleProductionLabelPurchaseClose}
        onLabelCreated={handleProductionLabelCreated}
      />
      <Modal
        open={manualModalOpen}
        onCancel={handleCloseManualModal}
        onOk={handleCreateManualOrder}
        okText={t("manualOrderModal.actions.create")}
        title={t("manualOrderModal.title")}
        confirmLoading={manualModalSubmitting}
        destroyOnHidden
        width={900}
      >
        <Form form={manualOrderForm} layout="vertical">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Form.Item
              name="order_number"
              label={t("manualOrderModal.fields.orderNumber")}
              rules={[
                { required: true, message: t("manualOrderModal.validation.orderNumberRequired") },
                {
                  validator: (_, value) =>
                    !value || isValidOrderNumber(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error(t("manualOrderModal.validation.orderNumberWhitespace"))),
                },
              ]}
            >
              <Input placeholder={t("manualOrderModal.placeholders.orderNumber")} />
            </Form.Item>
            <Form.Item
              name="order_date"
              label={t("manualOrderModal.fields.orderDate")}
              rules={[{ required: true, message: t("manualOrderModal.validation.orderDateRequired") }]}
            >
              <DatePicker
                showTime
                style={{ width: "100%" }}
                format="YYYY-MM-DD HH:mm:ss"
              />
            </Form.Item>
            <Form.Item
              name="local_pickup"
              label={t("manualOrderModal.fields.localPickup")}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </div>
          <div className="mb-3 rounded border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium">{t("manualOrderModal.fields.address")}</div>
              <Button onClick={handleOpenManualAddressModal}>
                {t("actions.editAddress")}
              </Button>
            </div>
            <div className="text-sm text-slate-600">
              {manualShipToName || "-"}{" "}
              {manualShipToCompany
                ? `(${manualShipToCompany})`
                : ""}
            </div>
            <div className="text-sm text-slate-600">
              {[
                manualShipToStreet1,
                manualShipToStreet2,
                manualShipToCity,
                manualShipToState,
                manualShipToPostalCode,
                manualShipToCountry,
              ]
                .filter(Boolean)
                .join(", ") || "-"}
            </div>
            <div className="text-sm text-slate-600">
              {manualShipToPhone || "-"}
            </div>
          </div>
          <Form.Item name="ship_to_name" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="ship_to_company" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="ship_to_street1" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="ship_to_street2" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="ship_to_city" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="ship_to_state" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="ship_to_postal_code" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="ship_to_country" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="ship_to_phone" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="notes" label={t("manualOrderModal.fields.notes")}>
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{t("manualOrderModal.fields.items")}</div>
                  <Button onClick={() => add({ name: "", transfer_product_id: undefined })}>
                    {t("manualOrderModal.actions.addItem")}
                  </Button>
                </div>
                {fields.map((field) => (
                  <div key={field.key} className="grid grid-cols-1 gap-3 rounded border border-slate-200 p-3 md:grid-cols-[1fr_1fr_auto]">
                    <Form.Item
                      {...field}
                      name={[field.name, "name"]}
                      label={t("manualOrderModal.fields.itemName")}
                      rules={[{ required: true, message: t("manualOrderModal.validation.itemNameRequired") }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, "transfer_product_id"]}
                      label={t("manualOrderModal.fields.transferProduct")}
                      rules={[{ required: true, message: t("manualOrderModal.validation.transferProductRequired") }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        showSearch
                        allowClear
                        loading={manualProductsLoading}
                        options={manualProductOptions}
                        placeholder={t("manualOrderModal.placeholders.transferProduct")}
                        optionFilterProp="label"
                      />
                    </Form.Item>
                    <div className="flex items-end">
                      <Button danger onClick={() => remove(field.name)}>
                        {t("manualOrderModal.actions.removeItem")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>
    </>
  );
}
