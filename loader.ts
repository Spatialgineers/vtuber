import * as T from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { disposeTree } from "./avatar";
import {robotExportSnapshot} from "./robot-export";

export const MAX_ASSET=40*1024*1024;
export type Loaded = { root:T.Group; clips:T.AnimationClip[]; blob:Blob; name:string };
export async function exportGLB(root:T.Object3D,clips:T.AnimationClip[]=[]) {
  const exporter=new GLTFExporter();
  let robot=false;root.traverse(o=>{if(o.userData.sgxRobot===true)robot=true;});
  const snapshot=robot?robotExportSnapshot(root):root;
  try{const buffer=await exporter.parseAsync(snapshot,{binary:true,animations:clips,onlyVisible:false}) as ArrayBuffer;return new Blob([buffer],{type:"model/gltf-binary"});}
  finally{if(snapshot!==root)disposeTree(snapshot);}
}
export async function loadFiles(files:File[]):Promise<Loaded> {
  if(files.reduce((n,f)=>n+f.size,0)>MAX_ASSET) throw new Error("Use an asset below 40 MB, including textures.");
  const main=files.find(f=>/\.(glb|gltf)$/i.test(f.name));if(!main)throw new Error("Choose a .glb, or a .gltf together with its .bin and textures.");
  const urls=new Map<string,string>();
  for(const f of files){const path=f.webkitRelativePath||f.name;urls.set(path,URL.createObjectURL(f));if(!urls.has(f.name))urls.set(f.name,urls.get(path)!);}
  const manager=new T.LoadingManager();let missing="";
  manager.setURLModifier(uri=>{
    if(uri.startsWith("data:")||uri.startsWith("blob:"))return uri;
    const clean=decodeURIComponent(uri).replace(/^\.\//,"");
    const resolved=urls.get(clean)||urls.get(clean.split("/").at(-1)!);
    if(!resolved){missing=clean;throw new Error("Missing local dependency: "+clean+". Select all model files together.");}
    return resolved;
  });
  manager.onError=(url)=>{missing=url;};
  const draco=new DRACOLoader();draco.setDecoderPath("/draco/");
  const loader=new GLTFLoader(manager);loader.setDRACOLoader(draco);loader.setMeshoptDecoder(MeshoptDecoder);
  let gltf:GLTF|undefined;
  try {
    const data=await main.arrayBuffer();
    gltf=await loader.parseAsync(/\.gltf$/i.test(main.name)?new TextDecoder().decode(data):data,"");
    if(missing)throw new Error("A model texture or buffer failed: "+missing);
    let meshes=0,vertices=0;gltf.scene.traverse(o=>{if((o as T.Mesh).isMesh){meshes++;vertices+=((o as T.Mesh).geometry.attributes.position?.count||0);}});
    if(!meshes||vertices>2000000||meshes>500)throw new Error("The model must contain meshes and stay below 2 million vertices / 500 meshes.");
    const box=new T.Box3().setFromObject(gltf.scene);const size=box.getSize(new T.Vector3());
    if(!Number.isFinite(size.length())||size.length()<.000001)throw new Error("This model has no usable dimensions.");
    const external=[...(gltf.parser.json.buffers||[]),...(gltf.parser.json.images||[])].some((r:{uri?:string})=>r.uri&&!r.uri.startsWith("data:"));
    const blob=/\.glb$/i.test(main.name)&&!external?new Blob([data],{type:"model/gltf-binary"}):await exportGLB(gltf.scene,gltf.animations);
    return {root:gltf.scene,clips:gltf.animations,blob,name:main.name};
  } catch(e){if(gltf)disposeTree(gltf.scene);throw e;}
  finally {urls.forEach(u=>URL.revokeObjectURL(u));draco.dispose();}
}
export async function fetchAsset(url:string):Promise<File> {
  const u=new URL(url);if(u.protocol!=="https:")throw new Error("Use a direct HTTPS file link.");
  const response=await fetch(u,{credentials:"omit",signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error("The file link could not be loaded. Try uploading the file instead.");
  const length=Number(response.headers.get("content-length"));if(length>MAX_ASSET)throw new Error("The file must be below 40 MB.");
  const reader=response.body?.getReader();if(!reader)throw new Error("No file data was returned.");
  const chunks:Uint8Array<ArrayBuffer>[]=[];let bytes=0;
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>MAX_ASSET){await reader.cancel();throw new Error("The file exceeds 40 MB.");}chunks.push(value as Uint8Array<ArrayBuffer>);}
  const name=decodeURIComponent(u.pathname.split("/").at(-1)||"model.glb");
  return new File(chunks,name,{type:response.headers.get("content-type")||"application/octet-stream"});
}
