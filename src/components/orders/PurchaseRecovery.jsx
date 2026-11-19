"use client";

import { useEffect, useState } from "react";
import { Alert, Button } from "antd";
import { OrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

export function labelRecoveryFromError(error) {
  const details = error?.response?.data?.error?.details;
  return details?.recovery_action ? details : null;
}

export function useOrderPurchaseRecovery(open, orderNumber) {
  const [recovery, setRecovery] = useState(null);
  const action = recovery?.recovery_action;
  const attemptId = recovery?.attempt_id;

  useEffect(() => {
    setRecovery(null);
  }, [open, orderNumber]);

  useEffect(() => {
    if (!open || !orderNumber || (action && !["checking", "support"].includes(action))) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await OrdersAPI.orderDetail(orderNumber);
        if (!active) return;
        const pending = response?.data?.production_attempts?.find((attempt) => attempt.blocks_order);
        setRecovery((current) => {
          if (current && current.attempt_id !== attemptId) return current;
          return pending ?? (attemptId ? { recovery_action: "retry" } : current);
        });
      } catch {
        // The next production response also carries the current recovery status.
      }
    };
    void refresh();
    const interval = action ? setInterval(refresh, 10_000) : null;
    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [action, attemptId, open, orderNumber]);

  return [recovery, setRecovery];
}

export function PurchaseRecoveryNotice({ recovery, loading, onResume }) {
  const t = useTranslations("dashboard.orders.detail.labelRecovery");
  const [waiting, setWaiting] = useState(false);
  const retryAt = recovery?.next_retry_at;
  const action = recovery?.recovery_action;

  useEffect(() => {
    const remaining = Date.parse(retryAt) - Date.now();
    setWaiting(remaining > 0);
    if (remaining > 0) {
      const timer = setTimeout(() => setWaiting(false), remaining);
      return () => clearTimeout(timer);
    }
  }, [retryAt]);

  if (!action) return null;
  return (
    <Alert
      showIcon
      type={action === "support" || action === "retry" ? "warning" : "info"}
      message={t(`purchase.${action}`)}
      description={action === "resume" && recovery.recovery_status === "purchase_unknown"
        ? t("purchase.resumeDescription")
        : recovery.message}
      action={action === "resume" && onResume ? (
        <Button type="primary" loading={loading} disabled={waiting} onClick={onResume}>
          {t("actions.resume")}
        </Button>
      ) : undefined}
    />
  );
}
