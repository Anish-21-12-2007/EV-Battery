"""Phase-2 source-rig, seat-fit and screen-visibility checks, plus cabin views."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/"assets"/"vehicle"
bpy.ops.wm.open_mainfile(filepath=str(OUT/"ev-ems-gt-phase2.blend"))
scene=bpy.context.scene;vehicle=bpy.data.collections["EV-EMS GT · editable source"]
scene.frame_set(1);bpy.context.view_layer.update()
checks={};detail={}
for name in ("Seat_FL","Seat_FR","Seat_RL","Seat_RR"):
    points=[o.matrix_world@v.co for o in vehicle.objects if o.parent and o.parent.name==name and o.type=="MESH" for v in o.data.vertices]
    bounds={"min":[min(p[i] for p in points) for i in range(3)],"max":[max(p[i] for p in points) for i in range(3)]}
    detail[name]=bounds
    checks[name+"_cabin_width"]=max(abs(bounds["min"][1]),abs(bounds["max"][1]))<.69
    checks[name+"_roof_clearance"]=bounds["max"][2]<(1.25 if name.startswith("Seat_F") else 1.025)
    checks[name+"_floor_alignment"]=bounds["min"][2]>.55

# Direct eye rays prove the live texture face is not hidden behind its bezel.
deps=bpy.context.evaluated_depsgraph_get();eye=Vector((.18,0,1.16));rays={}
for name in ("Screen_Cluster","Screen_Infotainment"):
    obj=bpy.data.objects[name]
    target=sum((obj.matrix_world@v.co for v in obj.data.vertices),Vector())/len(obj.data.vertices)
    hit,pos,normal,index,ob,matrix=scene.ray_cast(deps,eye,(target-eye).normalized(),distance=(target-eye).length+.05)
    rays[name] = ob.name if hit else None
    checks[name+"_visible_from_cabin"]=hit and ob.name==name
    checks[name+"_uv0"]=obj.data.uv_layers.active is not None and len(obj.data.uv_layers.active.data)==4
    checks[name+"_forward_normal"]=(obj.matrix_world.to_3x3()@obj.data.polygons[0].normal).x>.99
detail["cabin_screen_ray_hits"]=rays

scene.frame_set(25);bpy.context.view_layer.update()
wheel=bpy.data.objects["Wheel_FL"].rotation_euler.y
checks["visible_wheel_angle"]=abs(wheel)>1
for corner in ("FL","FR","RL","RR"):
    checks["disc_sync_"+corner]=abs(bpy.data.objects["BrakeDisc_"+corner].rotation_euler.y-bpy.data.objects["Wheel_"+corner].rotation_euler.y)<1e-6
    checks["fixed_caliper_"+corner]=sum(abs(v) for v in bpy.data.objects["BrakeCaliper_"+corner].rotation_euler)<1e-6
    checks["fixed_suspension_"+corner]=sum(abs(v) for v in bpy.data.objects["Suspension_"+corner].rotation_euler)<1e-6
checks["motor_ratio"]=abs(bpy.data.objects["MotorRotor"].rotation_euler.y/wheel-8.2)<1e-5
checks["intermediate_ratio"]=abs(bpy.data.objects["GearIntermediate"].rotation_euler.y/wheel+3)<1e-5
checks["no_coplanar_hood_trim"]=not any(o.name.startswith("GT_Hood_Press_") for o in vehicle.objects)
checks["rotation_index_marks"]=len([o for o in vehicle.objects if o.get("rotation_index")])==4
scene.frame_set(1)
result={"blender":bpy.app.version_string,"checks":checks,"detail":detail,"all_passed":all(checks.values()),"scope":"Software geometry, UV, hierarchy and kinematic checks only. No physical component qualification."}
(OUT/"model-validation-phase2.json").write_text(json.dumps(result,indent=2))
if "--checks-only" not in sys.argv:
    scene.cycles.samples=28;scene.render.resolution_x=1400;scene.render.resolution_y=1000
    camera=scene.camera
    def shot(name,pos,target,lens=58):
        camera.location=pos;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat("-Z","Y").to_euler();camera.data.lens=lens
        scene.render.filepath=str(OUT/name);bpy.ops.render.render(write_still=True)
    shot("interior-window-phase2.png",(-2.8,-3.2,1.95),(.13,0,.91),68)
    for o in vehicle.objects:
        if o.get("component_id") in {"Body","Bonnet","Glass","Door_L","Door_R","Headlights","Taillights"}:o.hide_render=True
    shot("interior-seats-phase2.png",(-2.2,-2.8,2.8),(.23,0,.80),65)
    shot("interior-rear-phase2.png",(1.85,-2.45,1.65),(.17,0,.85),63)
assert all(checks.values()),result
