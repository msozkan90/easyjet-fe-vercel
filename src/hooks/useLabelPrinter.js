"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { App as AntdApp } from "antd";
import { useTranslations } from "@/i18n/use-translations";
import { printOrderLabel } from "@/utils/orderItemDesignDownloads";
import {
  labelPrintPreferenceKey,
  readAutoPrintPreference,
  saveAutoPrintPreference,
} from "@/utils/labelPrintPreferences.mjs";

// Both shipment scanners share one account/workstation printing preference.
export default function useLabelPrinter() {
  const { message } = AntdApp.useApp();
  const tOrders = useTranslations("dashboard.orders");
  const userId = useSelector((state) => state.auth.user?.id);
  const preferenceKey = labelPrintPreferenceKey(userId);
  const [printPreference, setPrintPreference] = useState(null);
  const [printingLabel, setPrintingLabel] = useState(false);
  const printInFlightRef = useRef(false);
  const preferencesReady = Boolean(
    preferenceKey && printPreference?.key === preferenceKey,
  );
  const autoPrint = preferencesReady ? printPreference.autoPrint : true;

  useEffect(() => {
    if (!preferenceKey) return;
    const loadPreference = () => {
      let enabled = true;
      try {
        enabled = readAutoPrintPreference(window.localStorage, preferenceKey);
      } catch {
        // Browsers may deny access to localStorage altogether.
      }
      setPrintPreference({ key: preferenceKey, autoPrint: enabled });
    };
    loadPreference();
    const handleStorage = (event) => {
      if (event.key === preferenceKey || event.key === null) loadPreference();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [preferenceKey]);

  const handleAutoPrintChange = (enabled) => {
    setPrintPreference({ key: preferenceKey, autoPrint: enabled });
    let saved = false;
    try {
      saved = saveAutoPrintPreference(window.localStorage, preferenceKey, enabled);
    } catch {
      // Keep the selected mode for this page if persistence is unavailable.
    }
    if (!saved) message.warning(tOrders("scanner.printing.preferenceSaveError"));
  };

  const requestLabelPrint = useCallback(
    async (url) => {
      if (!url || printInFlightRef.current) return;
      printInFlightRef.current = true;
      setPrintingLabel(true);
      try {
        const result = await printOrderLabel({ labelUrl: url });
        if (result?.printed) {
          // The browser cannot confirm the policy, destination or paper output.
          message.info(tOrders("scanner.printing.printRequested"));
        }
      } catch (error) {
        message.error(
          error?.message || tOrders("scanner.messages.labelPrintError"),
        );
      } finally {
        printInFlightRef.current = false;
        setPrintingLabel(false);
      }
    },
    [message, tOrders],
  );

  return {
    autoPrint,
    preferencesReady,
    handleAutoPrintChange,
    printingLabel,
    printInFlightRef,
    requestLabelPrint,
  };
}
