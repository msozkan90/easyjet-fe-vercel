"use client";

import { Alert, Button, Modal, Space, Switch, Typography } from "antd";
import { useLocaleInfo, useTranslations } from "@/i18n/use-translations";

export default function LabelPrinterSettings({
  open,
  onClose,
  autoPrint,
  onAutoPrintChange,
}) {
  const t = useTranslations("dashboard.orders.scanner.printing");
  const { locale } = useLocaleInfo();

  return (
    <Modal
      open={open}
      title={t("settings")}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t("done")}</Button>}
      width={640}
    >
      <Space direction="vertical" size="large" className="w-full">
        <div className="flex items-start justify-between gap-4">
          <div>
            <label htmlFor="scanner-auto-print" className="font-medium">
              {t("autoPrint")}
            </label>
            <p className="mb-0 text-sm text-text-secondary">
              {t("autoPrintDescription")}
            </p>
          </div>
          <Switch
            id="scanner-auto-print"
            checked={autoPrint}
            onChange={onAutoPrintChange}
          />
        </div>

        <div>
          <Typography.Text strong>{t("printerTitle")}</Typography.Text>
          <p>{t("printerDescription")}</p>
          <ol className="mb-0 space-y-2 pl-5">
            <li>{t("printerStep")}</li>
            <li>{t("paperStep")}</li>
            <li>{t("updateStep")}</li>
          </ol>
        </div>

        <Alert
          type="info"
          showIcon
          message={t("silentTitle")}
          description={
            <Space direction="vertical">
              <span>{t("silentDescription")}</span>
              <span>{t("scopeDescription")}</span>
              <Button
                href={`/printing/silent-printing-${locale === "tr" ? "tr" : "en"}.txt`}
                download
              >
                {t("downloadGuide")}
              </Button>
              <Space wrap>
                <Button size="small" href="/printing/chrome-silent-printing-enable.reg" download>
                  Windows
                </Button>
                <Button size="small" href="/printing/chrome-silent-printing.mobileconfig" download>
                  macOS
                </Button>
                <Button size="small" href="/printing/chrome-silent-printing.json" download>
                  Linux
                </Button>
              </Space>
            </Space>
          }
        />
        <Typography.Text type="secondary">
          {t("verificationDescription")}
        </Typography.Text>
      </Space>
    </Modal>
  );
}
