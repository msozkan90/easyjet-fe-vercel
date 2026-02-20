const ZIP_SIGNATURES = {
  localFileHeader: 0x04034b50,
  centralDirectoryHeader: 0x02014b50,
  endOfCentralDirectory: 0x06054b50,
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let j = 0; j < 8; j += 1) {
      if (value & 1) {
        value = 0xedb88320 ^ (value >>> 1);
      } else {
        value >>>= 1;
      }
    }
    table[i] = value >>> 0;
  }
  return table;
})();

const writeUint16 = (view, offset, value) => {
  view.setUint16(offset, value, true);
};

const writeUint32 = (view, offset, value) => {
  view.setUint32(offset, value >>> 0, true);
};

const getDosDateTime = (date = new Date()) => {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;

  return { dosDate, dosTime };
};

const concatUint8Arrays = (parts) => {
  const totalSize = parts.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of parts) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    const index = (crc ^ bytes[i]) & 0xff;
    crc = CRC32_TABLE[index] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const textEncoder =
  typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

const encodeUtf8 = (value) => {
  if (textEncoder) {
    return textEncoder.encode(value);
  }
  const normalized = unescape(encodeURIComponent(value));
  const bytes = new Uint8Array(normalized.length);
  for (let i = 0; i < normalized.length; i += 1) {
    bytes[i] = normalized.charCodeAt(i);
  }
  return bytes;
};

const normalizeFileInput = async (file) => {
  const name = String(file?.name || "file");
  const source = file?.data ?? file?.blob;
  if (!source) {
    throw new Error("Zip file data is required.");
  }

  if (source instanceof Uint8Array) {
    return { name, data: source };
  }

  if (source instanceof ArrayBuffer) {
    return { name, data: new Uint8Array(source) };
  }

  if (typeof Blob !== "undefined" && source instanceof Blob) {
    const arrayBuffer = await source.arrayBuffer();
    return { name, data: new Uint8Array(arrayBuffer) };
  }

  throw new Error("Unsupported zip data type.");
};

export const createStoredZipBlob = async (files, options = {}) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("At least one file is required to create a zip.");
  }

  const now = options.date instanceof Date ? options.date : new Date();
  const { dosDate, dosTime } = getDosDateTime(now);
  const preparedFiles = await Promise.all(files.map((file) => normalizeFileInput(file)));

  const localParts = [];
  const centralDirectoryParts = [];
  let offset = 0;

  for (const file of preparedFiles) {
    const fileNameBytes = encodeUtf8(file.name);
    const data = file.data;
    const checksum = crc32(data);

    const localHeader = new Uint8Array(30 + fileNameBytes.length);
    const localView = new DataView(localHeader.buffer);

    writeUint32(localView, 0, ZIP_SIGNATURES.localFileHeader);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, dosTime);
    writeUint16(localView, 12, dosDate);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, fileNameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(fileNameBytes, 30);

    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + fileNameBytes.length);
    const centralView = new DataView(centralHeader.buffer);

    writeUint32(centralView, 0, ZIP_SIGNATURES.centralDirectoryHeader);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, dosTime);
    writeUint16(centralView, 14, dosDate);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, data.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, fileNameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    centralHeader.set(fileNameBytes, 46);

    centralDirectoryParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralDirectory = concatUint8Arrays(centralDirectoryParts);

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32(endView, 0, ZIP_SIGNATURES.endOfCentralDirectory);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, preparedFiles.length);
  writeUint16(endView, 10, preparedFiles.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);

  const archive = concatUint8Arrays([...localParts, centralDirectory, endRecord]);
  return new Blob([archive], { type: "application/zip" });
};
