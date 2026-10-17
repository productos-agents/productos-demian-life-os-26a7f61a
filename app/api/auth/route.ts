import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
export const runtime = "nodejs";
function tokenFor(password:string) { return createHmac("sha256",password).update("demian-session-v1").digest("hex"); }
export async function GET(req:NextRequest) {
  const secret=process.env.DEMIAN_ACCESS_PASSWORD;
  if(!secret) return NextResponse.json({ok:false,configured:false},{status:503});
  const actual=req.cookies.get("demian_session")?.value??"";
  const expected=tokenFor(secret);
  const authenticated=actual.length===expected.length&&timingSafeEqual(Buffer.from(actual),Buffer.from(expected));
  return NextResponse.json({ok:true,authenticated});
}
export async function POST(req:NextRequest) {
  const secret=process.env.DEMIAN_ACCESS_PASSWORD;
  if(!secret) return NextResponse.json({ok:false,error:"La clave de acceso no está configurada."},{status:503});
  let body:{password?:string};
  try { body=await req.json(); } catch { return NextResponse.json({ok:false,error:"Solicitud inválida."},{status:400}); }
  const supplied=String(body.password??"");
  const a=Buffer.from(supplied), b=Buffer.from(secret);
  const valid=a.length===b.length&&timingSafeEqual(a,b);
  if(!valid) return NextResponse.json({ok:false,error:"Clave incorrecta."},{status:401});
  const res=NextResponse.json({ok:true});
  res.cookies.set("demian_session",tokenFor(secret),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:60*60*24*30});
  return res;
}
export async function DELETE() {
  const res=NextResponse.json({ok:true});
  res.cookies.set("demian_session","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});
  return res;
}