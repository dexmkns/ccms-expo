// utils/supabase/middleware.ts

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 1. Get User
  const { data: { user } } = await supabase.auth.getUser();

  // 2. PROTECT ADMIN ROUTES
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // A. Not logged in? -> Go to Login
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // B. Logged in but WRONG ROLE? -> Kick them out
    // Assuming you store 'role' in user_metadata. 
    // If you don't, you might need to fetch it from a 'users' table.
    const userRole = user.user_metadata?.role; 
    
    if (userRole !== 'admin') {
       // If a Judge tries to access Admin, send them to Judge Dashboard
       return NextResponse.redirect(new URL('/judge/dashboard', request.url));
    }
  }

  // 3. PROTECT JUDGE ROUTES
  if (request.nextUrl.pathname.startsWith('/judge')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Optional: Prevent Admins from accidental voting? 
    // Usually Admins can see everything, so we might not block them here.
  }

  return response;
}