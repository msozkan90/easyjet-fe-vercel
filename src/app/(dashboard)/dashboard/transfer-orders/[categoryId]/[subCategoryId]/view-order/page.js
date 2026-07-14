"use client";

import { useCallback, useMemo, useRef } from "react";
import { App as AntdApp, Button, Tooltip } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import TransferOrdersStatusListPage from "../../../../transfer-orders/orders/TransferOrdersStatusListPage";
import { TransferOrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const AUTO_REFRESH_DELAYS = [1_000, 5_000];

const openDownloadInNewTab = (url) => {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
};

const WORKER_COMPLETED_COLUMN_ORDER = [
  "barcode_url",
  "id",
  "order_number",
  "name",
  "width",
  "height",
  "quantity",
  "price",
  "status",
  "bill_to_name",
  "entity_name",
  "delivery_method",
  "local_pickup",
  "notes",
  "designer_notes",
  "order_date",
  "actions",
];

export default function TransferSubCategoryViewOrderPage({ params }) {
  const { message } = AntdApp.useApp();
  const tOrders = useTranslations("dashboard.orders");
  const { categoryId, subCategoryId } = params || {};
  const isOthers = String(subCategoryId || "").toLowerCase() === "others";
  const tableRef = useRef(null);

  const listApiFn = useMemo(
    () => async (payload) => {
      const nextFilters = {
        ...(payload?.filters || {}),
        category: categoryId,
        ...(isOthers
          ? { without_design: true }
          : { sub_category: subCategoryId }),
      };
      return TransferOrdersAPI.workerCompletedItemsList({
        ...(payload || {}),
        filters: nextFilters,
      });
    },
    [categoryId, isOthers, subCategoryId],
  );

  const handleDownloadDesigns = useCallback(
    (record) => {
      if (isOthers) return;
      const transferOrderId = String(record?.transfer_order_id || "").trim();
      if (!transferOrderId || !categoryId || !subCategoryId) return;

      const downloadUrl = TransferOrdersAPI.workerCompletedDownloadUrl({
        transfer_order_id: transferOrderId,
        category_id: categoryId,
        sub_category_id: subCategoryId,
        design_id: record?.design_id,
      });

      message.info(tOrders("messages.designDownloadStarted"));
      openDownloadInNewTab(downloadUrl);

      AUTO_REFRESH_DELAYS.forEach((delayMs) => {
        window.setTimeout(() => {
          tableRef.current?.reload?.();
        }, delayMs);
      });
    },
    [categoryId, isOthers, message, subCategoryId, tOrders],
  );

  const rowActionsRenderer = useCallback(
    ({ record, isParentRow }) => {
      if (isOthers) return null;
      if (!isParentRow && !record?.design_id) return null;
      if (record?.status !== "processing") return null;
      const transferOrderId = String(record?.transfer_order_id || "").trim();
      if (!transferOrderId) return null;

      return (
        <Tooltip title={tOrders("actions.downloadDesigns")}>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadDesigns(record)}
          />
        </Tooltip>
      );
    },
    [handleDownloadDesigns, isOthers, tOrders],
  );

  const columnsBuilder = useCallback((baseColumns = []) => {
    const columnByKey = new Map(
      baseColumns.map((column) => {
        const key = column.dataIndex || column.key;
        if (key === "name") {
          return [key, { ...column, title: tOrders("columns.name") }];
        }
        return [key, column];
      }),
    );
    return WORKER_COMPLETED_COLUMN_ORDER
      .map((key) => columnByKey.get(key))
      .filter(Boolean);
  }, [tOrders]);

  return (
    <TransferOrdersStatusListPage
      listApiFn={listApiFn}
      allowedStatuses={["processing", "downloaded", "printed"]}
      requireRoles={["companyAdmin", "companyCompletedWorker"]}
      tableRefExternal={tableRef}
      rowActionsRenderer={rowActionsRenderer}
      columnsBuilder={columnsBuilder}
      showTransferOrderIdCopy
      showOwnerEntityToolbarSearch
    />
  );
}
