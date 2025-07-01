
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const AUTH_TOKEN_COOKIE_NAME = 'firebaseIdToken';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authTokenCookie = request.cookies.get(AUTH_TOKEN_COOKIE_NAME);
  const isAuthenticated = !!authTokenCookie; // Check presence of the cookie

  const publicPaths = ['/login', '/signup', '/landing'];
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // If the user is at the root path
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/chat', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // If the user is trying to access a public path
  if (isPublicPath) {
    // If authenticated and on a public page like login/signup, redirect to chat.
    // They can still access /landing if they are logged in, which is fine.
    if (isAuthenticated && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
      return NextResponse.redirect(new URL('/chat', request.url));
    }
    // Allow access to public paths for everyone else
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
