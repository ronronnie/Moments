import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public surfaces: the landing page, the recipient view (no account ever), the
// design workbench, and Clerk's own auth routes. Everything else — creating and
// managing stories — requires a signed-in teller.
const isPublicRoute = createRouteMatcher([
  "/",
  "/s/(.*)", // recipient view — token-validated in the route itself
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/dev/(.*)", // design system workbench
  "/api/webhooks/(.*)",
  // Blob client-upload endpoint: Vercel's upload-completed callback has no
  // Clerk cookies, so the route is public and enforces auth inside the
  // token-generation step instead.
  "/api/blob/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except Next internals and static files, unless in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run on API routes.
    "/(api|trpc)(.*)",
  ],
};
