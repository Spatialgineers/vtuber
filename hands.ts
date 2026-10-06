import type { Landmark, TrackingFrame } from "./state";

export type Hand = NonNullable<TrackingFrame["hands"]>[number];
export type HandSide = "left" | "right";
export const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]] as const;
const finite = (p: Landmark | undefined): p is Landmark => !!p && [p.x,p.y,p.z].every(Number.isFinite);
export function metricHandPoints(hand: Hand) {
  const world = hand.world;
  if (world?.length === 21 && world.every(finite) && Math.hypot(world[9].x-world[0].x,world[9].y-world[0].y,world[9].z-world[0].z) > .001) return {points:world,aspect:1};
  return {points:hand.points,aspect:hand.aspect && hand.aspect > .1 ? hand.aspect : 4/3};
}
// Handedness score measures left/right certainty, not landmark detection quality.
export function resolveHandSides(hands: readonly Hand[], pose: Landmark[] | undefined, history: Map<HandSide,{point:Landmark;time:number}>, now: number): [HandSide,Hand][] {
  const valid = hands.filter(h => h.points.length === 21 && h.points.every(finite) && h.points[0].x >= -.08 && h.points[0].x <= 1.08 && h.points[0].y >= -.08 && h.points[0].y <= 1.08).slice(0,2);
  const cost = (h:Hand, side:HandSide) => {
    if(h.locked)return h.side.toLowerCase()===side?0:Infinity;
    const label = h.side.toLowerCase(), certainty = Math.max(0,Math.min(1,2*(h.score ?? 1)-1));
    let value = label && label !== side ? .35*certainty : 0;
    const wrist = pose?.[side === "left" ? 15 : 16];
    if (finite(wrist) && (wrist.visibility ?? 1) > .35 && (wrist.presence ?? 1) > .35) value += 2*Math.hypot(h.points[0].x-wrist.x,h.points[0].y-wrist.y);
    const previous = history.get(side);
    if (previous && now-previous.time < 350) value += .55*Math.hypot(h.points[0].x-previous.point.x,h.points[0].y-previous.point.y);
    return value;
  };
  if (!valid.length) return [];
  if (valid.length === 1) return [[cost(valid[0],"left") <= cost(valid[0],"right") ? "left" : "right",valid[0]]];
  return cost(valid[0],"left")+cost(valid[1],"right") <= cost(valid[0],"right")+cost(valid[1],"left") ? [["left",valid[0]],["right",valid[1]]] : [["right",valid[0]],["left",valid[1]]];
}

export type HandGesture = "open" | "fist" | "point" | "spread";
export function handGesture(side:HandSide, gesture:HandGesture, roll=0): Hand {
  const sign=side === "left" ? -1 : 1, points:Landmark[]=Array.from({length:21},()=>({x:0,y:0,z:0}));
  for (let finger=0;finger<5;finger++) {
    const first=finger===0?1:5+(finger-1)*4;
    const spread=gesture==="spread"?1.8:1;
    let x=finger===0?sign*.047:sign*(1.5-(finger-1))*.022*spread, y=finger===0?-.025:-.075, z=0;
    for(let segment=0;segment<4;segment++) {
      if(segment) {
        const curled=gesture==="fist" || gesture==="point" && finger!==1;
        const angle=curled?(finger===0?[.4,1,1.5]:[1,2.2,3.1])[segment-1]:0;
        const length=finger===0?.021:([.029,.032,.030,.024][finger-1])*(segment===3?.75:1);
        x+=finger===0?sign*length*.6:sign*(1.5-(finger-1))*length*(gesture==="spread"?.24:.04);
        y-=length*Math.cos(angle);z-=length*Math.sin(angle);
      }
      points[first+segment]={x:x*Math.cos(roll)-y*Math.sin(roll),y:x*Math.sin(roll)+y*Math.cos(roll),z};
    }
  }
  const aspect=16/9,wristX=side==="left"?.78:.22;
  return {side:side==="left"?"Left":"Right",score:1,world:points,aspect,points:points.map(p=>({x:wristX+p.x*1.4,y:.44+p.y*1.4*aspect,z:p.z*1.4}))};
}
export function handRigCheck(elapsed:number) {
  const gesture:HandGesture=(["open","fist","point","spread"] as const)[Math.min(3,Math.floor(Math.max(0,elapsed)/2))];
  return {gesture,hands:[handGesture("left",gesture,Math.sin(elapsed*1.2)*.3),handGesture("right",gesture,-Math.sin(elapsed*1.2)*.3)]};
}
