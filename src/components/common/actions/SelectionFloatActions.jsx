"use client";

import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { Button, Popconfirm } from "antd";

/**
 * Bulk action bar shown at the bottom of the screen while rows are selected:
 * selection summary on the left, the cancel and approve actions on the right.
 * Both actions keep their confirmation step.
 */
export default function SelectionFloatActions({
  count,
  selectedLabel,
  approveTooltip,
  cancelTooltip,
  confirmApproveTitle,
  confirmApproveOk,
  confirmCancelTitle,
  confirmCancelOk,
  confirmCancelDismiss,
  approving = false,
  cancelling = false,
  onApprove,
  onCancel,
}) {
  const busy = approving || cancelling;

  return (
    <div
      role="region"
      aria-label={selectedLabel}
      className="fixed bottom-4 left-1/2 z-[1200] flex w-[min(640px,calc(100vw-24px))] -translate-x-1/2 flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-900 px-4 py-3 text-white shadow-[0_16px_40px_rgba(10,26,36,0.32)] md:bottom-6"
    >
      <div className="flex items-center gap-3">
        <span
          className="ej-mono inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-600 px-2 text-sm font-semibold"
          aria-hidden="true"
        >
          {count}
        </span>
        <span className="text-sm font-medium">{selectedLabel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Popconfirm
          title={confirmCancelTitle}
          okText={confirmCancelOk}
          cancelText={confirmCancelDismiss}
          okButtonProps={{ loading: cancelling, danger: true }}
          onConfirm={onCancel}
          disabled={busy}
          placement="top"
        >
          <Button
            icon={<CloseOutlined />}
            loading={cancelling}
            disabled={busy}
            style={{
              background: "var(--ej-ink-800)",
              borderColor: "var(--ej-ink-700)",
              color: "#FFFFFF",
            }}
          >
            {cancelTooltip}
          </Button>
        </Popconfirm>
        <Popconfirm
          title={confirmApproveTitle}
          okText={confirmApproveOk}
          okButtonProps={{ loading: approving, type: "primary" }}
          onConfirm={onApprove}
          disabled={busy}
          placement="top"
        >
          <Button
            type="primary"
            icon={<CheckOutlined />}
            loading={approving}
            disabled={busy}
          >
            {approveTooltip}
          </Button>
        </Popconfirm>
      </div>
    </div>
  );
}
