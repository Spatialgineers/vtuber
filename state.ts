import { z } from "zod";
import { RIG_ROLES } from "./rig-roles";
import {performanceSchema,performanceDefaults,frameSchema} from "./performance-state";

export const SOURCES = ["mouthOpen", "smile", "frown", "browUp", "browDown", "blinkLeft", "blinkRight", "lookX", "lookY", "headX", "headY", "headZ", "audio", "bass", "mid", "treble", "leftPinch", "rightPinch", "jawOpen", "mouthSmileLeft", "mouthSmileRight", "eyeBlinkLeft", "eyeBlinkRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight", "browDownLeft", "browDownRight", "mouthFrownLeft", "mouthFrownRight", "eyeWideLeft", "eyeWideRight", "eyeSquintLeft", "eyeSquintRight", "mouthPucker", "mouthFunnel", "mouthLeft", "mouthRight", "mouthClose", "mouthRollLower", "mouthRollUpper", "mouthShrugLower", "mouthShrugUpper", "noseSneerLeft", "noseSneerRight", "cheekPuff", "cheekSquintLeft", "cheekSquintRight", "eyeLookInLeft", "eyeLookInRight", "eyeLookOutLeft", "eyeLookOutRight", "eyeLookUpLeft", "eyeLookUpRight", "eyeLookDownLeft", "eyeLookDownRight", "jawLeft", "jawRight", "jawForward", "mouthDimpleLeft", "mouthDimpleRight", "mouthPressLeft", "mouthPressRight", "mouthStretchLeft", "mouthStretchRight", "mouthUpperUpLeft", "mouthUpperUpRight", "mouthLowerDownLeft", "mouthLowerDownRight"] as const;
export type Signals = Record<string, number>;
export type Landmark = { x: number; y: number; z: number; visibility?: number; presence?: number };
export type TrackingFrame = { signals: Signals; matrix?: number[]; faceDetected?: boolean; face?: Landmark[]; hands?: { side: string; points: Landmark[]; world?: Landmark[]; score?: number; aspect?: number; locked?: boolean }[]; handTime?: number; pose?: Landmark[]; poseWorld?: Landmark[]; poseTime?: number; inference: number; time: number };
export const MODES = ["NEUTRAL", "HYPE", "SERIOUS", "WTF", "TERP", "TECH"] as const;
export type Mode = typeof MODES[number];
export const mapSchema = z.object({ id: z.string().max(100), source: z.enum(SOURCES), kind: z.enum(["morph", "rotateX", "rotateY", "rotateZ", "scale", "scaleX", "scaleY", "scaleZ", "translateX", "translateY", "translateZ", "emission", "visibility"]), target: z.string().max(300), gain: z.number().min(-4).max(4), offset: z.number().min(-1).max(1), enabled: z.boolean() });
export type Mapping = z.infer<typeof mapSchema>;
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export function robotDefaults(){return {armor:"#fdcc0d",metal:"#d2d6db",dark:"#0d1520",eyes:"#00eeee",mouth:"#00eeee",energy:"#00eeee",eyeGlow:1.4,mouthGlow:1.4,energyGlow:1.4,metalness:1,roughness:1,headScale:1,eyeWidth:1,eyeHeight:1,mouthWidth:1,jawMotion:1,helmet:true,antenna:true,halo:true,sigil:true,headStyle:"classic" as "classic"|"round"|"box",eyeStyle:"bar" as "bar"|"round"|"diamond",antennaStyle:"antenna" as "antenna"|"horns"|"ears",armLength:1,armWidth:1,legLength:1,legWidth:1,handSize:1,handWidth:1,footSize:1,bodyWidth:1,bodyHeight:1,shoulderWidth:1,hipWidth:1,pose:{} as Record<string,[number,number,number]>};}
const degrees=z.number().min(-180).max(180);
export const robotSchema=z.object({armor:color,metal:color,dark:color,eyes:color,mouth:color,energy:color,eyeGlow:z.number().min(0).max(4),mouthGlow:z.number().min(0).max(4),energyGlow:z.number().min(0).max(4),metalness:z.number().min(0).max(1),roughness:z.number().min(.2).max(3),headScale:z.number().min(.5).max(2),eyeWidth:z.number().min(.5).max(2),eyeHeight:z.number().min(.5).max(2),mouthWidth:z.number().min(.5).max(2),jawMotion:z.number().min(0).max(2),helmet:z.boolean(),antenna:z.boolean(),halo:z.boolean(),sigil:z.boolean(),headStyle:z.enum(["classic","round","box"]).default("classic"),eyeStyle:z.enum(["bar","round","diamond"]).default("bar"),antennaStyle:z.enum(["antenna","horns","ears"]).default("antenna"),armLength:z.number().finite().min(.5).max(2).default(1),armWidth:z.number().finite().min(.5).max(2).default(1),legLength:z.number().finite().min(.5).max(2).default(1),legWidth:z.number().finite().min(.5).max(2).default(1),handSize:z.number().finite().min(.5).max(2).default(1),handWidth:z.number().finite().min(.5).max(2).default(1),footSize:z.number().finite().min(.5).max(2).default(1),bodyWidth:z.number().finite().min(.5).max(2).default(1),bodyHeight:z.number().finite().min(.5).max(2).default(1),shoulderWidth:z.number().finite().min(.5).max(2).default(1),hipWidth:z.number().finite().min(.5).max(2).default(1),pose:z.record(z.string().min(1).max(100),z.tuple([degrees,degrees,degrees])).refine(p=>Object.keys(p).length<=80,"Too many robot bone offsets.")}).default(robotDefaults);
const baseConfigSchema = z.object({
  version: z.literal(1), name: z.string().min(1).max(100), mode: z.enum(MODES), demo: z.boolean(), frozen: z.boolean(),
  tracking: z.object({ head: z.number().min(0).max(3), eyes: z.number().min(0).max(3), blink: z.number().min(0).max(3), mouth: z.number().min(0).max(3), smile: z.number().min(0).max(3), brows: z.number().min(0).max(3), handsGain: z.number().min(0).max(3), wristGain: z.number().min(0).max(3).default(1), fingerGain: z.number().min(0).max(3).default(1), handSmoothing: z.number().min(0).max(.95).default(.28), fingerLimits: z.boolean().default(true), bodyLimits: z.boolean().default(true), body: z.number().min(0).max(3), smoothing: z.number().min(0).max(.95), mirror: z.boolean(), hands: z.boolean(), pose: z.boolean(), rate: z.number().min(10).max(30), bodyMode: z.enum(["upper", "full"]).default("upper"), arms: z.number().min(0).max(3).default(1), legs: z.number().min(0).max(3).default(1), confidence: z.number().min(.1).max(.95).default(.55), groundFeet: z.boolean().default(true), overlay: z.boolean().default(true) }),
  audio: z.object({ gain: z.number().min(0).max(10), gate: z.number().min(0).max(.2), jaw: z.number().min(0).max(3), glow: z.number().min(0).max(3), particles: z.number().min(0).max(3) }),
  avatar: z.object({ scale: z.number().min(.1).max(3), y: z.number().min(-3).max(3), yaw: z.number().min(-180).max(180), color: color, tint: z.boolean(), wireframe: z.boolean(), animation: z.string().max(200), animationSpeed: z.number().min(0).max(3), hidden: z.array(z.string().max(300)).max(500), headBone: z.string().max(300), rigMap: z.record(z.enum(RIG_ROLES), z.string().max(300)).default({}), character: z.enum(["sgx", "highcoon-classic", "highcoon-full-spectrum", "custom"]).default("sgx"), motionMode: z.enum(["tracking", "animation", "hybrid"]).default("tracking"), animationLoop: z.boolean().default(true), animationNonce: z.number().int().min(0).max(1000000000).default(0), transition: z.number().min(0).max(1).default(.2) }),
  face: z.object({enabled:z.boolean(),speech:z.number().min(0).max(2),squash:z.number().min(0).max(2),cheeks:z.number().min(0).max(2),brows:z.number().min(0).max(2),blink:z.number().min(0).max(2)}).default({enabled:true,speech:1,squash:1,cheeks:1,brows:1,blink:1}),
  robot:robotSchema,
  performance:performanceSchema,
  puppet: z.object({left:z.enum(["none","open","fist","point","spread"]),right:z.enum(["none","open","fist","point","spread"])}).default({left:"none",right:"none"}),
  power: z.object({id:z.enum(["none","limonene","myrcene","caryophyllene","linalool","terpinolene","humulene","alpha-pinene","beta-pinene","spectrum"]),intensity:z.number().min(0).max(2),reactivity:z.number().min(0).max(2)}).default({id:"none",intensity:1,reactivity:1}),
  world: z.object({ type: z.enum(["studio", "grid", "orbit", "garden", "solid", "chroma", "transparent", "image", "video", "custom"]), color: color, accent: color, light: z.number().min(0).max(5), fog: z.number().min(0).max(.25), rotation: z.number().min(-180).max(180), scale: z.number().min(.1).max(5), y: z.number().min(-5).max(5), particles: z.number().min(0).max(1), speed: z.number().min(0).max(3) }),
  fx: z.object({ bloom: z.number().min(0).max(2), chromatic: z.number().min(0).max(.03), pixel: z.number().min(1).max(16), glitch: z.number().min(0).max(1), vignette: z.number().min(0).max(1), exposure: z.number().min(.1).max(3), saturation: z.number().min(0).max(2), grain: z.number().min(0).max(.2) }),
  output: z.object({ resolution: z.enum(["720", "1080", "1440"]), fps: z.enum(["24", "30", "60"]), quality: z.enum(["performance", "balanced", "ultra"]) }),
  camera: z.object({position:z.tuple([z.number().min(-100).max(100),z.number().min(-100).max(100),z.number().min(-100).max(100)]),target:z.tuple([z.number().min(-100).max(100),z.number().min(-100).max(100),z.number().min(-100).max(100)])}).default({position:[0,2.45,5.2],target:[0,2.12,0]}),
  mappings: z.array(mapSchema).max(150),
});
export const characterCursorSchema=z.object({model:z.string().max(100),mode:z.enum(["live","pose","clip"]),frame:frameSchema,clip:z.string().max(100),time:z.number().finite().min(0).max(300),loop:z.boolean(),speed:z.number().min(.1).max(3),keepFace:z.boolean(),weight:z.number().min(0).max(1),blend:z.number().min(0).max(2)}).strict();
export const savedCharacterSchema=z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(60),asset:z.string().uuid().nullable(),robot:robotSchema,avatar:baseConfigSchema.shape.avatar,face:baseConfigSchema.shape.face,power:baseConfigSchema.shape.power,mappings:baseConfigSchema.shape.mappings,cursor:characterCursorSchema}).strict().superRefine((p,ctx)=>{if(p.avatar.character==="custom"&&!p.asset)ctx.addIssue({code:z.ZodIssueCode.custom,message:"Save the custom model asset before saving its character."});});
export type SavedCharacter=z.infer<typeof savedCharacterSchema>;
export const characterLibrarySchema=z.object({selected:z.string().uuid().nullable(),items:z.array(savedCharacterSchema).max(24)}).strict().superRefine((v,ctx)=>{if(v.selected&&!v.items.some(p=>p.id===v.selected))ctx.addIssue({code:z.ZodIssueCode.custom,message:"The selected character must exist in the library."});if(new Set(v.items.map(p=>p.id)).size!==v.items.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:"Character IDs must be unique."});if(new TextEncoder().encode(JSON.stringify(v)).length>250000)ctx.addIssue({code:z.ZodIssueCode.custom,message:"Character library exceeds 250 KB. Export unused characters."});}).default(()=>({selected:null,items:[]}));
export const configSchema=baseConfigSchema.extend({characters:characterLibrarySchema});
export type Config = z.infer<typeof configSchema>;
export function robotPartFlag(name:string):"helmet"|"antenna"|"halo"|"sigil"|undefined{if(name==="HELMET")return "helmet";if(name.startsWith("ANTENNA_"))return "antenna";if(name==="FX_HALO")return "halo";if(name==="CHEST_SIGIL")return "sigil";}
export function defaults(): Config { return {
  characters:{selected:null,items:[]},version: 1, name: "Untitled performance", mode: "NEUTRAL", demo: false, frozen: false,
  tracking: { head: .8, eyes: 1, blink: 1, mouth: 1.2, smile: 1.2, brows: 1, handsGain: 1, wristGain: 1, fingerGain: 1, handSmoothing: .28, fingerLimits: true, bodyLimits: true, body: 1, smoothing: .55, mirror: true, hands: true, pose: true, rate: 24, bodyMode: "upper", arms: 1, legs: 1, confidence: .55, groundFeet: true, overlay: true },
  audio: { gain: 3, gate: .018, jaw: .75, glow: .65, particles: .8 },
  avatar: { scale: 1, y: 0, yaw: 0, color: "#fdcc0d", tint: false, wireframe: false, animation: "none", animationSpeed: 1, hidden: [], headBone: "auto", rigMap: {}, character:"sgx",motionMode:"tracking",animationLoop:true,animationNonce:0,transition:.2 },
  face:{enabled:true,speech:1,squash:1,cheeks:1,brows:1,blink:1},robot:robotDefaults(),performance:performanceDefaults(),puppet:{left:"none",right:"none"},power:{id:"none",intensity:1,reactivity:1},
  world: { type: "studio", color: "#071019", accent: "#00eeee", light: 1.5, fog: .025, rotation: 0, scale: 1, y: 0, particles: .25, speed: .5 },
  fx: { bloom: .3, chromatic: .001, pixel: 1, glitch: 0, vignette: .3, exposure: 1, saturation: 1, grain: .015 },
  output: { resolution: "1080", fps: "30", quality: "balanced" }, camera:{position:[0,2.45,5.2],target:[0,2.12,0]}, mappings: []
}; }
export function parseConfig(value: unknown) { return configSchema.parse(value); }
export function clamp(n: number, a = 0, b = 1) { return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : a; }
export function sourceSignals(raw: Signals): Signals {
  const s: Signals = {};
  for (const [k,v] of Object.entries(raw)) s[k] = clamp(v, k.startsWith("head") || k.startsWith("look") ? -1 : 0, 1);
  s.mouthOpen = s.jawOpen || 0; s.smile = ((s.mouthSmileLeft || 0) + (s.mouthSmileRight || 0)) / 2;
  s.frown = ((s.mouthFrownLeft || 0) + (s.mouthFrownRight || 0)) / 2;
  s.browUp = Math.max(s.browInnerUp || 0, ((s.browOuterUpLeft || 0) + (s.browOuterUpRight || 0)) / 2);
  s.browDown = ((s.browDownLeft || 0) + (s.browDownRight || 0)) / 2;
  s.blinkLeft = s.eyeBlinkLeft || 0; s.blinkRight = s.eyeBlinkRight || 0;
  s.lookX = ((s.eyeLookOutLeft || 0) + (s.eyeLookInRight || 0) - (s.eyeLookInLeft || 0) - (s.eyeLookOutRight || 0)) / 2;
  s.lookY = ((s.eyeLookUpLeft || 0) + (s.eyeLookUpRight || 0) - (s.eyeLookDownLeft || 0) - (s.eyeLookDownRight || 0)) / 2;
  return s;
}
export function demoSignals(t: number): Signals {
  const blink = Math.pow(Math.max(0, Math.sin(t * 1.65)), 40);
  return { mouthOpen: .15 + Math.max(0, Math.sin(t*3.4))*.5, smile: .35 + Math.sin(t*.7)*.25, blinkLeft: blink, blinkRight: blink, browUp: Math.max(0, Math.sin(t*.65))*.4, browDown: 0, frown: 0, headX: Math.sin(t*.7)*.12, headY: Math.sin(t*.5)*.35, headZ: Math.sin(t*.8)*.08, lookX: Math.sin(t*.7)*.6, lookY: Math.cos(t*.4)*.2 };
}
export const morphAliases: Record<string, string[]> = {
  blinkLeft: ["Blink_L", "eyeBlinkLeft", "blinkLeft", "BlinkLeft", "EyeBlink_L"], blinkRight: ["Blink_R", "eyeBlinkRight", "blinkRight", "BlinkRight", "EyeBlink_R"],
  mouthOpen: ["Mouth_Open", "jawOpen", "mouthOpen", "Jaw_Open", "viseme_aa", "A"], smile: ["Smile", "mouthSmileLeft", "mouthSmileRight", "Happy", "Joy"],
  frown: ["Frown", "mouthFrownLeft", "mouthFrownRight", "Sad"], browUp: ["Brow_Up", "browInnerUp", "browOuterUpLeft", "browOuterUpRight"], browDown: ["Brow_Down", "browDownLeft", "browDownRight"],
  lookX: ["Eye_Look_Right"], lookY: ["Eye_Look_Up"]
};
export function normalizedName(n: string) { return n.toLowerCase().replace(/[^a-z0-9]/g, ""); }
export function autoMappings(morphs: string[]): Mapping[] {
  const results: Mapping[] = [];
  for (const target of morphs) {
    const name = target.split("::").at(-1) || target;
    const exact = SOURCES.find(s => normalizedName(s) === normalizedName(name));
    const alias = Object.entries(morphAliases).find(([, names])=>names.some(x=>normalizedName(x)===normalizedName(name)))?.[0];
    const source = exact || alias;
    if (source) results.push({ id: crypto.randomUUID(), source: source as Mapping["source"], kind:"morph", target, gain:1, offset:0, enabled:true });
  }
  return results;
}
export function mappingValue(m: Mapping, s: Signals) { return clamp((s[m.source] || 0)*m.gain + m.offset, m.kind.startsWith("rotate") ? -Math.PI : m.kind.startsWith("scale")?-.95:m.kind.startsWith("translate")?-1:0, m.kind.startsWith("rotate") ? Math.PI : m.kind.startsWith("scale") ? 3 : 1); }

// Native rig upgrades change traversal indices. Rebind only unambiguous names.
export function rebindConfig(c: Config, nodes: string[], morphs: string[]): Config {
  const resolve = (id: string, targets: string[]) => {
    if (targets.includes(id)) return id;
    const key = (s: string) => s.replace(/ \[\d+\](?=::|$)/, "");
    const matches = targets.filter(target => key(target) === key(id));
    return matches.length === 1 ? matches[0] : id;
  };
  return {...c, avatar: {...c.avatar, hidden: c.avatar.hidden.map(id => resolve(id, nodes)), headBone: resolve(c.avatar.headBone, nodes), rigMap: Object.fromEntries(Object.entries(c.avatar.rigMap).map(([role,id]) => [role,resolve(id, nodes)]))}, mappings: c.mappings.map(m => ({...m, target: resolve(m.target, m.kind === "morph" ? morphs : nodes)}))};
}
