import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
const globalMood = globalThis as unknown as { demianMoodPool?: Pool };

function db() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("La base de datos de DEMian no está configurada.");
  if (!globalMood.demianMoodPool) globalMood.demianMoodPool = new Pool({
    connectionString: process.env.DEMIAN_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3,
    connectionTimeoutMillis: 8000, idleTimeoutMillis: 20000
  });
  return globalMood.demianMoodPool;
}
function userId(req: NextRequest) {
  const id = req.headers.get("x-demian-user-id") || "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}
function unauthenticated() {
  return NextResponse.json({ ok: false, error: "Inicia sesión para guardar tu check-in." }, { status: 401, headers: noCache });
}
export async function GET(req: NextRequest) {
  const uid = userId(req);
  if (!uid) return unauthenticated();
  try {
    const { rows } = await db().query(
      "SELECT id,checkin_date::text AS checkin_date,time_slot,mood,note,created_at FROM public.demian_mood_checkins WHERE user_id=$1 ORDER BY created_at DESC LIMIT 90",
      [uid]
    );
    return NextResponse.json({ ok: true, checkins: rows }, { headers: noCache });
  } catch (error) {
    console.error("DEMian mood GET:", error);
    return NextResponse.json({ ok: false, error: "No se pudieron cargar tus check-ins." }, { status: 503, headers: noCache });
  }
}
export async function POST(req: NextRequest) {
  const uid = userId(req);
  if (!uid) return unauthenticated();
  try {
    const body = await req.json();
    const mood = Number(body?.mood);
    const note = String(body?.note || "").trim().slice(0, 800);
    const rawSlot = String(body?.timeSlot || "manual").trim();
    const timeSlot = /^(manual|morning|afternoon|evening|[01][0-9]:[0-5][0-9]|2[0-3]:[0-5][0-9])$/.test(rawSlot) ? rawSlot : "manual";
    if (!Number.isInteger(mood) || mood < 1 || mood > 5) {
      return NextResponse.json({ ok: false, error: "Selecciona cómo te sientes para guardar el registro." }, { status: 400, headers: noCache });
    }
    const { rows } = await db().query(
      "INSERT INTO public.demian_mood_checkins(user_id,checkin_date,time_slot,mood,note) VALUES($1,(NOW() AT TIME ZONE 'America/Mexico_City')::date,$2,$3,$4) RETURNING id,checkin_date::text AS checkin_date,time_slot,mood,note,created_at",
      [uid, timeSlot, mood, note]
    );
    return NextResponse.json({ ok: true, checkin: rows[0] }, { status: 201, headers: noCache });
  } catch (error) {
    console.error("DEMian mood POST:", error);
    return NextResponse.json({ ok: false, error: "No se pudo guardar tu check-in. Inténtalo de nuevo." }, { status: 503, headers: noCache });
  }
}
