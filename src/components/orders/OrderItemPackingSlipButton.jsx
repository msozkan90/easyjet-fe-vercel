"use client";

import { Button, Tooltip } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useDownloadQueue } from "@/components/downloads/DownloadQueueProvider";
import { useTranslations } from "@/i18n/use-translations";
import { OrdersAPI } from "@/utils/api";
import { getBlobErrorMessage } from "@/utils/apiHelpers";

export default function OrderItemPackingSlipButton({
  orderItem,
  categoryId,
  subCategoryId,
}) {
  const { enqueueDownload, isDownloading } = useDownloadQueue();
  const tActions = useTranslations("common.actions");
  const tMessages = useTranslations("dashboard.orders.ordersPdf.messages");

  if (orderItem?.status !== "pdf" || !orderItem?.id || !categoryId) return null;
  // One button per order group: the backend returns all of the group's
  // pdf-status items in this category scope as one PDF.
  if (
    orderItem.__pdfGroupAnchorId &&
    orderItem.__pdfGroupAnchorId !== orderItem.id
  ) {
    return null;
  }

  const downloadKey = `orders-pdf:packing-slip:${orderItem.id}`;
  const title = tActions("downloadPackingSlips");
  const handleDownload = () => {
    enqueueDownload({
      key: downloadKey,
      title,
      fallbackFilename: "packing-slip.pdf",
      request: (config) =>
        OrdersAPI.DownloadPdf(
          {
            category_id: categoryId,
            ...(subCategoryId ? { sub_category_id: subCategoryId } : {}),
            order_item_id: orderItem.id,
          },
          config,
        ),
      getErrorMessage: async (error) => {
        const errorMessage = await getBlobErrorMessage(error);
        return errorMessage === "No eligible order items found for PDF download"
          ? tMessages("noEligibleOrderItems")
          : errorMessage || tMessages("pdfDownloadFailed");
      },
    });
  };

  return (
    <Tooltip title={title}>
      <Button
        aria-label={title}
        icon={<DownloadOutlined />}
        loading={isDownloading(downloadKey)}
        onClick={handleDownload}
      />
    </Tooltip>
  );
}
