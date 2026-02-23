"use client";

import { Select, Space, Typography, message } from "antd";
import { locales, localeLabels } from "@/i18n/settings";
import { useLocaleInfo, useTranslations } from "@/i18n/use-translations";

export function LanguageSwitcher({ size = "middle", textColor = "#ffffffd9" }) {
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
        t("languageChanged", { language: localeLabels[value] || value })
      );
    } catch {
      message.error(t("languageChangeError"));
    }
  };

  return (
    <Space size={8} align="center">
      <Typography.Text style={{ color: textColor }}>
        {t("language")}
      </Typography.Text>
      <Select
        value={locale}
        options={options}
        onChange={onSelect}
        disabled={isChangingLocale}
        size={size}
        style={{ width: 140 }}
        popupMatchSelectWidth={false}
      />
    </Space>
  );
}
