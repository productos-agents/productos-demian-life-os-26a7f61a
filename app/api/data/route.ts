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
    // Schema is provisioned by the migration owner; the app role has data-only permissions.
    await pool().query("SELECT 1 FROM public.demian_items LIMIT 0");
    await pool().query("SELECT 1 FROM public.demian_habit_logs LIMIT 0");
  })().catch(err => { globalForPool.demianReady = undefined; throw err; });
  return globalForPool.demianReady;
}
function safeItem(r: Record<string, unknown>) {
  return {
    id: String(r.id), kind: r.kind, title: r.title, details: r.details ?? "",
    amount: r.amount == null ? null : Number(r.amount), category: r.category ?? "",
    dueDate: r.due_date ? String(r.due_date).slice(0,10) : "",
    status: r.status ?? "active", frequency: r.frequency ?? "",
    doneToday: r.done_today === true,
    createdAt: r.created_at
  };
}
const SELECT_ITEMS = `SELECT i.*,
  EXISTS (SELECT 1 FROM public.demian_habit_logs h WHERE h.habit_id=i.id AND h.log_date=CURRENT_DATE) AS done_today
  FROM public.demian_items i`;
export async function GET() {
  try {
    await ready();
    const { rows } = await pool().query(SELECT_ITEMS + " ORDER BY i.created_at DESC LIMIT 500");
    return NextResponse.json({ ok: true, items: rows.map(safeItem), database: "connected" }, { headers: { "Cache-Control": "private, no-store" } });
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
    if (kind === "transaction" && (!["Ingreso","Gasto"].includes(String(b.category)) || amount === null || amount < 0)) return NextResponse.json({ok:false,error:"Indica si es ingreso o gasto y un importe válido."},{status:400});
    const dueDate = b.dueDate ? String(b.dueDate) : null;
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return NextResponse.json({ok:false,error:"Fecha inválida."},{status:400});
    const { rows } = await pool().query(
      "INSERT INTO public.demian_items(kind,title,details,amount,category,due_date,status,frequency) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [kind,title,String(b.details??"").slice(0,5000),amount,String(b.category??"").slice(0,80),dueDate,String(b.status??"active").slice(0,24),String(b.frequency??"").slice(0,80)]
    );
    const refreshed = await pool().query(SELECT_ITEMS + " WHERE i.id=$1", [rows[0].id]);
    return NextResponse.json({ok:true,item:safeItem(refreshed.rows[0])},{status:201});
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
    if (typeof b.doneToday === "boolean") {
      const { rows: found } = await pool().query("SELECT id FROM public.demian_items WHERE id=$1 AND kind='habit'",[id]);
      if (!found[0]) return NextResponse.json({ok:false,error:"Hábito no encontrado."},{status:404});
      if (b.doneToday) {
        await pool().query("INSERT INTO public.demian_habit_logs(habit_id,log_date) VALUES($1,CURRENT_DATE) ON CONFLICT(habit_id,log_date) DO NOTHING",[id]);
      } else {
        await pool().query("DELETE FROM public.demian_habit_logs WHERE habit_id=$1 AND log_date=CURRENT_DATE",[id]);
      }
      const { rows } = await pool().query(SELECT_ITEMS + " WHERE i.id=$1",[id]);
      return NextResponse.json({ok:true,item:safeItem(rows[0])});
    }
    const { rows } = await pool().query("UPDATE public.demian_items SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",[String(b.status??"active").slice(0,24),id]);
    if (!rows[0]) return NextResponse.json({ok:false,error:"Registro no encontrado."},{status:404});
    const refreshed = await pool().query(SELECT_ITEMS + " WHERE i.id=$1",[id]);
    return NextResponse.json({ok:true,item:safeItem(refreshed.rows[0])});
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
    const { rowCount } = await pool().query("DELETE FROM public.demian_items WHERE id=$1",[id]);
    if (!rowCount) return NextResponse.json({ok:false,error:"Registro no encontrado."},{status:404});
    return NextResponse.json({ok:true});
  } catch (e) {
    console.error("DEMian database DELETE:",e);
    return NextResponse.json({ok:false,error:"No se pudo eliminar el registro."},{status:503});
  }
}