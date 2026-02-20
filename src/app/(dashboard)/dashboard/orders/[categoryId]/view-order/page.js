"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { App as AntdApp, Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import OrdersStatusListPage from "../../OrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";
import { saveBlobAsFile } from "@/utils/apiHelpers";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { useTranslations } from "@/i18n/use-translations";


export default function CategoryViewOrderPage({ params }) {
  const { categoryId } = params || {};
  const { message } = AntdApp.useApp();
  const tCommonActions = useTranslations("common.actions");
  const [downloading, setDownloading] = useState(false);
  const tableRef = useRef(null);

  const listApiFn = useMemo(
    () => async (payload) => {
      const nextFilters = {
        ...(payload?.filters || {}),
        category: categoryId,
      };
      return OrdersAPI.workerCompletedItemsList({
        ...(payload || {}),
        filters: nextFilters,
      });
    },
    [categoryId],
  );

  const handleDownload = useCallback(async () => {
    if (!categoryId) return;
    setDownloading(true);
    try {
      const { blob, filename } = await OrdersAPI.DownloadPdf({
        category_id: categoryId,
      });
      saveBlobAsFile(blob, filename || "orders.pdf");
      tableRef.current?.reload?.();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || "PDF download failed."
      );
    } finally {
      setDownloading(false);
    }
  }, [categoryId, message]);

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
      allowedStatuses={["completed","processing", "pdf"]}
      requireRoles={["companyCompletedWorker"]}
      productListFetcher={() => fetchGenericList("product")}
      affilated
      toolbarRight={toolbarRight}
    />
  );
}
