import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, rm, realpath } from "node:fs/promises";
const {build}=createRequire(await realpath(new URL("../node_modules/wrangler/package.json",import.meta.url)))("esbuild");
const output=new URL("../.sites-runtime/engine-check.mjs",import.meta.url).pathname;
await build({stdin:{contents:'export * from "./lib/engine/state.ts"; export * from "./lib/engine/avatar.ts"; export * from "./lib/engine/loader.ts"; export * from "./lib/engine/renderer.ts";',resolveDir:process.cwd(),loader:"ts"},bundle:true,platform:"node",format:"esm",packages:"external",outfile:output});
globalThis.FileReader=class {
  result=null; onload=null; onloadend=null;
  readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onload?.({target:this});this.onloadend?.({target:this});});}
  readAsDataURL(blob){blob.arrayBuffer().then(data=>{this.result="data:"+blob.type+";base64,"+Buffer.from(data).toString("base64");this.onload?.({target:this});this.onloadend?.({target:this});});}
};
const e=await import(output);
const held=[{side:"Left",points:[{x:.2,y:.3,z:0}]}],next=[{side:"Left",points:[{x:.8,y:.7,z:0}]}];
const frozen={config:{frozen:true},raw:null,hands:held,lastHands:1,pose:[{x:.2,y:.3,z:0}],lastPose:1};
const nextFrame={signals:{jawOpen:.5},hands:next,pose:[{x:.8,y:.7,z:0}],time:100,inference:10};
e.VtuberEngine.prototype.setTracking.call(frozen,nextFrame);assert.equal(frozen.hands,held,"paused hands retain their pose");assert.equal(frozen.lastPose,1);
frozen.config.frozen=false;e.VtuberEngine.prototype.setTracking.call(frozen,nextFrame);assert.equal(frozen.hands,next,"hands resume tracking");
const a=e.defaults(),b=e.defaults();a.avatar.hidden.push("test");assert.equal(b.avatar.hidden.length,0,"defaults must be independent");
assert.equal(e.parseConfig(b).world.type,"studio");
assert.throws(()=>e.parseConfig({...b,fx:{...b.fx,bloom:99}}),"out of range configurations must fail");
assert.throws(()=>e.parseConfig({...b,world:{...b.world,color:"url(private)"}}),"invalid colors must fail");
const signals=e.sourceSignals({jawOpen:.7,mouthSmileLeft:.8,mouthSmileRight:.4,eyeBlinkLeft:.9,browInnerUp:.3});
assert.equal(signals.mouthOpen,.7);assert.ok(Math.abs(signals.smile-.6)<1e-9);assert.equal(signals.blinkLeft,.9);
const map={id:"t",source:"smile",kind:"scale",target:"t",gain:-1,offset:0,enabled:true};
assert.equal(e.mappingValue(map,{smile:.75}),-.75,"inverse scale routes must shrink");
assert.equal(e.mappingValue({...map,kind:"morph",gain:4},{smile:1}),1,"morph weights stay bounded");
const aliases=e.autoMappings(["FACE::Blink_L","FACE::eyeBlinkRight","FACE::jawOpen","FACE::mouthSmileLeft","horns::Unrelated"]);
assert.equal(aliases.length,4);assert.equal(aliases[0].source,"blinkLeft");assert.equal(aliases[2].source,"jawOpen");
const root=e.createAvatar();let bones=0,morphs=0,meshes=0,eye,mouth;
root.traverse(o=>{if(o.isBone)bones++;if(o.isMesh){meshes++;for(const a of Object.values(o.geometry.attributes))for(const n of a.array)assert.ok(Number.isFinite(n));morphs+=Object.keys(o.morphTargetDictionary||{}).length;if(o.name==="EYE_L")eye=o;if(o.name==="MOUTH")mouth=o;}});
assert.ok(bones>=30&&meshes>=40&&morphs>=9,"the demo must have an actual hierarchy, layers and morphs");
const span=attribute=>{let lo=Infinity,hi=-Infinity;for(let i=0;i<attribute.count;i++){lo=Math.min(lo,attribute.getY(i));hi=Math.max(hi,attribute.getY(i));}return hi-lo;};
assert.ok(span(eye.geometry.morphAttributes.position[0])<span(eye.geometry.attributes.position)*.1,"blink closes the eye geometry");
assert.ok(span(mouth.geometry.morphAttributes.position[0])>span(mouth.geometry.attributes.position)*5,"mouth open expands actual geometry");
const blob=await e.exportGLB(root);
assert.ok(blob.size>10000);const header=new DataView(await blob.arrayBuffer());assert.equal(header.getUint32(0,true),0x46546c67);
const imported=await e.loadFiles([new File([blob],"roundtrip.glb",{type:"model/gltf-binary"})]);let importedMorphs=0;
imported.root.traverse(o=>{importedMorphs+=Object.keys(o.morphTargetDictionary||{}).length;});assert.equal(importedMorphs,morphs,"GLB roundtrip preserves morph targets");
await assert.rejects(()=>e.loadFiles([new File(["nope"],"broken.glb")]));
await assert.rejects(()=>e.loadFiles([new File(['{"asset":{"version":"2.0"},"buffers":[{"uri":"missing.bin","byteLength":12}],"bufferViews":[{"buffer":0,"byteLength":12}],"accessors":[{"bufferView":0,"componentType":5126,"count":1,"type":"VEC3","min":[0,0,0],"max":[1,1,1]}],"meshes":[{"primitives":[{"attributes":{"POSITION":0}}]}],"nodes":[{"mesh":0}],"scenes":[{"nodes":[0]}],"scene":0}'],"missing.gltf")]));
const worker=await readFile(new URL("../public/tracking/tracker.js",import.meta.url),"utf8");assert.ok(worker.includes("detectForVideo")&&worker.includes("bitmap.close()"));
for(const path of ["face.task","hands.task","pose.task","wasm/vision_wasm_internal.wasm","wasm/vision_wasm_nosimd_internal.wasm"]){const data=await readFile(new URL("../public/tracking/"+path,import.meta.url));assert.ok(data.length>10000,path+" must be bundled");}
e.disposeTree(root);e.disposeTree(imported.root);await rm(output);
console.log(JSON.stringify({verified:true,bones,meshes,morphs,glbBytes:blob.size,checks:["config validation","signal mapping","inverse routes","real morph geometry","GLB export/import","invalid files","missing GLTF dependency","local tracking models"]}));
