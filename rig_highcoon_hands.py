"""Measured Highcoon hand fits and localized skinning. Called by the face exporter."""
import bpy, bmesh, math
from mathutils import Vector

FITS = {
 'highcoon-classic': {
  'wrist':(.837,.061,1.150),'palm':(.875,.058,1.015),
  'thumb':((.817,.039,1.043),(.798,.032,.950)),
  'index':((.881,.001,1.007),(.962,.002,.888)),
  'middle':((.887,.047,1.007),(.963,.046,.871)),
  'ring':((.885,.084,1.009),(.955,.086,.892)),
  'pinky':((.862,.112,1.019),(.927,.114,.929))},
 'highcoon-full-spectrum': {
  'wrist':(.873,.042,1.158),'palm':(.943,.013,1.052),
  'thumb':((.955,-.018,1.110),(.980,-.100,1.072)),
  'index':((.996,.009,1.025),(1.039,.006,.947)),
  'middle':((.963,.013,1.014),(1.002,.006,.896)),
  'ring':((.929,.017,1.014),(.962,.014,.897)),
  'pinky':((.892,.010,1.021),(.913,.004,.928))}}
FINGERS=('thumb','index','middle','ring','pinky')
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def mirror(v,sign):return Vector((v[0]*sign,v[1],v[2]))
def refine_hands(r, meshes, character):
 fit=FITS[character];lines={};weighted={};subdivided=0
 bpy.ops.object.select_all(action='DESELECT');r.select_set(True);bpy.context.view_layer.objects.active=r;bpy.ops.object.mode_set(mode='EDIT')
 for side,sign in [('L',1),('R',-1)]:
  wrist=mirror(fit['wrist'],sign);palm=mirror(fit['palm'],sign)
  across=mirror(fit['index'][0],sign)-mirror(fit['pinky'][0],sign)
  normal=across.cross(palm-wrist).normalized()
  hand=r.data.edit_bones['hand.'+side];hand.head=wrist;hand.tail=palm;hand.align_roll(normal)
  for finger in FINGERS:
   a,b=(mirror(v,sign) for v in fit[finger]);lines[(side,finger)]=(a,b)
   for j in range(3):
    name=f'{finger}.{j+1:02d}.{side}';bone=r.data.edit_bones[name]
    bone.head=a.lerp(b,j/3);bone.tail=a.lerp(b,(j+1)/3);bone.align_roll(normal);bone.use_connect=False;weighted[name]=0
 bpy.ops.object.mode_set(mode='OBJECT')
 # Linear refinement keeps the sculpted surface and UVs, adding joints' bend resolution.
 if character=='highcoon-full-spectrum':
  for m in meshes:
   if str(m.get('source_mesh','')).lower()!='body':continue
   bm=bmesh.new();bm.from_mesh(m.data);before=len(bm.verts)
   edges=[e for e in bm.edges if all(abs(v.co.x)>.76 and .80<v.co.z<1.19 for v in e.verts)]
   if edges:bmesh.ops.subdivide_edges(bm,edges=edges,cuts=2,use_grid_fill=True,smooth=0)
   subdivided+=len(bm.verts)-before;bm.to_mesh(m.data);bm.free();m.data.update()
 hand_names=set(weighted)|{'hand.L','hand.R'}
 for m in meshes:
  src=str(m.get('source_mesh','')).lower().replace(' ','');groups={g.index:g.name for g in m.vertex_groups}
  for name in hand_names:
   if name not in m.vertex_groups:m.vertex_groups.new(name=name)
  for v in m.data.vertices:
   x,y,z=v.co;side='L' if x>0 else 'R';sign=1 if x>0 else -1
   original={groups[g.group]:g.weight for g in v.groups if g.weight>0 and g.group in groups}
   in_hand=src in ['body','cuerpomod'] and abs(x)>.74 and .78<z<1.205
   if not in_hand:
    removed=sum(w for n,w in original.items() if n in hand_names)
    if not removed and not(src=='gear' and .55<abs(x) and .95<z<1.55):continue
    weights={n:w for n,w in original.items() if n not in hand_names}
    target=('forearm' if z<1.52 else 'upper_arm')+'.'+side
    weights[target]=weights.get(target,0)+removed
    if src=='gear' and .55<abs(x) and .95<z<1.55:weights={'forearm.'+side:1}
   else:
    wrist=mirror(fit['wrist'],sign);palm=mirror(fit['palm'],sign);axis=(palm-wrist).normalized()
    hand_mix=smooth(-.035,.025,(v.co-wrist).dot(axis))
    weights={'forearm.'+side:1-hand_mix,'hand.'+side:hand_mix}
    nearest=[]
    for finger in FINGERS:
     a,b=lines[(side,finger)];d=b-a;u=(v.co-a).dot(d)/d.length_squared
     closest=a+d*max(0,min(1,u));distance=(v.co-closest).length
     nearest.append((distance,finger,u,d.length))
    nearest.sort();selected=nearest[:2]
    factors=[math.exp(-min(50,(distance/.018)**2)) for distance,_,_,_ in selected];total=sum(factors) or 1
    influences=[]
    for (distance,finger,u,length),factor in zip(selected,factors):
     # The nearest finger field must also reach the sculpt's outer surface.
     # A radial cutoff leaves tip vertices on the palm and creates spikes on curl.
     influence=smooth(-.012,.024,u*length)*factor/total*hand_mix
     influences.append((finger,u,influence))
    finger_mix=sum(i[2] for i in influences);weights['hand.'+side]=max(0,hand_mix-finger_mix)
    for finger,u,influence in influences:
     t=max(0,min(2,u*3-.5));j=min(1,int(t));fraction=t-j
     for segment,fractional in [(j,1-fraction),(j+1,fraction)]:
      name=f'{finger}.{segment+1:02d}.{side}';weights[name]=weights.get(name,0)+influence*fractional
   weights=sorted(((n,w) for n,w in weights.items() if w>.0001),key=lambda item:-item[1])[:4];total=sum(w for _,w in weights)
   if total<=0:continue
   for group in m.vertex_groups:group.remove([v.index])
   for name,weight in weights:
    group=m.vertex_groups.get(name) or m.vertex_groups.new(name=name);group.add([v.index],weight/total,'REPLACE')
    if name in weighted and weight/total>.08:weighted[name]+=1
 assert all(count>0 for count in weighted.values()),(character,weighted)
 r['sgx_hand_rig']=2
 return {'version':2,'finger_weighted_vertices':weighted,'hand_subdivision_extra_vertices':subdivided,'rest_surface_preserved':True}
