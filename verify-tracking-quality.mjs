import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpath,rm,readFile} from 'node:fs/promises';
import * as T from 'three';

const {build}=createRequire(await realpath(new URL('../node_modules/wrangler/package.json',import.meta.url)))('esbuild');
const out=new URL('../.sites-runtime/tracking-quality-check.mjs',import.meta.url).pathname;
await build({stdin:{contents:['avatar','state','robot','rig','hands','landmark-filter','grounding','loader','highcoon','animation'].map(p=>`export * from "./lib/engine/${p}.ts";`).join('\n'),resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',packages:'external',outfile:out});
globalThis.self=globalThis;globalThis.ProgressEvent=class extends Event{constructor(t,o){super(t);Object.assign(this,o);}};
globalThis.createImageBitmap=async blob=>({width:1,height:1,close(){}});
const E=await import(out),roots=[],reports=[];
const point=(x,y,z=0)=>({x,y:-y,z:-z,visibility:1,presence:1});
const rms=values=>Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length),near=(a,b,tolerance=1e-4)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
function body(angle=0){
 const p=Array.from({length:33},()=>point(0,.8));
 for(const[i,x,y,z]of [[11,.3,.65,0],[12,-.3,.65,0],[13,.3,.3,0],[14,-.3,.3,0],[15,.3,0,0],[16,-.3,0,0],[23,.18,0,0],[24,-.18,0,0],[25,.18,-.45,0],[26,-.18,-.45,0],[27,.18,-.9,0],[28,-.18,-.9,0],[31,.18,-.9,.2],[32,-.18,-.9,.2]])p[i]=point(x,y,z);
 p[13]=point(.3+Math.sin(angle)*.35,.65-Math.cos(angle)*.35);
 p[15]=point(.3+Math.sin(angle)*.65,.65-Math.cos(angle)*.65);
 return p;
}
const packet=(p,time,hands=[])=>({pose:p.map(v=>({...v,x:.5+v.x*.35,y:.55+v.y*.3})),poseWorld:p,lastPose:time,hands,lastHands:time});
function fixture(root){
 roots.push(root);const actor=new T.Group();actor.add(root);const nodes=new Map(),rests=new Map(),info=[];
 root.traverse(n=>{nodes.set(n.name,n);rests.set(n,{p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()});info.push({id:n.name,name:n.name,bone:!!n.isBone});});
 const mapping=E.autoRigMapping(info),rig=new E.HumanoidRig(actor,nodes,rests,mapping),robot=new E.RobotRig(root),config=E.defaults();config.tracking.mirror=false;config.tracking.bodyMode='full';
 const reset=()=>{for(const[n,r]of rests){n.position.copy(r.p);n.quaternion.copy(r.q);n.scale.copy(r.s);}robot.shape(config);actor.updateMatrixWorld(true);};
 const joint=role=>nodes.get(mapping[role]);
 const tick=(data,now,dt=1/60,c=config)=>{reset();rig.update(c,data,now,dt);actor.updateMatrixWorld(true);};
 const direction=(a,b)=>joint(b).getWorldPosition(new T.Vector3()).sub(joint(a).getWorldPosition(new T.Vector3())).normalize();
 return {root,actor,nodes,rests,rig,config,reset,joint,tick,direction};
}
try{
 const filter=new E.LandmarkFilter(),rawNoise=[],filteredNoise=[];
 for(let i=0;i<240;i++){
  const x=Math.sin(i*2.4)*.005+Math.sin(i*1.1)*.002,p=[{x,y:0,z:0,visibility:1}];
  const result=filter.update(p,1000+i*1000/30,.55,.6);
  if(i>60){rawNoise.push(x);filteredNoise.push(result[0].x);}
  const saved=result[0].x;for(let j=0;j<8;j++)assert.equal(filter.update(p,1000+i*1000/30,.55,.6)[0].x,saved,'render repeats never advance the sensor filter');
  assert.equal(p[0].x,x,'raw landmarks are never mutated');
 }
 const jitterRatio=rms(filteredNoise)/rms(rawNoise);assert.ok(jitterRatio<.55,'stationary landmark noise is substantially damped');
 const moving=new E.LandmarkFilter();let fixed=0;const adaptiveErrors=[],fixedErrors=[];
 for(let i=0;i<120;i++){
  const time=1000+i*1000/24,x=i<24?0:(i-24)*.8/24,actual=moving.update([{x,y:0,z:0}],time,.55,.6)[0].x;
  fixed+=(1-Math.exp(-1/24/(.012+.55*.55*.25)))*(x-fixed);
  if(i>36){adaptiveErrors.push(x-actual);fixedErrors.push(x-fixed);}
 }
 const adaptiveLag=rms(adaptiveErrors)/.8,fixedLag=rms(fixedErrors)/.8;assert.ok(adaptiveLag<fixedLag*.55,'adaptive filtering responds to fast motion sooner than fixed smoothing');
 const valid=moving.update([{x:1,y:2,z:3,visibility:1}],9000,.55,.6,.55);near(valid[0].x,1);
 const hidden=moving.update([{x:99,y:99,z:99,visibility:0}],9040,.55,.6,.55);near(hidden[0].x,1);assert.equal(hidden[0].visibility,0,'hidden data never borrows confidence');
 near(moving.update([{x:4,y:0,z:0,visibility:1}],9400,.55,.6,.55)[0].x,4);
 const f=fixture(E.createAvatar());f.config.tracking={...f.config.tracking,smoothing:0,handSmoothing:0,pose:false};f.config.robot.handWidth=2;f.config.robot.handSize=1.5;f.reset();f.rig.refreshReference();
 const hands=[E.handGesture('left','spread'),E.handGesture('right','spread')];
 for(let i=0;i<30;i++)f.tick({hands,lastHands:1000,lastPose:0},1000);
 let maxWideError=0;
 for(const side of ['Left','Right'])for(const [i,name]of ['Thumb','Index','Middle','Ring','Little'].entries())for(const [j,segment]of ['Proximal','Intermediate'].entries()){
  const actual=f.root.getObjectByName(side+name+(j?'Distal':'Intermediate')).getWorldPosition(new T.Vector3()).sub(f.root.getObjectByName(side+name+segment).getWorldPosition(new T.Vector3())).normalize(),first=i===0?1:5+(i-1)*4,a=hands.find(h=>h.side===side).world[first+j],b=hands.find(h=>h.side===side).world[first+j+1],target=new T.Vector3(b.x-a.x,a.y-b.y,a.z-b.z).normalize();
  const error=T.MathUtils.radToDeg(Math.acos(T.MathUtils.clamp(actual.dot(target),-1,1)));maxWideError=Math.max(maxWideError,error);assert.ok(error<.1,`${side} ${name} retains its tracked direction with a wide hand`);
 }
 const hold=fixture(E.createAvatar());hold.config.tracking.hands=false;hold.config.tracking.smoothing=0;
 for(let i=0;i<30;i++)hold.tick(packet(body(1.3),1000),1000);
 const arm=hold.joint('leftUpperArm'),reliable=arm.quaternion.clone(),missing=packet(body(1.3),1050);missing.pose[13].visibility=0;missing.poseWorld[13].visibility=0;
 hold.tick(missing,1050);near(arm.quaternion.angleTo(reliable),0);
 for(let t=1067;t<=1800;t+=1000/60)hold.tick(missing,t);assert.ok(arm.quaternion.angleTo(hold.rests.get(arm).q)<.001,'lost limbs release instead of remaining stuck');
 for(let i=0;i<30;i++)hold.tick(packet(body(1.3),2000),2000);
 const frozen=arm.quaternion.clone();hold.tick(packet(body(-1),2100),3000,1/60,{...hold.config,frozen:true});near(arm.quaternion.angleTo(frozen),0);
 const before=arm.quaternion.clone();hold.tick(packet(body(-1),3100),3100);assert.ok(arm.quaternion.angleTo(before)<=14/60+1e-5,'new detections cannot jump the arm in one frame');
 const zero={...hold.config,tracking:{...hold.config.tracking,arms:0}};for(let i=0;i<40;i++)hold.tick(packet(body(1),3200),3200,1/60,zero);assert.ok(arm.quaternion.angleTo(hold.rests.get(arm).q)<.001,'zero gain releases cached tracking');
 const collapsed=packet(body(1),3300);collapsed.poseWorld[13]={...collapsed.poseWorld[11]};hold.tick(collapsed,3300);assert.ok(arm.quaternion.toArray().every(Number.isFinite),'collapsed segments remain finite');
 const impossible=body();impossible[27]=point(.18,-.1,0);impossible[15]=point(.3,.6,0);
 hold.rig.bind(hold.rig.bindings);for(let i=0;i<40;i++)hold.tick(packet(impossible,4000),4000);
 assert.ok(hold.direction('leftUpperLeg','leftLowerLeg').angleTo(hold.direction('leftLowerLeg','leftFoot'))<=2.7+.001,'knee flexion is bounded');
 assert.ok(hold.direction('leftUpperArm','leftLowerArm').angleTo(hold.direction('leftLowerArm','leftHand'))<=2.85+.001,'elbow flexion is bounded');
 const unlimited={...hold.config,tracking:{...hold.config.tracking,bodyLimits:false}};hold.rig.bind(hold.rig.bindings);for(let i=0;i<40;i++)hold.tick(packet(impossible,4100),4100,1/60,unlimited);
 assert.ok(hold.direction('leftUpperLeg','leftLowerLeg').angleTo(hold.direction('leftLowerLeg','leftFoot'))>3,'artists can disable the bounds');
 const legacy=E.defaults();delete legacy.tracking.bodyLimits;assert.equal(E.parseConfig(legacy).tracking.bodyLimits,true);
 const floor=fixture(E.createAvatar());floor.config.tracking.hands=false;floor.config.tracking.smoothing=0;
 const tilted=body();tilted[31]=point(.18,-1.03,.18);tilted[32]=point(-.18,-1.03,.18);
 const soleHeight=()=>{floor.actor.updateMatrixWorld(true);let low=Infinity;for(const name of ['FOOT_Left','FOOT_Right']){const mesh=floor.root.getObjectByName(name),positions=mesh.geometry.attributes.position;for(let i=0;i<positions.count;i++)low=Math.min(low,new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).y);}return low;};
 floor.reset();const ground=soleHeight();for(let i=0;i<50;i++){floor.tick(packet(tilted,5000),5000);assert.ok(soleHeight()>=ground-.006,'feet avoid deep penetration while tracking catches up');}near(soleHeight(),ground,.003);
 floor.rig.bind(floor.rig.bindings);for(let i=0;i<50;i++)floor.tick(packet(tilted,5100),5100);near(soleHeight(),ground,.003);
 floor.config.robot.footSize=1.8;floor.config.robot.legLength=1.4;floor.reset();floor.rig.refreshReference();const resizedGround=soleHeight();for(let i=0;i<50;i++)floor.tick(packet(tilted,5200),5200);near(soleHeight(),resizedGround,.003);
 const contact=new E.FootContacts();floor.reset();contact.rebuild(floor.actor,[[floor.joint('leftFoot'),floor.joint('leftToes')],[floor.joint('rightFoot'),floor.joint('rightToes')]]);assert.ok(contact.size>0&&contact.size<=16,'grounding uses a bounded set of real sole vertices');
 const blink=E.trackingSignalAlpha('eyeBlinkLeft',.55,1,1/60),mouth=E.trackingSignalAlpha('jawOpen',.55,.8,1/60);assert.ok(blink>.9,'blinks no longer wait for slow body smoothing');assert.ok(mouth>.9,'speech gets a responsive envelope');assert.equal(E.trackingSignalAlpha('headX',.55,1,0),0);
 const fpsResults=[];
 for(const fps of [30,60,120]){
  const r=fixture(E.createAvatar());r.config.tracking.hands=false;
  const errors=[];
  for(let i=0;i<fps*3;i++){const time=1000+i*1000/fps,sensorTime=1000+Math.floor((time-1000)/(1000/24))*1000/24,angle=.7*Math.sin((sensorTime-1000)/1000*2);r.tick(packet(body(angle),sensorTime),time,1/fps);if(i>fps)errors.push(r.direction('leftUpperArm','leftLowerArm').angleTo(new T.Vector3(Math.sin(angle),-Math.cos(angle),0)));}
  fpsResults.push({fps,rmsError:rms(errors),last:r.direction('leftUpperArm','leftLowerArm')});
 }
 assert.ok(Math.max(...fpsResults.map(r=>r.rmsError))-Math.min(...fpsResults.map(r=>r.rmsError))<.06,'sensor filtering remains consistent across render rates');
 for(const item of E.CHARACTERS){
  const bytes=await readFile(new URL('../public'+item.path,import.meta.url)),glb=await E.loadFiles([new File([bytes],item.id+'.glb')]),r=fixture(glb.root);r.config.tracking.handSmoothing=0;
  const skins=[];glb.root.traverse(n=>{if(n.isSkinnedMesh)skins.push(n);});let vertices=0;
  for(const mesh of skins){const weights=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex;vertices+=weights.count;for(let i=0;i<weights.count;i++){let sum=0;for(let j=0;j<4;j++){const w=weights.getComponent(i,j);assert.ok(w>=0&&w<=1&&Number.isFinite(w));assert.ok(indices.getComponent(i,j)<mesh.skeleton.bones.length);sum+=w;}near(sum,1);}}
  for(const gesture of ['open','fist','point','spread']){
   const data=packet(body(.8),1000,[E.handGesture('left',gesture),E.handGesture('right',gesture)]);
   for(let i=0;i<30;i++)r.tick(data,1000);r.root.updateMatrixWorld(true);
   for(const skin of skins){skin.skeleton.update();for(let i=0;i<skin.geometry.attributes.position.count;i+=13){const p=skin.applyBoneTransform(i,new T.Vector3().fromBufferAttribute(skin.geometry.attributes.position,i)).applyMatrix4(skin.matrixWorld);assert.ok(p.toArray().every(Number.isFinite));}}
  }
  const mixer=new E.AnimationDirector(glb.root,glb.clips),hybrid={...r.config,avatar:{...r.config.avatar,motionMode:'hybrid',animation:'Run'},tracking:{...r.config.tracking,bodyMode:'upper',groundFeet:false}};r.reset();mixer.update(hybrid,.2);const leg=r.joint('leftUpperLeg').quaternion.clone();r.rig.update(hybrid,packet(body(.8),2000),2000,1/60);near(leg.angleTo(r.joint('leftUpperLeg').quaternion),0);mixer.dispose();
  const input=packet(body(.8),6000,[E.handGesture('left','fist'),E.handGesture('right','point')]);r.rig.bind(r.rig.bindings);r.config.tracking.smoothing=.55;r.config.tracking.handSmoothing=.28;
  const start=performance.now();for(let i=0;i<600;i++){input.lastPose=input.lastHands=6000+Math.floor(i/2)*1000/30;r.tick(input,6000+i*1000/60);}const cpuMs=(performance.now()-start)/600;
  assert.ok(cpuMs<12,'full tracking solve stays within a frame budget in this CPU environment');
  reports.push({character:item.id,vertices,clips:glb.clips.length,trackingCpuMsPerFrame:Number(cpuMs.toFixed(3))});
 }
 console.log(JSON.stringify({verified:true,jitterRmsRatio:Number(jitterRatio.toFixed(3)),adaptiveFastMotionLagMs:Number((adaptiveLag*1000).toFixed(2)),previousFixedLagMs:Number((fixedLag*1000).toFixed(2)),maxWideHandErrorDeg:Number(maxWideError.toFixed(4)),renderRates:fpsResults.map(({fps,rmsError})=>({fps,rmsError:Number(rmsError.toFixed(4))})),models:reports,checks:['packet-time adaptive filtering and immutable input','measured jitter reduction and faster large motion','confidence does not inherit occluded samples','filter resets on source gaps','nonuniform hand scales preserve all finger directions','brief hold graceful release and frozen joints','bounded reacquisition and zero-gain recovery','collapsed landmarks stay finite','optional knee elbow constraints and legacy scenes','actual sole contacts during motion, custom sizing and rebinding','responsive blink and speech envelopes','30 60 120 fps consistency','actual Highcoon skin weights and finite joint deformation','hybrid animated legs retained','CPU tracking solve frame budget']}));
}finally{for(const root of roots)E.disposeTree(root);await rm(out,{force:true});}
