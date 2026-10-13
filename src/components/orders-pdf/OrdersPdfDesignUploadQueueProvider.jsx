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
import { OrdersDesignFlawsAPI, OrdersPdfAPI } from "@/utils/api";
import { useTranslations } from "@/i18n/use-translations";
import { uploadFileDirectMultipart } from "@/utils/directMultipartUpload";
import UploadQueuePanel, {
  formatBytes,
  normalizeProgressPercent,
} from "@/components/uploads/UploadQueuePanel";

const MAX_CONCURRENT_UPLOADS = 3;

const OrdersPdfDesignUploadQueueContext = createContext(null);

const createTaskId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function OrdersPdfDesignUploadQueueProvider({ children }) {
  const tQueue = useTranslations("dashboard.orders.ordersPdf.uploadQueue");
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
      let uploadSessionId = null;
      updateTask(taskId, {
        status: "uploading",
        serverStatus: "preparing",
        startedAt: Date.now(),
        progress: 0,
        preparationProgress: 0,
        uploadedBytes: 0,
        uploadTotalBytes: currentTask.fileSize,
        uploadSpeed: 0,
        errorMessage: null,
      });

      try {
        const uploadApi =
          currentTask.kind === "designFlaw"
            ? OrdersDesignFlawsAPI
            : OrdersPdfAPI;
        const { parts } = await uploadFileDirectMultipart({
          file: currentTask.file,
          signal: controller.signal,
          initUpload: () =>
            uploadApi.initDesignUpload({
              [currentTask.kind === "designFlaw"
                ? "orders_design_flaw_id"
                : "orders_pdf_id"]: currentTask.parentId,
              file_name: currentTask.fileName,
              idempotency_key: uploadIdempotencyKey(currentTask.id),
              file_size: currentTask.fileSize,
              content_type:
                currentTask.file?.type || "application/octet-stream",
            }),
          getPartUrls: (sessionId, partNumbers) =>
            uploadApi.designUploadPartUrls({
              upload_session_id: sessionId,
              part_numbers: partNumbers,
            }),
          onSession: (sessionId) => {
            uploadSessionId = sessionId;
            updateTask(taskId, {
              uploadSessionId: sessionId,
              serverStatus: "uploading",
              preparationProgress: 100,
            });
          },
          onProgress: ({ loaded, total, bytesPerSecond }) =>
            updateTask(taskId, {
              serverStatus: "uploading",
              progress: normalizeProgressPercent((loaded / total) * 100),
              preparationProgress: 100,
              uploadedBytes: loaded,
              uploadTotalBytes: total,
              uploadSpeed: bytesPerSecond,
            }),
        });
        updateTask(taskId, { serverStatus: "saving", uploadSpeed: 0 });
        await uploadApi.completeDesignUpload({
          upload_session_id: uploadSessionId,
          parts,
        });
        updateTask(taskId, {
          status: "success",
          serverStatus: "completed",
          progress: 100,
          preparationProgress: 100,
          uploadedBytes: currentTask.fileSize,
          uploadTotalBytes: currentTask.fileSize,
          uploadSpeed: 0,
          finishedAt: Date.now(),
          errorMessage: null,
        });
      } catch (error) {
        const canceled =
          error?.name === "CanceledError" || error?.code === "ERR_CANCELED";
        if (uploadSessionId) {
          const uploadApi =
            currentTask.kind === "designFlaw"
              ? OrdersDesignFlawsAPI
              : OrdersPdfAPI;
          if (!canceled) {
            try {
              const progress =
                await uploadApi.uploadDesignProgress(uploadSessionId);
              const progressData = progress?.data || progress;
              if (progressData?.status === "completed") {
                updateTask(taskId, {
                  status: "success",
                  serverStatus: "completed",
                  progress: 100,
                  preparationProgress: 100,
                  uploadedBytes: currentTask.fileSize,
                  uploadTotalBytes: currentTask.fileSize,
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
          await uploadApi
            .abortDesignUpload({ upload_session_id: uploadSessionId })
            .catch(() => undefined);
        }
        updateTask(taskId, {
          status: canceled ? "canceled" : "failed",
          finishedAt: Date.now(),
          errorMessage: canceled
            ? null
            : error?.response?.data?.error?.message ||
              error?.message ||
              tQueue("messages.uploadFailed"),
          uploadSpeed: 0,
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

  const enqueueUploads = useCallback(
    ({ ordersPdfId, ordersDesignFlawId, pdfName, batchName, files }) => {
      const nextFiles = Array.from(files || []).filter(
        (file) => file instanceof File,
      );
      if (!nextFiles.length) return [];
      const now = Date.now();
      const kind = ordersDesignFlawId ? "designFlaw" : "ordersPdf";
      const parentId = ordersDesignFlawId || ordersPdfId;
      if (!parentId) return [];
      const newTasks = nextFiles.map((file) => ({
        id: createTaskId(),
        kind,
        parentId: String(parentId),
        pdfName: batchName || pdfName || "-",
        file,
        fileName: file.name || "untitled",
        fileSize: file.size || 0,
        status: "queued",
        progress: 0,
        preparationProgress: 0,
        uploadedBytes: 0,
        uploadTotalBytes: file.size || 0,
        uploadSpeed: 0,
        uploadSessionId: null,
        createdAt: now,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
        serverStatus: null,
      }));
      setTasks((prev) => [...newTasks, ...prev]);
      setCollapsed(false);
      return newTasks.map((task) => task.id);
    },
    [],
  );

  const cancelUpload = useCallback(
    async (taskId) => {
      const currentTask = tasksRef.current.find((task) => task.id === taskId);
      if (!currentTask) return;
      if (currentTask.status === "queued") {
        updateTask(taskId, { status: "canceled", finishedAt: Date.now() });
        return;
      }
      if (currentTask.status === "uploading") {
        const uploadApi =
          currentTask.kind === "designFlaw"
            ? OrdersDesignFlawsAPI
            : OrdersPdfAPI;
        if (currentTask.uploadSessionId) {
          await uploadApi
            .abortDesignUpload({
              upload_session_id: currentTask.uploadSessionId,
            })
            .catch(() => undefined);
        }
        controllersRef.current.get(taskId)?.abort();
      }
    },
    [updateTask],
  );

  const retryUpload = useCallback(
    (taskId) => {
      const currentTask = tasksRef.current.find((task) => task.id === taskId);
      if (!currentTask || !["failed", "canceled"].includes(currentTask.status))
        return;
      updateTask(taskId, {
        id: createTaskId(),
        status: "queued",
        progress: 0,
        preparationProgress: 0,
        uploadedBytes: 0,
        uploadTotalBytes: currentTask.fileSize,
        uploadSpeed: 0,
        uploadSessionId: null,
        startedAt: null,
        finishedAt: null,
        errorMessage: null,
        serverStatus: null,
      });
    },
    [updateTask],
  );

  const removeTask = useCallback((taskId) => {
    const currentTask = tasksRef.current.find((task) => task.id === taskId);
    if (currentTask?.status === "uploading")
      controllersRef.current.get(taskId)?.abort();
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
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
    <OrdersPdfDesignUploadQueueContext.Provider value={value}>
      {children}
      <UploadQueuePanel
        tasks={tasks}
        tQueue={tQueue}
        zIndex={1810}
        hasOngoingUploads={hasOngoingUploads}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onClearFinished={clearFinished}
        onRetry={retryUpload}
        onCancel={cancelUpload}
        onRemove={removeTask}
        renderMeta={(task) => (
          <>
            {task.pdfName} • {formatBytes(task.fileSize)}
          </>
        )}
      />
    </OrdersPdfDesignUploadQueueContext.Provider>
  );
}

export const useOrdersPdfDesignUploadQueue = () => {
  const context = useContext(OrdersPdfDesignUploadQueueContext);
  if (!context) {
    throw new Error(
      "useOrdersPdfDesignUploadQueue must be used within OrdersPdfDesignUploadQueueProvider",
    );
  }
  return context;
};
