// A queue retry creates a new task ID; transport retries retain the same key.
export const uploadIdempotencyKey = (taskId, fileIndex = 0) => {
  const id = String(taskId || "");
  if (id.length < 8 || id.length > 100 || !Number.isSafeInteger(fileIndex) || fileIndex < 0 || fileIndex > 10000) {
    throw new Error("Invalid upload identity");
  }
  return `${id}:${fileIndex}`;
};
