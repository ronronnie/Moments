import "server-only";
import { del, put } from "@vercel/blob";

/**
 * Vercel Blob storage for audio + photos.
 *
 * Privacy model: Vercel Blob objects live at unguessable URLs (a random suffix
 * is always added). We store that URL in the DB and only ever hand it to a
 * client after the server has authorized the request — an owner viewing their
 * own story, or a recipient who presented a valid share token. The URL is never
 * embedded in a public, crawlable page. This is our stand-in for signed URLs;
 * treat every returned URL as a secret.
 *
 * All functions are server-only. BLOB_READ_WRITE_TOKEN is read from the env by
 * the SDK automatically.
 */

type PutResult = { url: string; pathname: string; contentType?: string };

/** Store an original voice recording. Returns the blob URL to persist. */
export async function putAudio(
  storyId: string,
  filename: string,
  data: Blob | ArrayBuffer | Buffer,
  contentType?: string,
): Promise<PutResult> {
  const blob = await put(`audio/${storyId}/${filename}`, data, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });
  return { url: blob.url, pathname: blob.pathname, contentType: blob.contentType };
}

/** Store a photo or short clip. Returns the blob URL to persist. */
export async function putMedia(
  storyId: string,
  filename: string,
  data: Blob | ArrayBuffer | Buffer,
  contentType?: string,
): Promise<PutResult> {
  const blob = await put(`media/${storyId}/${filename}`, data, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });
  return { url: blob.url, pathname: blob.pathname, contentType: blob.contentType };
}

/**
 * Delete blobs by URL. Used by the cascade story-delete so no audio or media is
 * left orphaned. Ignores empty/nullish entries. Best-effort: a failure here
 * should not block deleting the DB rows, but is logged by the caller.
 */
export async function deleteBlobs(
  urls: Array<string | null | undefined>,
): Promise<void> {
  const toDelete = urls.filter((u): u is string => Boolean(u));
  if (toDelete.length === 0) return;
  await del(toDelete);
}
