import * as T from "three";
type Contact={mesh:T.Mesh;index:number;rest:T.Vector3};

/** Cache a small set of actual sole vertices; skin weights remain untouched. */
export class FootContacts {
 private contacts:Contact[]=[];
 private inverse=new T.Matrix4();
 private point=new T.Vector3();
 rebuild(actor:T.Object3D,feet:readonly (readonly [T.Object3D,T.Object3D|undefined])[],references?:ReadonlyMap<T.Object3D,T.Matrix4>){
  this.contacts=[];if(!feet.length)return;
  actor.updateMatrixWorld(true);this.inverse.copy(actor.matrixWorld).invert();
  const sides=feet.map(([foot,toes])=>new Set([foot,...(toes?[toes]:[])]));
  const candidates:Contact[][]=feet.map(()=>[]),bottom=feet.map(()=>Infinity),band=.006;
  const worlds=new Map<T.Object3D,T.Matrix4>(),world=(node:T.Object3D)=>{let m=worlds.get(node);if(!m){const reference=references?.get(node);m=reference?reference.clone().invert().premultiply(actor.matrixWorld):node.matrixWorld.clone();worlds.set(node,m);}return m;};
  const base=new T.Vector3(),weighted=new T.Vector3();
  actor.traverse(node=>{
   const mesh=node as T.SkinnedMesh;if(!mesh.isMesh||!mesh.geometry.attributes.position)return;
   const skin=!!mesh.isSkinnedMesh,joints=skin?mesh.skeleton.bones.map(b=>sides.findIndex(side=>side.has(b))):[];
   let rigid=-1;if(!skin)for(let parent:T.Object3D|null=mesh.parent;parent&&rigid<0;parent=parent.parent)rigid=sides.findIndex(side=>side.has(parent!));
   if(skin&&!joints.some(s=>s>=0)||!skin&&rigid<0)return;
   const position=mesh.geometry.attributes.position,weights=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex;
   const meshWorld=world(mesh),boneMatrices=skin?mesh.skeleton.bones.map((b,i)=>world(b).clone().multiply(mesh.skeleton.boneInverses[i])):[];
   const bindInverse=skin?(mesh.bindMode===T.AttachedBindMode?meshWorld.clone().invert():mesh.bindMatrixInverse):undefined;
   for(let i=0;i<position.count;i++){
    let side=rigid;
    if(skin){const influence=feet.map(()=>0);for(let j=0;j<4;j++){const s=joints[indices.getComponent(i,j)];if(s>=0)influence[s]+=weights.getComponent(i,j);}side=influence.findIndex(w=>w>=.55);}
    if(side<0)continue;
    this.point.fromBufferAttribute(position,i);
    if(skin){base.copy(this.point).applyMatrix4(mesh.bindMatrix);this.point.set(0,0,0);for(let j=0;j<4;j++){const w=weights.getComponent(i,j);if(w>0)this.point.addScaledVector(weighted.copy(base).applyMatrix4(boneMatrices[indices.getComponent(i,j)]),w);}this.point.applyMatrix4(bindInverse!);}
    this.point.applyMatrix4(meshWorld).applyMatrix4(this.inverse);
    if(this.point.y<bottom[side]){bottom[side]=this.point.y;candidates[side]=candidates[side].filter(c=>c.rest.y<=bottom[side]+band);}
    if(this.point.y<=bottom[side]+band)candidates[side].push({mesh,index:i,rest:this.point.clone()});
   }
  });
  for(const sole of candidates){
   const selected=new Set<Contact>();
   for(let i=0;i<8;i++){const x=Math.cos(i*Math.PI/4),z=Math.sin(i*Math.PI/4);let best:Contact|undefined;for(const c of sole)if(!best||c.rest.x*x+c.rest.z*z>best.rest.x*x+best.rest.z*z)best=c;if(best)selected.add(best);}
   this.contacts.push(...selected);
  }
 }
 correction(actor:T.Object3D):number|undefined{
  if(!this.contacts.length)return;
  let live=Infinity,rest=Infinity;
  for(const c of this.contacts){
   const mesh=c.mesh as T.SkinnedMesh;this.point.fromBufferAttribute(mesh.geometry.attributes.position,c.index);if(mesh.isSkinnedMesh)mesh.applyBoneTransform(c.index,this.point);
   live=Math.min(live,this.point.applyMatrix4(mesh.matrixWorld).y);rest=Math.min(rest,this.point.copy(c.rest).applyMatrix4(actor.matrixWorld).y);
  }
  const offset=rest-live;return Number.isFinite(offset)?offset:undefined;
 }
 get size(){return this.contacts.length;}
}
