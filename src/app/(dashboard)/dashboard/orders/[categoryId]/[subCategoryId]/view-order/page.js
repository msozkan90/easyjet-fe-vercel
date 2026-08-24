"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Button, Space, Tooltip } from "antd";
import {
  DownloadOutlined,
  FileSearchOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import OrdersStatusListPage from "../../../OrdersStatusListPage";
import { OrdersAPI } from "@/utils/api";
import { getBlobErrorMessage } from "@/utils/apiHelpers";
import { fetchGenericList } from "@/utils/fetchGenericList";
import { useTranslations } from "@/i18n/use-translations";
import { useDownloadQueue } from "@/components/downloads/DownloadQueueProvider";
import DesignFlawModal from "@/components/orders/design-flaws/DesignFlawModal";

const fetchProducts = () => fetchGenericList("product");

export default function SubCategoryViewOrderPage({ params }) {
  const { categoryId, subCategoryId } = params || {};
  const tCommonActions = useTranslations("common.actions");
  const tPdfMessages = useTranslations("dashboard.orders.ordersPdf.messages");
  const { enqueueDownload, isDownloading } = useDownloadQueue();
  const tableRef = useRef(null);
  const [designFlawItem, setDesignFlawItem] = useState(null);
  const tDesignFlaws = useTranslations("dashboard.orders.designFlaws");

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

  const downloadKey = `orders-pdf:create:${categoryId}:${subCategoryId}`;
  const handleDownload = useCallback(() => {
    if (!categoryId) return;
    const payload = {
      category_id: categoryId,
      ...(subCategoryId ? { sub_category_id: subCategoryId } : {}),
    };
    enqueueDownload({
      key: downloadKey,
      title: tCommonActions("downloadPdf"),
      fallbackFilename: "orders.pdf",
      request: (config) => OrdersAPI.DownloadPdf(payload, config),
      onSuccess: () => tableRef.current?.reload?.(),
      getErrorMessage: async (error) => {
        const errorMessage = await getBlobErrorMessage(error);
        return errorMessage === "No eligible order items found for PDF download"
          ? tPdfMessages("noEligibleOrderItems")
          : errorMessage || tPdfMessages("pdfDownloadFailed");
      },
    });
  }, [
    categoryId,
    downloadKey,
    enqueueDownload,
    subCategoryId,
    tCommonActions,
    tPdfMessages,
  ]);

  const toolbarRight = (
    <Button
      icon={<DownloadOutlined />}
      onClick={handleDownload}
      loading={isDownloading(downloadKey)}
    >
      {tCommonActions("downloadPdf")}
    </Button>
  );

  const columnsBuilder = useCallback(
    (columns) => [
      ...columns,
      {
        title: tDesignFlaws("fields.actions"),
        key: "actions",
        fixed: "right",
        width: 120,
        render: (_, record) => {
          const orderNumber =
            record?.order?.order_number || record?.order_number;
          return (
            <Space>
              {orderNumber ? (
                <Tooltip title={tDesignFlaws("actions.detail")}>
                  <Button
                    icon={<FileSearchOutlined />}
                    href={`/dashboard/order/detail/${orderNumber}`}
                  />
                </Tooltip>
              ) : null}
              {["pdf", "completed"].includes(record?.status) ? (
                <Tooltip title={tDesignFlaws("actions.mark")}>
                  <Button
                    danger
                    icon={<WarningOutlined />}
                    onClick={() => setDesignFlawItem(record)}
                  />
                </Tooltip>
              ) : null}
            </Space>
          );
        },
      },
    ],
    [tDesignFlaws],
  );

  return (
    <>
      <OrdersStatusListPage
        listApiFn={listApiFn}
        tableRefExternal={tableRef}
        allowedStatuses={["processing", "pdf", "completed"]}
        defaultSort={[
          { field: "status", direction: "asc" },
          { field: "order_date", direction: "asc" },
        ]}
        requireRoles={["companyCompletedWorker"]}
        productListFetcher={fetchProducts}
        affilated
        toolbarRight={toolbarRight}
        columnsBuilder={columnsBuilder}
      />
      <DesignFlawModal
        open={Boolean(designFlawItem)}
        orderItem={designFlawItem}
        onCancel={() => setDesignFlawItem(null)}
        onSaved={() => {
          setDesignFlawItem(null);
          tableRef.current?.reload?.();
        }}
      />
    </>
  );
}
