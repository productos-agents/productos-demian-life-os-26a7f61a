import { NextRequest, NextResponse } from "next/server";
import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  LEGACY_USER_ID, authDb, authIsBlocked, clearAuthFailures, createFinanceIdentity,
  createSessionToken, deleteFinanceIdentity, ensureIdentitySchema, hashPassword,
  requestSession, setSessionCookie, verifyPassword, type DemianUserRow
} from "../../../lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store, max-age=0" };

function sameText(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function startSession(user: { id: string; name: string; email: string; role: "user" | "legacy"; flux_user_id: string | null }) {
  return createSessionToken({ sub: user.id, name: user.name, email: user.email, role: user.role, fid: user.flux_user_id });
}
function publicUser(user: { id: string; name: string; email: string; role: string }) {
  return { id: user.id, name: user.name, email: user.role === "legacy" ? null : user.email };
}

export async function GET(req: NextRequest) {
  try {
    await ensureIdentitySchema();
    const session = requestSession(req);
    if (!session) return NextResponse.json({ ok: true, authenticated: false, user: null }, { headers: noCache });
    const { rows } = await (await authDb()).query(
      "SELECT id,name,email,role FROM public.demian_users WHERE id=$1 LIMIT 1", [session.sub]
    );
    if (!rows[0]) return NextResponse.json({ ok: true, authenticated: false, user: null }, { headers: noCache });
    return NextResponse.json({ ok: true, authenticated: true, user: publicUser(rows[0]) }, { headers: noCache });
  } catch (error) {
    console.error("DEMian auth status:", error);
    return NextResponse.json({ ok: false, error: "No se pudo verificar la cuenta." }, { status: 503, headers: noCache });
  }
}

export async function POST(req: NextRequest) {
  let body: { action?: string; name?: string; email?: string; password?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400, headers: noCache }); }
  const action = String(body.action || "login");
  const password = String(body.password || "");
  if (password.length > 256) return NextResponse.json({ ok: false, error: "La contraseña es demasiado larga." }, { status: 400, headers: noCache });

  try {
    await ensureIdentitySchema();
    const blocked = await authIsBlocked(req);
    if (blocked > 0) return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Prueba de nuevo en unos minutos." },
      { status: 429, headers: { ...noCache, "Retry-After": String(blocked) } }
    );

    if (action === "register") {
      const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
      const email = String(body.email || "").trim().toLowerCase();
      if (name.length < 2) return NextResponse.json({ ok: false, error: "Escribe tu nombre (mínimo 2 caracteres)." }, { status: 400, headers: noCache });
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ ok: false, error: "Escribe un correo electrónico válido." }, { status: 400, headers: noCache });
      }
      if (password.length < 10) return NextResponse.json({ ok: false, error: "Usa una contraseña de al menos 10 caracteres." }, { status: 400, headers: noCache });
      const db = await authDb();
      const duplicate = await db.query("SELECT 1 FROM public.demian_users WHERE LOWER(email)=LOWER($1) LIMIT 1", [email]);
      if (duplicate.rows.length) return NextResponse.json({ ok: false, error: "Ya existe una cuenta con ese correo. Inicia sesión." }, { status: 409, headers: noCache });

      const id = randomUUID();
      const passwordHash = await hashPassword(password);
      const created = await db.query(
        "INSERT INTO public.demian_users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'user') RETURNING id,name,email,role,flux_user_id",
        [id, name, email, passwordHash]
      );
      try {
        await createFinanceIdentity({ id, name, email });
        await db.query("UPDATE public.demian_users SET flux_user_id=$2 WHERE id=$1", [id, id]);
        created.rows[0].flux_user_id = id;
      } catch (error) {
        await db.query("DELETE FROM public.demian_users WHERE id=$1", [id]);
        await deleteFinanceIdentity(id);
        console.error("DEMian finance account bootstrap failed:", error);
        return NextResponse.json({ ok: false, error: "No se pudo preparar tu espacio financiero. Inténtalo de nuevo más tarde." }, { status: 503, headers: noCache });
      }
      await clearAuthFailures(req);
      const res = NextResponse.json({ ok: true, user: publicUser(created.rows[0]) }, { headers: noCache });
      setSessionCookie(res, startSession(created.rows[0]));
      return res;
    }

    if (action === "legacy") {
      const oldKey = process.env.DEMIAN_ACCESS_PASSWORD;
      if (!oldKey) return NextResponse.json({ ok: false, error: "El acceso anterior no está habilitado." }, { status: 403, headers: noCache });
      if (!sameText(password, oldKey)) {
        await authDb();
        await import("../../../lib/identity").then(m => m.recordAuthFailure(req));
        const retry = await authIsBlocked(req);
        return NextResponse.json({ ok: false, error: "La clave anterior no es correcta." }, {
          status: retry ? 429 : 401, headers: { ...noCache, ...(retry ? { "Retry-After": String(retry) } : {}) }
        });
      }
      const db = await authDb();
      const result = await db.query(
        "SELECT id,name,email,role,flux_user_id FROM public.demian_users WHERE id=$1 LIMIT 1", [LEGACY_USER_ID]
      );
      if (!result.rows[0]) return NextResponse.json({ ok: false, error: "No se encontró el espacio anterior." }, { status: 503, headers: noCache });
      await clearAuthFailures(req);
      const res = NextResponse.json({ ok: true, user: publicUser(result.rows[0]) }, { headers: noCache });
      setSessionCookie(res, startSession(result.rows[0]));
      return res;
    }

    const email = String(body.email || "").trim().toLowerCase();
    if (!email || !password) return NextResponse.json({ ok: false, error: "Escribe tu correo y contraseña." }, { status: 400, headers: noCache });
    const db = await authDb();
    const result = await db.query(
      "SELECT id,name,email,password_hash,role,flux_user_id FROM public.demian_users WHERE LOWER(email)=LOWER($1) AND role='user' LIMIT 1",
      [email]
    );
    const user = result.rows[0] as DemianUserRow | undefined;
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      const { recordAuthFailure } = await import("../../../lib/identity");
      await recordAuthFailure(req);
      const retry = await authIsBlocked(req);
      return NextResponse.json({ ok: false, error: "Correo o contraseña incorrectos." }, {
        status: retry ? 429 : 401, headers: { ...noCache, ...(retry ? { "Retry-After": String(retry) } : {}) }
      });
    }
    await clearAuthFailures(req);
    const res = NextResponse.json({ ok: true, user: publicUser(user) }, { headers: noCache });
    setSessionCookie(res, startSession(user));
    return res;
  } catch (error) {
    console.error("DEMian auth POST:", error);
    return NextResponse.json({ ok: false, error: "El servicio de cuentas no está disponible. Inténtalo de nuevo." }, { status: 503, headers: noCache });
  }
}

export async function DELETE() {
  const { clearSessionCookie } = await import("../../../lib/identity");
  return clearSessionCookie(NextResponse.json({ ok: true }, { headers: noCache }));
}
