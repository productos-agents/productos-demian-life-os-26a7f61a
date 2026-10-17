import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import type { NextRequest, NextResponse } from "next/server";

export const LEGACY_USER_ID = "00000000-0000-4000-8000-000000000001";
const globalIdentity = globalThis as unknown as {
  demianIdentityPool?: Pool;
  demianIdentityReady?: Promise<void>;
  demianFluxIdentityPool?: Pool;
};
const SESSION_DAYS = 30;

export type DemianSession = {
  sub: string;
  name: string;
  email: string;
  role: "user" | "legacy";
  fid: string | null;
  exp: number;
};

export type DemianUserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: "user" | "legacy";
  flux_user_id: string | null;
};

function identityDb() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("La base de datos de DEMian no está configurada.");
  if (!globalIdentity.demianIdentityPool) {
    globalIdentity.demianIdentityPool = new Pool({
      connectionString: process.env.DEMIAN_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 4,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 20000
    });
  }
  return globalIdentity.demianIdentityPool;
}

function fluxDb() {
  if (!process.env.FLUX_DATABASE_URL) throw new Error("El módulo financiero no está configurado.");
  if (!globalIdentity.demianFluxIdentityPool) {
    globalIdentity.demianFluxIdentityPool = new Pool({
      connectionString: process.env.FLUX_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 20000
    });
  }
  return globalIdentity.demianFluxIdentityPool;
}

export async function ensureIdentitySchema() {
  if (!globalIdentity.demianIdentityReady) {
    globalIdentity.demianIdentityReady = (async () => {
      const db = identityDb();
      // Schema changes are installed by the database owner during deployment, never at runtime.
      await Promise.all([
        db.query("SELECT id,name,email,password_hash,role,flux_user_id FROM public.demian_users LIMIT 0"),
        db.query("SELECT id,user_id FROM public.demian_items LIMIT 0"),
        db.query("SELECT id,user_id FROM public.demian_wellness_logs LIMIT 0"),
        db.query("SELECT key_hash,attempt_count,window_started_at,blocked_until FROM public.demian_auth_rate_limits LIMIT 0")
      ]);
      const legacyFluxId = process.env.DEMIAN_FLUX_USER_ID;
      if (legacyFluxId) {
        await db.query(
          "UPDATE public.demian_users SET flux_user_id=COALESCE(flux_user_id,$2) WHERE id=$1",
          [LEGACY_USER_ID, legacyFluxId]
        );
      }
    })().catch((error) => {
      globalIdentity.demianIdentityReady = undefined;
      throw error;
    });
  }
  return globalIdentity.demianIdentityReady;
}

function sessionSecret() {
  const secret = process.env.DEMIAN_SESSION_SECRET || process.env.DEMIAN_DATABASE_URL || process.env.DEMIAN_ACCESS_PASSWORD;
  if (!secret) throw new Error("Falta configurar la clave interna de sesiones.");
  return secret;
}
function signPayload(encoded: string) {
  return createHmac("sha256", sessionSecret()).update(encoded).digest("base64url");
}
function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function createSessionToken(user: Omit<DemianSession, "exp">) {
  const payload: DemianSession = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return encoded + "." + signPayload(encoded);
}
export function verifySessionToken(token: string): DemianSession | null {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  try {
    if (!safeEqual(signPayload(encoded), signature)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as DemianSession;
    if (!payload.sub || !payload.name || !payload.email || !["user", "legacy"].includes(payload.role) ||
        !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.fid !== null && typeof payload.fid !== "string") return null;
    return payload;
  } catch { return null; }
}
export function requestSession(req: NextRequest): DemianSession | null {
  const token = req.cookies.get("demian_session")?.value;
  return token ? verifySessionToken(token) : null;
}
export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set("demian_session", token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: "/", maxAge: SESSION_DAYS * 86400
  });
  return res;
}
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set("demian_session", "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: "/", maxAge: 0
  });
  return res;
}
function deriveScrypt(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    const options = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
    import("node:crypto").then(({ scrypt }) => {
      scrypt(password, salt, 64, options, (error, derived) => error ? reject(error) : resolve(derived as Buffer));
    }).catch(reject);
  });
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await deriveScrypt(password, salt);
  return "scrypt$16384$" + salt.toString("base64url") + "$" + derived.toString("base64url");
}
export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt" || parts[1] !== "16384") return false;
  try {
    const salt = Buffer.from(parts[2], "base64url");
    const expected = Buffer.from(parts[3], "base64url");
    const actual = await deriveScrypt(password, salt);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

export async function createFinanceIdentity(user: { id: string; name: string; email: string }) {
  const db = fluxDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const financeEmail = "demian-" + user.id + "@accounts.invalid";
    await client.query(
      "INSERT INTO public.flux_users(id,name,email,password_hash) VALUES($1,$2,$3,$4)",
      [user.id, user.name, financeEmail, "managed-by-demian$" + randomBytes(40).toString("hex")]
    );
    await client.query(
      "INSERT INTO public.flux_accounts(id,user_id,name,account_type,opening_balance,currency,is_active) VALUES" +
      "($1,$3,'Efectivo','cash',0,'MXN',true),($2,$3,'Cuenta bancaria','bank',0,'MXN',true)",
      [randomUUID(), randomUUID(), user.id]
    );
    const cats = [
      ["Salario", "income", "#40C777", "wallet"],
      ["Ventas", "income", "#77DDA3", "trending-up"],
      ["Otros ingresos", "income", "#168BFF", "plus-circle"],
      ["Alimentación", "expense", "#FF6E75", "utensils"],
      ["Transporte", "expense", "#F3C879", "car"],
      ["Vivienda", "expense", "#BCA8FF", "house"],
      ["Servicios", "expense", "#73B7FF", "zap"],
      ["Salud", "expense", "#F19AB5", "heart"],
      ["Otros gastos", "expense", "#A7ADB4", "circle"]
    ];
    for (const [name, type, color, icon] of cats) {
      await client.query(
        "INSERT INTO public.flux_categories(id,user_id,name,type,color,icon,is_default) VALUES($1,$2,$3,$4,$5,$6,true)",
        [randomUUID(), user.id, name, type, color, icon]
      );
    }
    await client.query(
      "INSERT INTO public.flux_preferences(user_id,preferences) VALUES($1,$2::jsonb)",
      [user.id, JSON.stringify({ widgets: { balance: true, trends: true, categories: true, budgets: true, goals: true }, chartMode: "expenses" })]
    );
    await client.query("COMMIT");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally { client.release(); }
}
export async function deleteFinanceIdentity(id: string) {
  try { await fluxDb().query("DELETE FROM public.flux_users WHERE id=$1", [id]); } catch {}
}
export async function getDemianUser(id: string) {
  await ensureIdentitySchema();
  const result = await identityDb().query(
    "SELECT id,name,email,password_hash,role,flux_user_id FROM public.demian_users WHERE id=$1 LIMIT 1", [id]
  );
  return result.rows[0] as DemianUserRow | undefined;
}
export async function authDb() { await ensureIdentitySchema(); return identityDb(); }
export async function recordAuthFailure(req: NextRequest) {
  const db = identityDb();
  const raw = (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",").at(-1) || "unknown").trim().slice(0, 200);
  const key = (await import("node:crypto")).createHash("sha256").update("demian-auth-rate-v1:" + raw).digest("hex");
  await db.query(
    "INSERT INTO public.demian_auth_rate_limits(key_hash,attempt_count,window_started_at,updated_at) VALUES($1,1,NOW(),NOW()) " +
    "ON CONFLICT(key_hash) DO UPDATE SET attempt_count=CASE WHEN public.demian_auth_rate_limits.window_started_at<NOW()-INTERVAL '15 minutes' THEN 1 ELSE public.demian_auth_rate_limits.attempt_count+1 END, " +
    "window_started_at=CASE WHEN public.demian_auth_rate_limits.window_started_at<NOW()-INTERVAL '15 minutes' THEN NOW() ELSE public.demian_auth_rate_limits.window_started_at END, " +
    "blocked_until=CASE WHEN (CASE WHEN public.demian_auth_rate_limits.window_started_at<NOW()-INTERVAL '15 minutes' THEN 1 ELSE public.demian_auth_rate_limits.attempt_count+1 END)>=8 " +
    "THEN NOW()+INTERVAL '15 minutes' ELSE NULL END,updated_at=NOW()",
    [key]
  );
}
export async function authIsBlocked(req: NextRequest) {
  const db = identityDb();
  const raw = (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",").at(-1) || "unknown").trim().slice(0, 200);
  const { createHash } = await import("node:crypto");
  const key = createHash("sha256").update("demian-auth-rate-v1:" + raw).digest("hex");
  const result = await db.query("SELECT blocked_until FROM public.demian_auth_rate_limits WHERE key_hash=$1", [key]);
  const blockedUntil = result.rows[0]?.blocked_until ? new Date(result.rows[0].blocked_until).getTime() : 0;
  return Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
}
export async function clearAuthFailures(req: NextRequest) {
  const db = identityDb();
  const raw = (req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",").at(-1) || "unknown").trim().slice(0, 200);
  const { createHash } = await import("node:crypto");
  const key = createHash("sha256").update("demian-auth-rate-v1:" + raw).digest("hex");
  await db.query("DELETE FROM public.demian_auth_rate_limits WHERE key_hash=$1", [key]);
}
