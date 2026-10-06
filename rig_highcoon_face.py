"""Weighted mouthless facial rig, preserving the recovered Riftlands source.
Blender 4.2: blender -b --python rig_highcoon_face.py -- SOURCE.blend OUTPUT_DIR
"""
import bpy,sys,json,hashlib
sys.dont_write_bytecode=True
sys.path.insert(0,str(__import__("pathlib").Path(__file__).parent))
from rig_highcoon_hands import refine_hands
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];source=Path(args[0]).resolve();out=Path(args[1]).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.data.scenes['Character Studio'];bpy.context.window.scene=scene;scene.frame_set(1);reports=[]
controls={'SGX_FaceVolume':((0,0,2.4),'head'),'SGX_Muzzle':((0,-.4,2.17),'SGX_FaceVolume')}
for side,sign in [('L',1),('R',-1)]:
 for name,center,parent in [('Cheek',(.31*sign,-.27,2.27),'SGX_FaceVolume'),('Brow',(.235*sign,-.31,2.55),'SGX_FaceVolume'),('Eye',(.205*sign,-.29,2.37),'SGX_FaceVolume'),('Blink',(.205*sign,-.29,2.37),'SGX_Eye.'+side)]:controls['SGX_'+name+'.'+side]=(center,parent)
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def region(v,c,r):return max(0,1-sum(((v[i]-c[i])/r[i])**2 for i in range(3)))**2
def split_suit(r):
 m=bpy.data.objects.get('highcoon-full-spectrum_SkinnedMesh')
 if not m:return
 bpy.ops.object.select_all(action='DESELECT');m.select_set(True);bpy.context.view_layer.objects.active=m;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT');layers={}
 for m in [o for o in r.children if o.type=='MESH' and 'preview_gear' not in o]:
  lo=[min(v.co[i] for v in m.data.vertices) for i in range(3)];hi=[max(v.co[i] for v in m.data.vertices) for i in range(3)];single=lo[0]>.03 or hi[0]<-.03;cx=(lo[0]+hi[0])/2
  if single and lo[1]<-.30 and hi[1]<-.14 and lo[2]>2.15 and hi[2]<2.56 and abs(cx)<.36:tag='EYES_L' if cx>0 else 'EYES_R'
  elif lo[2]>2.10 and hi[2]<2.30 and hi[0]-lo[0]<.21 and lo[1]<-.55:tag='NOSE'
  elif lo[2]>2.10 and ((lo[1]<-.53 and hi[0]-lo[0]>.28) or (single and abs(cx)>.40 and hi[2]<2.60)):tag='VISOR'
  elif lo[1]>.40 or hi[1]>.9:tag='TAIL'
  elif lo[2]>2.17 and hi[2]<2.61 and hi[0]-lo[0]>.9:tag='MASK'
  elif hi[2]>2.5:tag='HEAD'
  elif len(m.data.vertices)>3000:tag='BODY'
  else:tag='GEAR'
  layers.setdefault(tag,[]).append(m)
 for tag,items in layers.items():
  bpy.ops.object.select_all(action='DESELECT')
  for m in items:m.select_set(True)
  bpy.context.view_layer.objects.active=items[0]
  if len(items)>1:bpy.ops.object.join()
  m=bpy.context.object;m.name='highcoon-full-spectrum__'+tag;m['source_mesh']=tag
for id in ['highcoon-classic','highcoon-full-spectrum']:
 r=bpy.data.objects[id+'_Rig'];r.animation_data.action=None
 if id=='highcoon-full-spectrum':split_suit(r)
 for t in r.animation_data.nla_tracks:t.mute=True
 for p in r.pose.bones:p.location=(0,0,0);p.rotation_mode='QUATERNION';p.rotation_quaternion=(1,0,0,0);p.scale=(1,1,1)
 meshes=[m for m in r.children if m.type=='MESH' and 'preview_gear' not in m]
 bpy.ops.object.select_all(action='DESELECT');r.select_set(True);bpy.context.view_layer.objects.active=r;bpy.ops.object.mode_set(mode='EDIT')
 for name,(center,parent) in controls.items():
  b=r.data.edit_bones.get(name) or r.data.edit_bones.new(name);b.head=center;b.tail=Vector(center)+Vector((0,0,.1));b.parent=r.data.edit_bones[parent];b.use_connect=False;b.use_deform=True;b.inherit_scale='FULL'
 bpy.ops.object.mode_set(mode='OBJECT');weighted={n:0 for n in controls}
 for m in meshes:
  groups={g.index:g.name for g in m.vertex_groups};src=str(m.get('source_mesh','')).lower()
  for n in controls:
   if n not in m.vertex_groups:m.vertex_groups.new(name=n)
  if any(k in src for k in ['cola','stripe']):continue
  for v in m.data.vertices:
   x,y,z=v.co;original={groups[g.group]:g.weight for g in v.groups if g.weight>0 and g.group in groups};facial=sum(original.get(n,0) for n in ['head','jaw','eye.L','eye.R'])
   if facial<.02 or z<1.99 or y>.45:continue
   side='L' if x>0 else 'R';nose=src in ['eyes 1','nose'];eye=src in ['eyeballs','eyes 2','eyes_l','eyes_r']
   if eye:weights={'SGX_Blink.'+side:1}
   elif nose:weights={'SGX_Muzzle':1}
   elif src=='visor':weights={'SGX_FaceVolume':1}
   else:
    replacement=min(1,facial)*smooth(1.99,2.15,z)
    if replacement<.015:continue
    weights={n:w*(1-replacement/facial) if n in ['head','jaw','eye.L','eye.R'] else w for n,w in original.items()};front=1-smooth(-.10,.15,y)
    muzzle=region(v.co,(0,-.39,2.16),(.30,.31,.22))*.82*front;cheek=region(v.co,((.31 if side=='L' else -.31),-.28,2.27),(.30,.35,.25))*.7*front;brow=region(v.co,((.235 if side=='L' else -.235),-.29,2.55),(.28,.30,.23))*.72*front
    total=muzzle+cheek+brow
    if total>.96:muzzle*=.96/total;cheek*=.96/total;brow*=.96/total
    weights.update({'SGX_Muzzle':muzzle*replacement,'SGX_Cheek.'+side:cheek*replacement,'SGX_Brow.'+side:brow*replacement,'SGX_FaceVolume':(1-muzzle-cheek-brow)*replacement})
   weights=sorted(((n,w) for n,w in weights.items() if w>.0001),key=lambda a:-a[1])[:4];total=sum(w for n,w in weights)
   for g in m.vertex_groups:g.remove([v.index])
   for n,w in weights:
    m.vertex_groups[n].add([v.index],w/total,'REPLACE')
    if n in weighted:weighted[n]+=1
 hand_report=refine_hands(r,meshes,id)
 r['sgx_face_rig']=json.dumps({'version':1,'mouthless':True,'axes':'local X width, Y height, Z depth','controls':list(controls)});r['sgx_character']=id;bpy.context.view_layer.update()
 error=0;deps=bpy.context.evaluated_depsgraph_get()
 for m in meshes:
  evaluated=m.evaluated_get(deps).to_mesh()
  if len(evaluated.vertices)==len(m.data.vertices):error=max(error,max((a.co-b.co).length for a,b in zip(evaluated.vertices,m.data.vertices)))
  m.evaluated_get(deps).to_mesh_clear()
 assert error<.001,(id,error)
 assert all(weighted[n]>0 for n in controls if not n.startswith('SGX_Eye.')),weighted
 r.location=(0,0,0);bpy.ops.object.select_all(action='DESELECT');r.select_set(True)
 for m in meshes:m.select_set(True)
 bpy.context.view_layer.objects.active=r
 bpy.ops.export_scene.gltf(filepath=str(out/(id+'-vtuber.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_skins=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_def_bones=True,export_force_sampling=True,export_yup=True,export_extras=True)
 reports.append({'character':id,'hands':hand_report,'facial_bones':list(controls),'weighted_vertices':weighted,'native_bind_max_error':error,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
keep=set()
for id in ['highcoon-classic','highcoon-full-spectrum']:
 r=bpy.data.objects[id+'_Rig'];keep.add(r);keep.update(m for m in r.children if m.type=='MESH' and 'preview_gear' not in m)
for o in list(bpy.data.objects):
 if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
for s in list(bpy.data.scenes):
 if s!=scene:bpy.data.scenes.remove(s)
bpy.data.objects['highcoon-full-spectrum_Rig'].location.x=3.9;bpy.ops.wm.save_as_mainfile(filepath=str(out/'Highcoon-vTuber-face-rigs.blend'),compress=True)
(out/'face-rig-report.json').write_text(json.dumps(reports,indent=2));print('SGX_FACE_RIG_SUCCESS',json.dumps(reports))
