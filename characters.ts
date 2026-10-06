import {characterCursorSchema,savedCharacterSchema,parseConfig,type Config,type SavedCharacter} from "./state";
import {nextNonce} from "./performance-state";
export function characterCursor(c:Config,time=c.performance.time){return characterCursorSchema.parse(Object.fromEntries(Object.keys(characterCursorSchema.shape).map(k=>[k,k==="time"?time:c.performance[k as keyof Config["performance"]]])));}
export function captureCharacter(c:Config,name:string,asset:string|null,time:number,id=crypto.randomUUID()):SavedCharacter{
 return savedCharacterSchema.parse({id,name,asset,robot:c.robot,avatar:c.avatar,face:c.face,power:c.power,mappings:c.mappings,cursor:characterCursor(c,time)});
}
export function storeCharacter(c:Config,p:SavedCharacter):Config{
 const items=[...c.characters.items.filter(x=>x.id!==p.id),p],first=c.characters.selected===null;
 return parseConfig({...c,characters:{selected:p.id,items},performance:{...c.performance,poses:c.performance.poses.map(x=>first&&!x.character&&x.model===p.cursor.model?{...x,character:p.id}:x),clips:c.performance.clips.map(x=>first&&!x.character&&x.model===p.cursor.model?{...x,character:p.id}:x)}});
}
export function activateCharacter(c:Config,p:SavedCharacter,model:string):Config{
 const cursor=p.cursor.model===model?p.cursor:{...p.cursor,model,mode:"live",frame:{bones:{},morphs:{}},clip:"",time:0};
 const clipExists=c.performance.clips.some(x=>x.id===cursor.clip&&x.model===model);
 return parseConfig({...c,characters:{...c.characters,selected:p.id},robot:p.robot,avatar:p.avatar,face:p.face,power:p.power,mappings:p.mappings,demo:false,frozen:false,puppet:{left:"none",right:"none"},performance:{...c.performance,...cursor,mode:cursor.mode==="clip"&&!clipExists?"live":cursor.mode,playing:false,nonce:nextNonce(c.performance.nonce)}});
}
