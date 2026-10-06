import type {Landmark} from "./state";

const alpha=(cutoff:number,dt:number)=>1/(1+1/(2*Math.PI*cutoff*dt));
const finite=(p:Landmark)=>[p.x,p.y,p.z].every(Number.isFinite);
type Sample={raw:Landmark;value:Landmark;velocity:{x:number;y:number;z:number};time:number};

/** Speed-adaptive 1€ filtering, in sensor time rather than render time.
 * Scale is a shoulder/palm span, so body and finger motion use the same units.
 * Invalid/hidden samples retain position but never inherit earlier confidence.
 */
export class LandmarkFilter {
 private samples:Sample[]=[];
 private values:Landmark[]=[];
 private time=-Infinity;
 private amount=-1;
 reset(){this.samples=[];this.values=[];this.time=-Infinity;this.amount=-1;}
 update(points:Landmark[],time:number,amount:number,scale=1,confidence=0):Landmark[]{
  if(amount<=0){if(this.samples.length)this.reset();return points;}
  if(!Number.isFinite(time))return points;
  if(this.time===time&&this.amount===amount&&this.values.length===points.length)return this.values;
  if(time<this.time||time-this.time>350||this.values.length!==points.length)this.reset();
  this.time=time;this.amount=amount;scale=Math.max(.001,scale);
  for(let i=0;i<points.length;i++){
   const p=points[i];let s=this.samples[i];
   const reliable=finite(p)&&Math.min(p.visibility??1,p.presence??1)>=confidence;
   if(!s){const value={...p};s={raw:{...p},value,velocity:{x:0,y:0,z:0},time};this.samples[i]=s;this.values[i]=value;}
   s.value.visibility=p.visibility;s.value.presence=p.presence;
   if(!reliable)continue;
   const gap=time-s.time,dt=Math.min(.25,Math.max(1/240,gap/1000));
   if(gap>250||!finite(s.raw)||!finite(s.value)){
    s.value.x=p.x;s.value.y=p.y;s.value.z=p.z;s.velocity.x=s.velocity.y=s.velocity.z=0;
   }else{
    const derivative=alpha(1.5,dt);
    for(const axis of ["x","y","z"] as const)s.velocity[axis]+=derivative*((p[axis]-s.raw[axis])/dt/scale-s.velocity[axis]);
    const speed=Math.max(0,Math.hypot(s.velocity.x,s.velocity.y,s.velocity.z)-.12),cutoff=1.2/(amount+.05)+(4+12*amount)*speed,a=alpha(cutoff,dt);
    for(const axis of ["x","y","z"] as const)s.value[axis]+=a*(p[axis]-s.value[axis]);
   }
   s.raw.x=p.x;s.raw.y=p.y;s.raw.z=p.z;s.time=time;
  }
  return this.values;
 }
}

export function landmarkSpan(points:Landmark[],a:number,b:number,fallback:number){
 const p=points[a],q=points[b];if(!p||!q||!finite(p)||!finite(q))return fallback;
 const span=Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z);return span>.001?span:fallback;
}

/** Blinks/speech need a quicker envelope than a steady head or body. */
export function trackingSignalAlpha(name:string,amount:number,error:number,dt:number){
 const base=/blink/i.test(name)?.009+amount*amount*.02:/mouth|jaw/i.test(name)?.012+amount*amount*.035:/look|eye/i.test(name)?.012+amount*amount*.06:.01+amount*amount*.25;
 const tau=base/(1+Math.min(4,Math.abs(error)*6));
 return 1-Math.exp(-Math.max(0,Math.min(.1,dt))/tau);
}
