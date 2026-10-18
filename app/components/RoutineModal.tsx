"use client";
import type { CSSProperties } from "react";
import LineIcon from "./LineIcon";
import type { LineIconName } from "./LineIcon";
type RoutineKind = "mood" | "money" | "reminder" | "motivation" | null;
type Props = {
  kind: RoutineKind;
  onClose: () => void;
  mood: number;
  setMood: (value:number) => void;
  note: string;
  setNote: (value:string) => void;
  onSaveMood: () => void;
  word: string;
  message: string;
  onMoney: () => void;
  onReminder: () => void;
};
const baseButton: CSSProperties = {width:"100%",marginTop:12,border:0,borderRadius:13,padding:14,background:"#b7f35a",color:"#11160c",fontWeight:800,cursor:"pointer"};
const quietButton: CSSProperties = {width:"100%",marginTop:8,border:"1px solid #343d44",borderRadius:13,padding:13,background:"transparent",color:"#e7ebee",cursor:"pointer"};
export default function RoutineModal(p:Props) {
  if(!p.kind)return null;
  const moods=["Muy mal","Mal","Regular","Bien","Muy bien"];
  const moodIcons:LineIconName[]=["mood-sad","mood-low","mood-neutral","mood-good","mood-happy"];
  return <div role="presentation" style={{position:"fixed",inset:0,zIndex:1000,display:"grid",placeItems:"center",padding:20,background:"rgba(2,4,7,.8)",backdropFilter:"blur(12px)"}} onClick={p.onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="routine-title" style={{position:"relative",width:"min(100%,460px)",maxHeight:"90vh",overflowY:"auto",border:"1px solid rgba(190,200,210,.2)",borderRadius:24,padding:24,background:"#11161b",boxShadow:"0 24px 90px rgba(0,0,0,.5)",color:"#f3f5f7"}} onClick={e=>e.stopPropagation()}>
      <button aria-label="Cerrar" onClick={p.onClose} style={{position:"absolute",right:14,top:12,border:0,background:"transparent",color:"#aab3bb",fontSize:24,cursor:"pointer"}}>×</button>
      {p.kind==="mood"?<>
        <p style={{fontSize:11,letterSpacing:2,color:"#a7e66c",fontWeight:700}}>PAUSA DE BIENESTAR</p>
        <h2 id="routine-title" style={{fontSize:27,lineHeight:1.15,margin:"8px 0 10px"}}>¿Cómo te sientes en este momento?</h2>
        <p style={{color:"#b6c0c8",fontSize:14,lineHeight:1.55}}>No hay respuestas buenas o malas. Tómate unos segundos para escucharte.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:7,margin:"20px 0"}}>
          {moods.map((label,i)=><button key={label} onClick={()=>p.setMood(i+1)} aria-pressed={p.mood===i+1} style={{minHeight:72,borderRadius:14,border:p.mood===i+1?"1px solid #b7f35a":"1px solid #343d44",background:p.mood===i+1?"rgba(183,243,90,.13)":"#171e24",color:"#edf2f5",fontSize:10,padding:4,cursor:"pointer"}}><b className="routineMoodIcon"><LineIcon name={moodIcons[i]} size={24}/></b>{label}</button>)}
        </div>
        <label style={{display:"block",fontSize:12,color:"#c6cdd2"}}>Nota opcional<textarea value={p.note} maxLength={800} onChange={e=>p.setNote(e.target.value)} placeholder="Algo que quieras dejar registrado…" rows={3} style={{display:"block",width:"100%",boxSizing:"border-box",marginTop:8,border:"1px solid #343d44",borderRadius:12,background:"#0b1014",color:"#f3f5f7",padding:12,resize:"vertical"}}/></label>
        <button onClick={p.onSaveMood} style={baseButton}>Guardar cómo me siento</button>
      </>:p.kind==="money"?<>
        <p style={{fontSize:11,letterSpacing:2,color:"#b7f35a",fontWeight:700}}>PAUSA FINANCIERA</p>
        <h2 id="routine-title" style={{fontSize:27,lineHeight:1.15,margin:"8px 0 10px"}}>¿Tuviste algún ingreso o gasto que registrar?</h2>
        <p style={{color:"#b6c0c8",fontSize:14,lineHeight:1.55}}>Registrar un movimiento toma un momento. Si hoy no hubo ninguno, puedes cerrar esta pregunta.</p>
        <button onClick={()=>{p.onMoney();p.onClose();}} style={baseButton}>Abrir finanzas</button>
        <button onClick={p.onClose} style={quietButton}>Hoy no tengo movimientos</button>
      </>:p.kind==="reminder"?<>
        <p style={{fontSize:11,letterSpacing:2,color:"#82baff",fontWeight:700}}>ORGANIZA TU DÍA</p>
        <h2 id="routine-title" style={{fontSize:27,lineHeight:1.15,margin:"8px 0 10px"}}>¿Tienes algún recordatorio por añadir?</h2>
        <p style={{color:"#b6c0c8",fontSize:14,lineHeight:1.55}}>Deja una tarea o nota para no tener que recordarlo todo de memoria.</p>
        <button onClick={()=>{p.onReminder();p.onClose();}} style={baseButton}>Añadir recordatorio</button>
        <button onClick={p.onClose} style={quietButton}>No tengo nada que añadir</button>
      </>:<>
        <p style={{fontSize:11,letterSpacing:2,color:"#b7f35a",fontWeight:700}}>TU PALABRA DEL DÍA</p>
        <h2 id="routine-title" style={{fontSize:32,lineHeight:1.1,margin:"8px 0 10px",textTransform:"uppercase"}}>{p.word}</h2>
        <p style={{color:"#dce2e6",fontSize:16,lineHeight:1.65}}>{p.message}</p>
        <button onClick={p.onClose} style={baseButton}>Comenzar mi día</button>
      </>}
    </section>
  </div>;
}
