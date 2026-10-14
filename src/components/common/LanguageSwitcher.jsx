"use client";

import { App as AntdApp, Button, Dropdown } from "antd";
import { CheckOutlined, DownOutlined, GlobalOutlined } from "@ant-design/icons";
import { locales, localeLabels } from "@/i18n/settings";
import { useLocaleInfo, useTranslations } from "@/i18n/use-translations";

// Inline SVG flags: emoji flags render as plain letters on Windows.
const FLAGS = {
  tr: (
    <svg viewBox="0 0 30 20" aria-hidden="true">
      <rect width="30" height="20" fill="#E30A17" />
      <circle cx="10" cy="10" r="5" fill="#FFFFFF" />
      <circle cx="11.25" cy="10" r="4" fill="#E30A17" />
      <path
        fill="#FFFFFF"
        d="M13.92 10.00L15.65 9.44L15.65 7.62L16.72 9.09L18.44 8.53L17.38 10.00L18.44 11.47L16.72 10.91L15.65 12.38L15.65 10.56z"
      />
    </svg>
  ),
  en: (
    <svg viewBox="0 0 60 30" aria-hidden="true">
      <clipPath id="ej-flag-gb-clip">
        <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#FFFFFF" strokeWidth="6" />
      <path
        d="M0 0l60 30m0-30L0 30"
        clipPath="url(#ej-flag-gb-clip)"
        stroke="#C8102E"
        strokeWidth="4"
      />
      <path d="M30 0v30M0 15h60" stroke="#FFFFFF" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  ),
};

export function LanguageFlag({ locale, size = 18 }) {
  const flag = FLAGS[locale];
  if (!flag) return <GlobalOutlined style={{ fontSize: size * 0.8 }} />;
  return (
    <span
      className="ej-flag"
      style={{ width: size, height: Math.round(size * 0.7) }}
    >
      {flag}
    </span>
  );
}

function useLocaleSelect() {
  const { message } = AntdApp.useApp();
  const t = useTranslations("common");
  const { locale, changeLocale, isChangingLocale } = useLocaleInfo();

  const select = async (value) => {
    if (value === locale) return;
    try {
      await changeLocale(value);
      message.success(
        t("languageChanged", { language: localeLabels[value] || value }),
      );
    } catch {
      message.error(t("languageChangeError"));
    }
  };

  const items = locales.map((value) => ({
    key: `locale-${value}`,
    disabled: isChangingLocale,
    label: (
      <span className="flex min-w-[148px] items-center gap-2.5">
        <LanguageFlag locale={value} />
        <span className="flex-1">{localeLabels[value] || value}</span>
        {value === locale ? (
          <CheckOutlined className="text-xs text-brand-600" />
        ) : null}
      </span>
    ),
    onClick: () => select(value),
  }));

  return { t, locale, items, isChangingLocale };
}

/**
 * Language entry for an antd Dropdown menu (the header user menu): a submenu
 * showing the current flag and language, with one flagged row per locale.
 */
export function useLanguageMenuItem() {
  const { t, locale, items } = useLocaleSelect();
  return {
    key: "language",
    icon: <LanguageFlag locale={locale} size={16} />,
    label: (
      <span className="flex items-center justify-between gap-6">
        <span>{t("language")}</span>
        <span className="text-xs text-text-secondary">
          {localeLabels[locale] || locale}
        </span>
      </span>
    ),
    children: items,
  };
}

/** Standalone flagged language picker (used on the login screen). */
export function LanguageSwitcher() {
  const { t, locale, items, isChangingLocale } = useLocaleSelect();
  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      menu={{ items, selectedKeys: [`locale-${locale}`] }}
    >
      <Button
        type="text"
        loading={isChangingLocale}
        aria-label={`${t("language")}: ${localeLabels[locale] || locale}`}
        className="ej-language-trigger"
      >
        <LanguageFlag locale={locale} />
        <span>{localeLabels[locale] || locale}</span>
        <DownOutlined className="text-[10px] text-ink-400" />
      </Button>
    </Dropdown>
  );
}
