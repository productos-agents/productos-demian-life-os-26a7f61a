import { NextRequest, NextResponse } from "next/server";

async function expectedSignature(encoded: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function decodePayload(encoded: string): { sub: string; name: string; email: string; role: "user" | "legacy"; fid: string | null; exp: number } | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((encoded.length + 3) % 4);
    const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof p.sub !== "string" || typeof p.name !== "string" || typeof p.email !== "string" ||
        !["user", "legacy"].includes(p.role) || (p.fid !== null && typeof p.fid !== "string") ||
        typeof p.exp !== "number" || p.exp <= Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch { return null; }
}
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic = path === "/login" || path === "/register" || path === "/manifest.webmanifest" || path === "/icon-192.png" || path === "/icon-512.png" || path === "/apple-touch-icon.png" || path === "/jdo-services-logo.webp" || path.startsWith("/api/auth");
  if (isPublic) return NextResponse.next();

  const secret = process.env.DEMIAN_SESSION_SECRET || process.env.DEMIAN_DATABASE_URL || process.env.DEMIAN_ACCESS_PASSWORD;
  const token = req.cookies.get("demian_session")?.value ?? "";
  const [encoded, signature, extra] = token.split(".");
  let payload: ReturnType<typeof decodePayload> = null;
  if (secret && encoded && signature && !extra) {
    const expected = await expectedSignature(encoded, secret);
    if (constantTimeEqual(signature, expected)) payload = decodePayload(encoded);
  }
  if (!payload) {
    if (path.startsWith("/api/")) return NextResponse.json({ ok: false, error: "Necesitas iniciar sesión." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    const url = new URL("/login", req.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-demian-user-id", payload.sub);
  requestHeaders.set("x-demian-user-role", payload.role);
  if (payload.fid) requestHeaders.set("x-demian-flux-user-id", payload.fid);
  else requestHeaders.delete("x-demian-flux-user-id");
  return NextResponse.next({ request: { headers: requestHeaders } });
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js).*)"] };
