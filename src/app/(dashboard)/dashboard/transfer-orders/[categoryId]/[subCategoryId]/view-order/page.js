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

export default function TransferSubCategoryViewOrderPage({ params }) {
  const { message } = AntdApp.useApp();
  const tOrders = useTranslations("dashboard.orders");
  const { categoryId, subCategoryId } = params || {};
  const tableRef = useRef(null);

  const listApiFn = useMemo(
    () => async (payload) => {
      const nextFilters = {
        ...(payload?.filters || {}),
        category: categoryId,
        sub_category: subCategoryId,
      };
      return TransferOrdersAPI.workerCompletedItemsList({
        ...(payload || {}),
        filters: nextFilters,
      });
    },
    [categoryId, subCategoryId],
  );

  const handleDownloadDesigns = useCallback(
    (record) => {
      const transferOrderId = String(record?.transfer_order_id || "").trim();
      if (!transferOrderId || !categoryId || !subCategoryId) return;

      const downloadUrl = TransferOrdersAPI.workerCompletedDownloadUrl({
        transfer_order_id: transferOrderId,
        category_id: categoryId,
        sub_category_id: subCategoryId,
      });

      message.info(tOrders("messages.designDownloadStarted"));
      openDownloadInNewTab(downloadUrl);

      AUTO_REFRESH_DELAYS.forEach((delayMs) => {
        window.setTimeout(() => {
          tableRef.current?.reload?.();
        }, delayMs);
      });
    },
    [categoryId, message, subCategoryId, tOrders],
  );

  const rowActionsRenderer = useCallback(
    ({ record, isParentRow }) => {
      if (!isParentRow) return null;
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
    [handleDownloadDesigns, tOrders],
  );

  return (
    <TransferOrdersStatusListPage
      listApiFn={listApiFn}
      allowedStatuses={["processing", "downloaded", "printed"]}
      requireRoles={["companyAdmin", "companyCompletedWorker"]}
      tableRefExternal={tableRef}
      rowActionsRenderer={rowActionsRenderer}
    />
  );
}
