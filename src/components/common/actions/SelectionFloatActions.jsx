"use client";

import {
  AppstoreOutlined,
  CheckOutlined,
  CloseOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { FloatButton, Grid, Popconfirm, theme } from "antd";

const DOCK_STYLE = {
  position: "fixed",
  right: 24,
  bottom: 24,
  zIndex: 1200,
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
};

const BASE_BUTTON_STYLE = {
  position: "static",
  width: 56,
  height: 56,
};

export default function SelectionFloatActions({
  count,
  selectedLabel,
  approveTooltip,
  cancelTooltip,
  confirmApproveTitle,
  confirmApproveOk,
  confirmCancelTitle,
  confirmCancelOk,
  approving = false,
  cancelling = false,
  onApprove,
  onCancel,
}) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const busy = approving || cancelling;

  return (
    <div
      style={{
        ...DOCK_STYLE,
        right: screens.xs && !screens.sm ? 12 : 24,
        bottom: screens.xs && !screens.sm ? 12 : 24,
        flexWrap: screens.xs && !screens.sm ? "wrap" : "nowrap",
        justifyContent: screens.xs && !screens.sm ? "flex-end" : "flex-start",
      }}
    >
      <Popconfirm
        title={confirmApproveTitle}
        okText={confirmApproveOk}
        okButtonProps={{ loading: approving, type: "primary" }}
        onConfirm={onApprove}
        disabled={busy}
        placement="top"
      >
        <div>
          <FloatButton
            tooltip={approveTooltip}
            type="primary"
            icon={approving ? <LoadingOutlined /> : <CheckOutlined />}
            style={{
              ...BASE_BUTTON_STYLE,
              background: busy ? token.colorBgContainerDisabled : token.colorPrimary,
              boxShadow: busy
                ? token.boxShadowSecondary
                : "0 12px 24px rgba(22, 119, 255, 0.32)",
              color: "#fff",
              border: `1px solid ${busy ? token.colorBorder : token.colorPrimaryHover}`,
              opacity: busy ? 0.72 : 1,
            }}
          />
        </div>
      </Popconfirm>

      <Popconfirm
        title={confirmCancelTitle}
        okText={confirmCancelOk}
        okButtonProps={{ loading: cancelling, danger: true }}
        onConfirm={onCancel}
        disabled={busy}
        placement="top"
      >
        <div>
          <FloatButton
            tooltip={cancelTooltip}
            type="danger"
            icon={cancelling ? <LoadingOutlined /> : <CloseOutlined />}
            style={{
              ...BASE_BUTTON_STYLE,
              background: busy ? token.colorBgContainerDisabled : token.colorError,
              boxShadow: busy
                ? token.boxShadowSecondary
                : "0 12px 24px rgba(255, 77, 79, 0.28)",
              color: "#fff",
              border: `1px solid ${busy ? token.colorBorder : token.colorErrorHover}`,
              opacity: busy ? 0.72 : 1,
            }}
          />
        </div>
      </Popconfirm>

      <FloatButton
        tooltip={selectedLabel}
        icon={<AppstoreOutlined />}
        badge={{ count, overflowCount: 999 }}
        style={{
          ...BASE_BUTTON_STYLE,
          background: token.colorBgElevated,
          boxShadow: token.boxShadowSecondary,
          color: token.colorText,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      />
    </div>
  );
}
