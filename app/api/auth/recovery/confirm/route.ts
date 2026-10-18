import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { authDb, hashPassword } from "../../../../../lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body?.token || "");
    const password = String(body?.password || "");
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ ok: false, error: "El enlace de recuperación no es válido o ha caducado." }, { status: 400, headers: noCache });
    if (password.length < 10 || password.length > 256) return NextResponse.json({ ok: false, error: "La contraseña debe tener entre 10 y 256 caracteres." }, { status: 400, headers: noCache });
    const digest = createHash("sha256").update(token).digest("hex");
    const db = await authDb();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT user_id FROM public.demian_password_reset_tokens WHERE token_hash=$1 AND expires_at>NOW() AND used_at IS NULL FOR UPDATE", [digest]);
      if (!found.rows[0]) {
        await client.query("ROLLBACK");
        return NextResponse.json({ ok: false, error: "El enlace de recuperación no es válido o ha caducado." }, { status: 400, headers: noCache });
      }
      const userId = found.rows[0].user_id as string;
      const passwordHash = await hashPassword(password);
      await client.query("UPDATE public.demian_users SET password_hash=$1 WHERE id=$2 AND role='user'", [passwordHash, userId]);
      await client.query("UPDATE public.demian_password_reset_tokens SET used_at=NOW() WHERE token_hash=$1", [digest]);
      await client.query("UPDATE public.demian_password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL", [userId]);
      await client.query("UPDATE public.demian_sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL", [userId]);
      await client.query("COMMIT");
      return NextResponse.json({ ok: true, message: "Contraseña actualizada. Vuelve a iniciar sesión en tus dispositivos." }, { headers: noCache });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  } catch (error) {
    console.error("DEMian recovery confirm failed:", error);
    return NextResponse.json({ ok: false, error: "No se pudo cambiar la contraseña. Inténtalo de nuevo." }, { status: 503, headers: noCache });
  }
}
