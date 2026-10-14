"use client";

import { Badge, Button, Progress, Tag, Typography } from "antd";
import {
  CloseOutlined,
  DeleteOutlined,
  MinusOutlined,
  PlusOutlined,
  RedoOutlined,
} from "@ant-design/icons";
import StatusTag from "@/components/ui/StatusTag";

const STATUS_TONES = {
  queued: "neutral",
  uploading: "info",
  preparing: "info",
  saving: "info",
  success: "success",
  failed: "danger",
  canceled: "waiting",
};

export const formatBytes = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  );
  const amount = size / 1024 ** exp;
  return `${amount.toFixed(amount >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
};

export const normalizeProgressPercent = (value) => {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return 0;
  return Math.round(Math.max(0, Math.min(100, percent)) * 100) / 100;
};

export const formatProgressPercent = (value) => {
  const percent = normalizeProgressPercent(value);
  return percent.toFixed(Number.isInteger(percent) ? 0 : 2);
};

/**
 * Floating design upload queue (bottom-left). Shared by the order, orders
 * PDF and transfer upload queues; each queue supplies its own task title,
 * detail line and server "preparing" states.
 */
export default function UploadQueuePanel({
  tasks,
  tQueue,
  zIndex,
  hasOngoingUploads,
  collapsed,
  onToggleCollapse,
  onClearFinished,
  onRetry,
  onCancel,
  onRemove,
  getTitle = (task) => task.fileName,
  renderMeta,
  getTotalBytes = (task) => task.fileSize,
  preparingStatuses = ["pending", "preparing"],
}) {
  if (!tasks.length) return null;

  const queuedCount = tasks.filter((task) => task.status === "queued").length;
  const uploadingCount = tasks.filter(
    (task) => task.status === "uploading",
  ).length;

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        bottom: "calc(16px + var(--download-queue-offset, 0px))",
        width: "min(380px, calc(100vw - 32px))",
        zIndex,
        pointerEvents: "none",
      }}
    >
      <section
        aria-label={tQueue("title")}
        className="pointer-events-auto overflow-hidden rounded-xl border border-line bg-surface shadow-[0_12px_32px_rgba(15,36,51,0.16)]"
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-text">
            <Badge status={hasOngoingUploads ? "processing" : "default"} />
            <span>{tQueue("title")}</span>
            <Tag>{tasks.length}</Tag>
            {uploadingCount ? (
              <StatusTag tone="info" size="small">
                {tQueue("badges.uploading", { count: uploadingCount })}
              </StatusTag>
            ) : null}
            {queuedCount ? (
              <StatusTag tone="neutral" size="small">
                {tQueue("badges.queued", { count: queuedCount })}
              </StatusTag>
            ) : null}
          </div>
          <Button
            size="small"
            type="text"
            icon={collapsed ? <PlusOutlined /> : <MinusOutlined />}
            onClick={onToggleCollapse}
            aria-label={tQueue("title")}
            aria-expanded={!collapsed}
          />
        </header>
        {collapsed ? null : (
          <div className="flex max-h-[340px] flex-col gap-2 overflow-y-auto p-3">
            <div className="flex items-center justify-between gap-2">
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {tQueue("subtitle")}
              </Typography.Text>
              <Button
                size="small"
                icon={<DeleteOutlined />}
                onClick={onClearFinished}
              >
                {tQueue("actions.clearFinished")}
              </Button>
            </div>
            {tasks.map((task) => {
              const isPreparing =
                task.status === "uploading" &&
                preparingStatuses.includes(task.serverStatus);
              const isSaving =
                task.status === "uploading" && task.serverStatus === "saving";
              const statusKey = isPreparing
                ? "preparing"
                : isSaving
                  ? "saving"
                  : STATUS_TONES[task.status]
                    ? task.status
                    : "queued";
              const canCancel = ["queued", "uploading"].includes(task.status);
              const canRetry = ["failed", "canceled"].includes(task.status);
              const canRemove = !canCancel;

              return (
                <article
                  key={task.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-line p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Typography.Text ellipsis style={{ maxWidth: 210 }}>
                      {getTitle(task)}
                    </Typography.Text>
                    <StatusTag tone={STATUS_TONES[statusKey]} size="small">
                      {tQueue(`status.${statusKey}`)}
                    </StatusTag>
                  </div>
                  {renderMeta ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {renderMeta(task)}
                    </Typography.Text>
                  ) : null}
                  <Progress
                    percent={task.status === "queued" ? 0 : task.progress}
                    size="small"
                    status={
                      task.status === "failed"
                        ? "exception"
                        : task.status === "success"
                          ? "success"
                          : "active"
                    }
                    showInfo={task.status !== "queued"}
                    format={(percent) => `${formatProgressPercent(percent)}%`}
                  />
                  {task.status === "uploading" ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {isPreparing
                        ? tQueue("fields.preparationProgress", {
                            percent: formatProgressPercent(
                              task.preparationProgress,
                            ),
                          })
                        : tQueue("fields.uploadProgress", {
                            uploaded: formatBytes(task.uploadedBytes),
                            total: formatBytes(
                              task.uploadTotalBytes || getTotalBytes(task),
                            ),
                          })}
                      {!isPreparing && task.uploadSpeed > 0
                        ? ` • ${formatBytes(task.uploadSpeed)}/s`
                        : ""}
                    </Typography.Text>
                  ) : null}
                  {task.errorMessage ? (
                    <Typography.Text type="danger" style={{ fontSize: 12 }}>
                      {task.errorMessage}
                    </Typography.Text>
                  ) : null}
                  {canRetry || canCancel || canRemove ? (
                    <div className="flex justify-end gap-1.5">
                      {canRetry ? (
                        <Button
                          size="small"
                          icon={<RedoOutlined />}
                          onClick={() => onRetry(task.id)}
                        >
                          {tQueue("actions.retry")}
                        </Button>
                      ) : null}
                      {canCancel ? (
                        <Button
                          size="small"
                          danger
                          icon={<CloseOutlined />}
                          onClick={() => onCancel(task.id)}
                        >
                          {tQueue("actions.cancel")}
                        </Button>
                      ) : null}
                      {canRemove ? (
                        <Button
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => onRemove(task.id)}
                        >
                          {tQueue("actions.remove")}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
