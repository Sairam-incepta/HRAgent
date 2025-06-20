import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  // Let Clerk handle all authentication automatically
  // Don't make any routes public - let Clerk handle redirects
  publicRoutes: ["/", "/sign-in", "/sign-up"],
});

export const config = {
  matcher: [
    // Protect everything except sign-in, sign-up, and static files
    "/((?!_next|sign-in|sign-up|api|static|favicon.ico|public).*)",
    "/api/(.*)",
  ],
};