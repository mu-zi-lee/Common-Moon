/**
 * Minimal EXIF DateTimeOriginal reader for JPEG files.
 * Returns a Date or null. Falls back to file.lastModified when unavailable.
 * No dependencies — parses just enough of the APP1/TIFF header to find tag 0x9003.
 */

function parseExifDate(str: string): Date | null {
  // Format: "YYYY:MM:DD HH:MM:SS"
  const m = str.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  return isNaN(dt.getTime()) ? null : dt;
}

async function readJpegDateTimeOriginal(file: File | Blob): Promise<Date | null> {
  // Read only the first 256KB — EXIF lives near the start.
  const slice = file.slice(0, Math.min(file.size, 256 * 1024));
  const buf = new DataView(await slice.arrayBuffer());
  if (buf.byteLength < 4 || buf.getUint16(0) !== 0xffd8) return null; // not JPEG

  let offset = 2;
  while (offset + 4 < buf.byteLength) {
    if (buf.getUint8(offset) !== 0xff) return null;
    const marker = buf.getUint8(offset + 1);
    const size = buf.getUint16(offset + 2);
    if (marker === 0xe1 && offset + 4 + size <= buf.byteLength) {
      // APP1
      const start = offset + 4;
      // "Exif\0\0"
      if (
        buf.getUint32(start) === 0x45786966 &&
        buf.getUint16(start + 4) === 0x0000
      ) {
        const tiff = start + 6;
        const little = buf.getUint16(tiff) === 0x4949;
        const u16 = (o: number) => (little ? buf.getUint16(o, true) : buf.getUint16(o));
        const u32 = (o: number) => (little ? buf.getUint32(o, true) : buf.getUint32(o));
        if (u16(tiff + 2) !== 0x002a) return null;
        const ifd0 = tiff + u32(tiff + 4);
        const entries = u16(ifd0);
        let exifIfdOffset: number | null = null;
        for (let i = 0; i < entries; i++) {
          const e = ifd0 + 2 + i * 12;
          const tag = u16(e);
          if (tag === 0x8769) {
            exifIfdOffset = tiff + u32(e + 8);
            break;
          }
        }
        if (exifIfdOffset == null) return null;
        const en = u16(exifIfdOffset);
        for (let i = 0; i < en; i++) {
          const e = exifIfdOffset + 2 + i * 12;
          const tag = u16(e);
          if (tag === 0x9003 /* DateTimeOriginal */ || tag === 0x0132 /* DateTime */) {
            const count = u32(e + 4);
            const valOffset = tiff + u32(e + 8);
            if (valOffset + count > buf.byteLength) return null;
            let s = "";
            for (let k = 0; k < count; k++) {
              const c = buf.getUint8(valOffset + k);
              if (c === 0) break;
              s += String.fromCharCode(c);
            }
            const dt = parseExifDate(s);
            if (dt) return dt;
          }
        }
        return null;
      }
    }
    offset += 2 + size;
  }
  return null;
}

/**
 * Best-effort capture time for an image file.
 * Preference: EXIF DateTimeOriginal → file.lastModified → null.
 */
export async function readCaptureTime(file: File | Blob): Promise<Date | null> {
  try {
    const type = (file as File).type || "";
    if (type === "image/jpeg" || type === "image/jpg") {
      const dt = await readJpegDateTimeOriginal(file);
      if (dt) return dt;
    }
  } catch {
    // ignore and fall through
  }
  if (file instanceof File && file.lastModified) {
    const dt = new Date(file.lastModified);
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}
