import axios from "axios";

const PART_CONCURRENCY = 4;
const PART_RETRY_COUNT = 3;
const URL_BATCH_SIZE = 40;

export const unwrapApiData = (response) =>
  response?.data && typeof response.data === "object"
    ? response.data
    : response;

export async function uploadFileDirectMultipart({
  file,
  initUpload,
  getPartUrls,
  signal,
  onSession,
  onProgress,
}) {
  const init = unwrapApiData(await initUpload());
  const uploadSessionId = String(init?.upload_session_id || "");
  const partSize = Number(init?.part_size || 0);
  const totalParts = Number(init?.total_parts || 0);
  if (!uploadSessionId || !partSize || !totalParts) {
    throw new Error("Invalid multipart upload session");
  }
  onSession?.(uploadSessionId);

  const loadedByPart = new Map();
  let maxReportedBytes = 0;
  let lastSampleAt = Date.now();
  let lastSampleBytes = 0;
  const report = () => {
    const aggregate = Array.from(loadedByPart.values()).reduce(
      (sum, value) => sum + Number(value || 0),
      0,
    );
    maxReportedBytes = Math.max(maxReportedBytes, Math.min(aggregate, file.size));
    const now = Date.now();
    const elapsedSeconds = Math.max(0.001, (now - lastSampleAt) / 1000);
    const bytesDelta = Math.max(0, maxReportedBytes - lastSampleBytes);
    const bytesPerSecond = bytesDelta / elapsedSeconds;
    if (now - lastSampleAt >= 500 || maxReportedBytes >= file.size) {
      lastSampleAt = now;
      lastSampleBytes = maxReportedBytes;
    }
    onProgress?.({
      loaded: maxReportedBytes,
      total: file.size,
      bytesPerSecond,
    });
  };

  const completedParts = [];
  const uploadPart = async (partNumber, signedUrl) => {
    const start = (partNumber - 1) * partSize;
    const end = Math.min(start + partSize, file.size);
    const blob = file.slice(start, end);
    let lastError;
    for (let attempt = 1; attempt <= PART_RETRY_COUNT; attempt += 1) {
      try {
        loadedByPart.set(partNumber, 0);
        const response = await axios.put(signedUrl, blob, {
          headers: { "Content-Type": file.type || "application/octet-stream" },
          signal,
          onUploadProgress: (event) => {
            loadedByPart.set(partNumber, Number(event?.loaded || 0));
            report();
          },
        });
        loadedByPart.set(partNumber, blob.size);
        report();
        return {
          part_number: partNumber,
          etag: String(response?.headers?.etag || "__missing__"),
        };
      } catch (error) {
        lastError = error;
        if (error?.name === "CanceledError" || error?.code === "ERR_CANCELED") {
          throw error;
        }
        if (attempt === PART_RETRY_COUNT) throw error;
      }
    }
    throw lastError;
  };

  for (let batchStart = 1; batchStart <= totalParts; batchStart += URL_BATCH_SIZE) {
    const partNumbers = Array.from(
      { length: Math.min(URL_BATCH_SIZE, totalParts - batchStart + 1) },
      (_, index) => batchStart + index,
    );
    const urlData = unwrapApiData(
      await getPartUrls(uploadSessionId, partNumbers),
    );
    const urlMap = new Map(
      (urlData?.urls || []).map((entry) => [
        Number(entry?.part_number),
        String(entry?.url || ""),
      ]),
    );
    if (urlMap.size !== partNumbers.length) {
      throw new Error("Multipart signed URLs are incomplete");
    }
    const queue = [...partNumbers];
    const workers = Array.from(
      { length: Math.min(PART_CONCURRENCY, queue.length) },
      async () => {
        while (queue.length) {
          const partNumber = queue.shift();
          if (!partNumber) return;
          completedParts.push(await uploadPart(partNumber, urlMap.get(partNumber)));
        }
      },
    );
    await Promise.all(workers);
  }

  return {
    uploadSessionId,
    parts: completedParts.sort((left, right) => left.part_number - right.part_number),
  };
}
