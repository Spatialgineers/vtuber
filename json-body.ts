import {CloudError} from "./cloud-error";
export async function readBoundedJSON(request:Request,limit=1500000){
 if(Number(request.headers.get("content-length"))>limit)throw new CloudError("Scene settings are too large.",413);
 const reader=request.body?.getReader();if(!reader)throw new CloudError("Scene settings are missing.");const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new CloudError("Scene settings are too large.",413);}chunks.push(value);}}finally{reader.releaseLock();}
 const data=new Uint8Array(size);let i=0;for(const c of chunks){data.set(c,i);i+=c.length;}try{return JSON.parse(new TextDecoder().decode(data));}catch{throw new CloudError("Scene settings are not valid JSON.");}
}
