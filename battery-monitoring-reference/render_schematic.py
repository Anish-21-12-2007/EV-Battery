"""Render the companion PNG teaching diagram with Pillow (no external install)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
W, H = 1800, 1200
BG = "#f2f5f9"
INK = "#17253a"
MUTED = "#52637a"
RED = "#c43b42"
BLACK = "#293446"
BLUE = "#2467b2"
ORANGE = "#da7a21"
GREEN = "#26805b"
PURPLE = "#8052ac"
BOX = "#f8fafc"
STROKE = "#718198"
WARN = "#fff3d9"

im = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(im)
regular = r"C:\Windows\Fonts\segoeui.ttf"
bold = r"C:\Windows\Fonts\segoeuib.ttf"
def font(size, weight=False):
    return ImageFont.truetype(bold if weight else regular, size)

def text(x, y, value, size=18, color=INK, weight=False, anchor=None):
    d.text((x, y), value, font=font(size, weight), fill=color, anchor=anchor)

def box(x, y, w, h, fill=BOX, outline=STROKE, radius=18, width=2):
    d.rounded_rectangle((x, y, x+w, y+h), radius=radius, fill=fill, outline=outline, width=width)

def line(points, color, width=5, dashed=False, arrow=False):
    if dashed:
        for (x1,y1),(x2,y2) in zip(points, points[1:]):
            dx,dy=x2-x1,y2-y1
            dist=max(1,(dx*dx+dy*dy)**0.5)
            ux,uy=dx/dist,dy/dist
            pos=0
            while pos < dist:
                end=min(pos+12,dist)
                if pos < dist:
                    d.line((x1+ux*pos,y1+uy*pos,x1+ux*end,y1+uy*end),fill=color,width=width)
                pos += 20
    else:
        d.line(points, fill=color, width=width, joint="curve")
    if arrow and len(points)>1:
        x2,y2=points[-1]; x1,y1=points[-2]
        import math
        angle=math.atan2(y2-y1,x2-x1); length=15; spread=8
        left=(x2-length*math.cos(angle)+spread*math.sin(angle),y2-length*math.sin(angle)-spread*math.cos(angle))
        right=(x2-length*math.cos(angle)-spread*math.sin(angle),y2-length*math.sin(angle)+spread*math.cos(angle))
        d.polygon([(x2,y2),left,right],fill=color)

def center_text(cx, y, value, size=18, color=INK, weight=True):
    text(cx,y,value,size,color,weight,"mt")

# Header
text(55, 24, "ECS Battery Monitoring — proposed wiring architecture", 34, INK, True)
text(57, 69, "CONDITIONAL REFERENCE • Not electrically verified • Do not energize until physical module, wire and load ratings are checked", 18, MUTED)

# Power panel
box(35,115,1730,455,"#ffffff","#d8e1ec",22)
text(65,129,"1. Battery and motor power path",23,INK,True)
text(66,162,"Fuse close to battery positive; proposed sensor placement measures motor-branch current only.",16,MUTED)
box(78,255,190,155); center_text(173,270,"12 V VRLA",18); center_text(173,296,"Amptek AT12-7.6",17)
text(92,336,"+ BAT",14,INK,True); text(92,375,"− BAT",14,INK,True)
box(370,295,160,86,radius=14); center_text(450,306,"FUSE + HOLDER",16); center_text(450,332,"30 A element value TBD",13,MUTED,False); center_text(450,351,"DC interrupt rating TBD",13,MUTED,False)
box(635,295,190,86,radius=14); center_text(730,306,"ROCKER SWITCH",16); center_text(730,334,"DC / inrush rating TBD",14,MUTED,False)
box(930,260,265,155); center_text(1062,270,"ACS712-30A MODULE",18); text(948,316,"IP+  →  IP−",15,INK,True); text(948,343,"High-current path in series",15,MUTED); text(948,370,"Breakout current rating TBD",15,MUTED)
box(1370,285,220,105,radius=50); center_text(1480,297,"DC MOTOR",18); center_text(1480,327,"rated / start / stall A TBD",14,MUTED,False)
line([(268,330),(370,330)],RED,6,arrow=True); text(310,304,"+",14,INK,True)
line([(530,330),(635,330)],RED,6,arrow=True)
line([(825,330),(930,330)],RED,6,arrow=True); text(840,300,"switched +",14,INK,True)
line([(1195,330),(1370,330)],RED,6,arrow=True); text(1209,300,"IP− → motor +",14,INK,True)
line([(1590,350),(1665,350),(1665,535),(170,535),(170,410)],BLACK,5,arrow=True)
text(300,507,"Motor − return → Battery − star point",15,INK,True)
line([(730,381),(730,465),(850,465)],ORANGE,5,arrow=True)
text(754,437,"IN+",13,INK,True)
box(850,430,310,95); center_text(1005,432,"LM2596 BUCK MODULE",17); center_text(1005,459,"IN+ switched bus • IN− battery− star",13,MUTED,False); center_text(1005,486,"Meter-check OUT = 5.00 V first",13,MUTED,False)
line([(170,535),(800,535),(800,500),(850,500)],BLACK,5)
text(811,482,"IN−",13,INK,True)
line([(1160,475),(1280,475)],ORANGE,5,arrow=True); text(1180,442,"5 V OUT",13,INK,True)
box(1280,432,420,89,WARN,"#d49a27",14)
text(1300,442,"Fuse, rocker, wire & ACS board ratings",15,INK,True); text(1300,467,"are unknown: 30 A is not approved; no motor test yet.",14,MUTED); text(1300,490,"Relay intentionally omitted from motor path.",14,MUTED)

# Logic panel
box(35,595,1730,525,"#ffffff","#d8e1ec",22)
text(65,609,"2. Low-voltage logic, display and measurement",23,INK,True)
text(66,642,"Use classic ESP32 pin labels only if the physical board confirms this pinout; ADC and OLED modules still require checking.",16,MUTED)
box(95,735,295,285); center_text(242,750,"ESP32 DEV BOARD",18); text(120,797,"5V/VIN ← verified buck 5 V only*",14,INK,True); text(120,833,"GPIO34 / ADC1_CH6 ← current node",14,INK,True); text(120,864,"GPIO35 / ADC1_CH7 ← battery node",14,INK,True); text(120,906,"GPIO21 SDA  •  GPIO22 SCL",14,INK,True); text(120,938,"GND = logic reference",14,INK,True); text(120,974,"*Confirm exact board input; one supply source.",12,MUTED)
box(500,755,280,195); center_text(640,770,"0.96-in OLED",18); text(530,812,"SDA ← GPIO21",14,INK,True); text(530,839,"SCL ← GPIO22",14,INK,True); text(530,866,"VCC = verified 3.3 V candidate",13,INK,True); text(530,893,"GND → logic GND",14,INK,True); text(530,918,"Address/pull-up rail: inspect/scan",12,MUTED)
line([(390,837),(500,837)],BLUE,4,arrow=True); line([(390,872),(500,872)],BLUE,4,arrow=True); text(402,806,"SDA / SCL",13,INK,True)
box(850,725,380,185); center_text(1040,740,"ACS712 SIGNAL SCALE",18); text(875,778,"ACS OUT / VIOUT → 15 kΩ series",14,INK,True); text(875,810,"ADC node → GPIO34",14,INK,True); text(875,842,"20 kΩ node → GND; optional 100 nF",14,INK,True); text(875,875,"Nominal factor 0.571; calibrate offset/gain.",13,MUTED)
box(850,945,380,135); center_text(1040,957,"BATTERY DIVIDER",18); text(875,992,"switched + → 120 kΩ → GPIO35 node",14,INK,True); text(875,1020,"22 kΩ node → GND; optional 100 nF",14,INK,True); text(875,1047,"18 V assumed ceiling gives ≈2.8 V.",13,MUTED)
line([(390,980),(445,980),(445,1067),(780,1067),(850,1067)],BLACK,4,dashed=True)
text(470,1080,"Logic GND shared only after confirming module topology; motor return stays on its own path.",13,MUTED)
box(1320,735,390,220,WARN,"#d49a27",18); center_text(1515,753,"5 V RELAY / MODULE",18); text(1348,797,"VCC, GND, IN, COM, NO, NC",14,INK,True); text(1348,829,"TBD — exact board and driver unknown",14,INK,True); text(1348,862,"GPIO25 is only a candidate; no wire assigned.",13,MUTED); text(1348,891,"Do not switch motor until DC inductive /",13,MUTED); text(1348,916,"startup rating is verified.",13,MUTED)
line([(1230,862),(1320,862)],PURPLE,4,dashed=True); text(1240,834,"NO CONNECTION",12,INK,True)
text(1325,978,"LEGEND",16,INK,True)
line([(1325,1012),(1370,1012)],RED,5); text(1380,1004,"high-current +",13,MUTED,True); line([(1535,1012),(1580,1012)],BLACK,5); text(1590,1004,"return",13,MUTED,True)
line([(1325,1042),(1370,1042)],ORANGE,5); text(1380,1034,"regulated 5 V",13,MUTED,True); line([(1535,1042),(1580,1042)],BLUE,4); text(1590,1034,"I²C",13,MUTED,True)
line([(1325,1072),(1370,1072)],PURPLE,4); text(1380,1064,"ADC signal",13,MUTED,True); line([(1535,1072),(1580,1072)],PURPLE,4,dashed=True); text(1590,1064,"conditional / open",13,MUTED,True)

box(55,1140,1690,42,"#fde8e8","#d97777",12)
text(75,1148,"WARNING: Educational proposal only. Confirm exact board labels, voltage/current ratings, fuse sizing and wiring before energizing. See guide + report.",16,"#8f252a",True)

out = ROOT / "battery-monitoring-schematic.png"
im.save(out, format="PNG", optimize=True)
print(f"Rendered {out} ({out.stat().st_size} bytes, {W}x{H})")
