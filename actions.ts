import {liveTracking,playClip} from "../engine/motion";
import {powerPreset,POWERS} from "../engine/highcoon";
import type {Config} from "../engine/state";
import type {RemoteCommand} from "./protocol";
type Stage={animations:string[];face:boolean;calibrate:()=>void;frame:(preset:"bust"|"full")=>void;burst:()=>void;clearPower:()=>void;pad?:(c:Config,id:string,phase:"press"|"release")=>Config};
export function applyRemoteCommand(c:Config,command:RemoteCommand,stage:Stage):Config{switch(command.type){
 case "pad":if(!stage.pad)throw new Error("Este estudio no tiene un deck de acciones compatible.");return stage.pad(c,command.id,command.phase);
 case "tracking":return liveTracking(c,{hands:command.hands,body:command.body});
 case "mode":return {...c,mode:command.mode};
 case "animation":if(command.name!=="none"&&!stage.animations.includes(command.name))throw new Error("Este personaje no tiene ese clip.");return {...playClip(c,command.name,command.loop),performance:{...c.performance,mode:"live",playing:false}};
 case "power":{stage.clearPower();const play=stage.animations.includes(POWERS.find(p=>p.id===command.id)?.clip||"Victory")&&command.id!=="none",next=powerPreset(c,command.id,play);return play?{...next,performance:{...next.performance,mode:"live",playing:false}}:next;}
 case "hand":return {...c,puppet:{...c.puppet,...(command.side==="both"?{left:command.pose,right:command.pose}:{[command.side]:command.pose})},tracking:{...c.tracking,hands:true,handsGain:c.tracking.handsGain||1,wristGain:c.tracking.wristGain||1,fingerGain:c.tracking.fingerGain||1}};
 case "freeze":return {...c,frozen:command.value};
 case "calibrate":if(!stage.face)throw new Error("Mira a la cámara antes de calibrar.");stage.calibrate();return c;
 case "camera":stage.frame(command.frame);return c;
 case "overload":if(c.power.id==="none")throw new Error("Activa un poder antes de usar Overload.");stage.burst();return c;
 case "reset":stage.clearPower();return {...playClip(c,stage.animations.includes("Idle")?"Idle":"none"),performance:{...c.performance,mode:"live",playing:false},mode:"NEUTRAL",frozen:false,demo:false,puppet:{left:"none",right:"none"},power:{...c.power,id:"none"}};
}}
