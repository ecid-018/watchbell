/* ------------------------------------------------------------------
   Just enough EXIF to answer one question: when was this photo taken.

   Reads the JPEG APP1/Exif segment for DateTimeOriginal, falling back to
   the plain DateTime tag, and nothing else — no GPS, no orientation (the
   image pipeline lets createImageBitmap handle that during decode).
   Never throws: a photo with no EXIF, a stripped file, or a format this
   doesn't recognise all just come back with no date, the same way a photo
   without location data comes back with no location — absence, not an error.
------------------------------------------------------------------ */

const ascii = (view, offset, length) => {
  let s = "";
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
};

/** "YYYY:MM:DD HH:MM:SS" (EXIF's own format) -> a Date, or null. */
const parseExifDate = (s) => {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(s || "");
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi, se);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** One IFD's entries: tag -> {numValues, valueOffset}. */
function readIFD(view, tiffStart, ifdOffset, little) {
  const entries = new Map();
  const count = view.getUint16(tiffStart + ifdOffset, little);
  for (let i = 0; i < count; i++) {
    const entryOffset = tiffStart + ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, little);
    const numValues = view.getUint32(entryOffset + 4, little);
    const valueOffset = entryOffset + 8;
    entries.set(tag, { numValues, valueOffset });
  }
  return entries;
}

/** ASCII fields of 4 bytes or fewer sit inline at valueOffset; longer
    ones are a pointer relative to the start of the TIFF header. */
const readAsciiField = (view, tiffStart, entry, little) => {
  const size = entry.numValues;
  const offset = size <= 4 ? entry.valueOffset : tiffStart + view.getUint32(entry.valueOffset, little);
  return ascii(view, offset, size);
};

/** DateTimeOriginal (Exif sub-IFD, tag 0x9003), falling back to DateTime
    (IFD0, tag 0x0132). @param {ArrayBuffer} buf @returns {Date | null} */
export function readExifDate(buf) {
  try {
    const view = new DataView(buf);
    if (view.getUint16(0) !== 0xffd8) return null; // not a JPEG

    let offset = 2;
    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset);
      if (marker === 0xffd9 || marker === 0xffda) break; // EOI / start of scan
      const size = view.getUint16(offset + 2);

      if (marker === 0xffe1) {
        const segStart = offset + 4;
        if (ascii(view, segStart, 4) !== "Exif") { offset += 2 + size; continue; }
        const tiffStart = segStart + 6;
        const little = view.getUint16(tiffStart) === 0x4949;
        const u32 = (o) => view.getUint32(o, little);
        const ifd0 = readIFD(view, tiffStart, u32(tiffStart + 4), little);

        const exifPtr = ifd0.get(0x8769);
        if (exifPtr) {
          const exifIfd = readIFD(view, tiffStart, u32(exifPtr.valueOffset), little);
          const dto = exifIfd.get(0x9003);
          if (dto) {
            const d = parseExifDate(readAsciiField(view, tiffStart, dto, little));
            if (d) return d;
          }
        }
        const dt = ifd0.get(0x0132);
        if (dt) {
          const d = parseExifDate(readAsciiField(view, tiffStart, dt, little));
          if (d) return d;
        }
        return null;
      }
      offset += 2 + size;
    }
    return null;
  } catch (e) {
    return null;
  }
}
