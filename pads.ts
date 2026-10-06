import type {Config} from "./state";
import {playClip} from "./motion";
import {nextNonce,type ActionPad} from "./performance-state";

export type PadStage={model:string;animations:string[];camera:()=>Config["camera"];frame:(p:"bust"|"full")=>void;burst:(id:Config["power"]["id"])=>void;clearPower:()=>void};
export function padReady(pad:ActionPad,c:Config,stage:Pick<PadStage,"model"|"animations">){const a=pad.action;return Object.entries(a).some(([k,v])=>k!=="loop"&&k!=="speed"&&v!==undefined&&v!==false)&&(!a.pose||c.performance.poses.some(p=>p.id===a.pose&&p.model===stage.model))&&(!a.clip||c.performance.clips.some(p=>p.id===a.clip&&p.model===stage.model))&&(!a.animation||stage.animations.includes(a.animation));}
export function composePad(c:Config,pad:ActionPad,stage:PadStage):Config{
 if(pad.action.overload&&(pad.action.power??c.power.id)==="none")throw new Error("Activa un power antes de Overload.");
 if(!padReady(pad,c,stage))throw new Error("Este pad necesita una pose o animación compatible con el personaje actual.");
 const a=pad.action;let next={...c};
 if(a.live)next={...playClip(next,"none"),performance:{...next.performance,mode:"live",playing:false,nonce:nextNonce(next.performance.nonce)}};
 if(a.animation){next={...playClip(next,a.animation,a.loop??next.performance.loop),performance:{...next.performance,mode:"live",playing:false}};if(a.speed)next.avatar={...next.avatar,animationSpeed:a.speed};}
 if(a.pose){const pose=c.performance.poses.find(p=>p.id===a.pose)!;next={...next,puppet:{left:"none",right:"none"},performance:{...next.performance,mode:"pose",model:pose.model,frame:pose.frame,playing:false,nonce:nextNonce(next.performance.nonce)}};}
 if(a.clip){const clip=c.performance.clips.find(p=>p.id===a.clip)!;next={...next,puppet:{left:"none",right:"none"},performance:{...next.performance,mode:"clip",model:clip.model,clip:clip.id,time:0,playing:true,loop:a.loop??next.performance.loop,speed:a.speed??next.performance.speed,nonce:nextNonce(next.performance.nonce)}};}
 if(a.mode)next={...next,mode:a.mode};
 if(a.power){stage.clearPower();next={...next,power:{...next.power,id:a.power}};}
 if(a.hands){next={...next,puppet:{left:a.hands,right:a.hands}};if(a.hands!=="none")next.tracking={...next.tracking,hands:true,handsGain:next.tracking.handsGain||1,wristGain:next.tracking.wristGain||1,fingerGain:next.tracking.fingerGain||1};}
 if(a.camera){stage.frame(a.camera);next={...next,camera:stage.camera()};}
 if(a.overload){if(next.power.id==="none")throw new Error("Activa un power antes de Overload.");stage.burst(next.power.id);}
 return next;
}
const groups=["performance","avatar","power","puppet","camera","tracking"] as const;
function get(c:Config,path:string):unknown{if(path==="mode")return c.mode;const[g,k]=path.split(".");return (c[g as typeof groups[number]] as unknown as Record<string,unknown>)[k];}
function put(c:Config,path:string,value:unknown):Config{if(path==="mode")return {...c,mode:value as Config["mode"]};const[g,k]=path.split(".");return {...c,[g]:{...c[g as typeof groups[number]],[k]:value}};}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
type Held={before:Config;applied:Config;expires:number;trigger:ActionPad["trigger"];owned:Set<string>};
export class PadRuntime {
 active=new Map<string,Held>();
 press(c:Config,pad:ActionPad,stage:PadStage,now=performance.now()):Config{
  if(this.active.has(pad.id))return pad.trigger==="toggle"?this.release(c,pad.id):c;
  const before={...c,camera:stage.camera()},applied=composePad(c,pad,stage);
  const owned=new Set<string>();for(const g of groups)for(const k of Object.keys(applied[g]))if(!equal(get(before,g+"."+k),get(applied,g+"."+k)))owned.add(g+"."+k);
  if(pad.action.mode)owned.add("mode");if(pad.action.power)owned.add("power.id");if(pad.action.hands){owned.add("puppet.left");owned.add("puppet.right");}
  if(pad.trigger!=="tap")this.active.set(pad.id,{before,applied,expires:now+8000,trigger:pad.trigger,owned});return applied;
 }
 release(c:Config,id:string):Config{
  const held=this.active.get(id);if(!held)return c;this.active.delete(id);let next=c;
  // Repair inherited baselines when overlapping holds are released out of order.
  for(const path of held.owned){for(const other of this.active.values())if(equal(get(other.before,path),get(held.applied,path)))other.before=put(other.before,path,get(held.before,path));
   const stillOwned=[...this.active.values()].some(h=>h.owned.has(path)&&equal(get(h.applied,path),get(c,path)));
   if(!stillOwned&&equal(get(c,path),get(held.applied,path)))next=put(next,path,get(held.before,path));}
  return {...next,performance:{...next.performance,nonce:nextNonce(next.performance.nonce)}};
 }
 expire(c:Config,now=performance.now()){for(const[id,h]of this.active)if(h.trigger==="hold"&&now>=h.expires)c=this.release(c,id);return c;}
 releaseHolds(c:Config){for(const[id,h]of this.active)if(h.trigger==="hold")c=this.release(c,id);return c;}
 releaseAll(c:Config){for(const id of this.active.keys())c=this.release(c,id);return c;}
 clear(){this.active.clear();}
}
