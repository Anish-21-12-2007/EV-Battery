"""Reproducible, detailed educational circuit presentation in Blender.

Run: blender --background --python blender-workflow/scripts/build_circuit_lab.py
The unchanged final handoff supplies all logical connections and status text.
Every manufactured form, footprint, placement, colour and conductor diameter is
illustrative. No installed part identity or physical pinout is asserted here.
The .blend contains the complete proposed wire assembly; the optimized .glb
contains component geometry and terminal anchors, for runtime rerouting.
"""
import bpy, sys, json, csv, math, re, struct, hashlib, heapq
from pathlib import Path
from collections import defaultdict
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "assets" / "circuit"
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(HERE))
import ev_detail_geometry as geo

SOURCE = ROOT / "FINAL_EV_EMS_ENGINEERING_PACKAGE"
WIRE_FILE = SOURCE / "03_Circuit_Design" / "wiring_connections.csv"
BOM_FILE = SOURCE / "02_Component_Details" / "component_list.csv"
with WIRE_FILE.open(encoding="utf-8-sig", newline="") as f:
    WIRES = list(csv.DictReader(f))
with BOM_FILE.open(encoding="utf-8-sig", newline="") as f:
    BOM = {row["ID"]: row for row in csv.DictReader(f)}
PINS = defaultdict(list)
for row in WIRES:
    for kind in ("source", "destination"):
        cid, pin = row[kind + "_component"], row[kind + "_terminal"]
        if pin not in PINS[cid]: PINS[cid].append(pin)
assert len(WIRES) == 60 and len(PINS) == 33 and sum(map(len, PINS.values())) == 87

def safe(s): return re.sub(r"[^A-Za-z0-9_]", "_", s.replace('+','_POS').replace('-','_NEG'))
def gltf(v): return [round(v[0], 6), round(v[2], 6), round(-v[1], 6)]

# All coordinates are normalized presentation scale, NOT millimetre drawings.
# The bed deliberately enlarges resistors and labels for educational inspection.
LAYOUT = {
    "BAT1":(-3.55,2.20,1.05,.86,"Battery / 12 V candidate","battery"),
    "F1":(-2.24,2.42,.66,.46,"Main fuse / rating TBD","fuse"),
    "SW1":(-1.20,2.42,.65,.46,"Master switch / DC rating TBD","switch"),
    "BUS+":(-.06,2.36,.89,.60,"Positive distribution","bus"),
    "FL":(1.16,2.53,.62,.45,"Light fuse / rating TBD","fuse"),
    "S_L":(2.30,2.40,.76,.66,"Light sensor / type TBD","sensor_tbd"),
    "L1":(3.53,2.39,.80,.68,"12 V lamp / identity TBD","lamp"),
    "FM":(1.16,1.16,.62,.45,"Motor fuse / rating TBD","fuse"),
    "S_M":(2.30,1.08,.76,.68,"ACS712-30A / IC candidate","acs"),
    "MDRV":(3.53,1.05,.83,.73,"Motor controller / topology TBD","driver"),
    "M1":(3.83,-.23,.88,.63,"Motor / identity TBD","motor"),
    "F2":(-1.57,.70,.66,.46,"Electronics fuse / rating TBD","fuse"),
    "U_BUCK_BOARD":(-.32,.70,1.02,.77,"LM2596 / module unverified","buck"),
    "JGND":(-3.36,.53,1.20,.67,"Star return / quiet reference","ground"),
    "U_I_L":(1.05,-.27,.73,.60,"Light conditioner / TBD","conditioner"),
    "C_BYP_M":(2.07,-.27,.45,.48,"100 nF / conditional","capacitor"),
    "C_FILTER_M":(2.73,-.27,.45,.48,"FILTER / value TBD","capacitor"),
    "R_LH":(-3.78,-1.08,.65,.40,"68 kOhm / 1% assumed","resistor"),
    "NODE_VL":(-2.79,-1.10,.44,.40,"Light voltage node","node"),
    "R_LL":(-2.79,-2.08,.65,.40,"10 kOhm / 1% assumed","resistor"),
    "C_L":(-3.78,-2.08,.50,.45,"100 nF / assumed","capacitor"),
    "R_MH":(-1.85,-1.08,.65,.40,"27 kOhm / 1% conditional","resistor"),
    "NODE_IM":(-.87,-1.10,.44,.40,"Motor current node","node"),
    "R_ML":(-.87,-2.08,.65,.40,"20 kOhm / 1% conditional","resistor"),
    "C_M":(-1.85,-2.08,.50,.45,"100 nF / assumed","capacitor"),
    "R_VH":(.08,-1.08,.65,.40,"68 kOhm / 1% assumed","resistor"),
    "NODE_VM":(1.06,-1.10,.44,.40,"Motor voltage node","node"),
    "R_VL":(1.06,-2.08,.65,.40,"10 kOhm / 1% assumed","resistor"),
    "C_V":(.08,-2.08,.50,.45,"100 nF / assumed","capacitor"),
    "U_ESP":(2.74,-1.76,1.29,1.40,"Classic ESP32 / carrier TBD","esp"),
    "U_OLED_BOARD":(-3.51,-3.09,1.02,.59,"Optional OLED / pinout TBD","oled"),
    "T1_PROBE":(-1.94,-3.09,1.17,.48,"Optional DS18B20 / leads TBD","probe"),
    "TVS1":(-2.59,1.47,.64,.39,"TVS footprint / unresolved","tvs"),
    "RP1":(-.28,-3.12,.73,.53,"Reverse polarity / unselected","protection"),
    "D1":(.94,-3.12,.70,.53,"Motor suppression / conditional","diode"),
    "RLY1":(2.44,-3.12,1.03,.60,"Legacy relay / UNWIRED","relay"),
}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "NONE"
components = bpy.data.collections.new("Circuit components - editable candidate geometry")
scene.collection.children.link(components)
wiring = bpy.data.collections.new("60 source rows - proposed wire assembly")
scene.collection.children.link(wiring)
stage = bpy.data.collections.new("Presentation bed and lighting")
scene.collection.children.link(stage)
geo.C = components
geo.M = {}
for name, color, metallic, rough in [
    ("pcb",(.018,.16,.13),.12,.34), ("pcbblue",(.024,.16,.26),.12,.34),
    ("black",(.021,.026,.029),.02,.36), ("rubber",(.018,.021,.025),0,.7),
    ("label",(.78,.87,.82),.02,.47), ("white",(.94,.96,.91),.01,.45),
    ("muted",(.29,.44,.44),.05,.56), ("gold",(.66,.43,.12),.72,.25),
    ("copper",(.61,.25,.11),.78,.28), ("silver",(.56,.64,.66),.85,.25),
    ("darkmetal",(.13,.18,.19),.68,.3), ("blue",(.02,.20,.35),.05,.36),
    ("red",(.59,.055,.034),.1,.36), ("amber",(.79,.43,.075),.12,.43),
    ("green",(.035,.24,.15),.05,.4), ("ceramic",(.50,.24,.085),.02,.57),
    ("resbody",(.17,.42,.52),.04,.43), ("band_brown",(.12,.047,.016),.02,.5),
    ("band_black",(.007,.009,.009),0,.5), ("band_red",(.58,.015,.013),0,.5),
    ("band_blue",(.025,.07,.50),0,.5), ("band_gray",(.34,.38,.39),.03,.5),
    ("band_violet",(.31,.025,.40),0,.5), ("boardbed",(.025,.055,.060),.15,.45),
    ("wire_power",(.66,.035,.020),.1,.37), ("wire_ground",(.022,.029,.035),.04,.55),
    ("wire_logic",(.87,.35,.016),.07,.39), ("wire_analog",(.018,.48,.46),.08,.38),
    ("wire_comm",(.075,.21,.62),.08,.38), ("wire_3v3",(.45,.15,.52),.08,.4),
    ("wire_motor",(.51,.22,.065),.07,.42), ("wire_unresolved",(.67,.34,.11),.08,.4),
]: geo.material(name,color,metallic,rough)
geo.material("screen",(.035,.14,.17),.03,.23,.35)
geo.material("screen_text",(.31,.9,.79),.05,.34,.6)
geo.material("lamp",(.88,.91,.77),.02,.28,1.1)

CURRENT = None
def box(n,p,s,m="black",bevel=.012): return geo.box(n,p,s,m,bevel)
def rod(n,a,b,r,m="silver",seg=16): return geo.rod(n,a,b,r,m,seg)
def cylinder(n,p,r,h,m="silver",seg=24):
    return rod(n,(p[0],p[1],p[2]-h/2),(p[0],p[1],p[2]+h/2),r,m,seg)
def text(n,s,p,size=.048,m="label",align="CENTER"):
    curve=bpy.data.curves.new(n,"FONT");curve.body=s;curve.size=size
    curve.align_x=align;curve.align_y="CENTER";curve.extrude=.00025;curve.resolution_u=2
    obj=bpy.data.objects.new(n,curve);geo.C.objects.link(obj);obj.location=p
    obj.data.materials.append(geo.M[m]);obj["component_id"]=geo.CID;obj["illustrative"]=True
    return obj
def screw(n,x,y,z,r=.030):
    cylinder(n+" washer",(x,y,z-.006),r*1.3,.012,"darkmetal",20)
    cylinder(n+" head",(x,y,z+.010),r,.030,"silver",16)
    box(n+" slot",(x,y,z+.0255),(r*1.36,.008,.003),"black",.001)
    box(n+" slot cross",(x,y,z+.0255),(.008,r*1.36,.003),"black",.001)
def pcb(n,w,h,mat="pcb",z=.105):
    box(n+" PCB",(0,0,z),(w,h,.035),mat,.022)
    for x in (-w/2+.058,w/2-.058):
        for y in (-h/2+.058,h/2-.058):
            cylinder(n+" standoff",(x,y,z-.046),.027,.060,"darkmetal",12)
            cylinder(n+" mounting annulus",(x,y,z+.0185),.029,.003,"gold",20)
            cylinder(n+" mounting hole",(x,y,z+.020),.017,.004,"black",16)
def smd(n,x,y,w=.065,h=.033,z=.137):
    box(n,(x,y,z),(w,h,.025),"black",.005)
    for dx in (-w/2,w/2):box(n+" termination",(x+dx,y,z),(.012,h+.002,.025),"silver",.002)
def chip(n,x,y,w=.17,h=.20,z=.145,pins=4):
    box(n+" body",(x,y,z),(w,h,.055),"black",.010)
    for side in (-1,1):
        for i in range(pins):
            yy=y-h*.37+i*h*.74/max(1,pins-1)
            box(n+" IC lead",(x+side*(w/2+.030),yy,z-.012),(.061,.018,.018),"silver",.003)
    cylinder(n+" index",(x-w*.30,y+h*.29,z+.029),.010,.003,"muted",10)
def electro(n,x,y,r=.086,h=.21,z=.132):
    cylinder(n+" sleeve",(x,y,z+h/2),r,h,"black",28)
    cylinder(n+" top",(x,y,z+h+.001),r*.93,.010,"silver",28)
    box(n+" vent",(x,y,z+h+.007),(r*1.25,.005,.002),"darkmetal",.001)
    box(n+" vent cross",(x,y,z+h+.007),(.005,r*1.25,.002),"darkmetal",.001)
    box(n+" polarity stripe",(x,y-r+.004,z+h*.50),(r*.5,.009,h*.87),"muted",.002)
def terminal_block(n,x,y,z=.16,w=.11):
    box(n+" housing",(x,y,z),(w,w,.095),"blue",.012)
    box(n+" wire throat",(x,y-w/2-.001,z-.009),(w*.49,.006,.032),"black",.003)
    screw(n,x,y,z+.044,.021)
def header(n,x,y,count=8,step=.070):
    for i in range(count):
        yy=y+(i-(count-1)/2)*step
        box(n+" socket",(x,yy,.15),(.063,.063,.052),"black",.005)
        box(n+" gold pin",(x,yy,.208),(.019,.019,.079),"gold",.002)
        box(n+" solder foot",(x,yy,.126),(.038,.038,.012),"silver",.002)

def body_battery():
    box("Battery case",(0,0,.40),(.92,.69,.65),"black",.055)
    box("Battery lid",(0,0,.73),(.96,.72,.083),"darkmetal",.025)
    for x in (-.35,.35): box("Battery moulding seam",(x,0,.40),(.022,.70,.57),"darkmetal",.008)
    box("Battery top label",(0,-.025,.776),(.61,.39,.009),"label",.014)
    text("Battery title","BATTERY",(0,.045,.783),.078,"black")
    text("Battery spec","12 V / 7.6 Ah",(0,-.058,.783),.057,"black")
    text("Battery caveat","CANDIDATE - ID UNVERIFIED",(0,-.142,.783),.031,"black")
    for x in (-.29,.29):
        box("Battery post shroud",(x,.25,.783),(.13,.14,.09),"red" if x<0 else "black",.014)
        cylinder("Battery terminal stud",(x,.25,.856),.037,.072,"silver",20)
        screw("Battery stud cap",x,.25,.882,.030)
    text("Battery plus","+",(-.42,.25,.781),.085,"red")
    text("Battery minus","-",(.42,.25,.781),.085,"label")
def body_fuse():
    box("Fuse moulded holder",(0,0,.135),(.55,.28,.15),"black",.04)
    box("Fuse inspection window",(0,0,.213),(.27,.19,.010),"label",.022)
    rod("Ceramic cartridge",(-.14,0,.227),(.14,0,.227),.048,"white",24)
    for side in (-1,1):
        rod("Fuse metal cap",(side*.115,0,.227),(side*.180,0,.227),.054,"silver",20)
        screw("Fuse clamp",side*.231,0,.177,.028)
    text("No fuse rating","TBD",(0,-.06,.264),.042,"black")
def body_switch():
    box("Switch enclosure",(0,0,.145),(.39,.32,.19),"black",.035)
    box("Rocker surround",(0,0,.252),(.27,.265,.043),"darkmetal",.03)
    o=box("Rocker paddle",(0,0,.286),(.215,.23,.052),"red",.028);o.rotation_euler.x=.14
    text("Rocker ON","I",(0,.061,.330),.065,"white")
    text("Rocker OFF","O",(0,-.065,.313),.042,"white")
    for side in (-1,1):box("Switch lug",(side*.22,0,.13),(.11,.063,.021),"silver",.006)
def body_bus(ground=False):
    box("Busbar insulated base",(0,0,.112),(1.09 if ground else .83,.38,.12),"black" if ground else "red",.020)
    if ground:
        # The two metal strips remain separate. W053 is the explicit Kelvin tie.
        for x in (-.29,.29):box("Separate ground bar",(x,0,.186),(.38,.20,.035),"copper",.013)
        text("STAR_RETURN label","STAR",(-.30,-.15,.180),.045,"label")
        text("LOGIC_GND label","LOGIC",(.30,-.15,.180),.045,"label")
    else:box("Positive copper bus",(0,0,.186),(.71,.20,.035),"copper",.012)
    for x in ((-.44,-.29,-.14,.14,.29,.44) if ground else (-.29,-.145,0,.145,.29)):
        screw("Busbar binding screw",x,0,.205,.033)
def body_esp():
    pcb("ESP32 carrier",.73,1.12,"pcb",.106)
    box("WROOM substrate",(0,.195,.145),(.46,.66,.035),"pcbblue",.008)
    box("RF shield",(0,.16,.195),(.43,.43,.078),"silver",.012)
    text("Shield marking","ESP32",(0,.210,.236),.082,"darkmetal")
    text("Shield candidate","WROOM candidate",(0,.106,.236),.031,"darkmetal")
    # Recognisable meander antenna, without inventing a functional trace netlist.
    antenna=[(-.18,.415),(-.18,.49),(-.12,.49),(-.12,.415),(-.06,.415),(-.06,.49),(0,.49),(0,.415),(.06,.415),(.06,.49),(.12,.49),(.12,.415),(.18,.415)]
    for a,b in zip(antenna,antenna[1:]):rod("RF antenna motif",(*a,.167),(*b,.167),.009,"gold",8)
    header("Left header",-.30,0,14,.071)
    header("Right header",.30,0,14,.071)
    box("USB connector shell",(0,-.501,.171),(.215,.160,.100),"silver",.015)
    box("USB opening",(0,-.583,.173),(.16,.004,.056),"black",.01)
    box("USB tongue",(0,-.585,.165),(.12,.008,.011),"darkmetal",.003)
    for i in range(5):box("USB contact",(-.04+i*.02,-.590,.173),(.008,.009,.009),"gold",.001)
    chip("USB UART",0,-.244,.13,.19,.153,7)
    for x in (-.196,.196):
        box("BOOT EN button base",(x,-.432,.159),(.085,.095,.050),"silver",.010)
        cylinder("BOOT EN button",(x,-.432,.194),.023,.028,"black",14)
    for x,y in [(-.12,-.08),(.14,-.10),(-.10,-.37),(.14,-.32),(.11,.40)]:smd("Carrier passive",x,y,.07,.03)
    text("Carrier label","HEADER MAP UNVERIFIED",(0,-.355,.158),.023,"label")
def body_buck():
    pcb("DC DC",.83,.57,"pcbblue")
    electro("Input electrolytic",-.27,.11,.081,.22)
    electro("Output electrolytic",.29,-.08,.076,.19)
    cylinder("Inductor ferrite",(.12,.085,.205),.137,.12,"darkmetal",32)
    for i in range(14):
        a=i*math.tau/14
        # Coil winding loops around the ferrite toroid.
        pts=[]
        for j in range(13):
            b=j*math.tau/12;r=.095+.044*math.cos(b)
            pts.append((.12+r*math.cos(a),.085+r*math.sin(a),.208+.067*math.sin(b)))
        geo.pipe("Inductor copper winding",pts,.010,"copper",6,False)
    chip("LM2596 candidate",-.15,-.10,.20,.19,.17,3)
    text("LM2596 marking","LM2596",(-.15,-.10,.200),.029,"label")
    box("Trim potentiometer",(.09,-.182,.187),(.115,.105,.10),"blue",.009)
    cylinder("Trimmer adjuster",(.09,-.182,.246),.027,.02,"gold",16)
    box("Trimmer slot",(.09,-.182,.258),(.04,.006,.003),"black",.001)
    for x in (-.25,.0):smd("Buck diode passive",x,-.22,.085,.038,.149)
def body_acs(tbd=False):
    pcb("Current sensor",.62,.48,"pcbblue")
    chip("Sensor IC",0,.025,.18,.22,.156,4)
    text("Sensor marking","TYPE TBD" if tbd else "ACS712",(0,.028,.185),.031,"label")
    for x in (-.21,.21):
        terminal_block("Primary terminal",x,.14,.174,.125)
        box("Primary copper pad",(x,.019,.125),(.075,.13,.009),"copper",.003)
    for i,x in enumerate((-.16,0,.16)):
        box("Signal socket",(x,-.185,.165),(.060,.07,.072),"black",.006)
        box("Signal contact",(x,-.185,.208),(.017,.017,.040),"gold",.002)
    smd("Sensor capacitor",.18,-.085,.055,.030)
    text("Board caveat","BOARD UNVERIFIED",(0,-.101,.127),.027,"label")
def body_driver():
    pcb("Controller",.72,.55,"pcb")
    box("Heatsink base",(.05,0,.19),(.33,.37,.065),"darkmetal",.009)
    for i in range(6):box("Heatsink fin",(-.10+i*.061,0,.265),(.022,.37,.15),"silver",.006)
    electro("Driver bus capacitor",-.24,.075,.052,.16)
    chip("Controller logic",-.22,-.145,.105,.12,.15,3)
    text("Driver caveat","TOPOLOGY TBD",(.01,-.235,.128),.036,"label")
def body_motor():
    rod("Motor barrel",(-.29,0,.255),(.22,0,.255),.185,"silver",36)
    rod("Motor rear cap",(-.34,0,.255),(-.275,0,.255),.19,"black",28)
    rod("Motor nose",(.20,0,.255),(.28,0,.255),.16,"darkmetal",28)
    rod("Motor bearing",(.25,0,.255),(.325,0,.255),.078,"silver",20)
    rod("Motor shaft",(.30,0,.255),(.46,0,.255),.033,"silver",20)
    box("Motor shaft key",(.405,0,.288),(.09,.018,.012),"darkmetal",.003)
    for i in range(12):
        a=i*math.tau/12
        rod("Motor seam",(-.24,.188*math.cos(a),.255+.188*math.sin(a)),(.18,.188*math.cos(a),.255+.188*math.sin(a)),.004,"darkmetal",6)
    for x in (-.19,.15):
        box("Motor mounting foot",(x,0,.065),(.12,.48,.065),"darkmetal",.016)
        for y in (-.21,.21):screw("Motor mounting bolt",x,y,.1,.021)
    text("Motor identity","MOTOR - TYPE TBD",(0,0,.448),.040,"black")
def body_lamp():
    box("Lamp heatsink base",(0,0,.17),(.52,.42,.20),"darkmetal",.027)
    for i in range(9):box("Lamp cooling fin",(-.24+i*.06,0,.205),(.02,.43,.20),"silver",.007)
    cylinder("Lamp reflector rim",(0,0,.345),.263,.125,"darkmetal",40)
    cylinder("Lamp reflector",(0,0,.414),.237,.013,"silver",40)
    cylinder("Lamp diffuser",(0,0,.427),.200,.017,"lamp",40)
    for x in (-.095,0,.095):
        for y in (-.095,0,.095):
            box("Lamp LED package",(x,y,.44),(.045,.045,.014),"white",.006)
            box("Lamp phosphor",(x,y,.451),(.026,.026,.005),"amber",.002)
def body_resistor(cid):
    rod("Resistor lead",(-.28,0,.157),(.28,0,.157),.009,"silver",12)
    rod("Metal film resistor",(-.15,0,.157),(.15,0,.157),.056,"resbody",24)
    value=68000 if cid in ("R_LH","R_VH") else 10000 if cid in ("R_LL","R_VL") else 27000 if cid=="R_MH" else 20000
    bands={68000:["blue","gray","black","red","brown"],10000:["brown","black","black","red","brown"],27000:["red","violet","black","red","brown"],20000:["red","black","black","red","brown"]}[value]
    for x,band in zip((-.118,-.068,-.018,.039,.114),bands):
        rod("Resistor colour band",(x-.009,0,.157),(x+.009,0,.157),.058,"band_"+band,24)
    for x in (-.28,.28):cylinder("Resistor solder eye",(x,0,.101),.030,.030,"gold",16)
def body_capacitor(cid):
    z=.18
    for x in (-.080,.080):
        # A continuous formed lead joins the disc to the existing logical
        # contact post. The extra bend does not introduce a new terminal/net.
        side=1 if x>0 else -1
        points=[(side*xx,-.025,zz) for xx,zz in [(.080,z),(.080,.115),
            (.082,.105),(.088,.099),(.100,.096),(.142,.096),
            (.151,.099),(.160,.107),(.170,.113)]]
        geo.pipe("Capacitor lead",points,.009,"silver",10)
    # A small standing ceramic disc, with two separate leads.
    rod("Ceramic disc",(0,-.043,z+.053),(0,.018,z+.053),.093,"ceramic",24)
    text("Capacitor body value","TBD" if cid=="C_FILTER_M" else "104",(0,-.079,z+.061),.047,"white").rotation_euler.x=math.pi/2
def body_node():
    cylinder("Junction insulation",(0,0,.09),.12,.10,"black",24)
    cylinder("Junction brass post",(0,0,.17),.050,.11,"gold",20)
    screw("Junction binding screw",0,0,.221,.038)
def body_oled():
    pcb("Optional OLED",.81,.42,"pcbblue")
    box("OLED glass",(0,0,.139),(.62,.285,.018),"black",.012)
    box("OLED emissive area",(0,0,.150),(.55,.235,.004),"screen",.006)
    text("OLED demo title","EV-EMS",(0,.048,.154),.050,"screen_text")
    text("OLED demo caption","OPTIONAL / PINOUT TBD",(0,-.056,.154),.024,"screen_text")
    for i in range(4):
        x=-.12+i*.08
        box("OLED header insulator",(x,.215,.148),(.064,.09,.042),"black",.005)
        box("OLED pin",(x,.231,.194),(.017,.02,.07),"gold",.002)
def body_probe():
    rod("Probe stainless tube",(-.03,0,.145),(.40,0,.145),.06,"silver",28)
    rod("Probe end cap",(.39,0,.145),(.43,0,.145),.058,"silver",24)
    rod("Probe strain relief",(-.19,0,.145),(.0,0,.145),.051,"rubber",24)
    for i in range(5):rod("Probe boot rib",(-.17+i*.033,0,.145),(-.152+i*.033,0,.145),.056,"black",20)
    geo.pipe("Probe cable",[(-.19,0,.145),(-.31,0,.14),(-.37,.06,.12),(-.44,.08,.12)],.028,"rubber",10)
    text("Probe caveat","LEAD COLOURS UNVERIFIED",(0,-.18,.078),.029,"amber")
def body_placeholder(kind):
    pcb("Unresolved fixture",.57 if kind!="relay" else .86,.34 if kind!="relay" else .43,"pcbblue")
    if kind=="relay":
        box("Legacy relay housing",(-.10,0,.27),(.36,.29,.29),"blue",.017)
        text("Relay housing label","RELAY",(-.10,.02,.419),.060,"label")
        text("Relay housing status","UNWIRED",(-.10,-.076,.419),.031,"label")
        for y in (-.11,0,.11):terminal_block("Unwired relay terminal",.285,y,.176,.10)
        smd("Unwired relay resistor",-.31,.01,.08,.03)
        chip("Unwired relay driver",.13,0,.065,.16,.15,2)
    elif kind in ("diode","tvs"):
        rod("Unselected diode form",(-.20,0,.18),(.20,0,.18),.008,"silver",12)
        rod("Diode illustrative package",(-.10,0,.18),(.10,0,.18),.042,"black",20)
        rod("Diode band",(.055,0,.18),(.080,0,.18),.044,"label",20)
        text("Diode selection status","PART TBD",(0,-.126,.128),.036,"amber")
    elif kind=="conditioner":
        chip("Unresolved interface footprint",0,0,.19,.16,.153,4)
        text("Interface selection status","CIRCUIT TBD",(0,-.13,.128),.034,"amber")
    else:
        box("Unselected protection footprint",(0,0,.14),(.24,.16,.022),"darkmetal",.005)
        for i in range(3):box("Unassigned protection pad",(-.12+i*.12,-.096,.130),(.06,.038,.012),"gold",.003)
        text("Protection selection status","DEVICE TBD",(0,.125,.128),.035,"amber")

def terminals_for(cid,w,h):
    pins=PINS.get(cid,[])
    if cid=="BAT1":return {"BAT+":((-.29,.25,.925),(0,1,0)),"BAT-":((.29,.25,.925),(0,1,0))}
    if cid=="JGND":return {"STAR_RETURN":((-.29,0,.25),(0,1,0)),"LOGIC_GND":((.29,0,.25),(0,-1,0))}
    if cid.startswith("NODE_"):return {"NODE":((0,0,.27),(1,0,0))}
    if cid.startswith("R_"):return {"A":((-.28,0,.169),(-1,0,0)),"B":((.28,0,.169),(1,0,0))}
    if cid in ("C_L","C_M","C_V","C_BYP_M","C_FILTER_M"):
        return {"A":((-.17,-.025,.125),(-1,0,0)),"B":((.17,-.025,.125),(1,0,0))}
    if cid in ("F1","FL","FM","F2"):return {"IN":((-.24,0,.219),(-1,0,0)),"OUT":((.24,0,.219),(1,0,0))}
    if cid=="SW1":return {"IN":((-.26,0,.175),(-1,0,0)),"OUT":((.26,0,.175),(1,0,0))}
    if cid=="BUS+":
        return {pin:((-.29+i*.145,0,.25),(0,1 if i<2 else -1,0)) for i,pin in enumerate(pins)}
    if cid=="U_ESP":
        sides=[['5V_IN','GND','GPIO32','GPIO33','GPIO34','GPIO35'],['3V3','GPIO21','GPIO22','GPIO4']]
        result={}
        for side,names in enumerate(sides):
            for i,pin in enumerate(names):result[pin]=(((-1 if side==0 else 1)*.53,.40-i*.16,.175),(-1 if side==0 else 1,0,0))
        return result
    if cid=="U_BUCK_BOARD":return {"IN+":((-.44,.19,.195),(-1,0,0)),"IN-":((-.44,-.19,.195),(-1,0,0)),"OUT+":((.44,.19,.195),(1,0,0)),"OUT-":((.44,-.19,.195),(1,0,0))}
    if cid in ("S_M","S_L"):
        names=['VCC','GND','OUT']+(['FILTER'] if cid=="S_M" else [])
        r={"IP+":((-.21,.14,.264),(-1,0,0)),"IP-":((.21,.14,.264),(1,0,0))}
        for i,name in enumerate(names):r[name]=((-.24+i*.16,-.25,.178),(0,-1,0))
        return r
    if cid=="U_OLED_BOARD":return {pin:((-.30+i*.2,.28,.18),(0,1,0)) for i,pin in enumerate(pins)}
    if cid=="T1_PROBE":return {pin:((-.48,-.13+i*.13,.14),(-1,0,0)) for i,pin in enumerate(pins)}
    if cid=="TVS1":return {"CATHODE":((.22,0,.182),(1,0,0))}
    r={}
    for i,pin in enumerate(pins):
        side=-1 if pin in ['IN','INPUT+','INPUT-'] else 1
        same=[p for p in pins if (-1 if p in ['IN','INPUT+','INPUT-'] else 1)==side]
        ii=same.index(pin)
        r[pin]=((side*w*.39,(len(same)-1)*.085-ii*.17,.20),(side,0,0))
    return r

parents={}; manifest=[]; terminal_world={}
for cid,(x,y,w,h,label,kind) in LAYOUT.items():
    geo.C=components;geo.CID=cid
    before=set(components.objects)
    basew=w+.12;baseh=h+.24
    box(cid+" inspection plinth",(0,-.045,.026),(basew,baseh,.046),"black",.025)
    box(cid+" identification strip",(0,-h/2-.10,.052),(basew-.024,.105,.007),"darkmetal",.010)
    text(cid+" ID",cid,(0,-h/2-.075,.058),.044 if len(cid)<12 else .035,"label")
    text(cid+" name",label,(0,-h/2-.123,.058),min(.028,basew/max(1,len(label))*.95),"muted")
    if kind=="battery":body_battery()
    elif kind=="fuse":body_fuse()
    elif kind=="switch":body_switch()
    elif kind in ("bus","ground"):body_bus(kind=="ground")
    elif kind=="esp":body_esp()
    elif kind=="buck":body_buck()
    elif kind in ("acs","sensor_tbd"):body_acs(kind=="sensor_tbd")
    elif kind=="driver":body_driver()
    elif kind=="motor":body_motor()
    elif kind=="lamp":body_lamp()
    elif kind=="resistor":body_resistor(cid)
    elif kind=="capacitor":body_capacitor(cid)
    elif kind=="node":body_node()
    elif kind=="oled":body_oled()
    elif kind=="probe":body_probe()
    else:body_placeholder(kind)
    terminal_rows=[]
    for pin,(p,d) in terminals_for(cid,w,h).items():
        # These contacts are labelled logical anchors. They are never sold as
        # the physical manufacturer's header map.
        px,py,pz=p
        if cid=="U_ESP":
            box("Logical header wing",(px,py,.107),(.14,.12,.025),"pcbblue",.009)
            box("Logical terminal receptacle",(px,py,.14),(.068,.068,.048),"black",.006)
        cylinder("Logical terminal contact",(px,py,pz-.012),.018,.024,"gold",12)
        terminal_name="terminal_"+safe(cid)+"_"+safe(pin)
        t=bpy.data.objects.new(terminal_name,None);components.objects.link(t);t.location=p
        t.empty_display_type="SPHERE";t.empty_display_size=.025
        t["componentId"]=cid;t["terminalName"]=pin;t["physicalStatus"]="UNRESOLVED"
        text("Terminal label "+pin,pin,(px,py-.052,pz+.006),.024 if len(pin)<10 else .020,"amber")
        terminal_rows.append({"name":pin,"node":t.name,"position":gltf(p),"direction":gltf(d),"physicalStatus":"UNRESOLVED - logical contact; installed pin position not verified"})
        terminal_world[(cid,pin)]=Vector((x+px,y+py,pz))
    root=bpy.data.objects.new("component_"+safe(cid),None);components.objects.link(root)
    root.location=(x,y,0);root.empty_display_type="PLAIN_AXES";root.empty_display_size=.16
    root["componentId"]=cid;root["component_id"]=cid;root["illustrative"]=True
    root["physicalStatus"]="UNRESOLVED";root["sourceStatus"]=BOM[cid]["Status"]
    for o in set(components.objects)-before-{root}:
        o.parent=root
        o["componentId"]=cid
    parents[cid]=root
    manifest.append({"id":cid,"node":root.name,"position":gltf((x,y,0)),"terminals":terminal_rows,
        "name":label,"kind":kind,"bounds":{"min":[-basew/2,0,-baseh/2+.045],"max":[basew/2,.96 if cid=="BAT1" else .48,baseh/2+.045]},
        "geometryStatus":"ILLUSTRATIVE - form, dimensions, colours and physical terminal positions unverified",
        "sourceStatus":BOM[cid]["Status"],"sourceSpecification":BOM[cid]["Proposed identity / rating"],
        "unwired":not bool(terminal_rows),"terminalPlacementStatus":"UNRESOLVED",
        "explodedOffset":[round(x*.08,4),.30+(.10 if cid in ('U_ESP','BAT1') else 0),round(-y*.08,4)]})
bpy.context.view_layer.update()

# Generate the editable Blender wire bundle directly from the same CSV.
# Routing avoids all component footprints, then rounds aisle corners.
geo.C=wiring
GRID=.10; MINX=-4.8; MINY=-3.85; NX=98; NY=79
def cell(p):return (max(0,min(NX-1,round((p.x-MINX)/GRID))),max(0,min(NY-1,round((p.y-MINY)/GRID))))
def world(c,z):return Vector((MINX+c[0]*GRID,MINY+c[1]*GRID,z))
BLOCKED=set()
for cid,(x,y,w,h,_,_) in LAYOUT.items():
    for ix in range(NX):
        xx=MINX+ix*GRID
        if abs(xx-x)>w/2+.10:continue
        for iy in range(NY):
            yy=MINY+iy*GRID
            if y-h/2-.25<=yy<=y+h/2+.13:BLOCKED.add((ix,iy))
def escape(cid,p,d):
    x,y,w,h,_,_=LAYOUT[cid]
    candidates=[]
    for dx,dy in [(d.x,d.y),(1,0),(-1,0),(0,1),(0,-1)]:
        q=p.copy()
        if dx:q.x=x+(w/2+.20)*(1 if dx>0 else -1)
        else:q.y=y+(h/2+.23 if dy>0 else -h/2-.34)
        if cell(q) not in BLOCKED:candidates.append(q)
    if not candidates:raise RuntimeError('No open terminal escape for '+cid)
    return min(candidates,key=lambda q:(q-p).length)
occupied=defaultdict(int)
def route(a,b):
    start,end=cell(a),cell(b);pending=[(0,0,start)];cost={start:0};prev={};seen=set();counter=0
    while pending:
        _,_,at=heapq.heappop(pending)
        if at in seen:continue
        if at==end:break
        seen.add(at)
        for dx,dy in ((1,0),(0,1),(-1,0),(0,-1)):
            q=(at[0]+dx,at[1]+dy)
            if not(0<=q[0]<NX and 0<=q[1]<NY) or (q in BLOCKED and q not in (start,end)):continue
            next_cost=cost[at]+1+occupied[q]*.045
            if next_cost<cost.get(q,1e9):
                cost[q]=next_cost;prev[q]=at;counter+=1
                heapq.heappush(pending,(next_cost+abs(q[0]-end[0])+abs(q[1]-end[1]),counter,q))
    if end not in cost:raise RuntimeError("No collision-free aisle path for "+str((start,end)))
    result=[end]
    while result[-1]!=start:result.append(prev[result[-1]])
    result.reverse()
    for p in result:occupied[p]+=1
    for i in range(len(result)-2,0,-1):
        a,b,c=result[i-1:i+2]
        if a[0]==b[0]==c[0] or a[1]==b[1]==c[1]:result.pop(i)
    return result
def rounded(points,r=.065):
    out=[points[0]]
    for a,b,c in zip(points,points[1:],points[2:]):
        ab=(a-b);cb=(c-b)
        if ab.length<.0001 or cb.length<.0001:continue
        radius=min(r,ab.length*.40,cb.length*.40)
        p=b+ab.normalized()*radius;q=b+cb.normalized()*radius
        out.append(p)
        for i in range(1,7):
            t=i/6;out.append((1-t)**2*p+2*(1-t)*t*b+t*t*q)
    out.append(points[-1]);return out
def wiremat(w):
    net=w["net_or_domain"]
    if re.search("RETURN|GND|KELVIN",net):return "wire_ground"
    if w["source_terminal"]=="3V3" or "3V3" in net:return "wire_3v3"
    if re.search("I2C|1WIRE",net):return "wire_comm"
    if re.search("ADC|SIGNAL|FILTER|BANDWIDTH|TAP",net):return "wire_analog"
    if "MOTOR_DRIVE" in net:return "wire_motor"
    if re.search("5V|LOGIC_SUPPLY",net):return "wire_logic"
    if re.search("SENSOR_SUPPLY|CLAMP",net):return "wire_unresolved"
    return "wire_power"
wire_manifest=[]
for i,w in enumerate(WIRES):
    cid,pin=w['source_component'],w['source_terminal'];did,dpin=w['destination_component'],w['destination_terminal']
    a=terminal_world[(cid,pin)];b=terminal_world[(did,dpin)]
    sd=Vector(terminals_for(cid,LAYOUT[cid][2],LAYOUT[cid][3])[pin][1]);dd=Vector(terminals_for(did,LAYOUT[did][2],LAYOUT[did][3])[dpin][1])
    ea=escape(cid,a,sd);eb=escape(did,b,dd)
    z=.080+(i%7)*.012
    path=route(ea,eb)
    heights={c['id']:c['bounds']['max'][1] for c in manifest}
    ea_high=ea.copy();ea_high.z=max(a.z+.07,heights[cid]+.045,z)
    eb_high=eb.copy();eb_high.z=max(b.z+.07,heights[did]+.045,z)
    # Initial rise and outward lead guarantee contact with the anchor surface.
    points=[a,a+Vector((0,0,.055)),ea_high,world(path[0],z),*[world(q,z) for q in path[1:]],eb_high,b+Vector((0,0,.055)),b]
    radius=.016 if wiremat(w) in ('wire_power','wire_ground','wire_motor') else .009
    geo.CID=w['wire_id']
    obj=geo.pipe(w['wire_id']+" - "+cid+"."+pin+" to "+did+"."+dpin,rounded(points),radius,wiremat(w),8)
    for k,v in w.items():obj[k]=v
    obj['physicalVerification']='UNVERIFIED';obj['wireGauge']='TBD - diameter is presentation only'
    unresolved=not re.search('CALCULATED AND CROSS-CHECKED|DESIGN ASSUMPTION',w['status'])
    q=(a+ea_high)/2
    box(w['wire_id']+" identity flag",(q.x,q.y,q.z+.024),(.22,.069,.014),'amber' if unresolved else 'label',.007)
    text(w['wire_id']+" label",w['wire_id']+(' ?' if unresolved else ''),(q.x,q.y,q.z+.033),.039,'black')
    wire_manifest.append({**w,"sourceKey":cid+'.'+pin,"destinationKey":did+'.'+dpin,
        "points":[gltf(p) for p in points],"sourcePosition":gltf(a),"destinationPosition":gltf(b),
        "radius":radius,"physicalVerification":"UNVERIFIED","diameterStatus":"Presentation-only; conductor gauge is unresolved"})

# The source presentation has a drafted engineering work surface.
geo.C=stage;geo.CID='presentation'
box("Lab work surface",(0,-.32,-.08),(9.18,7.53,.15),'boardbed',.12)
for x in (-4.48,4.48):box("Bed edge extrusion",(x,-.32,-.045),(.095,7.45,.18),'silver',.022)
for y in (-4.03,3.38):box("Bed edge extrusion",(0,y,-.045),(9.0,.095,.18),'silver',.022)
for x in (-4.37,4.37):
    for y in (-3.91,3.26):screw("Bed fixing",x,y,.008,.041)
for i in range(37):
    x=-4.4+i*.25
    box("Draft vertical",(x,-.32,.001),(.004,7.27,.003),'muted',0)
for i in range(30):
    y=-3.95+i*.25
    box("Draft horizontal",(0,y,.001),(8.84,.004,.003),'muted',0)
text("Lab title","EV-EMS / 12 V CIRCUIT ASSEMBLY",(-4.16,3.11,.013),.13,'label','LEFT')
text("Lab caveat","PROPOSED CONNECTIONS / PHYSICAL IDENTITIES & PIN POSITIONS UNVERIFIED",(-4.16,2.94,.013),.059,'amber','LEFT')
text("Rack divider","OPTIONAL PERIPHERALS / UNSCHEDULED PROTECTION AND LEGACY RELAY",(-4.10,-2.62,.012),.068,'amber','LEFT')
text("Lab scale","PRESENTATION SCALE / NOT MANUFACTURER CAD OR CONSTRUCTION APPROVAL",(-4.10,-3.76,.013),.062,'muted','LEFT')

worlddata=bpy.data.worlds.new('Laboratory ambient');worlddata.use_nodes=True
worlddata.node_tree.nodes['Background'].inputs[0].default_value=(.14,.19,.22,1)
worlddata.node_tree.nodes['Background'].inputs[1].default_value=.48;scene.world=worlddata
def area(n,p,power,size):
    data=bpy.data.lights.new(n,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(n,data);stage.objects.link(obj);obj.location=p
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Large laboratory softbox',(0,-2,8),1800,8)
area('Rim softbox',(2,6,5),1250,6)
area('Fill softbox',(-6,-1,3),750,5)
camdata=bpy.data.cameras.new('Assembly camera');camera=bpy.data.objects.new('Assembly camera',camdata);stage.objects.link(camera)
camera.location=(7.3,-10.4,11.8);camera.rotation_euler=(Vector((0,-.3,.14))-camera.location).to_track_quat('-Z','Y').to_euler()
camdata.type='ORTHO';camdata.ortho_scale=12.4;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1800;scene.render.resolution_y=1500;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.filepath=str(OUT/'circuit-lab-preview.png')
scene['engineeringScope']='12 V proposed educational circuit; software-only 96 V vehicle remains a separate system'
scene['sourceCsv']=str(WIRE_FILE.relative_to(ROOT));scene['all_physical_pin_positions']='UNRESOLVED'
scene['geometry_status']='Illustrative presentation dimensions, form, colour and wire diameter'
scene['unresolved_netlist_items']='TVS1 return absent; RP1 absent; D1 conditional and absent; DS18B20 4.7k pullup absent; relay Qty 0 unwired'
for screen in bpy.data.screens:
    for ar in screen.areas:
        if ar.type=='VIEW_3D':
            ar.spaces.active.region_3d.view_perspective='CAMERA';ar.spaces.active.shading.type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'circuit-lab.blend'))
if '--no-render' not in sys.argv:bpy.ops.render.render(write_still=True)

# Bake and batch geometry by component/material. Preserve all terminal empties.
deps=bpy.context.evaluated_depsgraph_get();batches=defaultdict(list)
for o in list(components.objects):
    if o.type not in ('MESH','FONT','CURVE'):continue
    data=bpy.data.meshes.new_from_object(o.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
    if not data.polygons:bpy.data.meshes.remove(data);continue
    batches[(o['componentId'],data.materials[0].name)].append((o,data,o.matrix_world.copy()))
for (cid,mname),items in batches.items():
    verts=[];faces=[];smooth=[];normals=[];inv=parents[cid].matrix_world.inverted()
    for o,data,world in items:
        tr=inv@world;offset=len(verts)
        verts.extend(tuple(tr@v.co) for v in data.vertices)
        faces.extend(tuple(offset+i for i in p.vertices) for p in data.polygons)
        smooth.extend(p.use_smooth for p in data.polygons)
        normaltr=tr.to_3x3().inverted().transposed()
        normals.extend(tuple((normaltr@n.vector).normalized()) for n in data.corner_normals)
    mesh=bpy.data.meshes.new(cid+'_'+mname);mesh.from_pydata(verts,[],faces);mesh.materials.append(bpy.data.materials[mname]);mesh.update()
    for p,s in zip(mesh.polygons,smooth):p.use_smooth=s
    if len(normals)==len(mesh.loops):mesh.normals_split_custom_set(normals)
    for o,data,_ in items:bpy.data.objects.remove(o,do_unlink=True);bpy.data.meshes.remove(data)
    o=bpy.data.objects.new(cid+'_'+mname,mesh);components.objects.link(o);o.parent=parents[cid]
    o['componentId']=cid;o['illustrative']=True;o['sourcePartsCount']=len(items)
bpy.ops.object.select_all(action='DESELECT')
for o in components.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'circuit-lab.glb'),export_format='GLB',use_selection=True,
    export_extras=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_animations=False)
raw=(OUT/'circuit-lab.glb').read_bytes();doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
report={"name":"EV-EMS proposed 12 V circuit assembly","revision":"2026-11-03",
    "sourceBlend":"assets/circuit/circuit-lab.blend","webAsset":"assets/circuit/circuit-lab.glb",
    "sourceCsv":str(WIRE_FILE.relative_to(ROOT)).replace('\\','/'),"sourceCsvSha256":hashlib.sha256(WIRE_FILE.read_bytes()).hexdigest(),
    "sourceBomSha256":hashlib.sha256(BOM_FILE.read_bytes()).hexdigest(),
    "coordinateSystem":"glTF +Y up; Blender (x,y,z) => glTF (x,z,-y). Root scale and rotation identity.",
    "scaleStatus":"Normalized presentation scale; NOT measured physical dimensions or conductor gauges",
    "geometryStatus":"Illustrative candidate forms only; all installed component identities and pin positions unresolved",
    "bounds":{"min":[-4.65,-.16,-3.48],"max":[4.65,.98,4.15]},
    "components":manifest,"componentCount":len(manifest),"wiredComponentCount":len(PINS),"terminalCount":sum(map(len,PINS.values())),
    "wires":wire_manifest,"wireCount":len(WIRES),
    "unresolvedConnections":[{"id":"TVS1","detail":"W060 ends at CATHODE. ANODE return is not a CSV row; it is intentionally not invented."},
        {"id":"RP1","detail":"Required reverse-polarity device is unselected and has no scheduled connections."},
        {"id":"D1","detail":"Suppression depends on motor topology; no connection is scheduled."},
        {"id":"T1_PROBE","detail":"Required 4.7 kOhm DQ pullup appears in prose but has no BOM ID or wire rows."},
        {"id":"RLY1","detail":"Legacy artifact has Qty 0 and no active netlist connections."}],
    "sourceStatus":"Model/connection inspection only; no claim of hardware testing",
    "glbBytes":len(raw),"meshes":len(doc['meshes']),"materials":len(doc['materials']),
    "triangles":sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])}
(OUT/'circuit-manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('CIRCUIT_ASSET_RESULT '+json.dumps({k:v for k,v in report.items() if k not in ['components','wires']}))
