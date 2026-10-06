import type { TrackingFrame } from "./state";

export type TrackingOptions = { hands:boolean; pose:boolean; rate:number; bodyMode?:"upper"|"full" };
export type CameraStatus = "off" | "starting" | "loading" | "preview" | "on";
export class MediaProblem extends Error {
  constructor(public code:string, public title:string, message:string, public kind:"camera"|"microphone"|"tracking"="camera", public detail="", public standalone=false) { super(message); this.name="MediaProblem"; }
}
function embedded() { try { return window.self!==window.top; } catch { return true; } }
export function checkMediaAccess(kind:"camera"|"microphone"="camera") {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new MediaProblem("secure-context","Open the studio in your browser","Camera and microphone access need a secure browser tab. Open the full studio using its HTTPS link.",kind,"",embedded());
  const policy=(document as Document&{permissionsPolicy?:{allowsFeature:(s:string)=>boolean};featurePolicy?:{allowsFeature:(s:string)=>boolean}}).permissionsPolicy || (document as Document&{featurePolicy?:{allowsFeature:(s:string)=>boolean}}).featurePolicy;
  if (policy && !policy.allowsFeature(kind)) throw new MediaProblem("embedded-permission","Open the full studio",`This embedded view blocks the ${kind}. Open the studio in a separate tab, then allow access.`,kind,"",true);
}
export function mediaProblem(error:unknown,kind:"camera"|"microphone"|"tracking"="camera"):MediaProblem {
  if(error instanceof MediaProblem)return error;
  const name=error instanceof Error?error.name:"Error",detail=error instanceof Error?error.message:String(error);
  if(kind==="tracking")return new MediaProblem("tracking-start","Tracking could not start","Your camera preview is still available. Retry tracking. If it keeps failing, enable hardware acceleration and use a current Chrome, Edge or Safari browser.",kind,detail);
  const noun=kind==="camera"?"camera":"microphone";
  if(name==="NotAllowedError"||name==="PermissionDeniedError"||name==="SecurityError")return new MediaProblem("permission-denied",`Allow ${noun} access`,`Open this site's permissions in the browser address bar, allow the ${noun}, and try again. Also check the browser's ${noun} permission in your system settings.`,kind,detail,embedded());
  if(name==="NotFoundError"||name==="DevicesNotFoundError")return new MediaProblem("no-device",`No ${noun} found`,`Connect a ${noun} and try again. Check that your system and browser can see the device.`,kind,detail);
  if(name==="NotReadableError"||name==="TrackStartError"||name==="AbortError")return new MediaProblem("device-busy",`${noun[0].toUpperCase()+noun.slice(1)} could not open`,`Close other apps using the ${noun}, check system permissions, and try again.`,kind,detail);
  if(name==="OverconstrainedError")return new MediaProblem("device-constraints","Selected device is unavailable",`Choose Default ${noun}, or reconnect the selected device and try again.`,kind,detail);
  return new MediaProblem("media-error",`${noun[0].toUpperCase()+noun.slice(1)} could not start`,detail || `Reconnect your ${noun} and try again.`,kind,detail);
}
function worker() { return new Worker("/tracking/tracker.js?v=8"); }

/** Runs the real model loader without requesting camera permission. */
export function checkTrackingEngine(options:TrackingOptions,onProgress:(s:string)=>void=()=>{}):Promise<string[]> {
  return new Promise((resolve,reject)=>{
    let w:Worker;try{w=worker();}catch(error){reject(mediaProblem(error,"tracking"));return;}
    const warnings:string[]=[];const timeout=setTimeout(()=>finish(new Error("The tracking engine took too long to load.")),60000);
    function finish(error?:unknown){clearTimeout(timeout);w.terminate();if(error)reject(mediaProblem(error,"tracking"));else resolve(warnings);}
    w.onerror=e=>finish(new Error(e.message||"The tracking worker could not load."));
    w.onmessage=({data})=>{if(data.type==="progress")onProgress(data.message);if(data.type==="warning")warnings.push(data.message);if(data.type==="ready"){onProgress("Testing a video frame…");w.postMessage({type:"probe",time:performance.now()});}if(data.type==="probe-result")finish();if(data.type==="error"||data.type==="frame-error")finish(new Error(data.message));};
    w.postMessage({type:"init",options});
  });
}

export class CameraTracking {
  stream?:MediaStream;worker?:Worker;timer?:ReturnType<typeof setInterval>;startup?:ReturnType<typeof setTimeout>;
  pending=false;ready=false;lastSent=0;lastVideoTime=-1;errors=0;generation=0;
  private configId=0;
  private options?:TrackingOptions;
  private cancelVideo?:()=>void;
  constructor(public video:HTMLVideoElement,public onFrame:(f:TrackingFrame)=>void,public onStatus:(s:CameraStatus,detail?:string)=>void,public onError:(issue:MediaProblem)=>void){}
  async start(options:TrackingOptions,deviceId?:string) {
    this.stop();const token=this.generation;
    checkMediaAccess();this.onStatus("starting","Allow camera access in the browser prompt.");
    try {
      let stream:MediaStream;
      try { stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30},...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:"user"}})},audio:false}); }
      catch(error) {
        if(token!==this.generation)return;
        if(deviceId&&["OverconstrainedError","NotFoundError"].includes((error as Error).name)) {
          stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});
          if(token===this.generation)this.onError(new MediaProblem("device-fallback","Using the default camera","The selected camera is unavailable. The default camera has been connected instead."));
        }else throw error;
      }
      if(token!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.video.muted=true;this.video.autoplay=true;this.video.playsInline=true;this.video.srcObject=stream;
      this.onStatus("starting","Opening camera preview…");
      await this.waitForVideo();
      if(token!==this.generation)return;
      const track=stream.getVideoTracks()[0];
      track.onended=()=>{if(token!==this.generation)return;this.stop();this.onError(new MediaProblem("device-ended","Camera disconnected","Reconnect the camera and start it again."));};
      this.beginTracking(options);
    }catch(error){if(token!==this.generation)return;this.stop();throw mediaProblem(error);}
  }
  private waitForVideo() {
    return new Promise<void>((resolve,reject)=>{
      let settled=false;const finish=(error?:unknown)=>{if(settled)return;settled=true;clearTimeout(timeout);this.video.removeEventListener("loadeddata",loaded);this.video.removeEventListener("error",failed);this.cancelVideo=undefined;if(error)reject(error);else resolve();};
      const loaded=()=>{if(this.video.readyState>=2&&this.video.videoWidth>0)finish();};
      const failed=()=>finish(new MediaProblem("video-playback","Camera preview could not play","Stop the camera and try again. Check the selected device and browser permissions."));
      const timeout=setTimeout(()=>finish(new MediaProblem("video-timeout","Camera did not send video","The device opened but no video arrived. Close other camera apps or select another camera.")),15000);
      this.cancelVideo=()=>finish(new DOMException("Camera start cancelled.","AbortError"));
      this.video.addEventListener("loadeddata",loaded);this.video.addEventListener("error",failed);
      void this.video.play().then(loaded).catch(error=>finish(error));loaded();
    });
  }
  private stopWorker(){if(this.timer)clearInterval(this.timer);if(this.startup)clearTimeout(this.startup);this.timer=undefined;this.startup=undefined;this.worker?.terminate();this.worker=undefined;this.ready=false;this.pending=false;this.errors=0;this.lastVideoTime=-1;}
  private trackingFailed(error:unknown) {this.stopWorker();this.onStatus(this.stream?"preview":"off");this.onError(mediaProblem(error,"tracking"));}
  private beginTracking(options:TrackingOptions) {
    this.stopWorker();if(!this.stream)return;
    this.options={...options};
    this.onStatus("loading","Loading face tracking…");
    let w:Worker;try{w=worker();this.worker=w;}catch(error){this.trackingFailed(error);return;}
    this.startup=setTimeout(()=>{if(this.worker===w)this.trackingFailed(new Error("MediaPipe did not finish loading within 60 seconds."));},60000);
    w.onmessage=({data})=>{
      if(this.worker!==w)return;
      if(data.requestId!==undefined&&data.requestId!==this.configId)return;
      if(data.type==="progress")this.onStatus("loading",data.message);
      if(data.type==="ready"){if(this.startup)clearTimeout(this.startup);this.startup=undefined;this.ready=true;this.onStatus("on");}
      if(data.type==="result"){this.pending=false;this.errors=0;this.onFrame(data.frame);}
      if(data.type==="skipped")this.pending=false;
      if(data.type==="warning")this.onError(new MediaProblem("tracking-addon","Additional tracking unavailable",data.message,"tracking"));
      if(data.type==="error")this.trackingFailed(new Error(data.message));
      if(data.type==="frame-error"){this.pending=false;if(++this.errors>=5)this.trackingFailed(new Error(data.message));}
    };
    w.onerror=e=>{if(this.worker===w)this.trackingFailed(new Error(e.message||"The tracking worker could not load."));};
    w.postMessage({type:"init",options,requestId:++this.configId});this.timer=setInterval(()=>{void this.frame();},1000/options.rate);
  }
  retry(options:TrackingOptions){this.beginTracking(options);}
  configure(options:TrackingOptions){
    if(!this.worker)return;
    if(this.options?.hands===options.hands&&this.options.pose===options.pose&&this.options.bodyMode===options.bodyMode){
      if(this.options.rate!==options.rate){if(this.timer)clearInterval(this.timer);this.timer=setInterval(()=>{void this.frame();},1000/options.rate);}
      this.options={...options};return;
    }
    this.options={...options};this.ready=false;this.onStatus("loading","Updating tracking…");this.worker.postMessage({type:"init",options,requestId:++this.configId});if(this.timer)clearInterval(this.timer);this.timer=setInterval(()=>{void this.frame();},1000/options.rate);if(this.startup)clearTimeout(this.startup);this.startup=setTimeout(()=>this.trackingFailed(new Error("Tracking settings took too long to apply.")),60000);
  }
  async frame(){
    if(this.pending&&performance.now()-this.lastSent>15000){this.trackingFailed(new Error("Tracking stopped responding to video frames."));return;}
    if(!this.worker||!this.ready||this.pending||this.video.readyState<2||this.video.currentTime===this.lastVideoTime)return;
    this.pending=true;this.lastSent=performance.now();this.lastVideoTime=this.video.currentTime;const token=this.generation,w=this.worker;
    try{
      const width=Math.min(640,this.video.videoWidth),height=Math.max(1,Math.round(width*this.video.videoHeight/this.video.videoWidth));
      const bitmap=await createImageBitmap(this.video,{resizeWidth:width,resizeHeight:height});
      if(token!==this.generation||this.worker!==w){bitmap.close();return;}
      w.postMessage({type:"frame",bitmap,time:this.lastSent},[bitmap]);
    }catch(error){if(this.worker!==w)return;this.pending=false;if(++this.errors>=5)this.trackingFailed(error);}
  }
  stop(){this.generation++;this.cancelVideo?.();this.stopWorker();this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=undefined;this.video.srcObject=null;this.onStatus("off");}
}
