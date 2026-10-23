"use client";

import { useState } from "react";
import { App, Input, Modal } from "antd";
import { OrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

export default function ProductionNoteModal({ order, onCancel, onSaved }) {
  const { message } = App.useApp();
  const t = useTranslations("dashboard.orders");
  const tActions = useTranslations("common.actions");
  const [draft, setDraft] = useState(order.production_notes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await OrdersAPI.updateProductionNotes(order.id, {
        production_notes: draft.trim() || null,
      });
      message.success(t("detail.messages.productionNotesSaved"));
      onSaved?.();
    } catch (error) {
      message.error(
        error?.response?.data?.error?.message ||
          t("detail.messages.productionNotesSaveError"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t("columns.productionNote")}
      onCancel={onCancel}
      onOk={save}
      okText={tActions("save")}
      cancelText={tActions("cancel")}
      confirmLoading={saving}
      cancelButtonProps={{ disabled: saving }}
      closable={!saving}
      maskClosable={!saving}
      keyboard={!saving}
      okButtonProps={{
        disabled: draft.trim() === (order.production_notes || ""),
      }}
    >
      <div className="mb-3 text-sm text-text-secondary">
        {t("columns.orderNumber")}: {order.order_number}
      </div>
      <Input.TextArea
        aria-label={t("columns.productionNote")}
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        autoSize={{ minRows: 4, maxRows: 12 }}
        maxLength={200}
        disabled={saving}
      />
      <div className="mt-2 text-right text-xs text-text-secondary">
        {draft.length} / 200
      </div>
    </Modal>
  );
}
