import {poseClipSchema,type PoseClip,type PoseFrame} from "./performance-state";
export function snapTime(time:number,duration:number,fps=30){return Math.min(duration,Math.max(0,Math.round(time*fps)/fps));}
export function keyAt(clip:PoseClip,time:number,frame:PoseFrame,easing:PoseClip["keyframes"][number]["easing"],fps=30):PoseClip{
 const t=snapTime(time,clip.duration,fps),old=clip.keyframes.find(k=>Math.abs(k.time-t)<.5/fps),key={id:old?.id||crypto.randomUUID(),time:old?.time??t,frame,easing};
 return poseClipSchema.parse({...clip,keyframes:[...clip.keyframes.filter(k=>k.id!==key.id),key].sort((a,b)=>a.time-b.time)});
}
export function moveKey(clip:PoseClip,id:string,time:number,fps=30){const t=snapTime(time,clip.duration,fps);if(clip.keyframes.some(k=>k.id!==id&&Math.abs(k.time-t)<.5/fps))throw new Error("This frame already has a key. Move it to a free frame.");return poseClipSchema.parse({...clip,keyframes:clip.keyframes.map(k=>k.id===id?{...k,time:t}:k).sort((a,b)=>a.time-b.time)});}
export function retimeClip(clip:PoseClip,duration:number){return poseClipSchema.parse({...clip,duration,keyframes:clip.keyframes.map(k=>({...k,time:Math.round(k.time/clip.duration*duration*1e6)/1e6}))});}
export function mirrorFrame(frame:PoseFrame):PoseFrame{
 const swap=(key:string)=>key.replace(/Left|Right|left|right|_L(?=\b|::)|_R(?=\b|::)/g,v=>({Left:"Right",Right:"Left",left:"right",right:"left",_L:"_R",_R:"_L"})[v]!);
 return {bones:Object.fromEntries(Object.entries(frame.bones).map(([key,v])=>[swap(key),{...(v.p?{p:[-v.p[0],v.p[1],v.p[2]]}:{}),...(v.q?{q:[v.q[0],-v.q[1],-v.q[2],v.q[3]]}:{}),...(v.s?{s:[...v.s]}:{})}])),morphs:Object.fromEntries(Object.entries(frame.morphs).map(([key,v])=>[swap(key),v]))} as PoseFrame;
}
export const timelineGroup=(name:string)=>/thumb|index|middle|ring|little|finger|hand/i.test(name)?"Hands":/leg|foot|toe|thigh|shin/i.test(name)?"Legs":/arm|shoulder|clavicle/i.test(name)?"Arms":/head|neck|eye|brow|jaw|mouth|face|cheek|ear/i.test(name)?"Face":"Torso";
