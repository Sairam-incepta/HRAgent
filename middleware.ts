import { authMiddleware } from '@clerk/nextjs';

export default authMiddleware({
  // Make sign-in and sign-up routes public
  publicRoutes: ['/sign-in', '/sign-up', '/sign-in/(.*)', '/sign-up/(.*)'],
  // Redirect to sign-in when not authenticated
  afterAuth(auth, req, evt) {
    // If user is not authenticated and trying to access a protected route
    if (!auth.userId && !auth.isPublicRoute) {
      const signInUrl = new URL('/sign-in', req.url);
      return Response.redirect(signInUrl);
    }
    
    // If user is authenticated and on a public route, redirect to dashboard
    if (auth.userId && auth.isPublicRoute && req.nextUrl.pathname !== '/dashboard') {
      const dashboardUrl = new URL('/dashboard', req.url);
      return Response.redirect(dashboardUrl);
    }
  },
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};