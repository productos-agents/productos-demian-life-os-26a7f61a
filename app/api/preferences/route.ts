import { NextRequest, NextResponse } from "next/server";
import { authDb, requestSession } from "../../../lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
const themes = new Set(["red", "blue", "pink", "purple", "green", "orange", "white"]);

function currentUser(req: NextRequest) {
  const session = requestSession(req);
  return session?.sub || null;
}

function unauthenticated() {
  return NextResponse.json({ ok: false, error: "Inicia sesión para guardar tus preferencias." }, { status: 401, headers: noCache });
}

export async function GET(req: NextRequest) {
  const userId = currentUser(req);
  if (!userId) return unauthenticated();
  try {
    const db = await authDb();
    const result = await db.query(
      "SELECT accent_theme FROM public.demian_user_preferences WHERE user_id=$1 LIMIT 1",
      [userId]
    );
    return NextResponse.json({ ok: true, theme: result.rows[0]?.accent_theme || "green" }, { headers: noCache });
  } catch (error) {
    console.error("DEMian preferences GET:", error);
    return NextResponse.json({ ok: false, error: "No se pudieron cargar tus preferencias." }, { status: 503, headers: noCache });
  }
}

export async function PUT(req: NextRequest) {
  const userId = currentUser(req);
  if (!userId) return unauthenticated();
  try {
    const body = await req.json();
    const theme = typeof body?.theme === "string" ? body.theme : "";
    if (!themes.has(theme)) {
      return NextResponse.json({ ok: false, error: "Ese color no está disponible." }, { status: 400, headers: noCache });
    }
    const db = await authDb();
    await db.query(
      "INSERT INTO public.demian_user_preferences(user_id, accent_theme, updated_at) VALUES($1,$2,NOW()) " +
      "ON CONFLICT(user_id) DO UPDATE SET accent_theme=EXCLUDED.accent_theme, updated_at=NOW()",
      [userId, theme]
    );
    return NextResponse.json({ ok: true, theme }, { headers: noCache });
  } catch (error) {
    console.error("DEMian preferences PUT:", error);
    return NextResponse.json({ ok: false, error: "No se pudo guardar el color elegido." }, { status: 503, headers: noCache });
  }
}
