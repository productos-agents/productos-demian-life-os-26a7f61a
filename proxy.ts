import { NextRequest, NextResponse } from "next/server";
async function expectedToken(password: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("demian-session-v1"));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2,"0")).join("");
}
function constantTimeEqual(a:string,b:string) {
  if(a.length!==b.length) return false;
  let diff=0; for(let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
export async function proxy(req: NextRequest) {
  const password=process.env.DEMIAN_ACCESS_PASSWORD;
  const isAuthRoute=req.nextUrl.pathname==="/login"||req.nextUrl.pathname.startsWith("/api/auth");
  if(isAuthRoute) return NextResponse.next();
  if(!password) return NextResponse.redirect(new URL("/login?setup=1",req.url));
  const token=req.cookies.get("demian_session")?.value??"";
  const expected=await expectedToken(password);
  if(constantTimeEqual(token,expected)) return NextResponse.next();
  if(req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ok:false,error:"Sesión requerida."},{status:401});
  const url=new URL("/login",req.url);url.searchParams.set("next",req.nextUrl.pathname);
  return NextResponse.redirect(url);
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js).*)"]};