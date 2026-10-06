import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,realpath,rm,mkdir,writeFile} from 'node:fs/promises';
import * as T from 'three';
const require=createRequire(import.meta.url),{build}=createRequire(await realpath(new URL('../node_modules/wrangler/package.json',import.meta.url)))('esbuild'),sharp=require('sharp');
const file=new URL('../.sites-runtime/hands-check.mjs',import.meta.url).pathname;
await build({stdin:{contents:['state','hands','motion','loader','rig','rig-roles','highcoon','animation','puppet'].map(m=>`export * from "./lib/engine/${m}.ts";`).join(''),resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',packages:'external',outfile:file});
globalThis.self=globalThis;globalThis.ProgressEvent=class extends Event{constructor(t,o){super(t);Object.assign(this,o);}};
globalThis.ImageBitmap=class{constructor(width,height,data){Object.assign(this,{width,height,data});}close(){this.data=null;}};
globalThis.createImageBitmap=async blob=>{const {data,info}=await sharp(Buffer.from(await blob.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});return new ImageBitmap(info.width,info.height,data);};
const E=await import(file),reports=[],reviewIndex=process.argv.indexOf('--review-dir'),reviewDir=reviewIndex>=0?process.argv[reviewIndex+1]:undefined;
if(reviewDir)await mkdir(reviewDir,{recursive:true});
const history=new Map(),left=E.handGesture('left','open'),right=E.handGesture('right','open');
left.score=.51;assert.equal(E.resolveHandSides([left],undefined,history,1000)[0][0],'left','uncertain handedness is accepted');
right.side='Left';const paired=E.resolveHandSides([left,right],undefined,history,1000);assert.equal(new Set(paired.map(([s])=>s)).size,2,'two detections cannot control the same hand');
const imagePose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));imagePose[15]={...right.points[0],visibility:1};imagePose[16]={...left.points[0],visibility:1};
assert.equal(E.resolveHandSides([left,right],imagePose,history,1000).find(([s])=>s==='left')[1],right,'crossed wrists follow pose identity');
assert.equal(E.resolveHandSides([{...E.handGesture('left','point'),locked:true}],imagePose,history,1000)[0][0],'left','puppet identity survives crossed pose');
assert.equal(E.metricHandPoints({...left,world:Array.from({length:21},()=>({x:0,y:0,z:0}))}).aspect,16/9,'invalid world coordinates fall back to aspect-aware image landmarks');
const legacy=E.defaults();for(const k of ['fingerGain','wristGain','handSmoothing','fingerLimits'])delete legacy.tracking[k];assert.equal(E.parseConfig(legacy).tracking.fingerGain,1);
let c=E.defaults();assert.equal(E.playClip(c,'Run').avatar.motionMode,'hybrid');assert.equal(E.powerPreset(c,'limonene',true).avatar.motionMode,'hybrid');c.tracking.bodyMode='full';assert.equal(E.playClip(c,'Run').avatar.motionMode,'tracking','full-body performance keeps live legs');
for(const item of E.CHARACTERS){
 const bytes=await readFile(new URL('../public'+item.path,import.meta.url)),glb=await E.loadFiles([new File([bytes],item.id+'.glb')]);
 const actor=new T.Group(),wrapper=new T.Group();wrapper.add(glb.root);actor.add(wrapper);glb.root.updateMatrixWorld(true);
 const box=new T.Box3().setFromObject(glb.root),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());wrapper.scale.setScalar(3.5/size.y);glb.root.position.x-=center.x;glb.root.position.z-=center.z;glb.root.position.y-=box.min.y;
 const nodes=new Map(),rests=new Map(),info=[];let n=0;wrapper.traverse(o=>{const id=o.name+' ['+n+++']';nodes.set(id,o);rests.set(o,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});info.push({id,name:o.name,bone:!!o.isBone});});
 const mapping=E.autoRigMapping(info),rig=new E.HumanoidRig(actor,nodes,rests,mapping),joint=role=>nodes.get(mapping[role]);
 const reset=()=>{for(const[o,r]of rests){o.position.copy(r.p);o.quaternion.copy(r.q);o.scale.copy(r.s);}actor.updateMatrixWorld(true);};
 const snapshots=()=>{actor.updateMatrixWorld(true);const values=[];wrapper.traverse(m=>{if(!m.isSkinnedMesh)return;m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i++)values.push(m.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(m.geometry.attributes.position,i)).applyMatrix4(m.matrixWorld));});return values;};
 const restMatrices={};wrapper.traverse(o=>{if(o.isBone)restMatrices[o.name]=o.matrixWorld.toArray();});
 const baseline=snapshots(),fingerRoles=E.RIG_ROLES.filter(r=>/Proximal|Intermediate|Distal/.test(r));assert.equal(fingerRoles.length,30);
 const influence={},deltas={};
 for(const role of fingerRoles){
  const bone=joint(role);assert.ok(bone,role);let count=0;
  wrapper.traverse(m=>{if(!m.isSkinnedMesh)return;const index=m.skeleton.bones.indexOf(bone);if(index<0)return;const weights=m.geometry.attributes.skinWeight,indices=m.geometry.attributes.skinIndex,positions=m.geometry.attributes.position;
   for(let i=0;i<weights.count;i++)for(let j=0;j<4;j++)if(indices.getComponent(i,j)===index&&weights.getComponent(i,j)>.08){count++;const p=new T.Vector3().fromBufferAttribute(positions,i);assert.ok(Math.abs(p.x)>.74&&p.y<1.205,`${role} weights remain in the hand`);assert.ok(!/gear/i.test(m.name),'costume cuffs are not attached to fingers');}
  });assert.ok(count>0,role+' has real skin influence');influence[role]=count;
  reset();bone.rotateX(.45);const vertices=snapshots();const max=Math.max(...vertices.map((p,i)=>p.distanceTo(baseline[i])));assert.ok(max>.003,role+' rotation actually deforms the mesh');deltas[role]=max;
 }
 const config=E.defaults();config.tracking={...config.tracking,pose:false,hands:true,mirror:false,handSmoothing:0,smoothing:0};
 const solve=(gesture,mode='hybrid',settings={})=>{rig.bind(mapping);const cfg={...config,avatar:{...config.avatar,motionMode:mode},tracking:{...config.tracking,...settings}},hands=[E.handGesture('left',gesture),E.handGesture('right',gesture)];
  for(let i=0;i<24;i++){reset();rig.update(E.trackingForMotion(cfg),{hands,lastHands:1000,lastPose:0},1250,.05);}return cfg;
 };
 const poses={character:item.id,rest:restMatrices,poses:{}};
 for(const gesture of ['open','fist','point','spread']){solve(gesture);const posed={};wrapper.traverse(o=>{if(o.isBone)posed[o.name]=o.matrixWorld.toArray();});poses.poses[gesture]=posed;assert.ok(Object.values(posed).flat().every(Number.isFinite));}
 solve('fist');const fist=joint('leftIndexIntermediate').quaternion.clone(),middle=joint('leftMiddleIntermediate').quaternion.clone();const fistPositions=snapshots();
 solve('point');assert.ok(fist.angleTo(joint('leftIndexIntermediate').quaternion)>.5,'pointing frees the index finger independently');assert.ok(middle.angleTo(joint('leftMiddleIntermediate').quaternion)<.08,'pointing retains middle finger curl');
 for(const mode of ['animation','hybrid','tracking']){solve('fist',mode);assert.ok(joint('leftIndexIntermediate').quaternion.angleTo(rests.get(joint('leftIndexIntermediate')).q)>.4,'live fingers survive '+mode);}
 solve('fist','hybrid',{fingerGain:0});for(const role of fingerRoles)assert.ok(joint(role).quaternion.angleTo(rests.get(joint(role)).q)<.001,'zero finger gain returns '+role+' to bind');
 solve('fist','hybrid',{hands:false});for(const role of fingerRoles)assert.ok(joint(role).quaternion.angleTo(rests.get(joint(role)).q)<.001,'disabled fingers return to bind');
 for(const mirror of [false,true]){rig.bind(mapping);const cfg={...config,puppet:{left:'fist',right:'none'},tracking:{...config.tracking,mirror,handSmoothing:0,smoothing:0}};for(let i=0;i<24;i++){reset();const input=E.puppetHands(cfg,[],0,2000+i*50);rig.update(E.trackingForMotion(cfg),{...input,lastPose:0},2000+i*50,.05);}assert.ok(joint('leftIndexIntermediate').quaternion.angleTo(rests.get(joint('leftIndexIntermediate')).q)>.4,'left puppet fist with mirror='+mirror);assert.ok(joint('rightIndexIntermediate').quaternion.angleTo(rests.get(joint('rightIndexIntermediate')).q)<.001,'uncontrolled hand retains animation');}
 const mixed=E.puppetHands({...config,puppet:{left:'point',right:'none'}},[E.handGesture('left','fist'),E.handGesture('right','open')],3000,3100);assert.equal(mixed.hands.length,2);
 const stale=E.puppetHands({...config,puppet:{left:'point',right:'none'}},[E.handGesture('right','fist')],0,3100);assert.equal(stale.hands.length,1);
 const cfg=solve('fist');const held=['leftHand','leftLowerArm','leftIndexIntermediate'].map(role=>joint(role).quaternion.toArray());reset();rig.update({...cfg,frozen:true},{hands:[E.handGesture('left','open')],lastHands:1300,lastPose:0},1300,.05);
 ['leftHand','leftLowerArm','leftIndexIntermediate'].forEach((role,i)=>joint(role).quaternion.toArray().forEach((v,j)=>assert.ok(Math.abs(v-held[i][j])<1e-6,'pause holds '+role)));
 const director=new E.AnimationDirector(glb.root,glb.clips);rig.bind(mapping);const animated=E.playClip(config,'Run');reset();director.update(animated,.2);const leg=joint('leftUpperLeg').quaternion.clone();rig.update(E.trackingForMotion(animated),{hands:[E.handGesture('left','fist')],lastHands:1000,lastPose:0},1000,.05);assert.ok(leg.angleTo(joint('leftUpperLeg').quaternion)<1e-7,'animated legs remain unchanged by hands');director.dispose();
 if(reviewDir)await writeFile(reviewDir+'/'+item.id+'-poses.json',JSON.stringify(poses));
 reports.push({character:item.id,fingerJoints:30,minInfluencedVertices:Math.min(...Object.values(influence)),minJointMeshDelta:Math.min(...Object.values(deltas)),fistMeshDelta:Math.max(...fistPositions.map((p,i)=>p.distanceTo(baseline[i])))});
}
await rm(file);console.log(JSON.stringify({verified:true,avatars:reports,checks:['all 30 joints deform actual GLB meshes','localized normalized hand weights','independent pointing','low-certainty hand labels','crossed wrist identity','aspect fallback','live hands in all motion modes','zero gain and disable','frozen wrists forearms and fingers','animated legs retained','power and clip tracking retention','legacy defaults','avatar-side puppet poses with mirroring','mixed live and puppet hands','stale input cannot revive']}));
