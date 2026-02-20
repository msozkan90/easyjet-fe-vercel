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
  let candidate = `${base}-${suffix}${ext}`;
  while (seenNames.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}${ext}`;
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

const fetchLabelFile = async (url) => {
  const proxyUrl = `/api/file-proxy?url=${encodeURIComponent(url)}`;
  const proxyResponse = await fetch(proxyUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (proxyResponse.ok) {
    return proxyResponse.blob();
  }

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Label file could not be downloaded: ${response.status}`);
  }

  return response.blob();
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
      const fallbackName = `design-${index + 1}`;
      const rawName = extractFilenameFromUrl(url, fallbackName);
      const filename = ensureUniqueFilename(rawName, seenNames);
      const blob = await fetchDesignFile(url);
      return { name: filename, blob };
    })
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
    "MM-DD-YYYY"
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
    "MM-DD-YYYY"
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
