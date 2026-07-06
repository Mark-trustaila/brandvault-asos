import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Sign-in / sign-up are public; everything else (dashboard + API) requires auth.
// Slack and cron endpoints are also public here — they carry no Clerk session
// (Slack signs its requests, cron uses CRON_SECRET, and the routes enforce their
// own auth), so Clerk's auth.protect() must not block them.
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/slack/(.*)',
  '/api/cron/(.*)',
  // Postmark inbound webhook — no Clerk session; verified by its own shared
  // secret. Must be public or Clerk's auth.protect() would 404 it.
  '/api/email/(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except Next internals and static files...
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|gif|png|svg|ico|webp|woff2?|ttf|map)).*)',
    // ...and always on API routes.
    '/(api|trpc)(.*)',
  ],
};
