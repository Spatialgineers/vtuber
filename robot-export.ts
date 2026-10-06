import * as T from "three";
import {clone as cloneSkeleton} from "three/addons/utils/SkeletonUtils.js";
import {clamp,robotDefaults} from "./state";
type Slot="armor"|"metal"|"dark"|"eyes"|"mouth"|"energy";
/** Convert the mechanical hierarchy into rigid skin weights so GLB retains real joints. */
export function robotExportSnapshot(source:T.Object3D){
  const root=cloneSkeleton(source),bones:T.Bone[]=[],meshes:T.Mesh[]=[];
  root.traverse(o=>{if((o as T.Bone).isBone)bones.push(o as T.Bone);if((o as T.Mesh).isMesh){const m=o as T.Mesh;m.geometry=m.geometry.clone();m.material=Array.isArray(m.material)?m.material.map(v=>v.clone()):m.material.clone();meshes.push(m);}});
  root.updateMatrixWorld(true);
  const inverseRoot=root.matrixWorld.clone().invert(),skeleton=new T.Skeleton(bones);
  for(const mesh of meshes){
    if((mesh as T.SkinnedMesh).isSkinnedMesh)continue;
    let parent:T.Object3D|null=mesh.parent;while(parent&&!(parent as T.Bone).isBone)parent=parent.parent;
    const joint=bones.indexOf(parent as T.Bone);if(joint<0)continue;
    const matrix=inverseRoot.clone().multiply(mesh.matrixWorld),geometry=mesh.geometry;geometry.applyMatrix4(matrix);
    for(const attribute of geometry.morphAttributes.position||[]){const transform=matrix.clone();if(geometry.morphTargetsRelative)transform.setPosition(0,0,0);attribute.applyMatrix4(transform);}
    const normal=new T.Matrix3().getNormalMatrix(matrix);for(const attribute of geometry.morphAttributes.normal||[])attribute.applyNormalMatrix(normal);
    const count=geometry.attributes.position.count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);for(let i=0;i<count;i++){indices[i*4]=joint;weights[i*4]=1;}
    geometry.setAttribute("skinIndex",new T.Uint16BufferAttribute(indices,4));geometry.setAttribute("skinWeight",new T.Float32BufferAttribute(weights,4));
    const skin=new T.SkinnedMesh(geometry,mesh.material);skin.name=mesh.name;skin.userData=mesh.userData;skin.visible=mesh.visible;skin.morphTargetDictionary=mesh.morphTargetDictionary?{...mesh.morphTargetDictionary}:undefined;skin.morphTargetInfluences=mesh.morphTargetInfluences?[...mesh.morphTargetInfluences]:undefined;
    root.add(skin);skin.bind(skeleton,root.matrixWorld);mesh.removeFromParent();
  }
  const marker:T.Object3D[]=[];root.traverse(o=>{if(o.userData.sgxRobot===true)marker.push(o);});
  for(const m of marker){const saved=m.userData.sgxRobotLook||robotDefaults(),look={...robotDefaults(),...saved,headScale:1,eyeWidth:1,eyeHeight:1,mouthWidth:1,metalness:1,roughness:1,armLength:1,armWidth:1,legLength:1,legWidth:1,handSize:1,handWidth:1,footSize:1,bodyWidth:1,bodyHeight:1,shoulderWidth:1,hipWidth:1,pose:{}};root.traverse(o=>{const mesh=o as T.Mesh;if(!mesh.isMesh)return;for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){const p=mat as T.MeshStandardMaterial,slot=p.userData.sgxRobotSlot as Slot;if(!p.isMeshStandardMaterial||!["armor","metal","dark","eyes","mouth","energy"].includes(slot))continue;look[slot]="#"+p.color.getHexString();if(slot==="eyes")look.eyeGlow=clamp(p.emissiveIntensity,0,4);if(slot==="mouth")look.mouthGlow=clamp(p.emissiveIntensity,0,4);if(slot==="energy")look.energyGlow=clamp(p.emissiveIntensity,0,4);}});m.userData.sgxRobotLook=look;}
  root.updateMatrixWorld(true);return root;
}
