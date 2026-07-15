/**
 * Client-side image compression (spec F6): resize to ~1600px on the long edge
 * at ~0.8 quality before upload, so mobile-data uploads stay small. Falls back
 * to the original file if the browser can't decode it (e.g. some HEIC).
 */
export type PreparedFile = { blob: Blob; filename: string; type: string };

export async function compressImage(
  file: File,
  maxEdge = 1600,
  quality = 0.8,
): Promise<PreparedFile> {
  // Videos and anything non-image pass through untouched.
  if (!file.type.startsWith("image/")) {
    return { blob: file, filename: file.name, type: file.type || "application/octet-stream" };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("toBlob returned null");

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return { blob, filename: `${base}.jpg`, type: "image/jpeg" };
  } catch {
    // Decoding failed (unsupported format) — upload the original as-is.
    return { blob: file, filename: file.name, type: file.type };
  }
}
