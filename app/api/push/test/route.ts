import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
const globalPush = globalThis as unknown as { demianPushTestPool?: Pool };

function db() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("La base de datos de DEMian no está configurada.");
  if (!globalPush.demianPushTestPool) globalPush.demianPushTestPool = new Pool({
    connectionString: process.env.DEMIAN_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 20000
  });
  return globalPush.demianPushTestPool;
}
function userId(req: NextRequest) {
  const id = req.headers.get("x-demian-user-id") || "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noCache });
}

export async function POST(req: NextRequest) {
  const uid = userId(req);
  if (!uid) return json({ ok: false, error: "Inicia sesión para probar las notificaciones." }, 401);
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "";
  if (!publicKey || !privateKey || !subject) return json({ ok: false, error: "El envío push del servidor no está configurado." }, 503);

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const { rows } = await db().query(
      "SELECT endpoint,p256dh,auth FROM public.demian_push_subscriptions WHERE user_id=$1 AND active=true",
      [uid]
    );
    if (!rows.length) return json({ ok: false, error: "Este dispositivo aún no tiene una suscripción push activa." }, 409);

    const payload = JSON.stringify({
      title: "DEMian · Notificaciones activadas",
      body: "Tu dispositivo ya está conectado. Pronto recibirás tus pausas de bienestar, finanzas, recordatorios y la palabra del día.",
      url: "/",
      kind: "setup",
      tag: "demian-push-ready"
    });
    let delivered = 0;
    let expired = 0;
    const errors: number[] = [];
    for (const sub of rows) {
      try {
        await webpush.sendNotification(
          { endpoint: String(sub.endpoint), keys: { p256dh: String(sub.p256dh), auth: String(sub.auth) } },
          payload,
          { TTL: 300, urgency: "high" }
        );
        delivered++;
      } catch (error) {
        const status = Number((error as { statusCode?: number })?.statusCode || 0);
        if (status === 404 || status === 410) {
          await db().query("UPDATE public.demian_push_subscriptions SET active=false,updated_at=NOW() WHERE endpoint=$1", [sub.endpoint]);
          expired++;
        } else {
          errors.push(status || 0);
          console.error("DEMian push test delivery failed", status, error);
        }
      }
    }
    if (!delivered) return json({ ok: false, error: expired ? "La suscripción de este dispositivo expiró. Activa de nuevo las notificaciones." : "El proveedor push no aceptó el mensaje de prueba.", delivered, expired, errors }, 502);
    return json({ ok: true, delivered, message: "Mensaje de prueba aceptado por el servicio push." });
  } catch (error) {
    console.error("DEMian push test:", error);
    return json({ ok: false, error: "No se pudo enviar el mensaje de prueba." }, 503);
  }
}
