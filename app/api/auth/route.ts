import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Pool, PoolClient } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const globalAuth = globalThis as unknown as { demianAuthPool?: Pool };

function tokenFor(password: string) {
  return createHmac("sha256", password).update("demian-session-v1").digest("hex");
}
function constantTimeEqual(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function authPool() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("DEMIAN_DATABASE_URL no está configurada");
  if (!globalAuth.demianAuthPool) {
    globalAuth.demianAuthPool = new Pool({
      connectionString: process.env.DEMIAN_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 20000
    });
  }
  return globalAuth.demianAuthPool;
}
function clientKey(req: NextRequest) {
  // Prefer the platform-set direct-IP header. Store only a one-way hash, never the raw address.
  const address = (req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",").at(-1) ||
    "unknown").trim().slice(0, 200);
  return createHash("sha256").update("demian-auth-rate-v1:" + address).digest("hex");
}
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export async function GET(req: NextRequest) {
  const secret = process.env.DEMIAN_ACCESS_PASSWORD;
  if (!secret) return NextResponse.json({ ok: false, configured: false }, { status: 503, headers: noCache });
  const actual = req.cookies.get("demian_session")?.value ?? "";
  const authenticated = constantTimeEqual(actual, tokenFor(secret));
  return NextResponse.json({ ok: true, authenticated }, { headers: noCache });
}

export async function POST(req: NextRequest) {
  const secret = process.env.DEMIAN_ACCESS_PASSWORD;
  if (!secret) return NextResponse.json({ ok: false, error: "La clave de acceso no está configurada." }, { status: 503, headers: noCache });
  let body: { password?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400, headers: noCache }); }

  let client: PoolClient | undefined;
  try {
    client = await authPool().connect();
    await client.query("BEGIN");
    const key = clientKey(req);

    // Serialize attempts per source key so concurrent requests cannot bypass the limit.
    await client.query(
      "INSERT INTO public.demian_auth_rate_limits(key_hash,attempt_count,window_started_at,updated_at) VALUES($1,0,NOW(),NOW()) ON CONFLICT(key_hash) DO NOTHING",
      [key]
    );
    const { rows } = await client.query(
      "SELECT attempt_count,window_started_at,blocked_until FROM public.demian_auth_rate_limits WHERE key_hash=$1 FOR UPDATE",
      [key]
    );
    const state = rows[0] as { attempt_count: number; window_started_at: Date|string; blocked_until: Date|string|null }|undefined;
    if (!state) throw new Error("No se pudo inicializar el limitador de acceso.");

    const now = Date.now();
    const blockedUntil = state.blocked_until ? new Date(state.blocked_until).getTime() : 0;
    if (blockedUntil > now) {
      await client.query("COMMIT");
      const retry = Math.max(1, Math.ceil((blockedUntil-now)/1000));
      return NextResponse.json({ ok: false, error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." }, {
        status: 429, headers: { ...noCache, "Retry-After": String(retry) }
      });
    }

    const expired = now - new Date(state.window_started_at).getTime() >= WINDOW_MS;
    const priorFailures = expired ? 0 : Number(state.attempt_count);
    const supplied = String(body.password ?? "");
    const valid = constantTimeEqual(supplied, secret);

    if (!valid) {
      const failures = priorFailures + 1;
      const blocked = failures >= MAX_FAILURES;
      await client.query(
        "UPDATE public.demian_auth_rate_limits SET attempt_count=$2,window_started_at=CASE WHEN $3 THEN NOW() ELSE window_started_at END,blocked_until=CASE WHEN $4 THEN NOW()+INTERVAL '15 minutes' ELSE NULL END,updated_at=NOW() WHERE key_hash=$1",
        [key, failures, expired, blocked]
      );
      await client.query("COMMIT");
      return NextResponse.json(
        { ok: false, error: blocked ? "Límite de intentos alcanzado. El acceso queda bloqueado durante 15 minutos." : "Clave incorrecta." },
        { status: blocked ? 429 : 401, headers: { ...noCache, ...(blocked ? { "Retry-After": "900" } : {}) } }
      );
    }

    await client.query(
      "UPDATE public.demian_auth_rate_limits SET attempt_count=0,window_started_at=NOW(),blocked_until=NULL,updated_at=NOW() WHERE key_hash=$1",
      [key]
    );
    await client.query("COMMIT");
    const res = NextResponse.json({ ok: true }, { headers: noCache });
    res.cookies.set("demian_session", tokenFor(secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
    return res;
  } catch (error) {
    if (client) { try { await client.query("ROLLBACK"); } catch {} }
    console.error("DEMian auth:", error);
    // Fail closed if the persistent rate limiter cannot be checked.
    return NextResponse.json({ ok: false, error: "El servicio de acceso no está disponible; inténtalo de nuevo." }, { status: 503, headers: noCache });
  } finally {
    client?.release();
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { headers: noCache });
  res.cookies.set("demian_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
  return res;
}