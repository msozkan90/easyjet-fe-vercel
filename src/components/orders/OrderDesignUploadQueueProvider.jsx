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
  MinusOutlined,
  RedoOutlined,
} from "@ant-design/icons";
import { OrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";

const MAX_CONCURRENT_UPLOADS = 3;
const DEFAULT_POLL_INTERVAL_MS = 3000;
const PENDING_POLL_INTERVAL_MS = 4000;
const SAVING_POLL_INTERVAL_MS = 2000;

const OrderDesignUploadQueueContext = createContext(null);

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

const extractProgressData = (response) => {
  if (response?.data && typeof response.data === "object") {
    return response.data;
  }
  return response;
};

export function OrderDesignUploadQueueProvider({ children }) {
  const tQueue = useTranslations("dashboard.orders.design.uploadQueue");
  const [tasks, setTasks] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const controllersRef = useRef(new Map());
  const tasksRef = useRef(tasks);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const updateTask = useCallback((taskId, patch) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    );
  }, []);

  const runTask = useCallback(
    async (taskId) => {
      const currentTask = tasksRef.current.find((task) => task.id === taskId);
      if (!currentTask || currentTask.status !== "queued") return;

      const controller = new AbortController();
      controllersRef.current.set(taskId, controller);
      let pollStopped = false;
      let progressTimer = null;
      let lastServerStatus = "pending";

      updateTask(taskId, {
        status: "uploading",
        serverStatus: "pending",
        progress: currentTask.progress || 0,
        startedAt: Date.now(),
        errorMessage: null,
      });

      try {
        const formData = new FormData();
        formData.append("order_item_id", currentTask.orderItemId);
        formData.append("order_id", currentTask.orderId);
        formData.append("upload_id", currentTask.id);
        formData.append("note", currentTask.note || "");
        formData.append(
          "is_sub_category",
          String(Boolean(currentTask.isSubCategory)),
        );
        if (currentTask.includeRoutingSubCategory) {
          formData.append(
            "routing_sub_category_id",
            currentTask.routingSubCategoryId || "",
          );
        }
        currentTask.positions.forEach((positionId) => {
          formData.append("positions", positionId);
        });
        formData.append(
          "design_entries",
          JSON.stringify(
            currentTask.files.map(
              ({ clientId, groupId, positionId, quantity }) => ({
                client_id: clientId,
                group_id: groupId,
                position_id: positionId,
                quantity,
              }),
            ),
          ),
        );
        currentTask.files.forEach(({ clientId, file }) => {
          formData.append(`design_files[${clientId}]`, file);
        });

        const pollProgress = async () => {
          if (pollStopped) return;
          try {
            const response = await OrdersAPI.designUploadProgress(
              currentTask.id,
            );
            const progressData = extractProgressData(response);
            const serverStatus =
              typeof progressData?.status === "string"
                ? progressData.status
                : "pending";
            const serverPercent = Number(progressData?.progress_percent);
            lastServerStatus = serverStatus;

            if (serverStatus === "saving") {
              updateTask(taskId, { serverStatus: "saving", progress: 99 });
              return;
            }

            if (
              serverStatus === "uploading" &&
              Number.isFinite(serverPercent)
            ) {
              const mappedPercent = Math.max(
                90,
                Math.min(98, Math.round(90 + serverPercent * 0.08)),
              );
              const snapshot = tasksRef.current.find(
                (task) => task.id === taskId,
              );
              updateTask(taskId, {
                serverStatus: "uploading",
                progress: Math.max(
                  Number(snapshot?.progress || 0),
                  mappedPercent,
                ),
              });
              return;
            }

            if (serverStatus === "failed") {
              const serverError = progressData?.error_message;
              if (serverError) {
                updateTask(taskId, { errorMessage: serverError });
              }
            }
          } catch {
            // The progress record is created after the multipart body reaches the API.
          }
        };

        const scheduleNextPoll = () => {
          if (pollStopped) return;
          const delay =
            lastServerStatus === "pending"
              ? PENDING_POLL_INTERVAL_MS
              : lastServerStatus === "saving"
                ? SAVING_POLL_INTERVAL_MS
                : DEFAULT_POLL_INTERVAL_MS;
          progressTimer = setTimeout(async () => {
            await pollProgress();
            scheduleNextPoll();
          }, delay);
        };

        void pollProgress();
        scheduleNextPoll();

        await OrdersAPI.saveDesign(formData, {
          signal: controller.signal,
          onUploadProgress: (event) => {
            const total = Number(event?.total || currentTask.totalSize || 0);
            const loaded = Number(event?.loaded || 0);
            if (!total || !Number.isFinite(total) || total <= 0) return;
            const snapshot = tasksRef.current.find(
              (task) => task.id === taskId,
            );
            if (snapshot?.serverStatus !== "pending") return;
            updateTask(taskId, {
              serverStatus: loaded >= total ? "uploading" : "pending",
              progress: Math.max(
                Number(snapshot?.progress || 0),
                Math.max(1, Math.min(90, Math.round((loaded / total) * 90))),
              ),
            });
          },
        });

        pollStopped = true;
        if (progressTimer) clearTimeout(progressTimer);
        updateTask(taskId, {
          status: "success",
          serverStatus: "completed",
          progress: 100,
          finishedAt: Date.now(),
          errorMessage: null,
        });
      } catch (error) {
        pollStopped = true;
        if (progressTimer) clearTimeout(progressTimer);
        const canceled =
          error?.name === "CanceledError" || error?.code === "ERR_CANCELED";
        updateTask(taskId, {
          status: canceled ? "canceled" : "failed",
          serverStatus: canceled ? "canceled" : "failed",
          finishedAt: Date.now(),
          errorMessage: canceled
            ? null
            : error?.response?.data?.error?.message ||
              error?.message ||
              tQueue("messages.uploadFailed"),
        });
      } finally {
        controllersRef.current.delete(taskId);
      }
    },
    [tQueue, updateTask],
  );

  useEffect(() => {
    const activeCount = tasks.filter(
      (task) => task.status === "uploading",
    ).length;
    if (activeCount >= MAX_CONCURRENT_UPLOADS) return;
    tasks
      .filter((task) => task.status === "queued")
      .slice(0, MAX_CONCURRENT_UPLOADS - activeCount)
      .forEach((task) => void runTask(task.id));
  }, [runTask, tasks]);

  const enqueueUpload = useCallback(
    ({
      orderId,
      orderItemId,
      orderNumber,
      note,
      isSubCategory,
      includeRoutingSubCategory,
      routingSubCategoryId,
      positions,
      files,
    }) => {
      const normalizedFiles = Array.from(files || [])
        .map((entry) => ({
          clientId: String(entry?.clientId || entry?.positionId || ""),
          groupId: String(
            entry?.groupId || entry?.clientId || entry?.positionId || "",
          ),
          positionId: String(entry?.positionId || ""),
          positionName: entry?.positionName || "-",
          quantity: Math.max(1, Number.parseInt(entry?.quantity || 1, 10) || 1),
          file: entry?.file instanceof File ? entry.file : null,
        }))
        .filter(
          (entry) =>
            entry.clientId &&
            entry.groupId &&
            entry.positionId &&
            entry.file instanceof File,
        );
      if (!normalizedFiles.length) return null;

      const task = {
        id: createTaskId(),
        orderId: String(orderId),
        orderItemId: String(orderItemId),
        orderNumber: orderNumber || "-",
        note: note || "",
        isSubCategory: Boolean(isSubCategory),
        includeRoutingSubCategory: Boolean(includeRoutingSubCategory),
        routingSubCategoryId: routingSubCategoryId
          ? String(routingSubCategoryId)
          : null,
        positions: Array.from(
          new Set(
            Array.from(
              Array.isArray(positions) && positions.length
                ? positions
                : normalizedFiles.map((entry) => entry.positionId),
            ).map(String),
          ),
        ),
        files: normalizedFiles,
        fileCount: normalizedFiles.length,
        unitCount: normalizedFiles.reduce(
          (sum, entry) => sum + entry.quantity,
          0,
        ),
        totalSize: normalizedFiles.reduce(
          (sum, entry) => sum + Number(entry.file?.size || 0),
          0,
        ),
        fileName: normalizedFiles[0]?.file?.name || "untitled",
        status: "queued",
        serverStatus: null,
        progress: 0,
        createdAt: Date.now(),
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
      };

      setTasks((prev) => [task, ...prev]);
      setCollapsed(false);
      return task.id;
    },
    [],
  );

  const cancelUpload = useCallback(
    (taskId) => {
      const task = tasksRef.current.find((item) => item.id === taskId);
      if (!task) return;
      if (task.status === "queued") {
        updateTask(taskId, {
          status: "canceled",
          serverStatus: "canceled",
          finishedAt: Date.now(),
        });
        return;
      }
      if (task.status === "uploading") {
        controllersRef.current.get(taskId)?.abort();
      }
    },
    [updateTask],
  );

  const retryUpload = useCallback(
    (taskId) => {
      const task = tasksRef.current.find((item) => item.id === taskId);
      if (!task || !["failed", "canceled"].includes(task.status)) return;
      updateTask(taskId, {
        status: "queued",
        serverStatus: null,
        progress: 0,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
      });
    },
    [updateTask],
  );

  const removeTask = useCallback((taskId) => {
    const task = tasksRef.current.find((item) => item.id === taskId);
    if (task?.status === "uploading") {
      controllersRef.current.get(taskId)?.abort();
    }
    setTasks((prev) => prev.filter((item) => item.id !== taskId));
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((prev) =>
      prev.filter((task) => ["queued", "uploading"].includes(task.status)),
    );
  }, []);

  const hasOngoingUploads = useMemo(
    () => tasks.some((task) => ["queued", "uploading"].includes(task.status)),
    [tasks],
  );

  useEffect(() => {
    if (!hasOngoingUploads) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = tQueue("messages.beforeUnload");
      return event.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasOngoingUploads, tQueue]);

  const value = useMemo(
    () => ({
      tasks,
      enqueueUpload,
      cancelUpload,
      retryUpload,
      removeTask,
      clearFinished,
      hasOngoingUploads,
    }),
    [
      cancelUpload,
      clearFinished,
      enqueueUpload,
      hasOngoingUploads,
      removeTask,
      retryUpload,
      tasks,
    ],
  );

  const queuedCount = tasks.filter((task) => task.status === "queued").length;
  const uploadingCount = tasks.filter(
    (task) => task.status === "uploading",
  ).length;
  const statusMeta = {
    queued: { label: tQueue("status.queued"), color: "default" },
    uploading: { label: tQueue("status.uploading"), color: "processing" },
    preparing: { label: tQueue("status.preparing"), color: "processing" },
    saving: { label: tQueue("status.saving"), color: "processing" },
    success: { label: tQueue("status.success"), color: "success" },
    failed: { label: tQueue("status.failed"), color: "error" },
    canceled: { label: tQueue("status.canceled"), color: "warning" },
  };

  return (
    <OrderDesignUploadQueueContext.Provider value={value}>
      {children}
      {tasks.length > 0 ? (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            width: 380,
            zIndex: 1820,
            pointerEvents: "none",
          }}
        >
          <Card
            size="small"
            style={{
              pointerEvents: "auto",
              boxShadow: "0 10px 32px rgba(0,0,0,0.16)",
            }}
            title={
              <Space>
                <Badge status={hasOngoingUploads ? "processing" : "default"} />
                <span>{tQueue("title")}</span>
                <Tag>{tasks.length}</Tag>
                {uploadingCount ? (
                  <Tag color="processing">
                    {tQueue("badges.uploading", { count: uploadingCount })}
                  </Tag>
                ) : null}
                {queuedCount ? (
                  <Tag>{tQueue("badges.queued", { count: queuedCount })}</Tag>
                ) : null}
              </Space>
            }
            extra={
              <Button
                size="small"
                icon={<MinusOutlined />}
                onClick={() => setCollapsed((prev) => !prev)}
              />
            }
            bodyStyle={{
              display: collapsed ? "none" : "block",
              maxHeight: 340,
              overflowY: "auto",
            }}
          >
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Typography.Text type="secondary">
                  {tQueue("subtitle")}
                </Typography.Text>
                <Button
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={clearFinished}
                >
                  {tQueue("actions.clearFinished")}
                </Button>
              </Space>
              {tasks.map((task) => {
                const isPreparing =
                  task.status === "uploading" &&
                  task.serverStatus === "pending";
                const isSaving =
                  task.status === "uploading" && task.serverStatus === "saving";
                const meta = isPreparing
                  ? statusMeta.preparing
                  : isSaving
                    ? statusMeta.saving
                    : statusMeta[task.status] || statusMeta.queued;
                const canCancel =
                  task.status === "queued" ||
                  (task.status === "uploading" &&
                    task.serverStatus === "pending");
                const canRetry = ["failed", "canceled"].includes(task.status);
                const canRemove = ["success", "failed", "canceled"].includes(
                  task.status,
                );
                const filename =
                  task.fileCount > 1
                    ? tQueue("fields.multipleFiles", {
                        name: task.fileName,
                        count: task.fileCount - 1,
                      })
                    : task.fileName;

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
                        <Typography.Text ellipsis style={{ maxWidth: 210 }}>
                          {filename}
                        </Typography.Text>
                        <Tag color={meta.color}>{meta.label}</Tag>
                      </Space>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12 }}
                      >
                        {tQueue("fields.order")}: {task.orderNumber} •{" "}
                        {tQueue("fields.fileCount", { count: task.fileCount })}{" "}
                        {task.unitCount !== task.fileCount
                          ? `• ${tQueue("fields.unitCount", { count: task.unitCount })} `
                          : ""}
                        • {formatBytes(task.totalSize)}
                      </Typography.Text>
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
                      />
                      {task.errorMessage ? (
                        <Typography.Text type="danger" style={{ fontSize: 12 }}>
                          {task.errorMessage}
                        </Typography.Text>
                      ) : null}
                      <Space
                        style={{ width: "100%", justifyContent: "flex-end" }}
                      >
                        {canRetry ? (
                          <Button
                            size="small"
                            icon={<RedoOutlined />}
                            onClick={() => retryUpload(task.id)}
                          >
                            {tQueue("actions.retry")}
                          </Button>
                        ) : null}
                        {canCancel ? (
                          <Button
                            size="small"
                            danger
                            icon={<CloseOutlined />}
                            onClick={() => cancelUpload(task.id)}
                          >
                            {tQueue("actions.cancel")}
                          </Button>
                        ) : null}
                        {canRemove ? (
                          <Button
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => removeTask(task.id)}
                          >
                            {tQueue("actions.remove")}
                          </Button>
                        ) : null}
                      </Space>
                    </Space>
                  </Card>
                );
              })}
            </Space>
          </Card>
        </div>
      ) : null}
    </OrderDesignUploadQueueContext.Provider>
  );
}

export const useOrderDesignUploadQueue = () => {
  const context = useContext(OrderDesignUploadQueueContext);
  if (!context) {
    throw new Error(
      "useOrderDesignUploadQueue must be used within OrderDesignUploadQueueProvider",
    );
  }
  return context;
};
