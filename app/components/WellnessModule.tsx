"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Log = {
  id: number;
  log_date: string;
  sleep_hours: number|null;
  water_glasses: number|null;
  activity_minutes: number|null;
  mood: number|null;
  weight_kg: number|null;
  notes: string;
};
type Habit = {id:string;kind:"habit";title:string;details:string;frequency:string;status:string;doneToday?:boolean;createdAt:string};
const todayLocal=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const fmtDate=(d:string)=>new Date(d+"T12:00:00").toLocaleDateString("es-MX",{weekday:"short",day:"numeric",month:"short"});
const moodLabels=["","Muy bajo","Bajo","Neutral","Bien","Muy bien"];
const moodFaces=["","☹","◔","◯","☺","✦"];
const emptyForm=(date:string)=>({date,sleepHours:"",waterGlasses:"",activityMinutes:"",mood:"",weightKg:"",notes:""});
type WellnessDraft=ReturnType<typeof emptyForm>;
export default function WellnessModule(){
  const [logs,setLogs]=useState<Log[]>([]);
  const [habits,setHabits]=useState<Habit[]>([]);
  const [draft,setDraft]=useState<WellnessDraft>(emptyForm(todayLocal()));
  const [habitTitle,setHabitTitle]=useState("");
  const [habitFrequency,setHabitFrequency]=useState("Diario");
  const [habitDetails,setHabitDetails]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [savingHabit,setSavingHabit]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [view,setView]=useState<"checkin"|"habits">("checkin");

  const refresh=useCallback(async()=>{
    try{
      const [wellnessRes,itemsRes]=await Promise.all([fetch("/api/wellness",{cache:"no-store"}),fetch("/api/data",{cache:"no-store"})]);
      const [wellnessJson,itemsJson]=await Promise.all([wellnessRes.json(),itemsRes.json()]);
      if(!wellnessRes.ok||!wellnessJson.ok)throw new Error(wellnessJson.error||"No se pudo cargar el bienestar.");
      if(!itemsRes.ok||!itemsJson.ok)throw new Error(itemsJson.error||"No se pudieron cargar los hábitos.");
      const nextLogs=wellnessJson.logs as Log[];
      const nextHabits=(itemsJson.items as Habit[]).filter((i)=>i.kind==="habit");
      setLogs(nextLogs);setHabits(nextHabits);setError("");
      const d=nextLogs.find((l)=>l.log_date===draft.date);
      if(d){
        setDraft({date:d.log_date,sleepHours:d.sleep_hours==null?"":String(d.sleep_hours),waterGlasses:d.water_glasses==null?"":String(d.water_glasses),activityMinutes:d.activity_minutes==null?"":String(d.activity_minutes),mood:d.mood==null?"":String(d.mood),weightKg:d.weight_kg==null?"":String(d.weight_kg),notes:d.notes||""});
      }
    }catch(e){setError(e instanceof Error?e.message:"No se pudieron cargar los datos.");}
    finally{setLoading(false);}
  },[draft.date]);
  useEffect(()=>{void refresh();},[refresh]);
  const week=useMemo(()=>Array.from({length:7},(_,index)=>{const d=new Date(todayLocal()+"T12:00:00");d.setDate(d.getDate()-(6-index));const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");return {key,log:logs.find(l=>l.log_date===key)||null,label:new Intl.DateTimeFormat("es-MX",{weekday:"short"}).format(d)};}),[logs]);
  const trackedDays=week.filter(d=>d.log).length;
  const sleepLogs=week.map(d=>d.log?.sleep_hours).filter((x):x is number=>typeof x==="number");
  const waterLogs=week.map(d=>d.log?.water_glasses).filter((x):x is number=>typeof x==="number");
  const avgSleep=sleepLogs.length?sleepLogs.reduce((s,n)=>s+n,0)/sleepLogs.length:null;
  const avgWater=waterLogs.length?waterLogs.reduce((s,n)=>s+n,0)/waterLogs.length:null;
  const totalActivity=week.reduce((s,d)=>s+(d.log?.activity_minutes||0),0);
  const activeHabits=habits.filter(h=>h.status!=="archived");
  const doneToday=activeHabits.filter(h=>h.doneToday).length;
  const maxActivity=Math.max(30,...week.map(d=>d.log?.activity_minutes||0));

  async function saveCheckin(e:FormEvent){
    e.preventDefault();setSaving(true);setError("");setMessage("");
    try{
      const r=await fetch("/api/wellness",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)});
      const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"No se pudo guardar.");
      const saved=j.log as Log;setLogs(prev=>[saved,...prev.filter(l=>l.log_date!==saved.log_date)].sort((a,b)=>b.log_date.localeCompare(a.log_date)));
      setMessage("Registro de bienestar guardado en DEMian.");
    }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar el registro.");}
    finally{setSaving(false);}
  }
  function chooseDate(date:string){
    const existing=logs.find(l=>l.log_date===date);
    setDraft(existing?{date,sleepHours:existing.sleep_hours==null?"":String(existing.sleep_hours),waterGlasses:existing.water_glasses==null?"":String(existing.water_glasses),activityMinutes:existing.activity_minutes==null?"":String(existing.activity_minutes),mood:existing.mood==null?"":String(existing.mood),weightKg:existing.weight_kg==null?"":String(existing.weight_kg),notes:existing.notes||""}:emptyForm(date));
    setMessage("");setError("");
  }
  async function createHabit(e:FormEvent){
    e.preventDefault();if(!habitTitle.trim())return;setSavingHabit(true);setError("");setMessage("");
    try{
      const r=await fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"habit",title:habitTitle.trim(),details:habitDetails,frequency:habitFrequency})});
      const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"No se pudo crear el hábito.");
      setHabits(prev=>[j.item,...prev]);setHabitTitle("");setHabitDetails("");setHabitFrequency("Diario");setMessage("Hábito añadido.");
    }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar el hábito.");}
    finally{setSavingHabit(false);}
  }
  async function toggleHabit(h:Habit){
    const doneToday=!h.doneToday;
    try{const r=await fetch("/api/data",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:h.id,doneToday})});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"No se pudo actualizar el hábito.");setHabits(prev=>prev.map(i=>i.id===h.id?j.item:i));}
    catch(e){setError(e instanceof Error?e.message:"No se pudo marcar el hábito.");}
  }
  async function deleteHabit(h:Habit){
    if(!window.confirm("¿Eliminar el hábito «"+h.title+"» y su historial de hábitos diarios?"))return;
    try{const r=await fetch("/api/data?id="+encodeURIComponent(h.id),{method:"DELETE"});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"No se pudo eliminar.");setHabits(prev=>prev.filter(i=>i.id!==h.id));setMessage("Hábito eliminado.");}
    catch(e){setError(e instanceof Error?e.message:"No se pudo eliminar el hábito.");}
  }
  return <div className="wellness">
    <div className="wellnessHero">
      <div><p className="wellnessEyebrow">DEMian / BIENESTAR PERSONAL</p><h2>Cuídate con intención<span>.</span></h2><p>Registra cómo vas, reconoce patrones y construye hábitos sostenibles. No es un diagnóstico médico.</p></div>
      <div className="wellnessDate"><span>HOY</span><b>{fmtDate(todayLocal())}</b><small>{doneToday} de {activeHabits.length} hábitos hechos</small></div>
    </div>
    <div className="wellnessTabs"><button className={view==="checkin"?"active":""} onClick={()=>setView("checkin")}>✳ Registro diario</button><button className={view==="habits"?"active":""} onClick={()=>setView("habits")}>✓ Mis hábitos <span>{doneToday}/{activeHabits.length}</span></button></div>
    {error&&<div className="wellnessNotice error" role="alert">{error}<button onClick={()=>setError("")}>×</button></div>}
    {message&&<div className="wellnessNotice" role="status">{message}<button onClick={()=>setMessage("")}>×</button></div>}
    {view==="checkin"?<>
      <div className="wellnessStats">
        <article><span className="wellnessStatIcon blue">☾</span><small>SUEÑO PROMEDIO</small><b>{avgSleep===null?"—":avgSleep.toFixed(1)+" h"}</b><span>Últimos 7 días · {sleepLogs.length} registros</span></article>
        <article><span className="wellnessStatIcon cyan">≈</span><small>AGUA PROMEDIO</small><b>{avgWater===null?"—":avgWater.toFixed(1)}</b><span>Vasos al día · {waterLogs.length} registros</span></article>
        <article><span className="wellnessStatIcon green">↗</span><small>ACTIVIDAD TOTAL</small><b>{totalActivity} min</b><span>En los últimos 7 días</span></article>
        <article><span className="wellnessStatIcon amber">✓</span><small>DÍAS CON REGISTRO</small><b>{trackedDays}/7</b><span>Constancia, no perfección</span></article>
      </div>
      <div className="wellnessLayout">
        <form className="wellnessPanel wellnessForm" onSubmit={saveCheckin}>
          <div className="wellnessPanelHead"><div><h3>Tu check-in</h3><p>Un registro por fecha; puedes editarlo después.</p></div><button type="button" className="wellnessRefresh" onClick={()=>void refresh()} title="Actualizar datos">↻</button></div>
          <label className="wellnessField">Fecha del registro<input type="date" max={todayLocal()} required value={draft.date} onChange={e=>chooseDate(e.target.value)}/></label>
          <div className="wellnessInputGrid">
            <label className="wellnessField">Horas de sueño<input type="number" min="0" max="24" step=".25" value={draft.sleepHours} onChange={e=>setDraft({...draft,sleepHours:e.target.value})} placeholder="Ej. 7.5"/></label>
            <label className="wellnessField">Vasos de agua<input type="number" min="0" max="50" step="1" value={draft.waterGlasses} onChange={e=>setDraft({...draft,waterGlasses:e.target.value})} placeholder="Ej. 6"/></label>
            <label className="wellnessField">Actividad física (min)<input type="number" min="0" max="1440" step="1" value={draft.activityMinutes} onChange={e=>setDraft({...draft,activityMinutes:e.target.value})} placeholder="Ej. 30"/></label>
            <label className="wellnessField">Peso (kg, opcional)<input type="number" min=".1" max="500" step=".1" value={draft.weightKg} onChange={e=>setDraft({...draft,weightKg:e.target.value})} placeholder="Opcional"/></label>
          </div>
          <fieldset className="wellnessMood"><legend>¿Cómo te sentiste hoy?</legend><div>{[1,2,3,4,5].map(n=><button key={n} type="button" aria-pressed={draft.mood===String(n)} className={draft.mood===String(n)?"selected":""} onClick={()=>setDraft({...draft,mood:draft.mood===String(n)?"":String(n)})}><b>{moodFaces[n]}</b><small>{moodLabels[n]}</small></button>)}</div></fieldset>
          <label className="wellnessField">Notas personales<textarea rows={3} maxLength={2000} value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Energía, estado de ánimo, algo que quieras recordar…"/></label>
          <div className="wellnessFormFoot"><small>Datos privados guardados en tu base de DEMian. Registra solo lo que quieras conservar.</small><button className="wellnessPrimary" disabled={saving}>{saving?"Guardando…":"Guardar check-in"}</button></div>
        </form>
        <div className="wellnessPanel wellnessWeekPanel"><div className="wellnessPanelHead"><div><h3>Tu semana</h3><p>Actividad registrada por día</p></div><span className="wellnessBadge">7 DÍAS</span></div>
          <div className="wellnessWeekChart">{week.map(d=>{const m=d.log?.activity_minutes||0;return <button type="button" key={d.key} className={draft.date===d.key?"picked":""} onClick={()=>chooseDate(d.key)} title={d.key+" · "+m+" min"}><div className="wellnessBarTrack"><i style={{height:(m?Math.max(5,m/maxActivity*100):0)+"%"}}/></div><small>{d.label}</small><b>{m}</b></button>;})}</div>
          <div className="wellnessLegend"><span><i/> Minutos de actividad física</span></div>
          <div className="wellnessHistoryHead"><h4>Registros recientes</h4><span>{logs.length} guardados</span></div>
          <div className="wellnessHistory">{logs.slice(0,8).map(l=><button key={l.id} onClick={()=>chooseDate(l.log_date)} className={draft.date===l.log_date?"current":""}><span><b>{fmtDate(l.log_date)}</b><small>{l.mood?moodLabels[l.mood]:"Sin estado de ánimo registrado"}</small></span><span className="wellnessHistoryNumbers">{l.sleep_hours==null?"—":l.sleep_hours+" h"} <i/> {l.activity_minutes==null?"—":l.activity_minutes+" min"}</span></button>)}{!logs.length&&<p className="wellnessEmptyText">Tus registros diarios aparecerán aquí.</p>}</div>
        </div>
      </div>
    </>:<div className="wellnessHabitLayout">
      <form className="wellnessPanel wellnessForm" onSubmit={createHabit}><div className="wellnessPanelHead"><div><h3>Nuevo hábito</h3><p>Empieza pequeño y hazlo repetible.</p></div></div><label className="wellnessField">Nombre<input required maxLength={160} value={habitTitle} onChange={e=>setHabitTitle(e.target.value)} placeholder="Ej. Caminar 20 minutos"/></label><label className="wellnessField">Frecuencia<select value={habitFrequency} onChange={e=>setHabitFrequency(e.target.value)}><option>Diario</option><option>Semanal</option><option>Entre semana</option><option>Personalizado</option></select></label><label className="wellnessField">Motivo o detalle<textarea rows={3} maxLength={2000} value={habitDetails} onChange={e=>setHabitDetails(e.target.value)} placeholder="¿Por qué quieres mantener este hábito?"/></label><button className="wellnessPrimary" disabled={savingHabit}>{savingHabit?"Guardando…":"Añadir hábito"}</button></form>
      <section className="wellnessPanel"><div className="wellnessPanelHead"><div><h3>Tu lista de hábitos</h3><p>El registro diario se reinicia según la fecha local de la app.</p></div><span className="wellnessBadge">{doneToday}/{activeHabits.length} HOY</span></div>{loading?<div className="wellnessEmptyText">Cargando hábitos…</div>:activeHabits.length?<div className="wellnessHabitList">{activeHabits.map(h=><article key={h.id} className={h.doneToday?"completed":""}><button className="wellnessHabitCheck" onClick={()=>void toggleHabit(h)} aria-label={h.doneToday?"Desmarcar hoy":"Completar hoy"}>{h.doneToday?"✓":""}</button><div><b>{h.title}</b><small>{h.frequency||"Hábito personal"}{h.details?" · "+h.details:""}</small></div><span className={h.doneToday?"wellnessDoneBadge":"wellnessTodoBadge"}>{h.doneToday?"Hecho hoy":"Pendiente"}</span><button className="wellnessDeleteHabit" onClick={()=>void deleteHabit(h)} aria-label={"Eliminar "+h.title} title="Eliminar hábito">×</button></article>)}</div>:<div className="wellnessEmpty"><span>✳</span><b>Un pequeño paso puede ser el inicio.</b><p>Añade tu primer hábito en el formulario.</p></div>}</section>
    </div>}
    <p className="wellnessPrivacy">DEMian almacena los datos de bienestar que decidas registrar. Los promedios describen tus registros personales y no sustituyen una evaluación médica.</p>
  </div>;
}
