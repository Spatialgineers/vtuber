import * as T from 'three';
import {disposeTree} from './avatar';
import {POWERS,type PowerId} from './highcoon';
import {clamp,type Config,type Signals} from './state';
// Fixed pools. Channel changes update transforms, never allocate effect geometry.
export class PowerEffects{
 root=new T.Group();rings:T.Mesh[]=[];crystals:T.Mesh[]=[];shield:T.Mesh;particles:T.Points;time=0;remaining=0;burstId:PowerId='none';palette=POWERS.map(p=>new T.Color(p.color));color=new T.Color();
 constructor(){
  this.root.name='Highcoon_powers';const rg=new T.TorusGeometry(1,.012,6,80),cg=new T.OctahedronGeometry(.08,0);
  const mat=()=>new T.MeshBasicMaterial({color:0x00eeee,transparent:true,opacity:.6,depthWrite:false,blending:T.AdditiveBlending});
  for(let i=0;i<5;i++){const m=new T.Mesh(rg,mat());this.rings.push(m);this.root.add(m);}for(let i=0;i<16;i++){const m=new T.Mesh(cg,mat());this.crystals.push(m);this.root.add(m);}
  this.shield=new T.Mesh(new T.IcosahedronGeometry(1,2),new T.MeshBasicMaterial({color:0xdc2626,wireframe:true,transparent:true,opacity:.22,depthWrite:false,blending:T.AdditiveBlending}));this.root.add(this.shield);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(320*3),3));g.setAttribute('color',new T.BufferAttribute(new Float32Array(320*3),3));this.particles=new T.Points(g,new T.PointsMaterial({size:.032,vertexColors:true,transparent:true,opacity:.7,depthWrite:false,blending:T.AdditiveBlending}));this.root.add(this.particles);this.root.visible=false;
 }
 burst(id:PowerId){if(id==='none')return;this.burstId=id;this.remaining=8;}
 update(c:Config,s:Signals,dt:number){
  if(!c.frozen){this.time+=dt;this.remaining=Math.max(0,this.remaining-dt);}const id=this.remaining>0?this.burstId:c.power.id,strength=c.power.intensity*(1+clamp(s.audio||0)*c.power.reactivity*.75)*(this.remaining>0?1.65:1);this.root.visible=id!=='none'&&strength>0;if(!this.root.visible)return;
  const preset=POWERS.find(p=>p.id===id),spectrum=id==='spectrum',shape=preset?.shape||'reactor',t=this.time,base=this.color.set(preset?.color||'#a855f7');
  this.shield.visible=shape==='shield'||spectrum;this.shield.position.set(0,1.9,0);this.shield.scale.set(1.06,1.6,1.06).multiplyScalar(1+Math.sin(t*.9)*.025);this.shield.rotation.y=t*.12;const sm=this.shield.material as T.MeshBasicMaterial;sm.color.copy(base);sm.opacity=clamp(.14*strength,0,.4);
  for(let i=0;i<5;i++){const r=this.rings[i],mat=r.material as T.MeshBasicMaterial;r.visible=shape!=='crystal'||i<2;mat.color.copy(spectrum?this.palette[(i*2)%8]:base);mat.opacity=clamp(.38*strength,0,.85);const phase=(t*(shape==='rush'?1.5:.25)+i/5)%1;r.position.set(0,shape==='signal'?.35+phase*3.3:shape==='recovery'?.06+i*.13:1.7,0);r.rotation.set(Math.PI/2,0,0);if(shape==='reactor'||spectrum)r.rotation.set(t*.3+i*.6,t*.22+i*.7,i*.4);if(shape==='rush')r.rotation.set(0,0,t*.2);if(shape==='bloom')r.position.y=.2+i*.11;const scale=shape==='thermal'?.7+i*.17:shape==='signal'?1:shape==='recovery'?.6+i*.19:1+i*.1;r.scale.setScalar(scale*(1+clamp(s.bass||0)*c.power.reactivity*.08));}
  for(let i=0;i<16;i++){const m=this.crystals[i],a=i*Math.PI/8+t*(shape==='rush'?2:.25);m.visible=shape==='crystal'||shape==='bloom'||spectrum;m.position.set(Math.cos(a)*1.1,shape==='bloom'?.2+Math.sin(a*3+t)*.16:1.7+Math.sin(i*1.2+t*.7)*.8,Math.sin(a)*1.1);m.rotation.set(t*.5+i,t*.7,i);m.scale.set(shape==='bloom'?1.8:.75,shape==='crystal'?3:1,shape==='bloom'?.35:1);const mat=m.material as T.MeshBasicMaterial;mat.color.copy(spectrum?this.palette[i%8]:base);mat.opacity=clamp(.5*strength,0,.9);}
  const p=this.particles.geometry.attributes.position as T.BufferAttribute,colors=this.particles.geometry.attributes.color as T.BufferAttribute;this.particles.geometry.setDrawRange(0,Math.round(clamp(strength/2)*320));
  for(let i=0;i<320;i++){const seed=(i*.61803398875)%1,a=i*2.4+t*(shape==='rush'?2.8:.45),phase=(seed+t*(shape==='rush'?.7:.15))%1;let radius=.85+((i*.381)%1)*.65,y=phase*3.5;if(shape==='recovery'){radius=.35+phase*1.5;y=.1+Math.sin(a)*.1;}if(shape==='thermal'){radius=.7+phase*.5;y=.3+((i*.217+t*.12)%1)*2.8;}if(shape==='bloom'){radius=.6+phase;y=.15+phase*phase*1.2;}if(shape==='crystal'){radius=1.3;y=.7+seed*2.2;}p.setXYZ(i,Math.cos(a)*radius,y,Math.sin(a)*radius);const color=spectrum?this.palette[i%8]:base;colors.setXYZ(i,color.r,color.g,color.b);}
  p.needsUpdate=true;colors.needsUpdate=true;(this.particles.material as T.PointsMaterial).size=.025+strength*.016;
 }
 dispose(){disposeTree(this.root);}
}
