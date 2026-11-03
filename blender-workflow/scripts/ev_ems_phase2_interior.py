"""Sculpted 2+2 cabin and UV-mapped automotive display surfaces (metres)."""
import math
import bpy
from mathutils import Vector
import ev_detail_geometry as g

SEAT_POSITIONS={"Seat_FL":(.015,.34,.64),"Seat_FR":(.015,-.34,.64),"Seat_RL":(.65,.34,.61),"Seat_RR":(.65,-.34,.61)}
SCREEN_CONTRACT={
 "Screen_Cluster":{"group":"InstrumentCluster","material":"Display_Cluster","width_m":.32,"height_m":.10,"aspect":3.2,"recommended_canvas":[1280,400]},
 "Screen_Infotainment":{"group":"Infotainment","material":"Display_Infotainment","width_m":.28,"height_m":.175,"aspect":1.6,"recommended_canvas":[1024,640]},
}

def material(key,name,color,rough=.6,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value=(*color,1)
    p.inputs["Metallic"].default_value=metal;p.inputs["Roughness"].default_value=rough
    p.inputs["Specular IOR Level"].default_value=.25
    g.M[key]=m
    return m

def curve_sample(profiles,steps=6):
    out=[]
    for i in range(len(profiles)-1):
        a,b,c,d=profiles[max(0,i-1)],profiles[i],profiles[i+1],profiles[min(len(profiles)-1,i+2)]
        for j in range(steps):
            t=j/steps
            out.append(tuple(.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in range(4)))
    out.append(profiles[-1]);return out

def padded(name,profiles,mat,axis="x",center=(0,0,0),segments=40):
    """Loft superellipse sections with smoothly varying width and thickness.
    Profiles are (longitudinal, half-width, transverse centre, half-thickness).
    X loft uses Y width and Z thickness; Z loft uses Y width and X thickness.
    """
    v=[];f=[];ps=curve_sample(profiles)
    for p,w,c,h in ps:
        for j in range(segments):
            a=j*math.tau/segments
            co,si=math.cos(a),math.sin(a)
            yy=max(.001,w)*math.copysign(abs(co)**.57,co)
            t=max(.001,h)*math.copysign(abs(si)**.57,si)
            pt=(p,yy,c+t) if axis=="x" else (c+t,yy,p)
            v.append(tuple(pt[k]+center[k] for k in range(3)))
    for i in range(len(ps)-1):
        for j in range(segments):
            a=i*segments+j;b=i*segments+(j+1)%segments
            f.append((a,b,b+segments,a+segments))
    f += [tuple(reversed(range(segments))),tuple(range((len(ps)-1)*segments,len(ps)*segments))]
    obj=g.mesh(name,v,f,mat,True)
    # Recalculate outward normals for the two differently oriented loft axes.
    import bmesh
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    return obj

def seat(name,x,y,z,rear=False):
    g.CID=name
    sx=.78 if rear else 1;sz=.66 if rear else 1;sy=.91 if rear else 1
    def xyz(px,py,pz):return(x+px*sx,y+py*sy,z+(pz-.64)*sz)
    def shape(label,profiles,mat,axis):
        if axis=="x":profiles=[(a*sx,b*sy,z+(c-.64)*sz,d*sz) for a,b,c,d in profiles];center=(x,y,0)
        else:profiles=[(z+(a-.64)*sz,b*sy,x+c*sx,d*sx) for a,b,c,d in profiles];center=(0,y,0)
        return padded(name+"_"+label,profiles,mat,axis,center)
    shape("CushionShell",[(-.282,.16,.659,.018),(-.25,.214,.655,.044),(-.12,.221,.651,.048),(.105,.212,.657,.050),(.22,.18,.663,.029)],"seat_dark","x")
    shape("SculptedCushion",[(-.268,.126,.701,.012),(-.23,.145,.704,.026),(-.08,.147,.687,.024),(.11,.135,.69,.025),(.19,.11,.694,.012)],"seat_cognac","x")
    for side in (-1,1):
        bolster=padded(name+"_ThighBolster_"+str(side),[(-.267,.018,.705,.012),(-.20,.042,.711,.040),(-.02,.046,.705,.046),(.135,.043,.713,.047),(.215,.018,.705,.014)],"seat_cognac","x",(0,0,0))
        for v in bolster.data.vertices:
            v.co=xyz(v.co.x,side*.182+v.co.y,v.co.z)
    shape("BackShell",[(.681,.147,.215,.024),(.72,.199,.235,.052),(.85,.205,.265,.052),(1.00,.187,.313,.045),(1.058,.137,.328,.023)],"seat_dark","z")
    shape("LumbarInsert",[(.719,.106,.181,.012),(.77,.133,.190,.023),(.88,.131,.213,.027),(1.002,.121,.269,.020),(1.040,.097,.290,.012)],"seat_cognac","z")
    for side in (-1,1):
        bolster=padded(name+"_TorsoBolster_"+str(side),[(.702,.015,.191,.014),(.77,.044,.191,.044),(.89,.049,.221,.053),(1.016,.04,.283,.042),(1.056,.016,.307,.018)],"seat_cognac","z")
        for v in bolster.data.vertices:v.co=xyz(v.co.x,side*.16+v.co.y,v.co.z)
    shape("Headrest",[(1.068,.066,.353,.02),(1.083,.112,.357,.052),(1.16,.114,.366,.055),(1.195,.08,.367,.025)],"seat_cognac","z")
    for side in (-1,1):
        g.rod(name+"_HeadrestPost_"+str(side),xyz(.342,side*.063,1.025),xyz(.349,side*.063,1.095),.005,"chrome",12)
        # Double stitching is raised above upholstery, avoiding coplanar aliasing.
        for seam in (0,.005):
            pts=[xyz(xx,side*(.13+seam),zz) for xx,zz in [(-.24,.731),(-.14,.722),(0,.714),(.14,.720)]]
            g.pipe(name+"_CushionStitch_"+str((side,seam)),pts,.0011,"seat_stitch",5)
            pts=[xyz(xx,side*(.12+seam),zz) for xx,zz in [(.17,.745),(.18,.79),(.20,.87),(.24,.95),(.265,1.018)]]
            g.pipe(name+"_BackStitch_"+str((side,seam)),pts,.0011,"seat_stitch",5)
        railz=max(.589,z-.058)
        g.box(name+"_SeatRail_"+str(side),(x-.015,y+side*.139*sy,railz),(.39*sx,.027,.025),"graphite",.006)
        g.box(name+"_SeatRailFoot_"+str(side),(x+.06,y+side*.139*sy,railz-.018),(.10,.055,.020),"alloy",.004)
    g.box(name+"_BeltBuckle",xyz(.13,-.226 if y>0 else .226,.704),(.038,.032,.051),"graphite",.009)
    g.box(name+"_BeltRelease",xyz(.13,-.226 if y>0 else .226,.732),(.025,.025,.006),"red_lens",.002)
    for j in range(5):
        xx=-.19+j*.064
        g.pipe(name+"_CushionPleat_"+str(j),[xyz(xx,yy,.719 if xx<-.1 else .712) for yy in (-.106,-.05,0,.05,.106)],.001,"seat_dark",4)

def screen(name,x,y,z,width,height,group):
    g.CID=group
    g.box(name+"_RecessedBezel",(x-.021,y,z),(.028,width+.025,height+.023),"gloss_black",.012)
    g.box(name+"_RearHousing",(x-.030,y,z),(.028,width-.012,height-.008),"graphite",.010)
    verts=[(x,y-width/2,z-height/2),(x,y+width/2,z-height/2),(x,y+width/2,z+height/2),(x,y-width/2,z+height/2)]
    mat=bpy.data.materials.get(SCREEN_CONTRACT[name]["material"]) or bpy.data.materials.new(SCREEN_CONTRACT[name]["material"])
    mat.use_nodes=True;mat.node_tree.nodes.clear()
    p=mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    output=mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(p.outputs["BSDF"],output.inputs["Surface"])
    p=mat.node_tree.nodes.get("Principled BSDF")
    p.inputs["Roughness"].default_value=.24;p.inputs["Metallic"].default_value=0
    p.inputs["Emission Strength"].default_value=.7
    image=bpy.data.images.new(name+"_IdlePixels",4,4,alpha=False)
    image.generated_color=(.004,.009,.013,1);image.pack()
    tex=mat.node_tree.nodes.new("ShaderNodeTexImage");tex.image=image
    mat.node_tree.links.new(tex.outputs["Color"],p.inputs["Base Color"])
    mat.node_tree.links.new(tex.outputs["Color"],p.inputs["Emission Color"])
    data=bpy.data.meshes.new(name+"_UV0");data.from_pydata(verts,[],[(0,1,2,3)]);data.materials.append(mat);data.update()
    uv=data.uv_layers.new(name="UV0")
    for loop,coord in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):loop.uv=coord
    obj=bpy.data.objects.new(name,data);g.C.objects.link(obj)
    obj["component_id"]=group;obj["screen_id"]=name
    obj["uv_contract"]="UV0: bottom-left (0,0), top-right (1,1), viewed from cabin +X. CanvasTexture flipY=false."
    SCREEN_CONTRACT[name]["center_blender"]=[x,y,z]
    SCREEN_CONTRACT[name]["center_gltf"]=[x,z,-y]
    SCREEN_CONTRACT[name]["normal_gltf"]=[1,0,0]
    return obj

def cabin(collection):
    g.C=collection
    material("seat_cognac","Seat_Leather_Cognac",(.14,.067,.031),.67)
    material("seat_dark","Seat_Leather_Charcoal",(.014,.019,.022),.76)
    material("seat_stitch","Seat_ContrastStitch",(.34,.19,.087),.76)
    material("dash","Interior_SoftTouch",(.009,.014,.018),.72)
    material("trim","Interior_SatinMetal",(.25,.30,.31),.31,.65)
    for name,(x,y,z) in SEAT_POSITIONS.items():seat(name,x,y,z,name.startswith("Seat_R"))
    g.CID="Dashboard"
    # Continuous moulded dash; loft long axis transformed across the cabin.
    dash=padded("Dashboard_SculptedShell",[(-.68,.076,.817,.035),(-.58,.13,.813,.058),(0,.14,.811,.062),(.58,.13,.813,.058),(.68,.076,.817,.035)],"dash","x")
    for v in dash.data.vertices:
        xx,yy,zz=v.co;v.co=(-.615+yy,xx,zz)
    g.pipe("Dashboard_AmbientRail",[(-.477,y,.836) for y in (-.60,-.35,0,.35,.60)],.003,"led_cyan",8)
    for y in (-.55,.56):
        g.box("Dashboard_HiddenVent_"+str(y),(-.477,y,.807),(.009,.17,.032),"gloss_black",.009)
        for j in range(5):g.box("Dashboard_VentVane_"+str((y,j)),(-.47,y-.062+j*.031,.807),(.008,.005,.026),"trim",.002)
    g.CID="CenterConsole"
    padded("CenterConsole_ContinuousShell",[(-.49,.080,.687,.018),(-.36,.094,.695,.055),(.10,.094,.694,.052),(.37,.093,.704,.062),(.48,.075,.694,.030)],"dash","x")
    g.box("Console_Satin_Inlay",(.00,0,.752),(.57,.162,.013),"carbon",.012)
    for x in (.10,.265):
        g.rod("Console_CupWell_"+str(x),(x,0,.752),(x,0,.758),.046,"seam",40)
        g.ring("Console_CupLip_"+str(x),(x,0,.76),.046,.003,"trim","z",48)
    padded("Console_Armrest",[(.32,.055,.783,.014),(.35,.089,.79,.030),(.45,.085,.788,.026),(.485,.045,.78,.013)],"seat_dark","x")
    g.rod("Console_DriveSelector",(-.20,0,.754),(-.20,0,.780),.025,"trim",32)
    g.ring("Console_SelectorHalo",(-.20,0,.781),.023,.002,"led_cyan","z",32)
    screen("Screen_Cluster",-.447,.34,.963,.32,.10,"InstrumentCluster")
    screen("Screen_Infotainment",-.413,-.135,.934,.28,.175,"Infotainment")
    g.CID="Infotainment"
    g.box("Infotainment_IntegratedMount",(-.46,-.135,.829),(.075,.09,.075),"dash",.012)
    g.CID="SteeringWheel"
    centre=(-.284,.34,.920);pts=[]
    for i in range(81):
        a=i*math.tau/80;pts.append((centre[0],centre[1]+.153*math.cos(a),centre[2]+max(-.123,.153*math.sin(a))))
    g.pipe("SteeringWheel_D_LeatherRim",pts,.014,"seat_dark",12,True)
    g.box("SteeringWheel_AirbagHub",(-.267,.34,.914),(.047,.116,.072),"dash",.021)
    for y,z in ((.198,.924),(.482,.924),(.34,.796)):
        g.rod("SteeringWheel_SatinSpoke",(-.274,.34,.914),(-.281,y,z),.012,"trim",16)
    for y in (.238,.442):
        g.box("SteeringWheel_ControlPad_"+str(y),(-.262,y,.931),(.014,.040,.032),"gloss_black",.006)
        for zz in (.923,.937):g.box("SteeringWheel_Button_"+str((y,zz)),(-.253,y,zz),(.004,.021,.003),"chrome",.001)
    g.rod("SteeringWheel_ColumnHub",(-.56,.34,.884),(-.31,.34,.916),.025,"graphite",24)
    g.box("SteeringWheel_ZeroMark",(-.268,.34,1.071),(.014,.021,.008),"seat_stitch",.002)
    for side in (-1,1):
        g.box("SteeringWheel_Paddle_"+str(side),(-.318,.34+side*.109,.925),(.012,.032,.09),"trim",.007)
    g.label("SteeringWheel_Badge","A",(-.241,.34,.919),.029,"chrome",(math.pi/2,0,math.pi/2))
    g.CID="Interior"
    for y in (.27,.43):
        g.box("Cabin_Pedal_"+str(y),(-.64,y,.62),(.020,.063,.083),"alloy",.007,rotation=(0,.35,0))
        for j in range(4):g.box("Cabin_PedalGrip_"+str((y,j)),(-.622,y,.596+j*.019),(.009,.048,.005),"rubber",.001)
    for obj in collection.objects:
        if obj.name in {"Dashboard_AmbientRail","Console_SelectorHalo"}:obj["component_id"]="CabinLights"
    return {"seats":SEAT_POSITIONS,"screens":SCREEN_CONTRACT,"seating":"Sculpted low seating 2+2 coupe; compact rear seats are deliberately lower and shorter to clear the fastback glass."}
