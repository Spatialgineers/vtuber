import { createRequire } from "node:module";
import { realpath } from "node:fs/promises";
const {build}=createRequire(await realpath(new URL("../node_modules/wrangler/package.json",import.meta.url)))("esbuild");
await build({entryPoints:[new URL("../public/tracking/vision_bundle.mjs",import.meta.url).pathname],outfile:new URL("../public/tracking/vision_bundle.js",import.meta.url).pathname,format:"iife",globalName:"SGXVision",platform:"browser",target:"es2020",minify:true,legalComments:"linked"});
console.log("MediaPipe 0.10.32 classic-worker bundle ready.");
