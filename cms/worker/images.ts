export function imageDimensions(
  data: Uint8Array,
  mime: string,
): { width: number; height: number } | null {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let width = 0,
    height = 0;
  if (mime === "image/png" && data.length >= 24) {
    width = v.getUint32(16);
    height = v.getUint32(20);
  }
  if (mime === "image/jpeg") {
    let p = 2;
    while (p + 4 < data.length) {
      if (data[p++] !== 255) break;
      while (data[p] === 255) p++;
      const marker = data[p++];
      if (marker === 217 || marker === 218) break;
      if (marker === 216 || marker === 1 || (marker >= 208 && marker <= 215))
        continue;
      if (p + 2 > data.length) break;
      const length = v.getUint16(p);
      if (length < 2 || p + length > data.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        length >= 7
      ) {
        height = v.getUint16(p + 3);
        width = v.getUint16(p + 5);
        break;
      }
      p += length;
    }
  }
  if (mime === "image/webp" && data.length >= 30) {
    const kind = new TextDecoder().decode(data.slice(12, 16));
    if (kind === "VP8X") {
      width = 1 + data[24] + (data[25] << 8) + (data[26] << 16);
      height = 1 + data[27] + (data[28] << 8) + (data[29] << 16);
    }
    if (
      kind === "VP8 " &&
      data[23] === 157 &&
      data[24] === 1 &&
      data[25] === 42
    ) {
      width = v.getUint16(26, true) & 16383;
      height = v.getUint16(28, true) & 16383;
    }
    if (kind === "VP8L" && data[20] === 47) {
      const bits = v.getUint32(21, true);
      width = (bits & 16383) + 1;
      height = ((bits >>> 14) & 16383) + 1;
    }
  }
  return width > 0 && height > 0 && width <= 65535 && height <= 65535
    ? { width, height }
    : null;
}
