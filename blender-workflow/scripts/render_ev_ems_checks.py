"""Render reproducible rear, interior and exposed e-axle visual checks."""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/"assets"/"vehicle"
bpy.ops.wm.open_mainfile(filepath=str(OUT/"ev-ems-gt.blend"))
scene=bpy.context.scene
scene.cycles.samples=32
scene.render.resolution_x=1400
scene.render.resolution_y=900
camera=scene.camera
vehicle=bpy.data.collections["EV-EMS GT · editable source"]

def shot(name,pos,target,lens=58):
    if "--checks-only" in sys.argv: return
    camera.location=pos
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.lens=lens
    scene.render.filepath=str(OUT/name)
    bpy.ops.render.render(write_still=True)

shot("rear.png",(6.1,-5.7,2.7),(0,0,.61))
for o in vehicle.objects:
    if o.get("component_id") in {"Body","Glass","Headlights","Taillights"}: o.hide_render=True
shot("interior.png",(-2.7,-3.4,3.3),(.02,0,.71),60)
for o in vehicle.objects:
    o.hide_render = o.get("component_id") not in {"MotorRotor","GearIntermediate","Differential","DriveShaft_L","DriveShaft_R","Wheel_RL","Wheel_RR"}
shot("powertrain.png",(3.2,-3.3,1.65),(1.36,-.03,.37),70)

# Verify the source rig's relationships at an intermediate timeline position.
scene.frame_set(61)
angles={name:bpy.data.objects[name].rotation_euler.y for name in ("Wheel_FL","Wheel_RL","MotorRotor","GearIntermediate","Differential","DriveShaft_L","DriveShaft_R")}
wheel=angles["Wheel_RL"]
checks={"motor_ratio":abs(angles["MotorRotor"]/wheel-8.2)<1e-5,
        "intermediate_ratio":abs(angles["GearIntermediate"]/wheel+3)<1e-5,
        "differential_ratio":abs(angles["Differential"]/wheel-1)<1e-5,
        "halfshaft_ratio":all(abs(angles[n]/wheel-1)<1e-5 for n in ("DriveShaft_L","DriveShaft_R")),
        "stationary_calipers":all(o.parent.name=="Chassis" for o in vehicle.objects if "Caliper" in o.name),
        "rotating_discs":all(o.parent.name.startswith("Wheel_") for o in vehicle.objects if "Ventilated_Brake_Rotor" in o.name),
        "no_legacy_11kW_claim":all("11KW" not in o.data.body for o in vehicle.objects if o.type=="FONT"),
        "no_coplanar_hood_trim":not any("GT_Hood_Press_" in o.name for o in vehicle.objects)}
result={"blender_version":bpy.app.version_string,"frame":61,"angles_radians_blender_y":angles,"checks":checks,"all_passed":all(checks.values()),"rendered_this_run":[] if "--checks-only" in sys.argv else ["rear.png","interior.png","powertrain.png"],"visual_evidence":["poster.png","rear.png","interior.png","powertrain.png"],"scope":"Software mesh/animation checks only; not physical engineering validation."}
(OUT/"model-validation.json").write_text(json.dumps(result,indent=2))
assert all(checks.values()), result
