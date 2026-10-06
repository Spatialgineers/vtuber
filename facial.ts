import * as T from 'three';
import {clamp,normalizedName,type Config,type Signals} from './state';
// Bone-local X width, Y height, Z depth. Source avatar is 3 m tall.
export class MouthlessFace{
 bones=new Map<string,T.Object3D>();
 constructor(root:T.Object3D){const names=['SGX_FaceVolume','SGX_Muzzle','SGX_Cheek.L','SGX_Cheek.R','SGX_Brow.L','SGX_Brow.R','SGX_Eye.L','SGX_Eye.R','SGX_Blink.L','SGX_Blink.R'];root.traverse(o=>{if(!(o as T.Bone).isBone)return;const name=names.find(n=>normalizedName(n)===normalizedName(o.name));if(name)this.bones.set(name,o);});}
 get available(){return this.bones.has('SGX_FaceVolume')&&this.bones.has('SGX_Muzzle');}
 apply(c:Config,s:Signals){
  if(!c.face.enabled||!this.available)return;const f=c.face,speech=clamp(s.mouthOpen||0)*f.speech,smile=clamp(s.smile||0),frown=clamp(s.frown||0),height=1+speech*.115*f.squash-(smile*.035+frown*.025)*f.squash;
  this.bones.get('SGX_FaceVolume')!.scale.multiply(new T.Vector3(1/Math.sqrt(height),height,1/Math.sqrt(height)));
  const muzzle=this.bones.get('SGX_Muzzle')!;muzzle.scale.multiply(new T.Vector3(1+smile*.14*f.cheeks-speech*.06,1+speech*.25,1+speech*.11));muzzle.position.y-=speech*.045;muzzle.position.z+=speech*.022;
  for(const side of ['L','R']){const sign=side==='L'?1:-1,cheek=this.bones.get('SGX_Cheek.'+side),brow=this.bones.get('SGX_Brow.'+side),eye=this.bones.get('SGX_Eye.'+side),blink=this.bones.get('SGX_Blink.'+side);
   if(cheek){cheek.position.x+=sign*(smile*.032+speech*.012)*f.cheeks;cheek.position.y+=(smile*.035-frown*.02)*f.cheeks;cheek.scale.multiplyScalar(1+(smile*.075+speech*.035)*f.cheeks);}
   if(brow){const up=clamp(s.browUp||0),down=clamp(s.browDown||0);brow.position.y+=(up*.055-down*.028)*f.brows;brow.rotateZ(sign*(down*.11-up*.055)*f.brows);}
   if(eye){eye.rotateY(clamp(s.lookX||0,-1,1)*.16);eye.rotateX(-clamp(s.lookY||0,-1,1)*.12);}
   if(blink){const close=clamp((s[side==='L'?'blinkLeft':'blinkRight']||0)*f.blink);blink.scale.y*=1-close*.92;blink.scale.x*=1+close*.035;}
  }
 }
}
