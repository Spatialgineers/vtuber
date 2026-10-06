"""Render the actual Three.js solver world matrices in Blender (CPU, no webcam).
blender -b --python-exit-code 1 --python review_highcoon_hands.py -- ASSET_DIR POSE_DIR OUTPUT_DIR
"""
import bpy, bmesh, sys, json, math
from pathlib import Path
from mathutils import Matrix, Vector
assets,poses,out=(Path(p).resolve() for p in sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(assets/'Highcoon-vTuber-face-rigs.blend'))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24
scene.render.resolution_x=600;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.world.color=(.05,.05,.05)
scene.view_settings.view_transform='AgX'
def matrix(flat):return Matrix([flat[i:i+4] for i in range(0,16,4)]).transposed()
def key(name):return ''.join(c.lower() for c in name if c.isalnum())
def look(obj,point):obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
for o in list(bpy.data.objects):
 if o.type in ['LIGHT','CAMERA']:bpy.data.objects.remove(o,do_unlink=True)
cam_data=bpy.data.cameras.new('SGX_HandReview');cam=bpy.data.objects.new('SGX_HandReview',cam_data);scene.collection.objects.link(cam);scene.camera=cam;cam_data.type='ORTHO';cam_data.ortho_scale=.5
for name,location,power,size in [('Key',(3,-4,5),700,3),('Fill',(-2,-1,3),400,3),('Rim',(2,3,4),600,2)]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=location;look(o,(0,0,1))
report=[]
for character in ['highcoon-classic','highcoon-full-spectrum']:
 r=bpy.data.objects[character+'_Rig'];r.location=(0,0,0);r.animation_data.action=None
 for track in r.animation_data.nla_tracks:track.mute=True
 for obj in bpy.data.objects:
  if obj.type=='MESH':obj.hide_render=obj.parent!=r
 # Isolate the actual left-hand surface for close inspection; keep its skin/modifier.
 for source in [o for o in bpy.data.objects if o.type=='MESH' and o.parent==r and not o.get('sgx_review_mesh')]:
  source.hide_render=True
  bm=bmesh.new();bm.from_mesh(source.data)
  remove=[v for v in bm.verts if v.co.x<.74 or v.co.z<.76 or v.co.z>1.24]
  bmesh.ops.delete(bm,geom=remove,context='VERTS')
  if len(bm.verts):
   copy=source.copy();copy.data=source.data.copy();copy.name=source.name+'_HAND_REVIEW';copy['sgx_review_mesh']=True;scene.collection.objects.link(copy);copy.hide_render=False;bm.to_mesh(copy.data);copy.data.update()
  bm.free()
 for p in r.pose.bones:p.location=(0,0,0);p.rotation_mode='QUATERNION';p.rotation_quaternion=(1,0,0,0);p.scale=(1,1,1)
 bpy.context.view_layer.update()
 payload=json.loads((poses/(character+'-poses.json')).read_text());rest={key(name):matrix(m) for name,m in payload['rest'].items()}
 native={key(b.name):r.matrix_world@b.matrix_local for b in r.data.bones}
 pelvis='pelvis';spine='spine'
 scale=(native[spine].translation-native[pelvis].translation).length/(rest[spine].translation-rest[pelvis].translation).length
 conversion=Matrix.Rotation(math.pi/2,4,'X')@Matrix.Diagonal((scale,scale,scale,1))
 conversion.translation=native[pelvis].translation-(conversion@rest[pelvis].translation)
 inv=conversion.inverted()
 ordered=sorted(r.pose.bones,key=lambda b:len(b.parent_recursive))
 for gesture,matrices in payload['poses'].items():
  desired={key(name):conversion@matrix(m)@rest[key(name)].inverted()@inv@native[key(name)] for name,m in matrices.items() if key(name) in native}
  for p in ordered:
   if key(p.name) in desired:p.matrix=r.matrix_world.inverted()@desired[key(p.name)];bpy.context.view_layer.update()
  error=max(max(abs((r.matrix_world@p.matrix)[i][j]-desired[key(p.name)][i][j]) for i in range(4) for j in range(4)) for p in ordered if key(p.name) in desired)
  assert error<.0001,(character,gesture,error)
  wrist=r.pose.bones['hand.L'].matrix.translation;middle=r.pose.bones['middle.01.L'].matrix.translation
  target=wrist.lerp(middle,.55)
  palm=r.pose.bones['hand.L'].matrix.to_3x3()@Vector((0,0,1));cam.location=target+palm.normalized()*.9+Vector((0,-.06,.03));look(cam,target)
  scene.render.filepath=str(out/(character+'-'+gesture+'.png'));bpy.ops.render.render(write_still=True)
  report.append({'character':character,'gesture':gesture,'matrix_error':error,'renderer':'Blender Cycles CPU','view':'isolated left-hand skin; wrist boundary is a review crop','image':character+'-'+gesture+'.png'})
(out/'hand-render-report.json').write_text(json.dumps(report,indent=2));print('SGX_HAND_REVIEW_SUCCESS',json.dumps(report))
