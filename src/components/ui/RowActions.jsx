"use client";

import { Button, Dropdown, Tooltip } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { useTranslations } from "@/i18n/use-translations";

/**
 * Table row actions: up to two visible buttons plus an overflow menu.
 * `actions`: [{ key, label, icon, onClick, disabled, loading, primary }]
 * `menuItems`: antd Menu items for the "more" dropdown.
 * Icon-only visible actions always get a tooltip and aria-label.
 */
export default function RowActions({
  actions = [],
  menuItems = [],
  size = "small",
}) {
  const tActions = useTranslations("common.actions");
  const visible = actions.filter(Boolean);
  const overflow = menuItems.filter(Boolean);

  return (
    <div className="flex items-center justify-end gap-1">
      {visible.map((action) => {
        const button = (
          <Button
            key={action.key}
            size={size}
            type={action.primary ? "primary" : "default"}
            danger={action.danger}
            icon={action.icon}
            onClick={action.onClick}
            disabled={action.disabled}
            loading={action.loading}
            aria-label={action.iconOnly ? action.label : undefined}
            href={action.href}
          >
            {action.iconOnly ? null : action.label}
          </Button>
        );
        return action.iconOnly ? (
          <Tooltip key={action.key} title={action.label}>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
      {overflow.length ? (
        <Dropdown
          trigger={["click"]}
          placement="bottomRight"
          menu={{ items: overflow }}
        >
          <Button
            size={size}
            type="text"
            icon={<MoreOutlined />}
            aria-label={tActions("moreActions")}
            title={tActions("moreActions")}
          />
        </Dropdown>
      ) : null}
    </div>
  );
}
