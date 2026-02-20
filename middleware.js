// middleware.js
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/verify-success",
  "/auth/verify-failed",
  "/auth/login",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/_next",
  "/assets",
];
const DASHBOARD_PREFIX = "/dashboard";

// Cookie adını backend'deki http-only access token cookie adıyla eşleştir
const TOKEN_COOKIE_NAME = "accessToken";

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p)
  );
  const token = req.cookies.get(TOKEN_COOKIE_NAME)?.value;

  // 1) Token yoksa ve korumalı alana giriyorsa → /login
  if (!token && (pathname === "/" || pathname.startsWith(DASHBOARD_PREFIX))) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // 2) Token varsa ve /login veya kök sayfadaysa → /dashboard
  if (token && (pathname === "/" || pathname === "/auth/login")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // 3) Public yolları ve normal akışı devam ettir
  if (isPublic) return NextResponse.next();
  return NextResponse.next();
}

// Sadece gerekli path'lerde çalışsın
export const config = {
  matcher: [
    "/", // kök
    "/auth/login", // login
    "/dashboard/:path*", // dashboard ve alt sayfalar
  ],
};
