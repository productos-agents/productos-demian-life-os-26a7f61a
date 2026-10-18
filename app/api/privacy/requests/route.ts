import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { authDb } from "../../../../lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
const globalPrivacy = globalThis as unknown as { privacyRequestsPool?: Pool };
function uid(req: NextRequest) {
  const value = req.headers.get("x-demian-user-id") || "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
function role(req: NextRequest) { return req.headers.get("x-demian-user-role") || "user"; }
async function db() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("Database not configured");
  if (!globalPrivacy.privacyRequestsPool) globalPrivacy.privacyRequestsPool = new Pool({ connectionString: process.env.DEMIAN_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, connectionTimeoutMillis: 8000 });
  return globalPrivacy.privacyRequestsPool;
}
export async function GET(req: NextRequest) {
  const user = uid(req);
  if (!user) return NextResponse.json({ ok: false, error: "Necesitas iniciar sesión." }, { status: 401, headers: noCache });
  try {
    const p = await db();
    if (req.nextUrl.searchParams.get("admin") === "true") {
      if (role(req) !== "legacy") return NextResponse.json({ ok: false, error: "No tienes permiso para revisar solicitudes." }, { status: 403, headers: noCache });
      const result = await p.query("SELECT id,email,request_type,details,status,requested_at,processed_at,resolution_note FROM public.demian_privacy_requests ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END,requested_at ASC LIMIT 200");
      return NextResponse.json({ ok: true, requests: result.rows }, { headers: noCache });
    }
    const result = await p.query("SELECT id,request_type,details,status,requested_at,processed_at,resolution_note FROM public.demian_privacy_requests WHERE user_id=$1 ORDER BY requested_at DESC LIMIT 50", [user]);
    return NextResponse.json({ ok: true, requests: result.rows }, { headers: noCache });
  } catch (error) {
    console.error("DEMian privacy request list:", error);
    return NextResponse.json({ ok: false, error: "No se pudieron cargar las solicitudes." }, { status: 503, headers: noCache });
  }
}
export async function POST(req: NextRequest) {
  const user = uid(req);
  if (!user) return NextResponse.json({ ok: false, error: "Necesitas iniciar sesión." }, { status: 401, headers: noCache });
  try {
    const body = await req.json();
    const type = String(body?.requestType || "");
    const details = String(body?.details || "").trim().slice(0, 1500);
    if (!["access", "correction", "deletion"].includes(type)) return NextResponse.json({ ok: false, error: "Selecciona una solicitud válida." }, { status: 400, headers: noCache });
    if (type === "deletion" && body?.confirmation !== "SOLICITO ELIMINAR MIS DATOS") return NextResponse.json({ ok: false, error: "Confirma expresamente la solicitud de eliminación." }, { status: 400, headers: noCache });
    const identity = await authDb();
    const account = await identity.query("SELECT email FROM public.demian_users WHERE id=$1 LIMIT 1", [user]);
    if (!account.rows[0]) return NextResponse.json({ ok: false, error: "La cuenta ya no existe." }, { status: 404, headers: noCache });
    const p = await db();
    const pending = await p.query("SELECT id FROM public.demian_privacy_requests WHERE user_id=$1 AND request_type=$2 AND status IN ('pending','in_review') ORDER BY requested_at DESC LIMIT 1", [user, type]);
    if (pending.rows[0]) return NextResponse.json({ ok: true, requestId: pending.rows[0].id, status: "pending", existing: true, message: "Ya existe una solicitud abierta de ese tipo." }, { headers: noCache });
    const id = randomUUID();
    await p.query("INSERT INTO public.demian_privacy_requests(id,user_id,email,request_type,details) VALUES($1,$2,$3,$4,$5)", [id, user, account.rows[0].email || "", type, details]);
    return NextResponse.json({ ok: true, requestId: id, status: "pending", message: "Solicitud registrada. La eliminación no se ejecuta automáticamente; debe revisarla el responsable para proteger tus datos." }, { status: 201, headers: noCache });
  } catch (error) {
    console.error("DEMian privacy request create:", error);
    return NextResponse.json({ ok: false, error: "No se pudo registrar la solicitud." }, { status: 503, headers: noCache });
  }
}
export async function PATCH(req: NextRequest) {
  const user = uid(req);
  if (!user) return NextResponse.json({ ok: false, error: "Necesitas iniciar sesión." }, { status: 401, headers: noCache });
  if (role(req) !== "legacy") return NextResponse.json({ ok: false, error: "Solo el responsable puede resolver solicitudes." }, { status: 403, headers: noCache });
  try {
    const body = await req.json();
    const id = String(body?.id || "");
    const status = String(body?.status || "");
    const note = String(body?.resolutionNote || "").trim().slice(0, 1500);
    if (!/^[0-9a-f-]{36}$/i.test(id) || !["in_review", "completed", "rejected"].includes(status)) return NextResponse.json({ ok: false, error: "La actualización no es válida." }, { status: 400, headers: noCache });
    const p = await db();
    const result = await p.query("UPDATE public.demian_privacy_requests SET status=$1,resolution_note=$2,processed_at=CASE WHEN $1='completed' OR $1='rejected' THEN NOW() ELSE NULL END WHERE id=$3 RETURNING id,status,processed_at,resolution_note", [status, note, id]);
    if (!result.rows[0]) return NextResponse.json({ ok: false, error: "No existe esa solicitud." }, { status: 404, headers: noCache });
    return NextResponse.json({ ok: true, request: result.rows[0] }, { headers: noCache });
  } catch (error) {
    console.error("DEMian privacy request update:", error);
    return NextResponse.json({ ok: false, error: "No se pudo actualizar la solicitud." }, { status: 503, headers: noCache });
  }
}
