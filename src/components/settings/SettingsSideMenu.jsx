"use client";

import { ApiOutlined, BellOutlined } from "@ant-design/icons";
import { SETTINGS_SECTIONS } from "@/components/settings/settings.constants";
import { translateOrFallback } from "@/components/settings/settings.helpers";

export default function SettingsSideMenu({ activeKey, onChange, tSettings }) {
  const title = translateOrFallback(tSettings, "sidebar.title", "Settings Menu");

  const items = [
    {
      key: SETTINGS_SECTIONS.API_CONF,
      icon: <ApiOutlined />,
      label: translateOrFallback(tSettings, "sidebar.items.apiConf", "Api Conf"),
    },
    {
      key: SETTINGS_SECTIONS.NOTIFICATION,
      icon: <BellOutlined />,
      label: translateOrFallback(
        tSettings,
        "sidebar.items.notification",
        "Notification"
      ),
    },
  ];

  return (
    <nav
      aria-label={title}
      className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-2"
    >
      <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {title}
      </div>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange?.(item.key)}
            className={`flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-md border-0 px-3 text-left text-sm transition-colors ${
              active
                ? "bg-brand-50 font-medium text-brand-800 shadow-[inset_3px_0_0_var(--ej-orange-600)]"
                : "bg-transparent text-text hover:bg-subtle"
            }`}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
