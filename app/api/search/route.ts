import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { ensureIdentitySchema } from "../../../lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
const globals = globalThis as unknown as { searchDemianPool?: Pool; searchFluxPool?: Pool };

function uuid(req: NextRequest, name: string) {
  const value = req.headers.get(name) || "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
function personalDb() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("La base de datos de DEMIAN CORE no está configurada.");
  if (!globals.searchDemianPool) globals.searchDemianPool = new Pool({ connectionString: process.env.DEMIAN_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3, connectionTimeoutMillis: 8000, idleTimeoutMillis: 20000 });
  return globals.searchDemianPool;
}
function financeDb() {
  if (!process.env.FLUX_DATABASE_URL) throw new Error("La base de datos financiera no está configurada.");
  if (!globals.searchFluxPool) globals.searchFluxPool = new Pool({ connectionString: process.env.FLUX_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, connectionTimeoutMillis: 8000, idleTimeoutMillis: 20000 });
  return globals.searchFluxPool;
}
export async function GET(req: NextRequest) {
  const uid = uuid(req, "x-demian-user-id");
  if (!uid) return NextResponse.json({ ok: false, error: "Necesitas iniciar sesión." }, { status: 401, headers: noCache });
  const term = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 100);
  if (term.length < 2) return NextResponse.json({ ok: true, results: [] }, { headers: noCache });
  const pattern = "%" + term.replace(/[\\%_]/g, "\\$&") + "%";
  try {
    await ensureIdentitySchema();
    const itemsQuery = personalDb().query(
      "SELECT id,kind,title,details,category,frequency,created_at FROM public.demian_items " +
      "WHERE user_id=$1 AND (title ILIKE $2 OR details ILIKE $2 OR category ILIKE $2 OR frequency ILIKE $2) " +
      "ORDER BY created_at DESC,id DESC LIMIT 8",
      [uid, pattern]
    );
    const filesQuery = personalDb().query(
      "SELECT f.id,f.file_name,f.summary,f.category,f.status,f.created_at,n.title AS note_title FROM public.demian_brain_files f LEFT JOIN public.demian_items n ON n.id=f.note_id AND n.user_id=f.user_id " +
      "WHERE f.user_id=$1 AND (f.file_name ILIKE $2 OR f.extracted_text ILIKE $2 OR f.summary ILIKE $2 OR f.category ILIKE $2) " +
      "ORDER BY f.created_at DESC LIMIT 8",
      [uid, pattern]
    );
    const fid = uuid(req, "x-demian-flux-user-id");
    const financeQuery = fid ? financeDb().query(
      "SELECT t.id,t.type,t.category,t.description,t.amount::float8 AS amount,t.transaction_date::text AS transaction_date,t.created_at,a.name AS account_name " +
      "FROM public.flux_transactions t LEFT JOIN public.flux_accounts a ON a.id=t.account_id AND a.user_id=t.user_id " +
      "WHERE t.user_id=$1 AND (t.description ILIKE $2 OR t.category ILIKE $2 OR t.transaction_date::text ILIKE $2 OR t.amount::text ILIKE $2 OR a.name ILIKE $2) " +
      "ORDER BY t.transaction_date DESC,t.created_at DESC,t.id DESC LIMIT 8",
      [fid, pattern]
    ) : Promise.resolve({ rows: [] as Record<string, unknown>[] });
    const [itemsResult, financeResult] = await Promise.allSettled([itemsQuery, financeQuery]);
    if (itemsResult.status === "rejected") throw itemsResult.reason;
    const items = itemsResult.value;
    const finance = financeResult.status === "fulfilled" ? financeResult.value : { rows: [] as Record<string, unknown>[] };
    if (financeResult.status === "rejected") console.error("DEMian search: financial history unavailable; returning personal matches only.", financeResult.reason);
    let fileRows: Record<string, unknown>[] = [];
    try {
      const files = await filesQuery;
      fileRows = files.rows as Record<string, unknown>[];
    } catch (error) {
      console.error("DEMian search: file archive unavailable; returning other matches only.", error);
    }
    const itemResults = items.rows.map((item: Record<string, unknown>) => ({
      id: "item-" + String(item.id),
      title: String(item.title || "Registro sin título"),
      subtitle: (item.kind === "task" ? "Agenda" : item.kind === "habit" ? "Hábitos" : item.kind === "note" ? "Segundo cerebro" : "Registro") + " · " + String(item.category || item.frequency || "Registro personal"),
      target: item.kind === "task" || item.kind === "habit" || item.kind === "note" ? item.kind : "transaction",
      icon: item.kind === "task" ? "calendar-clock" : item.kind === "habit" ? "heart-pulse" : item.kind === "note" ? "book-open" : "wallet",
      createdAt: item.created_at
    }));
    const financeResults = finance.rows.map((item: Record<string, unknown>) => ({
      id: "finance-" + String(item.id),
      title: String(item.description || item.category || "Movimiento financiero"),
      subtitle: "FLUX · " + String(item.category || "Movimiento") + " · " + new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 2 }).format(Number(item.amount || 0)) + " · " + String(item.transaction_date || ""),
      target: "transaction",
      icon: "wallet",
      createdAt: item.created_at
    }));
    const fileResults = fileRows.map((item: Record<string, unknown>) => ({
      id: "file-" + String(item.id),
      title: String(item.note_title || item.file_name || "Archivo guardado"),
      subtitle: "Segundo cerebro · Archivo · " + String(item.category || "Pendiente de organizar") + (item.summary ? " · " + String(item.summary).slice(0, 90) : ""),
      target: "note",
      icon: "book-open",
      createdAt: item.created_at
    }));
    const results = [...itemResults, ...fileResults, ...financeResults]
      .sort((a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime())
      .slice(0, 8)
      .map(({ createdAt: _createdAt, ...result }) => result);
    return NextResponse.json({ ok: true, results }, { headers: noCache });
  } catch (error) {
    console.error("DEMian global search:", error);
    return NextResponse.json({ ok: false, error: "No se pudo completar la búsqueda." }, { status: 503, headers: noCache });
  }
}
