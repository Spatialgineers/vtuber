import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpath,rm} from 'node:fs/promises';
import * as T from 'three';

const {build}=createRequire(await realpath(new URL('../node_modules/wrangler/package.json',import.meta.url)))('esbuild');
const out=new URL('../.sites-runtime/robot-thumbs-check.mjs',import.meta.url).pathname;
await build({stdin:{contents:['avatar','state','hands','rig','pose','puppet','pads','characters','loader','performance-state'].map(p=>`export * from "./lib/engine/${p}.ts";`).join('\n'),resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',packages:'external',outfile:out});
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(data=>{this.result='data:'+blob.type+';base64,'+Buffer.from(data).toString('base64');this.onloadend?.();});}};
const E=await import(out),root=E.createAvatar(),legacy=E.createAvatar(),actor=new T.Group();actor.add(root);let imported;
const names=['Thumb','Index','Middle','Ring','Little'],segments=['Proximal','Intermediate','Distal'];
const node=name=>root.getObjectByName(name),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
try{
 root.updateMatrixWorld(true);
 for(const side of ['Left','Right']){
  const sign=side==='Left'?1:-1,hand=node(side+'Hand'),thumb=node(side+'ThumbProximal'),index=node(side+'IndexProximal');
  assert.equal(thumb.parent,hand);assert.ok(thumb.position.y>index.position.y+.1,'thumb starts on the side of the palm');
  near(thumb.position.x,-sign*.125);
  const direction=node(side+'ThumbIntermediate').getWorldPosition(new T.Vector3()).sub(thumb.getWorldPosition(new T.Vector3())).normalize();
  assert.ok(direction.x*sign<-.8,'thumb points sideways');
  const tip=hand.worldToLocal(node(side+'ThumbDistal').getWorldPosition(new T.Vector3()));
  assert.ok(tip.x*sign<-.22,'thumb tip stays outside the palm');assert.ok(tip.y>-.15,'thumb is separate from the vertical finger row');
  assert.equal(names.slice(1).filter(name=>node(side+name+'Proximal').position.y===-.18).length,4);
  near(names.slice(1).reduce((sum,name)=>sum+node(side+name+'Proximal').position.x,0),0);
 }
 // Reconstruct the previous joint transforms to test real saved-rig compatibility.
 delete legacy.userData.sgxRobotHandLayout;
 for(const side of ['Left','Right'])for(const [i,name]of names.entries()){
  const finger=legacy.getObjectByName(side+name+'Proximal');finger.position.set((i-2)*.058*(side==='Left'?1:-1),-.18,.01);finger.quaternion.identity();
  if(i===0){legacy.getObjectByName(side+name+'Intermediate').position.y=-.11;legacy.getObjectByName(side+name+'Distal').position.y=-.065;}
 }
 const oldBinding=new E.PoseBinding(legacy),binding=new E.PoseBinding(root);
 assert.equal(binding.model,oldBinding.model,'previous Robot poses and pad actions keep their model identity');
 const oldThumb=oldBinding.bones.find(b=>b.name==='LeftThumbProximal');oldThumb.node.rotateX(.6);
 const pose={id:crypto.randomUUID(),name:'Saved thumb pose',model:oldBinding.model,frame:oldBinding.capture()},clip={id:crypto.randomUUID(),name:'Saved thumb animation',model:oldBinding.model,duration:1,keyframes:[{id:crypto.randomUUID(),time:0,frame:E.emptyFrame(),easing:'linear'},{id:crypto.randomUUID(),time:1,frame:pose.frame,easing:'linear'}]};
 let config=E.defaults();config.performance={...config.performance,model:oldBinding.model,mode:'clip',clip:clip.id,time:1,blend:0,keepFace:false,poses:[pose],clips:[clip]};
 const saved=E.captureCharacter(config,'Previous Robot',null,1),stored=E.storeCharacter(config,saved),restored=E.activateCharacter(stored,saved,binding.model);
 assert.equal(restored.performance.mode,'clip');assert.equal(restored.performance.clip,clip.id);
 const player=new E.PosePlayer(binding);player.update(restored.performance,0,false);
 near(node('LeftThumbProximal').quaternion.angleTo(binding.byNode.get(node('LeftThumbProximal')).rest.q),.6);
 near(node('LeftThumbProximal').position.x,-.125);
 const stage={model:binding.model,animations:[],camera:()=>config.camera,frame(){},burst(){},clearPower(){}},pad={id:crypto.randomUUID(),label:'Thumb pose',color:'#00eeee',bank:'C',slot:0,trigger:'tap',action:{pose:pose.id}};
 assert.ok(E.padReady(pad,restored,stage));player.update(new E.PadRuntime().press(restored,pad,stage).performance,0,false);
 near(node('LeftThumbProximal').quaternion.angleTo(binding.byNode.get(node('LeftThumbProximal')).rest.q),.6);
 binding.apply(E.emptyFrame());
 const nodes=new Map(),rests=new Map(),info=[];
 root.traverse(n=>{nodes.set(n.name,n);rests.set(n,{p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()});info.push({id:n.name,name:n.name,bone:!!n.isBone});});
 const mapping=E.autoRigMapping(info),rig=new E.HumanoidRig(actor,nodes,rests,mapping);
 const reset=()=>{for(const[n,r]of rests){n.position.copy(r.p);n.quaternion.copy(r.q);n.scale.copy(r.s);}actor.updateMatrixWorld(true);};
 config=E.defaults();config.tracking={...config.tracking,pose:false,hands:true,mirror:false,smoothing:0,handSmoothing:0};
 function solve(gesture,mirror=false,puppet=false){
  rig.bind(mapping);const cfg={...config,tracking:{...config.tracking,mirror},puppet:{left:gesture,right:gesture}};
  let hands;
  for(let i=0;i<24;i++){reset();hands=puppet?E.puppetHands(cfg,[],0,1000).hands:[E.handGesture('left',gesture),E.handGesture('right',gesture)];rig.update(cfg,{hands,lastHands:1000,lastPose:0},1000,.05);}
  for(const side of ['Left','Right']){
   const physical=mirror?(side==='Left'?'Right':'Left'):side,hand=hands.find(h=>h.side===physical);
   for(const [i,name]of names.entries())for(const [j,segment]of segments.entries()){
    const bone=node(side+name+segment);assert.ok(bone.quaternion.toArray().every(Number.isFinite));
    if(j===2)continue;
    const next=node(side+name+segments[j+1]),actual=next.getWorldPosition(new T.Vector3()).sub(bone.getWorldPosition(new T.Vector3())).normalize(),first=i===0?1:5+(i-1)*4,a=hand.world[first+j],b=hand.world[first+j+1],expected=new T.Vector3((b.x-a.x)*(mirror?-1:1),a.y-b.y,a.z-b.z).normalize();
    assert.ok(actual.dot(expected)>.98,`${side} ${name} ${segment} follows ${gesture}, mirror=${mirror}, puppet=${puppet}`);
   }
  }
 }
 const handPoses={};
 for(const mirror of [false,true])for(const gesture of ['open','fist','point','spread'])for(const puppet of [false,true]){
  solve(gesture,mirror,puppet);
  if(!mirror&&!puppet)handPoses[gesture]=Object.fromEntries(['LeftThumbIntermediate','LeftIndexIntermediate','LeftMiddleIntermediate'].map(name=>[name,node(name).quaternion.clone()]));
 }
 assert.ok(handPoses.open.LeftThumbIntermediate.angleTo(handPoses.fist.LeftThumbIntermediate)>.3,'thumb bends independently');
 assert.ok(handPoses.fist.LeftIndexIntermediate.angleTo(handPoses.point.LeftIndexIntermediate)>.5,'pointing frees the index');
 assert.ok(handPoses.fist.LeftMiddleIntermediate.angleTo(handPoses.point.LeftMiddleIntermediate)<.08,'pointing retains the other fingers');
 reset();const blob=await E.exportGLB(root);imported=await E.loadFiles([new File([blob],'side-thumb-robot.glb')]);
 assert.notEqual(new E.PoseBinding(imported.root).model,binding.model,'exported skins use their actual bind fingerprint');
 for(const side of ['Left','Right']){
  const thumb=imported.root.getObjectByName(side+'ThumbProximal'),skin=imported.root.getObjectByName('FINGER_'+side+'_Thumb');
  near(thumb.position.x,(side==='Left'?-1:1)*.125);near(Math.abs(new T.Euler().setFromQuaternion(thumb.quaternion).z),1.05);
  const vertices=()=>{imported.root.updateMatrixWorld(true);skin.skeleton.update();return Array.from({length:skin.geometry.attributes.position.count},(_,i)=>skin.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(skin.geometry.attributes.position,i)).applyMatrix4(skin.matrixWorld));};
  const before=vertices();thumb.rotateX(.6);assert.ok(Math.max(...vertices().map((v,i)=>v.distanceTo(before[i])))>.02,'exported side thumb bends its weighted mesh');
 }
 console.log(JSON.stringify({verified:true,checks:['two mirrored side thumbs and four centered fingers','shorter articulated thumb chains','previous Robot pose and animation identity','saved character cursor and legacy pad playback','all finger directions follow open fist point spread','live and puppet gestures with both mirror settings','independent thumb bend and index pointing','GLB thumb placement orientation and real skin deformation','imported bind identity retained']}));
}finally{E.disposeTree(root);E.disposeTree(legacy);if(imported)E.disposeTree(imported.root);await rm(out,{force:true});}
