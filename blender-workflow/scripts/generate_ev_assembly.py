"""Generate illustrative EV hardware twin — hardware-first skateboard visualization.
Separate from the real 12V ECS assembly. All hardware is ILLUSTRATIVE and labeled as such.
Uses the same efficient helpers as generate_ecs_assembly.py. Keep triangle budget 80-130k.
"""
import math
import json
from pathlib import Path

import bpy
from mathutils import Vector

COLLECTION_NAME = "EV_Hardware_Twin"
OUTPUT_FILENAME = "ev-vehicle-assembly.glb"

# Lightweight helpers — copy conventions from generate_ecs_assembly.py
def unique_object_name(base_name):
    if base_name not in bpy.data.objects:
        return base_name
    suffix = 1
    while f"{base_name}.{suffix:03d}" in bpy.data.objects:
        suffix += 1
    return f"{base_name}.{suffix:03d}"


def make_material(name, color, metallic=0.0, roughness=0.4):
    mat = bpy.data.materials.new(name=name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    if shader is not None:
        shader.inputs["Base Color"].default_value = (*color, 1.0)
        shader.inputs["Metallic"].default_value = metallic
        shader.inputs["Roughness"].default_value = roughness
    return mat


def make_mesh_object(name, vertices, faces, material, collection, smooth=False):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    if material is not None:
        mesh.materials.append(material)
    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = True
    obj = bpy.data.objects.new(unique_object_name(name), mesh)
    collection.objects.link(obj)
    return obj


def make_rounded_box(name, location, dimensions, material, collection, bevel=None):
    half_x, half_y, half_z = (d / 2 for d in dimensions)
    vertices = [
        (-half_x, -half_y, -half_z), (-half_x, -half_y, half_z),
        (-half_x, half_y, -half_z),  (-half_x, half_y, half_z),
        (half_x, -half_y, -half_z),  (half_x, -half_y, half_z),
        (half_x, half_y, -half_z),   (half_x, half_y, half_z),
    ]
    faces = [(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
    obj = make_mesh_object(name, vertices, faces, material, collection)
    obj.location = location
    max_bevel = min(dimensions) * 0.45
    bevel_width = min(bevel or min(dimensions) * 0.08, max_bevel)
    if bevel_width > 0:
        mod = obj.modifiers.new("Soft_Edges", "BEVEL")
        mod.width = bevel_width
        mod.segments = 2
        mod.limit_method = "ANGLE"
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def make_cylinder(name, location, radius, depth, material, collection, axis=(0,0,1), segments=20):
    verts = []
    for z in (-depth/2, depth/2):
        for i in range(segments):
            a = 2*math.pi*i/segments
            verts.append((radius*math.cos(a), radius*math.sin(a), z))
    faces = []
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple(range(segments, 2*segments)))
    for i in range(segments):
        ni = (i+1)%segments
        faces.append((i, ni, ni+segments, i+segments))
    obj = make_mesh_object(name, verts, faces, material, collection)
    obj.location = location
    direction = Vector(axis).normalized()
    obj.rotation_euler = Vector((0,0,1)).rotation_difference(direction).to_euler()
    for p in obj.data.polygons[2:]:
        p.use_smooth = True
    return obj


def catmull_rom_points(cpts, steps=5):
    pts = [Vector(p) for p in cpts]
    sampled = []
    for i in range(len(pts)-1):
        p0 = pts[max(i-1,0)]; p1 = pts[i]; p2 = pts[i+1]; p3 = pts[min(i+2, len(pts)-1)]
        for step in range(steps):
            t = step/steps; t2=t*t; t3=t2*t
            pt = 0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3)
            sampled.append(pt)
    sampled.append(pts[-1])
    return sampled


def make_wire(name, control_points, material, collection, radius=0.014, sides=10, dashed=False):
    path = catmull_rom_points(control_points)
    vertices=[]; faces=[]; ref=Vector((0,0,1)); arc=0
    for idx, pt in enumerate(path):
        if idx==0:
            tangent=(path[1]-pt).normalized()
        elif idx==len(path)-1:
            tangent=(pt-path[idx-1]).normalized()
        else:
            tangent=(path[idx+1]-path[idx-1]).normalized()
        if abs(tangent.dot(ref))>0.92:
            ref=Vector((0,1,0))
        side=tangent.cross(ref).normalized()
        up=tangent.cross(side).normalized()
        for k in range(sides):
            ang=2*math.pi*k/sides
            vertices.append(tuple(pt+radius*(math.cos(ang)*side+math.sin(ang)*up)))
        if idx:
            arc+=(pt-path[idx-1]).length
            on = True
            if on:
                for k in range(sides):
                    a=(idx-1)*sides+k; b=(idx-1)*sides+(k+1)%sides
                    faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(reversed(range(sides))))
    last=(len(path)-1)*sides
    faces.append(tuple(last+k for k in range(sides)))
    return make_mesh_object(name, vertices, faces, material, collection, smooth=True)


def build_chassis(collection, mats):
    # Floor pan + longitudinal rails + cross members — lightweight representation
    make_rounded_box("EV_Chassis_Floor_Pan", (0,0,0.16), (3.70, 1.58, 0.06), mats["chassis"], collection, bevel=0.04)
    for y in (-0.62, 0.62):
        make_rounded_box(f"EV_Chassis_Rail_{'L' if y<0 else 'R'}", (0, y, 0.26), (3.55, 0.08, 0.10), mats["steel"], collection, bevel=0.02)
    for x in (-1.25, -0.15, 0.85):
        make_rounded_box(f"EV_Chassis_Cross_{x:.2f}", (x, 0, 0.26), (0.10, 1.42, 0.08), mats["steel"], collection, bevel=0.018)
    # Suspension towers (visual anchors)
    for x,y in [(-1.32,0.78),(-1.32,-0.78),(1.32,0.78),(1.32,-0.78)]:
        make_cylinder(f"EV_Suspension_Tower_{x:.1f}_{y:.1f}", (x, y, 0.34), 0.07, 0.18, mats["steel"], collection, segments=14)
        make_cylinder(f"EV_Spring_{x:.1f}_{y:.1f}", (x, y, 0.30), 0.055, 0.14, mats["spring"], collection, segments=12)
    # Front steering rack across front hubs
    make_cylinder("EV_Steering_Rack", (-1.32, 0, 0.22), 0.024, 1.25, mats["steel"], collection, axis=(0,1,0), segments=12)
    # Double-wishbone suspension control arms (upper and lower tubular A-arms for all 4 corners)
    for x, y, name in [(-1.32, 0.78, "FL"), (-1.32, -0.78, "FR"), (1.32, 0.78, "RL"), (1.32, -0.78, "RR")]:
        sy = 1 if y > 0 else -1
        make_cylinder(f"EV_ControlArm_Lower_{name}", (x, y - sy * 0.20, 0.16), 0.018, 0.36, mats["steel"], collection, axis=(0,1,0), segments=10)
        make_cylinder(f"EV_ControlArm_Upper_{name}", (x, y - sy * 0.20, 0.28), 0.016, 0.34, mats["steel"], collection, axis=(0,1,0), segments=10)
    # Rear differential drive shafts
    for side, y_target in (("L", 0.78), ("R", -0.78)):
        make_cylinder(f"EV_DriveShaft_{side}", (1.32, y_target * 0.5, 0.22), 0.024, abs(y_target), mats["steel"], collection, axis=(0,1,0), segments=12)


def build_battery_pack(collection, mats):
    x,y,z = 0, 0.05, 0.26
    # Pack enclosure
    make_rounded_box("EV_BatteryPack_Enclosure", (x,y,z), (1.90, 0.98, 0.18), mats["pack"], collection, bevel=0.05)
    make_rounded_box("EV_BatteryPack_Lid", (x, y, z+0.115), (1.86, 0.94, 0.025), mats["pack_lid"], collection, bevel=0.02)
    make_rounded_box("EV_BatteryPack_Lid_Accent", (x, y-0.44, z+0.13), (1.20, 0.015, 0.018), mats["accent"], collection, bevel=0.006)
    # Pack perimeter sealing bolts
    for bx in (-0.86, -0.43, 0, 0.43, 0.86):
        for by in (-0.44, 0.44):
            make_cylinder(f"EV_PackBolt_{bx:.2f}_{by:.2f}", (x+bx, y+by, z+0.128), 0.010, 0.014, mats["steel"], collection, segments=8)
    # Internal cell rows (visible through transparent lid concept — shown as rows)
    for row in range(4):
        ry = -0.30 + row*0.20
        for col in range(6):
            cx = -0.75 + col*0.30
            make_rounded_box(f"EV_Cell_{row}_{col}", (x+cx, y+ry, z+0.02), (0.22, 0.12, 0.08), mats["cell"], collection, bevel=0.018)
    # Copper interconnect busbars linking cell groups
    for row in range(4):
        ry = -0.30 + row*0.20
        for col in range(5):
            cx1 = -0.75 + col*0.30
            cx2 = -0.75 + (col+1)*0.30
            mid_x = (cx1 + cx2) / 2
            make_rounded_box(f"EV_Busbar_{row}_{col}", (x+mid_x, y+ry, z+0.066), (0.09, 0.022, 0.008), mats["copper"], collection, bevel=0.003)
    # HV terminals
    for name, offset, col in (("HV_PLUS", 0.92, mats["copper"]), ("HV_MINUS", -0.92, mats["copper"])):
        make_cylinder(f"EV_BatteryPack_Terminal_{name}", (x+offset, y, z+0.12), 0.035, 0.07, col, collection, segments=12)
    # Pack label
    try:
        # reuse text helper if available — inline minimal
        import bpy as _bpy
        td = _bpy.data.curves.new("EV_PackLabel_Text", type="FONT")
        td.body = "96V  14.4 kWh  ILLUSTRATIVE"
        td.size = 0.09
        td.align_x='CENTER'; td.align_y='CENTER'
        td.materials.append(mats["label"])
        obj = _bpy.data.objects.new(unique_object_name("EV_BatteryPack_Label"), td)
        collection.objects.link(obj)
        obj.location = (x, y, z+0.14)
        obj.rotation_euler = (math.radians(90),0,0)
        # Convert to mesh for GLB
        dg=_bpy.context.evaluated_depsgraph_get()
        ev=obj.evaluated_get(dg)
        mesh=_bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        loc,rot=obj.location.copy(),obj.rotation_euler.copy()
        n=_bpy.data.objects.remove(obj, do_unlink=True)
        _bpy.data.curves.remove(td)
        mo=_bpy.data.objects.new("EV_BatteryPack_Label", mesh)
        collection.objects.link(mo)
        mo.location=loc; mo.rotation_euler=rot
    except Exception:
        pass


def build_motor(collection, mats):
    x,y,z = 1.48, 0.05, 0.40
    make_cylinder("EV_Motor_Body", (x,y,z), 0.26, 0.52, mats["motor"], collection, axis=(0,1,0), segments=24)
    # Machined stator cooling fins
    for k in range(5):
        fin_y = -0.16 + k * 0.08
        make_cylinder(f"EV_Motor_Fin_{k}", (x, y+fin_y, z), 0.275, 0.016, mats["motor_fin"], collection, axis=(0,1,0), segments=24)
    make_cylinder("EV_Motor_Shaft", (x+0.42, y, z), 0.045, 0.34, mats["steel"], collection, axis=(0,1,0), segments=16)
    for idx, (dy, dz) in enumerate([ (0.18,0.06), (0,-0.02), (-0.18,0.06) ]):
        make_rounded_box(f"EV_Motor_Terminal_U{idx}", (x+0.18, y+dy, z+dz+0.28), (0.06, 0.08, 0.08), mats["copper"], collection, bevel=0.015)
    # Mount feet
    for dx in (-0.18, 0.18):
        make_rounded_box(f"EV_Motor_Mount_{dx:.2f}", (x+dx, y, 0.08), (0.18, 0.42, 0.12), mats["dark"], collection, bevel=0.025)
    make_cylinder("EV_Differential_Housing", (1.32, 0.05, 0.22), 0.10, 0.42, mats["dark"], collection, axis=(0,1,0), segments=16)


def build_wheel(collection, mats, pos, name):
    x,y,z = pos
    # Tire
    make_cylinder(f"{name}_Tire", (x,y,z), 0.31, 0.22, mats["rubber"], collection, axis=(0,1,0), segments=32)
    # Rim outer barrel
    make_cylinder(f"{name}_Rim", (x,y,z), 0.19, 0.23, mats["rim"], collection, axis=(0,1,0), segments=24)
    # Center Hub & Cap
    make_cylinder(f"{name}_Hub", (x, y+0.02 if y>0 else y-0.02, z), 0.065, 0.04, mats["steel"], collection, axis=(0,1,0), segments=16)
    make_cylinder(f"{name}_CenterCap", (x, y+0.115 if y>0 else y-0.115, z), 0.038, 0.015, mats["accent"], collection, axis=(0,1,0), segments=16)
    # Brake disc rotor (ventilated)
    make_cylinder(f"{name}_BrakeDisc", (x, y+0.08 if y>0 else y-0.08, z), 0.165, 0.022, mats["steel"], collection, axis=(0,1,0), segments=24)
    # Racing red Brembo-style brake caliper
    make_rounded_box(f"{name}_BrakeCaliper", (x, y+0.08 if y>0 else y-0.08, z+0.12), (0.09, 0.05, 0.075), mats["caliper"], collection, bevel=0.014)
    # 5-Spoke high-performance sport alloy spokes
    for ang in (0, 72, 144, 216, 288):
        make_rounded_box(f"{name}_Spoke_{ang}", (x, y, z), (0.035, 0.25, 0.016), mats["rim"], collection, bevel=0.008)
        obj = collection.objects[f"{name}_Spoke_{ang}"]
        obj.rotation_euler = (0, math.radians(ang), 0)


def build_box(collection, mats, name, loc, dims, mat_key, label=None):
    make_rounded_box(name, loc, dims, mats[mat_key], collection, bevel=0.03)
    if label:
        try:
            td = bpy.data.curves.new(name+"_Label_Text", type="FONT")
            td.body = label
            td.size = 0.07
            td.align_x='CENTER'; td.align_y='CENTER'
            td.materials.append(mats["label"])
            obj = bpy.data.objects.new(unique_object_name(name+"_Label"), td)
            collection.objects.link(obj)
            obj.location = (loc[0], loc[1], loc[2]+dims[2]/2+0.025)
            obj.rotation_euler = (math.radians(90),0,0)
            dg=bpy.context.evaluated_depsgraph_get()
            ev=obj.evaluated_get(dg)
            mesh=bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
            lloc, rrot = obj.location.copy(), obj.rotation_euler.copy()
            bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.curves.remove(td)
            mo=bpy.data.objects.new(name+"_Label", mesh)
            collection.objects.link(mo)
            mo.location=lloc; mo.rotation_euler=rrot
        except Exception:
            pass


def run(h=None):
    # Import shared helpers from generate_ecs_assembly for material consistency
    import json as _json, hashlib
    bpy.ops.wm.read_factory_settings(use_empty=True)
    root = Path(__file__).resolve().parents[2]
    col = bpy.data.collections.new(COLLECTION_NAME)
    bpy.context.scene.collection.children.link(col)

    mats = {}
    # Create materials with same palette philosophy + EV-specific
    def mm(name, color, met=0.0, rough=0.4): mats[name]=make_material(name,color,met,rough)
    mm("chassis", (0.30,0.36,0.44),0.35,0.35)
    mm("steel", (0.58,0.64,0.70),0.65,0.28)
    mm("spring", (0.86,0.22,0.22),0.42,0.28)
    mm("pack", (0.14,0.46,0.42),0.15,0.34)
    mm("pack_lid", (0.18,0.58,0.52),0.12,0.32)
    mm("accent", (0.15,0.75,0.70),0.08,0.30)
    mm("cell", (0.22,0.40,0.48),0.20,0.38)
    mm("motor", (0.36,0.45,0.52),0.60,0.30)
    mm("motor_fin", (0.65,0.70,0.75),0.85,0.20)
    mm("caliper", (0.88,0.08,0.08),0.35,0.25)
    mm("rubber", (0.12,0.13,0.15),0.02,0.82)
    mm("rim", (0.72,0.75,0.80),0.72,0.24)
    mm("dark", (0.14,0.17,0.20),0.15,0.35)
    mm("label", (0.92,0.95,0.94),0.0,0.38)
    mm("copper", (0.75,0.38,0.15),0.62,0.27)
    mm("white", (0.94,0.96,0.98),0.0,0.35)
    # Reuse ECS tray material for ground plane
    mm("tray", (0.08,0.12,0.16),0.18,0.38)

    # Additional EV mats from h
    # Ground/tray already via build
    mats["ev_tray"] = mats["tray"]
    mats["ev_label"] = mats["label"]

    # Build structure
    build_chassis(col, mats)
    build_battery_pack(col, mats)
    build_motor(col, mats)
    wheel_positions = [(-1.32,0.78,0.18),(-1.32,-0.78,0.18),(1.32,0.78,0.18),(1.32,-0.78,0.18)]
    wheel_names = ["EV_Wheel_FL","EV_Wheel_FR","EV_Wheel_RL","EV_Wheel_RR"]
    for pos, wname in zip(wheel_positions, wheel_names):
        build_wheel(col, mats, pos, wname)

    # Boxes — positions from ev-vehicle-data.js
    build_box(col, mats, "EV_BMS_Controller", (0.72,0.05,0.42), (0.30,0.20,0.07), "steel", label="BMS")
    build_box(col, mats, "EV_Contactor_Box", (1.05,0.05,0.42), (0.34,0.28,0.14), "dark", label="HV BOX")
    build_box(col, mats, "EV_Inverter", (1.02,0.48,0.42), (0.44,0.34,0.12), "steel", label="INVERTER")
    build_box(col, mats, "EV_DCDC_Converter", (-0.62,0.38,0.40), (0.32,0.22,0.10), "steel", label="DC-DC")
    build_box(col, mats, "EV_VCU", (-0.42,-0.48,0.46), (0.30,0.20,0.08), "steel", label="VCU")
    build_box(col, mats, "EV_OBC", (-1.05,0.05,0.38), (0.38,0.28,0.12), "steel", label="OBC")
    build_box(col, mats, "EV_Cooling_Module", (0.45,-0.42,0.30), (0.55,0.18,0.08), "steel", label="COOLING")

    # Base tray (reuse for visual grounding)
    make_rounded_box("EV_Assembly_Base_Tray", (0,0,-0.06), (4.8, 2.4, 0.10), mats["tray"], col, bevel=0.06)

    # In-scene title (illustrative watermark)
    try:
        td = bpy.data.curves.new("EV_Title_Text", type="FONT")
        td.body = "ILLUSTRATIVE EV HARDWARE TWIN  —  NOT THE 12V PROJECT"
        td.size = 0.11
        td.align_x='CENTER'; td.align_y='CENTER'
        td.materials.append(mats["label"])
        obj = bpy.data.objects.new(unique_object_name("EV_Title"), td)
        col.objects.link(obj)
        obj.location = (0, -1.55, 0.02)
        obj.rotation_euler = (math.radians(0),0,0)
        dg=bpy.context.evaluated_depsgraph_get()
        ev=obj.evaluated_get(dg)
        mesh=bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
        lloc, rrot = obj.location.copy(), obj.rotation_euler.copy()
        bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.curves.remove(td)
        mo=bpy.data.objects.new("EV_Title", mesh)
        col.objects.link(mo)
        mo.location=lloc; mo.rotation_euler=rrot
    except Exception:
        pass

    # Illustrative harness matching EV_VEHICLE_MANIFEST (EV_W01 to EV_W11)
    wire_defs = [
        ("EV_W01", [(0.92,0.05,0.32),(1.05,0.05,0.46)], "#ff8c2a", 0.018, False, "hv_dc"),
        ("EV_W02", [(-0.92,0.05,0.32),(1.05,-0.08,0.42)], "#ff8c2a", 0.018, False, "hv_dc"),
        ("EV_W03", [(1.20,0.05,0.46),(0.88,0.48,0.48)], "#ff8c2a", 0.018, False, "hv_dc"),
        ("EV_W04", [(1.20,0.05,0.46),(-0.74,0.38,0.46)], "#ff8c2a", 0.018, False, "hv_dc"),
        ("EV_W05", [(1.02,0.62,0.44),(1.62,0.22,0.40)], "#e6b422", 0.014, False, "motor_ac"),
        ("EV_W06", [(1.12,0.62,0.44),(1.62,0.05,0.40)], "#e6b422", 0.014, False, "motor_ac"),
        ("EV_W07", [(1.22,0.62,0.44),(1.62,-0.12,0.40)], "#e6b422", 0.014, False, "motor_ac"),
        ("EV_W08", [(0.86,0.05,0.45),(-0.30,-0.48,0.50)], "#6faef0", 0.008, True, "can"),
        ("EV_W09", [(0.86,-0.04,0.45),(-0.30,-0.58,0.50)], "#6faef0", 0.008, True, "can"),
        ("EV_W10", [(-0.62,0.52,0.42),(-0.54,-0.58,0.46)], "#dd5555", 0.010, True, "lv_12v"),
        ("EV_W11", [(0.70,-0.42,0.34),(-0.92,0.05,0.32)], "#2aa7c8", 0.016, True, "cooling"),
    ]
    for name, pts, hexcol, rad, dashed, grp in wire_defs:
        r=int(hexcol[1:3],16)/255; g=int(hexcol[3:5],16)/255; b=int(hexcol[5:7],16)/255
        mat = make_material("Mat_"+name, (r,g,b), 0, 0.45)
        mid = ((pts[0][0]+pts[1][0])/2, (pts[0][1]+pts[1][1])/2, (pts[0][2]+pts[1][2])/2 + 0.08)
        cpts = [pts[0], mid, pts[1]]
        obj = make_wire("Wire_"+name, cpts, mat, col, radius=rad, sides=10, dashed=dashed)
        obj["component_id"] = "ev_harness"
        obj["id"] = name
        obj["wire_id"] = name
        obj["wire_group"] = grp
        obj["status"] = "ILLUSTRATIVE"

    for obj in col.objects:
        if "component_id" not in obj:
            # tag chassis/wheels etc for viewer grouping
            if obj.name.startswith("EV_Chassis") or obj.name.startswith("EV_Assembly") or obj.name.startswith("EV_Spring") or obj.name.startswith("EV_Suspension") or obj.name.startswith("EV_Title") or obj.name.startswith("EV_ControlArm") or obj.name.startswith("EV_Steering"):
                obj["component_id"]="ev_chassis"
            elif obj.name.startswith("EV_Battery") or obj.name.startswith("EV_Cell") or obj.name.startswith("EV_Busbar") or obj.name.startswith("EV_PackBolt"):
                obj["component_id"]="ev_battery_pack"
            elif obj.name.startswith("EV_Motor") or obj.name.startswith("EV_Differential") or obj.name.startswith("EV_DriveShaft"):
                obj["component_id"]="ev_motor"
            elif obj.name.startswith("EV_Wheel_FL"):
                obj["component_id"]="ev_wheel_fl"
            elif obj.name.startswith("EV_Wheel_FR"):
                obj["component_id"]="ev_wheel_fr"
            elif obj.name.startswith("EV_Wheel_RL"):
                obj["component_id"]="ev_wheel_rl"
            elif obj.name.startswith("EV_Wheel_RR"):
                obj["component_id"]="ev_wheel_rr"
            elif obj.name.startswith("EV_BMS"):
                obj["component_id"]="ev_bms"
            elif obj.name.startswith("EV_Contactor"):
                obj["component_id"]="ev_contactor_box"
            elif obj.name.startswith("EV_Inverter"):
                obj["component_id"]="ev_inverter"
            elif obj.name.startswith("EV_DCDC"):
                obj["component_id"]="ev_dcdc"
            elif obj.name.startswith("EV_VCU"):
                obj["component_id"]="ev_vcu"
            elif obj.name.startswith("EV_OBC"):
                obj["component_id"]="ev_obc"
            elif obj.name.startswith("EV_Cooling"):
                obj["component_id"]="ev_cooling"

    # Complete-car geometry is separate from the teaching circuit and its routes.
    import sys
    script_dir = str(Path(__file__).resolve().parent)
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    from ev_detail_geometry import enhance_vehicle, prepare_export
    detail_report = enhance_vehicle(col, mats)
    blend_target = Path(__file__).resolve().parents[1] / "output" / "ecs-gt-complete-car.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_target))
    prepare_export(col)

    # Export
    import datetime, shutil as _shutil, bpy as _bpy
    bpy.ops.object.select_all(action='DESELECT')
    for o in col.objects:
        o.select_set(True)
    target = Path(__file__).resolve().parents[1] / "output" / OUTPUT_FILENAME
    if target.exists():
        stamp = __import__("datetime").datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        _shutil.copy2(target, target.with_name("ev-vehicle-assembly.before-export-"+stamp+".glb"))
    pending = target.with_name("ev-vehicle-assembly.pending.glb")
    _bpy.ops.export_scene.gltf(filepath=str(pending), export_format='GLB', use_selection=True, export_extras=True, export_apply=True)
    assert pending.stat().st_size > 10000
    pending.replace(target)
    # Write manifest for validation
    meta = dict(blender=bpy.app.version_string, objects=len(col.objects), bytes=target.stat().st_size, file="blender-workflow/output/ev-vehicle-assembly.glb", source_blend="blender-workflow/output/ecs-gt-complete-car.blend", **detail_report)
    (target.parent / "ev-generation-result.json").write_text(json.dumps(meta, indent=2))


def main(h=None):
    try:
        run(h)
    except Exception as e:
        import traceback
        out = Path(__file__).resolve().parents[2] / "hardware-validation" / "ev-generation-error.txt"
        out.write_text(traceback.format_exc())
        raise


if __name__ == "__main__":
    main()
