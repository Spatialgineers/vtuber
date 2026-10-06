import * as T from "three";
import {emptyFrame,type PoseFrame,type Performance,type PoseClip} from "./performance-state";

export type RestTransform={p:T.Vector3;q:T.Quaternion;s:T.Vector3};
export type PoseBone={key:string;name:string;node:T.Object3D;rest:RestTransform;face:boolean};
const round=(n:number)=>Math.round(n*1e6)/1e6;
const v3=(v:T.Vector3)=>v.toArray().map(round) as [number,number,number];
const q4=(q:T.Quaternion)=>q.normalize().toArray().map(round) as [number,number,number,number];
const faceName=(s:string)=>/head|neck|eye|brow|jaw|mouth|face|cheek|snout|muzzle|(?:^|[._])ear(?:[._]|$)|(?:left|right)ear/i.test(s);
function path(node:T.Object3D){const parts:string[]=[];for(let n:T.Object3D|null=node;n;n=n.parent)if((n as T.Bone).isBone)parts.unshift(n.name||"Bone");return parts.join("/");}
function hash(s:string){let n=2166136261;for(let i=0;i<s.length;i++){n^=s.charCodeAt(i);n=Math.imul(n,16777619);}return (n>>>0).toString(16);}
const emptySkip:ReadonlySet<string>=new Set();

export class PoseBinding {
 bones:PoseBone[]=[];byKey=new Map<string,PoseBone>();byNode=new Map<T.Object3D,PoseBone>();morphs=new Map<string,{mesh:T.Mesh;index:number}>();model:string;
 private p=new T.Vector3();private q=new T.Quaternion();private s=new T.Vector3();
 constructor(public root:T.Object3D,rests?:Map<T.Object3D,RestTransform>){
  const counts=new Map<string,number>();
  root.traverse(node=>{if(!(node as T.Bone).isBone)return;const base=path(node),count=counts.get(base)||0;counts.set(base,count+1);const key=base+(count?`#${count}`:""),original=rests?.get(node)||{p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()},rest={p:original.p.clone(),q:original.q.clone(),s:original.s.clone()};const bone={key,name:node.name,node,rest,face:faceName(node.name)};this.bones.push(bone);this.byKey.set(key,bone);this.byNode.set(node,bone);});
  let skinned=false;
  const names=new Map<string,number>();root.traverse(node=>{const mesh=node as T.SkinnedMesh;skinned||=!!mesh.isSkinnedMesh;if(!mesh.morphTargetDictionary)return;const base=node.name||"Mesh",count=names.get(base)||0;names.set(base,count+1);for(const [name,index]of Object.entries(mesh.morphTargetDictionary))this.morphs.set(`${base}${count?`#${count}`:""}::${name}`,{mesh,index});});
  // Preserve the procedural Robot's saved poses, clips and pads across the thumb fix.
  // Actual offsets still use the new rest. Imported skins keep their exact bind identity.
  const robot=root.userData.sgxRobot===true&&root.userData.sgxRobotHandLayout===2&&!skinned;
  this.model="rig-"+hash(JSON.stringify(this.bones.map(b=>{
   const p=v3(b.rest.p),q=q4(b.rest.q.clone()),finger=robot&&b.name.match(/^(Left|Right)(Thumb|Index|Middle|Ring|Little)(Proximal|Intermediate|Distal)$/);
   if(finger){
    const index=["Thumb","Index","Middle","Ring","Little"].indexOf(finger[2]);
    if(finger[3]==="Proximal"){p[0]=round((index-2)*.058*(finger[1]==="Left"?1:-1));p[1]=-.18;if(index===0)q.splice(0,4,0,0,0,1);}
    else if(index===0)p[1]=finger[3]==="Intermediate"?-.11:-.065;
   }
   return [b.key,p,q,v3(b.rest.s)];
  })));
 }
 setAppearanceReference(){for(const b of this.bones){b.rest.p.copy(b.node.position);b.rest.s.copy(b.node.scale);}}
 offset(b:PoseBone){const p=b.node.position.clone().sub(b.rest.p),q=b.rest.q.clone().invert().multiply(b.node.quaternion).normalize(),s=b.node.scale.clone().divide(b.rest.s);return {p:v3(p),q:q4(q),s:v3(s)};}
 capture():PoseFrame{const frame=emptyFrame();for(const b of this.bones){const value:PoseFrame["bones"][string]={};this.p.copy(b.node.position).sub(b.rest.p);this.q.copy(b.rest.q).invert().multiply(b.node.quaternion).normalize();this.s.copy(b.node.scale).divide(b.rest.s);if(this.p.length()>1e-6)value.p=v3(this.p);if(Math.abs(this.q.x)+Math.abs(this.q.y)+Math.abs(this.q.z)>1e-6)value.q=q4(this.q);if(Math.abs(this.s.x-1)>1e-6||Math.abs(this.s.y-1)>1e-6||Math.abs(this.s.z-1)>1e-6)value.s=v3(this.s);if(Object.keys(value).length)frame.bones[b.key]=value;}for(const [key,m]of this.morphs){const v=m.mesh.morphTargetInfluences?.[m.index]||0;if(v>1e-6)frame.morphs[key]=round(v);}return frame;}
 apply(frame:PoseFrame,weight=1,keepFace=false,skip:ReadonlySet<string>=emptySkip){
  if(weight===0)return;
  for(const b of this.bones){if(keepFace&&b.face||skip.has(b.key))continue;const v=frame.bones[b.key];this.p.set(0,0,0);if(v?.p)this.p.fromArray(v.p);this.p.add(b.rest.p);this.q.identity();if(v?.q)this.q.fromArray(v.q);this.q.premultiply(b.rest.q);this.s.set(1,1,1);if(v?.s)this.s.fromArray(v.s);this.s.multiply(b.rest.s);b.node.position.lerp(this.p,weight);b.node.quaternion.slerp(this.q,weight);b.node.scale.lerp(this.s,weight);}
  if(!keepFace)for(const[key,m]of this.morphs)if(m.mesh.morphTargetInfluences)m.mesh.morphTargetInfluences[m.index]=T.MathUtils.lerp(m.mesh.morphTargetInfluences[m.index]||0,frame.morphs[key]||0,weight);
  this.root.updateWorldMatrix(true,true);
 }
}
export function interpolateFrame(a:PoseFrame,b:PoseFrame,t:number):PoseFrame{
 t=T.MathUtils.clamp(t,0,1);if(t===0)return a;if(t===1)return b;const out=emptyFrame();
 for(const key of new Set([...Object.keys(a.bones),...Object.keys(b.bones)])){const x=a.bones[key],y=b.bones[key];out.bones[key]={p:v3(new T.Vector3().fromArray(x?.p||[0,0,0]).lerp(new T.Vector3().fromArray(y?.p||[0,0,0]),t)),q:q4(new T.Quaternion().fromArray(x?.q||[0,0,0,1]).slerp(new T.Quaternion().fromArray(y?.q||[0,0,0,1]),t)),s:v3(new T.Vector3().fromArray(x?.s||[1,1,1]).lerp(new T.Vector3().fromArray(y?.s||[1,1,1]),t))};}
 for(const key of new Set([...Object.keys(a.morphs),...Object.keys(b.morphs)]))out.morphs[key]=T.MathUtils.lerp(a.morphs[key]||0,b.morphs[key]||0,t);
 return out;
}
export function sampleClip(clip:PoseClip,time:number):PoseFrame{
 const keys=clip.keyframes;if(time<=keys[0].time)return keys[0].frame;if(time>=keys.at(-1)!.time)return keys.at(-1)!.frame;
 const i=keys.findIndex(k=>k.time>time),a=keys[i-1],b=keys[i];let t=(time-a.time)/(b.time-a.time);if(a.easing==="step")t=0;if(a.easing==="smooth")t=t*t*(3-2*t);return interpolateFrame(a.frame,b.frame,t);
}
export class PosePlayer {
 time=0;ended=false;private seek="";private action="";private from?:PoseFrame;private rendered?:PoseFrame;private blendTime=0;private lastFrame?:PoseFrame;
 constructor(public binding:PoseBinding){}
 update(p:Performance,dt:number,frozen:boolean,editing=false,skip:ReadonlySet<string>=emptySkip){
  const compatible=p.model===this.binding.model,mode=compatible?p.mode:"live",seek=`${p.clip}:${p.time}:${p.nonce}:${p.playing}`;
  if(seek!==this.seek){this.time=p.time;this.ended=false;this.seek=seek;}
  const action=`${p.model}:${mode}:${p.clip}:${p.nonce}`;if(action!==this.action||mode==="pose"&&this.lastFrame!==p.frame){this.from=this.rendered||(mode!=="live"?this.binding.capture():undefined);this.blendTime=0;this.action=action;}
  this.lastFrame=p.frame;let frame:PoseFrame|undefined;
  if(mode==="pose")frame=p.frame;
  if(mode==="clip"){
   const clip=p.clips.find(c=>c.id===p.clip&&c.model===this.binding.model);
   if(clip){if(p.playing&&!frozen){this.time+=dt*p.speed;if(this.time>clip.duration){if(p.loop)this.time%=clip.duration;else{this.time=clip.duration;this.ended=true;}}}frame=sampleClip(clip,this.time);}
  }
  this.blendTime+=frozen?0:dt;const alpha=editing||p.blend===0?1:Math.min(1,this.blendTime/p.blend);
  if(frame)this.binding.apply(this.from&&alpha<1?interpolateFrame(this.from,frame,alpha):frame,editing?1:p.weight,editing?false:p.keepFace,editing?emptySkip:skip);
  else if(mode==="live"&&this.from&&alpha<1)this.binding.apply(this.from,(1-alpha)*p.weight,p.keepFace,skip);
  // Live input already owns the bones. Capture only a custom pose or its transition.
  this.rendered=frame||this.from&&alpha<1||editing?this.binding.capture():undefined;
  return {time:this.time,ended:this.ended,mode};
 }
}
