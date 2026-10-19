"use client";

import { useEffect, useState } from "react";
import { Alert, App as AntdApp, Button, Checkbox, Modal } from "antd";
import { CheckOutlined, CopyOutlined } from "@ant-design/icons";
import { useTranslations } from "@/i18n/use-translations";

/**
 * Shows a newly created or rotated key exactly once. Closing requires confirming
 * the key was stored, because it cannot be shown again.
 */
export default function ApiKeySecretModal({ secret, onClose }) {
  const t = useTranslations("dashboard.settings.apiKeys.secret");
  const { message } = AntdApp.useApp();
  const [copied, setCopied] = useState(false);
  const [stored, setStored] = useState(false);

  useEffect(() => {
    setCopied(false);
    setStored(false);
  }, [secret?.apiKey]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret.apiKey);
      setCopied(true);
      message.success(t("copied"));
    } catch {
      message.error(t("copyFailed"));
    }
  };

  return (
    <Modal
      open={Boolean(secret)}
      title={
        secret?.kind === "webhook"
          ? t(secret.rotated ? "webhookRotatedTitle" : "webhookTitle")
          : t(secret?.rotated ? "rotatedTitle" : "title")
      }
      closable={false}
      maskClosable={false}
      keyboard={false}
      destroyOnHidden
      footer={
        <Button type="primary" disabled={!stored} onClick={onClose}>
          {t("done")}
        </Button>
      }
    >
      {secret ? (
        <div className="flex flex-col gap-4">
          <Alert
            type="warning"
            showIcon
            message={t(
              secret.kind === "webhook" ? "webhookWarning" : "warning",
            )}
          />
          <div className="flex items-stretch gap-2">
            <code className="ej-mono min-w-0 flex-1 break-all rounded-md border border-line bg-subtle px-3 py-2 text-[13px] text-text">
              {secret.apiKey}
            </code>
            <Button
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={copy}
              aria-label={t("copy")}
              className="h-auto"
            >
              {t("copy")}
            </Button>
          </div>
          {secret.previousKeyExpiresAt ? (
            <p className="m-0 text-[13px] text-text-secondary">
              {t("previousKeyGrace", {
                date: new Date(secret.previousKeyExpiresAt).toLocaleString(),
              })}
            </p>
          ) : null}
          <Checkbox
            checked={stored}
            onChange={(e) => setStored(e.target.checked)}
          >
            {t("confirmStored")}
          </Checkbox>
        </div>
      ) : null}
    </Modal>
  );
}
