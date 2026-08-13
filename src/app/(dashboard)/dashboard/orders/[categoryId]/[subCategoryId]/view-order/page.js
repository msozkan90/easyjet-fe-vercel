"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { App as AntdApp, Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import OrdersStatusListPage from "../../../OrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";
import { getBlobErrorMessage, saveBlobAsFile } from "@/utils/apiHelpers";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { useTranslations } from "@/i18n/use-translations";

export default function SubCategoryViewOrderPage({ params }) {
  const { categoryId, subCategoryId } = params || {};
  const { message } = AntdApp.useApp();
  const tCommonActions = useTranslations("common.actions");
  const tPdfMessages = useTranslations("dashboard.orders.ordersPdf.messages");
  const [downloading, setDownloading] = useState(false);
  const tableRef = useRef(null);

  const listApiFn = useMemo(
    () => async (payload) => {
      const nextFilters = {
        ...(payload?.filters || {}),
        category: categoryId,
        sub_category: subCategoryId,
      };
      return OrdersAPI.workerCompletedItemsList({
        ...(payload || {}),
        filters: nextFilters,
      });
    },
    [categoryId, subCategoryId],
  );

  const handleDownload = useCallback(async () => {
    if (!categoryId) return;
    setDownloading(true);
    try {
      const payload = {
        category_id: categoryId,
        ...(subCategoryId ? { sub_category_id: subCategoryId } : {}),
      };
      const { blob, filename } = await OrdersAPI.DownloadPdf(payload);
      saveBlobAsFile(blob, filename || "orders.pdf");
      tableRef.current?.reload?.();
    } catch (error) {
      const errorMessage = await getBlobErrorMessage(error);
      message.error(
        errorMessage === "No eligible order items found for PDF download"
          ? tPdfMessages("noEligibleOrderItems")
          : errorMessage || tPdfMessages("pdfDownloadFailed"),
      );
    } finally {
      setDownloading(false);
    }
  }, [categoryId, message, subCategoryId, tPdfMessages]);

  const toolbarRight = (
    <Button
      icon={<DownloadOutlined />}
      onClick={handleDownload}
      loading={downloading}
    >
      {tCommonActions("downloadPdf")}
    </Button>
  );

  return (
    <OrdersStatusListPage
      listApiFn={listApiFn}
      tableRefExternal={tableRef}
      allowedStatuses={["processing", "pdf", "completed"]}
      defaultSort={[
        { field: "status", direction: "asc" },
        { field: "order_date", direction: "asc" },
      ]}
      requireRoles={["companyCompletedWorker"]}
      productListFetcher={() => fetchGenericList("product")}
      affilated
      toolbarRight={toolbarRight}
    />
  );
}
