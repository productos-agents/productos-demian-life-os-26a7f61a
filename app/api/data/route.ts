import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
const globalForPool = globalThis as unknown as { demianPool?: Pool; demianReady?: Promise<void> };
function pool() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("DEMIAN_DATABASE_URL no está configurada");
  if (!globalForPool.demianPool) globalForPool.demianPool = new Pool({ connectionString: process.env.DEMIAN_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 4 });
  return globalForPool.demianPool;
}
async function ready() {
  if (!globalForPool.demianReady) globalForPool.demianReady = (async () => {
    const p = pool();
    await p.query(`CREATE TABLE IF NOT EXISTS demian_items (
      id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('task','transaction','habit','note')),
      title TEXT NOT NULL, details TEXT NOT NULL DEFAULT '', amount NUMERIC(12,2), category TEXT NOT NULL DEFAULT '',
      due_date DATE, status TEXT NOT NULL DEFAULT 'active', frequency TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await p.query("CREATE INDEX IF NOT EXISTS demian_items_kind_created_idx ON demian_items(kind, created_at DESC)");
    await p.query("CREATE INDEX IF NOT EXISTS demian_items_due_idx ON demian_items(due_date) WHERE due_date IS NOT NULL");
  })().catch(err => { globalForPool.demianReady = undefined; throw err; });
  return globalForPool.demianReady;
}
function safeItem(r: Record<string, unknown>) {
  return {
    id: String(r.id), kind: r.kind, title: r.title, details: r.details ?? "",
    amount: r.amount == null ? null : Number(r.amount), category: r.category ?? "",
    dueDate: r.due_date ? String(r.due_date).slice(0,10) : "",
    status: r.status ?? "active", frequency: r.frequency ?? "",
    createdAt: r.created_at
  };
}
export async function GET() {
  try {
    await ready();
    const { rows } = await pool().query("SELECT * FROM demian_items ORDER BY created_at DESC LIMIT 500");
    return NextResponse.json({ ok: true, items: rows.map(safeItem), database: "connected" });
  } catch (e) {
    console.error("DEMian database GET:", e);
    return NextResponse.json({ ok: false, error: "No se pudo conectar con la base de datos." }, { status: 503 });
  }
}
export async function POST(req: NextRequest) {
  try {
    await ready();
    const b = await req.json();
    const kind = String(b.kind ?? "");
    const title = String(b.title ?? "").trim().slice(0,160);
    if (!["task","transaction","habit","note"].includes(kind) || !title) return NextResponse.json({ok:false,error:"Tipo o título inválido."},{status:400});
    const amount = b.amount === "" || b.amount == null ? null : Number(b.amount);
    if (amount !== null && (!Number.isFinite(amount) || Math.abs(amount) > 999999999)) return NextResponse.json({ok:false,error:"Importe inválido."},{status:400});
    const dueDate = b.dueDate ? String(b.dueDate) : null;
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return NextResponse.json({ok:false,error:"Fecha inválida."},{status:400});
    const { rows } = await pool().query(
      "INSERT INTO demian_items(kind,title,details,amount,category,due_date,status,frequency) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [kind,title,String(b.details??"").slice(0,5000),amount,String(b.category??"").slice(0,80),dueDate,String(b.status??"active").slice(0,24),String(b.frequency??"").slice(0,80)]
    );
    return NextResponse.json({ok:true,item:safeItem(rows[0])},{status:201});
  } catch (e) {
    console.error("DEMian database POST:",e);
    return NextResponse.json({ok:false,error:"No se pudo guardar el registro."},{status:503});
  }
}
export async function PATCH(req: NextRequest) {
  try {
    await ready();
    const b = await req.json();
    const id = Number(b.id);
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ok:false,error:"ID inválido."},{status:400});
    const { rows } = await pool().query("UPDATE demian_items SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",[String(b.status??"active").slice(0,24),id]);
    if (!rows[0]) return NextResponse.json({ok:false,error:"Registro no encontrado."},{status:404});
    return NextResponse.json({ok:true,item:safeItem(rows[0])});
  } catch (e) {
    console.error("DEMian database PATCH:",e);
    return NextResponse.json({ok:false,error:"No se pudo actualizar el registro."},{status:503});
  }
}
export async function DELETE(req: NextRequest) {
  try {
    await ready();
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ok:false,error:"ID inválido."},{status:400});
    const { rowCount } = await pool().query("DELETE FROM demian_items WHERE id=$1",[id]);
    if (!rowCount) return NextResponse.json({ok:false,error:"Registro no encontrado."},{status:404});
    return NextResponse.json({ok:true});
  } catch (e) {
    console.error("DEMian database DELETE:",e);
    return NextResponse.json({ok:false,error:"No se pudo eliminar el registro."},{status:503});
  }
}