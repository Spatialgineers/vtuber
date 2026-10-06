import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { CloudError } from "./cloud-error";
export { CloudError } from "./cloud-error";
export function storage(){const bindings=env as unknown as {DB:D1Database;BUCKET:R2Bucket};if(!bindings.DB||!bindings.BUCKET)throw new Error("Cloud storage is unavailable. Your current performance is still here.");return bindings;}
export async function owner(request:Request,write=false){const user=await getChatGPTUser();if(!user)throw new CloudError("Sign in with ChatGPT to use cloud scenes.",401);
  if(write){const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)throw new CloudError("This request came from a different site.",403);}
  return user.userId;
}
export function errorResponse(e:unknown){if(e instanceof CloudError)return Response.json({error:e.message},{status:e.status});console.error("SGX cloud",e instanceof Error?e.message:String(e));return Response.json({error:"Cloud storage is unavailable. Keep your performance open and try again."},{status:503});}
export function checkId(id:string){if(!/^[0-9a-f-]{36}$/.test(id))throw new CloudError("Invalid scene identifier.");return id;}
