"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FinanceModule from "./components/FinanceModule";
import WellnessModule from "./components/WellnessModule";
import KnowledgeModule from "./components/KnowledgeModule";
import Nudge from "./components/RoutineModal";
import LineIcon from "./components/LineIcon";
import type { LineIconName } from "./components/LineIcon";

type Kind = "task" | "transaction" | "habit" | "note";
type Item = { id:string; kind:Kind; title:string; details:string; amount:number|null; category:string; dueDate:string; status:string; frequency:string; doneToday?:boolean; createdAt:string };
type FinanceSnapshot = {accounts:Array<{account_type:string;balance:number;is_active:boolean}>;transactions:Array<{type:string;amount:number;transaction_date:string;transfer_group:string|null}>};
type Section = "overview" | Kind;
const sections: {id:Section; label:string; short:string; icon:LineIconName}[] = [
  {id:"overview",label:"Vista general",short:"Inicio",icon:"home"},
  {id:"task",label:"Vida en orden",short:"Agenda",icon:"calendar-clock"},
  {id:"transaction",label:"Finanzas",short:"Dinero",icon:"wallet"},
  {id:"habit",label:"Salud y hábitos",short:"Hábitos",icon:"heart-pulse"},
  {id:"note",label:"Segundo cerebro",short:"Notas",icon:"book-open"}
];
const today = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const money = (n:number) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:2}).format(n);

// Frases compartidas por todos los usuarios. La fecha se calcula con la zona horaria
// de Ciudad de México para que todos vean la misma frase durante el mismo día.
const dailyQuotes = [
  {text:"No necesitas tener todo resuelto. Solo necesitas saber cuál es el siguiente paso.",tagline:"UNA COSA A LA VEZ"},
  {text:"No subestimes lo que puedes construir con pequeños esfuerzos repetidos.",tagline:"LA CONSTANCIA CUENTA"},
  {text:"Avanzar despacio también es avanzar. Lo importante es no abandonarte.",tagline:"SIGUE A TU RITMO"},
  {text:"Hoy no tienes que hacerlo todo; elige lo importante y empieza por ahí.",tagline:"UN PASO CONSCIENTE"},
  {text:"La disciplina es cumplir contigo incluso cuando la motivación no aparece.",tagline:"CUMPLE CONTIGO"},
  {text:"Cada día es una nueva oportunidad para acercarte a la vida que quieres.",tagline:"VUELVE A EMPEZAR"},
  {text:"No compares tu capítulo uno con el capítulo veinte de alguien más.",tagline:"TU CAMINO ES TUYO"},
  {text:"Lo que haces con frecuencia termina construyendo tu futuro.",tagline:"LOS HÁBITOS SUMAN"},
  {text:"Puedes cambiar de rumbo sin negar todo lo que ya has recorrido.",tagline:"AJUSTAR TAMBIÉN ES CRECER"},
  {text:"Una decisión pequeña y valiente puede cambiar el rumbo de tu día.",tagline:"EMPIEZA CON LO POSIBLE"},
  {text:"Descansar también forma parte del progreso. No tienes que ganarte una pausa.",tagline:"RESPETA TU ENERGÍA"},
  {text:"Concéntrate en lo que sí puedes hacer hoy; lo demás puede esperar.",tagline:"VUELVE AL PRESENTE"},
  {text:"No necesitas sentirte listo para dar el primer paso.",tagline:"EMPIEZA AUN CON DUDAS"},
  {text:"El progreso real a veces es silencioso: seguir intentando ya cuenta.",tagline:"RECONOCE TU AVANCE"},
  {text:"Haz espacio para la vida que quieres con las decisiones que tomas hoy.",tagline:"ELIGE CON INTENCIÓN"},
  {text:"Equivocarte no borra tu avance; te da información para hacerlo mejor.",tagline:"APRENDE Y CONTINÚA"},
  {text:"La claridad llega más fácil cuando empiezas a ordenar una cosa a la vez.",tagline:"ORDENA LO QUE PUEDES"},
  {text:"No tienes que resolverlo todo en un día para estar haciendo las cosas bien.",tagline:"DATE TIEMPO"},
  {text:"Tu futuro también se construye con las promesas pequeñas que te cumples.",tagline:"CONFÍA EN TUS ACCIONES"},
  {text:"Hazlo simple, hazlo posible y vuelve a hacerlo mañana.",tagline:"LA REPETICIÓN TRANSFORMA"},
  {text:"A veces, el mayor avance es dejar de cargar con lo que ya no te ayuda.",tagline:"SUELTA Y AVANZA"},
  {text:"Cuida tu atención: aquello a lo que dedicas tus días termina creciendo.",tagline:"PROTEGE LO IMPORTANTE"},
  {text:"No necesitas un día perfecto para tener un día valioso.",tagline:"HAZ LO MEJOR POSIBLE"},
  {text:"La confianza también se construye actuando antes de tener todas las respuestas.",tagline:"DA EL PRIMER PASO"},
  {text:"Lo importante no es nunca caer; es aprender a regresar a lo que te hace bien.",tagline:"REGRESA A TI"},
  {text:"Cuando todo parezca demasiado, reduce el problema al siguiente paso.",tagline:"HAZLO MÁS PEQUEÑO"},
  {text:"Tu bienestar merece un lugar en tu agenda, no solo el tiempo que sobra.",tagline:"TÚ TAMBIÉN IMPORTAS"},
  {text:"La vida que deseas necesita decisiones pequeñas, no solo grandes planes.",tagline:"CONVIERTE INTENCIÓN EN ACCIÓN"},
  {text:"Puedes sentir miedo y aun así elegir avanzar.",tagline:"VALENTÍA ES CONTINUAR"},
  {text:"No confundas una pausa con rendirte. A veces necesitas recuperar fuerzas.",tagline:"RESPIRA Y RETOMA"},
  {text:"Celebra el avance que antes te parecía imposible.",tagline:"MIRA LO QUE HAS LOGRADO"},
  {text:"Menos perfección, más práctica. Así se construyen las cosas que duran.",tagline:"HECHO ES MEJOR QUE PERFECTO"},
  {text:"No gastes toda tu energía pensando en empezar; usa un poco para comenzar.",tagline:"PASA A LA ACCIÓN"},
  {text:"Ser constante no significa hacerlo siempre perfecto, sino volver a intentarlo.",tagline:"VUELVE CUANTAS VECES HAGA FALTA"},
  {text:"Dale a tus metas un lugar en tu día, aunque solo sean diez minutos.",tagline:"PROTEGE TU PROPÓSITO"},
  {text:"Tienes permiso de aprender mientras avanzas.",tagline:"NO TIENES QUE SABERLO TODO"},
  {text:"Agradece lo que te sostiene y trabaja por aquello que quieres cambiar.",tagline:"GRATITUD Y ACCIÓN"},
  {text:"Un límite saludable también es una forma de cuidar lo que importa.",tagline:"CUIDA TU PAZ"},
  {text:"No todo merece tu respuesta inmediata; elige con calma dónde poner tu energía.",tagline:"RESPONDE CON INTENCIÓN"},
  {text:"Los días difíciles no cuentan toda tu historia.",tagline:"ESTO TAMBIÉN PASARÁ"},
  {text:"La mejor rutina es la que puedes sostener en la vida que realmente tienes.",tagline:"HAZLO SOSTENIBLE"},
  {text:"Tu valor no depende de cuánto hayas producido hoy.",tagline:"ERES MÁS QUE TUS PENDIENTES"},
  {text:"Haz hoy algo que le facilite el camino a tu yo de mañana.",tagline:"REGÁLATE UN MEJOR MAÑANA"},
  {text:"Los cambios duraderos comienzan cuando eliges volver a intentarlo.",tagline:"EMPEZAR OTRA VEZ ES PODER"},
  {text:"Puedes construir orden sin exigirte tener una vida perfecta.",tagline:"ORDEN, NO PERFECCIÓN"},
  {text:"A veces, lo más productivo que puedes hacer es detenerte y pensar con claridad.",tagline:"PAUSA PARA ELEGIR MEJOR"},
  {text:"Cada pequeña acción alineada con tus valores fortalece la vida que estás creando.",tagline:"VIVE DE ACUERDO CON LO TUYO"},
  {text:"No tienes que ver todo el camino; basta con iluminar el siguiente tramo.",tagline:"DA EL SIGUIENTE PASO"},
  {text:"Haz menos cosas con más intención y deja espacio para lo que de verdad importa.",tagline:"PRIORIZA CON CALMA"},
  {text:"La paciencia contigo mismo también es una forma de compromiso.",tagline:"TRÁTATE CON RESPETO"},
  {text:"Hoy puede ser sencillo y aun así contar como un buen comienzo.",tagline:"EMPIEZA DONDE ESTÁS"},
  {text:"Los resultados tardan; el esfuerzo de hoy sigue teniendo valor.",tagline:"CONFÍA EN EL PROCESO"},
  {text:"Tu atención es limitada: entrégasela a aquello que quieres hacer crecer.",tagline:"ALIMENTA LO IMPORTANTE"},
  {text:"Haz una cosa pendiente, cuida una necesidad y date crédito por ambas.",tagline:"AVANCE Y BIENESTAR"},
  {text:"No tienes que demostrar nada a todos. Construye una vida que tenga sentido para ti.",tagline:"ELIGE TU PROPIA MEDIDA"},
  {text:"La organización no busca controlarlo todo; busca darte más espacio para vivir.",tagline:"ORDEN PARA VIVIR MEJOR"},
  {text:"Cada vez que retomas un buen hábito, refuerzas la persona que quieres ser.",tagline:"REAFIRMA TU CAMINO"},
  {text:"Permítete comenzar de nuevo sin castigarte por lo que pasó ayer.",tagline:"HOY ES UNA NUEVA OPORTUNIDAD"},
  {text:"No esperes a tener más tiempo: empieza por darle prioridad a lo que importa.",tagline:"HAZLE ESPACIO"},
  {text:"Elige el siguiente paso que te acerque, aunque sea un poco, a tu tranquilidad.",tagline:"AVANZA HACIA LA CALMA"},
  {text:"Un día a la vez no es poco; es una manera real de construir algo grande.",tagline:"UN DÍA A LA VEZ"}
];
const getMexicoDateKey = () => {
  const parts = new Intl.DateTimeFormat("en-US",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
};
const getDailyQuote = (dateKey = getMexicoDateKey()) => {
  const dayNumber = Math.floor(Date.parse(dateKey+"T00:00:00Z")/86400000);
  return dailyQuotes[((dayNumber%dailyQuotes.length)+dailyQuotes.length)%dailyQuotes.length];
};
function decodeVapidKey(value:string) {
  const normalized=value.replace(/-/g,"+").replace(/_/g,"/");
  const padded=normalized+"=".repeat((4-normalized.length%4)%4);
  const raw=window.atob(padded);
  const output=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)output[i]=raw.charCodeAt(i);
  return output;
}
export default function Home() {
  const [items,setItems] = useState<Item[]>([]);
  const [userName,setUserName] = useState("Mi espacio");
  const [quoteDay,setQuoteDay] = useState(()=>getMexicoDateKey());
  const userInitial = userName.trim().charAt(0).toUpperCase() || "D";
  const [section,setSection] = useState<Section>("overview");
  const [loading,setLoading] = useState(true);
  const [connection,setConnection] = useState<"checking"|"connected"|"error">("checking");
  const [financeSnapshot,setFinanceSnapshot] = useState<FinanceSnapshot|null>(null);
  const [financeConnection,setFinanceConnection] = useState<"checking"|"connected"|"error">("checking");
  const [query,setQuery] = useState("");
  const [notice,setNotice] = useState("");
  const [formOpen,setFormOpen] = useState(false);
  const [form,setForm] = useState({title:"",details:"",amount:"",category:"",dueDate:"",frequency:"Diario"});
  const [saving,setSaving] = useState(false);
  const [reminders,setReminders] = useState(false);
  const [pushEnabled,setPushEnabled] = useState(false);
  const [showDialog,setShowDialog] = useState(false);
  const [routineDialog,setRoutineDialog] = useState<string|null>(null);
  const [routineMood,setRoutineMood] = useState(3);
  const [routineNote,setRoutineNote] = useState("");
  const [routineSlot,setRoutineSlot] = useState("manual");
  const [dailyWord,setDailyWord] = useState({word:"Constancia",message:"Los pasos pequeños que repites hoy construyen un mañana más sólido."});
  const refresh = useCallback(async () => {
    setFinanceConnection("checking");
    try {
      const identity = await fetch("/api/auth",{cache:"no-store"});
      const account = await identity.json();
      if (identity.ok && account.ok && account.user?.name) setUserName(account.user.name);
    } catch {}
    try {
      const r = await fetch("/api/data?date="+today(),{cache:"no-store"});
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Error de conexión");
      setItems(d.items); setConnection("connected");
    } catch { setConnection("error"); }
    try {
      const r = await fetch("/api/finance",{cache:"no-store"});
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "FLUX no disponible");
      setFinanceSnapshot({accounts:d.finance.accounts,transactions:d.finance.transactions});
      setFinanceConnection("connected");
    } catch { setFinanceSnapshot(null); setFinanceConnection("error"); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ void refresh(); },[refresh]);
  useEffect(()=>{
    let cancelled=false;
    if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)) return;
    void navigator.serviceWorker.ready.then(reg=>reg.pushManager.getSubscription()).then(subscription=>{
      if(!cancelled){const enabled=!!subscription&&Notification.permission==="granted";setPushEnabled(enabled);setReminders(enabled);}
    }).catch(()=>{});
    return ()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const routine=params.get("demianPrompt");
    if(routine==="mood"){
      setRoutineSlot(params.get("slot")||"manual");setRoutineDialog("mood");
    } else if(routine==="money"){
      setSection("transaction");setRoutineDialog("money");
    } else if(routine==="reminder"){
      setSection("task");setRoutineDialog("reminder");
    } else if(routine==="motivation"){
      setDailyWord({word:params.get("word")||"Constancia",message:params.get("message")||"Los pasos pequeños que repites hoy construyen un mañana más sólido."});
      setRoutineDialog("motivation");
    }
    if(routine){
      params.delete("demianPrompt");params.delete("slot");params.delete("word");params.delete("message");
      const search=params.toString();
      window.history.replaceState({}, "", window.location.pathname+(search?"?"+search:"")+window.location.hash);
    }
  },[]);
  useEffect(()=>{
    const interval=window.setInterval(()=>{
      const next=getMexicoDateKey();
      setQuoteDay(current=>current===next?current:next);
    },60_000);
    return ()=>window.clearInterval(interval);
  },[]);
  useEffect(()=>{
    if(connection!=="connected"||!("Notification" in window)||Notification.permission!=="granted") return;
    const due=items.filter(i=>i.kind==="task"&&i.status!=="done"&&i.dueDate&&i.dueDate<=today());
    if(!due.length)return;
    const key="demian-notified-"+today();
    let seen:string[]=[]; try{seen=JSON.parse(localStorage.getItem(key)||"[]") as string[]}catch{}
    const fresh=due.filter(i=>!seen.includes(i.id));
    if(fresh.length){
      const body=fresh.slice(0,3).map(i=>i.title).join(" · ")+(fresh.length>3?" y "+(fresh.length-3)+" más":"");
      void navigator.serviceWorker.ready.then(reg=>reg.showNotification("DEMian · Tareas por atender",{body,icon:"/icon-512.png",data:{url:"/?demianPrompt=reminder"}})).catch(()=>{
        try { new Notification("DEMian · Tareas por atender",{body}); } catch {}
      });
      localStorage.setItem(key,JSON.stringify([...seen,...fresh.map(i=>i.id)]));
    }
  },[connection,items,reminders]);
  const filtered = useMemo(()=>items.filter(i=>(section==="overview"||i.kind===section)&&[i.title,i.details,i.category].join(" ").toLowerCase().includes(query.toLowerCase())),[items,section,query]);
  const tasks = items.filter(i=>i.kind==="task");
  const openTasks = tasks.filter(i=>i.status!=="done");
  const dueTasks = openTasks.filter(i=>i.dueDate && i.dueDate<=today());
  const financeTx = financeSnapshot?.transactions ?? [];
  const financeAccounts = financeSnapshot?.accounts ?? [];
  const financeMonth = today().slice(0,7);
  const monthFinanceTx = financeTx.filter(t=>String(t.transaction_date).slice(0,7)===financeMonth);
  const income = monthFinanceTx.filter(t=>t.type==="income"&&!t.transfer_group).reduce((s,t)=>s+Number(t.amount||0),0);
  const expenses = monthFinanceTx.filter(t=>t.type==="expense"&&!t.transfer_group).reduce((s,t)=>s+Number(t.amount||0),0);
  const financeBalance = financeAccounts.filter(a=>a.is_active).reduce((s,a)=>s+(a.account_type==="credit"?-Number(a.balance):Number(a.balance)),0);
  const financeMovementCount = monthFinanceTx.filter(t=>!t.transfer_group).length;
  const habits = items.filter(i=>i.kind==="habit");
  const habitsDoneToday=habits.filter(i=>i.doneToday).length;
  const notes = items.filter(i=>i.kind==="note");
  const add = async (e:React.FormEvent) => {
    e.preventDefault(); if (!form.title.trim()) return;
    setSaving(true); setNotice("");
    const payload = {kind:section==="overview"?"task":section,...form,category:section==="transaction"?(form.category||"Ingreso"):form.category,amount:section==="transaction"?form.amount:null,logDate:today()};
    try {
      const r=await fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const d=await r.json(); if(!r.ok||!d.ok) throw new Error(d.error||"No se pudo guardar");
      setItems(prev=>[d.item,...prev]); setForm({title:"",details:"",amount:"",category:"",dueDate:"",frequency:"Diario"});setFormOpen(false);setNotice("Guardado correctamente.");
    } catch(e) {setNotice(e instanceof Error?e.message:"Error al guardar");}
    finally {setSaving(false);}
  };
  const toggle = async (item:Item) => {
    const status=item.status==="done"?"active":"done";
    try { const r=await fetch("/api/data",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,status,logDate:today()})}); const d=await r.json();if(!r.ok||!d.ok)throw new Error();setItems(prev=>prev.map(x=>x.id===item.id?d.item:x)); }
    catch {setNotice("No se pudo actualizar. Comprueba la conexión.");}
  };
  const toggleHabit = async (item:Item) => {
    const doneToday=!item.doneToday;
    try{const r=await fetch("/api/data",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,doneToday,logDate:today()})});const d=await r.json();if(!r.ok||!d.ok)throw new Error();setItems(prev=>prev.map(x=>x.id===item.id?d.item:x));}
    catch{setNotice("No se pudo actualizar el hábito. Comprueba la conexión.");}
  };
  const exportCalendar = () => {
    const dated=tasks.filter(t=>t.dueDate&&t.status!=="done");
    if(!dated.length){setNotice("Añade una fecha límite a una tarea para exportarla al calendario.");return;}
    const esc=(s:string)=>s.split(String.fromCharCode(92)).join(String.fromCharCode(92,92)).split(",").join(String.fromCharCode(92)+",").split(";").join(String.fromCharCode(92)+";").split(String.fromCharCode(10)).join(String.fromCharCode(92)+"n");
    const events=dated.map(t=>{
      const start=t.dueDate.replace(/-/g,"");
      const next=new Date(t.dueDate+"T12:00:00"); next.setDate(next.getDate()+1);
      const end=next.getFullYear()+String(next.getMonth()+1).padStart(2,"0")+String(next.getDate()).padStart(2,"0");
      return ["BEGIN:VEVENT","UID:demian-"+t.id+"@life-os","DTSTAMP:"+new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,""),"DTSTART;VALUE=DATE:"+start,"DTEND;VALUE=DATE:"+end,"SUMMARY:"+esc(t.title),...(t.details?["DESCRIPTION:"+esc(t.details)]:[]),"END:VEVENT"].join("\r\n");
    });
    const content=["BEGIN:VCALENDAR","VERSION:2.0","CALSCALE:GREGORIAN","PRODID:-//DEMian Life OS//ES","METHOD:PUBLISH",...events,"END:VCALENDAR"].join("\r\n");
    const url=URL.createObjectURL(new Blob([content],{type:"text/calendar;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="demian-agenda.ics";a.click();URL.revokeObjectURL(url);setNotice("Agenda exportada. Importa el archivo .ics en Calendario de Apple o Google Calendar.");
  };
  const remove = async (item:Item) => {
    try {const r=await fetch("/api/data?id="+encodeURIComponent(item.id),{method:"DELETE"});const d=await r.json();if(!r.ok||!d.ok)throw new Error();setItems(prev=>prev.filter(x=>x.id!==item.id));setNotice("Registro eliminado.");}
    catch {setNotice("No se pudo eliminar el registro.");}
  };
  const logout = async () => { try { await fetch("/api/auth", { method: "DELETE" }); window.location.assign("/login"); } catch { setNotice("No se pudo cerrar la sesión."); } };
  const enableReminders = async () => {
    try {
      if(pushEnabled){
        const registration=await navigator.serviceWorker.ready;
        const subscription=await registration.pushManager.getSubscription();
        if(subscription){
          const response=await fetch("/api/push/subscription",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint:subscription.endpoint})});
          if(!response.ok)throw new Error("No se pudo desactivar este dispositivo.");
          await subscription.unsubscribe();
        }
        setPushEnabled(false);setReminders(false);setNotice("Notificaciones desactivadas en este dispositivo.");return;
      }
      if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window)){
        setNotice("Este navegador no admite push. En iPhone, abre DEMian desde el icono de la pantalla de inicio.");return;
      }
      let permission=Notification.permission;
      if(permission!=="granted")permission=await Notification.requestPermission();
      if(permission!=="granted"){setNotice("No se concedió permiso de notificaciones.");return;}
      const keyResponse=await fetch("/api/push/public-key",{cache:"no-store"});
      const keyData=await keyResponse.json();
      if(!keyResponse.ok||!keyData.publicKey)throw new Error(keyData.error||"Falta configurar la clave del servidor.");
      const registration=await navigator.serviceWorker.ready;
      const existing=await registration.pushManager.getSubscription();
      const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidKey(keyData.publicKey)});
      const saved=await fetch("/api/push/subscription",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subscription:subscription.toJSON()})});
      const result=await saved.json();
      if(!saved.ok||!result.ok)throw new Error(result.error||"No se pudo registrar el dispositivo.");
      setPushEnabled(true);setReminders(true);setNotice("Notificaciones push activadas. Comprobando la entrega…");
      const testResponse=await fetch("/api/push/test",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      const testResult=await testResponse.json().catch(()=>({ok:false}));
      if(testResponse.ok&&testResult.ok) setNotice("Notificaciones activadas y aviso de prueba enviado a este dispositivo.");
      else setNotice("Notificaciones activadas. El aviso de prueba no pudo confirmarse; revisaremos la entrega al recibir el primer recordatorio.");
    } catch(error) { setNotice(error instanceof Error?error.message:"No se pudieron activar las notificaciones."); }
  };
  const saveMoodCheckin=async()=>{
    try{
      const response=await fetch("/api/push/mood",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mood:routineMood,note:routineNote,timeSlot:routineSlot})});
      const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||"No se pudo guardar el check-in.");
      setRoutineDialog(null);setRoutineNote("");setNotice("Gracias por registrar cómo te sientes. Tu check-in quedó guardado en DEMian.");
    }catch(error){setNotice(error instanceof Error?error.message:"No se pudo guardar el check-in.");}
  };
  const heading=sections.find(s=>s.id===section)?.label||"DEMian";
  return <main className="shell"><Nudge kind={routineDialog as any} onClose={()=>setRoutineDialog(null)} mood={routineMood} setMood={setRoutineMood} note={routineNote} setNote={setRoutineNote} onSaveMood={saveMoodCheckin} word={dailyWord.word} message={dailyWord.message} onMoney={()=>setSection("transaction")} onReminder={()=>{setRoutineDialog(null);setSection("task");setForm({title:"",details:"",amount:"",category:"",dueDate:"",frequency:"Diario"});setFormOpen(true);}} />
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">D<span>·</span></div><div><b>DEMian</b><small>LIFE OS <i>V0.1</i></small></div></div>
      <div className="workspace"><span className="avatar">{userInitial}</span><div><b>{userName}</b><small>Espacio personal</small></div><span className="dots">•••</span></div>
      <p className="navLabel">TU SISTEMA</p>
      <nav>{sections.map(s=><button key={s.id} onClick={()=>setSection(s.id)} className={section===s.id?"navItem active":"navItem"}><span className="navGlyph"><LineIcon name={s.icon} size={19}/></span><span>{s.label}</span>{s.id==="task"&&openTasks.length>0&&<em>{openTasks.length}</em>}</button>)}</nav>
      <div className="sidebarBottom"><div className="connection"><span className={"statusDot "+connection}></span><div><b>{connection==="connected"?"Base de datos conectada":connection==="checking"?"Verificando conexión":"Sin conexión"}</b><small>{connection==="connected"?"PostgreSQL · Neon":connection==="checking"?"Comprobando persistencia":"Revisa configuración del servidor"}</small></div></div><button className="quietBtn" onClick={()=>void enableReminders()}><LineIcon name={pushEnabled?"check-circle":"bell" as LineIconName} size={16}/>{pushEnabled?"Notificaciones activas · Desactivar":"Activar notificaciones push"}</button><button className="quietBtn logoutBtn" onClick={logout}><LineIcon name="log-out" size={16}/>Cerrar sesión</button><small className="privacy">Tus registros se guardan en la base de datos de DEMian.</small></div>
    </aside>
    <section className="main">
      <header className="topbar"><div className="breadcrumb">DEMian <span>/</span> {heading}</div><div className="topActions"><div className="searchBox"><LineIcon name="search" size={15}/><input aria-label="Buscar" placeholder="Buscar en tu sistema..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><button className="roundBtn" title="Actualizar" aria-label="Actualizar" onClick={()=>void refresh()}><LineIcon name="refresh-cw" size={16}/></button><span className="avatar">{userInitial}</span></div></header>
      <section className="pushSetup" aria-label="Configuración de notificaciones">
        <div className="pushSetupCopy"><b>{pushEnabled?"Notificaciones push activas":"Activa las notificaciones de DEMian"}</b><small>{pushEnabled?"Recibirás tus pausas de bienestar, finanzas, recordatorios y la palabra del día.":"3 pausas de bienestar, 5 pausas financieras, revisión de recordatorios y palabra motivacional cada mañana."}</small></div>
        <button className="pushSetupButton" onClick={()=>void enableReminders()}>{pushEnabled?"Desactivar":"Activar notificaciones"}</button>
      </section>
      <div className="content">
        {section==="overview"?<>
          <div className="welcome"><div><p className="eyebrow">{new Intl.DateTimeFormat("es-MX",{weekday:"long"}).format(new Date()).toUpperCase()} · TU CENTRO DE CONTROL</p><h1>Vamos a poner tu vida<br/><span>en orden.</span></h1><p className="subhead">Todo lo importante, en un solo lugar. Un paso a la vez.</p></div><div className="dateCard"><span>HOY</span><b>{new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"short"}).format(new Date())}</b><small>{new Intl.DateTimeFormat("es-MX",{weekday:"long"}).format(new Date())}</small></div></div>
          <div className="sectionHead"><div><h2>Tu resumen</h2><p>Una vista rápida de cómo va tu día.</p></div><span className={"dbPill "+(connection==="connected"&&financeConnection==="connected"?"connected":connection==="error"||financeConnection==="error"?"error":"")}>{connection==="connected"&&financeConnection==="connected"?"● SINCRONIZADO":connection==="checking"||financeConnection==="checking"?"◌ CONECTANDO":"● SIN CONEXIÓN"}</span></div>
          <div className="statGrid">
            <article className="statCard"><div className="statTop"><span className="statIcon"><LineIcon name="calendar-clock" size={20}/></span><span className="statHint">AGENDA</span></div><strong>{openTasks.length.toString().padStart(2,"0")}</strong><p>Pendientes activos</p><small>{dueTasks.length?dueTasks.length+" requieren atención":"Tu agenda bajo control"}</small></article>
            <article className="statCard"><div className="statTop"><span className="statIcon"><LineIcon name="wallet" size={20}/></span><span className="statHint">FINANZAS</span></div><strong>{financeConnection==="connected"?money(financeBalance):"—"}</strong><p>Saldo neto de cuentas</p><small>{financeConnection==="connected"?financeMovementCount+" movimientos este mes":financeConnection==="checking"?"Conectando con FLUX":"FLUX no disponible"}</small></article>
            <article className="statCard"><div className="statTop"><span className="statIcon"><LineIcon name="heart-pulse" size={20}/></span><span className="statHint">BIENESTAR</span></div><strong>{habitsDoneToday.toString().padStart(2,"0")}</strong><p>Hábitos completados hoy</p><small>{habitsDoneToday} de {habits.length} registrados</small></article>
            <article className="statCard"><div className="statTop"><span className="statIcon"><LineIcon name="book-open" size={20}/></span><span className="statHint">CONOCIMIENTO</span></div><strong>{notes.length.toString().padStart(2,"0")}</strong><p>Notas en tu cerebro</p><small>Ideas listas para recuperar</small></article>
          </div>
          <div className="dashboardGrid">
            <section className="panel agendaPanel"><div className="panelHead"><div><h3>Lo que sigue</h3><p>Tus próximas tareas</p></div><button className="textBtn" onClick={()=>setSection("task")}>Ver agenda ↗</button></div>
              {loading?<div className="empty">Cargando tus registros…</div>:openTasks.slice(0,4).length?<div className="taskList">{openTasks.slice(0,4).map(t=><div className="taskRow" key={t.id}><button className="check" onClick={()=>void toggle(t)} aria-label="Completar tarea"></button><div className="taskText"><b>{t.title}</b><small>{t.dueDate?"Fecha límite: "+t.dueDate:t.details||"Sin fecha asignada"}</small></div><button className="more" onClick={()=>void remove(t)} aria-label="Eliminar tarea">×</button></div>)}</div>:<div className="empty"><span><LineIcon name="sparkles" size={23}/></span><b>Espacio para lo que importa.</b><p>Añade tu primera tarea para comenzar.</p><button className="textBtn" onClick={()=>{setSection("task");setFormOpen(true)}}>Crear una tarea ↗</button></div>}
              <button className="addRow" onClick={()=>{setSection("task");setFormOpen(true)}}><span>＋</span> Añadir tarea</button>
            </section>
            <section className="panel moneyPanel"><div className="panelHead"><div><h3>Tu dinero</h3><p>{new Intl.DateTimeFormat("es-MX",{month:"long",year:"numeric"}).format(new Date())} · FLUX</p></div><button className="textBtn" onClick={()=>setSection("transaction")}>Ver finanzas ↗</button></div><div className="balanceLabel">BALANCE NETO DE CUENTAS</div><div className="balance">{financeConnection==="connected"?money(financeBalance):"—"}</div><div className="moneyBars"><div><span><i className="incomeDot"></i>Ingresos del mes</span><b>{financeConnection==="connected"?money(income):"—"}</b></div><div className="bar"><i style={{width:(income+expenses?income/(income+expenses)*100:0)+"%"}}/></div><div><span><i className="expenseDot"></i>Gastos del mes</span><b>{financeConnection==="connected"?money(expenses):"—"}</b></div><div className="bar red"><i style={{width:(income+expenses?expenses/(income+expenses)*100:0)+"%"}}/></div></div><button className="outlineBtn" onClick={()=>{setSection("transaction");setFormOpen(true)}}>＋ Registrar movimiento</button><p className="microcopy">{financeConnection==="connected"?"Sincronizado con los movimientos y saldos de FLUX.":"Revisa la conexión con FLUX para ver los importes."}</p></section>
          </div>
          <div className="bottomGrid"><section className="panel"><div className="panelHead"><div><h3>Pequeños hábitos, grandes cambios</h3><p>Tu espacio de bienestar</p></div><button className="textBtn" onClick={()=>setSection("habit")}>Explorar ↗</button></div><div className="habitPreview">{habits.slice(0,3).map(h=><div key={h.id}><button className={h.doneToday?"habitCheck done":"habitCheck"} onClick={()=>void toggleHabit(h)} aria-label={h.doneToday?"Desmarcar hábito":"Completar hábito"}><LineIcon name={h.doneToday?"check":"sparkles"} size={16}/></button><span><b>{h.title}</b><small>{h.frequency||"Hábito personal"}</small></span></div>)}{!habits.length&&<div className="empty compact">Tus hábitos comienzan con una acción pequeña.<button className="textBtn" onClick={()=>{setSection("habit");setFormOpen(true)}}>Añadir hábito ↗</button></div>}</div></section><section className="quoteCard"><span className="quoteMark">“</span><p>{getDailyQuote(quoteDay).text}</p><small>{getDailyQuote(quoteDay).tagline}</small><div className="quoteOrb"></div></section></div>
        </>:section==="transaction"?<FinanceModule/>:section==="habit"?<WellnessModule/>:section==="note"?<KnowledgeModule/>:<><div className="moduleHero"><div><p className="eyebrow">DEMian LIFE OS / {section.toUpperCase()}</p><h1>{heading}<span>.</span></h1><p className="subhead">{section==="task"?"Organiza pendientes, fechas límite y próximos pasos.":section==="habit"?"Registra rutinas y crea consistencia con pequeños pasos.":section==="note"?"Guarda ideas, notas y referencias para encontrarlas después.":"Registra y sigue tus hábitos."}</p></div><div className="moduleActions">{section==="task"&&<button className="outlineBtn" onClick={exportCalendar}>↓ Exportar calendario .ics</button>}<button className="primaryBtn" onClick={()=>setFormOpen(v=>!v)}>＋ Nuevo registro</button></div></div>
          {formOpen&&<form className="panel createForm" onSubmit={add}><div className="panelHead"><div><h3>Nueva tarea</h3><p>Los cambios se guardan en tu base de datos.</p></div><button type="button" className="more" onClick={()=>setFormOpen(false)}>×</button></div><label>Título<input required maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ej. Llamar al proveedor"/></label>
            {section==="task"&&<label>Fecha límite<input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label>}
            <label>Detalles<textarea rows={3} value={form.details} onChange={e=>setForm({...form,details:e.target.value})} placeholder="Añade contexto, notas o próximos pasos…"/></label><div className="formActions"><button type="button" className="outlineBtn" onClick={()=>setFormOpen(false)}>Cancelar</button><button disabled={saving} className="primaryBtn">{saving?"Guardando…":"Guardar registro"}</button></div></form>}
          {notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
          <section className="panel recordsPanel"><div className="panelHead"><div><h3>{section==="task"?"Todas tus tareas":section==="habit"?"Tus hábitos":"Tu biblioteca"}</h3><p>{filtered.length} registros</p></div><span className="recordCount">{filtered.length} TOTAL</span></div>
            {loading?<div className="empty">Cargando registros…</div>:filtered.length?<div className="recordList">{filtered.map(i=><article className="record" key={i.id}><div className={"recordIcon "+i.kind}><LineIcon name={i.kind==="task"?"calendar-clock":i.kind==="transaction"?(i.category==="Ingreso"?"trending-up":"trending-down"):i.kind==="habit"?"heart-pulse":"book-open"} size={17}/></div><div className="recordMain"><b>{i.title}</b><p>{i.details||(i.kind==="habit"?i.frequency:i.category)||"Sin detalles adicionales"}</p><small>{i.dueDate?"Fecha: "+i.dueDate:i.createdAt?new Date(i.createdAt).toLocaleDateString("es-MX"):"Registro guardado"}</small></div>{i.kind==="transaction"&&<b className={i.category==="Ingreso"?"positive":"negative"}>{i.category==="Gasto"?"−":"+"}{money(i.amount||0)}</b>}{i.kind==="task"&&<button className={i.status==="done"?"donePill":"pendingPill"} onClick={()=>void toggle(i)}>{i.status==="done"?"✓ Completada":"Marcar lista"}</button>}{i.kind==="habit"&&<button className={i.doneToday?"donePill":"pendingPill"} onClick={()=>void toggleHabit(i)}>{i.doneToday?"✓ Hecho hoy":"Marcar hoy"}</button>}<button className="deleteBtn" onClick={()=>void remove(i)} aria-label={"Eliminar "+i.title}>×</button></article>)}</div>:<div className="empty"><span><LineIcon name="sparkles" size={23}/></span><b>Aún no hay registros.</b><p>Agrega el primero y aquí quedará guardado.</p><button className="primaryBtn" onClick={()=>setFormOpen(true)}>＋ Crear registro</button></div>}
          </section>
        </>}
        {notice&&section==="overview"&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
        <footer className="footer developerSignature"><span className="signatureCaption">DEMian V1.0 · desarrollado por J D O SERVICES</span><div className="signatureLogo"><img src="/jdo-services-logo.webp" alt="Logotipo oficial JDO Services" className="signatureLogoImage" /></div></footer>
      </div>
    </section>
  </main>;
}