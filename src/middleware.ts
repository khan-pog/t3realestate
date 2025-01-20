// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Add admin route pattern
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/admin(.*)"]);

export default clerkMiddleware((auth, request) => {
  if (isProtectedRoute(request)) auth().protect();
});

export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next|api/uploadthing).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
