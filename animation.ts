import * as T from 'three';
import type {Config} from './state';
export class AnimationDirector{
 mixer:T.AnimationMixer;action?:T.AnimationAction;active='none';selected='';nonce=-1;loop=true;
 constructor(root:T.Object3D,public clips:T.AnimationClip[]){this.mixer=new T.AnimationMixer(root);this.mixer.addEventListener('finished',e=>{if(e.action!==this.action)return;const idle=this.clips.find(c=>c.name==='Idle');if(idle)this.play(idle,true,.18);});}
 private play(clip:T.AnimationClip,loop:boolean,transition:number){const previous=this.action,next=this.mixer.clipAction(clip);next.reset();next.enabled=true;next.clampWhenFinished=!loop;next.setLoop(loop?T.LoopRepeat:T.LoopOnce,loop?Infinity:1);next.setEffectiveTimeScale(1);next.setEffectiveWeight(1);if(previous&&previous!==next&&transition>0){next.fadeIn(transition);previous.fadeOut(transition);}else previous?.stop();next.play();this.action=next;this.active=clip.name;}
 update(c:Config,dt:number){if(c.avatar.animation!==this.selected||c.avatar.animationNonce!==this.nonce||c.avatar.animationLoop!==this.loop){this.selected=c.avatar.animation;this.nonce=c.avatar.animationNonce;this.loop=c.avatar.animationLoop;const clip=this.clips.find(a=>a.name===this.selected);if(clip)this.play(clip,c.avatar.animationLoop,c.avatar.transition);else{this.mixer.stopAllAction();this.action=undefined;this.active='none';}}this.mixer.update(c.frozen?0:dt*c.avatar.animationSpeed);}
 dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.mixer.getRoot());}
}
