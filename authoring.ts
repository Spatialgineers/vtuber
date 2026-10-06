import {keyAt} from "./timeline";
import {sampleClip} from "./pose";
import {nextNonce,performanceSchema,poseClipSchema,type ActionPad,type Performance,type PoseClip,type PoseFrame} from "./performance-state";

export type CreationTask="home"|"pose"|"record"|"keyframes";
export type PerformanceAsset={kind:"pose"|"clip";id:string};
export const creationChoices=[
 {id:"pose",title:"Guardar una pose",description:"Coloca el personaje y guarda una postura fija."},
 {id:"record",title:"Grabar mis movimientos",description:"Actúa con la cámara o los pads y guarda el movimiento."},
 {id:"keyframes",title:"Animar paso a paso",description:"Añade posturas; la app crea el movimiento entre ellas."},
] as const;

export function holdFrame(p:Performance,model:string,frame:PoseFrame,time=p.time):Performance{
 return performanceSchema.parse({...p,model,mode:"pose",frame:structuredClone(frame),time,playing:false,weight:1,nonce:nextNonce(p.nonce)});
}

export function savePose(p:Performance,model:string,frame:PoseFrame,name:string,character?:string,id?:string){
 if(id&&!p.poses.some(item=>item.id===id&&item.model===model))throw new Error("Esta pose pertenece a otro personaje. Guarda una nueva.");
 const pose={id:id||crypto.randomUUID(),name:name.trim(),model,character,frame:structuredClone(frame)};
 const next=performanceSchema.parse({...holdFrame(p,model,frame),poses:id?p.poses.map(item=>item.id===id?pose:item):[...p.poses,pose]});
 if(!next.poses.some(item=>item.id===pose.id))throw new Error("Esta pose ya no existe. Guarda una nueva.");
 return {value:next,asset:{kind:"pose",id:pose.id} as PerformanceAsset};
}

export function createAnimation(p:Performance,model:string,frame:PoseFrame,name:string,character?:string){
 const clip:PoseClip={id:crypto.randomUUID(),name:name.trim(),model,character,duration:1,fps:30,keyframes:[{id:crypto.randomUUID(),time:0,frame:structuredClone(frame),easing:"smooth"}]};
 const value=performanceSchema.parse({...holdFrame(p,model,frame,0),clip:clip.id,clips:[...p.clips,clip]});
 return {value,clip};
}

export function appendPosition(p:Performance,clip:PoseClip,frame:PoseFrame,seconds:number){
 if(!Number.isFinite(seconds)||seconds<=0)throw new Error("Elige cuánto dura el siguiente movimiento.");
 const time=Math.round(((clip.keyframes.at(-1)?.time||0)+seconds)*30)/30;
 if(time>300)throw new Error("La animación puede durar hasta 5 minutos.");
 const next=keyAt({...clip,duration:Math.max(clip.duration,time)},time,structuredClone(frame),"smooth",clip.fps||30);
 const value=performanceSchema.parse({...holdFrame(p,clip.model,frame,time),clip:clip.id,clips:p.clips.map(c=>c.id===clip.id?next:c)});
 return {value,clip:next,key:next.keyframes.at(-1)!};
}

export function previewAsset(p:Performance,asset:PerformanceAsset,model:string):Performance{
 const item=(asset.kind==="pose"?p.poses:p.clips).find(item=>item.id===asset.id&&item.model===model);
 if(!item)throw new Error("Carga el personaje de esta pose o animación para usarla.");
 if(asset.kind==="pose")return holdFrame(p,model,(item as Performance["poses"][number]).frame,0);
 const clip=item as PoseClip;
 return performanceSchema.parse({...p,model,mode:"clip",clip:clip.id,time:0,frame:sampleClip(clip,0),playing:true,loop:false,speed:1,weight:1,nonce:nextNonce(p.nonce)});
}

export function assignAssetPad(p:Performance,asset:PerformanceAsset,model:string){
 const item=(asset.kind==="pose"?p.poses:p.clips).find(item=>item.id===asset.id&&item.model===model);
 if(!item)throw new Error("Esta acción no pertenece al personaje que está abierto.");
 const existing=p.pads.find(pad=>asset.kind==="pose"?pad.action.pose===item.id:pad.action.clip===item.id);
 if(existing)return {value:{...p,bank:existing.bank},pad:existing};
 for(const bank of ["C","B","A"] as const){
  const slot=Array.from({length:12},(_,i)=>i).find(i=>!p.pads.some(pad=>pad.bank===bank&&pad.slot===i));
  if(slot===undefined)continue;
  const pad:ActionPad={id:crypto.randomUUID(),bank,slot,label:item.name.slice(0,30),color:asset.kind==="pose"?"#00eeee":"#fdcc0d",trigger:"tap",action:asset.kind==="pose"?{pose:item.id}:{clip:item.id,loop:false,speed:1}};
  return {value:performanceSchema.parse({...p,bank,pads:[...p.pads,pad]}),pad};
 }
 throw new Error("Los pads están llenos. Abre Configurar pads y elige cuál quieres cambiar.");
}

export function appendRecordedTake(p:Performance,clip:PoseClip):Performance{
 // Dense rigs and existing libraries must fit the same account limit as manual clips.
 // Thin samples evenly while retaining both ends and the original duration.
 const counts=[...new Set([clip.keyframes.length,60,30,15,8,4,2].filter(n=>n<=clip.keyframes.length))];
 for(const count of counts){
  const keyframes=count===clip.keyframes.length?clip.keyframes:Array.from({length:count},(_,i)=>clip.keyframes[Math.round(i*(clip.keyframes.length-1)/(count-1))]);
  const c={...clip,keyframes},parsed=performanceSchema.safeParse({...p,model:c.model,mode:"clip",clip:c.id,time:0,playing:false,frame:c.keyframes[0].frame,weight:1,clips:[...p.clips,c],nonce:nextNonce(p.nonce)});
  if(parsed.success)return parsed.data;
  if(parsed.error.issues.some(issue=>!issue.message.includes("over 900 KB")))throw parsed.error;
 }
 throw new Error("La biblioteca está llena. Exporta o elimina una animación y vuelve a guardar esta captura.");
}

// A take owns its samples independently of the active tab and can be tested with a real rig.
export class MotionTake{
 readonly model:string;
 private keys:PoseClip["keyframes"];
 private start:number;
 constructor(private binding:{model:string;capture:()=>PoseFrame},private name:string,private character?:string,readonly limit=10,private clock=()=>performance.now()){
  this.model=binding.model;this.start=clock();this.keys=[{id:crypto.randomUUID(),time:0,frame:binding.capture(),easing:"smooth"}];
 }
 get elapsed(){return Math.min(this.limit,Math.max(0,(this.clock()-this.start)/1000));}
 sample(){
  const time=Math.round(this.elapsed*30)/30;
  if(time>this.keys.at(-1)!.time&&this.keys.length<120)this.keys.push({id:crypto.randomUUID(),time,frame:this.binding.capture(),easing:"smooth"});
  return this.elapsed>=this.limit||this.keys.length>=120;
 }
 finish():PoseClip{
  this.sample();
  if(this.keys.length===1)this.keys.push({id:crypto.randomUUID(),time:.1,frame:this.binding.capture(),easing:"smooth"});
  return poseClipSchema.parse({id:crypto.randomUUID(),name:this.name.trim(),model:this.model,character:this.character,duration:Math.max(.1,this.keys.at(-1)!.time),fps:30,keyframes:this.keys});
 }
}
