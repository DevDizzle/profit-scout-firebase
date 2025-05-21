import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const AUTH_TOKEN_COOKIE_NAME = 'firebaseIdToken'; // Adjust if you use a different cookie name for auth status

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = request.cookies.has(AUTH_TOKEN_COOKIE_NAME) || (!!request.headers.get('Authorization'));


  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  if (isPublicPath) {
    if (isAuthenticated) {
      // If user is authenticated and tries to access login/signup, redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // Allow access to public paths if not authenticated
    return NextResponse.next();
  }

  // For all other paths (protected routes)
  if (!isAuthenticated) {
    // If user is not authenticated, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If authenticated and accessing a protected path, allow access
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (public assets folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|assets).*)',
  ],
};
