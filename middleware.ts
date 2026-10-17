import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
function expectedToken(password: string) { return createHmac("sha256", password).update("demian-session-v1").digest("hex"); }
export function middleware(req: NextRequest) {
  const password = process.env.DEMIAN_ACCESS_PASSWORD;
  const isLogin = req.nextUrl.pathname === "/login" || req.nextUrl.pathname.startsWith("/api/auth");
  if (isLogin) return NextResponse.next();
  if (!password) return NextResponse.redirect(new URL("/login?setup=1", req.url));
  const token = req.cookies.get("demian_session")?.value ?? "";
  const expected = expectedToken(password);
  const valid = token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (valid) {
    if (req.nextUrl.pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ok:false,error:"Sesión requerida."},{status:401});
  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js).*)"] };