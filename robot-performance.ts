import * as T from "three";
import type {PoseBinding} from "./pose";
import {emptyFrame,performanceSchema,type Performance,type PoseFrame,type PoseClip,type SavedPose,type ActionPad} from "./performance-state";

// Editable starter clips use the same bind-relative format as authored poses.
// They are generated only for the SGX Robot, never silently retargeted to imports.
export function robotPerformancePack(binding:PoseBinding,p:Performance):Performance{
 if(!binding.root.getObjectByName("energyMouth")||!binding.root.getObjectByName("LeftUpperArm"))throw new Error("Load the SGX Robot to add its starter deck.");
 if(p.clips.some(c=>c.model===binding.model&&c.name==="Robot / Wave"))throw new Error("This robot already has its starter clips.");
 function frame(rotations:Record<string,[number,number,number]>,positions:Record<string,[number,number,number]>={}):PoseFrame{const f=emptyFrame();for(const[name,angles]of Object.entries(rotations)){const b=binding.bones.find(b=>b.name===name);if(b)f.bones[b.key]={q:new T.Quaternion().setFromEuler(new T.Euler(...angles.map(T.MathUtils.degToRad) as [number,number,number])).toArray() as [number,number,number,number]};}for(const[name,pos]of Object.entries(positions)){const b=binding.bones.find(b=>b.name===name);if(b)f.bones[b.key]={...f.bones[b.key],p:pos};}return f;}
 const rest=emptyFrame(),greet=frame({LeftUpperArm:[0,0,135],LeftLowerArm:[0,0,12],LeftHand:[0,0,0]}),hero=frame({LeftUpperArm:[0,0,115],RightUpperArm:[0,0,-115],LeftLowerArm:[-15,0,20],RightLowerArm:[-15,0,-20],chest:[-6,0,0]}),crouch=frame({LeftUpperLeg:[-38,0,0],RightUpperLeg:[-38,0,0],LeftLowerLeg:[70,0,0],RightLowerLeg:[70,0,0],chest:[22,0,0],LeftUpperArm:[-20,0,12],RightUpperArm:[-20,0,-12]},{hips:[0,-.32,0]}),wide=frame({LeftUpperLeg:[0,0,12],RightUpperLeg:[0,0,-12],LeftUpperArm:[0,0,22],RightUpperArm:[0,0,-22]});
 const saved:SavedPose[]=[['Greet',greet],['Hero',hero],['Crouch',crouch],['Wide stance',wide]].map(([name,f])=>({id:crypto.randomUUID(),name:`Robot / ${name}`,model:binding.model,frame:f as PoseFrame}));
 function clip(name:string,duration:number,keys:[number,PoseFrame][]):PoseClip{return {id:crypto.randomUUID(),name:`Robot / ${name}`,model:binding.model,duration,keyframes:keys.map(([time,frame])=>({id:crypto.randomUUID(),time,frame,easing:"smooth"}))};}
 const wave=(degrees:number)=>frame({LeftUpperArm:[0,0,135],LeftLowerArm:[0,0,12],LeftHand:[0,0,degrees]});
 const groove=(side:number)=>frame({hips:[0,side*10,0],chest:[0,0,side*7],LeftUpperArm:[-18,0,30+side*8],RightUpperArm:[-18,0,-30+side*8],LeftLowerArm:[-30,0,0],RightLowerArm:[-30,0,0]},{hips:[0,.025,0]});
 const clips=[clip('Wave',2.2,[[0,rest],[.35,greet],[.6,wave(25)],[.9,wave(-25)],[1.2,wave(25)],[1.5,wave(-25)],[1.8,greet],[2.2,rest]]),clip('Hero landing',2.4,[[0,rest],[.4,crouch],[.9,hero],[1.8,hero],[2.4,rest]]),clip('Groove',1.6,[[0,groove(-1)],[.8,groove(1)],[1.6,groove(-1)]])];
 const slots=(bank:ActionPad["bank"])=>Array.from({length:12},(_,slot)=>slot).filter(slot=>!p.pads.some(p=>p.bank===bank&&p.slot===slot)),bank:ActionPad["bank"]=(['B','C','A'] as const).find(b=>slots(b).length>=7)||'B',available=slots(bank);
 const specs:[string,ActionPad["action"],ActionPad["trigger"],string][]=[['WAVE',{clip:clips[0].id,loop:false,mode:'HYPE'},'tap','#00eeee'],['HERO DROP',{clip:clips[1].id,loop:false,power:'caryophyllene',mode:'SERIOUS'},'tap','#ef9052'],['GROOVE',{clip:clips[2].id,loop:true,mode:'TERP',power:'linalool'},'toggle','#bc8cfa'],['GREET',{pose:saved[0].id},'hold','#00eeee'],['HERO',{pose:saved[1].id,power:'spectrum'},'toggle','#fdcc0d'],['CROUCH',{pose:saved[2].id},'hold','#73b6ff'],['WIDE STANCE',{pose:saved[3].id},'tap','#73b6ff']];
 const pads=specs.slice(0,available.length).map(([label,action,trigger,color],i)=>({id:crypto.randomUUID(),label,action,trigger,color,bank,slot:available[i]}));
 return performanceSchema.parse({...p,poses:[...p.poses,...saved],clips:[...p.clips,...clips],pads:[...p.pads,...pads],bank});
}
