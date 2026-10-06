import {z} from "zod";
import {MODES,SOURCES,type Landmark,type TrackingFrame} from "../engine/state";
import {padViewSchema} from "../engine/performance-state";
export const HAND_POSES=["none","open","fist","point","spread"] as const;
export const commandSchema=z.discriminatedUnion("type",[
 z.object({type:z.literal("pad"),id:z.string().uuid(),phase:z.enum(["press","release"])}).strict(),
 z.object({type:z.literal("tracking"),hands:z.boolean(),body:z.enum(["off","upper","full"])}).strict(),
 z.object({type:z.literal("mode"),mode:z.enum(MODES)}).strict(),
 z.object({type:z.literal("animation"),name:z.string().min(1).max(200),loop:z.boolean()}).strict(),
 z.object({type:z.literal("power"),id:z.enum(["none","limonene","myrcene","caryophyllene","linalool","terpinolene","humulene","alpha-pinene","beta-pinene","spectrum"])}).strict(),
 z.object({type:z.literal("hand"),side:z.enum(["left","right","both"]),pose:z.enum(HAND_POSES)}).strict(),
 z.object({type:z.literal("freeze"),value:z.boolean()}).strict(),
 z.object({type:z.literal("camera"),frame:z.enum(["bust","full"])}).strict(),
 z.object({type:z.literal("calibrate")}).strict(),z.object({type:z.literal("overload")}).strict(),z.object({type:z.literal("reset")}).strict(),
]);
export type RemoteCommand=z.infer<typeof commandSchema>;
export const envelopeSchema=z.object({id:z.string().uuid(),command:commandSchema,order:z.number().int().min(1).max(1000000000).optional(),epoch:z.string().uuid().optional()}).strict();
export type CommandEnvelope=z.infer<typeof envelopeSchema>;
const coordinate=z.number().finite().min(-10000).max(10000),confidence=z.number().finite().min(0).max(1);
const pointSchema=z.union([z.tuple([coordinate,coordinate,coordinate]),z.tuple([coordinate,coordinate,coordinate,confidence]),z.tuple([coordinate,coordinate,coordinate,confidence,confidence])]);
const bodyPoints=z.union([z.array(pointSchema).length(0),z.array(pointSchema).length(33)]);
const handPoints=z.array(pointSchema).length(21),age=z.number().finite().min(0).max(60000);
const motionSchema=z.object({
 body:z.object({points:bodyPoints,world:bodyPoints,age}).strict().optional(),
 hands:z.object({items:z.array(z.object({side:z.enum(["Left","Right",""]),score:confidence.optional(),points:handPoints,world:handPoints.optional(),aspect:z.number().finite().min(.1).max(10).optional()}).strict()).max(2),age}).strict().optional(),
}).strict();
export const faceSchema=z.object({seq:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),camera:z.boolean(),detected:z.boolean(),signals:z.record(z.enum(SOURCES),z.number().finite().min(-1).max(1)),matrix:z.array(coordinate).length(16).optional(),inference:z.number().finite().min(0).max(60000),motion:motionSchema.optional()}).strict();
export type FacePacket=z.infer<typeof faceSchema>;
export const previewSchema=z.object({seq:z.number().int().nonnegative(),image:z.string().max(24000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)}).strict();
export type PreviewFrame=z.infer<typeof previewSchema>;
const resultSchema=z.object({id:z.string().uuid(),error:z.string().max(300).optional()}).strict();
export const trackingModeSchema=z.object({hands:z.boolean(),body:z.enum(["off","upper","full"])}).strict();
export const snapshotSchema=z.object({model:z.string().max(100),animations:z.array(z.string().max(200)).max(200),mode:z.enum(MODES),power:z.string().max(40),animation:z.string().max(200),frozen:z.boolean(),face:z.boolean(),ready:z.boolean(),hands:z.object({left:z.enum(HAND_POSES),right:z.enum(HAND_POSES)}),pads:z.array(padViewSchema).max(36).default([]),result:resultSchema.optional(),results:z.array(resultSchema).max(64).optional(),preview:previewSchema.optional(),tracking:trackingModeSchema.optional(),performance:z.object({name:z.string().max(60),time:z.number().finite().min(0).max(300),duration:z.number().finite().min(0).max(300),playing:z.boolean()}).strict().optional()}).strict();
export type HostSnapshot=z.infer<typeof snapshotSchema>;
export type Pairing={id:string;token:string;code:string;expires:number};
export type RemoteStatus={connected:boolean;transport:"direct"|"cloud"|"waiting";camera:boolean;error?:string;expired?:boolean;rtt?:number};
export function transportLabel(status:RemoteStatus){return status.connected?(status.transport==="direct"?"Directa":"Nube")+(status.rtt!==undefined?` · ${status.rtt} ms`:""):"Esperando controlador";}
export type SessionView={expires:number;hostSeen:number;controllerSeen:number;controllerId:string|null;now:number;state:HostSnapshot|null;offer:{id:string;sdp:string}|null;answer:{id:string;sdp:string}|null;frame:FacePacket|null;frameUpdated:number;commands:(CommandEnvelope&{seq:number;created:number})[]};
type PackedPoint=z.infer<typeof pointSchema>;
const rounded=(n:number)=>Math.round(n*10000)/10000;
function packPoints(points:Landmark[]):PackedPoint[]{return points.map(p=>{const result:PackedPoint=[rounded(p.x),rounded(p.y),rounded(p.z)];if(p.visibility!==undefined||p.presence!==undefined)result.push(rounded(p.visibility??1));if(p.presence!==undefined)result.push(rounded(p.presence));return result;});}
function unpackPoints(points:PackedPoint[]):Landmark[]{return points.map(([x,y,z,visibility,presence])=>({x,y,z,...(visibility===undefined?{}:{visibility}),...(presence===undefined?{}:{presence})}));}
export function packFace(frame:TrackingFrame,seq:number,camera=true):FacePacket{
 const signals:Record<string,number>={};for(const key of SOURCES){const v=frame.signals[key];if(Number.isFinite(v))signals[key]=Math.max(-1,Math.min(1,v));}
 const detected=camera&&(frame.faceDetected??!!frame.face?.length),motion:NonNullable<FacePacket["motion"]>={};
 const elapsed=(time:number|undefined)=>Math.min(60000,Math.max(0,frame.time-(time??frame.time)));
 if(camera&&frame.pose)motion.body={points:packPoints(frame.pose),world:packPoints(frame.poseWorld||[]),age:elapsed(frame.poseTime)};
 if(camera&&frame.hands)motion.hands={items:frame.hands.map(h=>({side:h.side==="Left"||h.side==="Right"?h.side:"",score:h.score,aspect:h.aspect,points:packPoints(h.points),world:h.world?packPoints(h.world):undefined})),age:elapsed(frame.handTime)};
 return {seq,camera,detected,signals:detected?signals:{leftPinch:signals.leftPinch||0,rightPinch:signals.rightPinch||0},matrix:detected&&frame.matrix?.length===16?Array.from(frame.matrix):undefined,inference:Math.min(60000,Math.max(0,frame.inference||0)),...(Object.keys(motion).length?{motion}:{})};
}
// Video stays on its device. Compact joints carry age, never the sender's clock.
export function unpackFace(packet:FacePacket,now=performance.now()):TrackingFrame{
 const body=packet.camera?packet.motion?.body:undefined,hands=packet.camera?packet.motion?.hands:undefined;
 return {signals:packet.detected?packet.signals:{leftPinch:packet.signals.leftPinch||0,rightPinch:packet.signals.rightPinch||0},matrix:packet.detected?packet.matrix:undefined,faceDetected:packet.detected,face:[],hands:hands?.items.map(h=>({...h,points:unpackPoints(h.points),world:h.world?unpackPoints(h.world):undefined}))||[],handTime:now-(hands?.age||0),pose:body?unpackPoints(body.points):[],poseWorld:body?unpackPoints(body.world):[],poseTime:now-(body?.age||0),time:now,inference:packet.inference};
}
