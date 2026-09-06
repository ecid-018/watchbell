/* ------------------------------------------------------------------
   Camera and library photos are 3-5 MB apiece — raw, that fills the photo
   quota in days. Every photo goes through here before it is ever written
   to the photo store: resized to a 1600px long edge and re-encoded as
   JPEG at ~0.7 quality on a canvas. Thumbnails run the same pipeline
   again, tighter, off the already-compressed blob.

   createImageBitmap's imageOrientation option corrects for EXIF rotation
   during decode, so a portrait photo is never accidentally compressed
   sideways. Where that option isn't supported, the <img> fallback trusts
   the browser's own default handling of orientation.
------------------------------------------------------------------ */

const MAX_EDGE = 1600;
const QUALITY = 0.7;

async function decode(source) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(source, { imageOrientation: "from-image" });
    } catch (e) { /* fall through to the <img> path */ }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(source);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/* naturalWidth first: on an <img> it is the intrinsic size, which is what
   we want to scale from, while `width` is a layout figure that reads 0
   until the element is rendered. An ImageBitmap has no naturalWidth, so it
   falls through to `width`. `||` rather than `??` on purpose — a 0 here is
   as useless as an undefined, and treating it as a real measurement gets a
   1x1 canvas and a photo silently compressed down to a single pixel. */
const sizeOf = (bitmap) => ({
  width: bitmap.naturalWidth || bitmap.width,
  height: bitmap.naturalHeight || bitmap.height,
});

/** Resize to a long edge of `maxEdge`, re-encode as JPEG. Returns
    { blob, width, height } at the size it was actually drawn. Accepts a
    File or a Blob — a thumbnail pass feeds this the previous pass's own
    output rather than re-decoding the original. */
export async function compressImage(source, { maxEdge = MAX_EDGE, quality = QUALITY } = {}) {
  const bitmap = await decode(source);
  const { width, height } = sizeOf(bitmap);
  if (!width || !height) throw new Error("image decoded with no dimensions");
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  // toBlob hands back null rather than throwing when it cannot encode. Say so
  // here: the callers store `blob.size`, and a null this far in surfaces as an
  // unrelated TypeError halfway through an import.
  if (!blob) throw new Error("canvas could not encode the image as JPEG");
  return { blob, width: w, height: h };
}

/** The same bytes as a data URL. A third larger than an object URL and it
    copies rather than referencing, but it is inert: nothing can revoke it
    or collect it out from under an <img>. */
export const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error("could not read the photo"));
  reader.readAsDataURL(blob);
});
