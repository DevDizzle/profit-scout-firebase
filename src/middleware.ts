
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const AUTH_TOKEN_COOKIE_NAME = 'firebaseIdToken';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authTokenCookie = request.cookies.get(AUTH_TOKEN_COOKIE_NAME);
  const isAuthenticated = !!authTokenCookie; // Check presence of the cookie

  const publicPaths = ['/login', '/signup'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // If the user is at the root path
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/chat', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // If the user is trying to access a public path (login/signup)
  if (isPublicPath) {
    if (isAuthenticated) {
      // If authenticated, redirect away from login/signup to chat
      return NextResponse.redirect(new URL('/chat', request.url));
    }
    // If not authenticated, allow access to public paths
    return NextResponse.next();
  }

  // For all other paths (assumed to be protected)
  if (!isAuthenticated) {
    // If not authenticated, redirect to login
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
