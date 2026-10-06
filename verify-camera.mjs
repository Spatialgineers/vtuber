import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { realpath,rm } from "node:fs/promises";
const {build}=createRequire(await realpath(new URL("../node_modules/wrangler/package.json",import.meta.url)))("esbuild");
const output=new URL("../.sites-runtime/camera-check.mjs",import.meta.url).pathname;
await build({stdin:{contents:'export * from "./lib/engine/tracking.ts";export {VtuberEngine} from "./lib/engine/renderer.ts";',resolveDir:process.cwd(),loader:"ts"},bundle:true,platform:"node",format:"esm",packages:"external",outfile:output});
const {CameraTracking,checkMediaAccess,mediaProblem,VtuberEngine}=await import(output);
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const options={hands:false,pose:false,rate:20};
globalThis.window={isSecureContext:true};window.self=window.top=window;
globalThis.document={permissionsPolicy:{allowsFeature:()=>true}};
Object.defineProperty(globalThis,"navigator",{value:{mediaDevices:{getUserMedia:async()=>{throw new Error("Not configured");}}},configurable:true});
class TestVideo extends EventTarget {readyState=2;videoWidth=640;videoHeight=480;currentTime=1;srcObject=null;async play(){}}
class TestWorker {
  static all=[];messages=[];terminated=false;
  constructor(url,settings){assert.equal(settings,undefined,"MediaPipe must use a classic worker");assert.ok(url.includes("tracker.js"));TestWorker.all.push(this);}
  postMessage(data){this.messages.push(data);}
  emit(data){this.onmessage?.({data});}
  terminate(){this.terminated=true;}
}
globalThis.Worker=TestWorker;
function stream(){const track={stops:0,onended:null,stop(){this.stops++;}};return{track,getTracks:()=>[track],getVideoTracks:()=>[track]};}
function tracker(video=new TestVideo()){const statuses=[],issues=[];const t=new CameraTracking(video,()=>{},s=>statuses.push(s),p=>issues.push(p));return{t,video,statuses,issues};}

// A blocked embedded view must fail before asking for a device.
document.permissionsPolicy.allowsFeature=()=>false;
assert.throws(()=>checkMediaAccess(),e=>e.code==="embedded-permission"&&e.standalone);
document.permissionsPolicy.allowsFeature=()=>true;
window.isSecureContext=false;assert.throws(()=>checkMediaAccess(),e=>e.code==="secure-context");window.isSecureContext=true;
for(const [name,code] of [["NotAllowedError","permission-denied"],["NotFoundError","no-device"],["NotReadableError","device-busy"]])assert.equal(mediaProblem(new DOMException("test",name)).code,code);

// Cancelling while the browser permission prompt is open must stop a late stream.
let device=defer(),s=stream();navigator.mediaDevices.getUserMedia=()=>device.promise;
let x=tracker(),pending=x.t.start(options);x.t.stop();device.resolve(s);await pending;
assert.equal(s.track.stops,1);assert.equal(x.t.worker,undefined);assert.equal(x.video.srcObject,null);

// Cancelling while video.play() is unresolved must never resurrect a worker.
device=defer();s=stream();const play=defer(),v=new TestVideo();v.readyState=0;v.play=()=>play.promise;
navigator.mediaDevices.getUserMedia=async()=>s;x=tracker(v);pending=x.t.start(options);await flush();x.t.stop();play.resolve();await pending;
assert.equal(s.track.stops,1);assert.equal(x.t.worker,undefined);

// An unplugged saved device should reconnect to the browser's default camera.
s=stream();let requests=0;navigator.mediaDevices.getUserMedia=async()=>{if(++requests===1)throw new DOMException("Missing device","OverconstrainedError");return s;};
x=tracker();await x.t.start(options,"unplugged-camera");assert.equal(requests,2);assert.equal(x.issues[0].code,"device-fallback");assert.equal(x.statuses.at(-1),"loading");
let w=x.t.worker;w.emit({type:"error",message:"model failed",requestId:w.messages[0].requestId});
assert.equal(x.statuses.at(-1),"preview");assert.equal(s.track.stops,0,"tracking failure preserves webcam preview");assert.equal(x.video.srcObject,s);
x.t.retry(options);assert.notEqual(x.t.worker,w);assert.equal(requests,2,"retry does not ask for camera permission again");
w.emit({type:"ready"});assert.equal(x.t.ready,false,"old workers cannot change current state");
w=x.t.worker;const oldId=w.messages.at(-1).requestId;x.t.configure({...options,hands:true});const newId=w.messages.at(-1).requestId;
w.emit({type:"ready",requestId:oldId});assert.equal(x.t.ready,false);w.emit({type:"ready",requestId:newId});assert.equal(x.t.ready,true);

// A pending bitmap must be released if camera Stop wins the race.
const capture=defer();let closes=0;globalThis.createImageBitmap=()=>capture.promise;pending=x.t.frame();x.t.stop();capture.resolve({close(){closes++;}});await pending;
assert.equal(closes,1);assert.equal(s.track.stops,1);assert.equal(x.video.srcObject,null);

// Microphone cancellation must release late permission results too.
const e=Object.create(VtuberEngine.prototype);e.micGeneration=0;e.audioSignals={};
device=defer();s=stream();navigator.mediaDevices.getUserMedia=()=>device.promise;
pending=e.startMic();await flush();await e.stopMic();device.resolve(s);await pending;assert.equal(s.track.stops,1);assert.equal(e.mic,undefined);

// An AudioContext failure must not leave the microphone open.
s=stream();navigator.mediaDevices.getUserMedia=async()=>s;globalThis.AudioContext=class{constructor(){throw new Error("Audio unavailable");}};
await assert.rejects(()=>e.startMic(),/Audio unavailable/);assert.equal(s.track.stops,1);assert.equal(e.mic,undefined);
await rm(output);
console.log(JSON.stringify({verified:true,checks:["embedded permission policy","secure context","specific device errors","cancel pending permission","cancel pending video playback","default device recovery","preview survives tracking failure","retry without reopening camera","stale worker/configuration messages","bitmap cleanup","microphone cancellation","audio failure cleanup"]}));
