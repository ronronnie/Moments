import { auth } from "@clerk/nextjs/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stories } from "@/db/schema";

/**
 * Client-upload token endpoint for audio segments. The browser uploads audio
 * straight to Vercel Blob (avoiding our function's request-body limit for long
 * recordings); this route only mints a scoped, short-lived upload token after
 * verifying the signed-in user owns the target story.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized.");

        const { storyId } = JSON.parse(clientPayload ?? "{}") as {
          storyId?: string;
        };
        if (!storyId) throw new Error("Missing storyId.");

        const [owned] = await db
          .select({ id: stories.id })
          .from(stories)
          .where(and(eq(stories.id, storyId), eq(stories.ownerId, userId)));
        if (!owned) throw new Error("Not your story.");

        return {
          allowedContentTypes: [
            // audio segments
            "audio/webm",
            "audio/mp4",
            "audio/mpeg",
            "audio/aac",
            "audio/ogg",
            "audio/wav",
            // photos + short clips (spec F6)
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif",
            "video/mp4",
            "video/quicktime",
            "video/webm",
          ],
          maximumSizeInBytes: 50 * 1024 * 1024, // audio + compressed media
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ storyId }),
        };
      },
      // Transcription runs from an authed server action after upload, so this
      // callback is intentionally a no-op (it also can't fire on localhost).
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }
}
