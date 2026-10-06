"""Render native rig evidence and integrated character thumbnails with CPU Cycles."""
import bpy,math,sys
from pathlib import Path
from mathutils import Vector
out=Path(sys.argv[sys.argv.index('--')+1]);bpy.ops.wm.open_mainfile(filepath=str(out/'Highcoon-vTuber-face-rigs.blend'));s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.render.resolution_percentage=100;s.render.film_transparent=False;s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.025,.04,.065,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.4
cam=bpy.data.objects.new('FaceReviewCamera',bpy.data.cameras.new('FaceReviewCamera'));s.collection.objects.link(cam);s.camera=cam;cam.data.type='ORTHO'
for pos,power,size in [((3,-5,6),650,5),((-4,-3,3),500,4),((1,4,5),800,3)]:
 l=bpy.data.objects.new('FaceReviewLight',bpy.data.lights.new('FaceReviewLight','AREA'));s.collection.objects.link(l);l.location=pos;l.data.energy=power;l.data.size=size;l.rotation_euler=(Vector((0,0,2.35))-l.location).to_track_quat('-Z','Y').to_euler()
for id,thumb in [('highcoon-classic','classic'),('highcoon-full-spectrum','terpsuit')]:
 r=bpy.data.objects[id+'_Rig'];r.location=(0,0,0);r.animation_data.action=None
 for t in r.animation_data.nla_tracks:t.mute=True
 for o in s.objects:
  if o.type=='MESH':o.hide_render=o.parent!=r
 for p in r.pose.bones:p.location=(0,0,0);p.rotation_quaternion=(1,0,0,0);p.scale=(1,1,1)
 cam.data.ortho_scale=3.7;cam.location=(1,-7,2.2);cam.rotation_euler=(Vector((0,0,1.5))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.resolution_x=360;s.render.resolution_y=450;s.render.filepath=str(out/(thumb+'.png'));bpy.ops.render.render(write_still=True)
 cam.data.ortho_scale=1.65;cam.location=(.15,-6,2.50);cam.rotation_euler=(Vector((0,-.02,2.40))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.resolution_x=480;s.render.resolution_y=520
 for pose in ['neutral','speech','blink']:
  for p in r.pose.bones:p.location=(0,0,0);p.rotation_quaternion=(1,0,0,0);p.scale=(1,1,1)
  if pose=='speech':
   h=1.115;r.pose.bones['SGX_FaceVolume'].scale=(1/math.sqrt(h),h,1/math.sqrt(h));r.pose.bones['SGX_Muzzle'].scale=(.94,1.25,1.11);r.pose.bones['SGX_Muzzle'].location=(0,-.045,.022)
  if pose=='blink':
   for side in ['L','R']:r.pose.bones['SGX_Blink.'+side].scale=(1.035,.08,1)
  s.render.filepath=str(out/(id+'-'+pose+'.png'));bpy.ops.render.render(write_still=True)
