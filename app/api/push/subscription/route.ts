import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noCache = {"Cache-Control":"private, no-store, max-age=0"};
const g = globalThis as unknown as { demianPushPool?: Pool };
function db() {
  if (!process.env.DEMIAN_DATABASE_URL) throw new Error("Database not configured");
  if (!g.demianPushPool) g.demianPushPool = new Pool({connectionString:process.env.DEMIAN_DATABASE_URL,ssl:{rejectUnauthorized:false},max:3,connectionTimeoutMillis:8000,idleTimeoutMillis:20000});
  return g.demianPushPool;
}
function uid(req:NextRequest) {
  const id=req.headers.get("x-demian-user-id")||"";
  return /^[0-9a-f-]{36}$/i.test(id)?id:null;
}
function unauth(){return NextResponse.json({ok:false,error:"Inicia sesión para configurar las notificaciones."},{status:401,headers:noCache});}
export async function GET(req:NextRequest) {
  const user=uid(req); if(!user)return unauth();
  try {
    const q=await db().query("SELECT EXISTS(SELECT 1 FROM public.demian_push_subscriptions WHERE user_id=$1 AND active=true) AS subscribed",[user]);
    return NextResponse.json({ok:true,subscribed:q.rows[0]?.subscribed===true},{headers:noCache});
  } catch(e) { console.error("push status",e); return NextResponse.json({ok:false,error:"No se pudo consultar el estado push."},{status:503,headers:noCache}); }
}
export async function POST(req:NextRequest) {
  const user=uid(req); if(!user)return unauth();
  try {
    const body=await req.json(); const s=body?.subscription;
    const endpoint=typeof s?.endpoint==="string"?s.endpoint.trim():"";
    const p256dh=typeof s?.keys?.p256dh==="string"?s.keys.p256dh:"";
    const auth=typeof s?.keys?.auth==="string"?s.keys.auth:"";
    if(!endpoint.startsWith("https://")||endpoint.length>4096||p256dh.length<20||p256dh.length>256||auth.length<10||auth.length>256)
      return NextResponse.json({ok:false,error:"La suscripción no es válida."},{status:400,headers:noCache});
    const q=await db().query(
      "INSERT INTO public.demian_push_subscriptions(user_id,endpoint,p256dh,auth,user_agent,active,updated_at,last_seen_at) VALUES($1,$2,$3,$4,$5,true,NOW(),NOW()) "+
      "ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,user_agent=EXCLUDED.user_agent,active=true,updated_at=NOW(),last_seen_at=NOW() RETURNING id",
      [user,endpoint,p256dh,auth,(req.headers.get("user-agent")||"").slice(0,1000)]);
    if(!q.rowCount)return NextResponse.json({ok:false,error:"No se pudo registrar el dispositivo."},{status:409,headers:noCache});
    return NextResponse.json({ok:true,subscribed:true},{headers:noCache});
  } catch(e) { console.error("push subscribe",e); return NextResponse.json({ok:false,error:"No se pudo guardar la suscripción."},{status:503,headers:noCache}); }
}
export async function DELETE(req:NextRequest) {
  const user=uid(req); if(!user)return unauth();
  try {
    const body=await req.json().catch(()=>({})); const endpoint=typeof body?.endpoint==="string"?body.endpoint:"";
    if(!endpoint.startsWith("https://"))return NextResponse.json({ok:false,error:"Endpoint inválido."},{status:400,headers:noCache});
    await db().query("UPDATE public.demian_push_subscriptions SET active=false,updated_at=NOW() WHERE user_id=$1 AND endpoint=$2",[user,endpoint]);
    return NextResponse.json({ok:true,subscribed:false},{headers:noCache});
  } catch(e) { console.error("push unsubscribe",e); return NextResponse.json({ok:false,error:"No se pudo desactivar el dispositivo."},{status:503,headers:noCache}); }
}
