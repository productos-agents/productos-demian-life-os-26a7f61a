import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { ensureIdentitySchema } from "../../../lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const globalForPool = globalThis as unknown as { demianPool?: Pool; demianReady?: Promise<void> };
const noCache = { "Cache-Control": "private, no-store, max-age=0" };

function pool() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("La base de datos de DEMian no está configurada.");
  if (!globalForPool.demianPool) globalForPool.demianPool = new Pool({
    connectionString: process.env.DEMIAN_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 4,
    connectionTimeoutMillis: 8000, idleTimeoutMillis: 20000
  });
  return globalForPool.demianPool;
}
async function ready() {
  await ensureIdentitySchema();
  if (!globalForPool.demianReady) globalForPool.demianReady = Promise.all([
    pool().query("SELECT 1 FROM public.demian_items LIMIT 0"),
    pool().query("SELECT 1 FROM public.demian_habit_logs LIMIT 0")
  ]).then(() => undefined).catch(error => { globalForPool.demianReady = undefined; throw error; });
  return globalForPool.demianReady;
}
function userId(req: NextRequest) {
  const id = req.headers.get("x-demian-user-id") || "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}
function safeItem(r: Record<string, unknown>) {
  return {
    id: String(r.id), kind: r.kind, title: r.title, details: r.details ?? "",
    amount: r.amount == null ? null : Number(r.amount), category: r.category ?? "",
    dueDate: r.due_date ? String(r.due_date).slice(0, 10) : "",
    status: r.status ?? "active", frequency: r.frequency ?? "",
    doneToday: r.done_today === true, pinned: r.kind === "note" && r.status === "pinned",
    createdAt: r.created_at
  };
}
function validDate(value: unknown): string | null {
  const d = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}
function itemsSql() {
  return "SELECT i.*, EXISTS(SELECT 1 FROM public.demian_habit_logs h WHERE h.habit_id=i.id AND h.log_date=$1::date) AS done_today FROM public.demian_items i";
}
function unauthenticated() {
  return NextResponse.json({ ok: false, error: "Necesitas iniciar sesión." }, { status: 401, headers: noCache });
}

export async function GET(req: NextRequest) {
  const uid = userId(req);
  if (!uid) return unauthenticated();
  try {
    await ready();
    const date = validDate(new URL(req.url).searchParams.get("date")) ?? new Date().toISOString().slice(0, 10);
    const { rows } = await pool().query(itemsSql() + " WHERE i.user_id=$2 ORDER BY i.created_at DESC LIMIT 500", [date, uid]);
    return NextResponse.json({ ok: true, items: rows.map(safeItem), database: "connected" }, { headers: noCache });
  } catch (e) {
    console.error("DEMian database GET:", e);
    return NextResponse.json({ ok: false, error: "No se pudo conectar con la base de datos." }, { status: 503, headers: noCache });
  }
}
export async function POST(req: NextRequest) {
  const uid = userId(req);
  if (!uid) return unauthenticated();
  try {
    await ready();
    const b = await req.json();
    const kind = String(b.kind ?? "");
    const title = String(b.title ?? "").trim().slice(0, 160);
    if (!["task", "transaction", "habit", "note"].includes(kind) || !title) return NextResponse.json({ ok: false, error: "Tipo o título inválido." }, { status: 400, headers: noCache });
    const amount = b.amount === "" || b.amount == null ? null : Number(b.amount);
    if (amount !== null && (!Number.isFinite(amount) || Math.abs(amount) > 999999999)) return NextResponse.json({ ok: false, error: "Importe inválido." }, { status: 400, headers: noCache });
    const dueDate = b.dueDate ? validDate(b.dueDate) : null;
    if (b.dueDate && !dueDate) return NextResponse.json({ ok: false, error: "Fecha inválida." }, { status: 400, headers: noCache });
    const status = kind === "note" && b.pinned === true ? "pinned" : "active";
    const { rows } = await pool().query(
      "INSERT INTO public.demian_items(user_id,kind,title,details,amount,category,due_date,status,frequency) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
      [uid, kind, title, String(b.details ?? "").slice(0, 5000), amount, String(b.category ?? "").trim().slice(0, 80), dueDate, status, String(b.frequency ?? "").slice(0, 80)]
    );
    const date = validDate(b.logDate) ?? new Date().toISOString().slice(0, 10);
    const selected = await pool().query(itemsSql() + " WHERE i.user_id=$2 AND i.id=$3", [date, uid, rows[0].id]);
    return NextResponse.json({ ok: true, item: safeItem(selected.rows[0]) }, { status: 201, headers: noCache });
  } catch (e) {
    console.error("DEMian database POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo guardar el registro." }, { status: 503, headers: noCache });
  }
}
export async function PATCH(req: NextRequest) {
  const uid = userId(req);
  if (!uid) return unauthenticated();
  try {
    await ready();
    const b = await req.json();
    const id = Number(b.id);
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400, headers: noCache });
    const found = await pool().query("SELECT * FROM public.demian_items WHERE id=$1 AND user_id=$2 LIMIT 1", [id, uid]);
    const existing = found.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return NextResponse.json({ ok: false, error: "Registro no encontrado." }, { status: 404, headers: noCache });
    const logDate = validDate(b.logDate) ?? new Date().toISOString().slice(0, 10);

    if (existing.kind === "habit" && typeof b.doneToday === "boolean") {
      if (b.doneToday) {
        await pool().query("INSERT INTO public.demian_habit_logs(habit_id,log_date) VALUES($1,$2::date) ON CONFLICT(habit_id,log_date) DO NOTHING", [id, logDate]);
      } else {
        await pool().query("DELETE FROM public.demian_habit_logs WHERE habit_id=$1 AND log_date=$2::date", [id, logDate]);
      }
      const { rows } = await pool().query(itemsSql() + " WHERE i.user_id=$2 AND i.id=$3", [logDate, uid, id]);
      return NextResponse.json({ ok: true, item: safeItem(rows[0]) }, { headers: noCache });
    }
    if (existing.kind === "note") {
      const title = String(b.title ?? existing.title).trim().slice(0, 160);
      if (!title) return NextResponse.json({ ok: false, error: "La nota necesita un título." }, { status: 400, headers: noCache });
      const details = b.details === undefined ? String(existing.details ?? "") : String(b.details).slice(0, 5000);
      const category = b.category === undefined ? String(existing.category ?? "") : String(b.category).trim().slice(0, 80);
      const pinned = typeof b.pinned === "boolean" ? b.pinned : existing.status === "pinned";
      const result = await pool().query("UPDATE public.demian_items SET title=$1,details=$2,category=$3,status=$4,updated_at=NOW() WHERE id=$5 AND user_id=$6 AND kind='note' RETURNING id", [title, details, category, pinned ? "pinned" : "active", id, uid]);
      if (!result.rowCount) return NextResponse.json({ ok: false, error: "Registro no encontrado." }, { status: 404, headers: noCache });
      const { rows } = await pool().query(itemsSql() + " WHERE i.user_id=$2 AND i.id=$3", [logDate, uid, id]);
      return NextResponse.json({ ok: true, item: safeItem(rows[0]) }, { headers: noCache });
    }
    if (existing.kind !== "task") return NextResponse.json({ ok: false, error: "Este tipo de registro no admite ese cambio." }, { status: 400, headers: noCache });
    if (typeof b.title === "string" || typeof b.details === "string" || typeof b.dueDate === "string" || typeof b.category === "string") {
      const title = String(b.title ?? existing.title).trim().slice(0, 160);
      if (!title) return NextResponse.json({ ok: false, error: "La tarea necesita un título." }, { status: 400, headers: noCache });
      const details = b.details === undefined ? String(existing.details ?? "") : String(b.details).slice(0, 5000);
      const category = b.category === undefined ? String(existing.category ?? "") : String(b.category).trim().slice(0, 80);
      const dueDate = b.dueDate === undefined ? (existing.due_date ? String(existing.due_date).slice(0,10) : null) : (b.dueDate === "" || b.dueDate == null ? null : validDate(b.dueDate));
      if (b.dueDate && !dueDate) return NextResponse.json({ ok: false, error: "Fecha límite inválida." }, { status: 400, headers: noCache });
      const result = await pool().query("UPDATE public.demian_items SET title=$1,details=$2,category=$3,due_date=$4,updated_at=NOW() WHERE id=$5 AND user_id=$6 AND kind='task' RETURNING id", [title, details, category, dueDate, id, uid]);
      if (!result.rowCount) return NextResponse.json({ ok: false, error: "Tarea no encontrada." }, { status: 404, headers: noCache });
    } else {
      if (typeof b.status !== "string") return NextResponse.json({ ok: false, error: "No hay cambios válidos para la tarea." }, { status: 400, headers: noCache });
      const status = String(b.status);
      if (!["active", "done"].includes(status)) return NextResponse.json({ ok: false, error: "Estado de tarea inválido." }, { status: 400, headers: noCache });
      await pool().query("UPDATE public.demian_items SET status=$1,updated_at=NOW() WHERE id=$2 AND user_id=$3 AND kind='task'", [status, id, uid]);
    }
    const { rows } = await pool().query(itemsSql() + " WHERE i.user_id=$2 AND i.id=$3", [logDate, uid, id]);
    return NextResponse.json({ ok: true, item: safeItem(rows[0]) }, { headers: noCache });
  } catch (e) {
    console.error("DEMian database PATCH:", e);
    return NextResponse.json({ ok: false, error: "No se pudo actualizar el registro." }, { status: 503, headers: noCache });
  }
}
export async function DELETE(req: NextRequest) {
  const uid = userId(req);
  if (!uid) return unauthenticated();
  try {
    await ready();
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400, headers: noCache });
    const { rowCount } = await pool().query("DELETE FROM public.demian_items WHERE id=$1 AND user_id=$2", [id, uid]);
    if (!rowCount) return NextResponse.json({ ok: false, error: "Registro no encontrado." }, { status: 404, headers: noCache });
    return NextResponse.json({ ok: true }, { headers: noCache });
  } catch (e) {
    console.error("DEMian database DELETE:", e);
    return NextResponse.json({ ok: false, error: "No se pudo eliminar el registro." }, { status: 503, headers: noCache });
  }
}
