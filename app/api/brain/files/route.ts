import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { ensureIdentitySchema, isActiveSessionId, requestSession } from "../../../../lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 100_000;
const allowedExtensions = new Set(["pdf", "docx", "xlsx", "xls", "csv", "tsv", "txt", "md", "json", "html", "xml", "yaml", "yml", "log"]);
const globalFiles = globalThis as unknown as { demianFilesPool?: Pool; demianFilesReady?: Promise<void> };

function pool() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("La biblioteca de DEMIAN no está configurada.");
  if (!globalFiles.demianFilesPool) {
    globalFiles.demianFilesPool = new Pool({
      connectionString: process.env.DEMIAN_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 20000
    });
  }
  return globalFiles.demianFilesPool;
}
async function ready() {
  await ensureIdentitySchema();
  if (!globalFiles.demianFilesReady) {
    globalFiles.demianFilesReady = pool().query("SELECT 1 FROM public.demian_brain_files LIMIT 0")
      .then(() => undefined)
      .catch(error => { globalFiles.demianFilesReady = undefined; throw error; });
  }
  return globalFiles.demianFilesReady;
}
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const target = new URL(req.url);
    if (parsed.origin.toLowerCase() === "https://demian-life-os-web-production.up.railway.app") return true;
    if (parsed.origin.toLowerCase() === target.origin.toLowerCase()) return true;
    const forwardedHost = (req.headers.get("x-forwarded-host") || "").split(",")[0].trim().toLowerCase();
    const host = (req.headers.get("host") || "").split(",")[0].trim().toLowerCase();
    const proto = (req.headers.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
    const requestHost = forwardedHost || host;
    if (requestHost && parsed.host.toLowerCase() === requestHost) return parsed.protocol === (proto ? proto + ":" : parsed.protocol);
    return false;
  } catch { return false; }
}
async function userSession(req: NextRequest) {
  const session = requestSession(req);
  if (!session) return null;
  await ready();
  return await isActiveSessionId(session.sub, session.sid) ? session : null;
}
function noCache(extra: Record<string, string> = {}) {
  return { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", ...extra };
}

export async function GET(req: NextRequest) {
  try {
    const session = await userSession(req);
    if (!session) return NextResponse.json({ ok: false, error: "Inicia sesión para abrir tu biblioteca." }, { status: 401, headers: noCache() });
    const term = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 120);
    const pattern = "%" + term.replace(/[\\%_]/g, "\\$&") + "%";
    const condition = term ? " AND (f.file_name ILIKE $2 OR f.summary ILIKE $2 OR f.category ILIKE $2 OR f.extracted_text ILIKE $2)" : "";
    const { rows } = await pool().query(
      "SELECT f.id,f.file_name,f.content_type,f.file_size,f.summary,f.category,f.status,f.created_at,f.note_id,n.title AS note_title FROM public.demian_brain_files f LEFT JOIN public.demian_items n ON n.id=f.note_id AND n.user_id=f.user_id WHERE f.user_id=$1" + condition + " ORDER BY f.created_at DESC LIMIT 100",
      term ? [session.sub, pattern] : [session.sub]
    );
    return NextResponse.json({
      ok: true,
      files: rows.map(row => ({
        id: String(row.id),
        name: String(row.file_name),
        contentType: String(row.content_type),
        size: Number(row.file_size),
        summary: String(row.summary || ""),
        category: String(row.category || "Archivos"),
        status: String(row.status),
        createdAt: row.created_at,
        noteId: row.note_id == null ? null : String(row.note_id),
        noteTitle: String(row.note_title || row.file_name)
      }))
    }, { headers: noCache() });
  } catch (error) {
    console.error("DEMIAN brain files list:", error);
    return NextResponse.json({ ok: false, error: "No se pudo cargar la biblioteca de archivos." }, { status: 503, headers: noCache() });
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403, headers: noCache() });
  try {
    const session = await userSession(req);
    if (!session) return NextResponse.json({ ok: false, error: "Inicia sesión para guardar archivos." }, { status: 401, headers: noCache() });
    const form = await req.formData();
    const value = form.get("file");
    const extracted = form.get("extractedText");
    if (!(value instanceof File)) return NextResponse.json({ ok: false, error: "Selecciona un archivo para subir." }, { status: 400, headers: noCache() });
    if (value.size < 1 || value.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: "Cada archivo debe pesar entre 1 byte y 8 MB." }, { status: 413, headers: noCache() });
    const name = value.name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/]+/g, "-").trim().slice(0, 180) || "archivo";
    const extension = name.toLowerCase().split(".").pop() || "";
    if (!allowedExtensions.has(extension)) return NextResponse.json({ ok: false, error: "Formato no admitido. Usa PDF, Word, Excel, CSV, texto, Markdown, JSON o HTML/XML." }, { status: 415, headers: noCache() });
    if (typeof extracted !== "string") return NextResponse.json({ ok: false, error: "No se pudo extraer el texto del archivo." }, { status: 400, headers: noCache() });
    const extractedText = extracted.replace(/\u0000/g, "").slice(0, MAX_EXTRACTED_CHARS);
    const bytes = Buffer.from(await value.arrayBuffer());
    if (bytes.length !== value.size) return NextResponse.json({ ok: false, error: "La carga del archivo quedó incompleta." }, { status: 400, headers: noCache() });
    const contentType = ({
      pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel",
      csv: "text/csv", tsv: "text/tab-separated-values", txt: "text/plain", md: "text/markdown",
      json: "application/json", html: "text/html", xml: "application/xml", yaml: "text/yaml", yml: "text/yaml", log: "text/plain"
    } as Record<string,string>)[extension] || value.type || "application/octet-stream";
    const id = randomUUID();
    await pool().query(
      "INSERT INTO public.demian_brain_files(id,user_id,file_name,content_type,file_size,file_data,extracted_text,status,category) VALUES($1,$2,$3,$4,$5,$6,$7,'pending','Pendiente de organizar')",
      [id, session.sub, name, contentType, bytes.length, bytes, extractedText]
    );
    return NextResponse.json({
      ok: true,
      file: { id, name, contentType, size: bytes.length, status: "pending", extractedCharacters: extractedText.length }
    }, { status: 201, headers: noCache() });
  } catch (error) {
    console.error("DEMIAN brain file upload:", error);
    return NextResponse.json({ ok: false, error: "No se pudo guardar el archivo en tu biblioteca." }, { status: 503, headers: noCache() });
  }
}