import math
import os
from pathlib import Path

import bpy
from mathutils import Vector


COLLECTION_NAME = "ECS_Battery_Assembly"
OUTPUT_FILENAME = "ecs-battery-assembly.glb"
WIRE_SIDES = 10
WIRE_RADIUS = 0.016


def unique_object_name(base_name):
    if base_name not in bpy.data.objects:
        return base_name

    suffix = 1
    while f"{base_name}.{suffix:03d}" in bpy.data.objects:
        suffix += 1
    return f"{base_name}.{suffix:03d}"


def make_material(name, color, metallic=0.0, roughness=0.4, emission=0.0, alpha=1.0):
    material = bpy.data.materials.new(name=name)
    material.diffuse_color = (*color, alpha)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    if shader is not None:
        shader.inputs["Base Color"].default_value = (*color, alpha)
        shader.inputs["Metallic"].default_value = metallic
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Alpha"].default_value = alpha
        if emission > 0:
            shader.inputs["Emission Color"].default_value = (*color, 1.0)
            shader.inputs["Emission Strength"].default_value = emission
    return material


def make_mesh_object(name, vertices, faces, material, collection, smooth=False):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    if material is not None:
        mesh.materials.append(material)
    if smooth:
        for polygon in mesh.polygons:
            polygon.use_smooth = True

    obj = bpy.data.objects.new(unique_object_name(name), mesh)
    collection.objects.link(obj)
    return obj


def make_rounded_box(
    name,
    location,
    dimensions,
    material,
    collection,
    bevel=None,
    rotation=None,
):
    half_x, half_y, half_z = (dimension / 2 for dimension in dimensions)
    vertices = [
        (-half_x, -half_y, -half_z),
        (-half_x, -half_y, half_z),
        (-half_x, half_y, -half_z),
        (-half_x, half_y, half_z),
        (half_x, -half_y, -half_z),
        (half_x, -half_y, half_z),
        (half_x, half_y, -half_z),
        (half_x, half_y, half_z),
    ]
    faces = [
        (0, 1, 3, 2),
        (4, 6, 7, 5),
        (0, 4, 5, 1),
        (2, 3, 7, 6),
        (0, 2, 6, 4),
        (1, 5, 7, 3),
    ]
    obj = make_mesh_object(name, vertices, faces, material, collection)
    obj.location = location
    if rotation is not None:
        obj.rotation_euler = rotation

    max_bevel = min(dimensions) * 0.45
    bevel_width = min(bevel if bevel is not None else min(dimensions) * 0.08, max_bevel)
    if bevel_width > 0:
        modifier = obj.modifiers.new("Soft_Edges", "BEVEL")
        modifier.width = bevel_width
        modifier.segments = 2
        modifier.limit_method = "ANGLE"

        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def make_cylinder(
    name,
    location,
    radius,
    depth,
    material,
    collection,
    axis=(0, 0, 1),
    segments=20,
):
    vertices = []
    for z in (-depth / 2, depth / 2):
        for index in range(segments):
            angle = (2.0 * math.pi * index) / segments
            vertices.append(
                (
                    radius * math.cos(angle),
                    radius * math.sin(angle),
                    z,
                )
            )

    faces = []
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple(range(segments, 2 * segments)))
    for index in range(segments):
        next_index = (index + 1) % segments
        faces.append(
            (
                index,
                next_index,
                next_index + segments,
                index + segments,
            )
        )

    obj = make_mesh_object(name, vertices, faces, material, collection)
    obj.location = location
    direction = Vector(axis).normalized()
    obj.rotation_euler = Vector((0, 0, 1)).rotation_difference(
        direction
    ).to_euler()
    for polygon in obj.data.polygons[2:]:
        polygon.use_smooth = True
    return obj


def make_text(
    name,
    body,
    location,
    size,
    material,
    collection,
    rotation=(0, 0, 0),
):
    text_data = bpy.data.curves.new(name + "_Text", type="FONT")
    text_data.body = body
    text_data.size = size
    text_data.align_x = "CENTER"
    text_data.align_y = "CENTER"
    text_data.extrude = 0.0005
    text_data.bevel_depth = 0.0
    text_data.bevel_resolution = 1
    text_data.materials.append(material)

    obj = bpy.data.objects.new(unique_object_name(name), text_data)
    collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation

    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = bpy.data.meshes.new_from_object(
        evaluated,
        preserve_all_data_layers=True,
        depsgraph=bpy.context.evaluated_depsgraph_get(),
    )
    old_data = obj.data
    object_name = obj.name
    object_location = obj.location.copy()
    object_rotation = obj.rotation_euler.copy()
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.curves.remove(old_data)

    mesh_obj = bpy.data.objects.new(object_name, mesh)
    collection.objects.link(mesh_obj)
    mesh_obj.location = object_location
    mesh_obj.rotation_euler = object_rotation
    return mesh_obj


def catmull_rom_points(control_points, steps=5):
    points = [Vector(point) for point in control_points]
    sampled = []
    for index in range(len(points) - 1):
        p0 = points[max(index - 1, 0)]
        p1 = points[index]
        p2 = points[index + 1]
        p3 = points[min(index + 2, len(points) - 1)]
        for step in range(steps):
            t = step / steps
            t2 = t * t
            t3 = t2 * t
            point = 0.5 * (
                (2 * p1)
                + (-p0 + p2) * t
                + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
            )
            sampled.append(point)
    sampled.append(points[-1])
    return sampled


def make_wire(name, control_points, material, collection, radius=WIRE_RADIUS, sides=WIRE_SIDES):
    path = catmull_rom_points(control_points)
    vertices = []
    faces = []
    reference = Vector((0, 0, 1))

    for index, point in enumerate(path):
        if index == 0:
            tangent = (path[1] - point).normalized()
        elif index == len(path) - 1:
            tangent = (point - path[index - 1]).normalized()
        else:
            tangent = (path[index + 1] - path[index - 1]).normalized()

        if abs(tangent.dot(reference)) > 0.92:
            reference = Vector((0, 1, 0))
        side = tangent.cross(reference).normalized()
        up = tangent.cross(side).normalized()

        for side_index in range(sides):
            angle = (2.0 * math.pi * side_index) / sides
            ring_point = point + radius * (
                math.cos(angle) * side + math.sin(angle) * up
            )
            vertices.append(tuple(ring_point))

    for ring in range(len(path) - 1):
        for side_index in range(sides):
            next_side = (side_index + 1) % sides
            first = ring * sides + side_index
            second = ring * sides + next_side
            faces.append(
                (
                    first,
                    second,
                    second + sides,
                    first + sides,
                )
            )

    faces.append(tuple(reversed(range(sides))))
    last_ring = (len(path) - 1) * sides
    faces.append(tuple(last_ring + index for index in range(sides)))
    return make_mesh_object(name, vertices, faces, material, collection, smooth=True)


def add_fastener(name, location, material, collection, radius=0.025):
    return make_cylinder(
        name,
        location,
        radius,
        0.024,
        material,
        collection,
        segments=6,
    )


def add_board_standoffs(name, center, board_bottom, width, depth, material, collection):
    floor_z = 0.01
    height = max(0.04, board_bottom - floor_z)
    for index, (dx, dy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1)), start=1):
        sx = center[0] + dx * width * 0.41
        sy = center[1] + dy * depth * 0.40
        # Hex brass standoff pillar
        make_cylinder(
            f"{name}_Standoff_{index:02d}",
            (sx, sy, floor_z + height / 2),
            0.032,
            height,
            material,
            collection,
            segments=6,
        )
        # Top M2.5 mounting washer & screw head
        make_cylinder(
            f"{name}_MountScrew_{index:02d}",
            (sx, sy, board_bottom + 0.072),
            0.028,
            0.018,
            material,
            collection,
            segments=12,
        )


def add_terminal_block(name, center, material, dark, metal, collection, pins=2, pitch=0.18, orient="front"):
    x, y, z = center
    span = max(0.38, pins * pitch + 0.08)
    make_rounded_box(
        name,
        center,
        (span, 0.28, 0.24),
        material,
        collection,
        bevel=0.028,
    )
    start_x = -((pins - 1) * pitch) / 2
    wy = y - 0.142 if orient == "front" else y + 0.142
    for index in range(pins):
        ox = start_x + index * pitch
        # Rising-clamp wire entry cage
        make_rounded_box(
            f"{name}_Cage_{index + 1:02d}",
            (x + ox, wy, z - 0.01),
            (pitch * 0.62, 0.024, 0.12),
            metal,
            collection,
            bevel=0.004,
        )
        make_rounded_box(
            f"{name}_Opening_{index + 1:02d}",
            (x + ox, wy + (-0.006 if orient == "front" else 0.006), z - 0.01),
            (pitch * 0.48, 0.016, 0.095),
            dark,
            collection,
            bevel=0.003,
        )
        # Top slotted clamping screw in recessed chimney
        make_cylinder(
            f"{name}_ScrewWell_{index + 1:02d}",
            (x + ox, y, z + 0.118),
            pitch * 0.30,
            0.018,
            dark,
            collection,
            segments=14,
        )
        make_cylinder(
            f"{name}_Screw_{index + 1:02d}",
            (x + ox, y, z + 0.112),
            pitch * 0.25,
            0.022,
            metal,
            collection,
            segments=14,
        )
        make_rounded_box(
            f"{name}_ScrewSlot_{index + 1:02d}",
            (x + ox, y, z + 0.124),
            (pitch * 0.38, 0.012, 0.006),
            dark,
            collection,
            bevel=0.001,
        )


def build_battery(collection, materials):
    x, y = -2.35, 0.55
    # Deep charcoal-black ABS case with lower reinforcement skirt and side ribs
    body = make_rounded_box(
        "Battery_12V_7_6Ah",
        (x, y, 0.62),
        (1.48, 0.88, 1.20),
        materials["battery"],
        collection,
        bevel=0.055,
    )
    make_rounded_box(
        "Battery_Base_Skirt",
        (x, y, 0.06),
        (1.52, 0.92, 0.10),
        materials["dark"],
        collection,
        bevel=0.025,
    )
    # Stepped heat-sealed AGM top cover
    make_rounded_box(
        "Battery_Top_Lid",
        (x, y, 1.245),
        (1.50, 0.90, 0.095),
        materials["battery_lid"],
        collection,
        bevel=0.032,
    )
    make_rounded_box(
        "Battery_Top_Manifold",
        (x, y + 0.08, 1.30),
        (1.12, 0.36, 0.032),
        materials["dark"],
        collection,
        bevel=0.010,
    )
    # 6 individual VRLA cell safety valve bosses on top manifold
    for cell_i in range(6):
        cx = x - 0.45 + cell_i * 0.18
        make_cylinder(
            f"Battery_Cell_Vent_{cell_i + 1:02d}",
            (cx, y + 0.08, 1.322),
            0.052,
            0.018,
            materials["battery"],
            collection,
            segments=16,
        )
        make_cylinder(
            f"Battery_Cell_VentCap_{cell_i + 1:02d}",
            (cx, y + 0.08, 1.334),
            0.032,
            0.010,
            materials["dark"],
            collection,
            segments=12,
        )
    # Molded side lifting handles
    for sx in (-0.75, 0.75):
        make_rounded_box(
            f"Battery_Side_Grip_{'L' if sx < 0 else 'R'}",
            (x + sx, y, 1.08),
            (0.035, 0.46, 0.11),
            materials["dark"],
            collection,
            bevel=0.010,
        )
    # Front specification nameplate
    make_rounded_box(
        "Battery_Front_Label_Panel",
        (x, 0.102, 0.65),
        (1.16, 0.018, 0.68),
        materials["dark"],
        collection,
        bevel=0.015,
    )
    make_rounded_box(
        "Battery_Label_Header_Band",
        (x, 0.091, 0.91),
        (1.08, 0.010, 0.09),
        materials["teal"],
        collection,
        bevel=0.004,
    )
    make_rounded_box(
        "Battery_Label_Caution_Band",
        (x, 0.091, 0.38),
        (1.08, 0.010, 0.045),
        materials["amber"],
        collection,
        bevel=0.004,
    )
    make_text(
        "Battery_Brand_Label",
        "AT12-7.6   AGM   VRLA",
        (x, 0.084, 0.91),
        0.068,
        materials["white"],
        collection,
        rotation=(math.radians(90), 0, 0),
    )
    make_text(
        "Battery_Rating_Label",
        "12 V  7.6 Ah  (20HR)",
        (x, 0.084, 0.72),
        0.095,
        materials["white"],
        collection,
        rotation=(math.radians(90), 0, 0),
    )
    make_text(
        "Battery_Chemistry_Label",
        "SEALED LEAD-ACID  |  NON-SPILLABLE",
        (x, 0.084, 0.54),
        0.048,
        materials["silver"],
        collection,
        rotation=(math.radians(90), 0, 0),
    )

    for name, offset, post_mat, boot_mat in (
        ("Positive", -0.43, materials["copper"], materials["red"]),
        ("Negative", 0.43, materials["silver"], materials["dark"]),
    ):
        terminal_x = x + offset
        # Insulated terminal well collar
        make_rounded_box(
            f"Battery_{name}_Collar",
            (terminal_x, y, 1.31),
            (0.24, 0.24, 0.055),
            boot_mat,
            collection,
            bevel=0.018,
        )
        make_cylinder(
            f"Battery_{name}_Terminal_Base",
            (terminal_x, y, 1.355),
            0.082,
            0.065,
            post_mat,
            collection,
            segments=20,
        )
        # Heavy F2 / M5 brass/lead terminal post + clamping hex bolt at exact (terminal_x, y, 1.43)
        make_cylinder(
            f"Battery_{name}_Terminal",
            (terminal_x, y, 1.41),
            0.056,
            0.085,
            post_mat,
            collection,
            segments=20,
        )
        make_cylinder(
            f"Battery_{name}_HexNut",
            (terminal_x, y, 1.445),
            0.044,
            0.026,
            materials["brass"],
            collection,
            segments=6,
        )
        make_rounded_box(
            f"Battery_{name}_Mark",
            (terminal_x, y - 0.19, 1.302),
            (0.09, 0.075, 0.018),
            materials["red"] if name == "Positive" else materials["blue"],
            collection,
            bevel=0.006,
        )
    return body


def build_motor(collection, materials):
    x, y, z = 2.20, 1.40, 0.43
    axis = (1, 0, 0)
    # RS-775 Satin Steel Stator Can
    make_cylinder(
        "DC_Motor",
        (x, y, z),
        0.285,
        0.92,
        materials["motor"],
        collection,
        axis=axis,
        segments=32,
    )
    # Central magnetic flux ring shield sleeve with cooling ribs
    make_cylinder(
        "DC_Motor_Flux_Sleeve",
        (x - 0.02, y, z),
        0.302,
        0.52,
        materials["silver"],
        collection,
        axis=axis,
        segments=32,
    )
    for k in range(5):
        make_cylinder(
            f"DC_Motor_Cooling_Ring_{k:02d}",
            (x - 0.18 + k * 0.08, y, z),
            0.310,
            0.018,
            materials["motor_cap"],
            collection,
            axis=axis,
            segments=32,
        )
    # Front and rear machined end-bells
    for index, offset in enumerate((-0.44, 0.44), start=1):
        make_cylinder(
            f"DC_Motor_End_Band_{index:02d}",
            (x + offset, y, z),
            0.278,
            0.08,
            materials["motor_cap"],
            collection,
            axis=axis,
            segments=28,
        )
    # Internal copper rotor windings & white cooling fan visible at vent end
    make_cylinder(
        "DC_Motor_Internal_Copper_Armature",
        (x, y, z),
        0.22,
        0.78,
        materials["copper"],
        collection,
        axis=axis,
        segments=20,
    )
    # Front bearing boss
    make_cylinder(
        "DC_Motor_Front_Cap",
        (x + 0.51, y, z),
        0.135,
        0.09,
        materials["silver"],
        collection,
        axis=axis,
        segments=24,
    )
    # Stepped stainless output shaft
    make_cylinder(
        "DC_Motor_Shaft",
        (x + 0.72, y, z),
        0.048,
        0.46,
        materials["silver"],
        collection,
        axis=axis,
        segments=20,
    )
    # Anodized aluminum optical RPM encoder disc / flywheel pulley on output shaft
    make_cylinder(
        "DC_Motor_Flywheel_Hub",
        (x + 0.78, y, z),
        0.095,
        0.075,
        materials["brass"],
        collection,
        axis=axis,
        segments=20,
    )
    make_cylinder(
        "DC_Motor_Encoder_Disc",
        (x + 0.81, y, z),
        0.21,
        0.022,
        materials["teal"],
        collection,
        axis=axis,
        segments=28,
    )
    make_cylinder(
        "DC_Motor_Encoder_Rim",
        (x + 0.81, y, z),
        0.225,
        0.032,
        materials["silver"],
        collection,
        axis=axis,
        segments=28,
    )
    # Rear insulated brush commutator cap & brass power tabs
    make_cylinder(
        "DC_Motor_Rear_Brush_Cap",
        (x - 0.50, y, z),
        0.21,
        0.07,
        materials["dark"],
        collection,
        axis=axis,
        segments=24,
    )
    for index, (dy, col_key) in enumerate(((-0.14, "red"), (0.14, "blue")), start=1):
        make_rounded_box(
            f"DC_Motor_Brush_Insulator_{index:02d}",
            (x - 0.52, y + dy, z),
            (0.06, 0.08, 0.08),
            materials[col_key],
            collection,
            bevel=0.010,
        )
        make_rounded_box(
            f"DC_Motor_Terminal_{index:02d}",
            (x - 0.56, y + dy, z),
            (0.08, 0.055, 0.018),
            materials["brass"],
            collection,
            bevel=0.004,
        )
    # Heavy stamped-steel L-bracket dynamometer mount
    make_rounded_box(
        "DC_Motor_Mount_Base",
        (x + 0.04, y, 0.045),
        (0.88, 0.62, 0.065),
        materials["motor_cap"],
        collection,
        bevel=0.018,
    )
    for index, offset in enumerate((-0.34, 0.36), start=1):
        make_rounded_box(
            f"DC_Motor_Mount_Saddle_{index:02d}",
            (x + offset, y, 0.21),
            (0.11, 0.56, 0.28),
            materials["motor_cap"],
            collection,
            bevel=0.022,
        )
        for sy in (-0.22, 0.22):
            add_fastener(
                f"DC_Motor_Mount_Screw_{index:02d}_{'F' if sy < 0 else 'R'}",
                (x + offset, y + sy, 0.085),
                materials["brass"],
                collection,
                radius=0.026,
            )


def build_esp32(collection, materials):
    x, y, z = -0.78, 1.36, 0.13
    # Main 30-pin ESP32 DevKit V1 matte dark-navy PCB
    make_rounded_box(
        "ESP32_DevBoard",
        (x, y, z),
        (1.18, 0.58, 0.055),
        materials["pcb_blue"],
        collection,
        bevel=0.022,
    )
    add_board_standoffs("ESP32", (x, y), z - 0.0275, 1.18, 0.58, materials["brass"], collection)
    # Castellated ESP32-WROOM-32 module carrier PCB on right half
    make_rounded_box(
        "ESP32_WROOM_SubPCB",
        (x + 0.16, y, z + 0.036),
        (0.56, 0.36, 0.022),
        materials["dark"],
        collection,
        bevel=0.008,
    )
    # Brushed Nickel-Silver RF Shield Can
    make_rounded_box(
        "ESP32_RF_Shield",
        (x + 0.09, y, z + 0.068),
        (0.40, 0.32, 0.048),
        materials["silver"],
        collection,
        bevel=0.015,
    )
    # Gold Castellated Solder Pads along WROOM-32 module edges
    for side_y in (-0.182, 0.182):
        for pad_i in range(9):
            px = x - 0.08 + pad_i * 0.042
            make_rounded_box(
                f"ESP32_WROOM_Pad_{'L' if side_y < 0 else 'R'}_{pad_i:02d}",
                (px, y + side_y, z + 0.038),
                (0.022, 0.018, 0.024),
                materials["brass"],
                collection,
                bevel=0.002,
            )
    # 2.4 GHz Meandering Inverted-F PCB Trace Antenna on right end of WROOM module
    for ant_i in range(5):
        ax = x + 0.32 + ant_i * 0.022
        make_rounded_box(
            f"ESP32_Antenna_Trace_{ant_i:02d}",
            (ax, y, z + 0.049),
            (0.010, 0.26, 0.004),
            materials["brass"],
            collection,
            bevel=0.001,
        )
    # CP2102 QFN-28 USB-to-UART Bridge IC + 4-pin SOT-223 AMS1117-3.3 Regulator
    make_rounded_box(
        "ESP32_CP2102_IC",
        (x - 0.25, y + 0.02, z + 0.042),
        (0.14, 0.14, 0.028),
        materials["chip"],
        collection,
        bevel=0.006,
    )
    make_rounded_box(
        "ESP32_AMS1117_LDO",
        (x - 0.22, y - 0.13, z + 0.045),
        (0.13, 0.09, 0.034),
        materials["chip"],
        collection,
        bevel=0.006,
    )
    make_rounded_box(
        "ESP32_AMS1117_Tab",
        (x - 0.22, y - 0.18, z + 0.034),
        (0.07, 0.03, 0.010),
        materials["silver"],
        collection,
        bevel=0.002,
    )
    # Micro-USB / USB-C Stainless Steel Receptacle on left edge
    make_rounded_box(
        "ESP32_USB_Connector",
        (x - 0.54, y, z + 0.052),
        (0.18, 0.20, 0.068),
        materials["silver"],
        collection,
        bevel=0.016,
    )
    make_rounded_box(
        "ESP32_USB_Port_Opening",
        (x - 0.625, y, z + 0.052),
        (0.02, 0.15, 0.042),
        materials["dark"],
        collection,
        bevel=0.004,
    )
    # EN & BOOT Tactile Pushbuttons
    for btn_name, by in (("EN", 0.15), ("BOOT", -0.15)):
        make_rounded_box(
            f"ESP32_Button_Body_{btn_name}",
            (x - 0.42, y + by, z + 0.042),
            (0.08, 0.065, 0.030),
            materials["silver"],
            collection,
            bevel=0.005,
        )
        make_cylinder(
            f"ESP32_Button_Cap_{btn_name}",
            (x - 0.42, y + by, z + 0.064),
            0.022,
            0.018,
            materials["dark"],
            collection,
            segments=12,
        )
    # SMD Status LEDs (Red PWR + Blue TX)
    make_rounded_box("ESP32_LED_PWR", (x - 0.35, y + 0.14, z + 0.038), (0.035, 0.022, 0.018), materials["led_red"], collection, bevel=0.003)
    make_rounded_box("ESP32_LED_TX", (x - 0.35, y + 0.08, z + 0.038), (0.035, 0.022, 0.018), materials["led_cyan"], collection, bevel=0.003)
    # Dual 15-pin Header Strips with Black Shrouds & Gold Pins
    for row_idx, row_y in enumerate((y - 0.235, y + 0.235)):
        make_rounded_box(
            f"ESP32_Header_Shroud_{row_idx:02d}",
            (x, row_y, z + 0.048),
            (0.92, 0.055, 0.042),
            materials["dark"],
            collection,
            bevel=0.006,
        )
        for index in range(15):
            pin_x = x - 0.42 + index * 0.060
            make_rounded_box(
                f"ESP32_Header_Pin_{'A' if row_idx == 0 else 'B'}_{index + 1:02d}",
                (pin_x, row_y, z + 0.072),
                (0.016, 0.016, 0.095),
                materials["brass"],
                collection,
                bevel=0.002,
            )
    make_text(
        "ESP32_Board_Label",
        "ESP32-WROOM",
        (x + 0.09, y, z + 0.096),
        0.048,
        materials["dark"],
        collection,
    )


def build_current_sensor(collection, materials):
    x, y, z = 0.53, 1.35, 0.12
    # ACS712 Breakout Board PCB
    make_rounded_box(
        "ACS712_CurrentSensor",
        (x, y, z),
        (0.74, 0.52, 0.055),
        materials["pcb_green"],
        collection,
        bevel=0.022,
    )
    add_board_standoffs("ACS712", (x, y), z - 0.0275, 0.74, 0.52, materials["brass"], collection)
    # Heavy high-current copper conduction traces from IP+/IP- terminal block to IC
    for tx in (-0.11, 0.11):
        make_rounded_box(
            f"ACS712_Heavy_Trace_{'P' if tx < 0 else 'N'}",
            (x + tx, y - 0.08, z + 0.030),
            (0.095, 0.18, 0.006),
            materials["brass"],
            collection,
            bevel=0.001,
        )
    # SOIC-8 ACS712ELCTR-30A-T Hall IC with 8 Gull-Wing Metallic Pins
    make_rounded_box(
        "ACS712_Sensor_IC",
        (x, y + 0.03, z + 0.052),
        (0.22, 0.18, 0.048),
        materials["chip"],
        collection,
        bevel=0.010,
    )
    for pin_i in range(4):
        px = x - 0.075 + pin_i * 0.050
        for sy in (-0.11, 0.11):
            make_rounded_box(
                f"ACS712_SOIC_Pin_{pin_i}_{'S' if sy < 0 else 'N'}",
                (px, y + 0.03 + sy, z + 0.040),
                (0.018, 0.045, 0.018),
                materials["silver"],
                collection,
                bevel=0.002,
            )
    # SMD Filter Capacitors C1, C2 & Power LED
    for cx, cy in ((-0.22, 0.05), (0.22, 0.05), (-0.22, -0.06)):
        make_rounded_box(
            f"ACS712_SMD_Body_{cx:.2f}_{cy:.2f}",
            (x + cx, y + cy, z + 0.040),
            (0.065, 0.036, 0.024),
            materials["amber"],
            collection,
            bevel=0.003,
        )
        for cap_end in (-0.028, 0.028):
            make_rounded_box(
                f"ACS712_SMD_Cap_{cx:.2f}_{cy:.2f}_{cap_end:.2f}",
                (x + cx + cap_end, y + cy, z + 0.040),
                (0.014, 0.038, 0.026),
                materials["silver"],
                collection,
                bevel=0.002,
            )
    make_rounded_box("ACS712_PWR_LED", (x + 0.22, y - 0.06, z + 0.040), (0.04, 0.026, 0.022), materials["led_red"], collection, bevel=0.003)
    # High-current IP+ / IP- screw terminal block on front (battery/load side)
    add_terminal_block(
        "ACS712_Current_Terminal_Block",
        (x, y - 0.16, z + 0.12),
        materials["terminal"],
        materials["dark"],
        materials["brass"],
        collection,
        pins=2,
        pitch=0.22,
        orient="front",
    )
    # 3-pin logic header (VCC, OUT, GND) on rear edge
    make_rounded_box("ACS712_Logic_Header_Shroud", (x, y + 0.21, z + 0.045), (0.26, 0.055, 0.038), materials["dark"], collection, bevel=0.005)
    for idx, ox in enumerate((-0.08, 0.0, 0.08), start=1):
        make_rounded_box(
            f"ACS712_Logic_Pin_{idx:02d}",
            (x + ox, y + 0.21, z + 0.075),
            (0.016, 0.016, 0.085),
            materials["brass"],
            collection,
            bevel=0.002,
        )
    make_text(
        "ACS712_Module_Label",
        "ACS712  30A",
        (x, y + 0.03, z + 0.080),
        0.042,
        materials["white"],
        collection,
    )


def build_oled(collection, materials):
    x, y, z = -0.78, 0.22, 0.15
    # Royal-Blue SSD1306 Breakout PCB
    make_rounded_box(
        "OLED_Display",
        (x, y, z),
        (0.82, 0.62, 0.055),
        materials["pcb_blue"],
        collection,
        bevel=0.022,
    )
    add_board_standoffs("OLED", (x, y), z - 0.0275, 0.82, 0.62, materials["brass"], collection)
    # Gold Plated Corner Mounting Rings
    for dx in (-0.34, 0.34):
        for dy in (-0.25, 0.25):
            make_cylinder(
                f"OLED_MountRing_{dx:.2f}_{dy:.2f}",
                (x + dx, y + dy, z + 0.030),
                0.042,
                0.008,
                materials["brass"],
                collection,
                segments=16,
            )
    # 4-Pin I2C Header (VCC, GND, SDA, SCL)
    make_rounded_box("OLED_Header_Shroud", (x, y - 0.24, z + 0.045), (0.36, 0.055, 0.038), materials["dark"], collection, bevel=0.005)
    for index, offset in enumerate((-0.135, -0.045, 0.045, 0.135), start=1):
        make_rounded_box(
            f"OLED_Header_Pin_{index:02d}",
            (x + offset, y - 0.24, z + 0.078),
            (0.016, 0.016, 0.095),
            materials["brass"],
            collection,
            bevel=0.002,
        )
    # OLED Display Bezel & Polarizer Glass Panel
    make_rounded_box(
        "OLED_Bezel",
        (x, y + 0.02, z + 0.052),
        (0.68, 0.44, 0.042),
        materials["dark"],
        collection,
        bevel=0.018,
    )
    make_rounded_box(
        "OLED_Glass_Screen",
        (x, y + 0.03, z + 0.076),
        (0.60, 0.36, 0.014),
        materials["screen"],
        collection,
        bevel=0.010,
    )
    # Kapton Flex Ribbon Cable (FPC) at bottom edge of OLED glass
    make_rounded_box(
        "OLED_Kapton_FPC",
        (x, y - 0.165, z + 0.068),
        (0.28, 0.045, 0.012),
        materials["amber"],
        collection,
        bevel=0.003,
    )
    # Dual-Color Yellow/Cyan SSD1306 Pixel Readout Elements
    make_rounded_box(
        "OLED_Top_Yellow_Band",
        (x, y + 0.16, z + 0.084),
        (0.54, 0.048, 0.004),
        materials["amber"],
        collection,
        bevel=0.002,
    )
    make_text(
        "OLED_Display_Title",
        "NO LIVE DATA",
        (x, y + 0.04, z + 0.088),
        0.056,
        materials["led_cyan"],
        collection,
    )
    make_rounded_box(
        "OLED_Status_Bar_01",
        (x - 0.13, y - 0.065, z + 0.086),
        (0.24, 0.026, 0.005),
        materials["led_cyan"],
        collection,
        bevel=0.002,
    )
    make_rounded_box(
        "OLED_Status_Bar_02",
        (x + 0.12, y - 0.065, z + 0.086),
        (0.18, 0.026, 0.005),
        materials["amber"],
        collection,
        bevel=0.002,
    )


def build_buck_converter(collection, materials):
    x, y, z = 0.20, 0.22, 0.13
    # LM2596S Buck Regulator PCB
    make_rounded_box(
        "LM2596_BuckConverter",
        (x, y, z),
        (0.88, 0.62, 0.055),
        materials["pcb_green"],
        collection,
        bevel=0.022,
    )
    add_board_standoffs("LM2596", (x, y), z - 0.0275, 0.88, 0.62, materials["brass"], collection)
    # Soldered Copper Thermal Heatsink Pad under LM2596S
    make_rounded_box(
        "LM2596_Copper_GroundPad",
        (x - 0.24, y + 0.04, z + 0.030),
        (0.24, 0.24, 0.006),
        materials["brass"],
        collection,
        bevel=0.002,
    )
    # 5-Pin TO-263 LM2596S-ADJ Switching Regulator IC + Gull-Wing Leads
    make_rounded_box(
        "LM2596_Regulator_IC",
        (x - 0.24, y + 0.04, z + 0.056),
        (0.18, 0.19, 0.052),
        materials["chip"],
        collection,
        bevel=0.010,
    )
    for pin_i in range(5):
        py_pin = y - 0.02 + pin_i * 0.030
        make_rounded_box(
            f"LM2596_TO263_Pin_{pin_i + 1:02d}",
            (x - 0.12, py_pin, z + 0.040),
            (0.06, 0.014, 0.018),
            materials["silver"],
            collection,
            bevel=0.002,
        )
    # Shielded Drum / Toroidal Power Inductor (330uH) with Wound Copper Coils
    make_rounded_box(
        "LM2596_Inductor_Base",
        (x + 0.02, y + 0.06, z + 0.085),
        (0.24, 0.24, 0.115),
        materials["inductor"],
        collection,
        bevel=0.038,
    )
    make_cylinder(
        "LM2596_Inductor_Core",
        (x + 0.02, y + 0.06, z + 0.148),
        0.095,
        0.022,
        materials["inductor"],
        collection,
        segments=20,
    )
    for coil_i in range(10):
        ang = coil_i * (2.0 * math.pi / 10)
        make_cylinder(
            f"LM2596_Inductor_Winding_{coil_i:02d}",
            (x + 0.02 + 0.082 * math.cos(ang), y + 0.06 + 0.082 * math.sin(ang), z + 0.092),
            0.016,
            0.105,
            materials["copper"],
            collection,
            segments=10,
        )
    # Input (35V 220uF) and Output (16V 220uF) Radial Aluminum Electrolytic Capacitors
    for cap_name, cx, cy, rad, h_cap in (
        ("Input", x - 0.26, y + 0.21, 0.072, 0.18),
        ("Output", x + 0.26, y + 0.18, 0.068, 0.16),
    ):
        make_cylinder(
            f"LM2596_{cap_name}_Cap_Base",
            (cx, cy, z + 0.038),
            rad * 1.05,
            0.020,
            materials["dark"],
            collection,
            segments=16,
        )
        make_cylinder(
            f"LM2596_{cap_name}_Capacitor",
            (cx, cy, z + 0.045 + h_cap / 2),
            rad,
            h_cap,
            materials["capacitor"],
            collection,
            segments=20,
        )
        # Black polarity stripe on side of electrolytic can
        make_rounded_box(
            f"LM2596_{cap_name}_Cap_Stripe",
            (cx, cy - rad * 0.92, z + 0.045 + h_cap / 2),
            (rad * 0.55, 0.018, h_cap * 0.94),
            materials["dark"],
            collection,
            bevel=0.003,
        )
    # 3296W Blue Multi-Turn Precision Trimpot with Top Brass Screw
    make_rounded_box(
        "LM2596_Trimpot_Body",
        (x + 0.26, y - 0.04, z + 0.095),
        (0.11, 0.18, 0.13),
        materials["blue"],
        collection,
        bevel=0.012,
    )
    make_cylinder(
        "LM2596_Trimpot_Screw",
        (x + 0.26, y + 0.02, z + 0.168),
        0.024,
        0.018,
        materials["brass"],
        collection,
        segments=12,
    )
    # SS34 Schottky Freewheeling Diode + PWR LED
    make_rounded_box(
        "LM2596_SS34_Diode",
        (x + 0.02, y - 0.12, z + 0.046),
        (0.12, 0.075, 0.036),
        materials["chip"],
        collection,
        bevel=0.006,
    )
    make_rounded_box(
        "LM2596_SS34_Cathode",
        (x - 0.02, y - 0.12, z + 0.048),
        (0.022, 0.076, 0.038),
        materials["silver"],
        collection,
        bevel=0.002,
    )
    make_rounded_box("LM2596_LED_ON", (x + 0.16, y - 0.12, z + 0.040), (0.038, 0.024, 0.020), materials["led_cyan"], collection, bevel=0.003)
    # Input and Output Screw Terminal Blocks aligned to front port strip
    add_terminal_block(
        "LM2596_Input_Terminal_Block",
        (x - 0.22, y - 0.22, z + 0.11),
        materials["terminal"],
        materials["dark"],
        materials["brass"],
        collection,
        pins=2,
        pitch=0.18,
        orient="front",
    )
    add_terminal_block(
        "LM2596_Output_Terminal_Block",
        (x + 0.22, y - 0.22, z + 0.11),
        materials["terminal"],
        materials["dark"],
        materials["brass"],
        collection,
        pins=2,
        pitch=0.18,
        orient="front",
    )
    make_text(
        "LM2596_Module_Label",
        "LM2596  5.00V",
        (x, y + 0.24, z + 0.035),
        0.042,
        materials["white"],
        collection,
    )


def build_relay(collection, materials):
    x, y, z = 1.38, 0.20, 0.13
    make_rounded_box(
        "Relay_Module",
        (x, y, z),
        (0.84, 0.60, 0.055),
        materials["pcb_blue"],
        collection,
        bevel=0.022,
    )
    add_board_standoffs("Relay", (x, y), z - 0.0275, 0.84, 0.60, materials["brass"], collection)
    # 3-pin Control Header (VCC, GND, IN)
    make_rounded_box("Relay_Header_Shroud", (x - 0.24, y - 0.22, z + 0.045), (0.26, 0.055, 0.038), materials["dark"], collection, bevel=0.005)
    for index, offset in enumerate((-0.08, 0.0, 0.08), start=1):
        make_rounded_box(
            f"Relay_Control_Header_Pin_{index:02d}",
            (x - 0.24 + offset, y - 0.22, z + 0.078),
            (0.016, 0.016, 0.09),
            materials["brass"],
            collection,
            bevel=0.002,
        )
    # PC817 Optocoupler IC + SOT-23 Driver Transistor + Flyback Diode
    make_rounded_box("Relay_Optocoupler_IC", (x - 0.28, y + 0.02, z + 0.050), (0.11, 0.13, 0.042), materials["chip"], collection, bevel=0.006)
    make_cylinder("Relay_Flyback_Diode", (x - 0.28, y + 0.17, z + 0.048), 0.022, 0.09, materials["red"], collection, axis=(1, 0, 0), segments=12)
    # Internal Copper Solenoid Coil & Brass Contact Armature inside Translucent Relay Cube!
    make_cylinder(
        "Relay_Internal_Copper_Coil",
        (x - 0.02, y + 0.02, z + 0.155),
        0.095,
        0.19,
        materials["copper"],
        collection,
        segments=20,
    )
    make_rounded_box(
        "Relay_Internal_Yoke",
        (x + 0.08, y + 0.02, z + 0.16),
        (0.035, 0.22, 0.19),
        materials["silver"],
        collection,
        bevel=0.005,
    )
    make_rounded_box(
        "Relay_Internal_Contact_Arm",
        (x + 0.02, y - 0.09, z + 0.22),
        (0.18, 0.022, 0.035),
        materials["brass"],
        collection,
        bevel=0.003,
    )
    # Translucent Blue Songle-Style Relay Housing Cube
    make_rounded_box(
        "Relay_Housing",
        (x - 0.02, y + 0.02, z + 0.165),
        (0.38, 0.36, 0.26),
        materials["relay_glass"],
        collection,
        bevel=0.028,
    )
    # 3-Screw Output Contact Terminal Block (NO, COM, NC)
    add_terminal_block(
        "Relay_Contact_Terminal_Block",
        (x + 0.26, y + 0.02, z + 0.11),
        materials["terminal"],
        materials["dark"],
        materials["brass"],
        collection,
        pins=2,
        pitch=0.16,
        orient="front",
    )
    make_text(
        "Relay_Module_Label",
        "5V RELAY",
        (x - 0.02, y + 0.02, z + 0.298),
        0.044,
        materials["white"],
        collection,
    )


def build_fuse_holder(collection, materials):
    x, y, z = -1.55, -0.83, 0.18
    # Open-frame phenolic cartridge fuse holder block
    make_rounded_box(
        "Fuse_Holder",
        (x, y, z),
        (0.96, 0.34, 0.14),
        materials["dark"],
        collection,
        bevel=0.028,
    )
    for sx in (-0.42, 0.42):
        add_fastener(f"Fuse_Mount_Bolt_{'L' if sx < 0 else 'R'}", (x + sx, y, z + 0.075), materials["silver"], collection, radius=0.022)
    # Dual spring-steel fuse clips + brass end caps
    for index, offset in enumerate((-0.26, 0.26), start=1):
        make_rounded_box(
            f"Fuse_Clip_{index:02d}",
            (x + offset, y, z + 0.14),
            (0.085, 0.18, 0.15),
            materials["brass"],
            collection,
            bevel=0.012,
        )
        make_cylinder(
            f"Fuse_Contact_{index:02d}",
            (x + offset, y, z + 0.16),
            0.078,
            0.095,
            materials["silver"],
            collection,
            axis=(1, 0, 0),
            segments=20,
        )
    # Internal metallic fusible link wire inside glass cartridge
    make_cylinder(
        "Fuse_Internal_Filament",
        (x, y, z + 0.16),
        0.016,
        0.46,
        materials["copper"],
        collection,
        axis=(1, 0, 0),
        segments=10,
    )
    # Transparent Glass Fuse Tube
    make_cylinder(
        "Fuse_Element_TBD",
        (x, y, z + 0.16),
        0.072,
        0.48,
        materials["fuse_glass"],
        collection,
        axis=(1, 0, 0),
        segments=24,
    )
    make_text(
        "Fuse_Rating_Label",
        "F1  TBD",
        (x, y - 0.175, z + 0.01),
        0.055,
        materials["amber"],
        collection,
        rotation=(math.radians(90), 0, 0),
    )


def build_switch(collection, materials):
    x, y, z = -0.20, -0.83, 0.22
    # Heavy-duty KCD4 DC rocker switch housing + snap-in flange bezel
    make_rounded_box(
        "Rocker_Switch",
        (x, y, z),
        (0.58, 0.42, 0.24),
        materials["dark"],
        collection,
        bevel=0.032,
    )
    make_rounded_box(
        "Rocker_Switch_Bezel",
        (x, y, z + 0.115),
        (0.64, 0.48, 0.042),
        materials["battery_lid"],
        collection,
        bevel=0.015,
    )
    # Tilted Illuminated Red Rocker Actuator
    make_rounded_box(
        "Rocker_Switch_Surface",
        (x, y, z + 0.165),
        (0.44, 0.30, 0.105),
        materials["red"],
        collection,
        bevel=0.028,
        rotation=(0, -0.14, 0),
    )
    make_rounded_box(
        "Rocker_Switch_Indicator",
        (x - 0.11, y, z + 0.222),
        (0.032, 0.14, 0.014),
        materials["led_red"],
        collection,
        bevel=0.004,
    )
    for index, offset in enumerate((-0.16, 0.16), start=1):
        make_rounded_box(
            f"Rocker_Switch_Contact_{index:02d}",
            (x + offset, y - 0.14, z - 0.04),
            (0.045, 0.09, 0.12),
            materials["brass"],
            collection,
            bevel=0.005,
        )
    make_text(
        "Rocker_Switch_Label",
        "I      O",
        (x + 0.03, y, z + 0.225),
        0.048,
        materials["white"],
        collection,
    )


def build_terminal_blocks(collection, materials):
    add_terminal_block(
        "Terminal_Block_Battery_Side",
        (0.88, -0.80, 0.17),
        materials["terminal"],
        materials["dark"],
        materials["brass"],
        collection,
    )
    add_terminal_block(
        "Terminal_Block_Module_Side",
        (1.72, -0.80, 0.17),
        materials["terminal"],
        materials["dark"],
        materials["brass"],
        collection,
    )


def build_base_tray(collection, materials):
    make_rounded_box(
        "Assembly_Base_Tray",
        (0.10, 0.30, -0.07),
        (6.72, 3.56, 0.16),
        materials["tray"],
        collection,
        bevel=0.08,
    )


def create_materials():
    return {
        "battery": make_material("ECS_Battery_Deep_Charcoal", (0.075, 0.095, 0.12), 0.18, 0.34),
        "tray": make_material("ECS_Assembly_Tray", (0.055, 0.082, 0.11), 0.25, 0.36),
        "tray_frame": make_material("ECS_Tray_Anodized_Frame", (0.14, 0.19, 0.24), 0.78, 0.26),
        "breadboard": make_material("ECS_Proto_Board_Cream", (0.88, 0.87, 0.82), 0.04, 0.42),
        "battery_lid": make_material("ECS_Battery_Lid", (0.12, 0.16, 0.20), 0.15, 0.30),
        "dark": make_material("ECS_Graphite", (0.035, 0.048, 0.062), 0.18, 0.28),
        "teal": make_material("ECS_Teal_Accent", (0.02, 0.62, 0.56), 0.12, 0.28),
        "white": make_material("ECS_Label_Ivory", (0.90, 0.94, 0.92), 0.0, 0.38),
        "silver": make_material("ECS_Brushed_Silver", (0.68, 0.74, 0.79), 0.88, 0.20),
        "brass": make_material("ECS_Gold_Brass", (0.86, 0.66, 0.22), 0.92, 0.18),
        "copper": make_material("ECS_Copper_Contacts", (0.78, 0.36, 0.14), 0.90, 0.20),
        "red": make_material("ECS_Signal_Red", (0.82, 0.10, 0.10), 0.08, 0.28),
        "blue": make_material("ECS_Signal_Blue", (0.08, 0.36, 0.84), 0.08, 0.30),
        "resistor_blue": make_material("ECS_MetalFilm_Blue", (0.14, 0.48, 0.76), 0.08, 0.28),
        "resistor_tan": make_material("ECS_CarbonFilm_Tan", (0.78, 0.62, 0.38), 0.05, 0.34),
        "band_red": make_material("ECS_Band_Red", (0.82, 0.08, 0.08), 0.0, 0.3),
        "band_violet": make_material("ECS_Band_Violet", (0.48, 0.14, 0.68), 0.0, 0.3),
        "band_yellow": make_material("ECS_Band_Yellow", (0.92, 0.78, 0.08), 0.0, 0.3),
        "band_brown": make_material("ECS_Band_Brown", (0.42, 0.20, 0.06), 0.0, 0.3),
        "wire_black": make_material("ECS_Wire_Graphite", (0.025, 0.03, 0.04), 0.0, 0.42),
        "amber": make_material("ECS_Amber_Accent", (0.95, 0.52, 0.08), 0.15, 0.26),
        "pcb_blue": make_material("ECS_PCB_Navy", (0.035, 0.15, 0.32), 0.18, 0.24),
        "pcb_green": make_material("ECS_PCB_Green", (0.035, 0.32, 0.18), 0.18, 0.24),
        "chip": make_material("ECS_Chip_Matte_Black", (0.022, 0.028, 0.036), 0.12, 0.28),
        "terminal": make_material("ECS_Terminal_Teal", (0.03, 0.38, 0.52), 0.12, 0.28),
        "motor": make_material("ECS_Motor_Satin_Steel", (0.46, 0.53, 0.58), 0.85, 0.22),
        "motor_cap": make_material("ECS_Motor_Dark_Cap", (0.08, 0.11, 0.14), 0.55, 0.28),
        "screen": make_material("ECS_OLED_Glass", (0.008, 0.022, 0.032), 0.12, 0.08),
        "cyan": make_material("ECS_Display_Cyan", (0.12, 0.86, 0.92), 0.0, 0.24, emission=2.2),
        "led_cyan": make_material("ECS_LED_Cyan", (0.08, 0.82, 0.96), 0.0, 0.18, emission=2.8),
        "led_red": make_material("ECS_LED_Red", (0.98, 0.12, 0.08), 0.0, 0.18, emission=2.6),
        "inductor": make_material("ECS_Inductor_Ferrite", (0.12, 0.15, 0.18), 0.22, 0.36),
        "capacitor": make_material("ECS_Capacitor_Aluminium", (0.72, 0.78, 0.82), 0.88, 0.18),
        "relay": make_material("ECS_Relay_Case", (0.08, 0.34, 0.72), 0.12, 0.22),
        "relay_glass": make_material("ECS_Relay_Glass", (0.10, 0.42, 0.82), 0.08, 0.10, alpha=0.42),
        "fuse_glass": make_material("ECS_Fuse_Glass", (0.78, 0.88, 0.94), 0.08, 0.06, alpha=0.35),
    }


def get_script_path():
    text = getattr(getattr(bpy.context, "space_data", None), "text", None)
    if text is None or not text.filepath:
        script_file = globals().get("__file__")
        if script_file:
            return Path(script_file).resolve()
        raise RuntimeError(
            "Save this script to blender-workflow\\scripts and run it from "
            "Blender's Text Editor."
        )
    return Path(bpy.path.abspath(text.filepath)).resolve()


def verify_exporter():
    try:
        exporter = bpy.ops.export_scene.gltf
        properties = exporter.get_rna_type().properties
    except (AttributeError, RuntimeError) as error:
        raise RuntimeError(
            "Blender's glTF 2.0 exporter is unavailable or disabled. "
            "Enable the built-in exporter in Blender, then run this script again."
        ) from error

    required = ("filepath", "export_format", "use_selection")
    missing = [name for name in required if name not in properties]
    if missing:
        raise RuntimeError(
            "The glTF exporter is missing required options: "
            + ", ".join(missing)
        )
    return exporter


def remove_collection_objects(collection):
    for obj in tuple(collection.objects):
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data is None or data.users != 0:
            continue
        if isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
        elif isinstance(data, bpy.types.Curve):
            bpy.data.curves.remove(data)


def main():
    import sys
    script_path = get_script_path()
    sys.path.insert(0, str(script_path.parent))
    import assembly_reference
    import types
    assembly_reference.main(types.SimpleNamespace(**globals()))


if __name__ == "__main__":
    main()
