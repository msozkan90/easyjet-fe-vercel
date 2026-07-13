export const TRANSFER_DESIGN_DPI = 300;
export const MAX_TRANSFER_DESIGN_WIDTH_INCHES = 29.9;

const HEADER_BYTES = 1024 * 1024;

const readAscii = (view, offset, length) => {
  if (offset < 0 || offset + length > view.byteLength) return "";
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(view.getUint8(offset + index));
  }
  return text;
};

const parsePngDimensions = (view) => {
  if (view.byteLength < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((byte, index) => view.getUint8(index) === byte)) return null;
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return width > 0 && height > 0 ? { width, height } : null;
};

const parseGifDimensions = (view) => {
  if (view.byteLength < 10) return null;
  const signature = readAscii(view, 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") return null;
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  return width > 0 && height > 0 ? { width, height } : null;
};

const parseJpegDimensions = (view) => {
  if (view.byteLength < 4 || view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    while (offset < view.byteLength && view.getUint8(offset) !== 0xff) offset += 1;
    if (offset + 1 >= view.byteLength) break;
    while (offset < view.byteLength && view.getUint8(offset) === 0xff) offset += 1;
    if (offset >= view.byteLength) break;
    const marker = view.getUint8(offset);
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 2 > view.byteLength) break;
    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > view.byteLength) break;
    const isSofMarker =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSofMarker) {
      if (offset + 7 > view.byteLength) break;
      const height = view.getUint16(offset + 3, false);
      const width = view.getUint16(offset + 5, false);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
};

const parseWebpDimensions = (view) => {
  if (view.byteLength < 30 || readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WEBP") {
    return null;
  }
  const chunkType = readAscii(view, 12, 4);
  if (chunkType === "VP8X") {
    const width = 1 + view.getUint8(24) + (view.getUint8(25) << 8) + (view.getUint8(26) << 16);
    const height = 1 + view.getUint8(27) + (view.getUint8(28) << 8) + (view.getUint8(29) << 16);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (chunkType === "VP8 ") {
    const start = 20;
    if (view.getUint8(start + 3) === 0x9d && view.getUint8(start + 4) === 0x01 && view.getUint8(start + 5) === 0x2a) {
      const width = view.getUint16(start + 6, true) & 0x3fff;
      const height = view.getUint16(start + 8, true) & 0x3fff;
      return width > 0 && height > 0 ? { width, height } : null;
    }
  }
  if (chunkType === "VP8L" && view.byteLength >= 25) {
    const b0 = view.getUint8(21);
    const b1 = view.getUint8(22);
    const b2 = view.getUint8(23);
    const b3 = view.getUint8(24);
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return width > 0 && height > 0 ? { width, height } : null;
  }
  return null;
};

const parseTiffDimensions = (view) => {
  if (view.byteLength < 8) return null;
  const byteOrder = readAscii(view, 0, 2);
  const littleEndian = byteOrder === "II";
  if (!littleEndian && byteOrder !== "MM") return null;
  const readOffset = (offset) => view.getUint32(offset, littleEndian);
  if (view.getUint16(2, littleEndian) !== 42) return null;
  const ifdOffset = readOffset(4);
  if (ifdOffset + 2 > view.byteLength) return null;
  const entryCount = view.getUint16(ifdOffset, littleEndian);
  let width = null;
  let height = null;
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag !== 256 && tag !== 257) continue;
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);
    if (count < 1) continue;
    let value = null;
    if (type === 3) value = view.getUint16(entryOffset + 8, littleEndian);
    if (type === 4) value = view.getUint32(entryOffset + 8, littleEndian);
    if (!value || value <= 0) continue;
    if (tag === 256) width = value;
    if (tag === 257) height = value;
    if (width && height) return { width, height };
  }
  return null;
};

const parseDimensions = (buffer) => {
  const view = new DataView(buffer);
  return (
    parsePngDimensions(view) ||
    parseJpegDimensions(view) ||
    parseGifDimensions(view) ||
    parseWebpDimensions(view) ||
    parseTiffDimensions(view)
  );
};

export const readTransferDesignDimensionsInches = async (file) => {
  const buffer = await file.slice(0, HEADER_BYTES).arrayBuffer();
  const dimensions = parseDimensions(buffer);
  if (!dimensions) return null;
  return {
    widthInches: Number((dimensions.width / TRANSFER_DESIGN_DPI).toFixed(4)),
    heightInches: Number((dimensions.height / TRANSFER_DESIGN_DPI).toFixed(4)),
  };
};

export const validateTransferDesignWidth = async (file) => {
  const dimensions = await readTransferDesignDimensionsInches(file);
  if (!dimensions) return { valid: true, dimensions: null };
  return {
    valid: dimensions.widthInches <= MAX_TRANSFER_DESIGN_WIDTH_INCHES,
    dimensions,
  };
};
