import * as T from "three";
import {clamp,robotDefaults,robotSchema,type Config,type Signals} from "./state";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
type Slot="armor"|"metal"|"dark"|"eyes"|"mouth"|"energy";
const slots:Slot[]=["armor","metal","dark","eyes","mouth","energy"];

/** The original mechanical robot: rigid parts follow real joints; morphs keep its energy face. */
export class RobotRig {
  available=false;
  bones=new Map<string,T.Object3D>();
  private parts=new Map<string,T.Object3D[]>();
  private surfaces=new Map<T.MeshStandardMaterial,{slot:Slot;metalness:number;roughness:number}>();
  private marker?:T.Object3D;
  private styles="";
  private tint=new T.Color();
  constructor(root:T.Object3D){
    root.traverse(o=>{if(o.userData.sgxRobot===true){this.available=true;this.marker=o;}});
    if(!this.available)return;
    root.traverse(o=>{if((o as T.Bone).isBone)this.bones.set(o.name,o);if((o as T.Mesh).isMesh){this.parts.set(o.name,[...(this.parts.get(o.name)||[]),o]);const m=(o as T.Mesh).material;for(const mat of Array.isArray(m)?m:[m]){const p=mat as T.MeshStandardMaterial,slot=(p.userData.sgxRobotSlot||p.name.replace(/^SGX_ROBOT_/,"").toLowerCase()) as Slot;if(p.isMeshStandardMaterial&&slots.includes(slot))this.surfaces.set(p,{slot,metalness:p.metalness,roughness:p.roughness});}}});
  }
  shape(c:Config){
    if(!this.available)return;const r=c.robot;
    this.bones.get("head")?.scale.multiplyScalar(r.headScale);
    const hips=this.bones.get("hips");if(hips)hips.position.y+=1.16*(r.legLength-1)+.09*(r.footSize-1);
    const chest=this.bones.get("chest");if(chest)chest.position.y*=r.bodyHeight;
    for(const side of ["Left","Right"]){
      const eye=this.bones.get("eye"+side);if(eye){eye.scale.x*=r.eyeWidth;eye.scale.y*=r.eyeHeight;}
      const shoulder=this.bones.get(side+"Shoulder"),upperArm=this.bones.get(side+"UpperArm"),lowerArm=this.bones.get(side+"LowerArm"),hand=this.bones.get(side+"Hand"),upperLeg=this.bones.get(side+"UpperLeg"),lowerLeg=this.bones.get(side+"LowerLeg"),foot=this.bones.get(side+"Foot");
      if(shoulder)shoulder.position.x*=r.shoulderWidth;if(upperArm)upperArm.position.x*=r.shoulderWidth;
      if(lowerArm)lowerArm.position.y*=r.armLength;if(hand){hand.position.y*=r.armLength;hand.scale.x*=r.handSize*r.handWidth;hand.scale.y*=r.handSize;hand.scale.z*=r.handSize;}
      if(upperLeg)upperLeg.position.x*=r.hipWidth;if(lowerLeg)lowerLeg.position.y*=r.legLength;if(foot){foot.position.y*=r.legLength;foot.scale.multiplyScalar(r.footSize);}
    }
    const mouth=this.bones.get("energyMouth");if(mouth)mouth.scale.x*=r.mouthWidth;
    for(const [name,parts]of this.parts)for(const part of parts){
      if(/^(UPPER_ARM|FOREARM)/.test(name)){part.scale.x*=r.armWidth;part.scale.y*=r.armLength;part.scale.z*=r.armWidth;part.position.y*=r.armLength;}
      if(/^(THIGH|SHIN)/.test(name)){part.scale.x*=r.legWidth;part.scale.y*=r.legLength;part.scale.z*=r.legWidth;part.position.y*=r.legLength;}
      if(name==="BODY"||name==="CHEST_ARMOR"||name==="WAIST"){part.scale.x*=r.bodyWidth;part.scale.y*=r.bodyHeight;if(name==="BODY")part.position.y*=r.bodyHeight;}
    }
    const styles=[r.headStyle,r.eyeStyle,r.antennaStyle].join(":");if(styles!==this.styles){this.styles=styles;this.replacePieces(r);}
  }
  private replacePieces(r:Config["robot"]){
    for(const [name,parts]of this.parts)for(const part of parts){const mesh=part as T.Mesh;if((mesh as T.SkinnedMesh).isSkinnedMesh)continue;let geometry:T.BufferGeometry|undefined;
      if(name==="HELMET")geometry=r.headStyle==="round"?new T.SphereGeometry(.61,24,16):r.headStyle==="box"?new RoundedBoxGeometry(1.05,1.12,1.02,3,.15):new T.IcosahedronGeometry(.61,3);
      if(/^EYE_[LR]$/.test(name)){
        geometry=r.eyeStyle==="round"?new T.SphereGeometry(.125,20,12):r.eyeStyle==="diamond"?new T.OctahedronGeometry(.135):new RoundedBoxGeometry(.27,.105,.05,3,.025);
        if(r.eyeStyle!=="bar")geometry.scale(1,1,.28);
        const base=geometry.attributes.position,values=new Float32Array(base.count*3);for(let i=0;i<base.count;i++)values.set([base.getX(i),base.getY(i)*.05,base.getZ(i)],i*3);geometry.morphAttributes.position=[new T.Float32BufferAttribute(values,3)];
      }
      if(name.startsWith("ANTENNA_STEM_"))geometry=r.antennaStyle==="horns"?new T.ConeGeometry(.12,.36,12):r.antennaStyle==="ears"?new RoundedBoxGeometry(.26,.32,.1,3,.05):new T.CylinderGeometry(.025,.035,.3,8);
      if(geometry){const influences=mesh.morphTargetInfluences?[...mesh.morphTargetInfluences]:undefined,dictionary=mesh.morphTargetDictionary;mesh.geometry.dispose();mesh.geometry=geometry;if(dictionary){mesh.updateMorphTargets();mesh.morphTargetDictionary=dictionary;mesh.morphTargetInfluences=influences;}}
    }
  }
  apply(c:Config,s:Signals,shaped=false){
    if(!this.available)return;
    if(!shaped)this.shape(c);
    const r=c.robot,voice=(s.audio||0)*c.audio.glow*3+(c.mode==="TERP"?.5:0);
    if(this.marker)this.marker.userData.sgxRobotLook=r;
    const jaw=this.bones.get("jaw"),speech=clamp(s.mouthOpen||0)*r.jawMotion;if(jaw){jaw.position.y-=speech*.035;jaw.rotateX(speech*.12);}
    const show=(name:string,visible:boolean)=>{for(const [key,parts] of this.parts)if(key===name||key.startsWith(name+"_"))for(const o of parts)o.visible&&=visible;};
    show("HELMET",r.helmet);show("CHEST_SIGIL",r.sigil);show("FX_HALO",r.halo);show("ANTENNA_STEM",r.antenna);show("ANTENNA_TIP",r.antenna);
    if(r.antennaStyle!=="antenna")show("ANTENNA_TIP",false);
    if(c.avatar.tint)this.tint.set(c.avatar.color);
    for(const [mat,base] of this.surfaces){mat.color.set(r[base.slot]);mat.metalness=base.metalness*r.metalness;mat.roughness=clamp(base.roughness*r.roughness,.04,1);if(["eyes","mouth","energy"].includes(base.slot)){mat.emissive.set(r[base.slot]);mat.emissiveIntensity=(base.slot==="eyes"?r.eyeGlow:base.slot==="mouth"?r.mouthGlow:r.energyGlow)+voice;}else if(voice>0)mat.emissive.copy(mat.color);if(c.avatar.tint)mat.color.lerp(this.tint,.65);}
    for(const [name,angles] of Object.entries(r.pose)){const joint=this.bones.get(name);if(!joint)continue;joint.rotateX(T.MathUtils.degToRad(angles[0]));joint.rotateY(T.MathUtils.degToRad(angles[1]));joint.rotateZ(T.MathUtils.degToRad(angles[2]));}
  }
}

export function robotLookFromModel(root:T.Object3D):Config["robot"]|undefined{
  let look:Config["robot"]|undefined;
  root.traverse(o=>{if(o.userData.sgxRobot===true){const saved=robotSchema.safeParse(o.userData.sgxRobotLook);look=saved.success?saved.data:robotDefaults();}});
  return look;
}
