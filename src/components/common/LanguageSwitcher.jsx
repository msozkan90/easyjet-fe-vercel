"use client";

import { App as AntdApp, Select, Space, Typography } from "antd";
import { locales, localeLabels } from "@/i18n/settings";
import { useLocaleInfo, useTranslations } from "@/i18n/use-translations";

export function LanguageSwitcher({
  size = "middle",
  textColor,
  showLabel = true,
}) {
  const { message } = AntdApp.useApp();
  const t = useTranslations("common");
  const { locale, changeLocale, isChangingLocale } = useLocaleInfo();

  const options = locales.map((value) => ({
    value,
    label: localeLabels[value] || value,
  }));

  const onSelect = async (value) => {
    try {
      await changeLocale(value);
      message.success(
        t("languageChanged", { language: localeLabels[value] || value }),
      );
    } catch {
      message.error(t("languageChangeError"));
    }
  };

  return (
    <Space size={8} align="center">
      {showLabel ? (
        <Typography.Text type="secondary" style={{ color: textColor }}>
          {t("language")}
        </Typography.Text>
      ) : null}
      <Select
        value={locale}
        options={options}
        onChange={onSelect}
        disabled={isChangingLocale}
        size={size}
        style={{ width: showLabel ? 140 : 112 }}
        popupMatchSelectWidth={false}
        aria-label={t("language")}
      />
    </Space>
  );
}
