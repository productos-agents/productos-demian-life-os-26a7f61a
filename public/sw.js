const CACHE="demian-public-assets-v4";
const SAFE_ASSETS=["/icon.svg","/icon-512.png","/manifest.webmanifest"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SAFE_ASSETS)).catch(()=>{}));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("demian-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting();});
self.addEventListener("push",event=>{
 let p={};try{p=event.data?event.data.json():{};}catch{p={body:"Abre DEMian para continuar."};}
 const target=typeof p.url==="string"&&p.url.startsWith("/")&&!p.url.startsWith("//")?p.url:"/";
 event.waitUntil(self.registration.showNotification(String(p.title||"DEMian · Un momento para ti").slice(0,100),{
  body:String(p.body||"Abre DEMian para continuar.").slice(0,240),icon:"/icon-512.png",badge:"/icon-512.png",
  tag:String(p.tag||"demian-"+Date.now()).slice(0,100),renotify:false,data:{url:target,kind:String(p.kind||"info")}
 }));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const target=typeof event.notification.data?.url==="string"&&event.notification.data.url.startsWith("/")&&!event.notification.data.url.startsWith("//")?event.notification.data.url:"/";
 event.waitUntil((async()=>{
  const cs=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const c of cs){if(new URL(c.url).origin===self.location.origin){try{await c.navigate(target);}catch{}return c.focus();}}
  return self.clients.openWindow(target);
 })());
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||!SAFE_ASSETS.includes(url.pathname))return;
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();void caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;})));
});
