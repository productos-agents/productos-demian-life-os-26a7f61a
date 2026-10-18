import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const uid = req.headers.get("x-demian-user-id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(uid)) return NextResponse.json({ok:false,error:"Inicia sesión."},{status:401});
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  if (!publicKey) return NextResponse.json({ok:false,error:"Push no configurado."},{status:503});
  return NextResponse.json({ok:true,publicKey},{headers:{"Cache-Control":"private, no-store"}});
}
