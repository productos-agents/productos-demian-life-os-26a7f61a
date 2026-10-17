"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Kind = "task" | "transaction" | "habit" | "note";
type Item = { id:string; kind:Kind; title:string; details:string; amount:number|null; category:string; dueDate:string; status:string; frequency:string; doneToday?:boolean; createdAt:string };
type Section = "overview" | Kind;
const sections: {id:Section; label:string; short:string; glyph:string}[] = [
  {id:"overview",label:"Vista general",short:"Inicio",glyph:"⌂"},
  {id:"task",label:"Vida en orden",short:"Agenda",glyph:"◷"},
  {id:"transaction",label:"Finanzas",short:"Dinero",glyph:"↗"},
  {id:"habit",label:"Salud y hábitos",short:"Hábitos",glyph:"✳"},
  {id:"note",label:"Segundo cerebro",short:"Notas",glyph:"▤"}
];
const today = () => new Date().toISOString().slice(0,10);
const money = (n:number) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",maximumFractionDigits:2}).format(n);
export default function Home() {
  const [items,setItems] = useState<Item[]>([]);
  const [section,setSection] = useState<Section>("overview");
  const [loading,setLoading] = useState(true);
  const [connection,setConnection] = useState<"checking"|"connected"|"error">("checking");
  const [query,setQuery] = useState("");
  const [notice,setNotice] = useState("");
  const [formOpen,setFormOpen] = useState(false);
  const [form,setForm] = useState({title:"",details:"",amount:"",category:"",dueDate:"",frequency:"Diario"});
  const [saving,setSaving] = useState(false);
  const [reminders,setReminders] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/data",{cache:"no-store"});
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Error de conexión");
      setItems(d.items); setConnection("connected");
    } catch { setConnection("error"); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ void refresh(); },[refresh]);
  useEffect(()=>{
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(()=>{});
  },[]);
  const filtered = useMemo(()=>items.filter(i=>(section==="overview"||i.kind===section)&&[i.title,i.details,i.category].join(" ").toLowerCase().includes(query.toLowerCase())),[items,section,query]);
  const tasks = items.filter(i=>i.kind==="task");
  const openTasks = tasks.filter(i=>i.status!=="done");
  const dueTasks = openTasks.filter(i=>i.dueDate && i.dueDate<=today());
  const transactions = items.filter(i=>i.kind==="transaction");
  const income = transactions.filter(i=>i.category==="Ingreso").reduce((s,i)=>s+(i.amount||0),0);
  const expenses = transactions.filter(i=>i.category==="Gasto").reduce((s,i)=>s+(i.amount||0),0);
  const habits = items.filter(i=>i.kind==="habit");
  const notes = items.filter(i=>i.kind==="note");
  const add = async (e:React.FormEvent) => {
    e.preventDefault(); if (!form.title.trim()) return;
    setSaving(true); setNotice("");
    const payload = {kind:section==="overview"?"task":section,...form,category:section==="transaction"?(form.category||"Ingreso"):form.category,amount:section==="transaction"?form.amount:null};
    try {
      const r=await fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const d=await r.json(); if(!r.ok||!d.ok) throw new Error(d.error||"No se pudo guardar");
      setItems(prev=>[d.item,...prev]); setForm({title:"",details:"",amount:"",category:"",dueDate:"",frequency:"Diario"});setFormOpen(false);setNotice("Guardado correctamente.");
    } catch(e) {setNotice(e instanceof Error?e.message:"Error al guardar");}
    finally {setSaving(false);}
  };
  const toggle = async (item:Item) => {
    const status=item.status==="done"?"active":"done";
    try { const r=await fetch("/api/data",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,status})}); const d=await r.json();if(!r.ok||!d.ok)throw new Error();setItems(prev=>prev.map(x=>x.id===item.id?d.item:x)); }
    catch {setNotice("No se pudo actualizar. Comprueba la conexión.");}
  };
  const remove = async (item:Item) => {
    try {const r=await fetch("/api/data?id="+encodeURIComponent(item.id),{method:"DELETE"});const d=await r.json();if(!r.ok||!d.ok)throw new Error();setItems(prev=>prev.filter(x=>x.id!==item.id));setNotice("Registro eliminado.");}
    catch {setNotice("No se pudo eliminar el registro.");}
  };
  const logout = async () => { try { await fetch("/api/auth", { method: "DELETE" }); window.location.assign("/login"); } catch { setNotice("No se pudo cerrar la sesión."); } };
  const enableReminders = async () => {
    if (!("Notification" in window)) {setNotice("Este navegador no admite notificaciones.");return;}
    const p=await Notification.requestPermission();setReminders(p==="granted");setNotice(p==="granted"?"Permiso de notificaciones activado en este dispositivo.":"No se concedió permiso para notificaciones.");
  };
  const heading=sections.find(s=>s.id===section)?.label||"DEMian";
  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brandMark">D<span>·</span></div><div><b>DEMian</b><small>LIFE OS <i>V0.1</i></small></div></div>
      <div className="workspace"><span className="avatar">J</span><div><b>Mi espacio</b><small>Sistema personal</small></div><span className="dots">•••</span></div>
      <p className="navLabel">TU SISTEMA</p>
      <nav>{sections.map(s=><button key={s.id} onClick={()=>setSection(s.id)} className={section===s.id?"navItem active":"navItem"}><span className="navGlyph">{s.glyph}</span><span>{s.label}</span>{s.id==="task"&&openTasks.length>0&&<em>{openTasks.length}</em>}</button>)}</nav>
      <div className="sidebarBottom"><div className="connection"><span className={"statusDot "+connection}></span><div><b>{connection==="connected"?"Base de datos conectada":connection==="checking"?"Verificando conexión":"Sin conexión"}</b><small>{connection==="connected"?"PostgreSQL · Neon":connection==="checking"?"Comprobando persistencia":"Revisa configuración del servidor"}</small></div></div><button className="quietBtn" onClick={enableReminders}>♧ Permitir notificaciones</button><button className="quietBtn logoutBtn" onClick={logout}>↪ Cerrar sesión</button><small className="privacy">Tus registros se guardan en la base de datos de DEMian.</small></div>
    </aside>
    <section className="main">
      <header className="topbar"><div className="breadcrumb">DEMian <span>/</span> {heading}</div><div className="topActions"><div className="searchBox"><span>⌕</span><input aria-label="Buscar" placeholder="Buscar en tu sistema..." value={query} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><button className="roundBtn" title="Actualizar" onClick={()=>void refresh()}>↻</button><span className="avatar">J</span></div></header>
      <div className="content">
        {section==="overview"?<>
          <div className="welcome"><div><p className="eyebrow">{new Intl.DateTimeFormat("es-MX",{weekday:"long"}).format(new Date()).toUpperCase()} · TU CENTRO DE CONTROL</p><h1>Vamos a poner tu vida<br/><span>en orden.</span></h1><p className="subhead">Todo lo importante, en un solo lugar. Un paso a la vez.</p></div><div className="dateCard"><span>HOY</span><b>{new Intl.DateTimeFormat("es-MX",{day:"2-digit",month:"short"}).format(new Date())}</b><small>{new Intl.DateTimeFormat("es-MX",{weekday:"long"}).format(new Date())}</small></div></div>
          <div className="sectionHead"><div><h2>Tu resumen</h2><p>Una vista rápida de cómo va tu día.</p></div><span className={"dbPill "+connection}>{connection==="connected"?"● SINCRONIZADO":connection==="checking"?"◌ CONECTANDO":"● SIN CONEXIÓN"}</span></div>
          <div className="statGrid">
            <article className="statCard"><div className="statTop"><span className="statIcon violet">◷</span><span className="statHint">AGENDA</span></div><strong>{openTasks.length.toString().padStart(2,"0")}</strong><p>Pendientes activos</p><small>{dueTasks.length?dueTasks.length+" requieren atención":"Tu agenda bajo control"}</small></article>
            <article className="statCard"><div className="statTop"><span className="statIcon green">$</span><span className="statHint">FINANZAS</span></div><strong>{money(income-expenses)}</strong><p>Balance registrado</p><small>{transactions.length} movimientos guardados</small></article>
            <article className="statCard"><div className="statTop"><span className="statIcon blue">✳</span><span className="statHint">BIENESTAR</span></div><strong>{habits.length.toString().padStart(2,"0")}</strong><p>Hábitos registrados</p><small>Construye consistencia, no perfección</small></article>
            <article className="statCard"><div className="statTop"><span className="statIcon amber">▤</span><span className="statHint">CONOCIMIENTO</span></div><strong>{notes.length.toString().padStart(2,"0")}</strong><p>Notas en tu cerebro</p><small>Ideas listas para recuperar</small></article>
          </div>
          <div className="dashboardGrid">
            <section className="panel agendaPanel"><div className="panelHead"><div><h3>Lo que sigue</h3><p>Tus próximas tareas</p></div><button className="textBtn" onClick={()=>setSection("task")}>Ver agenda ↗</button></div>
              {loading?<div className="empty">Cargando tus registros…</div>:openTasks.slice(0,4).length?<div className="taskList">{openTasks.slice(0,4).map(t=><div className="taskRow" key={t.id}><button className="check" onClick={()=>void toggle(t)} aria-label="Completar tarea"></button><div className="taskText"><b>{t.title}</b><small>{t.dueDate?"Fecha límite: "+t.dueDate:t.details||"Sin fecha asignada"}</small></div><button className="more" onClick={()=>void remove(t)} aria-label="Eliminar tarea">×</button></div>)}</div>:<div className="empty"><span>✧</span><b>Espacio para lo que importa.</b><p>Añade tu primera tarea para comenzar.</p><button className="textBtn" onClick={()=>{setSection("task");setFormOpen(true)}}>Crear una tarea ↗</button></div>}
              <button className="addRow" onClick={()=>{setSection("task");setFormOpen(true)}}><span>＋</span> Añadir tarea</button>
            </section>
            <section className="panel moneyPanel"><div className="panelHead"><div><h3>Tu dinero</h3><p>Movimientos registrados</p></div><button className="textBtn" onClick={()=>setSection("transaction")}>Ver finanzas ↗</button></div><div className="balanceLabel">BALANCE NETO</div><div className="balance">{money(income-expenses)}</div><div className="moneyBars"><div><span><i className="incomeDot"></i>Ingresos</span><b>{money(income)}</b></div><div className="bar"><i style={{width:(income+expenses?income/(income+expenses)*100:0)+"%"}}/></div><div><span><i className="expenseDot"></i>Gastos</span><b>{money(expenses)}</b></div><div className="bar red"><i style={{width:(income+expenses?expenses/(income+expenses)*100:0)+"%"}}/></div></div><button className="outlineBtn" onClick={()=>{setSection("transaction");setFormOpen(true)}}>＋ Registrar movimiento</button><p className="microcopy">Solo incluye movimientos que hayas registrado.</p></section>
          </div>
          <div className="bottomGrid"><section className="panel"><div className="panelHead"><div><h3>Pequeños hábitos, grandes cambios</h3><p>Tu espacio de bienestar</p></div><button className="textBtn" onClick={()=>setSection("habit")}>Explorar ↗</button></div><div className="habitPreview">{habits.slice(0,3).map(h=><div key={h.id}><span className="habitCheck">✳</span><span><b>{h.title}</b><small>{h.frequency||"Hábito personal"}</small></span></div>)}{!habits.length&&<div className="empty compact">Tus hábitos comienzan con una acción pequeña.<button className="textBtn" onClick={()=>{setSection("habit");setFormOpen(true)}}>Añadir hábito ↗</button></div>}</div></section><section className="quoteCard"><span className="quoteMark">“</span><p>No necesitas tener todo resuelto. Solo necesitas saber cuál es el siguiente paso.</p><small>UNA COSA A LA VEZ</small><div className="quoteOrb"></div></section></div>
        </>:<><div className="moduleHero"><div><p className="eyebrow">DEMian LIFE OS / {section.toUpperCase()}</p><h1>{heading}<span>.</span></h1><p className="subhead">{section==="task"?"Organiza pendientes, fechas límite y próximos pasos.":section==="transaction"?"Registra tus ingresos y gastos para entender tu dinero.":section==="habit"?"Registra rutinas y crea consistencia con pequeños pasos.":"Guarda ideas, notas y referencias para encontrarlas después."}</p></div><button className="primaryBtn" onClick={()=>setFormOpen(v=>!v)}>＋ Nuevo registro</button></div>
          {section==="transaction"&&<div className="financeStrip"><div><small>INGRESOS REGISTRADOS</small><b className="positive">{money(income)}</b></div><div><small>GASTOS REGISTRADOS</small><b className="negative">{money(expenses)}</b></div><div><small>BALANCE</small><b>{money(income-expenses)}</b></div></div>}
          {formOpen&&<form className="panel createForm" onSubmit={add}><div className="panelHead"><div><h3>{section==="transaction"?"Registrar movimiento":section==="task"?"Nueva tarea":section==="habit"?"Nuevo hábito":"Nueva nota"}</h3><p>Los cambios se guardan en tu base de datos.</p></div><button type="button" className="more" onClick={()=>setFormOpen(false)}>×</button></div><label>Título<input required maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder={section==="transaction"?"Ej. Pago de servicio":section==="habit"?"Ej. Caminar 20 minutos":section==="note"?"Ej. Idea para proyecto":"Ej. Llamar al proveedor"}/></label>
            {section==="transaction"&&<div className="formTwo"><label>Tipo<select value={form.category||"Ingreso"} onChange={e=>setForm({...form,category:e.target.value})}><option>Ingreso</option><option>Gasto</option></select></label><label>Importe (MXN)<input type="number" min="0" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00"/></label></div>}
            {section==="task"&&<label>Fecha límite<input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label>}
            {section==="habit"&&<label>Frecuencia<select value={form.frequency} onChange={e=>setForm({...form,frequency:e.target.value})}><option>Diario</option><option>Semanal</option><option>Entre semana</option><option>Personalizado</option></select></label>}
            {section==="note"&&<label>Etiqueta<input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Trabajo, personal, idea…"/></label>}
            <label>Detalles<textarea rows={3} value={form.details} onChange={e=>setForm({...form,details:e.target.value})} placeholder="Añade contexto, notas o próximos pasos…"/></label><div className="formActions"><button type="button" className="outlineBtn" onClick={()=>setFormOpen(false)}>Cancelar</button><button disabled={saving} className="primaryBtn">{saving?"Guardando…":"Guardar registro"}</button></div></form>}
          {notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
          <section className="panel recordsPanel"><div className="panelHead"><div><h3>{section==="transaction"?"Historial de movimientos":section==="task"?"Todas tus tareas":section==="habit"?"Tus hábitos":"Tu biblioteca"}</h3><p>{filtered.length} registros</p></div><span className="recordCount">{filtered.length} TOTAL</span></div>
            {loading?<div className="empty">Cargando registros…</div>:filtered.length?<div className="recordList">{filtered.map(i=><article className="record" key={i.id}><div className={"recordIcon "+i.kind}>{i.kind==="task"?"◷":i.kind==="transaction"?(i.category==="Ingreso"?"↗":"↘"):i.kind==="habit"?"✳":"▤"}</div><div className="recordMain"><b>{i.title}</b><p>{i.details||(i.kind==="habit"?i.frequency:i.category)||"Sin detalles adicionales"}</p><small>{i.dueDate?"Fecha: "+i.dueDate:i.createdAt?new Date(i.createdAt).toLocaleDateString("es-MX"):"Registro guardado"}</small></div>{i.kind==="transaction"&&<b className={i.category==="Ingreso"?"positive":"negative"}>{i.category==="Gasto"?"−":"+"}{money(i.amount||0)}</b>}{i.kind==="task"&&<button className={i.status==="done"?"donePill":"pendingPill"} onClick={()=>void toggle(i)}>{i.status==="done"?"✓ Completada":"Marcar lista"}</button>}<button className="deleteBtn" onClick={()=>void remove(i)} aria-label={"Eliminar "+i.title}>×</button></article>)}</div>:<div className="empty"><span>✧</span><b>Aún no hay registros.</b><p>Agrega el primero y aquí quedará guardado.</p><button className="primaryBtn" onClick={()=>setFormOpen(true)}>＋ Crear registro</button></div>}
          </section>
        </>}
        {notice&&section==="overview"&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
        <footer className="footer"><span>DEMian LIFE OS <i>V0.1 · EN DESARROLLO</i></span><span>Hecho para ayudarte a avanzar, un día a la vez.</span></footer>
      </div>
    </section>
  </main>;
}