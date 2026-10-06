import type { Config } from './state';
import { playClip } from './motion';
export const CHARACTERS=[
 {id:'highcoon-classic',name:'Highcoon · Classic',path:'/avatars/highcoon/highcoon-classic-vtuber.glb?v=hands-2',image:'/avatars/highcoon/classic.png'},
 {id:'highcoon-full-spectrum',name:'Highcoon · TerpSuit',path:'/avatars/highcoon/highcoon-full-spectrum-vtuber.glb?v=hands-2',image:'/avatars/highcoon/terpsuit.png'},
] as const;
export type HighcoonId=typeof CHARACTERS[number]['id'];
// Original Riftlands power names, roles and colors; effects adapt them for performance.
export const POWERS=[
 {id:'limonene',name:'Reflex Rush',channel:'Limonene',code:'LI',role:'Reflexes',color:'#facc15',shape:'rush',clip:'Run',loop:true},
 {id:'myrcene',name:'Blue Recovery',channel:'Myrcene',code:'MY',role:'Recovery',color:'#1d4ed8',shape:'recovery',clip:'Restore',loop:true},
 {id:'caryophyllene',name:'Grounded Carapace',channel:'Caryophyllene',code:'CA',role:'Resilience',color:'#dc2626',shape:'shield',clip:'ShieldGuard',loop:true},
 {id:'linalool',name:'Bloomstep',channel:'Linalool',code:'LN',role:'Air agility',color:'#ec4899',shape:'bloom',clip:'Jump',loop:false},
 {id:'terpinolene',name:'Spectrum Recharge',channel:'Terpinolene',code:'TE',role:'Reactor',color:'#a855f7',shape:'reactor',clip:'AmgOverclock',loop:true},
 {id:'humulene',name:'Thermal Balance',channel:'Humulene',code:'HU',role:'Regulation',color:'#f97316',shape:'thermal',clip:'Idle',loop:true},
 {id:'alpha-pinene',name:'Crystal Focus',channel:'Alpha-Pinene',code:'AP',role:'Precision',color:'#14b8a6',shape:'crystal',clip:'RifleAim',loop:true},
 {id:'beta-pinene',name:'Clear Signal',channel:'Beta-Pinene',code:'BP',role:'Clarity',color:'#22c55e',shape:'signal',clip:'AmgDisrupt',loop:false},
] as const;
export type PowerId=Config['power']['id'];
export const ANIMATION_PRESETS=[{name:'Idle',label:'Breathe',loop:true},{name:'Victory',label:'Celebrate',loop:false},{name:'Walk',label:'Walk',loop:true},{name:'Run',label:'Run',loop:true},{name:'Jump',label:'Jump',loop:false},{name:'Restore',label:'Recharge',loop:true},{name:'SwordSlash1',label:'Slash',loop:false},{name:'ShieldGuard',label:'Guard',loop:true}] as const;
export function powerPreset(c:Config,id:PowerId,animate:boolean):Config{const power=POWERS.find(p=>p.id===id);const next=animate?playClip(c,power?.clip||'Victory',power?.loop??false):c;return {...next,power:{...next.power,id}};}
export async function characterFile(id:HighcoonId):Promise<File>{const item=CHARACTERS.find(c=>c.id===id)!;const r=await fetch(item.path,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Highcoon could not load. Reload the studio and try again.');return new File([await r.blob()],item.name+'.glb',{type:'model/gltf-binary'});}
