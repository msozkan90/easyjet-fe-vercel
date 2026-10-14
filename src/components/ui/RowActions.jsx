"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { App as AntdApp, Button, Dropdown, Popconfirm, Tooltip } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { useTranslations } from "@/i18n/use-translations";

/**
 * Table row actions: up to two visible buttons plus an overflow menu.
 * `actions`: [{ key, label, icon, onClick, href, target, disabled, loading,
 *   primary, confirm }]
 * `menuItems`: antd Menu items for the "more" dropdown. Besides the usual
 * fields a menu item may carry:
 *   - `confirm: { title, description, okText }` — asks before `onClick` runs
 *     (replaces a Popconfirm, which cannot live inside a menu);
 *   - `pickFiles: { multiple, accept, onPick(files) }` — opens the file picker
 *     and passes the chosen File objects to `onPick` (replaces an Upload).
 * Icon-only visible actions always get a tooltip and aria-label; `tooltip`
 * explains why a disabled action is unavailable.
 */
export default function RowActions({
  actions = [],
  menuItems = [],
  size = "small",
}) {
  const { modal } = AntdApp.useApp();
  const router = useRouter();
  const tActions = useTranslations("common.actions");
  const fileInputRef = useRef(null);
  const pendingPickRef = useRef(null);
  const visible = actions.filter(Boolean);
  const overflow = menuItems.filter(Boolean).map((item) => {
    if (item.type === "divider" || (!item.confirm && !item.pickFiles)) {
      return item;
    }
    const { confirm, pickFiles, onClick, ...rest } = item;
    return {
      ...rest,
      onClick: (info) => {
        if (pickFiles) {
          const input = fileInputRef.current;
          if (!input) return;
          pendingPickRef.current = pickFiles;
          input.multiple = Boolean(pickFiles.multiple);
          input.accept = pickFiles.accept || "";
          input.value = "";
          input.click();
          return;
        }
        modal.confirm({
          title: confirm.title,
          content: confirm.description,
          okText: confirm.okText,
          okButtonProps: item.danger ? { danger: true } : undefined,
          onOk: () => onClick?.(info),
        });
      },
    };
  });
  const needsFileInput = menuItems.some((item) => item?.pickFiles);

  return (
    <div className="flex items-center justify-end gap-1">
      {visible.map((action) => {
        let button = (
          <Button
            key={action.key}
            size={size}
            type={action.primary ? "primary" : "default"}
            danger={action.danger}
            icon={action.icon}
            onClick={
              action.confirm
                ? undefined
                : (event) => {
                    // Plain clicks on same-tab links navigate client-side;
                    // modifier/middle clicks keep the browser default.
                    if (
                      action.href &&
                      !action.target &&
                      !action.disabled &&
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      router.push(action.href);
                    }
                    action.onClick?.(event);
                  }
            }
            disabled={action.disabled}
            loading={action.loading}
            aria-label={action.iconOnly ? action.label : undefined}
            href={action.disabled ? undefined : action.href}
            target={action.href ? action.target : undefined}
            rel={action.target === "_blank" ? "noopener noreferrer" : undefined}
          >
            {action.iconOnly ? null : action.label}
          </Button>
        );
        if (action.confirm) {
          button = (
            <Popconfirm
              key={action.key}
              title={action.confirm.title}
              description={action.confirm.description}
              okText={action.confirm.okText}
              okButtonProps={action.danger ? { danger: true } : undefined}
              onConfirm={action.onClick}
              disabled={action.disabled}
            >
              {button}
            </Popconfirm>
          );
        }
        const tooltip =
          action.tooltip ?? (action.iconOnly ? action.label : null);
        if (!tooltip) return button;
        return (
          <Tooltip key={action.key} title={tooltip}>
            {action.disabled ? <span>{button}</span> : button}
          </Tooltip>
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
      {needsFileInput ? (
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            const pick = pendingPickRef.current;
            pendingPickRef.current = null;
            if (files.length && pick) pick.onPick(files);
          }}
        />
      ) : null}
    </div>
  );
}
