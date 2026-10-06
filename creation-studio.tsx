"use client";

import {useEffect,useRef,useState} from "react";
import {ArrowLeft,Bone,Check,Download,Loader2,Play,Plus,Save,Square,Trash2,Upload,Video} from "lucide-react";
import {toast} from "sonner";
import type {VtuberEngine} from "@/lib/engine/renderer";
import {appendPosition,appendRecordedTake,assignAssetPad,createAnimation,creationChoices,holdFrame,MotionTake,previewAsset,savePose,type CreationTask,type PerformanceAsset} from "@/lib/engine/authoring";
import {keyAt} from "@/lib/engine/timeline";
import {librarySchema,performanceDefaults,performanceSchema,type ActionPad,type Performance,type PoseClip} from "@/lib/engine/performance-state";
import {robotPerformancePack} from "@/lib/engine/robot-performance";
import {PoseWorkshop} from "./pose-workshop";

type Props={
 engine:VtuberEngine|null;value:Performance;onChange:(p:Performance)=>void;character?:string;
 task:CreationTask;onTask:(task:CreationTask)=>void;enabled:boolean;onEnabled:(enabled:boolean)=>void;
 autoKey:boolean;onAutoKey:(enabled:boolean)=>void;advanced:boolean;onAdvanced:(enabled:boolean)=>void;
 onSave:(p:Performance)=>Promise<void>;onLive:()=>Performance;onCaptureLive:()=>Performance;cameraActive:boolean;
 onPad:(bank:ActionPad["bank"],slot:number)=>void;onActivity:(label:string)=>void;active:boolean;busy?:boolean;
};
const fail=(e:unknown)=>e instanceof Error?e.message:"No se pudo completar la acción.";

export default function CreationStudio({engine,value,onChange,character,task,onTask,enabled,onEnabled,autoKey,onAutoKey,advanced,onAdvanced,onSave,onLive,onCaptureLive,cameraActive,onPad,onActivity,active,busy=false}:Props){
 const binding=engine?.poseBinding,ref=useRef(value);ref.current=value;
 const [name,setName]=useState("Mi pose"),[poseId,setPoseId]=useState<string>(),[clipId,setClipId]=useState(""),[positionId,setPositionId]=useState(""),[seconds,setSeconds]=useState(1),[limit,setLimit]=useState(10);
 const [countdown,setCountdown]=useState<{kind:"pose"|"record";left:number}|null>(null),[taking,setTaking]=useState(false),[elapsed,setElapsed]=useState(0),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState(""),[result,setResult]=useState<{asset:PerformanceAsset;saved:boolean;pad?:string}|null>(null);
 const take=useRef<MotionTake|null>(null),pendingTake=useRef<PoseClip|null>(null),countBinding=useRef(binding),lastBinding=useRef(binding),file=useRef<HTMLInputElement>(null),mounted=useRef(true),persisting=useRef(false);
 const callbacks=useRef({finishTake,copyPose});callbacks.current={finishTake,copyPose};
 const clip=value.clips.find(c=>c.id===clipId&&c.model===binding?.model),positions=clip?.keyframes||[],locked=busy||saving||taking||!!countdown;
 const library=[...value.poses.filter(p=>p.model===binding?.model).map(p=>({...p,kind:"pose" as const})),...value.clips.filter(p=>p.model===binding?.model).map(p=>({...p,kind:"clip" as const}))];
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;take.current=null;};},[]);
 useEffect(()=>{if(lastBinding.current!==binding){lastBinding.current=binding;take.current=null;setTaking(false);setCountdown(null);setPoseId(undefined);setClipId("");setPositionId("");setResult(null);onTask("home");onEnabled(false);}},[binding,onTask,onEnabled]);
 useEffect(()=>{onActivity(countdown?`Prepárate · ${countdown.left}`:taking?`Grabando movimiento · ${elapsed.toFixed(1)}s`:"");},[countdown,taking,elapsed,onActivity]);
 useEffect(()=>{
  if(!countdown)return;
  const timer=setTimeout(()=>{
   if(engine?.poseBinding!==countBinding.current){setCountdown(null);toast.error("El personaje cambió. Vuelve a iniciar la captura.");return;}
   if(countdown.left>1){setCountdown({...countdown,left:countdown.left-1});return;}
   setCountdown(null);
   if(countdown.kind==="pose")callbacks.current.copyPose();
   else if(binding){take.current=new MotionTake(binding,name,character,limit);setElapsed(0);setTaking(true);}
  },1000);
  return()=>clearTimeout(timer);
 },[countdown,binding,engine,name,character,limit]);
 useEffect(()=>{
  if(!taking)return;
  const timer=setInterval(()=>{
   const current=take.current;if(!current)return;
   if(engine?.poseBinding?.model!==current.model||engine?.poseBinding!==countBinding.current){take.current=null;setTaking(false);toast.error("La grabación se detuvo porque cambió el personaje.");return;}
   const done=current.sample();setElapsed(current.elapsed);
   if(done)void callbacks.current.finishTake();
  },1000/6);
  return()=>clearInterval(timer);
 },[taking,engine]);
 useEffect(()=>{if(!active)onEnabled(false);},[active,onEnabled]);
 useEffect(()=>{const key=clip?.keyframes.find(k=>Math.abs(k.time-value.time)<1/60);if(key)setPositionId(key.id);},[clip,value.time]);

 function commit(p:Performance){const next=performanceSchema.parse(p);ref.current=next;onChange(next);return next;}
 async function persist(p:Performance,asset?:PerformanceAsset,pad?:string){
  if(persisting.current)return;persisting.current=true;setSaving(true);setSaveError("");
  if(asset)setResult({asset,saved:false,pad});
  try{await onSave(p);if(mounted.current){if(asset)setResult({asset,saved:true,pad});else setResult(r=>r?{...r,saved:true}:r);toast.success(pad?`${pad} guardado. Tócalo debajo del personaje o en tu teléfono.`:"Guardado en tu cuenta.");}return true;}
  catch(e){if(mounted.current){setSaveError(fail(e));toast.error("No se pudo guardar. Tu borrador sigue aquí.");}return false;}
  finally{persisting.current=false;if(mounted.current)setSaving(false);}
 }
 function choose(next:CreationTask){
  if(locked)return;onAutoKey(false);onAdvanced(false);onEnabled(false);setResult(null);if(!pendingTake.current)setSaveError("");onTask(next);
  if(next==="pose"){setName("Mi pose");setPoseId(undefined);if(binding){const frame=binding.capture();commit(holdFrame(onLive(),binding.model,frame));onEnabled(true);engine?.frameCamera("full");}}
  if(next==="record"){setName("Mi movimiento");onLive();}
  if(next==="keyframes"){setName("Mi animación");setClipId("");setPositionId("");}
 }
 function editPose(id:string){
  const pose=ref.current.poses.find(p=>p.id===id&&p.model===binding?.model);if(!pose||locked)return;
  onTask("pose");onAutoKey(false);onAdvanced(false);setPoseId(id);setName(pose.name);setResult(null);commit(holdFrame(onLive(),pose.model,pose.frame,0));onEnabled(true);engine?.frameCamera("full");
 }
 function editClip(id:string){
  const c=ref.current.clips.find(c=>c.id===id&&c.model===binding?.model);if(!c||locked)return;
  onTask("keyframes");onAutoKey(false);onAdvanced(false);setClipId(id);setName(c.name);setResult(null);editPosition(c,c.keyframes[0].id);
 }
 function editPosition(c:PoseClip,id:string){const key=c.keyframes.find(k=>k.id===id);if(!key)return;commit({...holdFrame(onLive(),c.model,key.frame,key.time),clip:c.id});setPositionId(key.id);onEnabled(true);}
 function copyPose(){if(!binding)return;commit(holdFrame(ref.current,binding.model,binding.capture()));onEnabled(true);engine?.frameCamera("full");toast("Postura capturada. Puedes ajustarla antes de guardar.");}
 function startCountdown(kind:"pose"|"record"){
  if(!binding||locked||!name.trim())return;if(pendingTake.current){toast("Guarda o descarga la captura pendiente antes de empezar otra.");return;}commit(onCaptureLive());countBinding.current=binding;setCountdown({kind,left:3});setResult(null);setSaveError("");
 }
 async function capturePose(){
  if(!binding||locked)return;
  try{const saved=savePose(ref.current,binding.model,binding.capture(),name,character,poseId);commit(saved.value);setPoseId(saved.asset.id);await persist(saved.value,saved.asset);}catch(e){toast.error(fail(e));}
 }
 function newClip(){
  if(!binding||locked)return;
  try{const frame=binding.capture(),created=createAnimation(onLive(),binding.model,frame,name,character);commit(created.value);setClipId(created.clip.id);setPositionId(created.clip.keyframes[0].id);onEnabled(true);engine?.frameCamera("full");}catch(e){toast.error(fail(e));}
 }
 function addPosition(){
  if(!clip||!binding||locked)return;
  try{const next=appendPosition(ref.current,clip,binding.capture(),seconds);commit(next.value);setPositionId(next.key.id);onEnabled(true);setResult(null);}catch(e){toast.error(fail(e));}
 }
 function replacePosition(){
  if(!clip||!binding||locked)return;const key=clip.keyframes.find(k=>k.id===positionId);if(!key)return;
  try{const next=keyAt(clip,key.time,binding.capture(),key.easing,clip.fps||30);commit({...ref.current,clips:ref.current.clips.map(c=>c.id===clip.id?next:c)});setResult(null);}catch(e){toast.error(fail(e));}
 }
 async function finishTake(){
  const current=take.current;if(!current)return;take.current=null;setTaking(false);
  try{pendingTake.current=current.finish();await savePendingTake();}catch(e){setSaveError(fail(e));toast.error(fail(e));}
 }
 async function savePendingTake(){const c=pendingTake.current;if(!c)return;try{const p=commit(appendRecordedTake(ref.current,c));pendingTake.current=null;setClipId(c.id);await persist(p,{kind:"clip",id:c.id});}catch(e){setSaveError(fail(e));toast.error(fail(e));}}
 function downloadPendingTake(){const raw=pendingTake.current;if(!raw)return;const clip=appendRecordedTake(performanceDefaults(),raw).clips[0];const url=URL.createObjectURL(new Blob([JSON.stringify({format:"sgx-performance-library",version:1,poses:[],clips:[clip],pads:[]})],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download="SGX-movimiento.json";a.click();pendingTake.current=null;setSaveError("");setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function preview(asset:PerformanceAsset){
  if(!binding||locked)return;
  try{const p=previewAsset(onLive(),asset,binding.model);onEnabled(false);commit(p);}catch(e){toast.error(fail(e));}
 }
 async function assign(asset:PerformanceAsset){
  if(!binding||locked)return;
  try{const next=assignAssetPad(ref.current,asset,binding.model);commit(next.value);if(await persist(next.value,asset,`Banco ${next.pad.bank} · pad ${next.pad.slot+1}`)){onEnabled(false);onPad(next.pad.bank,next.pad.slot);}}catch(e){toast.error(fail(e));}
 }
 async function importLibrary(f:File){
  try{if(f.size>1100000)throw new Error("El archivo es demasiado grande (máximo 1.1 MB).");const data=librarySchema.parse(JSON.parse(await f.text())),p=ref.current,merge=<V extends {id:string}>(a:V[],b:V[])=>[...a.filter(v=>!b.some(n=>n.id===v.id)),...b],pads=[...p.pads.filter(a=>!data.pads.some(b=>b.id===a.id||a.bank===b.bank&&a.slot===b.slot)),...data.pads];await persist(commit({...p,poses:merge(p.poses,data.poses),clips:merge(p.clips,data.clips),pads}));}catch(e){toast.error(fail(e));}
 }
 function exportLibrary(){const p=ref.current,url=URL.createObjectURL(new Blob([JSON.stringify({format:"sgx-performance-library",version:1,poses:p.poses,clips:p.clips,pads:p.pads})],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download="SGX-pose-and-pad-library.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function removeAsset(asset:PerformanceAsset){const p=ref.current,next={...p,poses:asset.kind==="pose"?p.poses.filter(item=>item.id!==asset.id):p.poses,clips:asset.kind==="clip"?p.clips.filter(item=>item.id!==asset.id):p.clips,pads:p.pads.map(pad=>pad.action[asset.kind]===asset.id?{...pad,action:{...pad.action,[asset.kind]:undefined}}:pad)};void persist(commit(next));if(result?.asset.id===asset.id)setResult(null);}
 const heading=creationChoices.find(c=>c.id===task);
 const editor=<PoseWorkshop engine={engine} value={value} onChange={p=>{commit(p);setResult(null);}} enabled={enabled} onEnabled={onEnabled} autoKey={autoKey}/>;
 const finalAsset=result?.asset||(clip?{kind:"clip" as const,id:clip.id}:null);

 return <div className="creation-studio">
  <div className="tab-heading"><h2>{heading?.title||"¿Qué quieres crear?"}</h2><p>{heading?.description||"Una pose es una postura. Una animación es un movimiento que puedes volver a usar."}</p></div>
  {task==="home"?<div className="creation-choices">{creationChoices.map(choice=><button key={choice.id} disabled={!binding||locked} onClick={()=>choose(choice.id)}>{choice.id==="pose"?<Bone size={20}/>:choice.id==="record"?<Video size={20}/>:<Plus size={20}/>}<span><strong>{choice.title}</strong><small>{choice.description}</small></span></button>)}</div>:<>
   <button className="text-button creation-back" disabled={locked} onClick={()=>choose("home")}><ArrowLeft size={14}/>Volver a Crear</button>
   <ol className="creation-steps" aria-label="Pasos para crear"><li className={!result?"current":""}><b>1</b>{task==="record"?"Actúa":"Coloca"}</li><li className={saving?"current":""}><b>2</b>Guarda</li><li className={result?.saved?"current":""}><b>3</b>Usa un pad</li></ol>
   <label className="pad-field">Nombre<input aria-label="Nombre de la pose o animación" maxLength={60} value={name} disabled={locked} onChange={e=>{setName(e.target.value);if(clip&&task==="keyframes"&&e.target.value.trim())commit({...ref.current,clips:ref.current.clips.map(c=>c.id===clip.id?{...c,name:e.target.value}:c)});}} placeholder="Ej. Saludo, sorpresa, intro…"/></label>
   {countdown&&<div className="capture-countdown" role="status"><strong>{countdown.left}</strong><p>{countdown.kind==="pose"?"Haz tu pose. La copiaremos al terminar la cuenta.":"Prepárate. Empieza a moverte cuando llegue a cero."}</p><button onClick={()=>setCountdown(null)}>Cancelar</button></div>}
   {task==="pose"&&!countdown&&<>
    <button className="full-button" disabled={locked||!binding||!cameraActive} onClick={()=>startCountdown("pose")}><Video size={15}/>Copiar mi postura · cuenta de 3 s</button>
    {!cameraActive&&<p className="field-note">Para copiarte, prende la cámara aquí o en tu teléfono. También puedes colocar el personaje a mano.</p>}
    {editor}
    <button className="full-button gold-button" disabled={locked||!binding||!name.trim()||(!poseId&&value.poses.length>=48)} onClick={()=>void capturePose()}>{saving?<Loader2 size={15} className="spin"/>:<Save size={15}/>} {saving?"Guardando…":poseId?"Guardar cambios de pose":"Guardar pose"}</button>
   </>}
   {task==="record"&&!countdown&&<>
    {!result&&!taking&&<><p className="workflow-tip">Prende la cámara o usa tus pads. Al detener la captura, guardamos una animación reutilizable.</p><label className="pad-field">Duración máxima<select value={limit} disabled={locked} onChange={e=>setLimit(Number(e.target.value))}>{[5,10,20].map(n=><option key={n} value={n}>{n} segundos</option>)}</select></label><button className="full-button gold-button" disabled={locked||!binding||!name.trim()||value.clips.length>=24} onClick={()=>startCountdown("record")}><Video size={16}/>Empezar captura · 3 s para prepararte</button></>}
    {taking&&<div className="motion-recording" role="status"><span className="record-dot"/><strong>{elapsed.toFixed(1)} / {limit} s</strong><p>Actúa ahora. La captura sigue aunque abras otro panel.</p><button className="full-button gold-button" onClick={()=>void finishTake()}><Square size={15}/>Detener y guardar movimiento</button></div>}
    {result&&!taking&&<button className="text-button" disabled={locked} onClick={()=>{setResult(null);setClipId("");}}>Grabar otro movimiento</button>}
   </>}
   {task==="keyframes"&&<>
    {!clip?<><p className="workflow-tip">Empieza con la postura que ves. Después mueve una parte y añade otra posición.</p><button className="full-button gold-button" disabled={locked||!binding||!name.trim()||value.clips.length>=24} onClick={newClip}><Plus size={15}/>Crear animación con esta postura</button></>:<>
     <div className="position-steps" aria-label="Posiciones de la animación">{positions.map((key,i)=><button key={key.id} disabled={locked} className={positionId===key.id?"selected":""} aria-pressed={positionId===key.id} onClick={()=>editPosition(clip,key.id)}><strong>Posición {i+1}</strong><small>{key.time.toFixed(1)} s</small></button>)}</div>
     <p className="field-note">Mueve el personaje. “Añadir posición” coloca la nueva postura al final; “Actualizar” cambia la que seleccionaste.</p>
     {editor}
     <label className="pad-field">Tiempo hasta la siguiente posición<select value={seconds} disabled={locked} onChange={e=>setSeconds(Number(e.target.value))}>{[.5,1,2,3].map(n=><option key={n} value={n}>{n} segundos</option>)}</select></label>
     <button className="full-button" disabled={locked||positions.length>=120||value.playing} onClick={addPosition}><Plus size={15}/>Añadir posición al final</button>
     <button className="text-button" disabled={locked||!positionId||value.playing} onClick={replacePosition}>Actualizar posición seleccionada</button>
     <div className="creation-actions"><button disabled={locked} onClick={()=>preview({kind:"clip",id:clip.id})}><Play size={15}/>Probar animación</button><button className="gold-button" disabled={locked||!name.trim()} onClick={()=>void persist(ref.current,{kind:"clip",id:clip.id})}>{saving?<Loader2 size={15} className="spin"/>:<Save size={15}/>}Guardar animación</button></div>
     <button className="text-button" aria-expanded={advanced} disabled={locked} onClick={()=>onAdvanced(!advanced)}>{advanced?"Cerrar timeline avanzado":"Abrir timeline avanzado"}</button>
     {advanced&&<p className="field-note">El timeline está debajo del personaje. Puedes mover los tiempos y editar cada keyframe.</p>}
    </>}
   </>}
   <details className="workflow-advanced"><summary>Opciones de reproducción</summary><label className="pose-check"><input type="checkbox" checked={value.keepFace} onChange={e=>commit({...ref.current,keepFace:e.target.checked})}/>Mantener cara y boca en vivo</label><label className="field-label">Transición · {value.blend.toFixed(2)} s<input type="range" className="pose-range" min={0} max={2} step={.05} value={value.blend} onChange={e=>commit({...ref.current,blend:e.target.valueAsNumber})}/></label></details>
  </>}
  {saveError&&<div className="creation-save-error" role="alert"><strong>El borrador sigue aquí. Falta guardarlo en tu cuenta.</strong><p>{saveError}</p><button disabled={locked} onClick={()=>pendingTake.current?void savePendingTake():void persist(ref.current,result?.asset,result?.pad)}>{saving?"Guardando…":"Reintentar guardado"}</button>{pendingTake.current&&<button onClick={downloadPendingTake}><Download size={14}/>Descargar captura</button>}</div>}
  {result&&<div className="creation-result" role="status"><strong>{result.saved?<><Check size={16}/>{result.pad||"Guardado en tu cuenta"}</>:saving?"Guardando en tu cuenta…":"Borrador pendiente de guardar"}</strong>{result.saved&&<p>{result.pad?"El pad está listo debajo del personaje y en el teléfono sincronizado.":"Ya puedes probarlo o ponerlo en un pad. No hace falta guardar la escena."}</p>}{finalAsset&&<div className="creation-actions"><button disabled={locked} onClick={()=>preview(finalAsset)}><Play size={14}/>Probar</button><button className="gold-button" disabled={locked} onClick={()=>void assign(finalAsset)}>Poner en un pad</button>{result.asset.kind==="clip"&&task==="record"&&<button disabled={locked} onClick={()=>editClip(result.asset.id)}>Editar posiciones</button>}</div>}</div>}
  <section className="creation-library" aria-label="Biblioteca de poses y animaciones"><h3>Tu biblioteca <small>{library.length}</small></h3>{!library.length?<p className="field-note">Tus poses y movimientos aparecerán aquí.</p>:library.map(item=><div className="creation-library-item" key={item.id}><strong>{item.name}</strong><small>{item.kind==="pose"?"Pose · postura fija":"Animación · movimiento"}</small><div><button disabled={locked} aria-label={`Probar ${item.name}`} onClick={()=>preview({kind:item.kind,id:item.id})}><Play size={13}/>Probar</button><button disabled={locked} aria-label={`Editar ${item.name}`} onClick={()=>item.kind==="pose"?editPose(item.id):editClip(item.id)}>Editar</button><button disabled={locked} aria-label={`Poner ${item.name} en un pad`} onClick={()=>void assign({kind:item.kind,id:item.id})}>Pad</button></div></div>)}</section>
  <button className="full-button" disabled={taking||!!countdown} onClick={()=>{onEnabled(false);onLive();}}><Play size={15}/>Volver a actuar en vivo</button>
  <details className="workflow-advanced"><summary>Importar, exportar y gestionar biblioteca</summary><div className="settings-actions"><button disabled={locked} onClick={exportLibrary}><Download size={14}/>Exportar</button><button disabled={locked} onClick={()=>file.current?.click()}><Upload size={14}/>Importar</button></div><input hidden ref={file} type="file" accept=".json" onChange={e=>{if(e.target.files?.[0])void importLibrary(e.target.files[0]);e.target.value="";}}/>{engine?.robot?.available&&<button className="full-button" disabled={locked||value.clips.some(c=>c.model===binding?.model&&c.name==="Robot / Wave")} onClick={()=>{try{if(binding)void persist(commit(robotPerformancePack(binding,ref.current)));}catch(e){toast.error(fail(e));}}}><Plus size={14}/>Añadir poses y animaciones del Robot</button>}{library.map(item=><button className="text-button" disabled={locked} key={item.id} onClick={()=>removeAsset({kind:item.kind,id:item.id})}><Trash2 size={13}/>Eliminar {item.name}</button>)}</details>
 </div>;
}
