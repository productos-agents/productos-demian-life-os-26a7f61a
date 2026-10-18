import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { ensureIdentitySchema } from "../../../../lib/identity";
import { mexicoDateKey } from "../../../../lib/date-rules.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "private, no-store, max-age=0" };
const globalPools = globalThis as unknown as { privacyDemianPool?: Pool; privacyFluxPool?: Pool };
function validId(value: string | null) {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
function demianDb() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("Database not configured");
  if (!globalPools.privacyDemianPool) globalPools.privacyDemianPool = new Pool({ connectionString: process.env.DEMIAN_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, connectionTimeoutMillis: 8000 });
  return globalPools.privacyDemianPool;
}
function fluxDb() {
  if (!process.env.FLUX_DATABASE_URL) throw new Error("Finance database not configured");
  if (!globalPools.privacyFluxPool) globalPools.privacyFluxPool = new Pool({ connectionString: process.env.FLUX_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2, connectionTimeoutMillis: 8000 });
  return globalPools.privacyFluxPool;
}
export async function GET(req: NextRequest) {
  const uid = validId(req.headers.get("x-demian-user-id"));
  if (!uid) return NextResponse.json({ ok: false, error: "Necesitas iniciar sesión." }, { status: 401, headers: noCache });
  const fid = validId(req.headers.get("x-demian-flux-user-id"));
  try {
    await ensureIdentitySchema();
    const p = demianDb();
    const [profile, items, wellness, habitLogs, mood, preferences, push] = await Promise.all([
      p.query("SELECT id,name,email,role FROM public.demian_users WHERE id=$1 LIMIT 1", [uid]),
      p.query("SELECT id,kind,title,details,amount::text AS amount,category,due_date::text AS due_date,status,frequency,created_at,updated_at FROM public.demian_items WHERE user_id=$1 ORDER BY created_at ASC,id ASC", [uid]),
      p.query("SELECT id,log_date::text AS log_date,sleep_hours::float8 AS sleep_hours,water_glasses,activity_minutes,mood,weight_kg::float8 AS weight_kg,notes,created_at,updated_at FROM public.demian_wellness_logs WHERE user_id=$1 ORDER BY log_date ASC", [uid]),
      p.query("SELECT h.habit_id,h.log_date::text AS log_date FROM public.demian_habit_logs h JOIN public.demian_items i ON i.id=h.habit_id WHERE i.user_id=$1 ORDER BY h.log_date ASC", [uid]),
      p.query("SELECT id,checkin_date::text AS checkin_date,time_slot,mood,note,created_at FROM public.demian_mood_checkins WHERE user_id=$1 ORDER BY created_at ASC", [uid]),
      p.query("SELECT accent_theme,updated_at FROM public.demian_user_preferences WHERE user_id=$1 LIMIT 1", [uid]),
      p.query("SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE active=true)::int AS active FROM public.demian_push_subscriptions WHERE user_id=$1", [uid])
    ]);
    if (!profile.rows[0]) return NextResponse.json({ ok: false, error: "La cuenta ya no existe." }, { status: 404, headers: noCache });
    let finance: Record<string, unknown> | null = null;
    if (fid) {
      const f = fluxDb();
      const [financeProfile, transactions, accounts, categories, budgets, goals, recurring, fluxPreferences] = await Promise.all([
        f.query("SELECT id,name,email FROM public.flux_users WHERE id=$1 LIMIT 1", [fid]),
        f.query("SELECT id,type,category,description,amount::text AS amount,transaction_date::text AS transaction_date,account_id,transfer_to_account_id,transfer_group,created_at FROM public.flux_transactions WHERE user_id=$1 ORDER BY transaction_date ASC,created_at ASC,id ASC", [fid]),
        f.query("SELECT id,name,account_type,opening_balance::text AS opening_balance,currency,is_active,created_at FROM public.flux_accounts WHERE user_id=$1 ORDER BY created_at ASC,id ASC", [fid]),
        f.query("SELECT id,name,type,color,icon,is_default FROM public.flux_categories WHERE user_id=$1 ORDER BY type,name", [fid]),
        f.query("SELECT id,name,category,amount_limit::text AS amount_limit,period,starts_on::text AS starts_on,is_active,created_at FROM public.flux_budgets WHERE user_id=$1 ORDER BY created_at ASC", [fid]),
        f.query("SELECT id,name,target_amount::text AS target_amount,current_amount::text AS current_amount,target_date::text AS target_date,status,created_at FROM public.flux_savings_goals WHERE user_id=$1 ORDER BY created_at ASC", [fid]),
        f.query("SELECT id,name,type,category,description,amount::text AS amount,frequency,next_date::text AS next_date,account_id,is_active,created_at FROM public.flux_recurring_transactions WHERE user_id=$1 ORDER BY created_at ASC", [fid]),
        f.query("SELECT preferences FROM public.flux_preferences WHERE user_id=$1 LIMIT 1", [fid])
      ]);
      finance = {
        profile: financeProfile.rows[0] ?? null,
        transactions: transactions.rows,
        accounts: accounts.rows,
        categories: categories.rows,
        budgets: budgets.rows,
        savingsGoals: goals.rows,
        recurringTransactions: recurring.rows,
        preferences: fluxPreferences.rows[0]?.preferences ?? null
      };
    }
    const payload = {
      product: "DEMIAN CORE",
      generatedAt: new Date().toISOString(),
      profile: profile.rows[0],
      personalRecords: items.rows,
      habitCompletionLogs: habitLogs.rows,
      wellnessLogs: wellness.rows,
      moodCheckins: mood.rows,
      preferences: preferences.rows[0] ?? null,
      pushNotifications: { totalDevices: Number(push.rows[0]?.total ?? 0), activeDevices: Number(push.rows[0]?.active ?? 0), endpointsAndSecretsExcluded: true },
      finance
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: { ...noCache, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": "attachment; filename=\"demian-core-export-" + mexicoDateKey() + ".json\"" }
    });
  } catch (error) {
    console.error("DEMian privacy export:", error);
    return NextResponse.json({ ok: false, error: "No se pudo exportar todo el historial. Inténtalo de nuevo más tarde." }, { status: 503, headers: noCache });
  }
}
