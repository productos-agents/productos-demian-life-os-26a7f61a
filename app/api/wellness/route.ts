import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { ensureIdentitySchema } from "../../../lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const globalWellness = globalThis as unknown as { wellnessPool?: Pool; wellnessReady?: Promise<void> };
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
function db() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("La base de datos de DEMian no está configurada.");
  if (!globalWellness.wellnessPool) globalWellness.wellnessPool = new Pool({
    connectionString: process.env.DEMIAN_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3,
    connectionTimeoutMillis: 8000, idleTimeoutMillis: 20000
  });
  return globalWellness.wellnessPool;
}
async function ready() {
  await ensureIdentitySchema();
  if (!globalWellness.wellnessReady) globalWellness.wellnessReady = db().query("SELECT 1 FROM public.demian_wellness_logs LIMIT 0").then(() => {}).catch(error => {
    globalWellness.wellnessReady = undefined; throw error;
  });
  return globalWellness.wellnessReady;
}
function userId(req: NextRequest) {
  const id = req.headers.get("x-demian-user-id") || "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}
function unauthenticated() {
  return NextResponse.json({ ok: false, error: "Necesitas iniciar sesión." }, { status: 401, headers: noCache });
}
function toNum(value: unknown, min: number, max: number, decimals = 0): number | null {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error("Hay un valor fuera del rango permitido.");
  return decimals ? Math.round(n * 10 ** decimals) / 10 ** decimals : Math.round(n);
}
async function listLogs(uid: string) {
  const { rows } = await db().query(
    "SELECT id,log_date::text AS log_date,sleep_hours::float8 AS sleep_hours,water_glasses,activity_minutes,mood,weight_kg::float8 AS weight_kg,notes,created_at,updated_at " +
    "FROM public.demian_wellness_logs WHERE user_id=$1 ORDER BY log_date DESC LIMIT 90", [uid]
  );
  return rows;
}
export async function GET(req: NextRequest) {
  const uid = userId(req);
  if (!uid) return unauthenticated();
  try {
    await ready();
    return NextResponse.json({ ok: true, logs: await listLogs(uid) }, { headers: noCache });
  } catch (error) {
    console.error("DEMian wellness GET:", error);
    return NextResponse.json({ ok: false, error: "No se pudo cargar el registro de bienestar." }, { status: 503, headers: noCache });
  }
}
export async function POST(req: NextRequest) {
  const uid = userId(req);
  if (!uid) return unauthenticated();
  try {
    await ready();
    const body = await req.json();
    const date = String(body.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false, error: "Selecciona una fecha válida." }, { status: 400, headers: noCache });
    const sleep = toNum(body.sleepHours, 0, 24, 2);
    const water = toNum(body.waterGlasses, 0, 50);
    const activity = toNum(body.activityMinutes, 0, 1440);
    const mood = toNum(body.mood, 1, 5);
    const weight = toNum(body.weightKg, 0.1, 500, 2);
    const notes = String(body.notes ?? "").trim().slice(0, 2000);
    if ([sleep, water, activity, mood, weight].every(v => v === null) && !notes) return NextResponse.json({ ok: false, error: "Registra al menos un dato o una nota." }, { status: 400, headers: noCache });
    const { rows } = await db().query(
      "INSERT INTO public.demian_wellness_logs(user_id,log_date,sleep_hours,water_glasses,activity_minutes,mood,weight_kg,notes,updated_at) " +
      "VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()) ON CONFLICT(user_id,log_date) DO UPDATE SET " +
      "sleep_hours=EXCLUDED.sleep_hours,water_glasses=EXCLUDED.water_glasses,activity_minutes=EXCLUDED.activity_minutes," +
      "mood=EXCLUDED.mood,weight_kg=EXCLUDED.weight_kg,notes=EXCLUDED.notes,updated_at=NOW() " +
      "RETURNING id,log_date::text AS log_date,sleep_hours::float8 AS sleep_hours,water_glasses,activity_minutes,mood,weight_kg::float8 AS weight_kg,notes,created_at,updated_at",
      [uid, date, sleep, water, activity, mood, weight, notes]
    );
    return NextResponse.json({ ok: true, log: rows[0] }, { status: 201, headers: noCache });
  } catch (error) {
    console.error("DEMian wellness POST:", error);
    const message = error instanceof Error ? error.message : "No se pudo guardar el registro.";
    return NextResponse.json({ ok: false, error: message.includes("rango permitido") ? message : "No se pudo guardar el registro de bienestar." }, { status: 400, headers: noCache });
  }
}
export async function DELETE(req: NextRequest) {
  const uid = userId(req);
  if (!uid) return unauthenticated();
  try {
    await ready();
    const date = String(new URL(req.url).searchParams.get("date") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false, error: "Fecha inválida." }, { status: 400, headers: noCache });
    const { rowCount } = await db().query("DELETE FROM public.demian_wellness_logs WHERE log_date=$1::date AND user_id=$2", [date, uid]);
    if (!rowCount) return NextResponse.json({ ok: false, error: "No existe un registro para esa fecha." }, { status: 404, headers: noCache });
    return NextResponse.json({ ok: true }, { headers: noCache });
  } catch (error) {
    console.error("DEMian wellness DELETE:", error);
    return NextResponse.json({ ok: false, error: "No se pudo eliminar el registro de bienestar." }, { status: 503, headers: noCache });
  }
}
