/**
 * Utility helpers for preparing payloads that include Ant Design Upload file lists.
 */

const MULTIPART_CONFIG = Object.freeze({
  headers: { "Content-Type": "multipart/form-data" },
});

const isNil = (value) => value === undefined || value === null;

const isRemoved = (file) => file?.status === "removed";

/**
 * Normalize Ant Design Upload value into an array excluding removed items.
 * @param {any} value Upload component value (array or undefined)
 * @returns {Array} file list without removed entries
 */
export function extractUploadFileList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((file) => file && !isRemoved(file));
}

/**
 * Builds either a FormData payload when a new file is provided or a plain object when the existing file is reused.
 *
 * @param {object} values Form values that include the Upload `fileList`
 * @param {object} options
 * @param {string} options.fileField The key on the form values that stores the Upload value (required)
 * @param {string} [options.formDataField=options.fileField] The field name to use when appending the file to FormData
 * @param {string|null} [options.urlField] When no new file is selected, populate this field with the existing URL (set to null to skip)
 * @returns {{data: FormData, config: object} | {data: object}}
 */
export function buildSingleFileSubmitPayload(
  values,
  { fileField, formDataField = fileField, urlField } = {}
) {
  if (!fileField) {
    throw new Error("buildSingleFileSubmitPayload requires a `fileField` option.");
  }

  const { [fileField]: rawFileList, ...rest } = values || {};
  const fileList = extractUploadFileList(rawFileList);
  const fileItem = fileList[0];

  if (fileItem?.originFileObj) {
    const formData = new FormData();
    Object.entries(rest || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      formData.append(key, value);
    });
    formData.append(formDataField, fileItem.originFileObj);
    return { data: formData, config: MULTIPART_CONFIG };
  }

  const payload = {};
  Object.entries(rest || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      payload[key] = value;
    }
  });

  if (typeof urlField === "string") {
    payload[urlField] = fileItem?.url || null;
  }

  return { data: payload };
}

export const multipartConfig = MULTIPART_CONFIG;

/**
 * Creates a FormData payload for uploading a single file while allowing optional fields.
 *
 * @param {File|Blob} file
 * @param {object} [options]
 * @param {string} [options.fieldName="file"] Field name for the file part
 * @param {object} [options.additionalFields] Additional key/value pairs appended to the FormData
 * @returns {FormData}
 */
export function buildFileUploadFormData(
  file,
  { fieldName = "file", additionalFields = {} } = {}
) {
  if (!file) {
    throw new Error("buildFileUploadFormData requires a file.");
  }

  const formData = new FormData();
  formData.append(fieldName, file);

  Object.entries(additionalFields || {}).forEach(([key, value]) => {
    if (isNil(value)) return;
    formData.append(key, value);
  });

  return formData;
}
