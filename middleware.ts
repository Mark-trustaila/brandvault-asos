import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Sign-in / sign-up are public; everything else (dashboard + API) requires auth.
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

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
