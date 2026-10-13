"use client";

import { useCallback, useEffect, useRef } from "react";
import { App as AntdApp } from "antd";
import { useTranslations } from "@/i18n/use-translations";

/**
 * Tracks whether the form inside a modal was edited and asks for
 * confirmation before the modal closes with unsaved changes.
 *
 * - `markDirty` / `onDirtyChange` mark the form as edited.
 * - `guardClose(fn)` returns a close handler that confirms first when dirty.
 * The flag resets every time the modal opens.
 */
export function useDirtyGuard(open) {
  const { modal } = AntdApp.useApp();
  const t = useTranslations("common.unsavedChanges");
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (open) dirtyRef.current = false;
  }, [open]);

  const onDirtyChange = useCallback((dirty = true) => {
    dirtyRef.current = Boolean(dirty);
  }, []);

  const guardClose = useCallback(
    (onDiscard) => () => {
      if (!dirtyRef.current) {
        onDiscard?.();
        return;
      }
      modal.confirm({
        centered: true,
        title: t("title"),
        content: t("description"),
        okText: t("discard"),
        cancelText: t("continueEditing"),
        onOk: () => {
          dirtyRef.current = false;
          onDiscard?.();
        },
      });
    },
    [modal, t],
  );

  return { onDirtyChange, guardClose };
}
