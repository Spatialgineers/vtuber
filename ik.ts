import * as T from "three";

// Solve in world space, then convert rotations through each parent. No bone
// translation is changed, so imported centimetre rigs retain their segment lengths.
export function solveTwoBone(root:T.Object3D,mid:T.Object3D,end:T.Object3D,target:T.Vector3){
 root.updateWorldMatrix(true,true);const a=root.getWorldPosition(new T.Vector3()),b=mid.getWorldPosition(new T.Vector3()),c=end.getWorldPosition(new T.Vector3()),ab=b.clone().sub(a),bc=c.clone().sub(b),l1=ab.length(),l2=bc.length();
 if(l1<1e-7||l2<1e-7||mid.parent!==root||end.parent!==mid)return false;
 const axis=target.clone().sub(a);if(axis.lengthSq()<1e-12)axis.copy(c).sub(a);if(axis.lengthSq()<1e-12)axis.copy(ab);const wanted=axis.length();axis.normalize();const d=T.MathUtils.clamp(wanted,Math.abs(l1-l2)+1e-6,l1+l2-1e-6);
 const pole=ab.clone().addScaledVector(axis,-ab.dot(axis));if(pole.lengthSq()<1e-10){pole.set(0,0,1).applyQuaternion(root.getWorldQuaternion(new T.Quaternion()));pole.addScaledVector(axis,-pole.dot(axis));if(pole.lengthSq()<1e-10)pole.set(0,1,0).addScaledVector(axis,-axis.y);}pole.normalize();
 const x=(d*d+l1*l1-l2*l2)/(2*d),y=Math.sqrt(Math.max(0,l1*l1-x*x)),elbow=a.clone().addScaledVector(axis,x).addScaledVector(pole,y),goal=a.clone().addScaledVector(axis,d);
 function orient(node:T.Object3D,current:T.Vector3,desired:T.Vector3){const delta=new T.Quaternion().setFromUnitVectors(current.normalize(),desired.normalize()),q=node.getWorldQuaternion(new T.Quaternion()).premultiply(delta);if(node.parent)q.premultiply(node.parent.getWorldQuaternion(new T.Quaternion()).invert());node.quaternion.copy(q.normalize());node.updateWorldMatrix(true,true);}
 orient(root,ab,elbow.clone().sub(a));orient(mid,end.getWorldPosition(new T.Vector3()).sub(mid.getWorldPosition(new T.Vector3())),goal.clone().sub(mid.getWorldPosition(new T.Vector3())));return true;
}
