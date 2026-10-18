import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { ensureIdentitySchema, isActiveSessionId, requestSession } from "../../../../../lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const globals = globalThis as unknown as { demianFilesDownloadPool?: Pool; demianFilesDownloadReady?: Promise<void> };

function pool() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("La biblioteca de DEMIAN no está configurada.");
  if (!globals.demianFilesDownloadPool) {
    globals.demianFilesDownloadPool = new Pool({
      connectionString: process.env.DEMIAN_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 20000
    });
  }
  return globals.demianFilesDownloadPool;
}
async function ready() {
  await ensureIdentitySchema();
  if (!globals.demianFilesDownloadReady) {
    globals.demianFilesDownloadReady = pool().query("SELECT 1 FROM public.demian_brain_files LIMIT 0")
      .then(() => undefined)
      .catch(error => { globals.demianFilesDownloadReady = undefined; throw error; });
  }
  return globals.demianFilesDownloadReady;
}
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = requestSession(req);
    if (!session) return NextResponse.json({ ok: false, error: "Inicia sesión para descargar este archivo." }, { status: 401, headers: noCache });
    await ready();
    if (!(await isActiveSessionId(session.sub, session.sid))) return NextResponse.json({ ok: false, error: "La sesión ya no está activa." }, { status: 401, headers: noCache });
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ ok: false, error: "Archivo no encontrado." }, { status: 404, headers: noCache });
    }
    const result = await pool().query(
      "SELECT file_name,content_type,file_size,file_data FROM public.demian_brain_files WHERE id=$1 AND user_id=$2 LIMIT 1",
      [id, session.sub]
    );
    const file = result.rows[0] as Record<string, unknown> | undefined;
    if (!file) return NextResponse.json({ ok: false, error: "Archivo no encontrado en tu biblioteca." }, { status: 404, headers: noCache });
    const bytes = Buffer.isBuffer(file.file_data) ? file.file_data : Buffer.from(file.file_data as Uint8Array);
    const name = String(file.file_name || "archivo").replace(/[\r\n"]/g, "_");
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        ...noCache,
        "Content-Type": String(file.content_type || "application/octet-stream"),
        "Content-Length": String(Number(file.file_size || bytes.length)),
        "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(name)
      }
    });
  } catch (error) {
    console.error("DEMIAN brain file download:", error);
    return NextResponse.json({ ok: false, error: "No se pudo descargar el archivo." }, { status: 503, headers: noCache });
  }
}