"use client";
import {useEffect,useRef,useState} from "react";
import {Copy,Save,Trash2} from "lucide-react";
import {toast} from "sonner";
import {MODES} from "@/lib/engine/state";
import {POWERS} from "@/lib/engine/highcoon";
import {actionPadSchema,performanceSchema,type ActionPad,type Performance} from "@/lib/engine/performance-state";
type Props={value:Performance;onChange:(p:Performance)=>void;onSave:(p:Performance)=>Promise<void>;model:string;animations:string[];bank:ActionPad["bank"];slot:number;onSelect:(bank:ActionPad["bank"],slot:number)=>void};
const colors=["#00eeee","#fdcc0d","#f48bb8","#bc8cfa","#ef9052","#73b6ff"];
export default function PadComposer({value,onChange,onSave,model,animations,bank,slot,onSelect}:Props){
 const saved=value.pads.find(p=>p.bank===bank&&p.slot===slot),[draft,setDraft]=useState<ActionPad>(()=>saved||fresh(bank,slot));
 const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState("");const pending=useRef<Performance|null>(null),savingRef=useRef(false);
 function fresh(bank:ActionPad["bank"],slot:number):ActionPad{return {id:crypto.randomUUID(),bank,slot,label:"Mi acción",color:"#00eeee",trigger:"tap",action:{}};}
 useEffect(()=>{setDraft(saved||fresh(bank,slot));},[saved,bank,slot]);
 function action(p:Partial<ActionPad["action"]>){setDraft(d=>({...d,action:{...d.action,...p}}));}
 async function store(p:Performance,label:string){if(savingRef.current)return;savingRef.current=true;setSaving(true);setSaveError("");try{const next=performanceSchema.parse(p);pending.current=next;onChange(next);await onSave(next);pending.current=null;toast.success(label+" · guardado en tu cuenta");}catch(e){setSaveError(e instanceof Error?e.message:"No se pudo guardar el pad.");}finally{savingRef.current=false;setSaving(false);}}
 function save(){try{if(!Object.entries(draft.action).some(([k,v])=>k!=="loop"&&k!=="speed"&&v!==undefined&&v!==false))throw new Error("Elige una acción para este pad.");const pad=actionPadSchema.parse(draft);void store({...value,pads:[...value.pads.filter(p=>p.bank!==bank||p.slot!==slot),pad]},`Banco ${bank} · pad ${slot+1}`);}catch(e){toast.error(e instanceof Error?e.message:"No se pudo guardar el pad.");}}
 function pick(label:string,key:keyof ActionPad["action"],options:readonly (readonly [string,string])[]){return <label className="pad-field">{label}<select value={String(draft.action[key]??"")} onChange={e=>action({[key]:e.target.value||undefined})}><option value="">No change</option>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>;}
 const target=draft.action.pose?`pose:${draft.action.pose}`:draft.action.clip?`clip:${draft.action.clip}`:draft.action.animation?`animation:${draft.action.animation}`:draft.action.live?"live":"";
 return <div className="pad-composer"><div className="tab-heading"><h2>Configurar un pad.</h2><p>1. Elige un espacio. 2. Elige la acción. 3. Guarda. Para tus poses y movimientos, puedes usar “Poner en un pad” desde Crear.</p></div><fieldset className="workflow-fieldset" disabled={saving}>
  <div className="pose-toolbar">{(["A","B","C"] as const).map(b=><button key={b} className={bank===b?"selected":""} onClick={()=>onSelect(b,slot)}>BANK {b}</button>)}</div>
  <div className="pad-slot-picker">{Array.from({length:12},(_,i)=><button key={i} className={slot===i?"selected":""} onClick={()=>onSelect(bank,i)} title={value.pads.find(p=>p.bank===bank&&p.slot===i)?.label||"Empty pad"}>{String(i+1).padStart(2,"0")}</button>)}</div>
  <div className="pad-preview" style={{borderColor:draft.color}}><span>BANK {bank} / {String(slot+1).padStart(2,"0")}</span><strong style={{color:draft.color}}>{draft.label}</strong><small>{draft.trigger.toUpperCase()}</small></div>
  <label className="pad-field">Pad name<input value={draft.label} maxLength={30} onChange={e=>setDraft(d=>({...d,label:e.target.value}))}/></label>
  <details className="workflow-advanced"><summary>Color y modo de pulsación</summary>
  <div className="pad-colors">{colors.map(c=><button key={c} aria-label={`Pad color ${c}`} aria-pressed={draft.color===c} className={draft.color===c?"selected":""} style={{background:c}} onClick={()=>setDraft(d=>({...d,color:c}))}/>)}<input aria-label="Custom pad color" type="color" value={draft.color} onChange={e=>setDraft(d=>({...d,color:e.target.value}))}/></div>
  <label className="pad-field">Trigger<select value={draft.trigger} onChange={e=>setDraft(d=>({...d,trigger:e.target.value as ActionPad["trigger"]}))}><option value="tap">Tap · apply / retrigger</option><option value="hold">Hold · restore on release</option><option value="toggle">Toggle · on / restore</option></select></label>
  </details>
  <label className="pad-field">Character action<select value={target} onChange={e=>{const [type,...id]=e.target.value.split(":"),v=id.join(":");action({pose:type==="pose"?v:undefined,clip:type==="clip"?v:undefined,animation:type==="animation"?v:undefined,live:type==="live"});}}><option value="">Keep current motion</option><option value="live">Return to live tracking</option><optgroup label="Saved poses">{value.poses.filter(p=>p.model===model).map(p=><option key={p.id} value={`pose:${p.id}`}>{p.name}</option>)}</optgroup><optgroup label="Custom keyframe clips">{value.clips.filter(p=>p.model===model).map(p=><option key={p.id} value={`clip:${p.id}`}>{p.name}</option>)}</optgroup><optgroup label="Model animations">{animations.map(p=><option key={p} value={`animation:${p}`}>{p}</option>)}</optgroup></select></label>
  {(draft.action.clip||draft.action.animation)&&<><label className="pose-check"><input type="checkbox" checked={draft.action.loop??value.loop} onChange={e=>action({loop:e.target.checked})}/>Repeat clip while active</label><label className="pad-field">Clip speed<select value={draft.action.speed??value.speed} onChange={e=>action({speed:Number(e.target.value)})}>{[.25,.5,1,1.5,2,3].map(n=><option key={n} value={n}>{n}x</option>)}</select></label></>}
  <details className="workflow-advanced"><summary>Añadir powers, gestos y cámara</summary>
  {pick("Mood","mode",MODES.map(m=>[m,m]))}
  {pick("Power","power",[["none","Clear powers"],...POWERS.map(p=>[p.id,p.name] as const),["spectrum","Full Spectrum"]])}
  {pick("Both hands","hands",[["none","Release hands"],["open","Open"],["fist","Fist"],["point","Point"],["spread","Spread"]])}
  {pick("Camera frame","camera",[["bust","Close up"],["full","Full body"]])}
  <label className="pose-check"><input type="checkbox" checked={!!draft.action.overload} onChange={e=>action({overload:e.target.checked})}/>Fire Overload with this action</label>
  </details>
  <button className="full-button gold-button" onClick={save}><Save size={15}/>{saving?"Guardando…":"Guardar pad "+(slot+1)}</button>
  <div className="pose-toolbar"><button disabled={!saved} onClick={()=>{const target=Array.from({length:12},(_,i)=>i).find(i=>!value.pads.some(p=>p.bank===bank&&p.slot===i));if(target===undefined){toast("Este banco está lleno. Elige otro.");return;}void store({...value,pads:[...value.pads,{...draft,id:crypto.randomUUID(),slot:target,label:(draft.label+" copia").slice(0,30)}]},"Pad duplicado");onSelect(bank,target);}}><Copy size={14}/>Duplicar</button><button disabled={!saved} onClick={()=>void store({...value,pads:value.pads.filter(p=>p.id!==saved?.id)},"Pad eliminado")}><Trash2 size={14}/>Eliminar pad</button></div>
  <p className="field-note">Hold returns owned controls on release (8 second limit if disconnected). Toggle returns them on the next press. Touch, keyboard and the synced phone use the same saved deck.</p>
  <p className="field-note">Los pads guardados aparecen debajo del personaje y en el teléfono conectado. No necesitas guardar la escena otra vez.</p></fieldset>
  {saveError&&<div className="creation-save-error" role="alert"><strong>El pad sigue aquí; falta guardarlo en tu cuenta.</strong><p>{saveError}</p><button disabled={saving||!pending.current} onClick={()=>{if(pending.current)void store(pending.current,"Pad");}}>Reintentar guardado</button></div>}
 </div>;
}
