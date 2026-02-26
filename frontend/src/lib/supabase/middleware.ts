import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Define protected routes
  const protectedPaths = ["/books", "/librarian", "/reader", "/onboarding"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Redirect unauthenticated users to login
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Profile-based guards for authenticated users on protected paths
  if (user && isProtectedPath) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    // No profile → force onboarding (unless already there)
    if (!profile && request.nextUrl.pathname !== "/onboarding") {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Has profile → skip onboarding if they land there
    if (profile && request.nextUrl.pathname === "/onboarding") {
      const url = request.nextUrl.clone();
      url.pathname = "/books";
      return NextResponse.redirect(url);
    }

    // Librarian route guard
    if (request.nextUrl.pathname.startsWith("/librarian") && profile?.role !== "librarian") {
      const url = request.nextUrl.clone();
      url.pathname = "/books";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
