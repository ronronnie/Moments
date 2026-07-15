/**
 * Minimal EXIF reader: pulls the capture date (DateTimeOriginal, falling back
 * to DateTime) out of a JPEG so the photo matcher can order photos by when they
 * were taken. Read BEFORE compression, since canvas re-encoding strips EXIF.
 * Returns null for non-JPEGs or when no date tag is present — that's fine.
 */
export async function readExifDate(file: File): Promise<Date | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const buf = await file.slice(0, 128 * 1024).arrayBuffer();
    const view = new DataView(buf);
    if (view.getUint16(0) !== 0xffd8) return null; // not a JPEG

    // Walk JPEG segments to find APP1 (EXIF).
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00) break;
      const size = view.getUint16(offset + 2);
      if (marker === 0xffe1) {
        const app1 = offset + 4;
        // "Exif\0\0"
        if (app1 + 6 <= view.byteLength && view.getUint32(app1) === 0x45786966) {
          return parseTiff(view, app1 + 6);
        }
      }
      offset += 2 + size;
    }
  } catch {
    // Ignore — no date is acceptable.
  }
  return null;
}

function parseTiff(view: DataView, tiff: number): Date | null {
  const little = view.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);

  const readAscii = (dataOffset: number, count: number): string => {
    let s = "";
    for (let i = 0; i < count; i++) {
      const c = view.getUint8(dataOffset + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };

  // Returns the raw value data offset for a tag in an IFD, or -1.
  const findEntry = (
    ifd: number,
    tag: number,
  ): { dataOffset: number; count: number } | null => {
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const entry = ifd + 2 + i * 12;
      if (u16(entry) === tag) {
        const count = u32(entry + 4);
        // ASCII/undefined (1 byte each): inline if <=4 bytes, else pointer.
        const dataOffset = count > 4 ? tiff + u32(entry + 8) : entry + 8;
        return { dataOffset, count };
      }
    }
    return null;
  };

  const ifd0 = tiff + u32(tiff + 4);

  // Prefer DateTimeOriginal (0x9003) in the Exif sub-IFD (pointer 0x8769).
  const exifPtr = findEntry(ifd0, 0x8769);
  if (exifPtr) {
    const exifIfd = tiff + u32(exifPtr.dataOffset);
    const orig = findEntry(exifIfd, 0x9003) ?? findEntry(exifIfd, 0x9004);
    if (orig) return toDate(readAscii(orig.dataOffset, orig.count));
  }

  // Fall back to IFD0 DateTime (0x0132).
  const dt = findEntry(ifd0, 0x0132);
  if (dt) return toDate(readAscii(dt.dataOffset, dt.count));

  return null;
}

// EXIF dates look like "YYYY:MM:DD HH:MM:SS".
function toDate(raw: string): Date | null {
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}
