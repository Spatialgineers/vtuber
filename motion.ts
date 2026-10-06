import type { Config } from "./state";
import { nextNonce } from "./performance-state";

/** An explicit tracking action hands body control back from pads and the editor. */
export function liveTracking(c: Config, input: {hands?: boolean; body?: "off"|"upper"|"full"} = {}): Config {
  const hands=input.hands??c.tracking.hands, pose=input.body===undefined?c.tracking.pose:input.body!=="off";
  const bodyMode=input.body==="full"?"full":input.body===undefined?c.tracking.bodyMode:"upper";
  return {...c, frozen:false, demo:false, puppet:{left:"none",right:"none"},
    robot:{...c.robot,pose:{}},
    tracking:{...c.tracking,hands,pose,bodyMode,
      ...(hands?{handsGain:c.tracking.handsGain||1,wristGain:c.tracking.wristGain||1,fingerGain:c.tracking.fingerGain||1}:{}),
      ...(pose?{arms:c.tracking.arms||1,body:c.tracking.body||1,...(bodyMode==="full"?{legs:c.tracking.legs||1}:{})}:{})},
    avatar:{...c.avatar,motionMode:pose&&bodyMode==="full"||c.avatar.animation==="none"?"tracking":"hybrid"},
    performance:{...c.performance,mode:"live",playing:false,nonce:nextNonce(c.performance.nonce)}};
}

export function animationMotionMode(c: Config): Config["avatar"]["motionMode"] {
  if (c.avatar.motionMode === "tracking" && c.tracking.pose && c.tracking.bodyMode === "full") return "tracking";
  return c.tracking.hands || c.tracking.pose ? "hybrid" : "animation";
}
export function playClip(c: Config, animation: string, loop = true): Config {
  return {...c, avatar: {...c.avatar, animation, animationLoop: loop, animationNonce: (c.avatar.animationNonce + 1) % 1000000000, motionMode: animationMotionMode(c)}};
}
export function trackingForMotion(c: Config): Config {
  if (c.avatar.motionMode === "tracking") return c;
  return {...c, tracking: {...c.tracking, bodyMode: "upper", groundFeet: false, pose: c.avatar.motionMode === "hybrid" && c.tracking.pose}};
}
