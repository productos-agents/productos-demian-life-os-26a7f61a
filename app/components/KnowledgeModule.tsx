"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import LineIcon from "./LineIcon";

type Note = {id:string;kind:"note";title:string;details:string;category:string;status:string;pinned?:boolean;createdAt:string};
type BrainFile = {id:string;name:string;contentType:string;size:number;summary:string;category:string;status:string;createdAt:string;noteId:string|null;noteTitle:string};
type Draft = {title:string;details:string;category:string;pinned:boolean};
const fileSizeLabel=(value:number)=>value<1024?value+" B":value<1024*1024?(value/1024).toFixed(1)+" KB":(value/(1024*1024)).toFixed(1)+" MB";
const todayLocal=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const dateLabel=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?"":date.toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"});};
const blankDraft=():Draft=>({title:"",details:"",category:"General",pinned:false});
export default function KnowledgeModule({initialSearch=""}:{initialSearch?:string}){
  const [notes,setNotes]=useState<Note[]>([]);
  const [brainFiles,setBrainFiles]=useState<BrainFile[]>([]);
  const [hasMoreNotes,setHasMoreNotes]=useState(false);
  const [notesOffset,setNotesOffset]=useState(0);
  const [loadingMoreNotes,setLoadingMoreNotes]=useState(false);
  const [draft,setDraft]=useState<Draft>(blankDraft());
  const [editing,setEditing]=useState<Note|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [search,setSearch]=useState("");
  const [folder,setFolder]=useState("all");
  const [pinnedOnly,setPinnedOnly]=useState(false);
  const [showEditor,setShowEditor]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [pendingDelete,setPendingDelete]=useState<Note|null>(null);
  const fileRef=useRef<HTMLInputElement>(null);

  const refresh=useCallback(async()=>{
    try{
      const r=await fetch("/api/data?date="+todayLocal()+"&kind=note&limit=100&offset=0",{cache:"no-store"});
      const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"No se pudieron cargar las notas.");
      setNotes(j.items as Note[]);setHasMoreNotes(j.hasMore===true);setNotesOffset(Number(j.nextOffset??j.items.length));setError("");
      try{
        const fr=await fetch("/api/brain/files",{cache:"no-store"});
        const fj=await fr.json();
        if(fr.ok&&fj.ok&&Array.isArray(fj.files))setBrainFiles(fj.files as BrainFile[]);
      }catch{}
    }
    catch(e){setError(e instanceof Error?e.message:"No se pudo cargar la biblioteca.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{
    const handleLibraryChanged=()=>{void refresh();};
    window.addEventListener("demian:data-changed",handleLibraryChanged);
    return ()=>window.removeEventListener("demian:data-changed",handleLibraryChanged);
  },[refresh]);
  useEffect(()=>{setSearch(initialSearch);},[initialSearch]);
  async function loadMoreNotes(){
    if(loadingMoreNotes||!hasMoreNotes)return;
    setLoadingMoreNotes(true);
    try{
      const r=await fetch("/api/data?date="+todayLocal()+"&kind=note&limit=100&offset="+notesOffset,{cache:"no-store"});
      const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"No se pudieron cargar más notas.");
      setNotes(prev=>{const ids=new Set(prev.map(n=>n.id));return [...prev,...(j.items as Note[]).filter((n:Note)=>!ids.has(n.id))];});
      setHasMoreNotes(j.hasMore===true);setNotesOffset(Number(j.nextOffset??notesOffset));setNotice("Más notas cargadas.");
    }catch(e){setError(e instanceof Error?e.message:"No se pudieron cargar más notas.");}
    finally{setLoadingMoreNotes(false);}
  }
  const folders=useMemo(()=>Array.from(new Set(notes.map(n=>n.category.trim()||"General"))).sort((a,b)=>a.localeCompare(b,"es")), [notes]);
  const pinnedCount=notes.filter(n=>n.pinned||n.status==="pinned").length;
  const visible=useMemo(()=>notes.filter(n=>{
    const haystack=(n.title+" "+n.details+" "+n.category).toLocaleLowerCase("es");
    const matches=haystack.includes(search.trim().toLocaleLowerCase("es"));
    const inFolder=folder==="all"||((n.category.trim()||"General")===folder);
    const isPinned=!!n.pinned||n.status==="pinned";
    return matches&&inFolder&&(!pinnedOnly||isPinned);
  }).sort((a,b)=>Number(!!(b.pinned||b.status==="pinned"))-Number(!!(a.pinned||a.status==="pinned"))||String(b.createdAt).localeCompare(String(a.createdAt))),[notes,search,folder,pinnedOnly]);

  function openNew(){setEditing(null);setDraft(blankDraft());setShowEditor(true);setNotice("");setError("");}
  function openEdit(note:Note){setEditing(note);setDraft({title:note.title,details:note.details||"",category:note.category||"General",pinned:!!note.pinned||note.status==="pinned"});setShowEditor(true);setNotice("");setError("");}
  async function submit(e:FormEvent){
    e.preventDefault();if(!draft.title.trim())return;setSaving(true);setError("");setNotice("");
    try{
      const body=editing?{id:editing.id,kind:"note",...draft,logDate:todayLocal()}:{kind:"note",...draft,logDate:todayLocal()};
      const r=await fetch("/api/data",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"No se pudo guardar la nota.");
      const item=j.item as Note;setNotes(prev=>editing?prev.map(n=>n.id===item.id?item:n):[item,...prev]);setShowEditor(false);setEditing(null);setDraft(blankDraft());setNotice(editing?"Nota actualizada.":"Nota guardada en el segundo cerebro.");
    }catch(e){setError(e instanceof Error?e.message:"No se pudo guardar.");}
    finally{setSaving(false);}
  }
  async function pin(note:Note){
    const pinned=!(note.pinned||note.status==="pinned");
    try{const r=await fetch("/api/data",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:note.id,pinned,logDate:todayLocal()})});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"No se pudo actualizar.");setNotes(prev=>prev.map(n=>n.id===note.id?j.item:n));}
    catch(e){setError(e instanceof Error?e.message:"No se pudo actualizar la nota.");}
  }
  function remove(note:Note){setPendingDelete(note);}
  async function confirmRemove(){
    if(!pendingDelete)return;
    const note=pendingDelete;
    try{const r=await fetch("/api/data?id="+encodeURIComponent(note.id),{method:"DELETE"});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"No se pudo eliminar.");setNotes(prev=>prev.filter(n=>n.id!==note.id));setNotice("Nota eliminada.");setPendingDelete(null);}
    catch(e){setError(e instanceof Error?e.message:"No se pudo eliminar.");}
  }
  function download(filename:string,text:string,mime="text/plain;charset=utf-8"){
    const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement("a");a.href=url;a.download=filename;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportOne(note:Note){download(note.title.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi,"-").replace(/^-|-$/g,"")+".md","# "+note.title+"\n\nEtiqueta: "+(note.category||"General")+"\nFecha: "+dateLabel(note.createdAt)+"\n\n"+note.details+(note.pinned||note.status==="pinned"?"\n\nMarcada como favorita.":""));}
  async function exportLibrary(){
    setError("");setNotice("");
    try{
      const all:Note[]=[];let offset=0,hasMore=true;
      while(hasMore){
        const r=await fetch("/api/data?date="+todayLocal()+"&kind=note&limit=100&offset="+offset,{cache:"no-store"});
        const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"No se pudo exportar la biblioteca completa.");
        all.push(...(j.items as Note[]));hasMore=j.hasMore===true;offset=Number(j.nextOffset??offset);
      }
      download("demian-segundo-cerebro-"+todayLocal()+".json",JSON.stringify({application:"DEMIAN CORE",exportedAt:new Date().toISOString(),notes:all.map(n=>({title:n.title,details:n.details,category:n.category,pinned:!!n.pinned||n.status==="pinned",createdAt:n.createdAt}))},null,2),"application/json;charset=utf-8");
      setNotice("Biblioteca completa exportada: "+all.length+" notas.");
    }catch(e){setError(e instanceof Error?e.message:"No se pudo exportar la biblioteca completa.");}
  }
  async function importText(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return;e.target.value="";
    if(file.size>1000000){setError("El archivo supera 1 MB. Divide el documento e importa las partes por separado.");return;}
    try{const text=await file.text();if(text.length>5000){setError("El documento supera los 5,000 caracteres admitidos por nota. Divide el archivo para evitar perder contenido.");return;}const title=file.name.replace(/\.[^.]+$/,"").slice(0,160)||"Documento importado";setEditing(null);setDraft({title,details:text,category:"Importados",pinned:false});setShowEditor(true);setNotice("Documento leído. Revisa la nota y guárdala para conservarla.");setError("");}
    catch{setError("No se pudo leer ese archivo de texto.");}
  }
  return <div className="knowledge">
    <div className="knowledgeHero"><div><p className="knowledgeEyebrow">DEMIAN CORE / MEMORIA PERSONAL</p><h2>Tu segundo cerebro<span>.</span></h2><p>Guarda ideas, decisiones, referencias y notas; después recupéralas con búsqueda por contenido, etiqueta o favorito.</p></div><div className="knowledgeTotal"><b>{notes.length}</b><span>NOTAS GUARDADAS</span><small>{pinnedCount} favoritas</small></div></div>
    <div className="knowledgeToolbar"><label className="knowledgeSearch"><LineIcon name="search" size={15}/><input aria-label="Buscar en notas" placeholder="Busca palabras, detalles o etiquetas…" value={search} onChange={e=>setSearch(e.target.value)}/></label><button className="knowledgeBtn" onClick={()=>fileRef.current?.click()}><LineIcon name="cloud-upload" size={15}/>Importar texto</button><input ref={fileRef} hidden type="file" accept=".txt,.md,.csv,.json,text/plain,text/markdown,application/json,text/csv" onChange={e=>void importText(e)}/><button className="knowledgeBtn" onClick={exportLibrary}><LineIcon name="download" size={15}/>Exportar biblioteca</button><button className="knowledgeBtn primary" onClick={openNew}><LineIcon name="plus" size={15}/>Nueva nota</button></div>
    <div className="knowledgeFilters"><button className={folder==="all"&&!pinnedOnly?"active":""} onClick={()=>{setFolder("all");setPinnedOnly(false);}}>Todas <span>{notes.length}</span></button><button className={pinnedOnly?"active":""} onClick={()=>{setPinnedOnly(v=>!v);setFolder("all");}}><LineIcon name="star" size={14}/>Favoritas <span>{pinnedCount}</span></button>{folders.map(f=><button key={f} className={folder===f&&!pinnedOnly?"active":""} onClick={()=>{setFolder(f);setPinnedOnly(false);}}>{f}</button>)}</div>
    {error&&<div className="knowledgeNotice error" role="alert">{error}<button onClick={()=>setError("")}>×</button></div>}{notice&&<div className="knowledgeNotice" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
    {showEditor&&<div className="knowledgeModalBackdrop" onClick={()=>setShowEditor(false)}><form className="knowledgeEditor" onSubmit={submit} onClick={e=>e.stopPropagation()}><div className="knowledgeEditorHead"><div><p className="knowledgeEyebrow">{editing?"EDITAR REGISTRO":"AÑADIR CONOCIMIENTO"}</p><h3>{editing?"Editar nota":"Nueva nota"}</h3><small>El contenido se guarda en tu base privada.</small></div><button type="button" onClick={()=>setShowEditor(false)} className="knowledgeClose">×</button></div><label>Título<input required maxLength={160} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Ej. Decisiones de la reunión"/></label><label>Etiqueta o carpeta<input maxLength={80} value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})} placeholder="Trabajo, personal, ideas…"/></label><label>Contenido<textarea required rows={9} maxLength={5000} value={draft.details} onChange={e=>setDraft({...draft,details:e.target.value})} placeholder="Escribe notas, contexto, enlaces o próximos pasos…"/></label><div className="knowledgeEditorMeta"><span>{draft.details.length.toLocaleString("es-MX")} / 5,000 caracteres</span><label><input type="checkbox" checked={draft.pinned} onChange={e=>setDraft({...draft,pinned:e.target.checked})}/> Guardar como favorita</label></div><div className="knowledgeEditorActions"><button type="button" className="knowledgeBtn" onClick={()=>setShowEditor(false)}>Cancelar</button><button className="knowledgeBtn primary" disabled={saving}>{saving?"Guardando…":"Guardar nota"}</button></div></form></div>}
    {loading?<div className="knowledgeEmpty"><span><LineIcon name="book-open" size={22}/></span><b>Cargando tu biblioteca…</b></div>:visible.length?<div className="knowledgeGrid">{visible.map(n=><article key={n.id} className={"knowledgeCard "+((n.pinned||n.status==="pinned")?"pinned":"")}><div className="knowledgeCardTop"><span className="knowledgeTag">{n.category||"General"}</span><button className={n.pinned||n.status==="pinned"?"knowledgePin pinned":"knowledgePin"} title={n.pinned||n.status==="pinned"?"Quitar favorita":"Marcar favorita"} aria-label="Cambiar favorito" onClick={()=>void pin(n)}><LineIcon name="star" size={15}/></button></div><button className="knowledgeCardTitle" onClick={()=>openEdit(n)}>{n.title}</button><p className="knowledgeExcerpt">{n.details||"Nota sin contenido adicional."}</p><div className="knowledgeCardFoot"><small>{dateLabel(n.createdAt)}</small><div><button onClick={()=>openEdit(n)}>Editar</button><button onClick={()=>exportOne(n)}>Exportar</button><button className="danger" onClick={()=>void remove(n)}>Eliminar</button></div></div></article>)}</div>:<div className="knowledgeEmpty"><span><LineIcon name="sparkles" size={22}/></span><b>{notes.length?"No encontramos notas con esos filtros.":"Todavía no hay notas guardadas."}</b><p>{notes.length?"Prueba otra palabra o elige “Todas”.":"Guarda tu primer apunte o importa un archivo de texto."}</p>{notes.length?<button className="knowledgeBtn" onClick={()=>{setSearch("");setFolder("all");setPinnedOnly(false);}}>Limpiar filtros</button>:<button className="knowledgeBtn primary" onClick={openNew}><LineIcon name="plus" size={15}/>Crear primera nota</button>}</div>}
    {hasMoreNotes&&<div className="knowledgeLoadMore"><button type="button" className="knowledgeBtn" disabled={loadingMoreNotes} onClick={()=>void loadMoreNotes()}>{loadingMoreNotes?"Cargando más notas…":"Cargar más notas"}</button></div>}
    {pendingDelete&&<div className="knowledgeModalBackdrop" role="presentation" onClick={()=>setPendingDelete(null)}><section className="knowledgeEditor knowledgeConfirm" role="alertdialog" aria-modal="true" aria-labelledby="knowledge-delete-title" onClick={e=>e.stopPropagation()}><div className="knowledgeEditorHead"><div><p className="knowledgeEyebrow">CONFIRMACIÓN</p><h3 id="knowledge-delete-title">Eliminar nota</h3><small>Vas a eliminar “{pendingDelete.title}”. Esta acción no se puede deshacer.</small></div></div><div className="knowledgeEditorActions"><button type="button" className="knowledgeBtn" onClick={()=>setPendingDelete(null)}>Conservar</button><button type="button" className="knowledgeBtn danger" disabled={saving} onClick={()=>void confirmRemove()}>{saving?"Eliminando…":"Eliminar nota"}</button></div></section></div>}
    <p className="knowledgeFootnote">Importación actual: texto, Markdown, CSV y JSON de hasta 5,000 caracteres por nota. Los archivos originales no se adjuntan; se importa su texto. La búsqueda se realiza en las notas cargadas; usa “Cargar más notas” para ampliar el historial. La exportación descarga la biblioteca completa.</p>
  </div>;
}
