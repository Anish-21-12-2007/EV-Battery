"""Animation-ready illustrative rear e-axle: two reduction stages and fixed brakes.

Mechanical topology and ratios follow the software model. This is educational
geometry; the dimensions are not manufacturing drawings or validated component data.
"""
import math
import bpy
import ev_detail_geometry as g

PIVOTS = {
    "MotorRotor": (1.48,.05,.36),
    "GearIntermediate": (1.32,.05,.36),
    "Differential": (1.32,.05,.18),
    "DriveShaft_L": (1.32,0,.18),
    "DriveShaft_R": (1.32,0,.18),
}

def gear(name,cx,cy,cz,pitch_radius,teeth,depth,mat="alloy",phase=0):
    # Explicit addendum, root and flanks; the educational mesh is intentionally
    # not offered as a production involute cutter or load-rated tooth profile.
    outer=[]
    module=2*pitch_radius/teeth
    for i in range(teeth):
        for t,r in [(0,-1.15),(.15,-1.15),(.28,.15),(.38,1),(.62,1),(.72,.15),(.85,-1.15)]:
            a=(i+t)*math.tau/teeth+phase
            rr=pitch_radius+r*module
            outer.append((a,rr))
    n=len(outer)
    hole=min(.024,pitch_radius*.4)
    verts=[]
    for y in (cy-depth/2,cy+depth/2):
        verts += [(cx+r*math.cos(a),y,cz+r*math.sin(a)) for a,r in outer]
        verts += [(cx+hole*math.cos(a),y,cz+hole*math.sin(a)) for a,r in outer]
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces += [(i,j,j+2*n,i+2*n),(i+n,i+3*n,j+3*n,j+n),
                  (i,i+n,j+n,j),(i+2*n,j+2*n,j+3*n,i+3*n)]
    obj=g.mesh(name,verts,faces,mat,False)
    return obj

def install(collection):
    g.C=collection
    for obj in list(collection.objects):
        name=obj.name
        if name=="GT_Reduction_Gearcase":
            bpy.data.objects.remove(obj,do_unlink=True)
            continue
        # Brake friction discs and hats are bolted to the hubs and rotate with
        # them. Calipers, brake hoses and uprights are deliberately excluded.
        for corner in ("fl","fr","rl","rr"):
            if name.startswith("GT_"+corner+"_") and any(part in name for part in ("Ventilated_Brake_Rotor","Rotor_Hat","Rotor_Drilling")):
                obj["component_id"]="ev_wheel_"+corner
        if name.startswith("GT_Rear_Halfshaft_"):
            obj["component_id"]="DriveShaft_L" if name.endswith("_1") else "DriveShaft_R"
        if name.startswith("GT_CV_Boot_"):
            obj["component_id"]="DriveShaft_R" if name.startswith("GT_CV_Boot_-1_") else "DriveShaft_L"

    # Fixed stator and copper end windings.
    g.CID="MotorStator"
    g.lathe_y("GT_Stator_Lamination_Stack",(1.48,.05,.36),[(-.18,.178),(-.18,.218),(.18,.218),(.18,.178),(-.18,.178)],"graphite",64)
    for j in range(24):
        a=j*math.tau/24
        x=1.48+.194*math.cos(a); z=.36+.194*math.sin(a)
        for y in (-.15,.25):
            g.box("GT_Stator_End_Winding_"+str((j,y)),(x,y,z),(.030,.066,.026),"copper",.009,rotation=(0,-a,0))
    g.CID="MotorRotor"
    g.lathe_y("GT_Rotor_Laminated_Core",(1.48,.05,.36),[(-.162,.025),(-.162,.157),(.162,.157),(.162,.025),(-.162,.025)],"rotor",64)
    g.rod("GT_Motor_Rotor_Shaft",(1.48,-.32,.36),(1.48,.33,.36),.024,"chrome",32)
    for j in range(8):
        a=j*math.tau/8
        x=1.48+.155*math.cos(a);z=.36+.155*math.sin(a)
        g.box("GT_Rotor_Magnet_"+str(j),(x,.05,z),(.035,.28,.022),"graphite" if j%2 else "motor",.004,rotation=(0,-a,0))
    gear("GT_Input_Pinion_15T",1.48,-.282,.36,.16*15/56,15,.024,"alloy")

    g.CID="GearIntermediate"
    gear("GT_First_Stage_Gear_41T",1.32,-.282,.36,.16*41/56,41,.024,"alloy")
    g.rod("GT_Intermediate_Shaft",(1.32,-.405,.36),(1.32,-.20,.36),.023,"chrome",24)
    gear("GT_Second_Stage_Pinion_20T",1.32,-.362,.36,.045,20,.028,"alloy")

    g.CID="Differential"
    gear("GT_Final_Drive_Gear_60T",1.32,-.362,.18,.135,60,.028,"alloy",math.pi/60)
    g.rod("GT_Differential_Carrier_Axis",(1.32,-.39,.18),(1.32,.28,.18),.030,"chrome",32)
    g.lathe_y("GT_Differential_Carrier",(1.32,.05,.18),[(-.16,.032),(-.15,.074),(-.10,.090),(.10,.090),(.15,.074),(.16,.032)],"motor",48)
    for side in (-1,1):
        g.ring("GT_Diff_Output_Flange_"+str(side),(1.32,side*.20,.18),.048,.012,"alloy",segments=32)
        for j in range(6):
            a=j*math.tau/6
            g.bolt("GT_Diff_Flange_Bolt_"+str((side,j)),(1.32+.049*math.cos(a),side*.21,.18+.049*math.sin(a)),(0,side,0),.005)

    # Stationary cast reduction cover has a stepped multi-lobe silhouette.
    g.CID="ev_motor"
    outline=[(1.12,.09),(1.14,.00),(1.26,-.008),(1.40,.018),(1.49,.12),
             (1.49,.26),(1.58,.31),(1.57,.42),(1.49,.48),(1.23,.49),(1.12,.40)]
    verts=[(x,y,z) for y in (-.405,-.225) for x,z in outline]
    n=len(outline)
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    case=g.mesh("GT_Two_Stage_Reduction_Case",verts,faces,"motor",False)
    b=case.modifiers.new("Cast case edge radii","BEVEL");b.width=.012;b.segments=3
    for i,(x,z) in enumerate(outline):
        g.bolt("GT_Gearcase_Perimeter_Bolt_"+str(i),(x,-.413,z),(0,-1,0),.006)
    for z in (.10,.17,.24,.31,.38):
        g.box("GT_Gearcase_Rib_"+str(z),(1.30,-.412,z),(.25,.012,.008),"alloy",.003)
    return {
        "architecture":"Rear permanent-magnet motor, two spur reduction stages, differential and CV halfshafts",
        "driven_axle":"rear", "reduction_ratio":8.2,
        "first_stage":{"input_teeth":15,"output_teeth":41,"ratio":41/15},
        "second_stage":{"input_teeth":20,"output_teeth":60,"ratio":3},
        "kinematics":"MotorRotor = wheel angle × 8.2; GearIntermediate = wheel angle × -3; Differential and both halfshafts = wheel angle in straight-line driving.",
        "rotation_axis_gltf":"local Z, shared orientation. Front wheels free-roll; all wheels use distance/radius.",
        "fixed_parts":"Motor casing, MotorStator, calipers, hoses, hub carriers, dampers and springs do not rotate with the wheels.",
        "limitations":"Illustrative component geometry and straight-line kinematics, not tooth-contact FEA, tyre dynamics, suspension dynamics or manufacturer CAD. Tooth profiles are visual approximations."
    }
