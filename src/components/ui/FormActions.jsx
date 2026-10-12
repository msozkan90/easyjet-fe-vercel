"use client";

import { Button } from "antd";
import { useTranslations } from "@/i18n/use-translations";

/**
 * Form footer with the standard order: [Cancel] [Primary], right aligned.
 * The submit button shows a loading state so a form cannot be sent twice.
 */
export default function FormActions({
  onCancel,
  submitText,
  cancelText,
  loading = false,
  disabled = false,
  htmlType = "submit",
  onSubmit,
  danger = false,
  block = false,
  className = "",
}) {
  const tActions = useTranslations("common.actions");
  return (
    <div
      className={`flex items-center justify-end gap-2 ${
        block ? "flex-col-reverse sm:flex-row" : ""
      } ${className}`.trim()}
    >
      {onCancel ? (
        <Button onClick={onCancel} disabled={loading} block={block}>
          {cancelText ?? tActions("cancel")}
        </Button>
      ) : null}
      <Button
        type="primary"
        htmlType={htmlType}
        onClick={onSubmit}
        loading={loading}
        disabled={disabled}
        danger={danger}
        block={block}
      >
        {submitText ?? tActions("save")}
      </Button>
    </div>
  );
}
