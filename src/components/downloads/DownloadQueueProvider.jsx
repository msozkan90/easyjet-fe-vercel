"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Badge, Button, Card, Progress, Space, Tag, Typography } from "antd";
import {
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  MinusOutlined,
  RedoOutlined,
} from "@ant-design/icons";
import { getBlobErrorMessage, saveBlobAsFile } from "@/utils/apiHelpers";
import { useTranslations } from "@/i18n/use-translations";

const MAX_CONCURRENT_DOWNLOADS = 2;
const DownloadQueueContext = createContext(null);

const createTaskId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatBytes = (value) => {
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

const formatDuration = (milliseconds) => {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const normalizePercent = (loaded, total) => {
  if (!total || total <= 0) return 0;
  return (
    Math.round(Math.max(0, Math.min(100, (loaded / total) * 100)) * 100) / 100
  );
};

export function DownloadQueueProvider({ children }) {
  const t = useTranslations("dashboard.orders.ordersPdf.downloadQueue");
  const [tasks, setTasks] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const tasksRef = useRef(tasks);
  const controllersRef = useRef(new Map());
  const panelRef = useRef(null);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (!tasks.length || !panelRef.current) {
      document.documentElement.style.removeProperty("--download-queue-offset");
      return undefined;
    }
    const panel = panelRef.current;
    const updateOffset = () => {
      document.documentElement.style.setProperty(
        "--download-queue-offset",
        `${panel.getBoundingClientRect().height + 12}px`,
      );
    };
    updateOffset();
    if (typeof ResizeObserver === "undefined") {
      return () =>
        document.documentElement.style.removeProperty(
          "--download-queue-offset",
        );
    }
    const observer = new ResizeObserver(updateOffset);
    observer.observe(panel);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--download-queue-offset");
    };
  }, [collapsed, tasks.length]);

  const updateTask = useCallback((taskId, patch) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task,
      ),
    );
  }, []);

  const runTask = useCallback(
    async (taskId) => {
      const task = tasksRef.current.find((item) => item.id === taskId);
      if (!task || task.status !== "queued") return;

      const controller = new AbortController();
      const startedAt = Date.now();
      controllersRef.current.set(taskId, controller);
      updateTask(taskId, {
        status: "preparing",
        startedAt,
        finishedAt: null,
        loadedBytes: 0,
        totalBytes: 0,
        totalIsEstimated: false,
        progress: 0,
        speedBytes: 0,
        errorMessage: null,
      });

      try {
        const result = await task.request({
          signal: controller.signal,
          onDownloadProgress: (event) => {
            const loaded = Number(event?.loaded || 0);
            const headerTotal = Number(
              event?.event?.target?.getResponseHeader?.(
                "x-download-uncompressed-length",
              ) || 0,
            );
            const responseTotal = Number(event?.total || 0);
            const total = responseTotal > 0 ? responseTotal : headerTotal;
            const elapsedSeconds = Math.max(
              (Date.now() - startedAt) / 1000,
              0.001,
            );
            updateTask(taskId, {
              status: "downloading",
              loadedBytes: loaded,
              totalBytes: total > 0 ? total : 0,
              totalIsEstimated: responseTotal <= 0 && headerTotal > 0,
              progress: normalizePercent(loaded, total),
              speedBytes: Number(event?.rate || loaded / elapsedSeconds || 0),
            });
          },
        });

        const downloadedBytes = Number(result?.blob?.size || 0);
        saveBlobAsFile(result?.blob, result?.filename || task.fallbackFilename);
        updateTask(taskId, {
          status: "success",
          progress: 100,
          loadedBytes: downloadedBytes,
          totalBytes: downloadedBytes,
          totalIsEstimated: false,
          speedBytes: 0,
          finishedAt: Date.now(),
          resolvedFilename: result?.filename || task.fallbackFilename,
        });
        try {
          await task.onSuccess?.(result);
        } catch {
          // The file is already downloaded; a follow-up refresh must not mark it failed.
        }
      } catch (error) {
        const canceled =
          error?.name === "CanceledError" ||
          error?.name === "AbortError" ||
          error?.code === "ERR_CANCELED";
        const errorMessage = canceled
          ? null
          : task.getErrorMessage
            ? await task.getErrorMessage(error)
            : await getBlobErrorMessage(error, t("messages.downloadFailed"));
        updateTask(taskId, {
          status: canceled ? "canceled" : "failed",
          speedBytes: 0,
          finishedAt: Date.now(),
          errorMessage,
        });
        try {
          await task.onError?.(error, errorMessage);
        } catch {
          // The queue already contains the original download error.
        }
      } finally {
        controllersRef.current.delete(taskId);
      }
    },
    [t, updateTask],
  );

  useEffect(() => {
    const activeCount = tasks.filter((task) =>
      ["preparing", "downloading"].includes(task.status),
    ).length;
    if (activeCount >= MAX_CONCURRENT_DOWNLOADS) return;
    tasks
      .filter((task) => task.status === "queued")
      .slice(0, MAX_CONCURRENT_DOWNLOADS - activeCount)
      .forEach((task) => void runTask(task.id));
  }, [runTask, tasks]);

  const enqueueDownload = useCallback((input) => {
    if (typeof input?.request !== "function") return null;
    const existing = tasksRef.current.find(
      (task) =>
        input.key &&
        task.key === input.key &&
        ["queued", "preparing", "downloading"].includes(task.status),
    );
    if (existing) return existing.id;

    const task = {
      id: createTaskId(),
      key: input.key || null,
      title: input.title || input.fallbackFilename || "download",
      subtitle: input.subtitle || null,
      fallbackFilename: input.fallbackFilename || "download",
      request: input.request,
      onSuccess: input.onSuccess,
      onError: input.onError,
      getErrorMessage: input.getErrorMessage,
      status: "queued",
      loadedBytes: 0,
      totalBytes: 0,
      totalIsEstimated: false,
      progress: 0,
      speedBytes: 0,
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      resolvedFilename: null,
    };
    setTasks((current) => [task, ...current]);
    setCollapsed(false);
    return task.id;
  }, []);

  const cancelDownload = useCallback(
    (taskId) => {
      const task = tasksRef.current.find((item) => item.id === taskId);
      if (!task) return;
      if (task.status === "queued") {
        updateTask(taskId, { status: "canceled", finishedAt: Date.now() });
        return;
      }
      controllersRef.current.get(taskId)?.abort();
    },
    [updateTask],
  );

  const retryDownload = useCallback(
    (taskId) => {
      updateTask(taskId, {
        status: "queued",
        loadedBytes: 0,
        totalBytes: 0,
        totalIsEstimated: false,
        progress: 0,
        speedBytes: 0,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
      });
    },
    [updateTask],
  );

  const removeTask = useCallback((taskId) => {
    controllersRef.current.get(taskId)?.abort();
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((current) =>
      current.filter((task) =>
        ["queued", "preparing", "downloading"].includes(task.status),
      ),
    );
  }, []);

  const isDownloading = useCallback(
    (key) =>
      tasks.some(
        (task) =>
          task.key === key &&
          ["queued", "preparing", "downloading"].includes(task.status),
      ),
    [tasks],
  );

  const hasOngoingDownloads = useMemo(
    () =>
      tasks.some((task) =>
        ["queued", "preparing", "downloading"].includes(task.status),
      ),
    [tasks],
  );

  useEffect(() => {
    if (!hasOngoingDownloads) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = t("messages.beforeUnload");
      return event.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasOngoingDownloads, t]);

  const value = useMemo(
    () => ({
      tasks,
      enqueueDownload,
      cancelDownload,
      retryDownload,
      removeTask,
      clearFinished,
      isDownloading,
      hasOngoingDownloads,
    }),
    [
      cancelDownload,
      clearFinished,
      enqueueDownload,
      hasOngoingDownloads,
      isDownloading,
      removeTask,
      retryDownload,
      tasks,
    ],
  );

  const activeCount = tasks.filter((task) =>
    ["preparing", "downloading"].includes(task.status),
  ).length;
  const queuedCount = tasks.filter((task) => task.status === "queued").length;
  const statusMeta = {
    queued: { label: t("status.queued"), color: "default" },
    preparing: { label: t("status.preparing"), color: "processing" },
    downloading: { label: t("status.downloading"), color: "processing" },
    success: { label: t("status.success"), color: "success" },
    failed: { label: t("status.failed"), color: "error" },
    canceled: { label: t("status.canceled"), color: "warning" },
  };

  return (
    <DownloadQueueContext.Provider value={value}>
      {children}
      {tasks.length > 0 ? (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            width: 400,
            maxWidth: "calc(100vw - 32px)",
            zIndex: 1850,
            pointerEvents: "none",
          }}
        >
          <Card
            size="small"
            style={{
              pointerEvents: "auto",
              boxShadow: "0 10px 32px rgba(0,0,0,0.18)",
            }}
            title={
              <Space wrap size={6}>
                <Badge
                  status={hasOngoingDownloads ? "processing" : "default"}
                />
                <DownloadOutlined />
                <span>{t("title")}</span>
                <Tag>{tasks.length}</Tag>
                {activeCount ? (
                  <Tag color="processing">
                    {t("badges.downloading", { count: activeCount })}
                  </Tag>
                ) : null}
                {queuedCount ? (
                  <Tag>{t("badges.queued", { count: queuedCount })}</Tag>
                ) : null}
              </Space>
            }
            extra={
              <Button
                size="small"
                icon={<MinusOutlined />}
                aria-label={t("actions.collapse")}
                onClick={() => setCollapsed((current) => !current)}
              />
            }
            styles={{
              body: {
                display: collapsed ? "none" : "block",
                maxHeight: 420,
                overflowY: "auto",
              },
            }}
          >
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Typography.Text type="secondary">
                  {t("subtitle")}
                </Typography.Text>
                <Button
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={clearFinished}
                >
                  {t("actions.clearFinished")}
                </Button>
              </Space>
              {tasks.map((task) => {
                const meta = statusMeta[task.status] || statusMeta.queued;
                const ongoing = ["queued", "preparing", "downloading"].includes(
                  task.status,
                );
                const elapsed =
                  (task.finishedAt || Date.now()) -
                  (task.startedAt || task.createdAt);
                const hasKnownTotal = task.totalBytes > 0;
                return (
                  <Card
                    key={task.id}
                    size="small"
                    styles={{ body: { padding: 10 } }}
                  >
                    <Space
                      direction="vertical"
                      size={4}
                      style={{ width: "100%" }}
                    >
                      <Space
                        style={{
                          width: "100%",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography.Text
                          ellipsis
                          style={{ maxWidth: 240 }}
                          title={task.title}
                        >
                          {task.resolvedFilename || task.title}
                        </Typography.Text>
                        <Tag color={meta.color}>{meta.label}</Tag>
                      </Space>
                      {task.subtitle ? (
                        <Typography.Text
                          type="secondary"
                          ellipsis
                          style={{ fontSize: 12 }}
                        >
                          {task.subtitle}
                        </Typography.Text>
                      ) : null}
                      {task.status === "downloading" && hasKnownTotal ? (
                        <Progress
                          percent={task.progress}
                          size="small"
                          status="active"
                          format={(percent) =>
                            `${Number(percent || 0).toFixed(1)}%`
                          }
                        />
                      ) : ["preparing", "downloading"].includes(task.status) ? (
                        <Progress
                          percent={100}
                          size="small"
                          status="active"
                          showInfo={false}
                        />
                      ) : (
                        <Progress
                          percent={
                            task.status === "success" ? 100 : task.progress
                          }
                          size="small"
                          status={
                            task.status === "failed"
                              ? "exception"
                              : task.status === "success"
                                ? "success"
                                : "normal"
                          }
                          showInfo={task.status !== "queued"}
                        />
                      )}
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12 }}
                      >
                        {task.status === "preparing"
                          ? t("fields.preparing")
                          : hasKnownTotal
                            ? t(
                                task.totalIsEstimated
                                  ? "fields.progressEstimated"
                                  : "fields.progressKnown",
                                {
                                  downloaded: formatBytes(task.loadedBytes),
                                  total: formatBytes(task.totalBytes),
                                },
                              )
                            : t("fields.progressUnknown", {
                                downloaded: formatBytes(task.loadedBytes),
                              })}
                        {task.status === "downloading" && task.speedBytes > 0
                          ? ` • ${formatBytes(task.speedBytes)}/s`
                          : ""}
                        {task.startedAt ? ` • ${formatDuration(elapsed)}` : ""}
                      </Typography.Text>
                      {task.errorMessage ? (
                        <Typography.Text type="danger" style={{ fontSize: 12 }}>
                          {task.errorMessage}
                        </Typography.Text>
                      ) : null}
                      <Space
                        style={{ width: "100%", justifyContent: "flex-end" }}
                      >
                        {["failed", "canceled"].includes(task.status) ? (
                          <Button
                            size="small"
                            icon={<RedoOutlined />}
                            onClick={() => retryDownload(task.id)}
                          >
                            {t("actions.retry")}
                          </Button>
                        ) : null}
                        {ongoing ? (
                          <Button
                            size="small"
                            danger
                            icon={<CloseOutlined />}
                            onClick={() => cancelDownload(task.id)}
                          >
                            {t("actions.cancel")}
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => removeTask(task.id)}
                          >
                            {t("actions.remove")}
                          </Button>
                        )}
                      </Space>
                    </Space>
                  </Card>
                );
              })}
            </Space>
          </Card>
        </div>
      ) : null}
    </DownloadQueueContext.Provider>
  );
}

export const useDownloadQueue = () => {
  const context = useContext(DownloadQueueContext);
  if (!context) {
    throw new Error(
      "useDownloadQueue must be used within DownloadQueueProvider",
    );
  }
  return context;
};
