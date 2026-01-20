import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // --- 1. SETUP SUPABASE CLIENT (For Admin Auth) ---
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // --- 2. PROTECT ADMIN ROUTES (Standard Supabase Auth) ---
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Get the current user from Supabase
    const { data: { user } } = await supabase.auth.getUser();

    // If no admin user found, kick them to login
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // --- 3. PROTECT JUDGE ROUTES (Custom PIN/Cookie Auth) ---
  if (request.nextUrl.pathname.startsWith('/judge')) {
    // Extract Judge ID from URL: /judge/[judgeId]/dashboard
    const pathParts = request.nextUrl.pathname.split('/'); 
    const judgeId = pathParts[2]; // Index 2 is the ID

    // We only strictly protect if we have an ID in the URL
    if (judgeId) {
      // Check for the specific cookie for THIS judge ID
      const judgeSession = request.cookies.get(`ccms-judge-${judgeId}`);

      // If cookie is missing, kick them to login
      if (!judgeSession) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match Admin and Judge routes (and exclude static files)
    '/admin/:path*',
    '/judge/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};