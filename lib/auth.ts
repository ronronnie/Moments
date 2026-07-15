import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { profiles } from "@/db/schema";

/**
 * The signed-in Clerk user id, or a redirect to sign-in. Use in any server
 * component / action that requires an owner. Middleware already gates these
 * routes; this is the in-code guarantee (and gives us the id).
 */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return userId;
}

/** The signed-in Clerk user id, or null. */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/**
 * Make sure a `profiles` row exists for the current user, mirroring their
 * display name from Clerk. Called on landing in the app after sign-in — cheap
 * upsert, so a Clerk webhook isn't required for the MVP. Returns the user id.
 */
export async function ensureProfile(): Promise<string> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const displayName =
    user.firstName ??
    user.username ??
    user.primaryEmailAddress?.emailAddress ??
    null;

  await db
    .insert(profiles)
    .values({ id: user.id, displayName })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { displayName },
    });

  return user.id;
}
