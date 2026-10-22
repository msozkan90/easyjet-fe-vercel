"use client";

import { useEffect, useState } from "react";
import { App, Button, Input } from "antd";
import { useSelector } from "react-redux";
import { useTranslations } from "@/i18n/use-translations";
import { hasAnyRole } from "@/utils/rbac";
import { OrdersAPI } from "@/utils/api";
import { InfoField, SideCard } from "./detail/DetailBlocks";

export default function OrderNotesCard({ order, editable = false, onSaved }) {
  const t = useTranslations("dashboard.orders.detail");
  const tOrders = useTranslations("dashboard.orders");
  const tActions = useTranslations("common.actions");
  const user = useSelector((state) => state.auth.user);
  const { message } = App.useApp();
  const [draft, setDraft] = useState(order?.production_notes || "");
  const [saving, setSaving] = useState(false);
  const canViewProduction = hasAnyRole(user, [
    "companyadmin",
    "companycompletedworker",
    "companyshipmentworker",
  ]);
  useEffect(() => {
    setDraft(order?.production_notes || "");
  }, [order?.id, order?.production_notes]);

  if (!order) return null;

  const save = async () => {
    setSaving(true);
    try {
      const response = await OrdersAPI.updateProductionNotes(order.id, {
        production_notes: draft.trim() || null,
      });
      onSaved?.(response?.data?.production_notes ?? null);
      message.success(t("messages.productionNotesSaved"));
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          t("messages.productionNotesSaveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SideCard title={t("sections.notes")}>
      {[
        ["customerNotes", order.customer_notes],
        ["internalNotes", order.internal_notes],
        ["giftMessage", order.gift_message],
      ].map(([key, value]) => (
        <InfoField
          key={key}
          label={t(`fields.${key}`)}
          value={value || tOrders("common.none")}
          valueClassName="whitespace-pre-wrap"
        />
      ))}
      {canViewProduction &&
      (editable || Object.hasOwn(order, "production_notes")) ? (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          {editable ? (
            <>
              <label
                htmlFor="production-notes"
                className="text-xs text-text-secondary"
              >
                {t("fields.productionNotes")}
              </label>
              <Input.TextArea
                id="production-notes"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                autoSize={{ minRows: 3, maxRows: 12 }}
                maxLength={10000}
                disabled={saving}
              />
              <Button
                className="self-end"
                type="primary"
                onClick={save}
                loading={saving}
                disabled={draft.trim() === (order.production_notes || "")}
              >
                {tActions("save")}
              </Button>
            </>
          ) : (
            <InfoField
              label={t("fields.productionNotes")}
              value={order.production_notes || tOrders("common.none")}
              valueClassName="whitespace-pre-wrap"
            />
          )}
        </div>
      ) : null}
    </SideCard>
  );
}
