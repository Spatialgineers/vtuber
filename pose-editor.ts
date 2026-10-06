import * as T from "three";
import {TransformControls} from "three/addons/controls/TransformControls.js";
import type {OrbitControls} from "three/addons/controls/OrbitControls.js";
import type {HumanoidRig} from "./rig";
import {PoseBinding,type PoseBone} from "./pose";
import {solveTwoBone} from "./ik";
import type {PoseFrame} from "./performance-state";

export class BoneEditor {
 scene=new T.Scene();proxy=new T.Object3D();control:TransformControls;handles:T.InstancedMesh;lines:T.LineSegments;selected="";enabled=false;playing=false;ik=true;showBones=true;dragging=false;
 onChange?:(frame:PoseFrame)=>void;onSelect?:(key:string)=>void;onStart?:()=>void;onEnd?:()=>void;
 private ray=new T.Raycaster();private pointer=new T.Vector2();private index:PoseBone[];private m=new T.Matrix4();
 constructor(public binding:PoseBinding,public rig:HumanoidRig,public camera:T.Camera,public canvas:HTMLCanvasElement,public orbit:OrbitControls){
  this.index=binding.bones;this.scene.add(this.proxy);this.control=new TransformControls(camera,canvas);this.control.setSize(.8);this.control.setMode("rotate");this.control.setSpace("local");this.scene.add(this.control.getHelper());
  this.handles=new T.InstancedMesh(new T.SphereGeometry(1,8,6),new T.MeshBasicMaterial({color:0x00eeee,depthTest:false,transparent:true,opacity:.8}),Math.max(1,this.index.length));this.handles.count=this.index.length;this.handles.frustumCulled=false;this.scene.add(this.handles);
  this.lines=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:0x7398b4,depthTest:false,transparent:true,opacity:.5}));this.lines.frustumCulled=false;this.scene.add(this.lines);
  this.control.addEventListener("dragging-changed",e=>{this.dragging=!!e.value;orbit.enabled=!this.dragging;if(this.dragging)this.onStart?.();else this.onEnd?.();});
  this.control.addEventListener("objectChange",()=>this.transform());
  canvas.addEventListener("pointerdown",this.pick,true);canvas.addEventListener("pointercancel",this.cancel);canvas.addEventListener("lostpointercapture",this.cancel);if(typeof window!=="undefined")window.addEventListener("blur",this.cancel);if(typeof document!=="undefined")document.addEventListener("visibilitychange",this.visibility);this.setEnabled(false);
 }
 setEnabled(value:boolean){this.enabled=value;this.scene.visible=value;this.control.enabled=value&&!this.playing;if(!value){this.cancel();this.control.detach();}else if(this.selected)this.select(this.selected);}
 setPlaying(value:boolean){this.playing=value;this.control.enabled=this.enabled&&!value;this.control.getHelper().visible=this.enabled&&!value&&!!this.selected;if(value&&this.dragging)this.cancel();}
 private cancel=()=>{this.control.pointerUp(null);this.dragging=false;this.orbit.enabled=true;};
 private visibility=()=>{if(document.visibilityState!=="visible")this.cancel();};
 select(key:string){this.selected=this.binding.byKey.has(key)?key:"";if(this.selected&&this.enabled){this.syncProxy();this.control.attach(this.proxy);}else this.control.detach();this.onSelect?.(this.selected);}
 setMode(mode:"translate"|"rotate"|"scale"){this.control.setMode(mode);}
 setSpace(space:"local"|"world"){this.control.setSpace(space);}
 setSnap(value:boolean){this.control.setTranslationSnap(value?.1:null);this.control.setRotationSnap(value?T.MathUtils.degToRad(15):null);this.control.setScaleSnap(value?.1:null);}
 chain(node:T.Object3D){for(const side of ["left","right"] as const){const hand=this.rig.joints.get(`${side}Hand`),foot=this.rig.joints.get(`${side}Foot`);if(node===hand)return [this.rig.joints.get(`${side}UpperArm`),this.rig.joints.get(`${side}LowerArm`),hand];if(node===foot)return [this.rig.joints.get(`${side}UpperLeg`),this.rig.joints.get(`${side}LowerLeg`),foot];}return undefined;}
 canIK(key=this.selected){const b=this.binding.byKey.get(key),c=b&&this.chain(b.node);return !!c?.every(Boolean)&&c[1]!.parent===c[0]&&c[2]!.parent===c[1];}
 private syncProxy(){const bone=this.binding.byKey.get(this.selected);if(!bone)return;bone.node.updateWorldMatrix(true,false);bone.node.matrixWorld.decompose(this.proxy.position,this.proxy.quaternion,this.proxy.scale);this.proxy.updateMatrixWorld(true);}
 private transform(){
  if(!this.enabled||this.playing)return;const bone=this.binding.byKey.get(this.selected);if(!bone)return;const node=bone.node,chain=this.ik&&this.control.getMode()==="translate"?this.chain(node):undefined;
  if(chain?.every(Boolean)&&solveTwoBone(chain[0]!,chain[1]!,chain[2]!,this.proxy.position)){}
  else{node.parent?.updateWorldMatrix(true,false);this.proxy.updateMatrixWorld(true);const matrix=this.proxy.matrixWorld.clone();if(node.parent)matrix.premultiply(node.parent.matrixWorld.clone().invert());matrix.decompose(node.position,node.quaternion,node.scale);for(const axis of ["x","y","z"] as const){node.position[axis]=T.MathUtils.clamp(node.position[axis],bone.rest.p[axis]-10000,bone.rest.p[axis]+10000);node.scale[axis]=T.MathUtils.clamp(node.scale[axis]/bone.rest.s[axis],.02,20)*bone.rest.s[axis];}node.quaternion.normalize();node.updateWorldMatrix(true,true);}
  this.onChange?.(this.binding.capture());
 }
 private pick=(e:PointerEvent)=>{
  if(!this.enabled||this.playing||!this.showBones||e.button!==0||this.control.axis!==null)return;
  const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObject(this.handles,false)[0];
  if(hit?.instanceId!==undefined){e.preventDefault();e.stopImmediatePropagation();this.select(this.index[hit.instanceId].key);}
 };
 update(){
  if(!this.enabled)return;this.binding.root.updateWorldMatrix(true,true);const points:number[]=[],cameraPosition=this.camera.getWorldPosition(new T.Vector3());
  for(let i=0;i<this.index.length;i++){const b=this.index[i],p=b.node.getWorldPosition(new T.Vector3()),radius=Math.max(.008,p.distanceTo(cameraPosition)*.005);this.m.compose(p,new T.Quaternion(),new T.Vector3().setScalar(radius*(b.key===this.selected?1.6:1)));this.handles.setMatrixAt(i,this.m);this.handles.setColorAt(i,new T.Color(b.key===this.selected?0xfdcc0d:0x00eeee));if(b.node.parent&&this.binding.byNode.has(b.node.parent)){const a=b.node.parent.getWorldPosition(new T.Vector3());points.push(...a.toArray(),...p.toArray());}}
  this.handles.instanceMatrix.needsUpdate=true;this.handles.computeBoundingSphere();if(this.handles.instanceColor)this.handles.instanceColor.needsUpdate=true;this.handles.visible=this.lines.visible=this.showBones;this.lines.geometry.setAttribute("position",new T.Float32BufferAttribute(points,3));
  if(!this.dragging)this.syncProxy();this.control.getHelper().visible=!this.playing&&!!this.selected;
 }
 dispose(){this.cancel();this.canvas.removeEventListener("pointerdown",this.pick,true);this.canvas.removeEventListener("pointercancel",this.cancel);this.canvas.removeEventListener("lostpointercapture",this.cancel);if(typeof window!=="undefined")window.removeEventListener("blur",this.cancel);if(typeof document!=="undefined")document.removeEventListener("visibilitychange",this.visibility);this.control.detach();this.control.dispose();this.handles.geometry.dispose();(this.handles.material as T.Material).dispose();this.lines.geometry.dispose();(this.lines.material as T.Material).dispose();this.orbit.enabled=true;}
}
