"""Preserve the saved phase-1 source; create the phase-2 assembly and cabin.
Run with Blender --background --python blender-workflow/scripts/build_ev_ems_phase2.py
"""
import bpy,bmesh,sys,json,math,struct,hashlib
from pathlib import Path
from collections import defaultdict
from mathutils import Vector
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];OUT=ROOT/"assets"/"vehicle"
sys.path.insert(0,str(HERE))
import ev_detail_geometry as geo
import ev_ems_phase2_interior as cabin
import ev_ems_mechanics as mechanics
BASE=OUT/"ev-ems-gt.blend"
base_hash=hashlib.sha256(BASE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(BASE))
scene=bpy.context.scene;scene.frame_set(1);bpy.context.view_layer.update()
vehicle=bpy.data.collections["EV-EMS GT · editable source"]
base_audit={"sha256":base_hash,"bytes":BASE.stat().st_size,"objects":len(vehicle.objects),"frame_at_load":scene.frame_current}

# Preserve actual saved object geometry, detach from the old assembly parents,
# and then create the finer hierarchy. This occurs in a background copy only.
for o in list(vehicle.objects):
    if o.type!="EMPTY":
        world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
for o in list(vehicle.objects):
    if o.type=="EMPTY":bpy.data.objects.remove(o,do_unlink=True)
geo.C=vehicle
geo.M={m.name[3:]:m for m in bpy.data.materials if m.name.startswith("GT_")}
geo.M["paint"]=bpy.data.materials["Paint_AtlanticSilver"]
geo.M["glass"]=bpy.data.materials["Glass_SmokedLaminated"]

# Remove the earlier block-style upholstery/cockpit, preserving body, chassis,
# the complete powertrain, fixed suspension and electrical component geometry.
old_prefixes=("GT_Seat_","GT_Headrest_","GT_Belt_Buckle_","GT_Front_Seatbelt_","GT_Dashboard","GT_Dash_","GT_Driver_Display","GT_Instrument_","GT_Center_Display","GT_Center_Screen","GT_Screen_Tile","GT_Leather_Steering_Wheel","GT_Steering_Airbag","GT_Steering_Spoke","GT_Steering_Badge","GT_Paddle_","GT_Column_Stalk_","GT_Center_Console","GT_Console_","GT_Cupholder_","GT_Drive_Selector","GT_Selector_Light","GT_Aluminium_Pedal_","GT_Pedal_Grip_","GT_Hood_Press_")
for o in list(vehicle.objects):
    if o.name.startswith(old_prefixes):bpy.data.objects.remove(o,do_unlink=True)

def clip_mesh(original,name,low=None,high=None):
    obj=original.copy();obj.data=original.data.copy();obj.name=name;vehicle.objects.link(obj)
    bm=bmesh.new();bm.from_mesh(obj.data)
    for x,inner,outer in ((low,True,False),(high,False,True)):
        if x is None:continue
        # Every coachwork mesh here uses world-aligned X. Frame-1 parent is gone.
        plane_x=x-obj.location.x
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=(plane_x,0,0),plane_no=(1,0,0),clear_inner=inner,clear_outer=outer)
    bm.to_mesh(obj.data);bm.free();obj.data.update();return obj

for o in list(vehicle.objects):
    n=o.name
    if n.startswith(("GT_Continuous_Sculpted_Flank_","GT_Shoulder_Transition_")):
        side="L" if n.endswith("_1") else "R"
        for suffix,lo,hi,group in (("Fore",None,-.82,"Body"),("Door",-.82,.90,"Door_"+side),("Aft",.90,None,"Body")):
            piece=clip_mesh(o,n+"_"+suffix,lo,hi);piece["component_id"]=group
        bpy.data.objects.remove(o,do_unlink=True)

def center_world(o):
    if o.type=="MESH" and len(o.data.vertices):
        pts=[o.matrix_world@v.co for v in o.data.vertices]
        return Vector(tuple((min(v[i] for v in pts)+max(v[i] for v in pts))/2 for i in range(3)))
    return o.matrix_world.translation

suspension_patterns=("Shock_Tower","Wishbone","Control_Arm_Bushing","Ball_Joint","Hub_Carrier","Damper_","Helical_Coil_Spring","Spring_Seat","Strut_Top_Nut","Sway_Drop_Link")
door_patterns=("GT_Flush_Handle_","GT_Handle_Insert_","GT_Curved_Side_Glass_","GT_Mirror_Stalk_","GT_Aerodynamic_Mirror_","GT_Mirror_Glass_","GT_Inner_Door_Card_","GT_Door_Armrest_","GT_Interior_Door_Pull_","GT_Door_Speaker_","GT_Speaker_Grille_","GT_Ambient_Door_Light_")
for o in list(vehicle.objects):
    n=o.name
    if n.startswith(("GT_Seamless_Compound_Hood","GT_Hood_Badge")):o["component_id"]="Bonnet"
    if n.startswith(door_patterns):
        o["component_id"]="Door_L" if center_world(o).y>0 else "Door_R"
    for corner in ("fl","fr","rl","rr"):
        if n.startswith("GT_"+corner+"_"):
            if any(k in n for k in ("Ventilated_Brake_Rotor","Rotor_Hat","Rotor_Drilling")):o["component_id"]="BrakeDisc_"+corner.upper()
            if "Caliper" in n:o["component_id"]="BrakeCaliper_"+corner.upper()
    if any(k in n for k in suspension_patterns):
        c=center_world(o);o["component_id"]="Suspension_"+("F" if c.x<0 else "R")+("L" if c.y>0 else "R")

interior_report=cabin.cabin(vehicle)

# The separated bonnet includes a bonded inner reinforcement rather than only
# a single skin. Rib heights follow the saved hood's original profile.
import ev_ems_coachwork as coachwork
geo.CID="Bonnet"
for y in (-.43,.43):
    pts=[]
    for i in range(29):
        x=-1.91+i*.94/28
        z=coachwork.top(x,y/(coachwork.width(x)-.025))+.13-.021
        pts.append((x,y,z))
    geo.pipe("Bonnet_InnerLongitudinalRib_"+str(y),pts,.011,"graphite",8)
for x in (-1.77,-1.38,-1.00):
    pts=[]
    for i in range(25):
        y=-.43+i*.86/24
        z=coachwork.top(x,y/(coachwork.width(x)-.025))+.13-.021
        pts.append((x,y,z))
    geo.pipe("Bonnet_InnerCrossRib_"+str(x),pts,.011,"graphite",8)
for y in (-.46,.46):
    geo.box("Bonnet_HingeLeaf_"+str(y),(-.91,y,.781),(.082,.035,.010),"alloy",.004)

# Small tyre/rim index patches make rotation unambiguous even with repetitive
# spokes and studio lighting. They rotate with the tyres, never the calipers.
for x,axle in ((-1.32,"F"),(1.32,"R")):
    for side,lr in ((1,"L"),(-1,"R")):
        geo.CID="Wheel_"+axle+lr
        pts=[(x+.284*math.cos(a),side*.903,.31+.284*math.sin(a)) for a in [math.pi/2-.055+i*.11/12 for i in range(13)]]
        marker=geo.pipe("Wheel_"+axle+lr+"_RotationIndex",pts,.005,"seat_stitch",8)
        marker["rotation_index"]=True

bpy.context.view_layer.update()
source_parts=len(vehicle.objects)
pivots={
    "Bonnet":(-.86,0,.80),"Door_L":(-.82,.81,.79),"Door_R":(-.82,-.81,.79),
    "Dashboard":(-.59,0,.82),"SteeringWheel":(-.284,.34,.920),"CenterConsole":(0,0,.70),
    "InstrumentCluster":(-.447,.34,.963),"Infotainment":(-.413,-.135,.934),
    **cabin.SEAT_POSITIONS,
    **{name:(x,y,z+.13) for name,(x,y,z) in mechanics.PIVOTS.items()},
}
for axle,x in (("F",-1.32),("R",1.32)):
    for lr,y in (("L",.78),("R",-.78)):
        for prefix in ("Wheel","BrakeDisc","BrakeCaliper"):pivots[prefix+"_"+axle+lr]=(x,y,.31)
        pivots["Suspension_"+axle+lr]=(x,.56 if lr=="L" else -.56,.40)

parents={}
for name in sorted({o.get("component_id","Chassis") for o in vehicle.objects}):
    p=bpy.data.objects.new(name,None);vehicle.objects.link(p);p.empty_display_type="PLAIN_AXES";p.empty_display_size=.08
    p.location=pivots.get(name,(0,0,0));p["component_id"]=name;p["assembly_component"]=True;p["illustrative"]=True;parents[name]=p
bpy.context.view_layer.update()
for o in list(vehicle.objects):
    if o.type!="EMPTY":
        world=o.matrix_world.copy();o.parent=parents[o.get("component_id","Chassis")];o.matrix_world=world
        o["illustrative"]=True

# Five wheel revolutions in ten seconds form a seamless mechanical loop:
# motor 41 turns, intermediate -15 turns, wheels/discs/differential five turns.
scene.frame_start=1;scene.frame_end=241;scene.render.fps=24
for name,p in parents.items():
    ratio=1 if name.startswith(("Wheel_","BrakeDisc_")) or name in {"Differential","DriveShaft_L","DriveShaft_R"} else 8.2 if name=="MotorRotor" else -3 if name=="GearIntermediate" else None
    if ratio is None:continue
    p.rotation_euler.y=0;p.keyframe_insert(data_path="rotation_euler",index=1,frame=1)
    p.rotation_euler.y=-math.tau*5*ratio;p.keyframe_insert(data_path="rotation_euler",index=1,frame=241)
    for layer in p.animation_data.action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:key.interpolation="LINEAR"
scene.frame_set(1)

camera=scene.camera;camera.location=(-6.6,-6.5,3.0)
camera.rotation_euler=(Vector((0,0,.56))-camera.location).to_track_quat("-Z","Y").to_euler()
camera.data.lens=58
scene.render.engine="CYCLES";scene.cycles.samples=40;scene.cycles.use_denoising=True
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.filepath=str(OUT/"poster-phase2.png")
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=="VIEW_3D":area.spaces.active.region_3d.view_perspective="CAMERA";area.spaces.active.shading.type="MATERIAL"
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"ev-ems-gt-phase2.blend"))
bpy.ops.render.render(write_still=True)

# Export batching preserves explicit UV layers and exact screen mesh names.
deps=bpy.context.evaluated_depsgraph_get();batches=defaultdict(list)
for o in list(vehicle.objects):
    if o.type not in {"MESH","FONT","CURVE"}:continue
    data=bpy.data.meshes.new_from_object(o.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
    if not len(data.polygons):bpy.data.meshes.remove(data);continue
    mat=data.materials[0];group=o.get("component_id","Chassis");screen=o.get("screen_id","")
    batches[(group,mat.name,screen)].append((o,data,o.matrix_world.copy(),mat))
for (group,matname,screen),entries in batches.items():
    verts=[];faces=[];smooth=[];normals=[];uvs=[];has_uv=False;p=parents[group];inv=p.matrix_world.inverted()
    for original,data,world,mat in entries:
        transform=inv@world;off=len(verts)
        verts.extend(tuple(transform@v.co) for v in data.vertices)
        faces.extend(tuple(off+i for i in polygon.vertices) for polygon in data.polygons)
        smooth.extend(poly.use_smooth for poly in data.polygons)
        normal_matrix=transform.to_3x3().inverted().transposed()
        normals.extend(tuple((normal_matrix@n.vector).normalized()) for n in data.corner_normals)
        layer=data.uv_layers.active
        has_uv=has_uv or layer is not None
        uvs.extend(tuple(loop.uv) for loop in layer.data) if layer else uvs.extend((0,0) for _ in data.loops)
    data=bpy.data.meshes.new(screen or group+"_"+matname);data.from_pydata(verts,[],faces);data.materials.append(entries[0][3]);data.update()
    for polygon,flag in zip(data.polygons,smooth):polygon.use_smooth=flag
    if len(normals)==len(data.loops):data.normals_split_custom_set(normals)
    if has_uv:
        layer=data.uv_layers.new(name="UV0")
        for loop,coord in zip(layer.data,uvs):loop.uv=coord
    # Remove the source mesh before adding its exact-name display counterpart.
    for original,old_data,_,_ in entries:bpy.data.objects.remove(original,do_unlink=True);bpy.data.meshes.remove(old_data)
    obj=bpy.data.objects.new(screen or group+"_"+matname,data);vehicle.objects.link(obj);obj.parent=p
    obj["component_id"]=group;obj["illustrative"]=True;obj["source_parts_count"]=len(entries)
    if screen:obj["screen_id"]=screen
    data.calc_loop_triangles()
    if len(data.loop_triangles)>1300 and not screen and group not in {"Body","Glass","Bonnet","Door_L","Door_R","Headlights","Taillights"}:
        bpy.context.view_layer.objects.active=obj
        dec=obj.modifiers.new("Web detail reduction","DECIMATE");dec.ratio=.70 if group.startswith("Seat_") else .56 if group.startswith(("Wheel_","BrakeDisc_")) else .46;dec.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=dec.name)
bpy.ops.object.select_all(action="DESELECT")
for o in vehicle.objects:o.select_set(True)
target=OUT/"ev-ems-gt-phase2.glb"
bpy.ops.export_scene.gltf(filepath=str(target),export_format="GLB",use_selection=True,export_extras=True,export_apply=True,export_yup=True,export_texcoords=True,export_cameras=False,export_lights=False,export_animations=False)
raw=target.read_bytes();document=json.loads(raw[20:20+struct.unpack_from("<I",raw,12)[0]])
report={"name":"Aeris GT / EV-EMS phase 2","base_source":base_audit,"source_blend":"assets/vehicle/ev-ems-gt-phase2.blend","web_asset":"assets/vehicle/ev-ems-gt-phase2.glb","source_parts":source_parts,"component_groups":list(parents),"group_count":len(parents),"draw_meshes":len(document["meshes"]),"triangles":sum(document["accessors"][p["indices"]]["count"]//3 for m in document["meshes"] for p in m["primitives"]),"glb_bytes":len(raw),"materials":len(document["materials"]),"interior":interior_report,"pivots_gltf":{n:[x,z,-y] for n,(x,y,z) in pivots.items()},"hierarchy":"Every assembly component is a root sibling; meshes are immediate children. Brake discs have their own wheel-aligned pivots.","animation":"Source timeline 1-241 at 24fps: wheels, discs, differential and halfshafts 5 turns; motor41; intermediate-15. Calipers and suspension fixed. GLB has no baked animation; browser uses simulator state.","uv_contract":"Screen UV0 bottom-left(0,0), top-right(1,1) from cabin +X. CanvasTexture.flipY=false. Both surfaces emit towards glTF +X.","engineering_scope":"Illustrative 2+2 vehicle geometry and straight-line drivetrain kinematics; not physical circuit wiring or manufacturer CAD."}
(OUT/"model-manifest-phase2.json").write_text(json.dumps(report,indent=2))
assert hashlib.sha256(BASE.read_bytes()).hexdigest()==base_hash,"Phase-1 source changed during generation; never overwrite it"
print("PHASE2_ASSET_RESULT "+json.dumps(report))
