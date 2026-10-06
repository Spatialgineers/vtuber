import * as T from "three";
import { clamp, type Config, type Landmark, type TrackingFrame } from "./state";
import { metricHandPoints, resolveHandSides, type Hand, type HandSide } from "./hands";
import { RIG_ROLES, type RigMap, type RigRole } from "./rig-roles";
import {LandmarkFilter,landmarkSpan} from "./landmark-filter";
import {FootContacts} from "./grounding";

type Rest = { p: T.Vector3; q: T.Quaternion; s: T.Vector3 };
type Node = { id: string; name: string; bone: boolean };
type Side = "left" | "right";
const sides: Side[] = ["left", "right"];
const fingers = ["Thumb", "Index", "Middle", "Ring", "Little"] as const;
const segments = ["Proximal", "Intermediate", "Distal"] as const;
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^(mixamorig\d*|armature|bip0*1)/, "");
const aliases: Record<string, string[]> = { hips: ["hips", "pelvis", "J_Bip_C_Hips"], spine: ["spine", "spine01", "J_Bip_C_Spine"], chest: ["chest", "spine1", "spine02", "upperChest", "J_Bip_C_Chest"] };
for (const side of sides) {
  const capital = side === "left" ? "Left" : "Right", short = side === "left" ? "L" : "R";
  for (const [role, names] of Object.entries({ Shoulder: ["Shoulder", "Clavicle"], UpperArm: ["UpperArm", "Arm"], LowerArm: ["LowerArm", "ForeArm"], Hand: ["Hand", "Wrist"], UpperLeg: ["UpperLeg", "UpLeg", "Thigh"], LowerLeg: ["LowerLeg", "Leg", "Calf", "Shin"], Foot: ["Foot", "Ankle"], Toes: ["Toes", "ToeBase", "Toe"] })) {
    aliases[side + role] = names.flatMap(name => [capital + name, name + "_" + short, short + "_" + name, "J_Bip_" + short + "_" + name]);
  }
  fingers.forEach(finger => segments.forEach((segment, i) => {
    const variants = finger === "Little" ? ["Little", "Pinky"] : [finger];
    aliases[side + finger + segment] = variants.flatMap(name => [capital + name + segment, capital + "Hand" + name + (i + 1), "J_Bip_" + short + "_" + name + (i + 1), name + "_0" + (i + 1) + "_" + short]);
  }));
}
export function autoRigMapping(nodes: readonly Node[]): RigMap {
  const map: RigMap = {};
  for (const role of RIG_ROLES) {
    for (const alias of aliases[role] || []) {
      const matches = nodes.filter(node => normalize(node.name) === normalize(alias));
      if (matches.length === 1) { map[role] = matches[0].id; break; }
      const bones = matches.filter(node => node.bone);
      if (bones.length === 1) { map[role] = bones[0].id; break; }
    }
  }
  return map;
}
export function visiblePoint(p: Landmark | undefined, confidence: number, normalized = false): p is Landmark {
  return !!p && [p.x, p.y, p.z, p.visibility ?? 1, p.presence ?? 1].every(Number.isFinite) && (p.visibility ?? 1) >= confidence && (p.presence ?? 1) >= confidence && (!normalized || (p.x >= -.08 && p.x <= 1.08 && p.y >= -.08 && p.y <= 1.08));
}
export const POSE_CONNECTIONS = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[27,31],[28,30],[30,32],[28,32]] as const;
export function trackingCoverage(frame: TrackingFrame, confidence = .55, now = performance.now()) {
  const valid = (indices: number[]) => now - (frame.poseTime ?? frame.time) < 700 && indices.every(i => visiblePoint(frame.pose?.[i], confidence, true) && visiblePoint(frame.poseWorld?.[i], confidence));
  return { hands: now - (frame.handTime ?? frame.time) < 700 ? (frame.hands || []).filter(h => h.points.length >= 21 && visiblePoint(h.points[0], confidence, true)).length : 0, torso: valid([11,12]), arms: valid([11,12,13,14,15,16]), legs: valid([23,24,25,26,27,28,31,32]) };
}
function basis(left: T.Vector3, up: T.Vector3) {
  const x = left.clone().normalize(), y = up.clone().addScaledVector(x, -up.dot(x)).normalize();
  if (x.lengthSq() < .9 || y.lengthSq() < .9 || new T.Vector3().crossVectors(left,up).length()<left.length()*up.length()*.12) return undefined;
  const z = new T.Vector3().crossVectors(x, y).normalize();
  return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
}

/** A bind-pose-aware solver; tracking never rewrites geometry or the imported hierarchy. */
export class HumanoidRig {
  bindings: RigMap = {};
  joints = new Map<RigRole, T.Object3D>();
  private positions = new Map<T.Object3D, T.Vector3>();
  private rotations = new Map<T.Object3D, T.Quaternion>();
  private inverseReference = new Map<T.Object3D,T.Matrix4>();
  private directions = new Map<string, T.Vector3>();
  private smooth = new Map<T.Object3D, T.Quaternion>();
  private samples = new Map<T.Object3D,{q:T.Quaternion;time:number;strength:number;channel:"body"|"hand"}>();
  private poseFilter=new LandmarkFilter();
  private handFilters=new Map<HandSide,LandmarkFilter>();
  private filterSpace=new Map<HandSide,boolean>();
  private inputMode="";
  private channel:"body"|"hand"="body";
  private sampleTime=0;
  private now=0;
  private dt=0;
  private inverseParent=new T.Matrix4();
  private frame = new T.Quaternion();
  private actorQ = new T.Quaternion();
  private used = new Set<T.Object3D>();
  private jointRoles=new Map<T.Object3D,RigRole>();
  private alpha = 1;
  private handAlpha = 1;
  private handNodes = new Set<T.Object3D>();
  private fingerNodes = new Map<T.Object3D,number>();
  private handHistory = new Map<HandSide,{point:Landmark;time:number}>();
  private heldHands = new Map<HandSide,{hand:Hand;received:number;time:number}>();
  private lastHandPacket: TrackingFrame["hands"];
  private lastHandTime = -1;
  private forearmTwists = new Map<Side,number>();
  private twistedSides = new Set<Side>();
  private frozen = false;
  private groundOffset = 0;
  private contacts=new FootContacts();
  constructor(private actor: T.Object3D, private nodes: Map<string, T.Object3D>, private rests: Map<T.Object3D, Rest>, auto: RigMap) {
    this.refreshReference();
    this.bind(auto);
  }
  /** Call after applying character dimensions and before animation or live tracking. */
  refreshReference() {
    this.actor.updateMatrixWorld(true);
    const inverse=this.actor.getWorldQuaternion(new T.Quaternion()).invert();
    const actorInverse=this.actor.matrixWorld.clone().invert();
    for(const node of this.nodes.values()) {
      const p=this.positions.get(node)||new T.Vector3(),q=this.rotations.get(node)||new T.Quaternion();
      this.positions.set(node,this.actor.worldToLocal(node.getWorldPosition(p)));
      this.rotations.set(node,node.getWorldQuaternion(q).premultiply(inverse));
      const matrix=this.inverseReference.get(node)||new T.Matrix4();
      this.inverseReference.set(node,matrix.copy(node.matrixWorld).premultiply(actorInverse).invert());
    }
    this.directions.clear();this.referenceFrame();this.refreshContacts();
  }
  bind(map: RigMap) {
    this.bindings = {...map}; this.joints.clear(); this.smooth.clear(); this.samples.clear();this.poseFilter.reset();this.handFilters.clear();this.filterSpace.clear();this.inputMode="";this.directions.clear(); this.groundOffset = 0; this.handNodes.clear(); this.fingerNodes.clear(); this.handHistory.clear(); this.heldHands.clear(); this.lastHandTime=-1; this.lastHandPacket=undefined; this.forearmTwists.clear();
    this.jointRoles.clear();
    for (const role of RIG_ROLES) { const node = this.nodes.get(map[role] || ""); if (node) {this.joints.set(role, node);this.jointRoles.set(node,role);} }
    for(const [role,node] of this.joints) {
      if(role.endsWith("Hand")) this.handNodes.add(node);
      const segment=segments.findIndex(segment=>role.endsWith(segment));
      if(segment>=0){this.handNodes.add(node);this.fingerNodes.set(node,[2.4,1.95,1.7][segment]);}
    }
    this.referenceFrame();this.refreshContacts();
  }
  private refreshContacts(){
    const feet=sides.flatMap(side=>{const foot=this.joints.get((side+"Foot") as RigRole);return foot?[[foot,this.joints.get((side+"Toes") as RigRole)] as const]:[];});
    this.contacts.rebuild(this.actor,feet,this.inverseReference);
  }
  private referenceFrame(){
    const point = (role: RigRole) => this.positions.get(this.joints.get(role)!);
    const left = point("leftUpperArm") || point("leftUpperLeg"), right = point("rightUpperArm") || point("rightUpperLeg");
    const top = point("spine"), bottom = point("hips");
    this.frame = left && right ? basis(left.clone().sub(right), top && bottom && top.distanceTo(bottom) > .001 ? top.clone().sub(bottom) : new T.Vector3(0,1,0)) || new T.Quaternion() : new T.Quaternion();
  }
  private vector(points: Landmark[], from: number, to: number, mirror: boolean, aspect = 1) {
    return new T.Vector3((points[to].x - points[from].x) * (mirror ? -1 : 1), -(points[to].y - points[from].y)/aspect, -(points[to].z - points[from].z));
  }
  private toWorld(direction: T.Vector3) { return direction.clone().applyQuaternion(this.frame).applyQuaternion(this.actorQ).normalize(); }
  private settle(node:T.Object3D,saved:T.Quaternion,desired:T.Quaternion){
    if(!this.frozen){
      const alpha=this.handNodes.has(node)?this.handAlpha:this.alpha,angle=saved.angleTo(desired);
      const speed=this.fingerNodes.has(node)?32:this.handNodes.has(node)?20:14;
      saved.slerp(desired,Math.min(alpha,angle>1e-6?speed*this.dt/angle:1));
    }
    node.quaternion.copy(saved);node.updateWorldMatrix(false,true);
  }
  private apply(node: T.Object3D, target: T.Quaternion, gain = 1, limit = Math.PI, strength=1) {
    const rest = this.rests.get(node); if (!rest || gain<=0) return;
    // Bound exaggeration to a shortest-arc rotation, including values above 1x.
    const delta = target.clone().multiply(rest.q.clone().invert()); if (delta.w < 0) delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
    const angle = 2 * Math.acos(clamp(delta.w,-1,1)), axis = new T.Vector3(delta.x,delta.y,delta.z);
    const desired = axis.lengthSq() > 1e-10 ? new T.Quaternion().setFromAxisAngle(axis.normalize(),Math.min(limit,angle*gain)).multiply(rest.q) : rest.q.clone();
    let saved = this.smooth.get(node); if (!saved) { saved = node.quaternion.clone(); this.smooth.set(node,saved); }
    if(!this.frozen){let sample=this.samples.get(node);if(!sample){sample={q:new T.Quaternion(),time:0,strength:1,channel:this.channel};this.samples.set(node,sample);}sample.q.copy(desired);sample.time=this.sampleTime;sample.strength=strength;sample.channel=this.channel;}
    const age=this.now-this.sampleTime,fade=1-T.MathUtils.smoothstep(age,this.channel==="body"?160:120,this.channel==="body"?500:350);
    desired.slerp(node.quaternion,1-strength*fade);
    this.settle(node,saved,desired);this.used.add(node);
  }
  private orient(role: RigRole, rotation: T.Quaternion, gain: number,strength=1) {
    const node = this.joints.get(role), restWorld = node && this.rotations.get(node); if (!node || !restWorld) return;
    const desired = this.actorQ.clone().multiply(this.frame).multiply(rotation).multiply(this.frame.clone().invert()).multiply(restWorld);
    desired.premultiply(node.parent?.getWorldQuaternion(new T.Quaternion()).invert() || new T.Quaternion()); this.apply(node,desired,gain,Math.PI,strength);
  }
  private aim(role: RigRole, childRole: RigRole | undefined, direction: T.Vector3, gain: number, virtual?: T.Vector3, limit = Math.PI,strength=1) {
    const node = this.joints.get(role), child = childRole && this.joints.get(childRole), rest = node && this.rests.get(node);
    if (!node || !rest || direction.lengthSq() < 1e-8) return;
    const key = role + ":" + childRole; let base = this.directions.get(key);
    if (!base) {
      const b = child && this.positions.get(child),inverse=this.inverseReference.get(node);
      base = b&&inverse ? b.clone().applyMatrix4(inverse) : virtual?.clone();
      if (!base || base.lengthSq() < 1e-8) return; base.normalize(); this.directions.set(key,base);
    }
    const desired = direction.clone();if(node.parent)desired.transformDirection(this.inverseParent.copy(node.parent.matrixWorld).invert());else desired.normalize();
    const bind = base.clone().multiply(node.scale).applyQuaternion(rest.q).normalize(); this.apply(node,new T.Quaternion().setFromUnitVectors(bind,desired).multiply(rest.q),gain,limit,strength);
  }
  private terminalDirection(role: RigRole) {
    const node = this.joints.get(role); if (!node?.parent) return new T.Vector3(0,-1,0);
    const a = this.positions.get(node), b = this.positions.get(node.parent),inverse=this.inverseReference.get(node);
    return a && b && inverse ? a.clone().sub(b).transformDirection(inverse) : new T.Vector3(0,-1,0);
  }
  private reachHand(side: Side, point: Landmark, mirror: boolean, gain: number, aspect: number, pose?: Landmark[], keepElbow = false) {
    const upperRole=(side+"UpperArm") as RigRole,lowerRole=(side+"LowerArm") as RigRole,handRole=(side+"Hand") as RigRole;
    const upper=this.joints.get(upperRole),lower=this.joints.get(lowerRole),hand=this.joints.get(handRole);
    if (!upper||!lower||!hand) return;
    const a=this.positions.get(this.joints.get("leftUpperArm")!),b=this.positions.get(this.joints.get("rightUpperArm")!);
    if (!a||!b) return;
    const center=a.clone().add(b).multiplyScalar(.5),width=a.distanceTo(b);
    // With no reliable elbow, estimate reach from the image instead of replacing a pose solution.
    const shoulders=pose && visiblePoint(pose[11],.35,true) && visiblePoint(pose[12],.35,true);
    const centerX=shoulders?(pose![11].x+pose![12].x)/2:.5,centerY=shoulders?(pose![11].y+pose![12].y)/2:.35;
    const imageWidth=shoulders?Math.max(.08,Math.hypot(pose![11].x-pose![12].x,(pose![11].y-pose![12].y)/aspect)):1/3.5;
    const offset=new T.Vector3((point.x-centerX)*(mirror?-1:1)*width/imageWidth,(centerY-point.y)*width/imageWidth/aspect,width*.3).applyQuaternion(this.frame);
    const target=this.actor.localToWorld(center.add(offset)),shoulder=upper.getWorldPosition(new T.Vector3());
    if(keepElbow){this.aim(lowerRole,handRole,target.clone().sub(lower.getWorldPosition(new T.Vector3())),gain);return;}
    const l1=shoulder.distanceTo(lower.getWorldPosition(new T.Vector3())),l2=lower.getWorldPosition(new T.Vector3()).distanceTo(hand.getWorldPosition(new T.Vector3()));
    if (l1<1e-4||l2<1e-4) return;
    const axis=target.clone().sub(shoulder),distance=clamp(axis.length(),Math.abs(l1-l2)+.001,l1+l2-.001); axis.normalize();
    target.copy(shoulder).addScaledVector(axis,distance);
    const cosine=clamp((l1*l1+distance*distance-l2*l2)/(2*l1*distance),-1,1);
    const pole=this.toWorld(new T.Vector3(side==="left"?.25:-.25,-1,-.25));pole.addScaledVector(axis,-pole.dot(axis)).normalize();
    const elbow=shoulder.clone().addScaledVector(axis,l1*cosine).addScaledVector(pole,l1*Math.sqrt(1-cosine*cosine));
    this.aim(upperRole,lowerRole,elbow.clone().sub(shoulder),gain);
    this.aim(lowerRole,handRole,target.clone().sub(elbow),gain);
  }
  private limitBend(upper:T.Vector3,lower:T.Vector3,limit:number){
    const angle=upper.angleTo(lower);if(angle<=limit)return lower;
    return upper.clone().applyQuaternion(new T.Quaternion().setFromUnitVectors(upper,lower).slerp(new T.Quaternion(),1-limit/angle));
  }
  private sampleEnabled(node:T.Object3D,channel:"body"|"hand",g:Config["tracking"]){
    const role=this.jointRoles.get(node)||"";
    if(channel==="hand")return g.hands&&g.handsGain>0&&(role.endsWith("Hand")?g.wristGain>0:this.fingerNodes.has(node)?g.fingerGain>0:true);
    return g.pose&&g.body>0&&(/Arm|Shoulder/.test(role)?g.arms>0:/Leg|Foot|Toes/.test(role)?g.bodyMode==="full"&&g.legs>0:role!=="hips"||g.bodyMode==="full");
  }
  update(c: Config, data: { pose?: Landmark[]; poseWorld?: Landmark[]; hands?: TrackingFrame["hands"]; lastPose: number; lastHands: number }, now: number, dt: number) {
    const g = c.tracking;this.now=now;this.dt=clamp(dt,0,.1);this.frozen = c.frozen;
    this.alpha = 1-Math.exp(-this.dt/(.009+g.smoothing*g.smoothing*.018)); this.handAlpha=1-Math.exp(-this.dt/(.008+g.handSmoothing*g.handSmoothing*.018)); this.used.clear(); this.twistedSides.clear();
    const mode=`${g.mirror}:${g.pose}:${g.hands}:${g.bodyMode}`;
    if(mode!==this.inputMode){
      // Animation immediately owns disabled body parts when changing driver/mode.
      for(const[node,sample]of this.samples)if(!this.sampleEnabled(node,sample.channel,g))this.smooth.delete(node);
      this.poseFilter.reset();this.handFilters.clear();this.filterSpace.clear();this.handHistory.clear();this.heldHands.clear();this.samples.clear();this.lastHandTime=-1;this.lastHandPacket=undefined;this.inputMode=mode;
    }
    if(!g.pose||g.bodyMode!=="full"||!g.groundFeet)this.groundOffset=0;
    this.actor.updateMatrixWorld(true); this.actorQ = this.actor.getWorldQuaternion(new T.Quaternion());
    this.channel="body";this.sampleTime=data.lastPose;
    const raw=data.poseWorld||[],p=c.frozen?raw:this.poseFilter.update(raw,data.lastPose,g.smoothing,landmarkSpan(raw,11,12,.5),g.confidence);
    const valid = (indices: number[]) => g.pose && (c.frozen || now-data.lastPose < 500) && indices.every(i => visiblePoint(p[i],g.confidence) && visiblePoint(data.pose?.[i],g.confidence,true));
    const weight=(indices:number[])=>{let score=1;for(const i of indices)score=Math.min(score,p[i]?.visibility??1,p[i]?.presence??1,data.pose?.[i]?.visibility??1,data.pose?.[i]?.presence??1);return T.MathUtils.smoothstep(score,g.confidence-.12,Math.min(1,g.confidence+.22));};
    const source = (side: Side, left: number) => left + ((side === "left") !== g.mirror ? 0 : 1);
    const direction = (side: Side, a: number, b: number) => this.toWorld(this.vector(p,source(side,a),source(side,b),g.mirror));
    let legsValid = false;
    if (g.bodyMode === "full" && valid([23,24])) {
      const pelvis = basis(this.vector(p,source("right",23),source("left",23),g.mirror),new T.Vector3(0,1,0));
      if (pelvis) this.orient("hips",pelvis,g.body,weight([23,24]));
    }
    if (valid([11,12])) {
      const leftIndex = source("left",11), rightIndex = source("right",11), across = this.vector(p,rightIndex,leftIndex,g.mirror);
      const up = valid([23,24]) ? new T.Vector3((p[11].x+p[12].x-p[23].x-p[24].x)*(g.mirror?-1:1),-(p[11].y+p[12].y-p[23].y-p[24].y),-(p[11].z+p[12].z-p[23].z-p[24].z)) : new T.Vector3(0,1,0);
      const strength=weight([11,12]),torso = basis(across,up); if (torso) { this.orient("spine",torso,g.body,strength); this.orient("chest",torso,g.body,strength); }
      for (const side of sides) this.aim((side+"Shoulder") as RigRole,(side+"UpperArm") as RigRole,this.toWorld(across.clone().multiplyScalar(side==="left"?1:-1)),g.body*g.arms,undefined,g.bodyLimits?.6:Math.PI,strength);
    }
    for (const side of sides) {
      const a=source(side,11),b=source(side,13),w=source(side,15);
      if (valid([a,b])) this.aim((side+"UpperArm") as RigRole,(side+"LowerArm") as RigRole,direction(side,11,13),g.body*g.arms,undefined,Math.PI,weight([a,b]));
      if (valid([b,w])) {
        const lower=direction(side,13,15),target=g.bodyLimits&&valid([a,b])?this.limitBend(direction(side,11,13),lower,2.85):lower;
        this.aim((side+"LowerArm") as RigRole,(side+"Hand") as RigRole,target,g.body*g.arms,undefined,g.bodyLimits?2.85:Math.PI,weight([b,w]));
      }
      if (g.bodyMode === "full") {
        const h=source(side,23),k=source(side,25),ankle=source(side,27),toe=source(side,31);
        if (valid([h,k])) this.aim((side+"UpperLeg") as RigRole,(side+"LowerLeg") as RigRole,direction(side,23,25),g.body*g.legs,undefined,Math.PI,weight([h,k]));
        if (valid([k,ankle])) {
          const lower=direction(side,25,27),target=g.bodyLimits&&valid([h,k])?this.limitBend(direction(side,23,25),lower,2.7):lower;
          this.aim((side+"LowerLeg") as RigRole,(side+"Foot") as RigRole,target,g.body*g.legs,undefined,g.bodyLimits?2.85:Math.PI,weight([k,ankle]));
        }
        if (valid([ankle,toe])) this.aim((side+"Foot") as RigRole,(side+"Toes") as RigRole,direction(side,27,31),g.body*g.legs,new T.Vector3(0,0,1),g.bodyLimits?1.6:Math.PI,weight([ankle,toe]));
        legsValid ||= valid([h,k,ankle,toe]);
      }
    }
    const freshPose=now-data.lastPose<700?data.pose:undefined;
    if(!c.frozen && (data.lastHands!==this.lastHandTime || data.hands!==this.lastHandPacket)) {
      this.lastHandTime=data.lastHands;this.lastHandPacket=data.hands;
      if(now-data.lastHands<450) for(const [side,hand] of resolveHandSides(data.hands||[],freshPose,this.handHistory,now)) {
        this.heldHands.set(side,{hand,received:now,time:data.lastHands});this.handHistory.set(side,{point:hand.points[0],time:now});
      }
    }
    if (g.hands) for(const [physical,{hand,received,time}] of this.heldHands) {
      const current=(data.hands||[]).includes(hand) && now-data.lastHands<450;
      if(!c.frozen && !current && now-received>140) continue;
      const side:Side=g.mirror?(physical==="left"?"right":"left"):physical;
      this.channel="hand";this.sampleTime=time;
      const upperValid=valid([source(side,11),source(side,13)]),lowerValid=valid([source(side,13),source(side,15)]);
      if(!lowerValid) this.reachHand(side,hand.points[0],g.mirror,g.handsGain,hand.aspect||4/3,freshPose,upperValid);
      const metric=metricHandPoints(hand),aspect=metric.aspect,isWorld=metric.points===hand.world;
      let filter=this.handFilters.get(physical);if(!filter){filter=new LandmarkFilter();this.handFilters.set(physical,filter);}
      if(this.filterSpace.get(physical)!==isWorld){filter.reset();this.filterSpace.set(physical,isWorld);}
      const points=c.frozen||hand.locked?metric.points:filter.update(metric.points,time,g.handSmoothing,landmarkSpan(metric.points,0,9,isWorld?.08:.12));
      if(!points.every(point=>visiblePoint(point,0))) continue;
      const wristRole=(side+"Hand") as RigRole,wrist=this.joints.get(wristRole);
      if(wrist) {
        const index=this.joints.get((side+"IndexProximal") as RigRole),little=this.joints.get((side+"LittleProximal") as RigRole),middle=this.joints.get((side+"MiddleProximal") as RigRole);
        const a=index&&this.positions.get(index),b=little&&this.positions.get(little),m=middle&&this.positions.get(middle),origin=this.positions.get(wrist),q=this.rotations.get(wrist);
        if(a&&b&&m&&origin&&q) {
          const bind=basis(a.clone().sub(b).applyQuaternion(q.clone().invert()),m.clone().sub(origin).applyQuaternion(q.clone().invert()));
          const live=basis(this.toWorld(this.vector(points,17,5,g.mirror,aspect)),this.toWorld(this.vector(points,0,9,g.mirror,aspect)));
          if(bind&&live) {
            const desiredWorld=live.multiply(bind.invert());
            this.twistForearm(side,wrist,desiredWorld,g.handsGain*g.wristGain);
            const target=desiredWorld.clone().premultiply(wrist.parent?.getWorldQuaternion(new T.Quaternion()).invert()||new T.Quaternion());
            this.apply(wrist,target,g.handsGain*g.wristGain,g.fingerLimits?1.55:Math.PI);
          }
        }
      }
      fingers.forEach((finger,i)=>segments.forEach((segment,j)=>{
        const first=i===0?1:5+(i-1)*4,role=(side+finger+segment) as RigRole,next=j<2?(side+finger+segments[j+1]) as RigRole:undefined;
        this.aim(role,next,this.toWorld(this.vector(points,first+j,first+j+1,g.mirror,aspect)),g.handsGain*g.fingerGain,this.terminalDirection(role),g.fingerLimits?[2.4,1.95,1.7][j]:Math.PI);
      }));
    }
    // Lost or occluded joints smoothly return to the current animation/rest pose.
    for (const [node,saved] of this.smooth) if (!this.used.has(node)) {
      const sample=this.samples.get(node),age=sample?now-sample.time:Infinity;
      if(sample&&this.sampleEnabled(node,sample.channel,g)&&age<(sample.channel==="body"?500:350)){
        const strength=sample.strength*(1-T.MathUtils.smoothstep(age,sample.channel==="body"?160:120,sample.channel==="body"?500:350));
        this.settle(node,saved,sample.q.clone().slerp(node.quaternion,1-strength));
      }else this.settle(node,saved,node.quaternion);
    }
    for(const [side,angle] of this.forearmTwists) if(!this.twistedSides.has(side)) {
      const next=c.frozen?angle:angle+clamp(-angle*(1-Math.exp(-this.dt/.08)),-12*this.dt,12*this.dt);this.forearmTwists.set(side,next);this.rollForearm(side,next);
    }
    this.ground(c,legsValid,dt);
  }
  private rollForearm(side:Side, angle:number) {
    const lower=this.joints.get((side+"LowerArm") as RigRole),hand=this.joints.get((side+"Hand") as RigRole);
    if(!lower||!hand)return;
    const axis=hand.getWorldPosition(new T.Vector3()).sub(lower.getWorldPosition(new T.Vector3())).normalize();
    const world=lower.getWorldQuaternion(new T.Quaternion()).premultiply(new T.Quaternion().setFromAxisAngle(axis,angle));
    lower.quaternion.copy(world.premultiply(lower.parent?.getWorldQuaternion(new T.Quaternion()).invert()||new T.Quaternion()));lower.updateWorldMatrix(false,true);
  }
  private twistForearm(side:Side,wrist:T.Object3D,desired:T.Quaternion,gain:number) {
    const lower=this.joints.get((side+"LowerArm") as RigRole),rest=this.rests.get(wrist);if(!lower||!rest)return;
    const baseline=lower.getWorldQuaternion(new T.Quaternion()).multiply(rest.q),delta=desired.clone().multiply(baseline.invert());
    if(delta.w<0)delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
    const axis=wrist.getWorldPosition(new T.Vector3()).sub(lower.getWorldPosition(new T.Vector3())).normalize();
    const projection=new T.Vector3(delta.x,delta.y,delta.z).dot(axis);
    const target=clamp(2*Math.atan2(projection,delta.w)*.7*gain,-2.5,2.5),previous=this.forearmTwists.get(side)||0;
    const difference=Math.atan2(Math.sin(target-previous),Math.cos(target-previous));
    const angle=this.frozen?previous:previous+clamp(difference*this.handAlpha,-12*this.dt,12*this.dt);
    this.forearmTwists.set(side,angle);this.twistedSides.add(side);this.rollForearm(side,angle);
  }
  private ground(c: Config, valid: boolean, dt: number) {
    const hips=this.joints.get("hips"); if (!hips || !this.rests.has(hips)) return;
    let target=0;
    if (c.tracking.groundFeet && c.tracking.pose && c.tracking.bodyMode==="full" && (valid||this.contacts.size>0)) {
      const feet=[this.joints.get("leftFoot"),this.joints.get("rightFoot"),this.joints.get("leftToes"),this.joints.get("rightToes")].filter((node):node is T.Object3D=>!!node);
      const heights=feet.map(foot=>foot.getWorldPosition(new T.Vector3()).y),bind=feet.map(foot=>this.actor.localToWorld(this.positions.get(foot)!.clone()).y);
      if (heights.length) target=this.contacts.correction(this.actor)??Math.min(...bind)-Math.min(...heights);
    }
    if (!c.frozen){
      this.groundOffset=T.MathUtils.lerp(this.groundOffset,target,1-Math.exp(-dt/.05));
      // Resolve penetration promptly; the input joints already have adaptive damping.
      if(this.contacts.size&&c.tracking.groundFeet&&c.tracking.pose&&c.tracking.bodyMode==="full")this.groundOffset=Math.max(this.groundOffset,target-.003*this.actor.getWorldScale(new T.Vector3()).y);
    }
    const world=hips.getWorldPosition(new T.Vector3());world.y+=this.groundOffset;
    hips.position.copy(hips.parent?hips.parent.worldToLocal(world):world); hips.updateWorldMatrix(false,true);
  }
  headRotation(node: T.Object3D, delta: T.Quaternion) {
    const bind=this.rotations.get(node); if (!bind) return;
    const target=this.actor.getWorldQuaternion(new T.Quaternion()).multiply(this.frame).multiply(delta).multiply(this.frame.clone().invert()).multiply(bind);
    node.quaternion.copy(target.premultiply(node.parent?.getWorldQuaternion(new T.Quaternion()).invert()||new T.Quaternion())); node.updateWorldMatrix(false,true);
  }
}
