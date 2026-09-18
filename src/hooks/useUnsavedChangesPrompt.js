"use client";

import { useCallback } from "react";
import { Modal } from "antd";
import { useTranslations } from "@/i18n/use-translations";

export function useUnsavedChangesPrompt() {
  const [modal, contextHolder] = Modal.useModal();
  const t = useTranslations("common.unsavedChanges");

  const confirmIfDirty = useCallback(
    async ({ isDirty, onDiscard }) => {
      if (!isDirty) {
        onDiscard?.();
        return true;
      }

      return new Promise((resolve) => {
        modal.confirm({
          centered: true,
          title: t("title"),
          content: t("description"),
          okText: t("discard"),
          cancelText: t("continueEditing"),
          onOk: () => {
            onDiscard?.();
            resolve(true);
          },
          onCancel: () => resolve(false),
        });
      });
    },
    [modal, t]
  );

  return {
    confirmIfDirty,
    unsavedChangesModalContextHolder: contextHolder,
  };
}
