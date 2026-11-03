"""EV-EMS GT: editable original concept vehicle and component-batched web asset.

Reuses the project's original parametric coachwork and authored mechanical parts.
No external meshes, textures or commercial vehicle specifications are used.
Run: blender --background --python blender-workflow/scripts/build_ev_ems_gt.py
"""
import bpy
import sys
import json
import struct
import math
from pathlib import Path
from collections import defaultdict
from mathutils import Vector, Quaternion

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "assets" / "vehicle"
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(HERE))
import ev_detail_geometry as geo
import ev_ems_coachwork
import ev_ems_mechanics
ev_ems_coachwork.install()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
vehicle = bpy.data.collections.new("EV-EMS GT · editable source")
scene.collection.children.link(vehicle)
source_report = geo.enhance_vehicle(vehicle, {})
mechanism_report = ev_ems_mechanics.install(vehicle)
source_report["source_parts"] = len(vehicle.objects)

# Separate dynamic optical systems and preserve actual source parts in the blend.
groups = {
    "ev_body_front": "Body", "ev_body_rear": "Body", "ev_roof": "Body",
    "ev_aero": "Body", "ev_door_l": "Body", "ev_door_r": "Body", "ev_mirrors": "Body",
    "ev_glass": "Glass", "ev_interior": "Interior", "ev_seats": "Interior", "ev_cockpit": "Interior",
    "ev_battery_pack": "Battery", "ev_motor": "Motor", "ev_inverter": "Inverter",
    "ev_dcdc": "DCDC", "ev_obc": "Charger", "ev_cooling": "Cooling", "ev_radiator": "Cooling",
    "ev_wheel_fl": "Wheel_FL", "ev_wheel_fr": "Wheel_FR", "ev_wheel_rl": "Wheel_RL", "ev_wheel_rr": "Wheel_RR",
    "MotorRotor": "MotorRotor", "MotorStator": "MotorStator", "GearIntermediate": "GearIntermediate",
    "Differential": "Differential", "DriveShaft_L": "DriveShaft_L", "DriveShaft_R": "DriveShaft_R",
}

def copy_mat(key, name, color=None, metallic=None, roughness=None, emission=None):
    mat = geo.M[key].copy()
    mat.name = name
    bs = mat.node_tree.nodes.get("Principled BSDF")
    if color is not None:
        bs.inputs["Base Color"].default_value = (*color, 1)
        mat.diffuse_color = (*color, 1)
    if metallic is not None:
        bs.inputs["Metallic"].default_value = metallic
    if roughness is not None:
        bs.inputs["Roughness"].default_value = roughness
    if emission is not None:
        bs.inputs["Emission Strength"].default_value = emission
        if color is not None:
            bs.inputs["Emission Color"].default_value = (*color, 1)
    return mat

paint = copy_mat("paint", "Paint_AtlanticSilver", (.055, .14, .18), .68, .24)
paint.node_tree.nodes.get("Principled BSDF").inputs["Coat Weight"].default_value = .8
glass = copy_mat("glass", "Glass_SmokedLaminated", (.045, .075, .090), .0, .065)
glass.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = 1
glass.node_tree.nodes.get("Principled BSDF").inputs["Transmission Weight"].default_value = .82
headlight = copy_mat("led_white", "Headlight_MatrixLED", (.70, .86, 1), emission=4)
taillight = copy_mat("led_red", "Taillight_ContinuousLED", (1, .015, .008), emission=3)
cabinlight = copy_mat("led_cyan", "CabinLight_Ambient", (.10, .75, .70), emission=2)
display = copy_mat("display", "Display_Infotainment", (.015, .13, .16), emission=.8)
display_text = copy_mat("led_white", "Display_Pixels", (.45, .86, .9), emission=1.5)
bronze = copy_mat("alloy", "Alloy_ChampagneMachined", (.50, .40, .23), .85, .27)

for obj in list(vehicle.objects):
    name = obj.name
    cid = obj.get("component_id", "ev_chassis")
    group = groups.get(cid, "Chassis")
    if cid == "ev_lights":
        group = "Taillights" if "Rear" in name else "Headlights"
    if "Ambient" in name:
        group = "CabinLights"
    if name.startswith(("GT_Center_Display", "GT_Center_Screen", "GT_Screen_Tile")):
        group = "Infotainment"
    obj["component_id"] = group
    obj["illustrative"] = True
    obj["engineering_status"] = "Original concept geometry, not physical circuit wiring or certified vehicle CAD"
    obj.location.z += .13  # Tyre contact patch is on the world ground plane.
    if obj.type == "FONT":
        text = obj.data.body
        text = text.replace("E C S", "E V - E M S").replace("E  C  S", "E V - E M S")
        text = text.replace("96V · 14.4 kWh · Li-ION", "96 V / 14.4 kWh / SCENARIO")
        text = text.replace("HARDWARE STUDIO", "ENERGY STUDIO")
        text = text.replace("OBC · 11KW", "AC CHARGER")
        text = text.replace("GT / ELECTRIC", "AERIS GT")
        obj.data.body = text
    if obj.type not in {"MESH", "FONT", "CURVE"}:
        continue
    if "Front_Seatbelt" in name and obj.type == "MESH":
        for v in obj.data.vertices:
            v.co.y *= .87
            v.co.z = min(v.co.z, .94)
    for slot in obj.material_slots:
        key = slot.material.name if slot.material else ""
        if key == "GT_paint": slot.material = paint
        if key == "GT_glass": slot.material = glass
        if group == "Headlights" and key in {"GT_led_white", "GT_led_cyan"}: slot.material = headlight
        if group == "Taillights" and key == "GT_led_red": slot.material = taillight
        if group == "CabinLights": slot.material = cabinlight
        if group == "Infotainment":
            if key in {"GT_led_cyan", "GT_led_white"}: slot.material = display_text
            if key == "GT_display": slot.material = display
        if group.startswith("Wheel") and ("Split_Spoke" in name or "Rim_Lip" in name): slot.material = bronze

# Refined road-car silhouette: preserve a restrained integral rear lip instead of
# the earlier track wing. The original file and its editable wing remain intact.
for obj in list(vehicle.objects):
    if any(s in obj.name for s in ("GT_Rear_Aero_Wing", "GT_Wing_Pylon", "GT_Wing_Endplate")):
        bpy.data.objects.remove(obj, do_unlink=True)

# Authored illustrative HV connections only. They intentionally carry no circuit
# endpoint mapping and never reuse the erroneous legacy EV_W10/EV_W11 routes.
geo.CID = "Harness"
for name, pts in [
    ("GT_HV_Pack_To_Inverter", [(1.02,.05,.54),(1.12,.05,.60),(1.06,.45,.61),(.90,.47,.64)]),
    ("GT_HV_Inverter_To_Motor", [(.94,.58,.64),(1.24,.57,.63),(1.50,.38,.54)]),
    ("GT_HV_Charge_Path", [(-.90,.05,.55),(-1.14,.07,.60),(-1.15,.26,.62)]),
]:
    geo.pipe(name, pts, .013, "orange", 10)

# Semantic parents are kept as the public contract in both source and glTF.
bpy.context.view_layer.update()
parents = {}
for group in sorted({o.get("component_id", "Chassis") for o in vehicle.objects}):
    parent = bpy.data.objects.new(group, None)
    vehicle.objects.link(parent)
    parent["component_id"] = group
    parent["illustrative"] = True
    parent.empty_display_type = "PLAIN_AXES"
    parent.empty_display_size = .15
    if group.startswith("Wheel_"):
        front = group[6] == "F"
        left = group[7] == "L"
        parent.location = (-1.32 if front else 1.32, .78 if left else -.78, .31)
    if group in ev_ems_mechanics.PIVOTS:
        x,y,z=ev_ems_mechanics.PIVOTS[group]
        parent.location = (x,y,z+.13)
    parents[group] = parent
bpy.context.view_layer.update()
for obj in list(vehicle.objects):
    if obj.type != "EMPTY":
        world = obj.matrix_world.copy()
        obj.parent = parents[obj.get("component_id", "Chassis")]
        obj.matrix_world = world

# A slow mechanical demonstration is saved in the editable source.
# Browser playback deliberately ignores these keyframes and uses simulated
# distance and the same 8.2:1 drivetrain ratio instead.
scene.frame_start, scene.frame_end = 1, 241
scene.render.fps = 24
for name, parent in parents.items():
    ratio = 1 if name.startswith("Wheel_") or name in {"Differential", "DriveShaft_L", "DriveShaft_R"} else 8.2 if name == "MotorRotor" else -3 if name == "GearIntermediate" else None
    if ratio is None: continue
    parent.rotation_euler[1] = 0
    parent.keyframe_insert(data_path="rotation_euler",index=1,frame=1)
    parent.rotation_euler[1] = -math.tau * 3 * ratio
    parent.keyframe_insert(data_path="rotation_euler",index=1,frame=241)
    if parent.animation_data and parent.animation_data.action:
        action = parent.animation_data.action
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points: key.interpolation="LINEAR"
scene.frame_set(1)

# Studio remains editable in .blend but is excluded from the web asset.
studio = bpy.data.collections.new("Studio · render only")
scene.collection.children.link(studio)
def studio_link(obj):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    studio.objects.link(obj)
    return obj

floor_mat = bpy.data.materials.new("Studio_Charcoal")
floor_mat.diffuse_color = (.013, .022, .027, 1)
floor_mat.use_nodes = True
p = floor_mat.node_tree.nodes.get("Principled BSDF")
p.inputs["Base Color"].default_value = (.013,.022,.027,1)
p.inputs["Metallic"].default_value = .28
p.inputs["Roughness"].default_value = .28
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.006))
floor = studio_link(bpy.context.object)
floor.name = "Studio floor"
floor.data.materials.append(floor_mat)

def area(name, loc, energy, color, size, target=(0,0,.6), size_y=None):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "RECTANGLE"
    data.size = size
    data.size_y = size_y or size
    obj = bpy.data.objects.new(name, data)
    studio.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj

area("Key softbox", (-1,-3,5), 1100, (.78,.88,1), 6, size_y=2)
area("Top reflection strip", (0,1,5.3), 1400, (.90,.95,1), 5.5, size_y=.7)
area("Rear rim", (3,2.7,3.2), 1400, (.65,.87,1), 4, size_y=1.5)
area("Warm front edge", (-4,2.2,1.8), 900, (1,.81,.58), 3, size_y=2.5)
area("Side fill", (0,-4,1.7), 450, (.55,.75,.80), 5, size_y=2)

cam_data = bpy.data.cameras.new("EV-EMS hero camera")
camera = bpy.data.objects.new("EV-EMS hero camera", cam_data)
studio.objects.link(camera)
camera.location = (-6.6,-6.5,3.0)
camera.rotation_euler = (Vector((0,0,.56))-camera.location).to_track_quat("-Z","Y").to_euler()
camera.data.type = "PERSP"
camera.data.lens = 58
scene.camera = camera
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.055,.070,.090,1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = .35
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
scene.render.filepath = str(OUT / "poster.png")
scene.render.image_settings.color_mode = "RGB"

for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type == "VIEW_3D":
            a.spaces.active.region_3d.view_perspective = "CAMERA"
            a.spaces.active.shading.type = "MATERIAL"

# Prevent incremental .blend1 copies and keep the user's original sources intact.
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "ev-ems-gt.blend"))
bpy.ops.render.render(write_still=True)

# Batch evaluated source geometry per semantic component and material. Keep parent
# wheel pivots by converting world coordinates back to parent-local coordinates.
deps = bpy.context.evaluated_depsgraph_get()
batches = defaultdict(list)
for obj in list(vehicle.objects):
    if obj.type not in {"MESH", "FONT", "CURVE"}: continue
    evaluated = obj.evaluated_get(deps)
    mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=deps)
    mat = mesh.materials[0]
    group = obj.get("component_id", "Chassis")
    batches[(group, mat.name)].append((obj,mesh,obj.matrix_world.copy(),mat))

triangles = 0
mesh_triangles = {}
for (group, matname), entries in batches.items():
    verts, faces, smooth, normals = [], [], [], []
    parent = parents[group]
    inv = parent.matrix_world.inverted()
    for original, data, matrix, material in entries:
        m = inv @ matrix
        off = len(verts)
        verts.extend(tuple(m @ v.co) for v in data.vertices)
        faces.extend(tuple(off + i for i in p.vertices) for p in data.polygons)
        smooth.extend(p.use_smooth for p in data.polygons)
        nm = m.to_3x3().inverted().transposed()
        normals.extend(tuple((nm @ n.vector).normalized()) for n in data.corner_normals)
    data = bpy.data.meshes.new(group + "_" + matname)
    data.from_pydata(verts, [], faces)
    data.materials.append(entries[0][3])
    data.update()
    for poly, flag in zip(data.polygons, smooth): poly.use_smooth = flag
    if len(normals)==len(data.loops): data.normals_split_custom_set(normals)
    obj = bpy.data.objects.new(group + "_" + matname, data)
    vehicle.objects.link(obj)
    obj.parent = parent
    obj["component_id"] = group
    obj["illustrative"] = True
    obj["source_parts_count"] = len(entries)
    data.calc_loop_triangles()
    if len(data.loop_triangles) > 1000 and group not in {"Body", "Glass", "Headlights", "Taillights"}:
        bpy.context.view_layer.objects.active = obj
        decimate = obj.modifiers.new("Web detail reduction", "DECIMATE")
        decimate.ratio = .56 if group.startswith("Wheel") else .46
        decimate.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
    mesh_triangles[obj.name] = len(obj.data.loop_triangles)
    for original, mesh, _, _ in entries:
        bpy.data.objects.remove(original, do_unlink=True)
        bpy.data.meshes.remove(mesh)

bpy.ops.object.select_all(action="DESELECT")
for obj in vehicle.objects: obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "ev-ems-gt.glb"), export_format="GLB", use_selection=True,
                          export_extras=True, export_apply=True, export_yup=True,
                          export_cameras=False, export_lights=False, export_animations=False)
glb_bytes=(OUT / "ev-ems-gt.glb").read_bytes()
glb_json_length=struct.unpack_from("<I",glb_bytes,12)[0]
glb_doc=json.loads(glb_bytes[20:20+glb_json_length])
exported_triangles=sum(glb_doc["accessors"][p["indices"]]["count"]//3 for m in glb_doc["meshes"] for p in m["primitives"])
report = {
    "name": "Aeris GT / EV-EMS", "revision": "2026-11-03", "provenance": "Original project parametric coachwork and mechanical geometry, revised for EV-EMS. No third-party assets.",
    "source_blend": "assets/vehicle/ev-ems-gt.blend", "web_asset": "assets/vehicle/ev-ems-gt.glb",
    "illustrative": True, "scope": "Cosmetic concept geometry; no verified commercial vehicle specification, no 12 V wiring model.",
    "coordinate_system": "Blender: nose -X, width Y, up Z. glTF: nose -X, up +Y, axle Z. Ground Y=0.",
    "mechanism": mechanism_report,
    "mechanism_pivots_gltf": {name:[x,z+.13,-y] for name,(x,y,z) in ev_ems_mechanics.PIVOTS.items()},
    "wheel_pivots_gltf": {"Wheel_FL": [-1.32,.31,-.78], "Wheel_FR": [-1.32,.31,.78], "Wheel_RL": [1.32,.31,-.78], "Wheel_RR": [1.32,.31,.78]},
    "component_groups": list(parents), "source_parts": source_report["source_parts"],
    "draw_meshes": len(batches), "triangles": exported_triangles, "triangles_before_gltf_cleanup": triangles, "glb_bytes": (OUT / "ev-ems-gt.glb").stat().st_size,
    "triangles_by_mesh": dict(sorted(mesh_triangles.items(), key=lambda entry: -entry[1])),
    "texture_images": 0, "materials": sorted({mat for _, mat in batches}),
}
(OUT / "model-manifest.json").write_text(json.dumps(report, indent=2))
print("EV_EMS_ASSET_RESULT " + json.dumps(report))
