export const hasOrderNumberWhitespace = (value) => /\s/.test(String(value ?? ""));

export const isValidOrderNumber = (value) => {
  const text = String(value ?? "").trim();
  return Boolean(text) && !hasOrderNumberWhitespace(text);
};

export const getFirstInvalidOrderNumber = (records = []) => {
  if (!Array.isArray(records)) return null;
  const invalidRecord = records.find((record) => !isValidOrderNumber(record?.order_number));
  return invalidRecord ? invalidRecord.order_number : null;
};
