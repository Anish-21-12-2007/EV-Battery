"""Original, reproducible ECS GT concept-car geometry. Blender 5.x / meters.

The compact coupe is an illustrative envelope around the existing 96 V teaching
platform. Cosmetic dimensions are not manufacturer specifications. Circuit
endpoints and simulator parameters remain owned by their existing manifests.
"""
import math
from collections import defaultdict

import bpy
from mathutils import Vector

TAU = math.tau
C = None
M = {}
CID = "ev_chassis"


def material(name, color, metallic=0.0, roughness=0.4, emission=0):
    m = bpy.data.materials.new("GT_" + name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Roughness"].default_value = roughness
    if emission:
        p.inputs["Emission Color"].default_value = (*color, 1)
        p.inputs["Emission Strength"].default_value = emission
    if name == "paint":
        p.inputs["Coat Weight"].default_value = 1
        p.inputs["Coat Roughness"].default_value = 0.08
    if name == "glass":
        p.inputs["Transmission Weight"].default_value = 0.85
        p.inputs["IOR"].default_value = 1.48
        p.inputs["Alpha"].default_value = 0.34
        m.diffuse_color = (*color, 0.34)
    if name == "pack_cover":
        p.inputs["Transmission Weight"].default_value = 0.78
        p.inputs["IOR"].default_value = 1.50
        p.inputs["Alpha"].default_value = 0.28
        m.diffuse_color = (*color, 0.28)
    M[name] = m
    return m


def mesh(name, verts, faces, mat="alloy", smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    data.materials.append(M[mat])
    for p in data.polygons:
        p.use_smooth = smooth
    obj = bpy.data.objects.new(name, data)
    C.objects.link(obj)
    obj["component_id"] = CID
    obj["illustrative"] = True
    return obj


def box(name, loc, size, mat="alloy", bevel=0.012, rotation=None):
    x, y, z = [v / 2 for v in size]
    v = [(-x,-y,-z),(-x,-y,z),(-x,y,-z),(-x,y,z),
         (x,-y,-z),(x,-y,z),(x,y,-z),(x,y,z)]
    f = [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]
    obj = mesh(name, v, f, mat)
    obj.location = loc
    if rotation:
        obj.rotation_euler = rotation
    if bevel:
        mod = obj.modifiers.new("Machined edge", "BEVEL")
        mod.width = min(bevel, min(size) * 0.45)
        mod.segments = 2
        mod.harden_normals = True
        norm = obj.modifiers.new("Face normals", "WEIGHTED_NORMAL")
        norm.keep_sharp = True
    return obj


def rod(name, a, b, radius, mat="alloy", segments=16):
    a, b = Vector(a), Vector(b)
    length = (b - a).length
    v = []
    for z in (-length / 2, length / 2):
        v.extend((radius*math.cos(i*TAU/segments), radius*math.sin(i*TAU/segments), z) for i in range(segments))
    f = [tuple(reversed(range(segments))), tuple(range(segments,2*segments))]
    f.extend((i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments))
    obj = mesh(name,v,f,mat,True)
    obj.data.polygons[0].use_smooth = obj.data.polygons[1].use_smooth = False
    obj.location = (a + b) / 2
    obj.rotation_euler = Vector((0,0,1)).rotation_difference((b-a).normalized()).to_euler()
    return obj


def pipe(name, points, radius=0.008, mat="rubber", sides=8, closed=False):
    points = [Vector(p) for p in points]
    v, f = [], []
    for i, p in enumerate(points):
        a = points[(i-1) % len(points)] if closed or i else points[0]
        b = points[(i+1) % len(points)] if closed or i < len(points)-1 else points[-1]
        tangent = (b-a).normalized()
        ref = Vector((0,0,1)) if abs(tangent.z) < .94 else Vector((1,0,0))
        side = tangent.cross(ref).normalized()
        up = tangent.cross(side).normalized()
        v.extend(tuple(p + radius*(math.cos(j*TAU/sides)*side + math.sin(j*TAU/sides)*up)) for j in range(sides))
    for i in range(len(points) if closed else len(points)-1):
        n = (i+1)%len(points)
        f.extend((i*sides+j,i*sides+(j+1)%sides,n*sides+(j+1)%sides,n*sides+j) for j in range(sides))
    return mesh(name,v,f,mat,True)


def ring(name, center, radius, tube, mat="alloy", axis="y", segments=64):
    x,y,z = center
    pts = []
    for i in range(segments):
        a = i*TAU/segments
        pts.append((x+radius*math.cos(a),y,z+radius*math.sin(a)) if axis=="y" else
                   (x,y+radius*math.cos(a),z+radius*math.sin(a)) if axis=="x" else
                   (x+radius*math.cos(a),y+radius*math.sin(a),z))
    return pipe(name,pts,tube,mat,8,True)


def lathe_y(name, center, profile, mat="alloy", segments=80, tread=False):
    x,y,z = center
    v, f = [], []
    for i in range(segments):
        a = i*TAU/segments
        for depth,radius in profile:
            r = radius
            if tread and radius > .301:
                if min(abs(depth-d) for d in (-.065,-.021,.021,.065)) < .004:
                    r -= .0035
                r -= .0018 if ((a*32/TAU + depth*14) % 1) < .12 else 0
            v.append((x+r*math.cos(a), y+depth, z+r*math.sin(a)))
    n = len(profile)
    for i in range(segments):
        for j in range(n-1):
            f.append((i*n+j,((i+1)%segments)*n+j,((i+1)%segments)*n+j+1,i*n+j+1))
    return mesh(name,v,f,mat,True)


def label(name, body, loc, size=.035, mat="lettering", rotation=(0,0,0)):
    curve = bpy.data.curves.new(name,"FONT")
    curve.body = body
    curve.size = size
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.extrude = .00035
    curve.bevel_depth = .0001
    curve.resolution_u = 3
    curve.materials.append(M[mat])
    obj = bpy.data.objects.new(name,curve)
    C.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rotation
    obj["component_id"] = CID
    return obj


def bolt(name, center, axis=(0,0,1), radius=.008):
    c, a = Vector(center), Vector(axis)
    return rod(name,c-a*.004,c+a*.004,radius,"fastener",6)


def surface(name, fn, nu=28, nv=16, mat="paint", thickness=0, flip_winding=False):
    v = [fn(i/nu,j/nv) for i in range(nu+1) for j in range(nv+1)]
    if flip_winding:
        f = [(i*(nv+1)+j,i*(nv+1)+j+1,(i+1)*(nv+1)+j+1,(i+1)*(nv+1)+j)
             for i in range(nu) for j in range(nv)]
    else:
        f = [(i*(nv+1)+j,(i+1)*(nv+1)+j,(i+1)*(nv+1)+j+1,i*(nv+1)+j+1)
             for i in range(nu) for j in range(nv)]
    obj = mesh(name,v,f,mat,True)
    if thickness:
        m = obj.modifiers.new("Panel thickness","SOLIDIFY")
        m.thickness = thickness
    return obj


def body_width(x):
    # Muscular GT coupe planform: flared front/rear fenders, Coke-bottle door pinch, tapered nose & tail
    front_flare = .058 * math.exp(-((x + 1.32) / .38) ** 2)
    rear_flare = .074 * math.exp(-((x - 1.30) / .44) ** 2)
    door_pinch = -.032 * math.exp(-((x + .05) / .56) ** 2)
    end_taper = -.16 * (abs(x) / 2.12) ** 4.6
    return .885 + front_flare + rear_flare + door_pinch + end_taper


def shoulder(x):
    # Sleek low-slung nose, muscular front/rear fender crests, fastback tail
    nose_drop = -.215 * max(0.0, (-x - .75) / 1.33) ** 1.65 if x < -.75 else 0.0
    front_crest = .044 * math.exp(-((x + 1.32) / .36) ** 2)
    rear_haunch = .052 * math.exp(-((x - 1.24) / .46) ** 2)
    tail_drop = -.085 * max(0.0, (x - 1.35) / .73) ** 1.6 if x > 1.35 else 0.0
    return .636 + nose_drop + front_crest + rear_haunch + tail_drop


def hood_center_z(x):
    # Centerline of hood sits lower than outer fender crests and slopes cleanly to the nose
    u = max(0.0, min(1.0, (x + 2.08) / 1.31))
    return .405 + .242 * (u ** .74)


def cabin_half_width(x):
    return .772 - .048 * ((x - .15) / 1.15) ** 2


def arch_bottom(x):
    z = .052
    for axle in (-1.32, 1.32):
        dx = x - axle
        if abs(dx) < .362:
            z = max(z, .18 + math.sqrt(.362 ** 2 - dx ** 2))
    return z


def build_body():
    global CID
    for side in (-1, 1):
        ranges = [
            (-1.94, -.92, "ev_body_front"),
            (-.92, .92, "ev_door_l" if side > 0 else "ev_door_r"),
            (.92, 1.94, "ev_body_rear"),
        ]
        for a, b, cid in ranges:
            CID = cid
            def flank_fn(u, v, a=a, b=b, side=side):
                x = a + (b - a) * u
                low, high = arch_bottom(x), shoulder(x)
                # Smoothly curve top 22% of flank inward to create a rounded fender/door shoulder crown
                if v < .78:
                    vn = v / .78
                    z = low + (high - .028 - low) * vn
                    inward_roll = 0.0
                else:
                    vt = (v - .78) / .22
                    z = (high - .028) + .028 * math.sin(vt * math.pi / 2)
                    inward_roll = -.042 * (1 - math.cos(vt * math.pi / 2))
                bw = body_width(x)
                rocker_tuck = -.046 * (1 - min(1.0, v / .78)) ** 2.2
                mid_belly = .018 * math.sin(min(1.0, v / .85) * math.pi)
                door_scallop = -.024 * math.exp(-((x + .05) / .60) ** 2) * math.sin(v * math.pi) ** 1.5
                y = bw + rocker_tuck + mid_belly + door_scallop + inward_roll
                return x, side * y, z
            surface(f"GT_Sculpted_Flank_{cid}_{side}", flank_fn, 64, 18, thickness=.005, flip_winding=(side > 0))

        # Sculpted upper front fender crown bridging flank top to hood edge, matching front fascia curve at u=0
        CID = "ev_body_front"
        def front_fender_top(u, v, side=side):
            y_in_0 = .54
            y_out_0 = body_width(-1.94) - .042
            y_frac = (y_in_0 + (y_out_0 - y_in_0) * v) / y_out_0
            x_start = -2.07 + .13 * (y_frac ** 2)
            x = x_start + (-0.77 - x_start) * u
            y_out = body_width(x) - .042
            y_in = min(y_out - .02, .54 + .20 * u)
            y = y_in + (y_out - y_in) * v
            z_out = shoulder(x)
            z_in = hood_center_z(x)
            z = z_in + (z_out - z_in) * math.sin(v * math.pi / 2) + .010 * math.sin(v * math.pi)
            return x, side * y, z
        surface(f"GT_Front_Fender_Crown_{side}", front_fender_top, 40, 12, "paint", .005, flip_winding=(side < 0))

        # Sculpted rear quarter haunch bridging flank top inward to cabin glass & rear deck, matching rear fascia at u=1
        CID = "ev_body_rear"
        def rear_haunch_top(u, v, side=side):
            y_out_1 = body_width(1.94) - .042
            x_end = 2.07 - .13 * (v ** 2)
            x = .72 + (x_end - .72) * u
            y_out = body_width(x) - .042
            y_in = cabin_half_width(x) * (1 - min(1.0, max(0.0, (x - 1.15) / .40)))
            y = y_in + (y_out - y_in) * v
            z_out = shoulder(x)
            z_in = shoulder(x) + .022 * (1 - u * .45)
            z = z_in + (z_out - z_in) * (v ** 1.25) + .014 * math.sin(v * math.pi)
            return x, side * y, z
        surface(f"GT_Rear_Quarter_Shoulder_{side}", rear_haunch_top, 36, 12, "paint", .005, flip_winding=(side < 0))

        # Wheel arches & inner enclosed wheelhouse tubs
        for axle in (-1.32, 1.32):
            CID = "ev_body_front" if axle < 0 else "ev_body_rear"
            pts = [(axle - .362, side * body_width(axle - .362), .055)]
            pts += [
                (
                    axle - .362 * math.cos(t * math.pi / 48),
                    side * (body_width(axle - .362 * math.cos(t * math.pi / 48)) + .004),
                    .18 + .362 * math.sin(t * math.pi / 48),
                )
                for t in range(49)
            ]
            pts += [(axle + .362, side * body_width(axle + .362), .055)]
            pipe(f"GT_Rolled_Fender_Lip_{side}_{axle}", pts, .010, "paint")
            pipe(f"GT_Wheel_Arch_Liner_{side}_{axle}", [(x, y - side * .026, z) for x, y, z in pts], .014, "rubber")

            def tub_fn(u, v, axle=axle, side=side):
                ang = u * math.pi
                r = .358
                x = axle - r * math.cos(ang)
                z = .18 + r * math.sin(ang)
                y_outer = side * (body_width(x) - .015)
                y_inner = side * .53
                y = y_inner + (y_outer - y_inner) * v
                return x, y, z
            surface(f"GT_Wheelhouse_Tub_{side}_{axle}", tub_fn, 28, 6, "rubber")

        CID = "ev_aero"
        box(f"GT_Side_Sill_{side}", (0, side * .862, .058), (1.80, .072, .042), "carbon", .012)
        box(f"GT_Side_Aero_Winglet_{side}", (.82, side * .895, .078), (.24, .018, .085), "carbon", .005)
        CID = "ev_door_l" if side > 0 else "ev_door_r"
        for x in (-.918, .918):
            pipe(
                f"GT_Door_Shutline_{side}_{x}",
                [(x, side * (body_width(x) + .003), z) for z in (.07, .22, .42, shoulder(x) - .025)],
                .0028,
                "seam",
            )
        pipe(f"GT_Door_Lower_Seam_{side}", [(-.91, side * .850, .068), (0, side * .832, .068), (.91, side * .852, .068)], .003, "seam")
        box(f"GT_Flush_Handle_Recess_{side}", (.56, side * .868, .545), (.15, .010, .026), "seam", .008)
        box(f"GT_Flush_Handle_{side}", (.56, side * .874, .545), (.13, .012, .016), "chrome", .005)
        pipe(
            f"GT_Beltline_{side}",
            [(x, side * (body_width(x) - .038), shoulder(x) + .002) for x in [-.92 + i * 1.84 / 40 for i in range(41)]],
            .0055,
            "chrome",
        )

    # Sculpted center hood with power dome and twin aero extractor vents, matching front_fender_top at t=+-1
    CID = "ev_body_front"
    def hood(u, v):
        t = v * 2 - 1
        half_w = .54 + .20 * u
        y = half_w * t
        y_out_0 = body_width(-1.94) - .042
        y_frac = y / y_out_0
        x_start = -2.07 + .13 * (y_frac ** 2)
        x = x_start + (-0.77 - x_start) * u
        zc = hood_center_z(x)
        crown = .024 * (1 - t * t) + .012 * math.exp(-((abs(t) - .45) / .18) ** 2) * math.sin(u * math.pi)
        return x, y, zc + crown
    surface("GT_Compound_Curved_Hood", hood, 48, 28, thickness=.005)
    for side in (-1, 1):
        pts = []
        for i in range(41):
            u = i / 40
            x = -1.94 + 1.14 * u
            y = side * (.26 + .16 * u)
            pts.append((x, y, hood_center_z(x) + .022 * (1 - (y / (.56 + .18 * u)) ** 2) + .010))
        pipe(f"GT_Hood_Press_Line_{side}", pts, .0035, "paint")
        box(f"GT_Hood_Aero_Vent_{side}", (-1.42, side * .28, hood_center_z(-1.42) + .022), (.26, .10, .012), "carbon", .004, rotation=(0, .14, 0))

    # Fastback rear decklid bridging seamlessly from rear glass (x=1.16) to tail (x=2.06)
    CID = "ev_body_rear"
    def rear_deck(u, v):
        x = 1.16 + .90 * u
        t = v * 2 - 1
        y = (body_width(x) - .040) * t
        z = shoulder(x) + .004 + .038 * (1 - t * t) * (1 - .35 * u)
        return x - .12 * (u ** 2) * (t * t), y, z
    surface("GT_Rear_Haunch_Deck", rear_deck, 36, 28, thickness=.005)

    # Full-width wrap-around front and rear bumper fascias meeting flanks at x = +-1.94
    for end in (-1, 1):
        CID = "ev_body_front" if end < 0 else "ev_body_rear"
        def fascia_fn(u, v, end=end):
            t = u * 2 - 1
            x_base = end * 2.07
            x = x_base - end * .13 * (t ** 2)
            bw = body_width(x) - .042 * (v ** 1.5) - .025 * (1 - v)
            y = bw * t
            z_low = .058
            z_high = (hood_center_z(x) + (shoulder(x) - hood_center_z(x)) * (t * t)) if end < 0 else (shoulder(x) + .015 * (1 - t * t))
            z = z_low + (z_high - z_low) * v
            x += end * .028 * math.sin(v * math.pi) * (1 - .55 * t * t)
            return x, y, z
        surface(f"GT_Bumper_Fascia_{end}", fascia_fn, 44, 16, thickness=.005, flip_winding=(end > 0))
        CID = "ev_aero"
        pipe(
            f"GT_Splitter_{end}",
            [(end * (2.11 - .15 * (i / 48 * 2 - 1) ** 2), body_width(end * 2.04) * (i / 48 * 2 - 1), .062) for i in range(49)],
            .024,
            "carbon",
        )

    # Front grille intake, active aero vanes, and dive-plane canards
    CID = "ev_aero"
    box("GT_Front_Lower_Intake", (-2.092, 0, .195), (.045, 1.06, .135), "seam", .022)
    for i in range(23):
        y = -.495 + i * .045
        box(f"GT_Grille_Vane_{i}", (-2.108, y, .195), (.018, .006, .11), "graphite", .002)
    for side in (-1, 1):
        box(f"GT_Brake_Cooling_Inlet_{side}", (-2.045, side * .655, .225), (.05, .155, .125), "seam", .02)
        for z in (.205, .245):
            box(f"GT_Intake_Blade_{side}_{z}", (-2.068, side * .655, z), (.022, .13, .008), "carbon", .003)
        box(f"GT_Front_Aero_Canard_{side}", (-2.01, side * .805, .185), (.16, .048, .010), "carbon", .003, rotation=(.18 * side, -.22, 0))

    # Rear Venturi diffuser + 5 aero strakes + Swan-Neck GT Carbon Rear Wing
    box("GT_Rear_Diffuser_Valance", (2.055, 0, .135), (.18, 1.36, .125), "carbon", .022)
    for y in (-.54, -.27, 0, .27, .54):
        box(f"GT_Diffuser_Strake_{y}", (2.06, y, .088), (.26, .014, .095), "graphite", .004)
    pipe("GT_Rear_Lip_Spoiler", [(1.98, .77 * (i / 48 * 2 - 1), shoulder(1.98) + .016 * (1 - (i / 48 * 2 - 1) ** 2)) for i in range(49)], .016, "carbon")
    def gt_wing_fn(u, v):
        t = u * 2 - 1
        y = .74 * t
        chord = .19 - .03 * (t * t)
        x = 1.92 + (v - .5) * chord + .035 * (t * t)
        camber = .012 * math.sin(v * math.pi) - .018 * (v - .5)
        z = .735 + camber + .010 * (1 - t * t)
        return x, y, z
    surface("GT_Rear_Aero_Wing_Airfoil", gt_wing_fn, 32, 10, "carbon", .009)
    for side in (-1, 1):
        box(f"GT_Wing_Pylon_{side}", (1.88, side * .32, .665), (.14, .014, .135), "carbon", .004, rotation=(0, .18, 0))
        box(f"GT_Wing_Endplate_{side}", (1.95, side * .745, .732), (.22, .010, .082), "carbon", .004)

    CID = "ev_body_front"
    label("GT_Hood_Badge", "E C S", (-1.93, 0, hood_center_z(-1.93) + .032), .045, "chrome", (0, .14, 0))
    CID = "ev_body_rear"
    label("GT_Rear_Lettering", "E  C  S", (2.106, 0, .435), .058, "chrome", (math.pi / 2, 0, math.pi / 2))
    box("GT_Rear_Plate", (2.102, 0, .275), (.010, .31, .068), "graphite", .008)
    label("GT_Rear_Plate_Text", "GT  /  ELECTRIC", (2.109, 0, .275), .026, "lettering", (math.pi / 2, 0, math.pi / 2))


def build_canopy():
    global CID
    CID = "ev_roof"
    def roof_fn(u, v):
        x = -.25 + .97 * u
        t = v * 2 - 1
        y = t * (.635 + .015 * math.sin(u * math.pi))
        bubble = .012 * math.sin(abs(t) * math.pi) ** 1.4
        z = 1.132 + .036 * math.sin(u * math.pi) + .032 * (1 - t * t) + bubble
        return x, y, z
    surface("GT_Roof_Panel", roof_fn, 36, 24, "paint", .008)
    for side in (-1, 1):
        pillars = [(-.79, side * .775, .648), (-.25, side * .635, 1.132), (.71, side * .635, 1.132), (1.18, side * .765, .655)]
        pipe(f"GT_Roof_Side_Rail_{side}", pillars, .025, "paint")
        pipe(f"GT_Window_Seal_{side}", [(x, y - side * .008, z - .012) for x, y, z in pillars], .011, "seam")
        pipe(
            f"GT_Window_Sill_Seal_{side}",
            [(-.79, side * .775, .645), (0, side * .778, .645), (.78, side * .775, .648), (1.18, side * .765, .655)],
            .012,
            "seam",
        )
        pipe(f"GT_B_Pillar_{side}", [(.56, side * .638, 1.124), (.58, side * .774, .648)], .026, "gloss_black")
        CID = "ev_glass"
        corners = [(-.772, side * .768, .655), (-.238, side * .628, 1.120), (.552, side * .630, 1.122), (.568, side * .768, .655)]
        surface(
            f"GT_Door_Glass_{side}",
            lambda u, v, c=corners: tuple(
                (1 - u) * ((1 - v) * c[0][k] + v * c[1][k]) + u * ((1 - v) * c[3][k] + v * c[2][k]) for k in range(3)
            ),
            24,
            12,
            "glass",
        )
        q_corners = [(.595, side * .768, .655), (.585, side * .631, 1.118), (.705, side * .631, 1.118), (1.165, side * .758, .658)]
        surface(
            f"GT_Quarter_Glass_{side}",
            lambda u, v, c=q_corners: tuple(
                (1 - u) * ((1 - v) * c[0][k] + v * c[1][k]) + u * ((1 - v) * c[3][k] + v * c[2][k]) for k in range(3)
            ),
            16,
            10,
            "glass",
        )
        CID = "ev_roof"
    CID = "ev_glass"
    surface(
        "GT_Laminated_Windscreen",
        lambda u, v: (
            -.79 + .54 * u - .036 * (1 - (v * 2 - 1) ** 2),
            (.772 - .137 * u) * (v * 2 - 1),
            .652 + .480 * u + .022 * (1 - (v * 2 - 1) ** 2),
        ),
        30,
        32,
        "glass",
    )
    surface(
        "GT_Rear_Windscreen",
        lambda u, v: (
            .715 + .465 * u,
            (.632 + .130 * u) * (v * 2 - 1),
            1.130 - .472 * u + .018 * (1 - (v * 2 - 1) ** 2),
        ),
        26,
        30,
        "glass",
    )
    CID = "ev_roof"
    for x, z, w in [(-.79, .652, .77), (-.25, 1.132, .635), (.715, 1.130, .635), (1.18, .658, .762)]:
        pipe(f"GT_Window_Edge_{x}", [(x, w * (i / 24 * 2 - 1), z + .018 * (1 - (i / 24 * 2 - 1) ** 2)) for i in range(25)], .009, "seam")
    for y in (-.30, .30):
        pipe(f"GT_Windscreen_Wiper_{y}", [(-.77, y, .675), (-.61, y + .12, .815)], .005, "graphite")
    CID = "ev_mirrors"
    for side in (-1, 1):
        rod(f"GT_Mirror_Stem_{side}", (-.64, side * .785, .678), (-.58, side * .965, .712), .020, "carbon")
        box(f"GT_Mirror_Housing_{side}", (-.59, side * 1.01, .736), (.185, .13, .062), "paint", .026)
        box(f"GT_Mirror_Reflector_{side}", (-.498, side * 1.01, .736), (.005, .102, .042), "mirror", .012)
        pipe(f"GT_Mirror_Indicator_{side}", [(-.682, side * .97, .732), (-.682, side * 1.045, .732)], .0035, "led_white")


def build_lights():
    global CID
    CID = "ev_lights"
    for side in (-1, 1):
        points = [(-2.055 + .14 * u, side * (.44 + .31 * u), .375 + .075 * u) for u in [i / 24 for i in range(25)]]
        pipe(f"GT_Headlamp_Housing_{side}", points, .032, "gloss_black", 12)
        for j in (0, 1):
            pipe(f"GT_Matrix_DRL_{side}_{j}", [(x - .022, y, z + (j - .5) * .022) for x, y, z in points], .005, "led_white", 8)
        for k in range(4):
            u = .13 + k * .19
            box(f"GT_Projector_{side}_{k}", (-2.065 + .14 * u, side * (.44 + .31 * u), .375 + .075 * u), (.020, .028, .020), "led_white", .006)
        pipe(
            f"GT_Front_Aero_DRL_{side}",
            [(-2.068, side * (.55 + .18 * u), .265) for u in (0, .5, 1)],
            .004,
            "led_cyan",
            8,
        )
    points = [(2.092 - .085 * (t * 2 - 1) ** 2, .77 * (t * 2 - 1), .505 + .012 * (1 - (t * 2 - 1) ** 2)) for t in [i / 60 for i in range(61)]]
    pipe("GT_Rear_Light_Smoked_Housing", points, .022, "gloss_black")
    pipe("GT_Continuous_Rear_LED", [(x + .015, y, z) for x, y, z in points], .007, "led_red")
    pipe("GT_Lower_Rear_LED_Strip", [(x + .014, y, z - .016) for x, y, z in points], .004, "led_red")
    for side in (-1, 1):
        box(f"GT_Rear_Reflector_{side}", (2.072, side * .65, .225), (.008, .11, .022), "red_lens", .006)


def build_wheels_and_brakes():
    global CID
    tire_profile = [(-.114, .223), (-.122, .242), (-.117, .275), (-.104, .295), (-.088, .306)]
    tire_profile += [(d, .310) for d in [-.079, -.069, -.066, -.062, -.046, -.025, -.022, -.018, 0, .018, .022, .025, .046, .062, .066, .069, .079]]
    tire_profile += [(.088, .306), (.104, .295), (.117, .275), (.122, .242), (.114, .223)]
    tire_profile += [(-.114, .223)]
    for x in (-1.32, 1.32):
        for side in (-1, 1):
            corner = ("f" if x < 0 else "r") + ("l" if side > 0 else "r")
            CID = "ev_wheel_" + corner
            y, z = side * .78, .18
            lathe_y(f"GT_{corner}_Performance_Tire", (x, y, z), tire_profile, "tire", 112, True)
            for d in (-.119, .119):
                for r in (.232, .270):
                    ring(f"GT_{corner}_Sidewall_Bead_{d}_{r}", (x, y + d, z), r, .0016, "tire", segments=72)
            lathe_y(
                f"GT_{corner}_Forged_Rim_Barrel",
                (x, y, z),
                [
                    (-.115, .222), (-.115, .211), (-.096, .204), (.088, .204),
                    (.110, .211), (.117, .219), (.116, .226), (.107, .226),
                    (.104, .218), (-.104, .218), (-.108, .226), (-.115, .222),
                ],
                "graphite",
                72,
            )
            ring(f"GT_{corner}_Diamond_Cut_Rim_Lip", (x, y + side * .116, z), .221, .0055, "chrome", segments=72)
            face_y = y + side * .104
            for i in range(5):
                for branch in (-1, 1):
                    ang = i * TAU / 5 + branch * .055
                    shape = [
                        (.045, ang - .12),
                        (.075, ang - .11),
                        (.214, ang + branch * .08 - .036),
                        (.214, ang + branch * .08 + .036),
                        (.085, ang + .09),
                        (.045, ang + .12),
                    ]
                    verts = []
                    for depth in (face_y - side * .022, face_y):
                        verts += [(x + r * math.cos(a), depth, z + r * math.sin(a)) for r, a in shape]
                    n = len(shape)
                    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))] + [(j, (j + 1) % n, (j + 1) % n + n, j + n) for j in range(n)]
                    spoke = mesh(f"GT_{corner}_Split_Spoke_{i}_{branch}", verts, faces, "alloy")
                    mod = spoke.modifiers.new("Spoke fillet", "BEVEL")
                    mod.width = .002
                    mod.segments = 2
                a = i * TAU / 5
                bolt(f"GT_{corner}_Lug_{i}", (x + .043 * math.cos(a), face_y + side * .005, z + .043 * math.sin(a)), (0, side, 0), .008)
            rod(f"GT_{corner}_Hub", (x, face_y - side * .025, z), (x, face_y + side * .008, z), .036, "gloss_black", 24)
            label(f"GT_{corner}_Center_Badge", "E", (x, face_y + side * .009, z), .034, "chrome", (math.pi / 2 if side < 0 else -math.pi / 2, 0, 0))
            for i, ch in enumerate("E C S   P E R F O R M A N C E"):
                if ch == " ":
                    continue
                a = math.pi * .19 + i * .075
                obj = label(
                    f"GT_{corner}_Sidewall_Letter_{i}",
                    ch,
                    (x + .279 * math.cos(a), y + side * .120, z + .279 * math.sin(a)),
                    .014,
                    "tire_letter",
                    (math.pi / 2 if side < 0 else -math.pi / 2, 0, 0),
                )
                obj.rotation_euler.rotate_axis("Z", (a - math.pi / 2) * (1 if side < 0 else -1))

            CID = "ev_brakes_front" if x < 0 else "ev_brakes_rear"
            dy = y + side * .052
            lathe_y(
                f"GT_{corner}_Ventilated_Brake_Rotor",
                (x, dy, z),
                [(-.013, .063), (-.013, .185), (.013, .185), (.013, .063), (-.013, .063)],
                "rotor",
                96,
            )
            lathe_y(
                f"GT_{corner}_Rotor_Hat",
                (x, dy, z),
                [(-.018, .031), (-.018, .084), (.018, .084), (.018, .031)],
                "graphite",
                40,
            )
            for n in range(24):
                a = n * TAU / 24
                for r in (.122, .158):
                    rod(
                        f"GT_{corner}_Rotor_Drilling_{n}_{r}",
                        (x + r * math.cos(a), dy - side * .0135, z + r * math.sin(a)),
                        (x + r * math.cos(a), dy + side * .0135, z + r * math.sin(a)),
                        .004,
                        "seam",
                        8,
                    )
            cal_x = x + (.132 if x < 0 else -.132)
            box(f"GT_{corner}_Six_Piston_Caliper", (cal_x, dy, z + .015), (.092, .092, .185), "caliper", .024)
            for dz in (-.050, 0, .050):
                rod(
                    f"GT_{corner}_Caliper_Piston_{dz}",
                    (cal_x, dy - side * .047, z + dz),
                    (cal_x, dy + side * .048, z + dz),
                    .023,
                    "caliper",
                    16,
                )
            label(
                f"GT_{corner}_Caliper_Badge",
                "ECS",
                (cal_x, dy + side * .049, z + .015),
                .026,
                "lettering",
                (math.pi / 2 if side < 0 else -math.pi / 2, 0, 0),
            )
            pipe(f"GT_{corner}_Brake_Hose", [(cal_x, dy - side * .04, z + .05), (x + .18, side * .58, .30), (x + .08, side * .47, .31)], .0065, "rubber")

    # Brake master cylinder, electromechanical iBooster, and ABS/ESC hydraulic modulator unit
    CID = "ev_brakes_front"
    box("GT_ABS_ESC_Modulator_Block", (-.96, -.36, .39), (.12, .11, .11), "alloy", .012)
    rod("GT_ABS_Pump_Motor", (-.96, -.43, .39), (-.96, -.49, .39), .036, "gloss_black", 20)
    for i in range(4):
        pipe(
            f"GT_ABS_Hardline_{i}",
            [(-.92 + i * .018, -.36, .445), (-.92 + i * .018, -.36, .48), (-1.18, -.42 + i * .03, .36)],
            .0035,
            "copper",
            6,
        )
    rod("GT_Brake_Booster_Housing", (-.86, .34, .48), (-.78, .34, .48), .078, "gloss_black", 24)
    rod("GT_Brake_Master_Cylinder", (-.96, .34, .48), (-.86, .34, .48), .028, "alloy", 18)
    box("GT_Brake_Fluid_Reservoir", (-.91, .34, .545), (.085, .055, .055), "reservoir", .012)


def build_chassis_suspension():
    global CID
    CID = "ev_chassis"
    # Center floor pan between axles (x = -0.92..+0.92) + narrower front/rear subframe pans (clearing wheel wells!)
    box("GT_Stamped_Floor_Pan", (0, 0, .145), (1.86, 1.38, .042), "graphite", .022)
    box("GT_Front_Subframe_Tray", (-1.36, 0, .145), (.92, .88, .036), "graphite", .018)
    box("GT_Rear_Subframe_Tray", (1.36, 0, .145), (.92, .88, .036), "graphite", .018)
    for y in (-.42, -.16, .16, .42):
        box(f"GT_Floor_Rib_{y}", (0, y, .172), (1.76, .034, .018), "graphite", .005)
    for side in (-1, 1):
        # Rocker rails span strictly between the front & rear wheel wells (x = -0.90..+0.90)
        box(f"GT_Extruded_Rocker_Rail_{side}", (0, side * .695, .215), (1.80, .076, .135), "alloy", .016)
        for x in [-.80 + i * .20 for i in range(9)]:
            bolt(f"GT_Rail_Fastener_{side}_{x}", (x, side * .695, .286))
        for end in (-1, 1):
            # Inboard longitudinal frame rails clearing the front & rear tires (y = ±0.45)
            box(f"GT_Crumple_Rail_{side}_{end}", (end * 1.40, side * .45, .235), (.96, .068, .092), "alloy", .014)
            # Torque box gusset connecting outer rocker rail to inboard frame rail
            rod(f"GT_Torque_Box_Link_{side}_{end}", (end * .88, side * .68, .215), (end * 1.02, side * .46, .235), .036, "alloy", 14)
            rod(f"GT_Subframe_Strut_{side}_{end}", (end * 1.32, side * .52, .51), (end * 1.68, side * .45, .27), .018, "alloy", 14)
    for x in (-.88, -.44, .25, .88):
        box(f"GT_Floor_Crossmember_{x}", (x, 0, .215), (.072, 1.34, .080), "alloy", .012)
    for x in (-1.32, 1.32):
        box(f"GT_Axle_Crossmember_{x}", (x, 0, .215), (.078, .92, .082), "alloy", .012)
    for x in (-1.87, 1.85):
        box(f"GT_Crash_Beam_{x}", (x, 0, .255), (.068, 1.32, .098), "alloy", .02)
    pipe("GT_Front_Strut_Brace", [(-1.32, -.53, .53), (-1.22, -.25, .56), (-1.22, .25, .56), (-1.32, .53, .53)], .015, "alloy", 10)
    pipe("GT_Rear_Strut_Brace", [(1.32, -.53, .53), (1.22, -.25, .56), (1.22, .25, .56), (1.32, .53, .53)], .015, "alloy", 10)

    for x in (-1.32, 1.32):
        CID = "ev_suspension_front" if x < 0 else "ev_suspension_rear"
        for side in (-1, 1):
            box(f"GT_Shock_Tower_Mount_{x}_{side}", (x, side * .525, .525), (.13, .12, .032), "alloy", .008)
            for level in (.13, .33):
                out = (x, side * .704, level)
                for dx in (-.17, .17):
                    rod(f"GT_Wishbone_{x}_{side}_{level}_{dx}", (x + dx, side * .46, level + .02), out, .014, "alloy")
                    rod(
                        f"GT_Control_Arm_Bushing_{x}_{side}_{level}_{dx}",
                        (x + dx - .035, side * .455, level + .02),
                        (x + dx + .035, side * .455, level + .02),
                        .026,
                        "rubber",
                    )
                bolt(f"GT_Ball_Joint_{x}_{side}_{level}", out, (0, 0, 1), .023)
            rod(f"GT_Hub_Carrier_{x}_{side}", (x, side * .70, .12), (x, side * .70, .36), .038, "alloy", 20)
            base = (x, side * .58, .18)
            top = (x, side * .53, .525)
            rod(f"GT_Damper_Body_{x}_{side}", base, (x, side * .552, .36), .026, "damper", 24)
            rod(f"GT_Damper_Reservoir_{x}_{side}", (x + .038, side * .565, .21), (x + .038, side * .565, .32), .015, "damper", 16)
            rod(f"GT_Damper_Piston_{x}_{side}", (x, side * .552, .31), top, .012, "chrome")
            pts = []
            for i in range(145):
                t = i / 144
                a = t * TAU * 7
                pts.append((x + .046 * math.cos(a), side * (.575 - .04 * t) + .046 * math.sin(a), .23 + .265 * t))
            pipe(f"GT_Helical_Coil_Spring_{x}_{side}", pts, .0085, "spring", 8)
            for z in (.225, .504):
                rod(f"GT_Spring_Seat_{x}_{side}_{z}", (x, side * .55, z - .009), (x, side * .55, z + .009), .060, "graphite", 24)
            bolt(f"GT_Strut_Top_Nut_{x}_{side}", top, (0, 0, 1), .019)
            rod(f"GT_Sway_Drop_Link_{x}_{side}", (x + .17, side * .64, .16), (x + .14, side * .64, .28), .007, "chrome", 10)
        pipe(
            f"GT_Anti_Roll_Bar_{x}",
            [(x + .17, -.65, .16), (x + .24, -.48, .16), (x + .24, .48, .16), (x + .17, .65, .16)],
            .014,
            "spring",
        )
    CID = "ev_steering"
    rod("GT_Steering_Rack_Housing", (-1.43, -.42, .26), (-1.43, .42, .26), .036, "alloy", 24)
    rod("GT_EPAS_Assist_Motor", (-1.36, .16, .28), (-1.24, .16, .28), .045, "motor", 20)
    box("GT_EPAS_ECU_Module", (-1.30, .16, .335), (.09, .08, .035), "alloy", .006)
    for side in (-1, 1):
        rod(f"GT_Steering_Tie_Rod_{side}", (-1.43, side * .40, .26), (-1.32, side * .70, .24), .011, "chrome")
        for j in range(8):
            ring(f"GT_Rack_Gaiter_{side}_{j}", (-1.43, side * (.39 + j * .014), .26), .026 - j * .001, .006, "rubber", segments=16)
    pipe("GT_Steering_Column", [(-1.43, .25, .26), (-1.05, .34, .42), (-.58, .342, .74)], .018, "alloy")
    rod("GT_Steering_U_Joint_Lower", (-1.43, .25, .26), (-1.36, .27, .29), .026, "graphite", 14)
    rod("GT_Steering_U_Joint_Upper", (-1.08, .34, .41), (-1.01, .34, .44), .026, "graphite", 14)
    rod("GT_Steering_Column_Jacket", (-.92, .341, .50), (-.64, .342, .70), .028, "graphite", 16)
    box("GT_Steering_Firewall_Bracket", (-.88, .34, .46), (.08, .12, .06), "alloy", .008)
    rod("GT_Steering_Quick_Release_Hub", (-.61, .342, .72), (-.55, .342, .755), .034, "damper", 18)


def build_powertrain():
    global CID
    CID = "ev_motor"
    x, y, z = 1.48, .05, .36
    lathe_y(
        "GT_PMSM_Cast_Housing",
        (x, y, z),
        [(-.258, .155), (-.238, .225), (-.19, .235), (.19, .235), (.238, .225), (.258, .155)],
        "motor",
        56,
    )
    for i in range(13):
        lathe_y(
            f"GT_Motor_Cooling_Fin_{i}",
            (x, y, z),
            [(-.216 + i * .036, .233), (-.216 + i * .036, .248), (-.208 + i * .036, .248), (-.208 + i * .036, .233)],
            "alloy",
            56,
        )
    for side in (-1, 1):
        lathe_y(
            f"GT_Motor_End_Cover_{side}",
            (x, y + side * .257, z),
            [(-.012, .034), (-.012, .165), (.012, .165), (.012, .034)],
            "alloy",
            44,
        )
        for j in range(10):
            a = j * TAU / 10
            bolt(f"GT_Motor_Flange_Bolt_{side}_{j}", (x + .188 * math.cos(a), y + side * .239, z + .188 * math.sin(a)), (0, side, 0), .009)
    box("GT_Motor_Terminal_Block", (1.58, .05, .44), (.14, .38, .062), "graphite", .014)
    for j, dy in enumerate((.17, 0, -.17)):
        box(f"GT_Motor_Phase_Insulator_{j}", (1.62, .05 + dy, .45), (.055, .065, .048), "orange", .008)
        rod(f"GT_Motor_Phase_Stud_{j}", (1.62, .05 + dy, .39), (1.62, .05 + dy, .495), .015, "copper", 12)
    for dx in (-.15, .15):
        box(f"GT_Motor_Mount_{dx}", (x + dx, .05, .125), (.12, .47, .065), "graphite", .015)
        for dy in (-.17, .17):
            bolt(f"GT_Motor_Mount_Bolt_{dx}_{dy}", (x + dx, .05 + dy, .16))
    lathe_y(
        "GT_Reduction_Gearcase",
        (1.30, .05, .24),
        [(-.24, .058), (-.22, .14), (-.15, .16), (.15, .16), (.22, .14), (.24, .058)],
        "alloy",
        44,
    )
    for side in (-1, 1):
        rod(f"GT_Rear_Halfshaft_{side}", (1.32, side * .19, .18), (1.32, side * .728, .18), .020, "chrome", 20)
        for cy in (.26, .65):
            for i in range(7):
                ring(
                    f"GT_CV_Boot_{side}_{cy}_{i}",
                    (1.32, side * (cy + (i - 3) * .012), .18),
                    .039 - abs(i - 3) * .004,
                    .007,
                    "rubber",
                    segments=20,
                )

    elec_units = [
        ("ev_inverter", (1.02, .48, .42), (.44, .34, .12), "INVERTER · 3PH", "motor"),
        ("ev_dcdc", (-.62, .38, .40), (.32, .22, .10), "DC-DC · 12V", "alloy"),
        ("ev_obc", (-1.05, .05, .38), (.38, .28, .12), "OBC · 11KW", "motor"),
        ("ev_bms", (.72, .05, .42), (.30, .20, .075), "BMS MASTER", "graphite"),
        ("ev_vcu", (-.42, -.48, .46), (.30, .20, .08), "VCU · GATEWAY", "graphite"),
        ("ev_contactor_box", (1.05, .05, .42), (.34, .28, .14), "HV JUNCTION", "graphite"),
    ]
    for cid, loc, dims, badge_txt, base_mat in elec_units:
        CID = cid
        px, py, pz = loc
        sx, sy, sz = dims
        box(f"GT_{cid}_Cast_Body", (px, py, pz), (sx, sy, sz), base_mat, .018)
        box(f"GT_{cid}_Base_Flange", (px, py, pz - sz * .5 + .008), (sx + .035, sy + .035, .014), "alloy", .005)
        for i in range(10):
            fin_x = px - sx * .41 + i * sx * .82 / 9
            box(f"GT_{cid}_Heatsink_{i}", (fin_x, py, pz + sz * .5 + .009), (.008, sy * .78, .018), "alloy", .002)
        box(f"GT_{cid}_Badge_Plate", (px, py, pz + sz * .5 + .019), (sx * .52, sy * .36, .005), "gloss_black", .002)
        label(f"GT_{cid}_Badge_Text", badge_txt, (px, py, pz + sz * .5 + .023), .022, "lettering")
        for dx in (-sx * .44, sx * .44):
            for dy in (-sy * .42, sy * .42):
                bolt(f"GT_{cid}_Lid_Screw_{dx}_{dy}", (px + dx, py + dy, pz + sz * .5 + .004), radius=.006)
        box(
            f"GT_{cid}_Connector",
            (px, py - sy * .5 - .024, pz),
            (.078, .052, .046),
            "orange" if cid in ("ev_inverter", "ev_obc", "ev_dcdc", "ev_contactor_box") else "graphite",
            .008,
        )
        for j in range(3):
            rod(
                f"GT_{cid}_Connector_Pin_{j}",
                (px - .021 + j * .021, py - sy * .5 - .050, pz),
                (px - .021 + j * .021, py - sy * .5 - .058, pz),
                .004,
                "copper",
                8,
            )

    CID = "ev_battery_pack"
    px, py, pz = 0, .05, .26
    box("GT_Pack_Cast_Tub", (px, py, pz - .01), (1.92, 1.00, .15), "pack_case", .025)
    box("GT_Pack_Optical_Lid", (px, py, pz + .108), (1.88, .96, .020), "pack_cover", .008)
    box("GT_Pack_Center_Spine", (px, py, pz + .01), (1.84, .035, .11), "alloy", .006)
    for cx_rib in (-.45, 0, .45):
        box(f"GT_Pack_Cross_Partition_{cx_rib}", (cx_rib, py, pz + .01), (.024, .92, .105), "alloy", .005)
    for side in (-1, 1):
        box(f"GT_Pack_Flange_{side}", (0, .05 + side * .518, .253), (1.96, .065, .035), "alloy", .009)
        for j in range(12):
            bolt(f"GT_Pack_Sealing_Bolt_{side}_{j}", (-.88 + j * .16, .05 + side * .518, .277), radius=.007)
    for row in range(4):
        ry = -.30 + row * .20
        box(f"GT_Pack_Sense_FPC_{row}", (px, py + ry, pz + .068), (1.56, .018, .004), "orange", .001)
        for col in range(6):
            cx = -.75 + col * .30
            cy = py + ry
            box(f"GT_Cell_Module_{row}_{col}", (cx, cy, pz + .015), (.23, .135, .088), "cell_case", .012)
            box(f"GT_Cell_Top_Cap_{row}_{col}", (cx, cy, pz + .061), (.215, .12, .006), "gloss_black", .002)
            for dy in (-.036, .036):
                bolt(f"GT_Cell_Terminal_{row}_{col}_{dy}", (cx, cy + dy, pz + .067), radius=.0065)
            if col < 5:
                mid_x = cx + .15
                box(f"GT_Intercell_Busbar_{row}_{col}", (mid_x, cy + (.036 if (row + col) % 2 == 0 else -.036), pz + .068), (.095, .024, .007), "copper", .002)
    for tname, ox in (("HV_PLUS", .92), ("HV_MINUS", -.92)):
        rod(f"GT_Pack_Terminal_Post_{tname}", (px + ox, py, pz + .07), (px + ox, py, pz + .155), .032, "copper", 16)
        box(f"GT_Pack_Terminal_Collar_{tname}", (px + ox, py, pz + .115), (.085, .085, .028), "orange" if "PLUS" in tname else "graphite", .008)
    box("GT_Service_Disconnect", (-.90, -.43, .342), (.13, .09, .045), "orange", .01)
    box("GT_Pack_Spec_Plaque", (0, -.38, pz + .120), (.52, .085, .004), "gloss_black", .002)
    label("GT_Pack_Spec_Text", "96V · 14.4 kWh · Li-ION", (0, -.38, pz + .123), .024, "lettering")


def build_thermal_aux():
    global CID
    CID = "ev_radiator"
    box("GT_Radiator_Core", (-1.68, 0, .345), (.055, 1.12, .25), "graphite", .012)
    for i in range(54):
        box(f"GT_Radiator_Fin_{i}", (-1.714, -.52 + i * .0196, .345), (.013, .004, .22), "alloy", .001)
    for side in (-1, 1):
        box(f"GT_Radiator_End_Tank_{side}", (-1.68, side * .585, .345), (.08, .065, .27), "graphite", .02)
        cy = side * .276
        ring(f"GT_Radiator_Fan_Shroud_{side}", (-1.637, cy, .345), .112, .011, "graphite", "x", 48)
        rod(f"GT_Fan_Hub_{side}", (-1.64, cy, .345), (-1.61, cy, .345), .030, "graphite", 24)
        for j in range(9):
            a = j * TAU / 9
            verts = [(-1.62, cy + r * math.cos(aa), .345 + r * math.sin(aa)) for r, aa in [(.028, a), (.104, a + .35), (.104, a + .69), (.036, a + .4)]]
            mesh(f"GT_Fan_Blade_{side}_{j}", verts, [(0, 1, 2, 3)], "graphite", True)
    pipe("GT_Radiator_Feed_Hose", [(-1.68, .56, .42), (-1.35, .52, .36), (-.30, .54, .32), (.42, .52, .30), (.95, .48, .38)], .015, "rubber", 12)
    pipe("GT_Radiator_Return_Hose", [(-1.68, -.56, .28), (-1.35, -.52, .24), (-.20, -.54, .25), (.45, -.42, .30)], .015, "rubber", 12)
    rod("GT_Coolant_Reservoir", (-1.14, -.44, .38), (-1.14, -.44, .52), .060, "reservoir", 24)
    rod("GT_Reservoir_Cap", (-1.14, -.44, .52), (-1.14, -.44, .54), .042, "graphite", 16)

    CID = "ev_cooling"
    box("GT_Cooling_Chiller_Plate", (.45, -.42, .295), (.54, .17, .072), "alloy", .014)
    for k in range(8):
        box(f"GT_Chiller_Fin_{k}", (.24 + k * .06, -.42, .336), (.010, .145, .014), "alloy", .002)
    rod("GT_Electric_Coolant_Pump", (.36, -.52, .29), (.54, -.52, .29), .042, "motor", 24)
    pipe("GT_Pump_Inlet_Manifold", [(.20, -.42, .34), (.26, -.52, .29), (.36, -.52, .29)], .016, "rubber", 12)
    pipe("GT_Pump_Outlet_Manifold", [(.54, -.52, .29), (.64, -.52, .29), (.70, -.42, .34)], .016, "rubber", 12)
    pipe("GT_Motor_Cooling_Loop", [(.70, -.42, .34), (1.15, -.36, .32), (1.42, -.18, .35)], .013, "rubber", 10)
    label("GT_Cooling_Module_Label", "THERMAL CHILLER", (.45, -.42, .346), .022, "lettering")

    CID = "ev_aux_battery"
    box("GT_Auxiliary_Battery", (-1.34, .42, .38), (.24, .20, .18), "rubber", .012)
    box("GT_Auxiliary_Battery_Top", (-1.34, .42, .478), (.245, .205, .022), "graphite", .007)
    box("GT_Aux_Hold_Down_Bracket", (-1.34, .42, .392), (.255, .030, .195), "alloy", .005)
    for side in (-1, 1):
        rod(f"GT_Aux_Terminal_{side}", (-1.34 + side * .080, .42, .488), (-1.34 + side * .080, .42, .506), .011, "copper", 12)
        box(f"GT_Aux_Terminal_Cover_{side}", (-1.34 + side * .080, .42, .508), (.042, .050, .030), "red_lens" if side > 0 else "graphite", .008)
    label("GT_Aux_Battery_Label", "12 V  AUX", (-1.34, .42, .492), .024, "lettering")

    CID = "ev_charge_port"
    box("GT_Charge_Door", (1.63, .902, .464), (.175, .012, .137), "paint", .022)
    box("GT_Charge_Port_Recess", (1.63, .882, .464), (.152, .014, .117), "gloss_black", .022)
    rod("GT_Charge_Inlet", (1.63, .865, .477), (1.63, .894, .477), .039, "graphite", 32)
    ring("GT_Charge_Status_Ring", (1.63, .895, .477), .038, .003, "led_cyan", "y", 32)
    for i in range(5):
        a = i * TAU / 5
        rod(
            f"GT_Charge_Socket_{i}",
            (1.63 + .022 * math.cos(a), .890, .477 + .022 * math.sin(a)),
            (1.63 + .022 * math.cos(a), .899, .477 + .022 * math.sin(a)),
            .005,
            "copper",
            12,
        )


def build_interior():
    global CID
    CID = "ev_interior"
    box("GT_Cabin_Carpet", (.18, 0, .415), (1.84, 1.35, .036), "carpet", .028)
    for side in (-1, 1):
        box(f"GT_Inner_Door_Card_{side}", (.05, side * .755, .510), (1.50, .042, .185), "leather_dark", .025)
        box(f"GT_Door_Armrest_{side}", (0, side * .718, .550), (.52, .078, .046), "leather", .020)
        box(f"GT_Interior_Door_Pull_{side}", (-.34, side * .722, .578), (.13, .018, .028), "alloy", .010)
        ring(f"GT_Door_Speaker_{side}", (-.49, side * .730, .490), .058, .006, "alloy", segments=36)
        rod(f"GT_Speaker_Grille_{side}", (-.49, side * .734, .490), (-.49, side * .728, .490), .054, "perforation", 28)
        pipe(
            f"GT_Ambient_Door_Light_{side}",
            [(-.60, side * .730, .592), (.36, side * .730, .592), (.62, side * .734, .572)],
            .003,
            "led_cyan",
        )
        pipe(f"GT_Front_Seatbelt_{side}", [(.36, side * .705, 1.02), (.02, side * .58, .66), (-.05, side * .20, .49)], .013, "carpet", 4)
    CID = "ev_seats"
    for row, x in enumerate((-.10, .72)):
        for side in (-1, 1):
            y = side * .354
            box(f"GT_Seat_{row}_{side}_Base", (x, y, .485), (.43, .40, .105), "leather_dark", .042)
            box(f"GT_Seat_{row}_{side}_Cushion", (x - .025, y, .548), (.38, .286, .062), "leather", .024)
            for dy in (-.158, .158):
                box(f"GT_Seat_{row}_{side}_Cushion_Bolster_{dy}", (x, y + dy, .552), (.38, .07, .080), "leather", .028)
                box(f"GT_Seat_{row}_{side}_Back_Bolster_{dy}", (x + .195, y + dy, .755), (.092, .076, .355), "leather", .032, rotation=(0, -.12, 0))
            box(f"GT_Seat_{row}_{side}_Back", (x + .186, y, .742), (.087, .307, .340), "leather_dark", .034, rotation=(0, -.12, 0))
            box(f"GT_Seat_{row}_{side}_Insert", (x + .135, y, .755), (.028, .232, .272), "leather", .014, rotation=(0, -.12, 0))
            box(f"GT_Seat_{row}_{side}_Headrest", (x + .23, y, .972), (.106, .24, .108), "leather", .036)
            for dy in (-.064, .064):
                rod(f"GT_Headrest_Post_{row}_{side}_{dy}", (x + .21, y + dy, .89), (x + .23, y + dy, .955), .006, "chrome")
            for dy in (-.11, .11):
                pipe(f"GT_Seat_Stitch_{row}_{side}_{dy}", [(x - .17, y + dy, .581), (x + .11, y + dy, .581)], .0014, "stitch", 4)
            for j in range(5):
                box(f"GT_Seat_Pleat_{row}_{side}_{j}", (x - .14 + j * .057, y, .580), (.003, .226, .002), "leather_dark", 0)
            box(f"GT_Belt_Buckle_{row}_{side}", (x + .07, y - side * .22, .555), (.045, .028, .032), "red_lens", .006)
    for obj in C.objects:
        if obj.name.startswith("GT_Seat_1_") and any(s in obj.name for s in ("Back", "Insert")):
            obj.location.z -= .068
            obj.scale.z = .75
        if obj.name.startswith("GT_Seat_1_") and "Headrest" in obj.name:
            obj.location.z -= .168
        if obj.name.startswith("GT_Headrest_Post_1_"):
            obj.location.z -= .148


def finish_cockpit():
    global CID
    CID = "ev_cockpit"
    box("GT_Dashboard", (-.635, 0, .635), (.23, 1.38, .135), "leather_dark", .042)
    box("GT_Dash_Fascia", (-.525, 0, .665), (.028, 1.30, .082), "carbon", .014)
    box("GT_Driver_Display", (-.508, .342, .735), (.016, .31, .108), "gloss_black", .012)
    box("GT_Driver_Display_Glass", (-.498, .342, .735), (.003, .285, .088), "display", .010)
    label("GT_Instrument_Readout", "GT  /  CONCEPT", (-.494, .342, .744), .024, "led_white", (math.pi / 2, 0, math.pi / 2))
    label("GT_Instrument_Status", "E L E C T R I C", (-.493, .342, .712), .013, "led_cyan", (math.pi / 2, 0, math.pi / 2))
    box("GT_Center_Display", (-.502, -.105, .745), (.018, .255, .142), "gloss_black", .012)
    box("GT_Center_Display_Glass", (-.491, -.105, .745), (.003, .232, .122), "display", .008)
    label("GT_Center_Screen_Title", "E C S", (-.487, -.105, .775), .031, "led_white", (math.pi / 2, 0, math.pi / 2))
    label("GT_Center_Screen_Status", "HARDWARE STUDIO", (-.487, -.105, .742), .016, "led_cyan", (math.pi / 2, 0, math.pi / 2))
    for i in range(3):
        box(f"GT_Screen_Tile_{i}", (-.486, -.17 + i * .065, .706), (.002, .045, .016), "led_cyan", .003)
    for y in (-.55, .55):
        box(f"GT_Dash_Vent_{y}", (-.508, y, .672), (.009, .165, .036), "seam", .005)
        for j in range(6):
            box(f"GT_Vent_Blade_{y}_{j}", (-.502, y - .062 + j * .025, .672), (.006, .004, .025), "alloy", .001)
    pipe("GT_Dash_Ambient_Strip", [(-.506, y, .695) for y in (-.61, -.30, 0, .30, .61)], .0025, "led_cyan")
    ring("GT_Leather_Steering_Wheel", (-.365, .342, .745), .105, .012, "leather_dark", "x", 56)
    box("GT_Steering_Airbag", (-.355, .342, .745), (.048, .095, .068), "leather_dark", .020)
    for y, z in ((.248, .745), (.436, .745), (.342, .648)):
        rod("GT_Steering_Spoke", (-.355, .342, .745), (-.360, y, z), .012, "alloy")
    label("GT_Steering_Badge", "E", (-.328, .342, .750), .036, "chrome", (math.pi / 2, 0, math.pi / 2))
    for side in (-1, 1):
        box(f"GT_Paddle_{side}", (-.392, .342 + side * .075, .745), (.012, .024, .075), "graphite", .005)
        rod(f"GT_Column_Stalk_{side}", (-.45, .342 + side * .04, .742), (-.45, .342 + side * .145, .742), .007, "graphite")
    box("GT_Center_Console", (.008, 0, .525), (.88, .188, .155), "leather_dark", .028)
    box("GT_Console_Top", (.008, 0, .612), (.80, .176, .026), "carbon", .014)
    for x in (.13, .29):
        rod(f"GT_Cupholder_Well_{x}", (x, 0, .622), (x, 0, .626), .046, "seam", 28)
        ring(f"GT_Cupholder_Rim_{x}", (x, 0, .626), .046, .004, "chrome", "z", 36)
    rod("GT_Drive_Selector", (-.25, 0, .625), (-.25, 0, .648), .030, "alloy", 28)
    ring("GT_Selector_Light", (-.25, 0, .649), .026, .0022, "led_cyan", "z", 28)
    box("GT_Console_Armrest", (.44, 0, .635), (.22, .184, .062), "leather", .025)
    for y in (.26, .40):
        box(f"GT_Aluminium_Pedal_{y}", (-.59, y, .482), (.016, .062, .070), "alloy", .008, rotation=(0, .35, 0))
        for j in range(3):
            box(f"GT_Pedal_Grip_{y}_{j}", (-.575, y, .458 + j * .021), (.008, .048, .005), "rubber", .001)
    CID = "ev_interior"
    box("GT_Parcel_Shelf", (1.06, 0, .615), (.28, 1.24, .032), "carpet", .018)


def prepare_export(collection):
    """Bake and batch by component/material, retaining source part counts in GLB."""
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    batches = defaultdict(list)
    for obj in list(collection.objects):
        if obj.type not in {"MESH", "FONT", "CURVE"} or obj.name.startswith("Wire_"):
            continue
        evaluated = obj.evaluated_get(depsgraph)
        data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
        cid = obj.get("component_id", "ev_chassis")
        mat = data.materials[0] if len(data.materials) else M["alloy"]
        batches[(cid, mat.name)].append((obj, data, obj.matrix_world.copy(), mat))
    for (cid, matname), entries in batches.items():
        verts, faces, normals, smoothing = [], [], [], []
        for obj, data, world, mat in entries:
            offset = len(verts)
            verts.extend(tuple(world @ v.co) for v in data.vertices)
            faces.extend(tuple(offset + i for i in p.vertices) for p in data.polygons)
            smoothing.extend(p.use_smooth for p in data.polygons)
            normal_matrix = world.to_3x3().inverted().transposed()
            normals.extend(tuple((normal_matrix @ n.vector).normalized()) for n in data.corner_normals)
        data = bpy.data.meshes.new(f"{cid}_{matname}_batched")
        data.from_pydata(verts, [], faces)
        data.materials.append(entries[0][3])
        data.update()
        for polygon, smooth in zip(data.polygons, smoothing):
            polygon.use_smooth = smooth
        if len(normals) == len(data.loops):
            data.normals_split_custom_set(normals)
        obj = bpy.data.objects.new(f"GT_{cid}_{matname}", data)
        collection.objects.link(obj)
        obj["component_id"] = cid
        obj["source_parts_count"] = len(entries)
        obj["illustrative"] = True
        for original, baked, _, _ in entries:
            bpy.data.objects.remove(original, do_unlink=True)
            bpy.data.meshes.remove(baked)


def enhance_vehicle(collection, legacy_mats):
    global C, M, CID
    C = collection
    for obj in list(C.objects):
        if not obj.name.startswith("Wire_"):
            bpy.data.objects.remove(obj, do_unlink=True)
    colors = {
        "paint": ((.32, .43, .49), .82, .20),
        "alloy": ((.56, .61, .66), .88, .22),
        "chrome": ((.80, .84, .88), .98, .12),
        "graphite": ((.045, .055, .065), .58, .30),
        "gloss_black": ((.010, .014, .018), .32, .14),
        "carbon": ((.020, .025, .032), .38, .28),
        "rubber": ((.014, .016, .019), .0, .78),
        "tire": ((.020, .022, .026), .0, .84),
        "tire_letter": ((.065, .070, .076), .0, .80),
        "rotor": ((.42, .46, .50), .92, .32),
        "seam": ((.003, .004, .006), .0, .75),
        "fastener": ((.44, .48, .52), .88, .22),
        "caliper": ((.78, .045, .020), .42, .20),
        "spring": ((.82, .18, .035), .45, .28),
        "damper": ((.65, .48, .14), .82, .22),
        "motor": ((.26, .31, .36), .82, .28),
        "pack_case": ((.12, .28, .31), .68, .28),
        "pack_cover": ((.16, .48, .44), .12, .14),
        "cell_case": ((.18, .36, .44), .45, .32),
        "copper": ((.76, .34, .11), .92, .20),
        "orange": ((.96, .22, .03), .10, .34),
        "glass": ((.14, .24, .30), .10, .06),
        "mirror": ((.86, .90, .92), 1.0, .05),
        "leather": ((.28, .13, .068), .0, .64),
        "leather_dark": ((.022, .026, .030), .0, .70),
        "carpet": ((.014, .017, .020), .0, .92),
        "stitch": ((.62, .38, .19), .0, .74),
        "perforation": ((.018, .021, .025), .30, .62),
        "reservoir": ((.52, .58, .52), .0, .26),
        "lettering": ((.84, .88, .90), .25, .38),
        "red_lens": ((.68, .018, .012), .18, .18),
    }
    for name, (color, met, rough) in colors.items():
        material(name, color, met, rough)
    material("led_white", (.78, .92, 1.0), .0, .14, 4)
    material("led_red", (1.0, .015, .005), .0, .18, 3)
    material("led_cyan", (.025, .62, .75), .0, .24, 2.5)
    material("display", (.012, .028, .036), .0, .18, .45)
    build_body()
    build_canopy()
    build_lights()
    build_wheels_and_brakes()
    build_chassis_suspension()
    build_powertrain()
    build_thermal_aux()
    build_interior()
    finish_cockpit()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1
    bpy.context.scene.world = bpy.data.worlds.new("GT Studio World")
    bpy.context.scene.world.use_nodes = True
    bpy.context.scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.12, .14, .17, 1)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_distance = 5.5
                area.spaces.active.region_3d.view_location = (0, 0, .45)
                area.spaces.active.shading.type = "MATERIAL"
    counts = defaultdict(int)
    for obj in C.objects:
        counts[obj.get("component_id", "untagged")] += 1
    return {
        "design": "ECS GT / original concept coupe",
        "source_parts": len(C.objects),
        "component_parts": dict(sorted(counts.items())),
        "units": "meters",
        "generator_revision": "gt-2026-10-14-aaa",
        "scope": "Illustrative geometry around the existing teaching platform; not manufacturer CAD or validated vehicle hardware.",
    }
