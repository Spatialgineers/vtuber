import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export function createAvatar() {
  const root = new T.Group(); root.name = "SGX_01"; root.userData.sgxRobot = true; root.userData.sgxRobotHandLayout = 2;
  const metal = new T.MeshStandardMaterial({ color:0xd2d6db, metalness:.85, roughness:.26 });
  const gold = new T.MeshStandardMaterial({ color:0xfdcc0d, metalness:.65, roughness:.26 });
  const dark = new T.MeshStandardMaterial({ color:0x0d1520, metalness:.72, roughness:.3 });
  const light = new T.MeshStandardMaterial({ color:0x00eeee, emissive:0x00eeee, emissiveIntensity:1.4, metalness:.4, roughness:.25 });
  for(const [material,slot] of [[metal,"metal"],[gold,"armor"],[dark,"dark"],[light,"energy"]] as const){material.name="SGX_ROBOT_"+slot.toUpperCase();material.userData.sgxRobotSlot=slot;}
  const bone = (name: string, parent: T.Object3D, x:number,y:number,z:number) => { const b = new T.Bone(); b.name=name; b.position.set(x,y,z); parent.add(b); return b; };
  const mesh = (name:string, geometry:T.BufferGeometry, material:T.Material, parent:T.Object3D, x=0,y=0,z=0) => { const mat=material.clone();if(name.startsWith("EYE_")||name==="MOUTH"){mat.userData.sgxRobotSlot=name==="MOUTH"?"mouth":"eyes";mat.name="SGX_ROBOT_"+String(mat.userData.sgxRobotSlot).toUpperCase();}const m=new T.Mesh(geometry,mat);m.name=name;m.position.set(x,y,z);parent.add(m);return m; };
  const box=(x:number,y:number,z:number,r=.05)=>new RoundedBoxGeometry(x,y,z,3,r);
  const sphere=(r:number)=>new T.SphereGeometry(r,24,16);
  const hips=bone("hips",root,0,1.25,0);
  const spine=bone("spine",hips,0,.05,0);
  const chest=bone("chest",spine,0,.55,0);
  mesh("BODY",box(.88,.92,.48,.14),dark,spine,0,.55);
  mesh("CHEST_ARMOR",box(.86,.6,.53,.09),metal,chest,0,.16,.05);
  mesh("CHEST_SIGIL",new T.OctahedronGeometry(.13),gold,chest,0,.23,.36).rotation.z=Math.PI/4;
  for(let i=0;i<3;i++) mesh("POWER_CORE_"+i,box(.05,.23,.05,.02),light,chest,(i-1)*.095,-.23,.29);
  mesh("WAIST",new T.CylinderGeometry(.31,.28,.35,12),dark,spine,0,-.08);
  const neck=bone("neck",chest,0,.55,0);
  mesh("NECK",new T.CylinderGeometry(.18,.23,.24,16),dark,neck,0,.02);
  const head=bone("head",neck,0,.24,0);
  const shell=mesh("HELMET",new T.IcosahedronGeometry(.61,3),gold,head,0,.18);shell.scale.set(1,1.1,.92);
  mesh("FACE",box(.98,.55,.19,.11),dark,head,0,.15,.51);
  const jaw=bone("jaw",head,0,-.19,.44);
  mesh("CHIN",box(.66,.16,.25,.055),metal,jaw);
  function morph(m:T.Mesh,names:string[],fns:((v:T.Vector3)=>T.Vector3)[]) {
    const base=m.geometry.attributes.position;
    m.geometry.morphAttributes.position=fns.map(fn=>{const values=new Float32Array(base.count*3);for(let i=0;i<base.count;i++){const p=fn(new T.Vector3().fromBufferAttribute(base,i));values.set([p.x,p.y,p.z],i*3);}return new T.Float32BufferAttribute(values,3);});
    m.updateMorphTargets();m.morphTargetDictionary=Object.fromEntries(names.map((n,i)=>[n,i]));m.morphTargetInfluences=names.map(()=>0);
  }
  for(const [side,x] of [["L",.23],["R",-.23]] as const){
    const eye=bone(side==="L"?"eyeLeft":"eyeRight",head,x,.21,.635);
    const e=mesh("EYE_"+side,box(.27,.105,.05,.025),light,eye);
    morph(e,["Blink_"+side],[(v)=>{v.y*=.05;return v;}]);
    const browBone=bone(side==="L"?"browLeft":"browRight",head,x,.36,.635);
    const brow=mesh("BROW_"+side,box(.29,.035,.04,.012),metal,browBone);
    morph(brow,["Brow_Up","Brow_Down"],[(v)=>{v.y+=.10;return v;},(v)=>{v.y-=.055;v.y+=v.x*(side==="L"?-.25:.25);return v;}]);
    mesh("EAR_"+side,new T.CylinderGeometry(.18,.18,.13,16),dark,head,x>0?.6:-.6,.15).rotation.z=Math.PI/2;
    mesh("EAR_SIGNAL_"+side,new T.TorusGeometry(.125,.025,8,24),light,head,x>0?.68:-.68,.15).rotation.y=Math.PI/2;
  }
  const mouthBone=bone("energyMouth",head,0,-.055,.633);
  const mouth=mesh("MOUTH",box(.26,.032,.04,.012),light,mouthBone);
  morph(mouth,["Mouth_Open","Smile","Frown"],[(v)=>{v.y*=7;v.x*=.9;return v;},(v)=>{v.x*=1.3;v.y+=Math.pow(v.x/.16,2)*.045;return v;},(v)=>{v.y-=Math.pow(v.x/.16,2)*.06;return v;}]);
  const antenna= new T.Group();antenna.name="ACCESSORY_ANTENNA";head.add(antenna);
  for(const x of [-.37,.37]) {const side=x>0?"L":"R";mesh("ANTENNA_STEM_"+side,new T.CylinderGeometry(.025,.035,.3,8),dark,antenna,x,.82).rotation.z=x>0?-.25:.25;mesh("ANTENNA_TIP_"+side,sphere(.06),light,antenna,x*1.12,.96);}
  const halo=mesh("FX_HALO",new T.TorusGeometry(.8,.012,8,64),light,head,0,.21,-.22);halo.rotation.x=.13;
  for(const [side,x] of [["Left",.58],["Right",-.58]] as const){
    const shoulder=bone(side+"Shoulder",chest,x>0?.44:-.44,.32,0);
    const arm=bone(side+"UpperArm",shoulder,x>0?.14:-.14,0,0);
    mesh("SHOULDER_"+side,sphere(.22),gold,arm);
    mesh("UPPER_ARM_"+side,box(.24,.56,.25),metal,arm,0,-.32);
    const lower=bone(side+"LowerArm",arm,0,-.65,0);mesh("ELBOW_"+side,sphere(.14),dark,lower);
    mesh("FOREARM_"+side,box(.21,.47,.22),dark,lower,0,-.27);
    mesh("FOREARM_SIGNAL_"+side,box(.07,.29,.045,.02),light,lower,0,-.27,.125);
    const hand=bone(side+"Hand",lower,0,-.54,0);mesh("PALM_"+side,box(.25,.22,.10,.03),metal,hand,0,-.08);
    for(const [i,name] of ["Thumb","Index","Middle","Ring","Little"].entries()) {
      const thumb=name==="Thumb",sign=side==="Left"?1:-1;
      // Four fingers leave the palm's end; the shorter thumb pivots from its side.
      const finger=bone(side+name+"Proximal",hand,(thumb?-.125:(i-2.5)*.058)*sign,thumb?-.065:-.18,.01);
      if(thumb)finger.rotation.z=-sign*1.05;
      mesh("FINGER_"+side+"_"+name,box(.037,thumb?.085:.12,.05,.015),dark,finger,0,thumb?-.0375:-.05);
      const f2=bone(side+name+"Intermediate",finger,0,thumb?-.075:-.11,0);mesh("FINGER_MIDDLE_"+side+"_"+name,box(.037,thumb?.05:.06,.045,.014),gold,f2,0,thumb?-.0225:-.03);
      const f3=bone(side+name+"Distal",f2,0,thumb?-.05:-.065,0);mesh("FINGER_TIP_"+side+"_"+name,box(.037,thumb?.035:.04,.045,.012),gold,f3,0,thumb?-.0175:-.02);
    }
    const leg=bone(side+"UpperLeg",hips,x*.4,0,0);
    mesh("THIGH_"+side,box(.28,.58,.3),metal,leg,0,-.32);
    const shin=bone(side+"LowerLeg",leg,0,-.63,0);mesh("KNEE_"+side,sphere(.15),gold,shin);
    mesh("SHIN_"+side,box(.26,.44,.28),dark,shin,0,-.27);
    const foot=bone(side+"Foot",shin,0,-.53,0);
    mesh("FOOT_"+side,box(.3,.18,.47,.05),metal,foot,0,0,.1);
    bone(side+"Toes",foot,0,0,.3);
  }
  return root;
}

export function disposeTree(root:T.Object3D) {
  const textures=new Set<T.Texture>(),materials=new Set<T.Material>(),geometries=new Set<T.BufferGeometry>();
  root.traverse(o=>{const m=o as T.Mesh;if(m.geometry)geometries.add(m.geometry);if(m.material)for(const mat of Array.isArray(m.material)?m.material:[m.material]){materials.add(mat);for(const v of Object.values(mat))if(v instanceof T.Texture)textures.add(v);}});
  textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());root.removeFromParent();
}
