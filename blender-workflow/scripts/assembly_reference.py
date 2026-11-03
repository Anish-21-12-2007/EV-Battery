"""Correct the existing assembly using its established builders and the reviewed CSV.
All coordinates are visualization units. Port plaques are explicit logical interfaces,
never a claimed physical board header pinout. Reuses the existing model geometry.
"""
from collections import defaultdict
import csv, json, math, heapq, hashlib, traceback, datetime, shutil
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "hardware-validation"


def rounded_path(points):
    pts = [Vector(p) for p in points]
    path = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = pts[i - 1 : i + 2]
        radius = min(0.14, (b - a).length * 0.3, (c - b).length * 0.3)
        if radius < 1e-7:
            continue
        p = b + (a - b).normalized() * radius
        q = b + (c - b).normalized() * radius
        path.append(p)
        for k in range(1, 7):
            t = k / 6
            path.append((1 - t) ** 2 * p + 2 * (1 - t) * t * b + t * t * q)
    path.append(pts[-1])
    dense = [path[0]]
    for a, b in zip(path, path[1:]):
        n = max(1, math.ceil((b - a).length / 0.028))
        dense.extend(a.lerp(b, j / n) for j in range(1, n + 1))
    return dense


def tube(h, name, path, radius, mat, col, dashed):
    """Build a continuous 10-sided insulated 3D wire with crimped terminal boots.
    Provisional ('dashed') routes remain 100% physically continuous with subtle periodic
    ribbed jacket rings rather than floating air gaps.
    """
    vertices = []
    faces = []
    sides = 10
    arc = 0.0
    total_len = sum((b - a).length for a, b in zip(path, path[1:]))
    for i, p in enumerate(path):
        if i:
            arc += (p - path[i - 1]).length
        tangent = (path[min(i + 1, len(path) - 1)] - path[max(0, i - 1)]).normalized()
        ref = Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((0, 1, 0))
        side = tangent.cross(ref).normalized()
        up = tangent.cross(side).normalized()
        # Molded strain-relief ferrule boot at both wire ends; subtle ribbed sleeve for provisional wires
        if arc < 0.045 or (total_len - arc) < 0.045:
            r_local = radius * 1.38
        elif dashed:
            r_local = radius * (1.06 if (arc % 0.16) < 0.105 else 0.78)
        else:
            r_local = radius
        for k in range(sides):
            angle = 2 * math.pi * k / sides
            vertices.append(tuple(p + r_local * (math.cos(angle) * side + math.sin(angle) * up)))
        if i:
            for k in range(sides):
                a = (i - 1) * sides + k
                b = (i - 1) * sides + (k + 1) % sides
                faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(reversed(range(sides))))
    last = (len(path) - 1) * sides
    faces.append(tuple(last + k for k in range(sides)))
    return h.make_mesh_object(name, vertices, faces, mat, col, True)


def build_axial_resistor(h, col, m, prefix, x, y, z, bands):
    """Build an authentic axial metal/carbon-film resistor with 5 color bands, bent leads, and PCB carrier pad."""
    h.make_rounded_box(prefix + "PCB_Carrier", (x, y, 0.022), (0.48, 0.19, 0.028), m["pcb_green"], col, bevel=0.008)
    for sx in (-0.18, 0.18):
        h.make_rounded_box(prefix + f"Gold_Pad_{'L' if sx < 0 else 'R'}", (x + sx, y, 0.038), (0.095, 0.12, 0.006), m["brass"], col, bevel=0.002)
    body_mat = m["resistor_tan"] if "R5" in prefix else m["resistor_blue"]
    # Center waist + end caps (dog-bone resistor profile)
    h.make_cylinder(prefix + "Body_Center", (x, y, z), 0.046, 0.16, body_mat, col, axis=(1, 0, 0), segments=16)
    for dx in (-0.09, 0.09):
        h.make_cylinder(
            prefix + f"Body_End_{'L' if dx < 0 else 'R'}",
            (x + dx, y, z),
            0.052,
            0.045,
            body_mat,
            col,
            axis=(1, 0, 0),
            segments=16,
        )
    # 5 EIA color-code bands
    band_offsets = (-0.085, -0.045, -0.005, 0.035, 0.085)
    for bi, (bx, bmat) in enumerate(zip(band_offsets, bands), start=1):
        h.make_cylinder(
            prefix + f"ColorBand_{bi:02d}",
            (x + bx, y, z),
            0.0535 if abs(bx) > 0.06 else 0.0485,
            0.014,
            m[bmat],
            col,
            axis=(1, 0, 0),
            segments=16,
        )
    # Bent tinned-copper axial leads into terminal posts at x +- 0.18
    for side_str, sx in (("L", -1), ("R", 1)):
        h.make_cylinder(
            prefix + f"Lead_Horiz_{side_str}",
            (x + sx * 0.145, y, z),
            0.011,
            0.075,
            m["silver"],
            col,
            axis=(1, 0, 0),
            segments=10,
        )
        h.make_cylinder(
            prefix + f"Lead_Vert_{side_str}",
            (x + sx * 0.18, y, z - 0.03),
            0.011,
            0.06,
            m["silver"],
            col,
            axis=(0, 0, 1),
            segments=10,
        )


def build_ceramic_capacitor(h, col, m, prefix, x, y, z, high_voltage=False):
    """Build a dipped radial multilayer/disc ceramic capacitor with formed leads and PCB carrier pad."""
    h.make_rounded_box(prefix + "PCB_Carrier", (x, y, 0.022), (0.48, 0.19, 0.028), m["pcb_green"], col, bevel=0.008)
    for sx in (-0.18, 0.18):
        h.make_rounded_box(prefix + f"Gold_Pad_{'L' if sx < 0 else 'R'}", (x + sx, y, 0.038), (0.095, 0.12, 0.006), m["brass"], col, bevel=0.002)
    cap_mat = m["blue"] if high_voltage else m["amber"]
    if high_voltage:
        # High-voltage blue ceramic disc capacitor (C3 across motor)
        h.make_cylinder(
            prefix + "Disc_Body",
            (x, y, z + 0.04),
            0.085,
            0.042,
            cap_mat,
            col,
            axis=(0, 1, 0),
            segments=20,
        )
    else:
        # Dipped yellow-ochre MLCC radial box/pillow package (C1, C2)
        h.make_rounded_box(
            prefix + "MLCC_Body",
            (x, y, z + 0.035),
            (0.14, 0.075, 0.11),
            cap_mat,
            col,
            bevel=0.022,
        )
    for side_str, sx in (("L", -1), ("R", 1)):
        h.make_cylinder(
            prefix + f"Lead_Horiz_{side_str}",
            (x + sx * 0.11, y, z + 0.005),
            0.010,
            0.14,
            m["silver"],
            col,
            axis=(1, 0, 0),
            segments=8,
        )


def build_flyback_diode(h, col, m, prefix, x, y, z):
    """Build a DO-201AD fast-recovery power diode with silver cathode band (K on left) and PCB carrier pad."""
    h.make_rounded_box(prefix + "PCB_Carrier", (x, y, 0.022), (0.48, 0.19, 0.028), m["pcb_green"], col, bevel=0.008)
    for sx in (-0.18, 0.18):
        h.make_rounded_box(prefix + f"Gold_Pad_{'L' if sx < 0 else 'R'}", (x + sx, y, 0.038), (0.095, 0.12, 0.006), m["brass"], col, bevel=0.002)
    h.make_cylinder(prefix + "Body", (x, y, z), 0.056, 0.22, m["chip"], col, axis=(1, 0, 0), segments=18)
    h.make_cylinder(prefix + "CathodeBand", (x - 0.068, y, z), 0.058, 0.036, m["silver"], col, axis=(1, 0, 0), segments=18)
    for side_str, sx in (("K", -1), ("A", 1)):
        h.make_cylinder(
            prefix + f"Lead_{side_str}",
            (x + sx * 0.145, y, z),
            0.014,
            0.075,
            m["silver"],
            col,
            axis=(1, 0, 0),
            segments=10,
        )


def batch_component_meshes(col, m):
    """Batch sub-meshes per (component_id, material) while keeping Wire_* and tray separate.
    Preserves exact componentGroups (24 parts) and wireGroup (41 wires) while keeping draw calls low.
    """
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    batches = defaultdict(list)
    for obj in list(col.objects):
        if obj.name.startswith("Wire_") or "component_id" not in obj:
            continue
        cid = obj["component_id"]
        evaluated = obj.evaluated_get(depsgraph)
        data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
        mat = data.materials[0] if len(data.materials) else m["silver"]
        batches[(cid, mat.name)].append((obj, data, obj.matrix_world.copy(), mat))

    for (cid, matname), entries in batches.items():
        verts, faces, normals, smoothing = [], [], [], []
        prefix = entries[0][0].name.split("_")[0] + "_"
        for obj, data, world, mat in entries:
            offset = len(verts)
            verts.extend(tuple(world @ v.co) for v in data.vertices)
            faces.extend(tuple(offset + i for i in p.vertices) for p in data.polygons)
            smoothing.extend(p.use_smooth for p in data.polygons)
            normal_matrix = world.to_3x3().inverted().transposed()
            normals.extend(tuple((normal_matrix @ n.vector).normalized()) for n in data.corner_normals)
        data = bpy.data.meshes.new(f"{cid}_{matname}_Mesh")
        data.from_pydata(verts, [], faces)
        data.materials.append(entries[0][3])
        data.update()
        for polygon, smooth in zip(data.polygons, smoothing):
            polygon.use_smooth = smooth
        if len(normals) == len(data.loops):
            data.normals_split_custom_set(normals)
        b_obj = bpy.data.objects.new(f"{prefix}{cid}_{matname}", data)
        col.objects.link(b_obj)
        b_obj["component_id"] = cid
        b_obj["source_parts_count"] = len(entries)
        for original, baked, _, _ in entries:
            bpy.data.objects.remove(original, do_unlink=True)
            bpy.data.meshes.remove(baked)


def run(h):
    ref = json.loads((OUT / "assembly-reference.json").read_text(encoding="utf-8"))
    rows = list(csv.DictReader((OUT / "corrected-wiring-table.csv").open(encoding="utf-8")))
    csvhash = hashlib.sha256((OUT / "corrected-wiring-table.csv").read_bytes()).hexdigest()
    assert csvhash == ref["csv_sha256"], "Rebuild inspector reference after CSV edits"
    col = bpy.data.collections.new(h.COLLECTION_NAME + "_Reviewed")
    bpy.context.scene.collection.children.link(col)
    m = h.create_materials()
    # Store wire materials under 'wire_' + key so m['battery'] and m['motor'] are NEVER overwritten!
    for key, (color, _, _) in ref["groups"].items():
        rgb = tuple(int(color[i : i + 2], 16) / 255 for i in (1, 3, 5))
        m["wire_" + key] = h.make_material("Wire_" + key, rgb, 0.06, 0.36)
    m["label"] = h.make_material("Reference_Label", (0.84, 0.91, 0.94), 0.0, 0.42)
    m["plate"] = h.make_material("Reference_Plate", (0.055, 0.083, 0.11), 0.05, 0.7)

    # Anodized optical electronics lab bench baseplate + machined perimeter rails + corner bolts
    h.make_rounded_box("Assembly_Base_Tray", (0, 0, -0.09), (10.2, 7.8, 0.16), m["tray"], col, 0.08)
    for side_y in (-3.82, 3.82):
        h.make_rounded_box(f"Assembly_Frame_Rail_Y_{side_y:.2f}", (0, side_y, 0.005), (10.16, 0.12, 0.035), m["tray_frame"], col, 0.010)
    for side_x in (-5.02, 5.02):
        h.make_rounded_box(f"Assembly_Frame_Rail_X_{side_x:.2f}", (side_x, 0, 0.005), (0.12, 7.60, 0.035), m["tray_frame"], col, 0.010)
    for bx in (-4.82, 0.0, 4.82):
        for by in (-3.68, 3.68):
            h.add_fastener(f"Assembly_Bench_Bolt_{bx:.1f}_{by:.1f}", (bx, by, 0.025), m["silver"], col, radius=0.042)
    # Individual PCB breakout pads are created per passive component so all board labels stay 100% clear

    builds = {
        "battery": (h.build_battery, (-2.35, 0.55)),
        "motor": (h.build_motor, (2.2, 1.4)),
        "esp32": (h.build_esp32, (-0.78, 1.36)),
        "acs712": (h.build_current_sensor, (0.53, 1.35)),
        "oled": (h.build_oled, (-0.78, 0.22)),
        "lm2596": (h.build_buck_converter, (0.2, 0.22)),
        "relay": (h.build_relay, (1.38, 0.2)),
        "fuse": (h.build_fuse_holder, (-1.55, -0.83)),
        "switch": (h.build_switch, (-0.2, -0.83)),
    }
    resistor_bands = {
        "r1": ("band_red", "band_violet", "dark", "band_red", "band_brown"),     # 27.0 kOhm 1%
        "r2": ("band_red", "dark", "dark", "band_red", "band_brown"),            # 20.0 kOhm 1%
        "r3": ("blue", "silver", "dark", "band_red", "band_brown"),              # 68.0 kOhm 1%
        "r4": ("band_brown", "dark", "dark", "band_red", "band_brown"),          # 10.0 kOhm 1%
        "r5": ("band_yellow", "band_violet", "band_red", "brass", "band_brown"), # 4.7 kOhm 5%
    }
    ports = {}
    obstacles = []
    for c in ref["components"]:
        cid = c["id"]
        x, y = c["center"]
        prefix = c["prefix"]
        before = set(col.objects)
        if cid in builds:
            builder, old = builds[cid]
            builder(col, m)
            for obj in set(col.objects) - before:
                obj.location.x += x - old[0]
                obj.location.y += y - old[1]
            widths = {
                "battery": (1.48, 0.90),
                "motor": (1.8, 0.64),
                "esp32": (1.06, 0.55),
                "acs712": (0.72, 0.7),
                "oled": (0.82, 0.64),
                "lm2596": (0.86, 1.03),
                "relay": (0.82, 0.65),
                "fuse": (1.02, 0.4),
                "switch": (0.64, 0.48),
            }
            w, d = widths[cid]
            obstacles.append((x - w / 2 - 0.07, y - d / 2 - 0.07, x + w / 2 + 0.07, y + d / 2 + 0.07))
        elif cid == "temperature":
            # Polished 304 stainless steel DS18B20 thermal probe + aluminum mounting clamp + strain-relief boot
            h.make_cylinder(prefix + "Probe_Tube", (x, y, 0.24), 0.062, 0.52, m["silver"], col, axis=(0, 1, 0), segments=20)
            h.make_cylinder(prefix + "Probe_Tip", (x, y + 0.27, 0.24), 0.058, 0.04, m["silver"], col, axis=(0, 1, 0), segments=16)
            h.make_cylinder(prefix + "HeatShrink_Boot", (x, y - 0.22, 0.24), 0.068, 0.14, m["dark"], col, axis=(0, 1, 0), segments=16)
            h.make_rounded_box(prefix + "Case_Clamp", (x, y + 0.06, 0.16), (0.24, 0.12, 0.18), m["tray_frame"], col, bevel=0.018)
            for sx in (-0.085, 0.085):
                h.add_fastener(prefix + f"Clamp_Bolt_{'L' if sx < 0 else 'R'}", (x + sx, y + 0.06, 0.26), m["brass"], col, radius=0.018)
        elif cid == "fuse2":
            # Branch fuse holder with glass fuse cartridge & internal filament
            h.make_rounded_box(prefix + "Holder", (x, y, 0.15), (0.66, 0.28, 0.12), m["dark"], col, bevel=0.022)
            for sx in (-0.19, 0.19):
                h.make_rounded_box(prefix + f"Clip_{'L' if sx < 0 else 'R'}", (x + sx, y, 0.25), (0.065, 0.14, 0.11), m["brass"], col, bevel=0.008)
                h.make_cylinder(prefix + f"Cap_{'L' if sx < 0 else 'R'}", (x + sx, y, 0.27), 0.062, 0.065, m["silver"], col, axis=(1, 0, 0), segments=18)
            h.make_cylinder(prefix + "Internal_Link", (x, y, 0.27), 0.014, 0.34, m["copper"], col, axis=(1, 0, 0), segments=10)
            h.make_cylinder(prefix + "Element_TBD", (x, y, 0.27), 0.056, 0.36, m["fuse_glass"], col, axis=(1, 0, 0), segments=20)
            obstacles.append((x - 0.38, y - 0.2, x + 0.38, y + 0.2))
        elif cid in ("bus", "ground"):
            # High-current brass barrier busbar block on insulated base
            base_mat = m["red"] if cid == "bus" else m["teal"]
            h.make_rounded_box(prefix + "Insulator_Base", (x, y, 0.09), (0.54, 0.30, 0.10), base_mat, col, bevel=0.020)
            h.make_rounded_box(prefix + "Brass_Bar", (x, y, 0.175), (0.44, 0.14, 0.065), m["brass"], col, bevel=0.010)
            for idx_s, ox in enumerate((-0.15, -0.05, 0.05, 0.15), start=1):
                h.make_cylinder(prefix + f"Bus_Screw_{idx_s:02d}", (x + ox, y, 0.222), 0.032, 0.024, m["silver"], col, segments=12)
            obstacles.append((x - 0.3, y - 0.16, x + 0.3, y + 0.16))
        elif cid in ("nodea", "nodeb"):
            # Precision gold-plated turret test-point terminal
            h.make_cylinder(prefix + "Insulator", (x, y, 0.065), 0.082, 0.055, m["teal"], col, segments=16)
            h.make_cylinder(prefix + "Junction", (x, y, 0.145), 0.055, 0.13, m["brass"], col, segments=16)
            h.make_cylinder(prefix + "Turret_Collar", (x, y, 0.215), 0.068, 0.024, m["brass"], col, segments=16)
        elif cid in resistor_bands:
            build_axial_resistor(h, col, m, prefix, x, y, 0.23, resistor_bands[cid])
        elif cid in ("c1", "c2", "c3"):
            build_ceramic_capacitor(h, col, m, prefix, x, y, 0.23, high_voltage=(cid == "c3"))
        elif cid == "d1":
            build_flyback_diode(h, col, m, prefix, x, y, 0.23)

        ty = y + 0.58 if cid in builds and cid != "battery" else y - 0.26
        if cid == "acs712":
            ty = y + 0.74
        elif cid == "lm2596":
            ty = y + 0.64
        elif cid == "battery":
            ty = 3.05
        h.make_text(prefix + "Reference_Name", c["shortName"], (x, ty, 0.05), 0.105, m["label"], col)
        if cid in ("relay", "temperature"):
            h.make_text(
                prefix + "Status",
                "NOT CONNECTED" if cid == "relay" else "PROPOSED SENSOR",
                (x, y - 0.43, 0.06),
                0.075,
                m["amber"],
                col,
            )
        for terminal, pos in c["terminals"].items():
            ports[(cid, terminal)] = Vector(pos)
            if cid == "battery":
                continue
            px, py, pz = pos
            # Precision gold-plated binding post socket with dark insulator collar
            h.make_cylinder(prefix + "Collar_" + terminal, (px, py, 0.045), 0.046, 0.045, m["dark"], col, segments=14)
            h.make_cylinder(prefix + "Port_" + terminal, (px, py, pz - 0.018), 0.036, 0.042, m["brass"], col, segments=14)
            label = terminal.replace("GPIO", "IO")
            h.make_text(
                prefix + "Terminal_" + terminal,
                label,
                (px, py - 0.12, 0.065),
                0.055,
                m["label"],
                col,
                rotation=(0, 0, math.pi / 2) if cid == "esp32" else (0, 0, 0),
            )
        for obj in set(col.objects) - before:
            obj["component_id"] = cid

    h.make_text("Assembly_Title", "ECS  /  BATTERY MONITORING", (0, 3.48, 0.015), 0.19, m["white"], col)
    h.make_text("Assembly_Reference_Caveat", "LOGICAL PORTS - NOT A PHYSICAL HEADER PINOUT", (0, -3.10, 0.02), 0.115, m["amber"], col)
    h.make_text(
        "Assembly_Status_Legend",
        "DASHED: PROVISIONAL   |   SOLID: CALCULATED PASSIVES   |   NO HARDWARE VERIFIED",
        (0, -3.38, 0.02),
        0.09,
        m["label"],
        col,
    )
    h.make_text("Assembly_Relay_Note", "F1 / F2 RATINGS TBD   -   RELAY UNWIRED   -   NO LIVE SENSOR DATA", (0, -3.60, 0.02), 0.085, m["label"], col)

    step = 0.10
    used = {}

    def cell(v):
        return (round(v[0] / step), round(v[1] / step))

    def blocked(k):
        x, y = k[0] * step, k[1] * step
        return any(a < x < b and c < y < d for a, c, b, d in obstacles)

    def route2d(start, end, index):
        s, t = cell(start), cell(end)
        heap = [(0, 0, s)]
        prev = {}
        cost = {s: 0}
        while heap:
            _, g, k = heapq.heappop(heap)
            if k == t:
                break
            if g > cost[k] + 1e-8:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = k[0] + dx, k[1] + dy
                if not (-47 <= q[0] <= 47 and -29 <= q[1] <= 32):
                    continue
                if q not in (s, t) and blocked(q):
                    continue
                ng = g + 1 + used.get(q, 0) * 0.55
                if ng < cost.get(q, 1e12):
                    cost[q] = ng
                    prev[q] = k
                    heapq.heappush(heap, (ng + abs(q[0] - t[0]) + abs(q[1] - t[1]), ng, q))
        if t not in cost:
            raise RuntimeError(f"No clear wire route {index}: {s} to {t}")
        path = [t]
        while path[-1] != s:
            path.append(prev[path[-1]])
        path.reverse()
        for k in path:
            used[k] = used.get(k, 0) + 1
        corners = [path[0]]
        for a, b, c in zip(path, path[1:], path[2:]):
            if (b[0] - a[0], b[1] - a[1]) != (c[0] - b[0], c[1] - b[1]):
                corners.append(b)
        corners.append(path[-1])
        return [(x * step, y * step) for x, y in corners]

    wire_manifest = []
    for index, r in enumerate(rows):
        a = ports[(r["source_component"], r["source_terminal"])]
        b = ports[(r["destination_component"], r["destination_terminal"])]

        def entry(p, cid):
            if cid == "battery":
                q = Vector((p.x, 1.35, 1.56))
                return [p, Vector((p.x, p.y, 1.56)), q, Vector((q.x, q.y, 0.11))]
            return [p, Vector((p.x, p.y, 0.11))]

        ap = entry(a, r["source_component"])
        bp = entry(b, r["destination_component"])
        z = 0.072 + (index % 8) * 0.021
        for p in (ap[-1], bp[-1]):
            p.z = z
        corridor = route2d(ap[-1], bp[-1], r["id"])
        control = ap + [Vector((x, y, z)) for x, y in corridor[1:-1]] + list(reversed(bp))
        cleaned = [control[0]]
        for p in control[1:]:
            if (p - cleaned[-1]).length > 1e-5:
                cleaned.append(p)
        path = rounded_path(cleaned)
        color, _, radius = ref["groups"][r["wire_group"]]
        obj = tube(h, "Wire_" + r["id"], path, radius, m["wire_" + r["wire_group"]], col, r["depiction"] == "dashed")
        for key in ("id", "source_component", "source_terminal", "destination_component", "destination_terminal", "status", "wire_group", "depiction"):
            obj[key] = r[key]
        obj["csv_sha256"] = csvhash
        obj["endpoint_start"] = list(a)
        obj["endpoint_end"] = list(b)
        wire_manifest.append(
            dict(
                **r,
                start=list(a),
                end=list(b),
                control_points=[list(p) for p in cleaned],
                path_points=[list(p) for p in path],
                radius=radius,
                object_name=obj.name,
            )
        )

    batch_component_meshes(col, m)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in col.objects:
        obj.select_set(True)
    target = ROOT / "blender-workflow/output/ecs-battery-assembly.glb"
    if target.exists():
        stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        shutil.copy2(target, target.with_name("ecs-battery-assembly.before-export-" + stamp + ".glb"))
    pending = target.with_name("ecs-battery-assembly.reviewed.pending.glb")
    bpy.ops.export_scene.gltf(filepath=str(pending), export_format="GLB", use_selection=True, export_extras=True, export_apply=True)
    assert pending.stat().st_size > 10000
    pending.replace(target)
    (OUT / "wire-routes.json").write_text(
        json.dumps(dict(csv_sha256=csvhash, coordinates="Blender Z-up, visualization units", wires=wire_manifest), indent=2)
    )
    (OUT / "generation-result.json").write_text(
        json.dumps(
            dict(
                blender=bpy.app.version_string,
                components=len(ref["components"]),
                objects=len(col.objects),
                wires=len(rows),
                bytes=target.stat().st_size,
                csv_sha256=csvhash,
            ),
            indent=2,
        )
    )


def main(h):
    try:
        run(h)
    except Exception:
        (OUT / "generation-error.txt").write_text(traceback.format_exc())
        raise
