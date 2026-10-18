import { NextRequest, NextResponse } from "next/server";
import { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const globalPool = globalThis as unknown as { fluxPool?: Pool; fluxReady?: Promise<void> };

function db() {
  if (!process.env.FLUX_DATABASE_URL) throw new Error("FLUX_DATABASE_URL no está configurada");
  if (!globalPool.fluxPool) globalPool.fluxPool = new Pool({
    connectionString: process.env.FLUX_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 8000
  });
  return globalPool.fluxPool;
}
function ownerId(req: NextRequest) {
  const id = req.headers.get("x-demian-flux-user-id");
  if (!id) throw new Error("Esta cuenta no tiene un espacio de finanzas asociado.");
  return id;
}
async function ready(uid: string) {
  if (!globalPool.fluxReady) globalPool.fluxReady = (async () => {
    const p = db();
    await p.query("SELECT 1 FROM public.flux_users LIMIT 0");
    await p.query("SELECT 1 FROM public.flux_transactions LIMIT 0");
    await p.query("SELECT 1 FROM public.flux_savings_goals LIMIT 0");
    await p.query("SELECT 1 FROM public.flux_recurring_transactions LIMIT 0");
  })().catch(error => { globalPool.fluxReady = undefined; throw error; });
  await globalPool.fluxReady;
  const result = await db().query("SELECT id FROM public.flux_users WHERE id=$1 LIMIT 1", [uid]);
  if (!result.rows.length) throw new Error("El espacio financiero de esta cuenta no existe.");
}
const fail = (message: string, status = 400) => NextResponse.json({ ok: false, error: message }, { status });
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
function dateOrNull(v: unknown) {
  if (v === "" || v == null) return null;
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("La fecha no tiene un formato válido.");
  return s;
}
function positiveAmount(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 999999999) throw new Error("El importe debe ser mayor que cero y estar dentro del límite permitido.");
  return n;
}
function short(v: unknown, max = 160) { return String(v ?? "").trim().slice(0, max); }
async function ownAccount(client: Pool | PoolClient, id: unknown, uid: string) {
  const key = short(id, 100);
  if (!key) return null;
  const { rows } = await client.query("SELECT id,name,account_type FROM public.flux_accounts WHERE id=$1 AND user_id=$2 AND is_active=true", [key, uid]);
  if (!rows[0]) throw new Error("La cuenta seleccionada no existe o está inactiva.");
  return rows[0] as { id:string; name:string; account_type:string };
}
async function ownCategory(client: Pool | PoolClient, name: string, type: string, uid: string) {
  const { rows } = await client.query("SELECT name FROM public.flux_categories WHERE user_id=$1 AND type=$2 AND name=$3 LIMIT 1", [uid, type, name]);
  if (!rows[0]) throw new Error("Selecciona una categoría válida para este tipo de movimiento.");
}
function validMonth(value: string | null | undefined): string | null {
  const month = String(value ?? "");
  return /^\\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
}
async function getData(uid: string, options: { limit?: number; offset?: number; reportMonth?: string } = {}) {
  const p = db();
  const limit = Math.min(250, Math.max(1, Math.trunc(options.limit ?? 100)));
  const offset = Math.min(1_000_000, Math.max(0, Math.trunc(options.offset ?? 0)));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const reportMonth = validMonth(options.reportMonth) ?? currentMonth;
  const [profile, transactions, accounts, categories, budgets, goals, recurring, prefs] = await Promise.all([
    p.query("SELECT id,name,email FROM public.flux_users WHERE id=$1 LIMIT 1", [uid]),
    p.query(`SELECT t.id,t.type,t.category,t.description,t.amount::float8 AS amount,t.transaction_date::text AS transaction_date,t.created_at,
      t.account_id,t.transfer_to_account_id,t.transfer_group,a.name AS account_name,ta.name AS transfer_to_account_name
      FROM public.flux_transactions t
      LEFT JOIN public.flux_accounts a ON a.id=t.account_id AND a.user_id=t.user_id
      LEFT JOIN public.flux_accounts ta ON ta.id=t.transfer_to_account_id AND ta.user_id=t.user_id
      WHERE t.user_id=$1 ORDER BY t.transaction_date DESC,t.created_at DESC,t.id DESC LIMIT $2 OFFSET $3`, [uid, limit, offset]),
    p.query(`SELECT a.id,a.name,a.account_type,a.opening_balance::float8 AS opening_balance,a.currency,a.is_active,
      (a.opening_balance + COALESCE(SUM(CASE WHEN a.account_type='credit' AND t.type='expense' THEN t.amount WHEN a.account_type='credit' AND t.type='income' THEN -t.amount WHEN a.account_type<>'credit' AND t.type='income' THEN t.amount WHEN a.account_type<>'credit' AND t.type='expense' THEN -t.amount ELSE 0 END),0))::float8 AS balance
      FROM public.flux_accounts a
      LEFT JOIN public.flux_transactions t ON t.account_id=a.id AND t.user_id=a.user_id
      WHERE a.user_id=$1 GROUP BY a.id ORDER BY a.created_at ASC`, [uid]),
    p.query("SELECT id,name,type,color,icon,is_default FROM public.flux_categories WHERE user_id=$1 ORDER BY type,name", [uid]),
    p.query("SELECT id,name,category,amount_limit::float8 AS amount_limit,period,starts_on::text AS starts_on,is_active,created_at FROM public.flux_budgets WHERE user_id=$1 ORDER BY is_active DESC,created_at DESC", [uid]),
    p.query("SELECT id,name,target_amount::float8 AS target_amount,current_amount::float8 AS current_amount,target_date::text AS target_date,status,created_at FROM public.flux_savings_goals WHERE user_id=$1 ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,target_date NULLS LAST", [uid]),
    p.query("SELECT id,name,type,category,description,amount::float8 AS amount,frequency,next_date::text AS next_date,account_id,is_active,created_at FROM public.flux_recurring_transactions WHERE user_id=$1 ORDER BY is_active DESC,next_date ASC", [uid]),
    p.query("SELECT preferences FROM public.flux_preferences WHERE user_id=$1", [uid])
  ]);
  const [totalRows, monthRows, reportRows, monthlyRows, categoryRows, historicalRows] = await Promise.all([
    p.query("SELECT COUNT(*)::int AS total FROM public.flux_transactions WHERE user_id=$1", [uid]),
    p.query("SELECT COALESCE(SUM(amount) FILTER (WHERE type='income' AND transfer_group IS NULL),0)::float8 AS income, COALESCE(SUM(amount) FILTER (WHERE type='expense' AND transfer_group IS NULL),0)::float8 AS expense, COUNT(*) FILTER (WHERE type='income' AND transfer_group IS NULL)::int AS income_count, COUNT(*) FILTER (WHERE type='expense' AND transfer_group IS NULL)::int AS expense_count FROM public.flux_transactions WHERE user_id=$1 AND transaction_date >= to_date($2 || '-01','YYYY-MM-DD') AND transaction_date < (to_date($2 || '-01','YYYY-MM-DD') + INTERVAL '1 month')", [uid, currentMonth]),
    p.query("SELECT COALESCE(SUM(amount) FILTER (WHERE type='income' AND transfer_group IS NULL),0)::float8 AS income, COALESCE(SUM(amount) FILTER (WHERE type='expense' AND transfer_group IS NULL),0)::float8 AS expense, COUNT(*) FILTER (WHERE transfer_group IS NULL)::int AS movement_count FROM public.flux_transactions WHERE user_id=$1 AND transaction_date >= to_date($2 || '-01','YYYY-MM-DD') AND transaction_date < (to_date($2 || '-01','YYYY-MM-DD') + INTERVAL '1 month')", [uid, reportMonth]),
    p.query("SELECT to_char(date_trunc('month',transaction_date),'YYYY-MM') AS key, COALESCE(SUM(amount) FILTER (WHERE type='income' AND transfer_group IS NULL),0)::float8 AS income, COALESCE(SUM(amount) FILTER (WHERE type='expense' AND transfer_group IS NULL),0)::float8 AS expense FROM public.flux_transactions WHERE user_id=$1 AND transaction_date >= (to_date($2 || '-01','YYYY-MM-DD') - INTERVAL '5 months')::date AND transaction_date < (to_date($2 || '-01','YYYY-MM-DD') + INTERVAL '1 month') GROUP BY date_trunc('month',transaction_date) ORDER BY date_trunc('month',transaction_date)", [uid, currentMonth]),
    p.query("SELECT category,COALESCE(SUM(amount),0)::float8 AS amount FROM public.flux_transactions WHERE user_id=$1 AND type='expense' AND transfer_group IS NULL AND transaction_date >= to_date($2 || '-01','YYYY-MM-DD') AND transaction_date < (to_date($2 || '-01','YYYY-MM-DD') + INTERVAL '1 month') GROUP BY category ORDER BY SUM(amount) DESC", [uid, currentMonth]),
    p.query("SELECT COUNT(*) FILTER (WHERE transfer_group IS NULL)::int AS movement_count, COALESCE(SUM(amount) FILTER (WHERE transfer_group IS NULL),0)::float8 AS gross_movement_amount FROM public.flux_transactions WHERE user_id=$1", [uid])
  ]);
  const total = Number(totalRows.rows[0]?.total ?? 0);
  const m = monthRows.rows[0] ?? {};
  const report = reportRows.rows[0] ?? {};
  const byMonth = new Map(monthlyRows.rows.map(row => [row.key, row]));
  const monthDate = new Date(currentMonth + "-01T12:00:00Z");
  const monthlySeries = Array.from({length:6},(_,i)=>{
    const d = new Date(monthDate); d.setUTCMonth(d.getUTCMonth()-(5-i));
    const key = d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0");
    const row = byMonth.get(key);
    return {key,label:new Intl.DateTimeFormat("es-MX",{month:"short",timeZone:"UTC"}).format(d),income:Number(row?.income??0),expense:Number(row?.expense??0)};
  });
  const expenseByCategory = categoryRows.rows.map(row=>({name:row.category,amount:Number(row.amount),color:categories.rows.find(c=>c.name===row.category&&c.type==="expense")?.color||"#A9B4BE"}));
  return {
    profile: profile.rows[0] ? { name: profile.rows[0].name, emailHint: String(profile.rows[0].email ?? "").replace(/^(.).+(@.*)$/, "$1•••$2") } : null,
    transactions: transactions.rows,
    transactionsTotal: total,
    transactionsHasMore: offset + transactions.rows.length < total,
    transactionsNextOffset: offset + transactions.rows.length,
    summary: { currentMonth, income:Number(m.income??0), expense:Number(m.expense??0), incomeCount:Number(m.income_count??0), expenseCount:Number(m.expense_count??0), reportMonth, reportIncome:Number(report.income??0), reportExpense:Number(report.expense??0), reportMovementCount:Number(report.movement_count??0), monthlySeries, expenseByCategory, allMovementCount:Number(historicalRows.rows[0]?.movement_count??0), grossMovementAmount:Number(historicalRows.rows[0]?.gross_movement_amount??0) },
    accounts: accounts.rows,
    categories: categories.rows,
    budgets: budgets.rows,
    goals: goals.rows,
    recurring: recurring.rows,
    preferences: prefs.rows[0]?.preferences ?? { widgets: { balance: true, trends: true, categories: true, budgets: true, goals: true }, chartMode: "expenses" }
  };
}
export async function GET(req: NextRequest) {
  try {
    const uid = ownerId(req);
    await ready(uid);
    const params = new URL(req.url).searchParams;
    const rawLimit = Number.parseInt(params.get("limit") || "100", 10);
    const rawOffset = Number.parseInt(params.get("offset") || "0", 10);
    const month = params.get("month");
    if (month && !validMonth(month)) return fail("El mes solicitado no es válido.", 400);
    const limit = Number.isFinite(rawLimit) ? Math.min(250, Math.max(1, rawLimit)) : 100;
    const offset = Number.isFinite(rawOffset) ? Math.min(1_000_000, Math.max(0, rawOffset)) : 0;
    return NextResponse.json({ ok: true, finance: await getData(uid, {limit, offset, reportMonth: month ?? undefined}), database: "connected" }, { headers: noCache });
  } catch (error) {
    console.error("DEMian FLUX GET:", error);
    return NextResponse.json({ ok: false, error: "No fue posible conectar con el módulo financiero FLUX." }, { status: 503, headers: noCache });
  }
}
export async function POST(req: NextRequest) {
  let uid: string;
  try { uid = ownerId(req); } catch { return fail("Esta cuenta no tiene un espacio de finanzas asociado.", 403); }
  let client: PoolClient | undefined;
  try {
    await ready(uid);
    const b = await req.json();
    const action = short(b.action, 50);
    client = await db().connect();
    await client.query("BEGIN");
    if (action === "transaction.create") {
      const type = short(b.type, 16);
      if (!["income","expense"].includes(type)) throw new Error("Tipo de movimiento inválido.");
      const category = short(b.category, 80);
      await ownCategory(client, category, type, uid);
      const account = await ownAccount(client, b.accountId, uid);
      const amount = positiveAmount(b.amount);
      const date = dateOrNull(b.date) ?? new Date().toISOString().slice(0,10);
      const { rows } = await client.query(`INSERT INTO public.flux_transactions(id,user_id,type,category,description,amount,transaction_date,account_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [randomUUID(),uid,type,category,short(b.description,500),amount,date,account?.id ?? null]);
      await client.query("COMMIT");
      return NextResponse.json({ok:true,id:rows[0].id,finance:await getData(uid)},{status:201,headers:noCache});
    }
    if (action === "transfer.create") {
      const from = await ownAccount(client,b.fromAccountId,uid);
      const to = await ownAccount(client,b.toAccountId,uid);
      if (!from || !to || from.id===to.id) throw new Error("Elige dos cuentas diferentes para transferir.");
      const amount=positiveAmount(b.amount);
      const date=dateOrNull(b.date)??new Date().toISOString().slice(0,10);
      const group=randomUUID();
      await client.query(`INSERT INTO public.flux_transactions(id,user_id,type,category,description,amount,transaction_date,account_id,transfer_group)
        VALUES($1,$2,'expense','Transferencia',$3,$4,$5,$6,$7),($8,$2,'income','Transferencia',$9,$4,$5,$10,$7)`,
        [randomUUID(),uid,"Transferencia a "+to.name,amount,date,from.id,group,randomUUID(),"Transferencia desde "+from.name,to.id]);
      await client.query("COMMIT");
      return NextResponse.json({ok:true,finance:await getData(uid)},{status:201,headers:noCache});
    }
    if (action === "account.create") {
      const name=short(b.name,80), type=short(b.accountType,16);
      if(!name||!["cash","bank","credit","other"].includes(type)) throw new Error("Completa el nombre y el tipo de cuenta.");
      const opening=Number(b.openingBalance??0);
      if(!Number.isFinite(opening)||Math.abs(opening)>999999999) throw new Error("Saldo inicial inválido.");
      await client.query("INSERT INTO public.flux_accounts(id,user_id,name,account_type,opening_balance,currency,is_active) VALUES($1,$2,$3,$4,$5,'MXN',true)",[randomUUID(),uid,name,type,opening]);
    } else if (action === "category.create") {
      const name=short(b.name,80), type=short(b.type,16), color=short(b.color,20)||"#168BFF", icon=short(b.icon,50)||"circle";
      if(!name||!["income","expense"].includes(type)) throw new Error("Completa el nombre y tipo de categoría.");
      await client.query("INSERT INTO public.flux_categories(id,user_id,name,type,color,icon,is_default) VALUES($1,$2,$3,$4,$5,$6,false)",[randomUUID(),uid,name,type,color,icon]);
    } else if (action === "budget.create") {
      const name=short(b.name,80), category=short(b.category,80), period=short(b.period,16), amount=positiveAmount(b.amountLimit), starts=dateOrNull(b.startsOn)??new Date().toISOString().slice(0,10);
      if(!name||!category||!["weekly","monthly","yearly"].includes(period)) throw new Error("Completa nombre, categoría, importe y periodo.");
      await client.query("INSERT INTO public.flux_budgets(id,user_id,name,category,amount_limit,period,starts_on,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,true)",[randomUUID(),uid,name,category,amount,period,starts]);
    } else if (action === "goal.create") {
      const name=short(b.name,100), target=positiveAmount(b.targetAmount), current=Number(b.currentAmount??0), date=dateOrNull(b.targetDate);
      if(!name||!Number.isFinite(current)||current<0||current>999999999) throw new Error("Revisa el nombre y el ahorro acumulado de la meta.");
      await client.query("INSERT INTO public.flux_savings_goals(id,user_id,name,target_amount,current_amount,target_date,status) VALUES($1,$2,$3,$4,$5,$6,$7)",[randomUUID(),uid,name,target,current,date,current>=target?"completed":"active"]);
    } else if (action === "recurring.create") {
      const name=short(b.name,100), type=short(b.type,16), category=short(b.category,80), frequency=short(b.frequency,16), amount=positiveAmount(b.amount), next=dateOrNull(b.nextDate);
      if(!name||!["income","expense"].includes(type)||!["weekly","biweekly","monthly","yearly"].includes(frequency)||!next) throw new Error("Completa nombre, tipo, frecuencia y siguiente fecha.");
      await ownCategory(client,category,type,uid);
      const account=await ownAccount(client,b.accountId,uid);
      await client.query("INSERT INTO public.flux_recurring_transactions(id,user_id,name,type,category,description,amount,frequency,next_date,account_id,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)",[randomUUID(),uid,name,type,category,short(b.description,500),amount,frequency,next,account?.id??null]);
    } else if (action === "recurring.post") {
      const id=short(b.id,100);
      const row=await client.query("SELECT * FROM public.flux_recurring_transactions WHERE id=$1 AND user_id=$2 AND is_active=true FOR UPDATE",[id,uid]);
      const r=row.rows[0];
      if(!r) throw new Error("El movimiento recurrente ya no está activo o no existe.");
      const date=String(r.next_date).slice(0,10);
      await client.query("INSERT INTO public.flux_transactions(id,user_id,type,category,description,amount,transaction_date,account_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[randomUUID(),uid,r.type,r.category,[r.name,r.description].filter(Boolean).join(" · "),r.amount,date,r.account_id]);
      await client.query("UPDATE public.flux_recurring_transactions SET next_date=CASE frequency WHEN 'weekly' THEN next_date+7 WHEN 'biweekly' THEN next_date+14 WHEN 'monthly' THEN (next_date+INTERVAL '1 month')::date WHEN 'yearly' THEN (next_date+INTERVAL '1 year')::date END,updated_at=now() WHERE id=$1 AND user_id=$2",[id,uid]);
    } else if (action === "preferences.update") {
      const preferences=b.preferences;
      if(!preferences||typeof preferences!=="object"||Array.isArray(preferences)) throw new Error("Preferencias inválidas.");
      await client.query("INSERT INTO public.flux_preferences(user_id,preferences,updated_at) VALUES($1,$2::jsonb,now()) ON CONFLICT(user_id) DO UPDATE SET preferences=EXCLUDED.preferences,updated_at=now()",[uid,JSON.stringify(preferences)]);
    } else {
      throw new Error("Acción financiera no reconocida.");
    }
    await client.query("COMMIT");
    return NextResponse.json({ok:true,finance:await getData(uid)},{status:201,headers:noCache});
  } catch(error) {
    if(client) { try { await client.query("ROLLBACK"); } catch {} }
    console.error("DEMian FLUX POST:",error);
    const message=error instanceof Error?error.message:"No se pudo completar la operación.";
    const code=message.includes("FLUX_DATABASE_URL")||message.includes("usuario financiero configurado")?503:400;
    return fail(code===503?"El módulo FLUX no está configurado correctamente.":message,code);
  } finally { client?.release(); }
}
export async function PATCH(req: NextRequest) {
  let uid: string;
  try { uid = ownerId(req); } catch { return fail("Esta cuenta no tiene un espacio de finanzas asociado.", 403); }
  let client:PoolClient|undefined;
  try {
    await ready(uid);
    const b=await req.json(), id=short(b.id,100), entity=short(b.entity,24);
    if(!id||!entity) return fail("Falta el registro que quieres actualizar.");
    client=await db().connect(); await client.query("BEGIN");
    if(entity==="transaction") {
      const type=short(b.type,16), category=short(b.category,80), amount=positiveAmount(b.amount), date=dateOrNull(b.date);
      if(!["income","expense"].includes(type)||!date) throw new Error("Revisa el tipo y la fecha.");
      await ownCategory(client,category,type,uid);
      const account=await ownAccount(client,b.accountId,uid);
      const result=await client.query("UPDATE public.flux_transactions SET type=$1,category=$2,description=$3,amount=$4,transaction_date=$5,account_id=$6 WHERE id=$7 AND user_id=$8 AND transfer_group IS NULL RETURNING id",[type,category,short(b.description,500),amount,date,account?.id??null,id,uid]);
      if(!result.rowCount) throw new Error("No se encontró el movimiento o pertenece a una transferencia.");
    } else if(entity==="account") {
      const name=short(b.name,80), type=short(b.accountType,16), opening=Number(b.openingBalance);
      if(!name||!["cash","bank","credit","other"].includes(type)||!Number.isFinite(opening)||Math.abs(opening)>999999999) throw new Error("Datos de cuenta inválidos.");
      const result=await client.query("UPDATE public.flux_accounts SET name=$1,account_type=$2,opening_balance=$3,is_active=$4 WHERE id=$5 AND user_id=$6 RETURNING id",[name,type,opening,b.isActive!==false,id,uid]);
      if(!result.rowCount) throw new Error("No se encontró la cuenta.");
    } else if(entity==="budget") {
      if(typeof b.name==="string") {
        const name=short(b.name,80), category=short(b.category,80), period=short(b.period,16), amount=positiveAmount(b.amountLimit), starts=dateOrNull(b.startsOn);
        if(!name||!category||!["weekly","monthly","yearly"].includes(period)||!starts) throw new Error("Completa nombre, categoría, importe y periodo.");
        await ownCategory(client,category,"expense",uid);
        const result=await client.query("UPDATE public.flux_budgets SET name=$1,category=$2,amount_limit=$3,period=$4,starts_on=$5 WHERE id=$6 AND user_id=$7 RETURNING id",[name,category,amount,period,starts,id,uid]);
        if(!result.rowCount) throw new Error("No se encontró el presupuesto.");
      } else {
        const active=b.isActive!==false;
        const result=await client.query("UPDATE public.flux_budgets SET is_active=$1 WHERE id=$2 AND user_id=$3 RETURNING id",[active,id,uid]);
        if(!result.rowCount) throw new Error("No se encontró el presupuesto.");
      }
    } else if(entity==="goal") {
      const add=Number(b.addAmount??0), status=short(b.status,16);
      if(!Number.isFinite(add)||add<0||add>999999999) throw new Error("El abono a la meta debe ser positivo.");
      if(status && !["active","paused","completed"].includes(status)) throw new Error("Estado de meta inválido.");
      const result=await client.query("UPDATE public.flux_savings_goals SET current_amount=current_amount+$1,status=COALESCE(NULLIF($2,''),CASE WHEN current_amount+$1>=target_amount THEN 'completed' ELSE status END),updated_at=now() WHERE id=$3 AND user_id=$4 RETURNING id",[add,status,id,uid]);
      if(!result.rowCount) throw new Error("No se encontró la meta de ahorro.");
    } else if(entity==="recurring") {
      if(typeof b.name==="string") {
        const name=short(b.name,100), type=short(b.type,16), category=short(b.category,80), frequency=short(b.frequency,16), amount=positiveAmount(b.amount), next=dateOrNull(b.nextDate);
        if(!name||!["income","expense"].includes(type)||!["weekly","biweekly","monthly","yearly"].includes(frequency)||!next) throw new Error("Completa nombre, tipo, frecuencia y siguiente fecha.");
        await ownCategory(client,category,type,uid);
        const account=await ownAccount(client,b.accountId,uid);
        const result=await client.query("UPDATE public.flux_recurring_transactions SET name=$1,type=$2,category=$3,description=$4,amount=$5,frequency=$6,next_date=$7,account_id=$8,updated_at=now() WHERE id=$9 AND user_id=$10 RETURNING id",[name,type,category,short(b.description,500),amount,frequency,next,account?.id??null,id,uid]);
        if(!result.rowCount) throw new Error("No se encontró el movimiento recurrente.");
      } else {
        const active=b.isActive!==false, next=dateOrNull(b.nextDate);
        const result=await client.query("UPDATE public.flux_recurring_transactions SET is_active=$1,next_date=COALESCE($2,next_date),updated_at=now() WHERE id=$3 AND user_id=$4 RETURNING id",[active,next,id,uid]);
        if(!result.rowCount) throw new Error("No se encontró el movimiento recurrente.");
      }
    } else {
      throw new Error("Tipo de registro no compatible.");
    }
    await client.query("COMMIT");
    return NextResponse.json({ok:true,finance:await getData(uid)},{headers:noCache});
  } catch(error) {
    if(client) { try{await client.query("ROLLBACK")}catch{} }
    console.error("DEMian FLUX PATCH:",error);
    return fail(error instanceof Error?error.message:"No se pudo actualizar el registro.",400);
  } finally { client?.release(); }
}
export async function DELETE(req:NextRequest) {
  try {
    const uid = ownerId(req);
    await ready(uid);
    const url=new URL(req.url), id=short(url.searchParams.get("id"),100), entity=short(url.searchParams.get("entity"),24);
    if(!id||!entity) return fail("Falta el registro que quieres eliminar.");
    const tables:Record<string,string>={transaction:"flux_transactions",account:"flux_accounts",budget:"flux_budgets",category:"flux_categories",goal:"flux_savings_goals",recurring:"flux_recurring_transactions"};
    const table=tables[entity];
    if(!table) return fail("Tipo de registro no válido.");
    if(entity==="transaction") {
      const result=await db().query("DELETE FROM public.flux_transactions WHERE id=$1 AND user_id=$2 AND transfer_group IS NULL RETURNING id",[id,uid]);
      if(!result.rowCount) return fail("No se encontró el movimiento o es una transferencia protegida.",404);
    } else {
      if(entity==="account") {
        const uses=await db().query("SELECT 1 FROM public.flux_transactions WHERE user_id=$1 AND account_id=$2 LIMIT 1",[uid,id]);
        if(uses.rows.length) return fail("Esta cuenta tiene movimientos asociados. Desactívala en lugar de eliminarla.",409);
      }
      if(entity==="category") {
        const uses=await db().query("SELECT 1 FROM public.flux_transactions WHERE user_id=$1 AND category=$2 LIMIT 1",[uid,(await db().query("SELECT name FROM public.flux_categories WHERE id=$1 AND user_id=$2",[id,uid])).rows[0]?.name??""]);
        if(uses.rows.length) return fail("Esta categoría ya tiene movimientos asociados.",409);
      }
      const result=await db().query(`DELETE FROM public.${table} WHERE id=$1 AND user_id=$2 RETURNING id`,[id,uid]);
      if(!result.rowCount) return fail("No se encontró el registro.",404);
    }
    return NextResponse.json({ok:true,finance:await getData(uid)},{headers:noCache});
  } catch(error) {
    console.error("DEMian FLUX DELETE:",error);
    return NextResponse.json({ok:false,error:"No se pudo eliminar el registro."},{status:503,headers:noCache});
  }
}
