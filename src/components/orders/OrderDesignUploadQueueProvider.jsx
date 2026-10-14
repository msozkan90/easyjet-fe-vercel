"use client";
import { uploadIdempotencyKey } from "@/utils/uploadIdempotency";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { OrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { uploadFileDirectMultipart } from "@/utils/directMultipartUpload";
import UploadQueuePanel, {
  formatBytes,
  normalizeProgressPercent,
} from "@/components/uploads/UploadQueuePanel";

const MAX_CONCURRENT_UPLOADS = 2;

const OrderDesignUploadQueueContext = createContext(null);

const createTaskId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
      const uploadSessionIds = [];

      updateTask(taskId, {
        status: "uploading",
        serverStatus: "preparing",
        progress: 0,
        preparationProgress: 0,
        uploadedBytes: 0,
        uploadTotalBytes: currentTask.totalSize,
        uploadSpeed: 0,
        uploadSessionIds: [],
        startedAt: Date.now(),
        errorMessage: null,
      });

      try {
        let completedBytes = 0;
        const completedPartsBySession = [];
        for (const entry of currentTask.files) {
          const result = await uploadFileDirectMultipart({
            file: entry.file,
            signal: controller.signal,
            initUpload: () =>
              OrdersAPI.initDirectDesignUpload({
                order_id: currentTask.orderId,
                order_item_id: currentTask.orderItemId,
                position_id: entry.positionId,
                client_id: entry.clientId,
                idempotency_key: uploadIdempotencyKey(
                  currentTask.id,
                  completedPartsBySession.length,
                ),
                file_name: entry.file.name || "untitled",
                file_size: entry.file.size,
                content_type: entry.file.type || "application/octet-stream",
              }),
            getPartUrls: (sessionId, partNumbers) =>
              OrdersAPI.directDesignUploadPartUrls({
                upload_session_id: sessionId,
                part_numbers: partNumbers,
              }),
            onSession: (sessionId) => {
              uploadSessionIds.push(sessionId);
              updateTask(taskId, {
                uploadSessionIds: [...uploadSessionIds],
                serverStatus: "uploading",
                preparationProgress: 100,
              });
            },
            onProgress: ({ loaded, bytesPerSecond }) => {
              const aggregate = completedBytes + loaded;
              updateTask(taskId, {
                serverStatus: "uploading",
                progress: normalizeProgressPercent(
                  (aggregate / currentTask.totalSize) * 100,
                ),
                preparationProgress: 100,
                uploadedBytes: aggregate,
                uploadTotalBytes: currentTask.totalSize,
                uploadSpeed: bytesPerSecond,
              });
            },
          });
          completedBytes += entry.file.size;
          completedPartsBySession.push(result);
        }
        updateTask(taskId, { serverStatus: "saving", uploadSpeed: 0 });
        await OrdersAPI.completeDirectDesignUpload({
          order_id: currentTask.orderId,
          order_item_id: currentTask.orderItemId,
          upload_session_ids: completedPartsBySession.map(
            (entry) => entry.uploadSessionId,
          ),
          note: currentTask.note || "",
          is_sub_category: Boolean(currentTask.isSubCategory),
          ...(currentTask.includeRoutingSubCategory
            ? {
                routing_sub_category_id:
                  currentTask.routingSubCategoryId || null,
              }
            : {}),
          positions: currentTask.positions,
          design_entries: currentTask.files.map(
            ({ clientId, groupId, positionId, quantity }) => ({
              client_id: clientId,
              group_id: groupId,
              position_id: positionId,
              quantity,
            }),
          ),
        });
        updateTask(taskId, {
          status: "success",
          serverStatus: "completed",
          progress: 100,
          preparationProgress: 100,
          uploadedBytes: currentTask.totalSize,
          uploadTotalBytes: currentTask.totalSize,
          uploadSpeed: 0,
          finishedAt: Date.now(),
          errorMessage: null,
        });
      } catch (error) {
        const canceled =
          error?.name === "CanceledError" || error?.code === "ERR_CANCELED";
        if (!canceled && uploadSessionIds.length) {
          try {
            const progressRows = await Promise.all(
              uploadSessionIds.map(async (uploadSessionId) => {
                const response =
                  await OrdersAPI.designUploadProgress(uploadSessionId);
                return response?.data || response;
              }),
            );
            if (progressRows.every((row) => row?.status === "completed")) {
              updateTask(taskId, {
                status: "success",
                serverStatus: "completed",
                progress: 100,
                preparationProgress: 100,
                uploadedBytes: currentTask.totalSize,
                uploadTotalBytes: currentTask.totalSize,
                uploadSpeed: 0,
                finishedAt: Date.now(),
                errorMessage: null,
              });
              return;
            }
          } catch {
            // Fall through to cleanup and the original error.
          }
        }
        await Promise.all(
          uploadSessionIds.map((uploadSessionId) =>
            OrdersAPI.abortDirectDesignUpload({
              upload_session_id: uploadSessionId,
            }).catch(() => undefined),
          ),
        );
        updateTask(taskId, {
          status: canceled ? "canceled" : "failed",
          serverStatus: canceled ? "canceled" : "failed",
          finishedAt: Date.now(),
          uploadSpeed: 0,
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

      const totalSize = normalizedFiles.reduce(
        (sum, entry) => sum + Number(entry.file?.size || 0),
        0,
      );
      const uploadTotalBytes = totalSize;

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
        totalSize,
        fileName: normalizedFiles[0]?.file?.name || "untitled",
        status: "queued",
        serverStatus: null,
        progress: 0,
        preparationProgress: 0,
        uploadedBytes: 0,
        uploadTotalBytes,
        uploadSpeed: 0,
        uploadSessionIds: [],
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
    async (taskId) => {
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
        await Promise.all(
          (task.uploadSessionIds || []).map((uploadSessionId) =>
            OrdersAPI.abortDirectDesignUpload({
              upload_session_id: uploadSessionId,
            }).catch(() => undefined),
          ),
        );
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
        id: createTaskId(),
        status: "queued",
        serverStatus: null,
        progress: 0,
        preparationProgress: 0,
        uploadedBytes: 0,
        uploadTotalBytes: task.uploadTotalBytes || task.totalSize,
        uploadSpeed: 0,
        uploadSessionIds: [],
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

  return (
    <OrderDesignUploadQueueContext.Provider value={value}>
      {children}
      <UploadQueuePanel
        tasks={tasks}
        tQueue={tQueue}
        zIndex={1820}
        hasOngoingUploads={hasOngoingUploads}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onClearFinished={clearFinished}
        onRetry={retryUpload}
        onCancel={cancelUpload}
        onRemove={removeTask}
        getTitle={(task) =>
          task.fileCount > 1
            ? tQueue("fields.multipleFiles", {
                name: task.fileName,
                count: task.fileCount - 1,
              })
            : task.fileName
        }
        renderMeta={(task) => (
          <>
            {tQueue("fields.order")}: {task.orderNumber} •{" "}
            {tQueue("fields.fileCount", { count: task.fileCount })}{" "}
            {task.unitCount !== task.fileCount
              ? `• ${tQueue("fields.unitCount", { count: task.unitCount })} `
              : ""}
            • {formatBytes(task.totalSize)}
          </>
        )}
        getTotalBytes={(task) => task.totalSize}
      />
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
