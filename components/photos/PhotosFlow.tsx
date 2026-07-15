"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Button, Toast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { compressImage } from "@/lib/image";
import { readExifDate } from "@/lib/exif";
import {
  addMedia,
  assignMediaSection,
  deleteMedia,
  reorderMedia,
  suggestPhotoAssignments,
  updateCaption,
} from "@/lib/actions/media";

type SectionOpt = { id: string; label: string };
type Item = {
  id: string;
  url: string;
  type: "photo" | "clip";
  caption: string;
  sectionId: string | null;
  status: "ready" | "uploading" | "error";
};
type ToastState = { variant: "success" | "error" | "neutral"; text: string };

/**
 * The media step (spec F6). Photos are optional — the story stays valid with
 * none. Images are compressed client-side before upload; the AI suggests which
 * section each belongs to, and every assignment is user-overridable.
 */
export function PhotosFlow({
  storyId,
  sections,
  initialMedia,
}: {
  storyId: string;
  sections: SectionOpt[];
  initialMedia: Omit<Item, "status">[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);
  const [items, setItems] = useState<Item[]>(
    initialMedia.map((m) => ({ ...m, status: "ready" })),
  );
  const [uploading, setUploading] = useState(0);
  const [matching, setMatching] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const patch = useCallback(
    (id: string, next: Partial<Item>) =>
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it))),
    [],
  );

  const handleFiles = useCallback(
    async (files: FileList) => {
      for (const file of Array.from(files)) {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const isVideo = file.type.startsWith("video/");
        const objectUrl = URL.createObjectURL(file);
        setItems((prev) => [
          ...prev,
          {
            id: tempId,
            url: objectUrl,
            type: isVideo ? "clip" : "photo",
            caption: "",
            sectionId: null,
            status: "uploading",
          },
        ]);
        setUploading((n) => n + 1);

        try {
          const exif = isVideo ? null : await readExifDate(file);
          const prepared = await compressImage(file);
          const blob = await upload(
            `media/${storyId}/${prepared.filename}`,
            prepared.blob,
            {
              access: "public",
              handleUploadUrl: "/api/blob/upload",
              clientPayload: JSON.stringify({ storyId }),
              contentType: prepared.type,
            },
          );
          const row = await addMedia({
            storyId,
            url: blob.url,
            type: isVideo ? "clip" : "photo",
            exifDatetime: exif ? exif.toISOString() : null,
          });
          setItems((prev) =>
            prev.map((it) =>
              it.id === tempId
                ? {
                    id: row.id,
                    url: row.storagePath,
                    type: row.type,
                    caption: row.caption ?? "",
                    sectionId: row.sectionId,
                    status: "ready",
                  }
                : it,
            ),
          );
          URL.revokeObjectURL(objectUrl);
        } catch (err) {
          console.error("photo upload failed", err);
          patch(tempId, { status: "error" });
          setToast({ variant: "error", text: "A photo didn’t upload." });
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [storyId, patch],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      const isTemp = id.startsWith("temp-");
      setItems((prev) => prev.filter((it) => it.id !== id));
      if (isTemp) return;
      try {
        await deleteMedia(id);
      } catch (err) {
        console.error(err);
        setToast({ variant: "error", text: "Couldn’t remove that photo." });
      }
    },
    [],
  );

  const handleCaption = useCallback((id: string, value: string) => {
    patch(id, { caption: value });
    updateCaption(id, value).catch((err) => console.error(err));
  }, [patch]);

  const handleAssign = useCallback((id: string, sectionId: string | null) => {
    patch(id, { sectionId });
    assignMediaSection(id, sectionId).catch((err) => console.error(err));
  }, [patch]);

  const persistOrder = useCallback(
    (ordered: Item[]) => {
      const ids = ordered.filter((i) => i.status === "ready").map((i) => i.id);
      reorderMedia(storyId, ids).catch((err) => console.error(err));
    },
    [storyId],
  );

  const handleDrop = useCallback(
    (toIndex: number) => {
      const from = dragFrom.current;
      dragFrom.current = null;
      if (from === null || from === toIndex) return;
      setItems((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(toIndex, 0, moved);
        persistOrder(next);
        return next;
      });
    },
    [persistOrder],
  );

  const handleMatch = useCallback(async () => {
    if (sections.length === 0) return;
    setMatching(true);
    try {
      const assignments = await suggestPhotoAssignments(storyId);
      setItems((prev) =>
        prev.map((it) =>
          it.id in assignments ? { ...it, sectionId: assignments[it.id] } : it,
        ),
      );
      setToast({ variant: "success", text: "Placed your photos in the story." });
    } catch (err) {
      console.error(err);
      setToast({ variant: "error", text: "Couldn’t place the photos." });
    } finally {
      setMatching(false);
    }
  }, [storyId, sections.length]);

  const readyCount = items.filter((i) => i.status === "ready").length;

  return (
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <header className="mb-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight">
          Add photos
        </h1>
        <p className="mt-2 font-sans text-sm text-ink-soft">
          Optional — your story plays beautifully with or without them.
        </p>
      </header>

      <input
        ref={fileInput}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-hairline bg-paper-raised text-ink-soft transition-colors duration-300 ease-keepsake hover:border-ink-soft"
        >
          <span className="font-serif text-lg">Choose photos</span>
          <span className="font-sans text-xs">From your gallery or camera</span>
        </button>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {items.map((it, i) => (
              <div
                key={it.id}
                draggable={it.status === "ready"}
                onDragStart={() => (dragFrom.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(i)}
                className={cn(
                  "overflow-hidden rounded-card border border-hairline bg-paper-raised",
                  it.status !== "ready" && "opacity-70",
                )}
              >
                <div className="relative aspect-square bg-ink/5">
                  {it.type === "clip" ? (
                    <video
                      src={it.url}
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.url}
                      alt={it.caption || "Story photo"}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {it.status === "uploading" && (
                    <div className="absolute inset-0 grid place-items-center bg-cinema/40 font-sans text-xs text-paper">
                      Uploading…
                    </div>
                  )}
                  {it.status === "ready" && (
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => handleRemove(it.id)}
                      className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-cinema/60 text-base leading-none text-paper"
                    >
                      ×
                    </button>
                  )}
                  {it.status === "error" && (
                    <button
                      type="button"
                      onClick={() => handleRemove(it.id)}
                      className="absolute inset-0 grid place-items-center bg-error/70 font-sans text-xs text-paper"
                    >
                      Failed — tap to remove
                    </button>
                  )}
                </div>

                {it.status === "ready" && (
                  <div className="space-y-2 p-2">
                    <input
                      defaultValue={it.caption}
                      onBlur={(e) => handleCaption(it.id, e.target.value)}
                      placeholder="Add a caption"
                      aria-label="Caption"
                      className="w-full bg-transparent font-sans text-xs text-ink placeholder:text-ink-faint focus:outline-none"
                    />
                    {sections.length > 0 && (
                      <select
                        value={it.sectionId ?? ""}
                        onChange={(e) =>
                          handleAssign(it.id, e.target.value || null)
                        }
                        aria-label="Assign to section"
                        className="w-full rounded-md border border-hairline bg-paper px-1.5 py-1 font-sans text-xs text-ink-soft focus:outline-none focus-visible:border-accent"
                      >
                        <option value="">Unplaced</option>
                        {sections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="font-sans text-sm text-ink-soft underline decoration-hairline underline-offset-4 hover:text-ink"
            >
              Add more
            </button>
            {sections.length > 0 && readyCount > 0 && (
              <button
                type="button"
                onClick={handleMatch}
                disabled={matching || uploading > 0}
                className="font-sans text-sm text-accent underline decoration-hairline underline-offset-4 hover:text-accent-press disabled:opacity-50"
              >
                {matching ? "Placing…" : "Place in the story"}
              </button>
            )}
          </div>
        </>
      )}

      <div className="mt-12 border-t border-hairline pt-8">
        <Button
          loading={continuing}
          disabled={uploading > 0}
          onClick={() => {
            setContinuing(true);
            router.push(`/story/${storyId}/preview`);
          }}
        >
          {readyCount > 0 ? "Continue" : "Continue without photos"}
        </Button>
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-6 mx-auto max-w-md px-6">
          <Toast variant={toast.variant} onDismiss={() => setToast(null)}>
            {toast.text}
          </Toast>
        </div>
      )}
    </main>
  );
}
