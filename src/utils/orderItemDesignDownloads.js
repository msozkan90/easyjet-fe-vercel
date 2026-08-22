import dayjs from "dayjs";
import { saveBlobAsFile } from "@/utils/apiHelpers";
import { createStoredZipBlob } from "@/utils/zip";

const LABEL_SEGMENT = "order-labels/";

const sanitizeFilename = (value) =>
  String(value || "")
    .replace(/[\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

const decodePathname = (url) => {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname || "");
  } catch {
    return "";
  }
};

const extractFilenameFromUrl = (url, fallbackName = "design") => {
  const pathname = decodePathname(url);
  if (!pathname) return fallbackName;

  const lastSegment = pathname.split("/").filter(Boolean).pop();
  return sanitizeFilename(lastSegment) || fallbackName;
};

const extractLabelFilenameFromUrl = (url, fallbackName = "label") => {
  const pathname = decodePathname(url);
  if (!pathname) return fallbackName;

  const markerIndex = pathname.indexOf(LABEL_SEGMENT);
  if (markerIndex >= 0) {
    const filePath = pathname.slice(markerIndex + LABEL_SEGMENT.length);
    const normalized = filePath.replace(/^\/+/, "").trim();
    if (normalized) {
      return sanitizeFilename(normalized) || fallbackName;
    }
  }

  const lastSegment = pathname.split("/").filter(Boolean).pop();
  return sanitizeFilename(lastSegment) || fallbackName;
};

const ensureUniqueFilename = (filename, seenNames) => {
  if (!seenNames.has(filename)) {
    seenNames.add(filename);
    return filename;
  }

  const dotIndex = filename.lastIndexOf(".");
  const hasExtension = dotIndex > 0;
  const base = hasExtension ? filename.slice(0, dotIndex) : filename;
  const ext = hasExtension ? filename.slice(dotIndex) : "";

  let suffix = 1;
  let candidate = `${base}_${suffix}${ext}`;
  while (seenNames.has(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}${ext}`;
  }
  seenNames.add(candidate);
  return candidate;
};

const fetchDesignFile = async (url) => {
  const proxyUrl = `/api/file-proxy?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Design file could not be downloaded: ${response.status}`);
  }
  return response.blob();
};

export const downloadOriginalDesign = async ({
  url,
  fallbackName = "design",
}) => {
  if (!url) return { downloaded: false };
  const filename = extractFilenameFromUrl(url, fallbackName);
  const anchor = document.createElement("a");
  anchor.href = `/api/file-proxy?download=1&url=${encodeURIComponent(url)}`;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return { downloaded: true, filename };
};

const fetchLabelFile = async (url) => {
  const proxyUrl = `/api/file-proxy?url=${encodeURIComponent(url)}`;
  const proxyResponse = await fetch(proxyUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (proxyResponse.ok) {
    return proxyResponse.blob();
  }

  throw new Error(
    `Label file could not be downloaded: ${proxyResponse.status}`,
  );
};

const normalizeDesignList = (designs) => {
  if (!Array.isArray(designs)) return [];
  return designs
    .map((design) => {
      const url = design?.design_url;
      if (!url) return null;
      return { url };
    })
    .filter(Boolean);
};

export const downloadOrderItemDesigns = async ({ orderNumber, designs }) => {
  const designList = normalizeDesignList(designs);
  if (!designList.length) {
    return { downloaded: false, count: 0 };
  }

  const seenNames = new Set();
  const files = await Promise.all(
    designList.map(async ({ url }, index) => {
      const fallbackName = `design_${index + 1}`;
      const rawName = extractFilenameFromUrl(url, fallbackName);
      const filename = ensureUniqueFilename(rawName, seenNames);
      const blob = await fetchDesignFile(url);
      return { name: filename, blob };
    }),
  );

  if (files.length === 1) {
    saveBlobAsFile(files[0].blob, files[0].name);
    return {
      downloaded: true,
      count: 1,
      filename: files[0].name,
    };
  }

  const zipBlob = await createStoredZipBlob(files);
  const zipName = `${sanitizeFilename(orderNumber) || "order"}-${dayjs().format(
    "MM-DD-YYYY",
  )}.zip`;
  saveBlobAsFile(zipBlob, zipName);

  return {
    downloaded: true,
    count: files.length,
    filename: zipName,
  };
};

export const downloadOrderLabel = async ({ orderNumber, labelUrl }) => {
  if (!labelUrl) {
    return { downloaded: false };
  }

  const fallbackName = `${sanitizeFilename(orderNumber) || "order"}-label-${dayjs().format(
    "MM-DD-YYYY",
  )}`;
  const rawName = extractLabelFilenameFromUrl(labelUrl, fallbackName);
  const filename = rawName.includes(".") ? rawName : `${rawName}.jpg`;

  const blob = await fetchLabelFile(labelUrl);
  saveBlobAsFile(blob, filename);

  return {
    downloaded: true,
    filename,
  };
};

const createHiddenPrintFrame = () => {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);
  return iframe;
};

export const printOrderLabel = async ({ labelUrl }) => {
  if (!labelUrl) {
    return { printed: false };
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Label can only be printed in the browser.");
  }

  const blob = await fetchLabelFile(labelUrl);
  const objectUrl = URL.createObjectURL(blob);

  await new Promise((resolve, reject) => {
    const iframe = createHiddenPrintFrame();
    let settled = false;
    let cleanupStarted = false;

    const cleanup = () => {
      if (cleanupStarted) return;
      cleanupStarted = true;
      iframe.remove();
      URL.revokeObjectURL(objectUrl);
    };

    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const loadTimeout = window.setTimeout(() => {
      rejectOnce(new Error("Label file could not be prepared for printing."));
    }, 20000);

    iframe.onload = () => {
      window.clearTimeout(loadTimeout);
      window.setTimeout(() => {
        try {
          const frameWindow = iframe.contentWindow;
          if (!frameWindow) {
            throw new Error("Label print window could not be opened.");
          }

          const cleanupAfterPrint = () => {
            frameWindow.removeEventListener?.("afterprint", cleanupAfterPrint);
            window.setTimeout(cleanup, 1000);
          };

          frameWindow.addEventListener?.("afterprint", cleanupAfterPrint);
          frameWindow.focus();
          frameWindow.print();
          resolveOnce();
          window.setTimeout(cleanup, 60000);
        } catch (error) {
          rejectOnce(
            error instanceof Error
              ? error
              : new Error("Label could not be printed."),
          );
        }
      }, 250);
    };

    iframe.onerror = () => {
      window.clearTimeout(loadTimeout);
      rejectOnce(new Error("Label file could not be loaded for printing."));
    };

    iframe.src = objectUrl;
  });

  return { printed: true };
};
