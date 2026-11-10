"use client";

import { useCallback, useRef, useState } from "react";
import { App as AntdApp, Form } from "antd";
import { OrdersAPI } from "@/utils/api";
import { getBlobErrorMessage } from "@/utils/apiHelpers";
import { useTranslations } from "@/i18n/use-translations";
import { useDownloadQueue } from "@/components/downloads/DownloadQueueProvider";

import RexvenLabelSettingsForm from "./RexvenLabelSettingsForm";
import { buildRexvenLabelOptions } from "./rexvenLabelDefaults.mjs";
import { DownloadOutlined } from "@ant-design/icons";

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
  const tSettings = useTranslations("dashboard.orders.rexvenLabels.settings");
  const [form] = Form.useForm();
  const requestLock = useRef(false);
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
  }, [
    downloadKey,
    enqueueDownload,
    onDone,
    payload,
    tCommonActions,
    tPdfMessages,
  ]);

  const submitDownload = useCallback(
    async (labelOptions) => {
      let result = null;
      try {
        const response = await OrdersAPI.requestRexvenLabels({
          ...payload,
          ...(labelOptions ? { labelOptions } : {}),
        });
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
          message.error(
            error?.response?.data?.error?.message || t("requestFailed"),
          );
        }
        onDone?.();
        return false;
      }

      const requested = Array.isArray(result?.requested)
        ? result.requested
        : [];
      const requestedOrders = requested.reduce(
        (sum, row) => sum + (row?.order_count || 0),
        0,
      );
      if (requestedOrders) {
        message.success(t("requested", { count: requestedOrders }), 6);
      }

      if (Number(result?.easyjet_item_count || 0) > 0) {
        enqueueEasyjetDownload();
        return true;
      }
      if (!requestedOrders) {
        message.info(tPdfMessages("noEligibleOrderItems"));
      }
      onDone?.();
      return true;
    },
    [enqueueEasyjetDownload, message, modal, onDone, payload, t, tPdfMessages],
  );

  const handleDownload = useCallback(async () => {
    if (!payload?.category_id || requestLock.current) return;
    requestLock.current = true;
    setRequestingRexven(true);
    const release = () => {
      requestLock.current = false;
      setRequestingRexven(false);
    };
    let dialogOpened = false;
    try {
      const response = await OrdersAPI.previewRexvenLabels(payload);
      const { rexven_order_count: orderCount, defaults } = response?.data ?? {};
      if (Number(orderCount) > 0) {
        const dialog = modal.confirm({
          title: <span style={{ fontSize: 22 }}>{tSettings("title")}</span>,
          icon: null,
          width: 720,
          closable: true,
          okButtonProps: { icon: <DownloadOutlined /> },
          okText: tSettings("submit"),
          cancelText: tSettings("cancel"),
          maskClosable: false,
          keyboard: false,
          content: (
            <div
              style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: 12 }}
            >
              <RexvenLabelSettingsForm
                form={form}
                defaults={defaults}
                orderCount={orderCount}
              />
            </div>
          ),
          onCancel: release,
          onOk: async () => {
            const values = await form.validateFields();
            const options = buildRexvenLabelOptions(values);
            dialog.update({
              cancelButtonProps: { disabled: true },
              closable: false,
            });
            try {
              const succeeded = await submitDownload(options);
              if (!succeeded) throw new Error("Rexven label request failed");
              release();
            } finally {
              dialog.update({
                cancelButtonProps: { disabled: false },
                closable: true,
              });
            }
          },
        });
        dialogOpened = true;
      } else {
        await submitDownload();
      }
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message || t("requestFailed"),
      );
    } finally {
      if (!dialogOpened) release();
    }
  }, [form, message, modal, payload, submitDownload, t, tSettings]);

  return {
    handleDownload,
    loading: requestingRexven || isDownloading(downloadKey),
  };
}
