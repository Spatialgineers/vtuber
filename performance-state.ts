import {z} from "zod";

const finite=z.number().finite();
const position=z.tuple([finite.min(-10000).max(10000),finite.min(-10000).max(10000),finite.min(-10000).max(10000)]);
const quaternion=z.tuple([finite,finite,finite,finite]).refine(q=>Math.abs(Math.hypot(...q)-1)<.02,"Rotation must be a normalized quaternion.");
const scale=z.tuple([finite.min(.02).max(20),finite.min(.02).max(20),finite.min(.02).max(20)]);
const key=z.string().min(1).max(300);
export const boneOffsetSchema=z.object({p:position.optional(),q:quaternion.optional(),s:scale.optional()}).strict();
export const frameSchema=z.object({bones:z.record(key,boneOffsetSchema).refine(v=>Object.keys(v).length<=180,"Maximum 180 bones per frame."),morphs:z.record(key,finite.min(0).max(1)).refine(v=>Object.keys(v).length<=200,"Maximum 200 morphs per frame.")}).strict();
export type PoseFrame=z.infer<typeof frameSchema>;
export const emptyFrame=():PoseFrame=>({bones:{},morphs:{}});
export const savedPoseSchema=z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(60),model:z.string().max(100),character:z.string().uuid().optional(),frame:frameSchema}).strict();
export type SavedPose=z.infer<typeof savedPoseSchema>;
export const keyframeSchema=z.object({id:z.string().uuid(),time:finite.min(0).max(300),frame:frameSchema,easing:z.enum(["linear","smooth","step"])}).strict();
export const poseClipSchema=z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(60),model:z.string().max(100),character:z.string().uuid().optional(),duration:finite.min(.1).max(300),fps:z.union([z.literal(24),z.literal(30),z.literal(60)]).optional(),keyframes:z.array(keyframeSchema).min(1).max(120)}).strict().superRefine((c,ctx)=>{
 const times=new Set<number>(),ids=new Set<string>();let last=-1;
 for(const k of c.keyframes){if(k.time>c.duration||k.time<last||times.has(k.time)||ids.has(k.id))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Keyframes must have unique IDs and increasing times within the clip."});last=k.time;times.add(k.time);ids.add(k.id);}
});
export type PoseClip=z.infer<typeof poseClipSchema>;
export const padActionSchema=z.object({pose:z.string().uuid().optional(),clip:z.string().uuid().optional(),animation:z.string().min(1).max(200).optional(),loop:z.boolean().optional(),speed:finite.min(.1).max(3).optional(),mode:z.enum(["NEUTRAL","HYPE","SERIOUS","WTF","TERP","TECH"]).optional(),power:z.enum(["none","limonene","myrcene","caryophyllene","linalool","terpinolene","humulene","alpha-pinene","beta-pinene","spectrum"]).optional(),hands:z.enum(["none","open","fist","point","spread"]).optional(),camera:z.enum(["bust","full"]).optional(),overload:z.boolean().optional(),live:z.boolean().optional()}).strict().refine(a=>[a.pose,a.clip,a.animation,a.live].filter(Boolean).length<=1,"Choose one character action per pad.");
export const actionPadSchema=z.object({id:z.string().uuid(),label:z.string().trim().min(1).max(30),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),bank:z.enum(["A","B","C"]),slot:z.number().int().min(0).max(11),trigger:z.enum(["tap","hold","toggle"]),action:padActionSchema}).strict();
export type ActionPad=z.infer<typeof actionPadSchema>;
export const padViewSchema=actionPadSchema.pick({id:true,label:true,color:true,bank:true,slot:true,trigger:true}).extend({active:z.boolean(),ready:z.boolean()}).strict();
export type PadView=z.infer<typeof padViewSchema>;
export type PadBank="moods"|ActionPad["bank"];
export function defaultPads():ActionPad[]{
 const rows:[string,ActionPad["action"],string,ActionPad["trigger"]][]=[
  ["LIVE",{live:true,power:"none",hands:"none",mode:"NEUTRAL"},"#00eeee","tap"],
  ["HYPE",{mode:"HYPE",hands:"spread"},"#fdcc0d","toggle"],
  ["SHIELD",{mode:"SERIOUS",power:"caryophyllene",hands:"fist"},"#ef9052","hold"],
  ["TECH",{mode:"TECH",power:"alpha-pinene",hands:"point"},"#7ae5d6","toggle"],
  ["TERP BLOOM",{mode:"TERP",power:"linalool",hands:"open"},"#bc8cfa","tap"],
  ["SPECTRUM",{power:"spectrum",mode:"HYPE"},"#fdcc0d","toggle"],
  ["FULL BODY",{camera:"full"},"#73b6ff","tap"],
  ["CLOSE UP",{camera:"bust"},"#73b6ff","tap"],
  ["WTF",{mode:"WTF",hands:"spread"},"#f48bb8","hold"],
  ["OVERLOAD",{overload:true},"#ef9052","tap"],
 ];
 // Stable IDs survive old scene imports and controller reconnection.
 return rows.map(([label,action,color,trigger],slot)=>({id:`00000000-0000-4000-8000-${String(slot+1).padStart(12,"0")}`,label,action,color,trigger,bank:"A",slot}));
}
export function performanceDefaults(){return {model:"",mode:"live" as "live"|"pose"|"clip",frame:emptyFrame(),poses:[] as SavedPose[],clips:[] as PoseClip[],pads:defaultPads(),clip:"",playing:false,time:0,speed:1,loop:true,weight:1,blend:.2,keepFace:true,nonce:0,bank:"A" as PadBank};}
export const performanceSchema=z.object({model:z.string().max(100),mode:z.enum(["live","pose","clip"]),frame:frameSchema,poses:z.array(savedPoseSchema).max(48),clips:z.array(poseClipSchema).max(24),pads:z.array(actionPadSchema).max(36),clip:z.string().max(100),playing:z.boolean(),time:finite.min(0).max(300),speed:finite.min(.1).max(3),loop:z.boolean(),weight:finite.min(0).max(1),blend:finite.min(0).max(2),keepFace:z.boolean(),nonce:z.number().int().min(0).max(1000000000),bank:z.enum(["moods","A","B","C"])}).superRefine((p,ctx)=>{
 const ids=new Set<string>(),slots=new Set<string>();
 for(const item of [...p.poses,...p.clips,...p.pads]){if(ids.has(item.id))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Performance IDs must be unique."});ids.add(item.id);}
 for(const pad of p.pads){const slot=pad.bank+pad.slot;if(slots.has(slot))ctx.addIssue({code:z.ZodIssueCode.custom,message:"A bank slot can contain only one pad."});slots.add(slot);}
 if(new TextEncoder().encode(JSON.stringify(p)).length>900000)ctx.addIssue({code:z.ZodIssueCode.custom,message:"Performance library is over 900 KB. Remove unused keyframes or export a smaller library."});
}).default(performanceDefaults);
export type Performance=z.infer<typeof performanceSchema>;
export const librarySchema=z.object({format:z.literal("sgx-performance-library"),version:z.literal(1),poses:z.array(savedPoseSchema).max(48),clips:z.array(poseClipSchema).max(24),pads:z.array(actionPadSchema).max(36)}).strict();
export function nextNonce(n:number){return (n+1)%1000000000;}
