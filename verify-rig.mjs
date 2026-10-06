import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { realpath, rm, readFile } from "node:fs/promises";
import vm from "node:vm";
import * as T from "three";
const {build}=createRequire(await realpath(new URL("../node_modules/wrangler/package.json",import.meta.url)))("esbuild");
const output=new URL("../.sites-runtime/rig-check.mjs",import.meta.url).pathname;
await build({stdin:{contents:'export * from "./lib/engine/rig.ts"; export * from "./lib/engine/rig-roles.ts"; export * from "./lib/engine/state.ts"; export * from "./lib/engine/avatar.ts";',resolveDir:process.cwd(),loader:"ts"},bundle:true,platform:"node",format:"esm",packages:"external",outfile:output});
const e=await import(output), vector=(x,y,z=0)=>({x,y:-y,z:-z,visibility:1,presence:1});
function pose(){const p=Array.from({length:33},()=>vector(0,.8));for(const [i,x,y,z] of [[11,.3,.65,0],[12,-.3,.65,0],[13,.3,.3,0],[14,-.3,.3,0],[15,.3,0,0],[16,-.3,0,0],[23,.18,0,0],[24,-.18,0,0],[25,.18,-.45,0],[26,-.18,-.45,0],[27,.18,-.9,0],[28,-.18,-.9,0],[29,.18,-.9,-.05],[30,-.18,-.9,-.05],[31,.18,-.9,.2],[32,-.18,-.9,.2]])p[i]=vector(x,y,z);return p;}
const image=p=>p.map(v=>({...v,x:.5+v.x*.35,y:.55+v.y*.3}));
function fixture(tPose=false,yaw=0){
  const actor=new T.Group(),root=e.createAvatar();actor.add(root);
  if(tPose){root.getObjectByName("LeftUpperArm").rotation.z=Math.PI/2;root.getObjectByName("RightUpperArm").rotation.z=-Math.PI/2;root.traverse(n=>{if(n.isBone&&n.name.startsWith("Left"))n.name="mixamorig:"+n.name.replace("UpperArm","Arm").replace("LowerArm","ForeArm").replace("UpperLeg","UpLeg").replace("LowerLeg","Leg");if(n.isBone&&n.name.startsWith("Right"))n.name="mixamorig:"+n.name.replace("UpperArm","Arm").replace("LowerArm","ForeArm").replace("UpperLeg","UpLeg").replace("LowerLeg","Leg");});}
  actor.rotation.y=yaw;const nodes=new Map(),rests=new Map(),info=[];let count=0;
  root.traverse(n=>{const id=n.name+" ["+count+++ "]";nodes.set(id,n);rests.set(n,{p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()});info.push({id,name:n.name,bone:!!n.isBone});});
  const map=e.autoRigMapping(info),rig=new e.HumanoidRig(actor,nodes,rests,map),config=e.defaults();config.tracking={...config.tracking,pose:true,hands:false,bodyMode:"full",mirror:false,smoothing:0};
  const reset=()=>{for(const [node,r]of rests){node.position.copy(r.p);node.quaternion.copy(r.q);node.scale.copy(r.s);}actor.updateMatrixWorld(true);};
  const update=(p,hands=[],time=1000,iterations=12)=>{const data={pose:image(p),poseWorld:p,hands,lastPose:1000,lastHands:1000};for(let i=0;i<iterations;i++){reset();rig.update(config,data,time,.05);}return data;};
  const joint=role=>nodes.get(map[role]);
  const direction=(a,b)=>joint(b).getWorldPosition(new T.Vector3()).sub(joint(a).getWorldPosition(new T.Vector3())).normalize();
  return {actor,root,nodes,rests,info,map,rig,config,reset,update,joint,direction};
}
const f=fixture();assert.equal(e.REQUIRED_BODY_ROLES.filter(role=>!f.map[role]).length,0);assert.ok(f.map.leftMiddleDistal&&f.map.rightFoot);
let p=pose();p[13]=vector(.65,.85,.1);p[15]=vector(.85,1.02,.12);p[25]=vector(.18,-.25,.35);p[27]=vector(.18,-.62,.2);p[31]=vector(.18,-.65,.42);f.update(p);
const expected=(a,b,mirror=false)=>new T.Vector3((p[b].x-p[a].x)*(mirror?-1:1),-(p[b].y-p[a].y),-(p[b].z-p[a].z)).normalize();
assert.ok(f.direction("leftUpperArm","leftLowerArm").dot(expected(11,13))>.999,"shoulder-to-elbow tracks its actual direction");
assert.ok(f.direction("leftLowerArm","leftHand").dot(expected(13,15))>.999,"elbows retain the pose solution");
assert.ok(f.direction("leftUpperLeg","leftLowerLeg").dot(expected(23,25))>.999,"hips-to-knees drive thigh bones");
assert.ok(f.direction("leftLowerLeg","leftFoot").dot(expected(25,27))>.999,"knees-to-ankles drive shins");
assert.ok(f.direction("leftFoot","leftToes").dot(expected(27,31))>.999,"ankle-to-toe drives feet");
const feet=[f.joint("leftFoot"),f.joint("rightFoot")];const lowest=Math.min(...feet.map(n=>n.getWorldPosition(new T.Vector3()).y));assert.ok(Math.abs(lowest-.09)<.015,"ground correction keeps the lowest foot at its bind height");
f.config.tracking.mirror=true;f.update(p);assert.ok(f.direction("rightUpperArm","rightLowerArm").dot(expected(11,13,true))>.999,"mirroring swaps sides along with reflection");assert.ok(f.direction("leftUpperArm","leftLowerArm").dot(expected(12,14,true))>.999,"mirror keeps the other arm on its own side");
f.config.tracking.mirror=false;f.config.tracking.bodyMode="upper";f.update(p);assert.ok(f.joint("leftUpperLeg").quaternion.angleTo(f.rests.get(f.joint("leftUpperLeg")).q)<.001,"upper-body mode releases leg tracking");
const old=f.joint("leftUpperArm").quaternion.clone();f.config.frozen=true;f.update(pose());assert.ok(old.angleTo(f.joint("leftUpperArm").quaternion)<.001,"pause holds body movement");f.config.frozen=false;
f.update(p);const reliable=f.joint("leftUpperArm").quaternion.clone();p[13].visibility=.1;f.update(p,[],1100,1);assert.ok(f.joint("leftUpperArm").quaternion.angleTo(reliable)<.001,"brief occlusion holds the reliable posture");f.update(p,[],1700);assert.ok(f.joint("leftUpperArm").quaternion.angleTo(f.rests.get(f.joint("leftUpperArm")).q)<.001,"occluded joints return to rest after the grace period");p[13].visibility=1;
f.update(p);f.update(p,[],2000);assert.ok(f.joint("leftUpperArm").quaternion.angleTo(f.rests.get(f.joint("leftUpperArm")).q)<.001,"stale body detections release their bones");
const imported=fixture(true,.7);imported.update(p);assert.ok(imported.direction("leftUpperArm","leftLowerArm").dot(expected(11,13).applyAxisAngle(new T.Vector3(0,1,0),.7))>.999,"T-pose rest rotations and character yaw are preserved");
const handWorld=Array.from({length:21},()=>vector(0,0));for(let i=0;i<5;i++){const first=i===0?1:5+(i-1)*4,x=(i-2)*.02;for(let j=0;j<4;j++)handWorld[first+j]=vector(x,-.06-j*.025,j>=2?.025*(j-1):0);}const hand={side:"Left",score:.99,world:handWorld,points:handWorld.map(v=>({...v,x:image(p)[15].x+v.x,y:image(p)[15].y+v.y}))};
f.config.tracking.hands=true;f.update(p);const elbow=f.joint("leftLowerArm").getWorldPosition(new T.Vector3());f.update(p,[hand]);assert.ok(elbow.distanceTo(f.joint("leftLowerArm").getWorldPosition(new T.Vector3()))<.001,"palm roll preserves the tracked elbow position");assert.ok(f.direction("leftLowerArm","leftHand").dot(expected(13,15))>.999,"palm roll preserves forearm direction");
const fingerDirection=new T.Vector3(0,-1,0).applyQuaternion(f.joint("leftMiddleDistal").getWorldQuaternion(new T.Quaternion()));const expectedFinger=new T.Vector3(handWorld[12].x-handWorld[11].x,-(handWorld[12].y-handWorld[11].y),-(handWorld[12].z-handWorld[11].z)).normalize();assert.ok(fingerDirection.dot(expectedFinger)>.999,"finger tips use world landmark directions through their parent joints");assert.ok(f.joint("leftMiddleIntermediate").quaternion.angleTo(f.rests.get(f.joint("leftMiddleIntermediate")).q)>.2,"finger joints articulate");
const handsOnly=fixture();handsOnly.config.tracking.pose=false;handsOnly.config.tracking.hands=true;handsOnly.update(p,[hand]);assert.ok(handsOnly.joint("leftUpperArm").quaternion.angleTo(handsOnly.rests.get(handsOnly.joint("leftUpperArm")).q)>.1,"hands-only mode retains estimated arm reach");
const coverage=e.trackingCoverage({pose:image(p),poseWorld:p,hands:[hand],handTime:1000,poseTime:1000,time:1100,inference:10,signals:{}},.55,1100);assert.equal(coverage.legs,true);assert.equal(coverage.hands,1);assert.equal(e.trackingCoverage({pose:image(p),poseWorld:p,hands:[hand],handTime:1000,poseTime:1000,time:2100,inference:10,signals:{}},.55,2100).legs,false);
// World-space head orientation must not accumulate the torso's lean.
p=pose();p[11]=vector(.48,.62);p[12]=vector(-.12,.74);f.update(p);const head=f.root.getObjectByName("head"),delta=new T.Quaternion().setFromEuler(new T.Euler(.1,.2,-.1));f.rig.headRotation(head,delta);assert.ok(head.getWorldQuaternion(new T.Quaternion()).angleTo(delta)<.001,"head tracking compensates torso rotation");
const legacy=e.defaults();delete legacy.avatar.rigMap;for(const key of ["bodyMode","arms","legs","confidence","groundFeet","overlay"])delete legacy.tracking[key];assert.equal(e.parseConfig(legacy).tracking.bodyMode,"upper","older scenes receive compatible defaults");
const config=e.defaults();config.mappings=[{id:"old",source:"blinkLeft",kind:"morph",target:"EYE_L [99]::Blink_L",gain:1,offset:0,enabled:true}];const rebound=e.rebindConfig(config,["head [15]"],["EYE_L [18]::Blink_L"]);assert.equal(rebound.mappings[0].target,"EYE_L [18]::Blink_L");
const duplicate=e.autoRigMapping([{id:"a",name:"LeftArm",bone:true},{id:"b",name:"LeftArm",bone:true}]);assert.equal(duplicate.leftUpperArm,undefined,"ambiguous bone names require manual mapping");
assert.equal(e.visiblePoint({x:NaN,y:0,z:0},0),false);assert.equal(e.visiblePoint({x:2,y:0,z:0},0,true),false);
// Exercise the worker protocol: skipped frames must not refresh cached timestamps.
const messages=[],stub=(result)=>({createFromOptions:async()=>({detectForVideo:()=>result})});
const sandbox={importScripts(){},SGXVision:{FilesetResolver:{forVisionTasks:async()=>({})},FaceLandmarker:stub({}),HandLandmarker:stub({landmarks:[],worldLandmarks:[],handedness:[]}),PoseLandmarker:stub({landmarks:[image(pose())],worldLandmarks:[pose()]})},self:{location:{href:"https://studio.test/tracking/tracker.js"}},postMessage:m=>messages.push(m),URL,performance,onmessage:null};
vm.createContext(sandbox);vm.runInContext(await readFile(new URL("../public/tracking/tracker.js",import.meta.url),"utf8"),sandbox);
await sandbox.onmessage({data:{type:"init",options:{hands:true,pose:true,bodyMode:"full"},requestId:1}});for(const time of [1000,1040,1100])await sandbox.onmessage({data:{type:"frame",time,bitmap:{close(){}}}});
const packets=messages.filter(m=>m.type==="result");assert.equal(packets[1].frame.handTime,1040);assert.equal(packets[1].frame.poseTime,1040,'full-body cadence follows available hand frames');assert.equal(packets[2].frame.handTime,1100);assert.equal(packets[2].frame.poseTime,1100);
await sandbox.onmessage({data:{type:'frame',time:1110,bitmap:{close(){}}}});assert.equal(messages.at(-1).frame.poseTime,1100,'a skipped inference keeps the original timestamp');
e.disposeTree(f.root);e.disposeTree(imported.root);e.disposeTree(handsOnly.root);await rm(output);
console.log(JSON.stringify({verified:true,checks:["full-body joint directions","mirror side assignment","grounded feet","upper-body mode","pause","low-confidence recovery","stale detection recovery","T-pose and model yaw","finger articulation","pose elbow priority","head/torso compensation","legacy scenes","ambiguous bones","worker timestamps"]}));
