"use client";
import { uploadIdempotencyKey } from "@/utils/uploadIdempotency";

import axios from "axios";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TransferOrdersAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import UploadQueuePanel, {
  formatBytes,
  normalizeProgressPercent,
} from "@/components/uploads/UploadQueuePanel";

const MAX_CONCURRENT_UPLOADS = 3;
const PART_UPLOAD_CONCURRENCY = 4;
const PART_UPLOAD_RETRY_COUNT = 3;

const TransferDesignUploadQueueContext = createContext(null);

const createTaskId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function TransferDesignUploadQueueProvider({ children }) {
  const tQueue = useTranslations("dashboard.orders.transferUploadQueue");
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
      const currentTask = tasksRef.current.find((item) => item.id === taskId);
      if (!currentTask || currentTask.status !== "queued") return;

      const controller = new AbortController();
      controllersRef.current.set(taskId, controller);
      updateTask(taskId, {
        status: "uploading",
        serverStatus: "preparing",
        startedAt: Date.now(),
        progress: 0,
        preparationProgress: 0,
        uploadedBytes: 0,
        uploadTotalBytes: currentTask.fileSize,
        errorMessage: null,
      });

      try {
        const initResponse = await TransferOrdersAPI.initDesignUpload({
          transfer_order_id: currentTask.orderId,
          sub_category_id: currentTask.subCategoryId,
          quantity: Number(currentTask.quantity || 1),
          file_name: currentTask.fileName,
          idempotency_key: uploadIdempotencyKey(currentTask.id),
          file_size: Number(
            currentTask.fileSize || currentTask.file?.size || 0,
          ),
          content_type: currentTask.file?.type || undefined,
        });

        const initData =
          initResponse?.data && typeof initResponse.data === "object"
            ? initResponse.data
            : initResponse;
        const uploadSessionId = String(initData?.upload_session_id || "");
        const partSize = Number(initData?.part_size || 0);
        const totalParts = Number(initData?.total_parts || 0);
        if (!uploadSessionId || !partSize || !totalParts) {
          throw new Error(tQueue("messages.uploadFailed"));
        }

        updateTask(taskId, {
          uploadSessionId,
          serverStatus: "preparing",
          progress: 50,
          preparationProgress: 50,
        });

        const partNumbers = Array.from(
          { length: totalParts },
          (_, index) => index + 1,
        );
        const partUrlsResponse = await TransferOrdersAPI.designUploadPartUrls({
          upload_session_id: uploadSessionId,
          part_numbers: partNumbers,
        });
        const partUrlsData =
          partUrlsResponse?.data && typeof partUrlsResponse.data === "object"
            ? partUrlsResponse.data
            : partUrlsResponse;
        const urlEntries = Array.isArray(partUrlsData?.urls)
          ? partUrlsData.urls
          : [];
        const urlMap = new Map(
          urlEntries.map((entry) => [
            Number(entry?.part_number),
            String(entry?.url || ""),
          ]),
        );
        if (urlMap.size !== totalParts) {
          throw new Error(tQueue("messages.uploadFailed"));
        }

        updateTask(taskId, {
          serverStatus: "uploading",
          progress: 0,
          preparationProgress: 100,
          uploadedBytes: 0,
          uploadTotalBytes: currentTask.fileSize,
        });

        const loadedByPart = new Map();
        const reportAggregateProgress = () => {
          const loadedTotal = Array.from(loadedByPart.values()).reduce(
            (sum, value) => sum + Number(value || 0),
            0,
          );
          const totalSize = Math.max(
            1,
            Number(currentTask.fileSize || currentTask.file?.size || 0),
          );
          updateTask(taskId, {
            serverStatus: "uploading",
            progress: normalizeProgressPercent((loadedTotal / totalSize) * 100),
            uploadedBytes: Math.min(loadedTotal, totalSize),
            uploadTotalBytes: totalSize,
          });
        };

        const uploadPart = async (partNumber) => {
          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, currentTask.file.size);
          const blob = currentTask.file.slice(start, end);
          const signedUrl = urlMap.get(partNumber);
          if (!signedUrl) {
            throw new Error(`Missing signed URL for part ${partNumber}`);
          }

          let lastError = null;
          for (
            let attempt = 1;
            attempt <= PART_UPLOAD_RETRY_COUNT;
            attempt += 1
          ) {
            try {
              loadedByPart.set(partNumber, 0);
              const response = await axios.put(signedUrl, blob, {
                headers: {
                  "Content-Type":
                    currentTask.file?.type || "application/octet-stream",
                },
                signal: controller.signal,
                onUploadProgress: (event) => {
                  loadedByPart.set(partNumber, Number(event?.loaded || 0));
                  reportAggregateProgress();
                },
              });
              loadedByPart.set(partNumber, blob.size);
              reportAggregateProgress();
              const etag =
                response?.headers?.etag ||
                response?.headers?.ETag ||
                response?.headers?.["etag"] ||
                response?.headers?.["ETag"];
              return {
                part_number: partNumber,
                etag: etag ? String(etag) : "__missing__",
              };
            } catch (error) {
              lastError = error;
              if (
                error?.name === "CanceledError" ||
                error?.code === "ERR_CANCELED"
              ) {
                throw error;
              }
              if (attempt >= PART_UPLOAD_RETRY_COUNT) {
                throw error;
              }
            }
          }
          throw lastError || new Error(`Failed to upload part ${partNumber}`);
        };

        const parts = [];
        const queue = [...partNumbers];
        const workers = Array.from(
          { length: Math.min(PART_UPLOAD_CONCURRENCY, queue.length) },
          async () => {
            while (queue.length) {
              const nextPartNumber = queue.shift();
              if (!nextPartNumber) return;
              const part = await uploadPart(nextPartNumber);
              parts.push(part);
            }
          },
        );
        await Promise.all(workers);

        updateTask(taskId, {
          serverStatus: "saving",
          progress: 100,
          preparationProgress: 100,
          uploadedBytes: currentTask.fileSize,
          uploadTotalBytes: currentTask.fileSize,
        });

        await TransferOrdersAPI.completeDesignUpload({
          upload_session_id: uploadSessionId,
          parts: parts.sort(
            (left, right) => left.part_number - right.part_number,
          ),
        });

        updateTask(taskId, {
          status: "success",
          progress: 100,
          preparationProgress: 100,
          uploadedBytes: currentTask.fileSize,
          uploadTotalBytes: currentTask.fileSize,
          finishedAt: Date.now(),
          errorMessage: null,
          serverStatus: "completed",
        });
      } catch (error) {
        const canceled =
          error?.name === "CanceledError" || error?.code === "ERR_CANCELED";
        const taskSnapshot = tasksRef.current.find(
          (item) => item.id === taskId,
        );
        const uploadSessionId = taskSnapshot?.uploadSessionId;
        if (canceled && uploadSessionId) {
          await TransferOrdersAPI.abortDesignUpload({
            upload_session_id: uploadSessionId,
          }).catch(() => {});
        }
        updateTask(taskId, {
          status: canceled ? "canceled" : "failed",
          finishedAt: Date.now(),
          errorMessage: canceled
            ? null
            : error?.response?.data?.error?.message ||
              error?.message ||
              tQueue("messages.uploadFailed"),
          serverStatus: canceled ? "canceled" : "failed",
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

    const queued = tasks
      .filter((task) => task.status === "queued")
      .slice(0, MAX_CONCURRENT_UPLOADS - activeCount);

    queued.forEach((task) => {
      void runTask(task.id);
    });
  }, [runTask, tasks]);

  const enqueueUploads = useCallback(
    ({ orderId, orderNumber, subCategoryId, files }) => {
      const nextFiles = Array.from(files || [])
        .map((entry) =>
          entry instanceof File
            ? { file: entry, quantity: 1 }
            : {
                file: entry?.file instanceof File ? entry.file : null,
                quantity: Number.parseInt(entry?.quantity || 1, 10) || 1,
              },
        )
        .filter((entry) => entry.file instanceof File);
      if (!nextFiles.length) return [];

      const now = Date.now();
      const newTasks = nextFiles.map(({ file, quantity }) => ({
        id: createTaskId(),
        orderId: String(orderId),
        orderNumber: orderNumber || "-",
        subCategoryId: String(subCategoryId),
        file,
        quantity,
        fileName: file.name || "untitled",
        fileSize: file.size || 0,
        status: "queued",
        progress: 0,
        preparationProgress: 0,
        uploadedBytes: 0,
        uploadTotalBytes: file.size || 0,
        createdAt: now,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
        serverStatus: null,
        uploadSessionId: null,
      }));

      setTasks((prev) => [...newTasks, ...prev]);
      setCollapsed(false);
      return newTasks.map((task) => task.id);
    },
    [],
  );

  const cancelUpload = useCallback(
    (taskId) => {
      const currentTask = tasksRef.current.find((task) => task.id === taskId);
      if (!currentTask) return;

      if (currentTask.status === "queued") {
        updateTask(taskId, { status: "canceled", finishedAt: Date.now() });
        return;
      }

      if (currentTask.status === "uploading") {
        const controller = controllersRef.current.get(taskId);
        if (controller) controller.abort();
      }
    },
    [updateTask],
  );

  const retryUpload = useCallback(
    (taskId) => {
      const currentTask = tasksRef.current.find((task) => task.id === taskId);
      if (
        !currentTask ||
        (currentTask.status !== "failed" && currentTask.status !== "canceled")
      ) {
        return;
      }
      updateTask(taskId, {
        status: "queued",
        id: createTaskId(),
        progress: 0,
        preparationProgress: 0,
        uploadedBytes: 0,
        uploadTotalBytes: currentTask.fileSize,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
        serverStatus: null,
        uploadSessionId: null,
      });
    },
    [updateTask],
  );

  const removeTask = useCallback((taskId) => {
    const currentTask = tasksRef.current.find((task) => task.id === taskId);
    if (!currentTask) return;
    if (currentTask.status === "uploading") {
      const controller = controllersRef.current.get(taskId);
      if (controller) controller.abort();
    }
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((prev) =>
      prev.filter(
        (task) => task.status === "queued" || task.status === "uploading",
      ),
    );
  }, []);

  const hasOngoingUploads = useMemo(
    () =>
      tasks.some(
        (task) => task.status === "queued" || task.status === "uploading",
      ),
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
  }, [hasOngoingUploads]);

  const value = useMemo(
    () => ({
      tasks,
      enqueueUploads,
      cancelUpload,
      retryUpload,
      removeTask,
      clearFinished,
      hasOngoingUploads,
    }),
    [
      cancelUpload,
      clearFinished,
      enqueueUploads,
      hasOngoingUploads,
      removeTask,
      retryUpload,
      tasks,
    ],
  );

  return (
    <TransferDesignUploadQueueContext.Provider value={value}>
      {children}
      <UploadQueuePanel
        tasks={tasks}
        tQueue={tQueue}
        zIndex={1800}
        hasOngoingUploads={hasOngoingUploads}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onClearFinished={clearFinished}
        onRetry={retryUpload}
        onCancel={cancelUpload}
        onRemove={removeTask}
        renderMeta={(task) => (
          <>
            {tQueue("fields.order")}: {task.orderNumber} •{" "}
            {tQueue("fields.quantity")}: {task.quantity || 1} •{" "}
            {formatBytes(task.fileSize)}
          </>
        )}
        preparingStatuses={["preparing"]}
      />
    </TransferDesignUploadQueueContext.Provider>
  );
}

export const useTransferDesignUploadQueue = () => {
  const context = useContext(TransferDesignUploadQueueContext);
  if (!context) {
    throw new Error(
      "useTransferDesignUploadQueue must be used within TransferDesignUploadQueueProvider",
    );
  }
  return context;
};
