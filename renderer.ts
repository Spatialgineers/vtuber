import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createAvatar, disposeTree } from "./avatar";
import { loadFiles, exportGLB, type Loaded } from "./loader";
import { type Config, type Signals, type TrackingFrame, defaults, demoSignals, sourceSignals, autoMappings, mappingValue, normalizedName, clamp } from "./state";
import { HumanoidRig, autoRigMapping } from "./rig";
import type { RigMap } from "./rig-roles";
import {MouthlessFace} from "./facial";
import { trackingForMotion } from "./motion";
import { handRigCheck } from "./hands";
import { puppetHands } from "./puppet";
import {RobotRig} from "./robot";
import {AnimationDirector} from "./animation";
import {PowerEffects} from "./powers";
import {characterFile,CHARACTERS,type HighcoonId} from "./highcoon";
import {PoseBinding,PosePlayer} from "./pose";
import {trackingSignalAlpha} from "./landmark-filter";
import {BoneEditor} from "./pose-editor";
import {presentFrame} from "./output";

export type NodeInfo={id:string;name:string;bone:boolean;mesh:boolean};
export type AvatarInfo={name:string;nodes:NodeInfo[];layers:NodeInfo[];morphs:string[];animations:string[];vertices:number;builtin:boolean;faceRig:boolean;robot:boolean;rig:RigMap};
type Rest={p:T.Vector3;q:T.Quaternion;s:T.Vector3};
const shader={
  uniforms:{tDiffuse:{value:null},time:{value:0},resolution:{value:new T.Vector2(1920,1080)},rgb:{value:.001},pixel:{value:1},glitch:{value:0},vignette:{value:.3},saturation:{value:1},grain:{value:.015}},
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`uniform sampler2D tDiffuse; uniform float time,rgb,pixel,glitch,vignette,saturation,grain; uniform vec2 resolution; varying vec2 vUv;
  float rnd(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
  void main(){vec2 uv=floor(vUv*resolution/pixel)*pixel/resolution; float band=floor(uv.y*30.0);float tick=floor(time*12.0);uv.x+=(rnd(vec2(band,tick))-.5)*glitch*.16*step(.72,rnd(vec2(tick,band)));
  vec2 shift=(uv-.5)*rgb;vec4 base=texture2D(tDiffuse,uv);vec3 c=vec3(texture2D(tDiffuse,uv+shift).r,base.g,texture2D(tDiffuse,uv-shift).b);float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,saturation);c*=1.0-vignette*smoothstep(.18,.72,length(vUv-.5));c+=(rnd(vUv+fract(time))-.5)*grain;gl_FragColor=vec4(max(c,vec3(0.0)),base.a);}`
};

export class VtuberEngine {
  renderer:T.WebGLRenderer; scene=new T.Scene(); camera=new T.PerspectiveCamera(35,16/9,.05,150); controls:OrbitControls;
  composer:EffectComposer; bloom:UnrealBloomPass; grade:ShaderPass; config:Config=defaults();
  actor=new T.Group(); world=new T.Group(); importedWorld?:Loaded; avatar?:Loaded; avatarRoot:T.Group; info!:AvatarInfo;
  nodes=new Map<string,T.Object3D>(); rests=new Map<T.Object3D,Rest>(); materials=new Map<T.MeshStandardMaterial,{color:T.Color;emissive:T.Color;emission:number}>();
  morphs=new Map<string,{mesh:T.Mesh;index:number}>(); mixer?:T.AnimationMixer; action?:T.AnimationAction; currentAnimation="";
  private handTestStart=0; private handTestUntil=0;
  private appearance?:Config["robot"];private hidden=new Set<string>();private tint=new T.Color();private sums=new Map<string,number>();private skipFingers=new Set<string>();private fog=new T.FogExp2(0);private background=new T.Color();
  rig!:HumanoidRig;face!:MouthlessFace;robot!:RobotRig;director?:AnimationDirector;powers=new PowerEffects();
  poseBinding!:PoseBinding;posePlayer!:PosePlayer;editor!:BoneEditor;outputCanvas=document.createElement("canvas");captureActive=false;private lastOverlay=false;private previewCanvas=document.createElement("canvas");
  signals:Signals={}; raw:TrackingFrame={signals:{},inference:0,time:0}; calibrated:T.Quaternion|null=null;
  neutralExpressions:Signals={};headTracking=false; lastHands=0; lastPose=0; hands:TrackingFrame["hands"]=[]; pose:TrackingFrame["pose"]; poseWorld:TrackingFrame["poseWorld"];
  mic?:MediaStream; micGeneration=0; audioContext?:AudioContext; analyser?:AnalyserNode; audioInput?:MediaStreamAudioSourceNode; audioData?:Uint8Array<ArrayBuffer>; wave?:Float32Array<ArrayBuffer>;
  audioSignals:Signals={audio:0,bass:0,mid:0,treble:0}; manual:Signals={}; pmrem:T.PMREMGenerator; envTexture:T.Texture;
  lights:{key:T.DirectionalLight;rim:T.DirectionalLight;fill:T.HemisphereLight}; particles:T.Points; seeds:Float32Array; mediaTexture?:T.Texture; mediaVideo?:HTMLVideoElement; mediaURL?:string;
  generation=0; worldGeneration=0; mediaGeneration=0; running=true; raf=0; lastTime=0; startTime=performance.now(); lastStats=0; frames=0; contextLost=false;
  popup?:Window|null; stats?:(stats:{fps:number;signals:Signals;audio:Signals;inference:number;face:boolean;animation?:string;overload?:number;handTest?:string;poseTime?:number;poseEnded?:boolean;performanceMode?:string})=>void;
  constructor(public canvas:HTMLCanvasElement) {
    this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:"high-performance",preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(1);this.renderer.setSize(1920,1080,false);this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.minDistance=1;this.controls.maxDistance=30;this.frameCamera("bust");
    this.pmrem=new T.PMREMGenerator(this.renderer);const room=new RoomEnvironment();this.envTexture=this.pmrem.fromScene(room,.04).texture;room.dispose();this.scene.environment=this.envTexture;
    const key=new T.DirectionalLight(0xffffff,3);key.position.set(3,5,4);
    const rim=new T.DirectionalLight(0x00eeee,3);rim.position.set(-3,3,-2);
    const fill=new T.HemisphereLight(0x819fcb,0x19212c,2);this.lights={key,rim,fill};this.scene.add(key,rim,fill,this.actor,this.world);this.actor.add(this.powers.root);
    const positions=new Float32Array(600*3);this.seeds=new Float32Array(600*4);
    for(let i=0;i<600;i++){const x=Math.sin(i*49.7)*4,y=(i*1.371)%5,z=Math.cos(i*19.3)*4-2;positions.set([x,y,z],i*3);this.seeds.set([x,y,z,(i*.381)%1],i*4);}
    const geometry=new T.BufferGeometry();geometry.setAttribute("position",new T.BufferAttribute(positions,3));
    this.particles=new T.Points(geometry,new T.PointsMaterial({color:0x00eeee,size:.018,transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending}));this.scene.add(this.particles);
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloom=new UnrealBloomPass(new T.Vector2(1920,1080),.3,.4,.8);this.composer.addPass(this.bloom);
    this.grade=new ShaderPass(shader);this.composer.addPass(this.grade);this.composer.addPass(new OutputPass());
    this.avatarRoot=createAvatar();this.actor.add(this.avatarRoot);this.inspect("SGX // 01",true);this.config.mappings=autoMappings(this.info.morphs);this.buildWorld();
    canvas.addEventListener("webglcontextlost",this.onContextLost);canvas.addEventListener("webglcontextrestored",this.onContextRestored);this.raf=requestAnimationFrame(this.tick);
  }
  onContextLost=(e:Event)=>{e.preventDefault();this.contextLost=true;};onContextRestored=()=>{this.contextLost=false;};
  inspect(name:string,builtin:boolean) {
    this.nodes.clear();this.rests.clear();this.materials.clear();this.morphs.clear();const nodes:NodeInfo[]=[],layers:NodeInfo[]=[],morphs:string[]=[];let index=0,vertices=0;
    this.avatarRoot.traverse(o=>{
      const id=(o.name||"node")+" ["+(index++)+"]";this.nodes.set(id,o);this.rests.set(o,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});
      const m=o as T.Mesh;const entry={id,name:o.name||"Mesh "+index,bone:(o as T.Bone).isBone||false,mesh:m.isMesh||false};nodes.push(entry);
      if(m.isMesh){layers.push(entry);vertices+=m.geometry.attributes.position?.count||0;
        for(const [n,i] of Object.entries(m.morphTargetDictionary||{})){const target=id+"::"+n;morphs.push(target);this.morphs.set(target,{mesh:m,index:i});}
        for(const mat of Array.isArray(m.material)?m.material:[m.material])if((mat as T.MeshStandardMaterial).isMeshStandardMaterial){const a=mat as T.MeshStandardMaterial;this.materials.set(a,{color:a.color.clone(),emissive:a.emissive.clone(),emission:a.emissiveIntensity});}
      }
    });
    this.face=new MouthlessFace(this.avatarRoot);
    this.robot=new RobotRig(this.avatarRoot);
    const rig=autoRigMapping(nodes);this.info={name,nodes,layers,morphs,animations:this.avatar?.clips.map(c=>c.name)||[],vertices,builtin,faceRig:this.face.available,robot:this.robot.available,rig};
    this.rig=new HumanoidRig(this.actor,this.nodes,this.rests,rig);
    this.editor?.dispose();this.poseBinding=new PoseBinding(this.avatarRoot,this.rests);this.posePlayer=new PosePlayer(this.poseBinding);this.editor=new BoneEditor(this.poseBinding,this.rig,this.camera,this.canvas,this.controls);
    this.appearance=undefined;
  }
  setConfig(c:Config) {
    const old=this.config;this.config=c;
    if(old.avatar.hidden!==c.avatar.hidden)this.hidden=new Set(c.avatar.hidden);
    if(old.avatar.rigMap!==c.avatar.rigMap)this.rig.bind({...this.info.rig,...c.avatar.rigMap});
    if(old.world.type!==c.world.type||old.world.accent!==c.world.accent)this.buildWorld();
    if(old.camera!==c.camera){this.camera.position.fromArray(c.camera.position);this.controls.target.fromArray(c.camera.target);this.controls.update();}
    if(old.output.quality!==c.output.quality){for(const target of [this.composer.renderTarget1,this.composer.renderTarget2]){target.samples=c.output.quality==="ultra"?4:0;target.dispose();}}
    if(old.output.resolution!==c.output.resolution){const h=Number(c.output.resolution);this.renderer.setSize(Math.round(h*16/9),h,false);this.composer.setSize(Math.round(h*16/9),h);this.grade.uniforms.resolution.value.set(Math.round(h*16/9),h);}
  }
  frameCamera(preset:"bust"|"portrait"|"full"|"reset") {
    if(preset==="portrait"){this.camera.position.set(0,2.85,3.1);this.controls.target.set(0,2.85,0);}
    else if(preset==="full"){this.camera.position.set(0,1.9,6.5);this.controls.target.set(0,1.75,0);}
    else {this.camera.position.set(0,2.45,5.2);this.controls.target.set(0,2.12,0);}
    this.controls.update();
  }
  findBone(...aliases:string[]) {return [...this.nodes.values()].find(o=>{const n=normalizedName(o.name).replace(/^mixamorig/,"");return aliases.some(a=>n===normalizedName(a)||n.endsWith(normalizedName(a)));});}
  get head(){return this.config.avatar.headBone!=="auto"?this.nodes.get(this.config.avatar.headBone):this.findBone("head","HeadBone","J_Bip_C_Head");}
  resetPose(){for(const[o,r]of this.rests){o.position.copy(r.p);o.quaternion.copy(r.q);o.scale.copy(r.s);if((o as T.Mesh).morphTargetInfluences)(o as T.Mesh).morphTargetInfluences!.fill(0);}}
  async loadAvatar(files:File[],character?:HighcoonId) {
    if(!this.running)return;const token=++this.generation;const next=await loadFiles(files);if(token!==this.generation){disposeTree(next.root);return;}
    if(this.avatarRoot)disposeTree(this.avatarRoot);this.director?.dispose();this.avatar=next;
    const normalized=new T.Group();normalized.name="Avatar_wrapper";normalized.add(next.root);next.root.updateMatrixWorld(true);
    const b=new T.Box3().setFromObject(next.root),size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3()),scale=3.5/(size.y||size.length());
    normalized.scale.setScalar(scale);next.root.position.x-=center.x;next.root.position.z-=center.z;next.root.position.y-=b.min.y;
    this.avatarRoot=normalized;this.actor.add(normalized);this.director=new AnimationDirector(next.root,next.clips);this.mixer=this.director.mixer;this.currentAnimation="";this.inspect(character?CHARACTERS.find(a=>a.id===character)!.name:next.name,!!character);this.calibrated=null;
    return this.info;
  }
  loadCharacter(id:HighcoonId){return characterFile(id).then(file=>this.loadAvatar([file],id));}
  useBuiltin(){++this.generation;this.director?.dispose();this.director=undefined;this.mixer=undefined;this.avatar=undefined;disposeTree(this.avatarRoot);this.avatarRoot=createAvatar();this.actor.add(this.avatarRoot);this.inspect("SGX // 01",true);this.calibrated=null;return this.info;}
  async modelBlob(){return !this.robot.available&&this.avatar?.blob?this.avatar.blob:await exportGLB(this.avatarRoot);}
  async loadWorld(files:File[]){const token=++this.worldGeneration,next=await loadFiles(files);if(token!==this.worldGeneration){disposeTree(next.root);return;}
    if(this.importedWorld)disposeTree(this.importedWorld.root);this.importedWorld=next;
    const b=new T.Box3().setFromObject(next.root),size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3()),scale=8/Math.max(size.x,size.y,size.z);next.root.scale.multiplyScalar(scale);next.root.position.set(-center.x*scale,-b.min.y*scale,-center.z*scale-2);this.buildWorld();return next.name;
  }
  clearWorld(){++this.worldGeneration;if(this.importedWorld)disposeTree(this.importedWorld.root);this.importedWorld=undefined;this.buildWorld();}
  clearMedia(){++this.mediaGeneration;this.mediaVideo?.pause();if(this.mediaTexture?.image instanceof ImageBitmap)this.mediaTexture.image.close();this.mediaTexture?.dispose();if(this.mediaURL)URL.revokeObjectURL(this.mediaURL);this.mediaURL=undefined;this.mediaTexture=undefined;this.mediaVideo=undefined;}
  buildWorld() {
    if(this.importedWorld)this.importedWorld.root.removeFromParent();
    while(this.world.children.length)disposeTree(this.world.children[0]);
    const type=this.config.world.type,accent=this.config.world.accent;
    if(type==="custom"&&this.importedWorld){this.world.add(this.importedWorld.root);return;}
    if(!["studio","grid","orbit","garden"].includes(type))return;
    const mat=new T.MeshStandardMaterial({color:0x0e1924,metalness:.8,roughness:.43});
    const neon=new T.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:1.7});
    const ground=new T.Mesh(new T.CircleGeometry(14,64),mat);ground.rotation.x=-Math.PI/2;ground.position.y=-.025;this.world.add(ground);
    const grid=new T.GridHelper(28,40,accent,0x1d3141);grid.position.y=-.005;(grid.material as T.Material).transparent=true;(grid.material as T.Material).opacity=.22;this.world.add(grid);
    const ring=(r:number,y:number,z:number)=>{const m=new T.Mesh(new T.TorusGeometry(r,.018,8,80),neon.clone());m.position.set(0,y,z);this.world.add(m);return m;};
    if(type==="studio") {
      ring(1.7,2.25,-1.4);const platform=new T.Mesh(new T.CylinderGeometry(1.28,1.4,.10,64),mat.clone());platform.position.y=-.07;this.world.add(platform);
      const floorRing=ring(1.29,0,0);floorRing.rotation.x=-Math.PI/2;
      for(const x of [-3.0,3.0]){const p=new T.Mesh(new T.BoxGeometry(.11,5,.12),neon.clone());p.position.set(x,2,-3);this.world.add(p);}
    } else if(type==="orbit") {
      for(let i=0;i<5;i++){const r=ring(2+i*.35,2,-1.6);r.rotation.set(i*.18,i*.17,.4*i);r.userData.spin=.04*(i+1);}
      for(let i=0;i<32;i++){const m=new T.Mesh(new T.IcosahedronGeometry(.07+(i%5)*.025),i%3===0?neon.clone():mat.clone());m.position.set(Math.sin(i*2.4)*4,1+(i*.71)%4,Math.cos(i*2.4)*3-3);m.userData.spin=.18;this.world.add(m);}
    } else if(type==="garden") {
      for(let i=0;i<30;i++){const h=.4+(i*.713)%3,cone=new T.Mesh(new T.ConeGeometry(.2+(i%4)*.06,h,5),new T.MeshStandardMaterial({color:accent,metalness:.35,roughness:.4,emissive:accent,emissiveIntensity:.14}));cone.position.set(Math.sin(i*4.92)*(2.8+(i%3)),h/2,Math.cos(i*4.92)*3-3);cone.rotation.y=i;this.world.add(cone);}
      ring(2,2,-3).rotation.y=.3;
    }
  }
  async loadMedia(file:File){
    if(file.size>40*1024*1024)throw new Error("Backgrounds must be below 40 MB.");const token=++this.mediaGeneration;const url=URL.createObjectURL(file);let texture:T.Texture,video:HTMLVideoElement|undefined;
    try {
      if(file.type.startsWith("video/")){video=document.createElement("video");video.src=url;video.muted=true;video.loop=true;video.playsInline=true;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("Video took too long to load.")),20000);video!.onloadeddata=()=>{clearTimeout(timer);resolve();};video!.onerror=()=>{clearTimeout(timer);reject(new Error("Video could not be decoded."));};video!.load();});await video.play();texture=new T.VideoTexture(video);}
      else {const image=await createImageBitmap(file);if(image.width*image.height>64000000){image.close();throw new Error("Use an image below 64 megapixels.");}texture=new T.Texture(image);texture.needsUpdate=true;}
      texture.colorSpace=T.SRGBColorSpace;
      if(token!==this.mediaGeneration){texture.dispose();video?.pause();URL.revokeObjectURL(url);return;}
      this.mediaTexture?.dispose();if(this.mediaTexture?.image instanceof ImageBitmap)this.mediaTexture.image.close();this.mediaVideo?.pause();if(this.mediaURL)URL.revokeObjectURL(this.mediaURL);
      this.mediaTexture=texture;this.mediaVideo=video;this.mediaURL=url;
    }catch(e){video?.pause();URL.revokeObjectURL(url);throw e;}
  }
  calibrate(){const q=this.raw.matrix?this.matrixRotation(this.raw.matrix):new T.Quaternion();this.calibrated=q;this.neutralExpressions={...sourceSignals(this.raw.signals)};}
  matrixRotation(data:number[]){const m=new T.Matrix4().fromArray(data);if(Math.abs(data[3])+Math.abs(data[7])+Math.abs(data[11])>Math.abs(data[12])+Math.abs(data[13])+Math.abs(data[14]))m.transpose();const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();m.decompose(p,q,s);return q.normalize();}
  testHandRig(){this.handTestStart=performance.now();this.handTestUntil=this.handTestStart+8000;}
  cancelHandRigTest(){this.handTestUntil=0;}
  setTracking(f:TrackingFrame){this.raw=f;if(this.config.frozen)return;if(f.hands){this.hands=f.hands;this.lastHands=f.handTime??f.time;}if(f.pose){this.pose=f.pose;this.poseWorld=f.poseWorld;this.lastPose=f.poseTime??f.time;}}
  async startMic(deviceId?:string){const token=++this.micGeneration;await this.releaseMic();if(token!==this.micGeneration)return;
    const stream=await navigator.mediaDevices.getUserMedia({audio:deviceId?{deviceId:{exact:deviceId},echoCancellation:true,noiseSuppression:true}:true});
    if(token!==this.micGeneration){stream.getTracks().forEach(t=>t.stop());return;}
    let context:AudioContext|undefined;
    try {context=new AudioContext();this.audioContext=context;this.mic=stream;await context.resume();if(token!==this.micGeneration){stream.getTracks().forEach(t=>t.stop());if(context.state!=="closed")await context.close();return;}this.audioInput=context.createMediaStreamSource(stream);this.analyser=context.createAnalyser();this.analyser.fftSize=1024;this.analyser.smoothingTimeConstant=.25;this.audioInput.connect(this.analyser);this.audioData=new Uint8Array(this.analyser.frequencyBinCount);this.wave=new Float32Array(this.analyser.fftSize);}catch(e){stream.getTracks().forEach(t=>t.stop());if(context&&context.state!=="closed")await context.close();if(token===this.micGeneration)await this.releaseMic();throw e;}}
  private async releaseMic(){const context=this.audioContext;this.mic?.getTracks().forEach(t=>t.stop());this.audioInput?.disconnect();this.analyser?.disconnect();this.mic=undefined;this.audioContext=undefined;this.audioInput=undefined;this.analyser=undefined;this.audioSignals={audio:0,bass:0,mid:0,treble:0};if(context&&context.state!=="closed")await context.close();}
  async stopMic(){++this.micGeneration;await this.releaseMic();}
  sampleAudio(dt:number){if(!this.analyser||!this.audioData||!this.wave)return;
    this.analyser.getByteFrequencyData(this.audioData);this.analyser.getFloatTimeDomainData(this.wave);let rms=0;for(const v of this.wave)rms+=v*v;rms=Math.sqrt(rms/this.wave.length);
    const c=this.config.audio,target:Signals={audio:clamp((rms-c.gate)*c.gain*3)};
    const hz=(this.audioContext?.sampleRate||48000)/this.analyser.fftSize;
    for(const[name,low,high]of [["bass",70,250],["mid",250,2500],["treble",2500,10000]] as const){let n=0,sum=0;for(let i=Math.ceil(low/hz);i<Math.min(this.audioData.length,Math.floor(high/hz));i++){sum+=this.audioData[i]/255;n++;}target[name]=rms>c.gate?clamp(sum/Math.max(n,1)*c.gain*.6):0;}
    for(const[name,value]of Object.entries(target)){const before=this.audioSignals[name]||0;this.audioSignals[name]=T.MathUtils.lerp(before,value,1-Math.exp(-dt/(value>before ? .025 : .16)));}
  }
  tick=(now:number)=>{
    if(!this.running)return;this.raf=requestAnimationFrame(this.tick);if(this.contextLost)return;
    const dt=Math.min(.05,(now-(this.lastTime||now))/1000);this.lastTime=now;const t=(now-this.startTime)/1000,c=this.config;this.sampleAudio(dt);
    let target=c.demo?demoSignals(t):now-this.raw.time<650?sourceSignals(this.raw.signals):{};
    if(!c.demo&&this.raw.matrix&&now-this.raw.time<650){const q=this.matrixRotation(this.raw.matrix);if(this.calibrated)q.premultiply(this.calibrated.clone().invert());const e=new T.Euler().setFromQuaternion(q,"YXZ");target.headX=clamp(e.x,-1,1);target.headY=clamp(e.y,-1,1);target.headZ=clamp(e.z,-1,1);}
    target={...target,...this.audioSignals,...this.manual};
    const g=c.tracking;for(const k of Object.keys(target)){
      let gain=k.startsWith("head")?g.head:k.startsWith("blink")||k.startsWith("eyeBlink")?g.blink:k.startsWith("look")||k.startsWith("eyeLook")?g.eyes:k==="smile"||k.startsWith("mouthSmile")?g.smile:k.startsWith("brow")?g.brows:k==="mouthOpen"||k==="jawOpen"?g.mouth:1;
      target[k]=(target[k]||0)*gain;
    }
    target.mouthOpen=Math.max(target.mouthOpen||0,(target.audio||0)*c.audio.jaw);
    if(c.mode==="HYPE"){target.smile=Math.max(target.smile||0,.65);target.browUp=Math.max(target.browUp||0,.35);}
    if(c.mode==="SERIOUS"){target.browDown=Math.max(target.browDown||0,.5);target.frown=Math.max(target.frown||0,.4);}
    if(c.mode==="WTF"){target.browUp=Math.max(target.browUp||0,1);target.mouthOpen=Math.max(target.mouthOpen||0,.4);}
    target.jawOpen=Math.max(target.jawOpen||0,target.mouthOpen||0);target.browInnerUp=Math.max(target.browInnerUp||0,target.browUp||0);
    for(const side of ["Left","Right"]){target["mouthSmile"+side]=Math.max(target["mouthSmile"+side]||0,target.smile||0);target["mouthFrown"+side]=Math.max(target["mouthFrown"+side]||0,target.frown||0);target["browDown"+side]=Math.max(target["browDown"+side]||0,target.browDown||0);if(c.mode==="WTF")target["eyeWide"+side]=.85;}
    if(!c.frozen)for(const k of new Set([...Object.keys(target),...Object.keys(this.signals)])){const before=this.signals[k]||0,next=target[k]||0;this.signals[k]=T.MathUtils.lerp(before,next,trackingSignalAlpha(k,g.smoothing,next-before,dt));}
    this.resetPose();this.robot.shape(c);if(this.appearance!==c.robot){this.poseBinding.setAppearanceReference();if(this.robot.available)this.rig.refreshReference();this.appearance=c.robot;}
    this.director?.update(c,dt);
    const s=this.signals,head=this.head;
    if(head){this.actor.rotation.x=0;this.actor.rotation.z=0;}
    else{this.actor.rotation.x=s.headX||0;this.actor.rotation.z=(s.headZ||0)*.6;}
    if(!this.face.available)for(const side of ["Left","Right"]){const eye=this.findBone("eye"+side,side+"Eye","J_Adj_"+(side==="Left"?"L":"R")+"_FaceEye");if(eye){eye.rotateY((s.lookX||0)*.18);eye.rotateX(-(s.lookY||0)*.15);}}
    this.actor.position.y=c.avatar.y;this.actor.scale.setScalar(c.avatar.scale);this.actor.rotation.y=T.MathUtils.degToRad(c.avatar.yaw)+(head?0:(s.headY||0)*(g.mirror?-1:1));this.actor.updateMatrixWorld(true);
    const handTest=now<this.handTestUntil?handRigCheck((now-this.handTestStart)/1000):undefined;
    const rigConfig=handTest?{...trackingForMotion(c),tracking:{...g,pose:false,hands:true,handsGain:1,wristGain:1,fingerGain:1}}:trackingForMotion(c);
    const handInput=handTest?{hands:handTest.hands,lastHands:now}:puppetHands(c,this.hands,this.lastHands,now);
    this.rig.update(rigConfig,{pose:this.pose,poseWorld:this.poseWorld,...handInput,lastPose:this.lastPose},now,dt);
    if(!c.frozen)this.headTracking=c.demo||(this.raw.faceDetected??!!this.raw.face?.length)&&!!this.raw.matrix&&now-this.raw.time<650||Object.keys(this.manual).some(k=>k.startsWith("head"));
    if(head&&this.headTracking){const rotation=new T.Euler(s.headX||0,(s.headY||0)*(g.mirror?-1:1),(s.headZ||0)*(g.mirror?-1:1),"YXZ");this.rig.headRotation(head,new T.Quaternion().setFromEuler(rotation));}
    this.face.apply(c,s);this.powers.update(c,s,dt);
    const hidden=this.hidden;for(const[id,node]of this.nodes)node.visible=!hidden.has(id);
    if(c.avatar.tint)this.tint.set(c.avatar.color);
    for(const[material,base]of this.materials){material.color.copy(base.color);material.emissive.copy(base.emissive);if(c.avatar.tint)material.color.lerp(this.tint,.65);material.wireframe=c.avatar.wireframe||c.mode==="TECH";material.emissiveIntensity=base.emission+(s.audio||0)*c.audio.glow*3;if((s.audio||0)>0&&c.audio.glow>0&&base.emissive.getHex()===0)material.emissive.copy(material.color);if(c.mode==="TERP")material.emissiveIntensity+=.5;}
    this.robot.apply(c,s,true);
    const sums=this.sums;sums.clear();
    for(const m of c.mappings){if(!m.enabled)continue;const value=mappingValue(m,s);
      if(m.kind==="morph"){sums.set(m.target,clamp((sums.get(m.target)||0)+value));continue;}
      const node=this.nodes.get(m.target);if(!node)continue;
      if(m.kind==="scale")node.scale.multiplyScalar(1+value);
      if(m.kind==="scaleX")node.scale.x*=1+value;if(m.kind==="scaleY")node.scale.y*=1+value;if(m.kind==="scaleZ")node.scale.z*=1+value;
      if(m.kind==="translateX")node.position.x+=value;if(m.kind==="translateY")node.position.y+=value;if(m.kind==="translateZ")node.position.z+=value;
      if(m.kind==="rotateX")node.rotateX(value);if(m.kind==="rotateY")node.rotateY(value);if(m.kind==="rotateZ")node.rotateZ(value);
      if(m.kind==="visibility")node.visible=!hidden.has(m.target)&&value>.5;
      if(m.kind==="emission"){const mats=(node as T.Mesh).material;if(mats)for(const mat of Array.isArray(mats)?mats:[mats])if((mat as T.MeshStandardMaterial).isMeshStandardMaterial){const p=mat as T.MeshStandardMaterial;if(p.emissive.getHex()===0)p.emissive.copy(p.color);p.emissiveIntensity+=value*3;}}
    }
    for(const[target,value]of sums){const entry=this.morphs.get(target);if(entry&&entry.mesh.morphTargetInfluences)entry.mesh.morphTargetInfluences[entry.index]=value;}
    const skipFingers=this.skipFingers;skipFingers.clear();if(c.puppet.left!=="none"||c.puppet.right!=="none")for(const[role,node]of this.rig.joints){const side=role.startsWith("left")?"left":"right";if(c.puppet[side]!=="none"&&/Proximal|Intermediate|Distal/.test(role)){const b=this.poseBinding.byNode.get(node);if(b)skipFingers.add(b.key);}}
    const performanceState=this.posePlayer.update(c.performance,dt,c.frozen,this.editor.enabled,skipFingers);this.editor.setPlaying(c.performance.mode==="clip"&&c.performance.playing);this.editor.update();
    this.world.rotation.y=T.MathUtils.degToRad(c.world.rotation);this.world.scale.setScalar(c.world.scale);this.world.position.y=c.world.y;
    for(const node of this.world.children)if(node.userData.spin&&!c.frozen)node.rotation.y+=dt*c.world.speed*node.userData.spin;
    const flat=["transparent","chroma","solid","image","video"].includes(c.world.type);
    this.world.visible=!flat;this.fog.color.set(c.world.color);this.fog.density=c.world.fog;this.scene.fog=flat||!c.world.fog?null:this.fog;
    this.scene.background=c.world.type==="transparent"?null:c.world.type==="chroma"?this.background.set(0x00ff00):["image","video"].includes(c.world.type)&&this.mediaTexture?this.mediaTexture:this.background.set(c.world.color);
    this.scene.backgroundIntensity=1;this.renderer.setClearColor(0x000000,c.world.type==="transparent"?0:1);this.renderer.toneMappingExposure=c.fx.exposure;
    this.lights.key.intensity=c.world.light*2;this.lights.fill.intensity=c.world.light;this.lights.rim.color.set(c.world.accent);this.lights.rim.intensity=c.world.light*2;
    const pp=this.particles.geometry.attributes.position as T.BufferAttribute;const strength=c.world.particles+(c.mode==="TERP"?.4:0)+(s.audio||0)*c.audio.particles*.4;
    this.particles.visible=strength>0&&!["transparent","chroma"].includes(c.world.type);(this.particles.material as T.PointsMaterial).color.set(c.mode==="TERP"?0xfdcc0d:c.world.accent);(this.particles.material as T.PointsMaterial).size=.014+strength*.02;
    const particleCount=Math.round(clamp(strength)*600);this.particles.geometry.setDrawRange(0,particleCount);if(!c.frozen&&this.particles.visible){for(let i=0;i<particleCount;i++){const k=i*4;pp.setXYZ(i,this.seeds[k]+Math.sin(t*.3+this.seeds[k+3]*6)*.10,(this.seeds[k+1]+t*c.world.speed*.12)%5,this.seeds[k+2]);}pp.needsUpdate=true;}
    this.bloom.strength=c.fx.bloom;this.bloom.enabled=c.fx.bloom>0&&c.output.quality!=="performance";
    const u=this.grade.uniforms;u.time.value=t;u.rgb.value=c.fx.chromatic;u.pixel.value=c.fx.pixel;u.glitch.value=c.fx.glitch;u.vignette.value=c.fx.vignette;u.saturation.value=c.fx.saturation;u.grain.value=c.fx.grain;
    this.controls.update();
    presentFrame(()=>{if(["transparent","chroma"].includes(c.world.type))this.renderer.render(this.scene,this.camera);else this.composer.render(dt);},()=>this.copyOutput(),()=>{const auto=this.renderer.autoClear;this.renderer.autoClear=false;this.renderer.clearDepth();this.renderer.render(this.editor.scene,this.camera);this.renderer.autoClear=auto;},this.captureActive||!!this.popup&&!this.popup.closed,this.editor.enabled);
    this.lastOverlay=this.editor.enabled;
    if(this.popup&&!this.popup.closed){const out=this.popup.document.querySelector("canvas");if(out){if(out.width!==this.outputCanvas.width||out.height!==this.outputCanvas.height){out.width=this.outputCanvas.width;out.height=this.outputCanvas.height;}const ctx=out.getContext("2d");ctx?.clearRect(0,0,out.width,out.height);ctx?.drawImage(this.outputCanvas,0,0);}}
    this.frames++;if(now-this.lastStats>500){this.stats?.({fps:Math.round(this.frames*1000/(now-this.lastStats)),signals:{...s},audio:{...this.audioSignals},inference:this.raw.inference,face:(this.raw.faceDetected??!!this.raw.face?.length)&&now-this.raw.time<650,animation:this.director?.active,overload:this.powers.remaining,handTest:handTest?.gesture,poseTime:performanceState.time,poseEnded:performanceState.ended,performanceMode:performanceState.mode});this.lastStats=now;this.frames=0;}
  };
  private copyOutput(){const out=this.outputCanvas;if(out.width!==this.canvas.width||out.height!==this.canvas.height){out.width=this.canvas.width;out.height=this.canvas.height;}const ctx=out.getContext("2d");ctx?.clearRect(0,0,out.width,out.height);ctx?.drawImage(this.canvas,0,0);}
  cleanFrameCanvas(){if(!this.lastOverlay)this.copyOutput();return this.outputCanvas;}
  previewImage(){const out=this.previewCanvas;out.width=320;out.height=180;const ctx=out.getContext("2d");if(!ctx||!this.running||this.contextLost)return null;ctx.fillStyle="#071019";ctx.fillRect(0,0,320,180);ctx.drawImage(this.lastOverlay?this.outputCanvas:this.canvas,0,0,320,180);for(const quality of [.6,.4,.2]){const image=out.toDataURL("image/jpeg",quality);if(image.length<=12000)return image;}return null;}
  openOutput(){this.popup=window.open("","sgx-clean-output","popup,width=1280,height=720");if(!this.popup)throw new Error("Allow popups to open the clean output window.");this.popup.document.title="SGX · Clean output";this.popup.document.body.innerHTML='<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}canvas{width:100%;height:100%;object-fit:contain}</style><canvas></canvas>';}
  dispose(){this.running=false;++this.generation;++this.worldGeneration;++this.mediaGeneration;cancelAnimationFrame(this.raf);this.canvas.removeEventListener("webglcontextlost",this.onContextLost);this.canvas.removeEventListener("webglcontextrestored",this.onContextRestored);void this.stopMic();this.editor.dispose();this.director?.dispose();this.powers.dispose();this.controls.dispose();if(this.importedWorld)this.importedWorld.root.removeFromParent();disposeTree(this.avatarRoot);disposeTree(this.world);if(this.importedWorld)disposeTree(this.importedWorld.root);disposeTree(this.particles);this.mediaVideo?.pause();if(this.mediaURL)URL.revokeObjectURL(this.mediaURL);if(this.mediaTexture?.image instanceof ImageBitmap)this.mediaTexture.image.close();this.mediaTexture?.dispose();this.envTexture.dispose();this.pmrem.dispose();this.composer.dispose();this.bloom.dispose();this.grade.dispose();this.renderer.dispose();this.popup?.close();}
}
