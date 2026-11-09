"use client";

import { useCallback, useState } from "react";
import { App as AntdApp } from "antd";
import { OrdersAPI } from "@/utils/api";
import { getBlobErrorMessage } from "@/utils/apiHelpers";
import { useTranslations } from "@/i18n/use-translations";
import { useDownloadQueue } from "@/components/downloads/DownloadQueueProvider";

/** Rexven etiket hatası: işlemler geri alındı, easyjet indirmesi de başlatılmaz. */
export const getRexvenLabelErrorReason = (error) => {
  const apiError = error?.response?.data?.error;
  if (apiError?.code !== "REXVEN_LABEL_REQUEST_FAILED") return null;
  return apiError?.details?.rexven_message || apiError?.message || "";
};

/**
 * "Download PDF": önce kapsamdaki Rexven order'ları için Rexven'e etiket isteği atılır
 * (statüleri "pdf" olur, PDF/design Rexven'den gelir), ardından kalan easyjet order'ları
 * için normal PDF indirme akışı çalışır.
 */
export function useRexvenAwarePdfDownload({ downloadKey, payload, onDone }) {
  const { message, modal } = AntdApp.useApp();
  const tCommonActions = useTranslations("common.actions");
  const tPdfMessages = useTranslations("dashboard.orders.ordersPdf.messages");
  const t = useTranslations("dashboard.orders.rexvenLabels.messages");
  const { enqueueDownload, isDownloading } = useDownloadQueue();
  const [requestingRexven, setRequestingRexven] = useState(false);

  const enqueueEasyjetDownload = useCallback(() => {
    enqueueDownload({
      key: downloadKey,
      title: tCommonActions("downloadPdf"),
      fallbackFilename: "orders.pdf",
      request: (config) => OrdersAPI.DownloadPdf(payload, config),
      onSuccess: () => onDone?.(),
      getErrorMessage: async (error) => {
        const errorMessage = await getBlobErrorMessage(error);
        return errorMessage === "No eligible order items found for PDF download"
          ? tPdfMessages("noEligibleOrderItems")
          : errorMessage || tPdfMessages("pdfDownloadFailed");
      },
    });
  }, [downloadKey, enqueueDownload, onDone, payload, tCommonActions, tPdfMessages]);

  const handleDownload = useCallback(async () => {
    if (!payload?.category_id || requestingRexven) return;
    setRequestingRexven(true);
    let result = null;
    try {
      const response = await OrdersAPI.requestRexvenLabels(payload);
      result = response?.data ?? null;
    } catch (error) {
      const reason = getRexvenLabelErrorReason(error);
      if (reason !== null) {
        modal.error({
          title: t("rejectedTitle"),
          content: (
            <>
              <p>{reason || t("requestFailed")}</p>
              <p>{t("rolledBack")}</p>
            </>
          ),
        });
      } else {
        message.error(error?.response?.data?.error?.message || t("requestFailed"));
      }
      onDone?.();
      return;
    } finally {
      setRequestingRexven(false);
    }

    const requested = Array.isArray(result?.requested) ? result.requested : [];
    const requestedOrders = requested.reduce((sum, row) => sum + (row?.order_count || 0), 0);
    if (requestedOrders) {
      message.success(t("requested", { count: requestedOrders }), 6);
    }

    if (Number(result?.easyjet_item_count || 0) > 0) {
      enqueueEasyjetDownload();
      return;
    }
    if (!requestedOrders) {
      message.info(tPdfMessages("noEligibleOrderItems"));
    }
    onDone?.();
  }, [enqueueEasyjetDownload, message, onDone, payload, requestingRexven, t, tPdfMessages]);

  return {
    handleDownload,
    loading: requestingRexven || isDownloading(downloadKey),
  };
}
