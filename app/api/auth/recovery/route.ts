import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { authDb, authIsBlocked, recordAuthFailure } from "../../../../lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: noCache }); }
function escapeHtml(text: string) { return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c] || c); }
export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DEMIAN_EMAIL_FROM;
  if (!apiKey || !from) return json({ ok: false, error: "La recuperación por correo está pendiente de configurar el servicio de envío." }, 503);
  try {
    const blocked = await authIsBlocked(req);
    if (blocked > 0) return json({ ok: false, error: "Demasiados intentos. Prueba de nuevo en unos minutos." }, 429);
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "Escribe un correo válido." }, 400);
    await recordAuthFailure(req);
    const db = await authDb();
    const result = await db.query("SELECT id,name,email FROM public.demian_users WHERE LOWER(email)=LOWER($1) AND role='user' LIMIT 1", [email]);
    if (!result.rows[0]) return json({ ok: true, message: "Si el correo pertenece a una cuenta, recibirás instrucciones para restablecer la contraseña." });
    const user = result.rows[0];
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await db.query("DELETE FROM public.demian_password_reset_tokens WHERE user_id=$1 AND (expires_at<NOW() OR used_at IS NOT NULL)", [user.id]);
    await db.query("INSERT INTO public.demian_password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 minutes')", [tokenHash, user.id]);
    const base = (process.env.DEMIAN_PUBLIC_URL || "https://demian-life-os-web-production.up.railway.app").replace(/\/+$/, "");
    const url = base + "/recover?token=" + encodeURIComponent(rawToken);
    const html = "<p>Hola " + escapeHtml(String(user.name || "usuario")) + ".</p><p>Recibimos una solicitud para cambiar la contraseña de DEMIAN CORE.</p><p><a href=\"" + url + "\">Restablecer contraseña</a></p><p>El enlace caduca en 30 minutos y solo puede utilizarse una vez. Si no lo solicitaste, ignora este mensaje.</p>";
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [user.email], subject: "Restablecer contraseña de DEMIAN CORE", html, text: "Abre este enlace para restablecer tu contraseña (caduca en 30 minutos): " + url })
    });
    if (!sent.ok) {
      await db.query("DELETE FROM public.demian_password_reset_tokens WHERE token_hash=$1", [tokenHash]);
      console.error("DEMian recovery email provider returned status", sent.status);
      return json({ ok: false, error: "No se pudo enviar el correo. Inténtalo más tarde." }, 503);
    }
    return json({ ok: true, message: "Si el correo pertenece a una cuenta, recibirás instrucciones para restablecer la contraseña." });
  } catch (error) {
    console.error("DEMian recovery request failed:", error);
    return json({ ok: false, error: "No se pudo procesar la solicitud de recuperación." }, 503);
  }
}
