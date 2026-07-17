import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { shareLinks } from "@/db/schema";

/**
 * Client-upload token endpoint for recipient VOICE replies (spec F8). Recipients
 * have no account, so unlike the owner upload route this authorizes by a valid,
 * un-revoked share token (passed in clientPayload) rather than Clerk auth. Audio
 * only, small cap (voice replies are ≤60s). Public route — see middleware.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const { token } = JSON.parse(clientPayload ?? "{}") as {
          token?: string;
        };
        if (!token) throw new Error("Missing share token.");

        const [link] = await db
          .select({ storyId: shareLinks.storyId })
          .from(shareLinks)
          .where(and(eq(shareLinks.token, token), isNull(shareLinks.revokedAt)));
        if (!link) throw new Error("This story is no longer available.");

        return {
          allowedContentTypes: [
            "audio/webm",
            "audio/mp4",
            "audio/mpeg",
            "audio/aac",
            "audio/ogg",
            "audio/wav",
          ],
          maximumSizeInBytes: 15 * 1024 * 1024, // a 60s reply is well under this
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ storyId: link.storyId }),
        };
      },
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
