"""Authoritative proposed netlist; generates CSV, inspector data and a readable schematic.
Run with Python 3 + Pillow. Coordinates describe SYMBOLIC reference ports, not board pins.
"""
import csv, json, math, hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'hardware-validation'
components = []

def component(id, name, short, prefix, center, ports, note, color='#66c8bd'):
    c = dict(id=id, name=name, shortName=short, prefix=prefix, center=center,
             terminals=ports, description=note, color=color)
    components.append(c)

component('battery','12 V · 7.6 Ah VRLA battery','VRLA battery','Battery_',[-3.7,2.1],
          {'BAT+':[-4.13,2.1,1.43],'BAT-':[-3.27,2.1,1.43]},'Nominal battery specification. Terminal type, limits and dimensions require physical confirmation. BAT− is the star return.')
component('fuse','F1 · main fuse, rating TBD','F1 · rating TBD','Fuse_',[-2.3,2.4],
          {'IN':[-2.65,1.95,.23],'OUT':[-1.95,1.95,.23]},'F1 must be adjacent to battery positive. DC interrupt capacity, holder and time-current curve remain unverified. 30 A is not approved.')
component('switch','SW1 · DC rocker, rating TBD','SW1 rocker','Rocker_Switch',[-1.1,2.4],
          {'IN':[-1.3,1.95,.23],'OUT':[-.9,1.95,.23]},'Proposed two-terminal DC switch. Physical terminal arrangement and motor switching rating are unknown; suppress inductive turnoff.')
component('acs712','ACS712 · proposed 30 A variant','ACS712 sensor','ACS712_',[.2,2.4],
          {'IP+':[-.08,1.88,.23],'IP-':[.48,1.88,.23],'VCC':[-.1,2.95,.23],'GND':[.2,2.95,.23],'OUT':[.5,2.95,.23]},'Measures total current in the switched discharge path, including electronics. 30 A is the IC range, not an approved module current. Symbolic ports; inspect the breakout.')
component('bus','J1 · positive load distribution','J1 load bus','LoadBus_',[1.35,2.4],
          {'+':[1.35,2.0,.23]},'Rated common positive distribution junction after ACS712. All branches shown share this junction. F2 must be at this takeoff.')
component('motor','M1 · DC motor, ratings unknown','DC motor','DC_Motor',[3.15,2.3],
          {'+':[2.95,1.78,.23],'-':[3.35,1.78,.23]},'Unverified motor. Diagram assumes a simple unidirectional brushed motor. Current cannot establish rotation; no approved inrush/stall rating.')
component('fuse2','F2 · branch fuse, rating TBD','F2 · rating TBD','BranchFuse_',[1.3,.9],
          {'IN':[1.1,.53,.23],'OUT':[1.5,.53,.23]},'Protects buck and sense branch. 1–2 A in the audit was not a verified selection; rating needs inrush and wire coordination.')
component('lm2596','LM2596 · set output to 5.00 V','LM2596 buck','LM2596_',[2.5,.2],
          {'IN+':[2.08,-.4,.23],'IN-':[2.36,-.4,.23],'OUT+':[2.64,-.4,.23],'OUT-':[2.92,-.4,.23]},'Meter-set to 5.00 V unloaded and loaded before connecting electronics. Module pin positions, ground continuity and thermal performance remain conditional.')
component('esp32','Classic ESP32 development board','ESP32 board','ESP32_',[-.4,-.8],
          {'5V':[-1.1,-1.3,.23],'GND':[-.9,-1.3,.23],'3V3':[-.7,-1.3,.23],'GPIO34':[-.5,-1.3,.23],'GPIO35':[-.3,-1.3,.23],'GPIO21':[-.1,-1.3,.23],'GPIO22':[.1,-1.3,.23],'GPIO4':[.3,-1.3,.23]},'GPIO34/35 are ADC1 inputs on classic ESP32. Reference ports are NOT the physical header order. Identify the actual board and documented 5V input; only one supply source.')
component('oled','0.96-inch OLED · proposed I²C','OLED display','OLED_',[1.6,-1.55],
          {'VCC':[1.27,-2.03,.23],'GND':[1.49,-2.03,.23],'SDA':[1.71,-2.03,.23],'SCL':[1.93,-2.03,.23]},'Requires a documented 3.3V-compatible module, 3.3V pullups and an address scan. Screen is labeled NO LIVE DATA. Physical pin ordering unverified.')
component('relay','Relay module · NOT CONNECTED','Relay · unwired','Relay_',[3.5,-2.25],
          {},'IN / VCC / GND / COM / NO / NC and GPIO25 remain unwired. Exact module driver and DC motor contact rating unknown. No remote cutoff is implemented.')
component('temperature','DS18B20 · proposed case probe','DS18B20 · proposed','Temperature_',[-3.9,.65],
          {'VDD':[-4.2,.1,.23],'GND':[-3.9,.1,.23],'DQ':[-3.6,.1,.23]},'Proposed addition, not confirmed present. Case-surface temperature only. Probe colors and lead order unknown; require ROM/presence, conversion completion and CRC.')
component('ground','J2 · logic ground junction','J2 logic ground','LogicGround_',[.15,.45],
          {'GND':[.15,.2,.23]},'Common logic reference via buck OUT−. Separate motor return to BAT−; confirm buck IN−/OUT− continuity. Not an isolated system.')

# Explicit passive bodies with two leads; nodes are actual proposed junction pads.
for id,name,x,y in [('r1','R1 · 27k 1%',-2.8,-1.45),('r2','R2 · 20k 1%',-2.05,-2.6),('c1','C1 · 100nF',-1.3,-2.6),
                     ('r3','R3 · 68k 1%',-.45,-2.6),('r4','R4 · 10k 1%',.35,-2.6),('c2','C2 · 100nF',1.15,-2.6),
                     ('r5','R5 · 4.7k',-3.6,-1.5),('c3','C3 · 100nF ≥50V',3.75,1.2),('d1','D1 · diode TBD',4.3,2.35)]:
    ports={'A':[x-.18,y,.23],'B':[x+.18,y,.23]}
    if id=='d1': ports={'K':[x-.18,y,.23],'A':[x+.18,y,.23]}
    note = 'Proposed passive value; verify tolerance, rating and assembly. Leads shown explicitly.'
    if id=='d1': note='Conditional flyback for a simple unidirectional brushed motor: cathode K to M+, anode A to M−. Part, energy and surge ratings TBD; do not use with reversal without redesign.'
    if id=='c3': note='Proposed brush-noise capacitor, not a turnoff energy clamp. Place at actual motor terminals with very short leads; scene spacing is illustrative.'
    component(id,name,name,'Passive_'+id.upper()+'_',[x,y],ports,note,'#d0b87b')
for id,name,x,y in [('nodea','JA · current ADC node',-2.05,-1.45),('nodeb','JB · voltage ADC node',-.45,-1.9)]:
    component(id,name,name.split(' · ')[0],'Junction_'+id+'_',[x,y],{'NODE':[x,y,.23]},'Explicit common junction. All attached leads share this node; crossings elsewhere do not connect.')

rows=[]
def wire(id,sc,st,dc,dt,group,status,why,original='new'):
    rows.append(dict(id=id,source_component=sc,source_terminal=st,destination_component=dc,destination_terminal=dt,
                     wire_group=group,status=status,evidence=why,original_row=original,
                     depiction='dashed' if status in ('CONDITIONAL','UNVERIFIED') else 'solid'))
C='CONDITIONAL'; U='UNVERIFIED'; K='CALCULATED'
wire('W01','battery','BAT+','fuse','IN','battery',C,'U10/U15: polarity, F1 and terminal ratings TBD','W01')
wire('W02','fuse','OUT','switch','IN','battery',C,'U10: DC switch and fuse coordination','W02')
wire('W03','switch','OUT','acs712','IP+','battery',C,'U05/U10: logical positive current direction','W03')
wire('W04','acs712','IP-','bus','+','battery',C,'U05: module current path unknown','W04')
wire('W05','bus','+','motor','+','motor',U,'U12: motor identity/current unknown','W05')
wire('W06','motor','-','battery','BAT-','return',U,'U12/U16: independent heavy return','W06')
wire('W07a','motor','+','c3','A','motor',C,'U13: brush-noise proposal','W07')
wire('W07b','c3','B','motor','-','return',C,'U13: explicit second capacitor lead','W07')
wire('W08','bus','+','fuse2','IN','branch',C,'U10: F2 at takeoff; rating remains TBD','W08')
wire('W09','fuse2','OUT','lm2596','IN+','branch',C,'U07: verify input polarity and component limits','W09')
wire('W10','battery','BAT-','lm2596','IN-','ground',C,'U16: separate low-current return','W10')
wire('W11','lm2596','OUT+','esp32','5V','5v',C,'U07/U08: measured output and exact board input required','W11')
wire('W12','lm2596','OUT-','ground','GND','ground',C,'U16: common-ground module assumption','W12')
wire('W12b','ground','GND','esp32','GND','ground',C,'U16: explicit logic junction','W12')
wire('W13','lm2596','OUT+','acs712','VCC','5v',C,'U05/U07: 4.5–5.5V sensor supply','W13')
wire('W14','ground','GND','acs712','GND','ground',C,'U05/U16: sensor reference','W14')
wire('W15','acs712','OUT','r1','A','analog',C,'U04/U05: inspect existing output conditioning','W15')
wire('W16a','r1','B','nodea','NODE','analog',K,'U04: explicit current-divider junction','W16')
wire('W16b','nodea','NODE','esp32','GPIO34','analog',C,'U02/U04: ADC1_CH6; actual header unverified','W16')
wire('W17','nodea','NODE','r2','A','analog',K,'U04: 27k/20k calculated divider','W17')
wire('W18','r2','B','ground','GND','ground',K,'U04: shunt return','W18')
wire('W19','nodea','NODE','c1','A','analog',K,'U04: 100nF node filter','W19')
wire('W19b','c1','B','ground','GND','ground',K,'U19: omitted in supplied CSV; required filter return')
wire('W20','fuse2','OUT','r3','A','sense',C,'U03/U11: protected voltage tap moved after F2','W20')
wire('W21a','r3','B','nodeb','NODE','analog',K,'U03: 68k/10k 1% divider','W21')
wire('W21b','nodeb','NODE','esp32','GPIO35','analog',C,'U02/U03: ADC1_CH7; actual header unverified','W21')
wire('W22','nodeb','NODE','r4','A','analog',K,'U03: shunt resistor to reference','W22')
wire('W23','r4','B','ground','GND','ground',K,'U03: shunt return','W23')
wire('W24','nodeb','NODE','c2','A','analog',K,'U03: 100nF node filter','W24')
wire('W24b','c2','B','ground','GND','ground',K,'U19: omitted in supplied CSV; required filter return')
wire('W25','esp32','3V3','oled','VCC','3v3',C,'U09: only documented 3.3V-compatible module','W25')
wire('W26','esp32','GPIO21','oled','SDA','i2c',C,'U09: 3.3V pullups and address scan','W26')
wire('W27','esp32','GPIO22','oled','SCL','i2c',C,'U09: 3.3V pullups and address scan','W27')
wire('W28','ground','GND','oled','GND','ground',C,'U09/U16: common reference','W28')
wire('W29','esp32','3V3','temperature','VDD','3v3',U,'U17: proposed probe not confirmed present','W29')
wire('W30','ground','GND','temperature','GND','ground',U,'U17: no probe wire-color assumption','W30')
wire('W31','esp32','GPIO4','temperature','DQ','onewire',U,'U17: probe presence/pinout/CRC unverified','W31')
wire('W37','esp32','3V3','r5','A','3v3',C,'U17/U19: explicit pullup supply lead')
wire('W38','r5','B','temperature','DQ','onewire',U,'U17/U19: explicit 4.7k pullup to DQ')
wire('W39','motor','+','d1','K','motor',C,'U13: cathode toward positive; simple unidirectional motor only')
wire('W40','d1','A','motor','-','return',C,'U13: flyback anode; diode rating TBD')

groups={'battery':('#dd5555','Battery +',.025),'motor':('#de9252','Motor + / suppression',.025),
        'return':('#6b7986','Motor return',.025),'branch':('#d8a35b','Protected branch',.015),
        '5v':('#f2b555','5 V',.012),'3v3':('#e48db3','3.3 V',.010),'ground':('#66a98c','Logic ground',.012),
        'analog':('#b49be5','ADC / filter',.010),'sense':('#c598c7','Bus sense',.010),'i2c':('#6faef0','I²C',.010),'onewire':('#ded176','1-Wire',.010)}
data=dict(revision='2026-10-13-final',components=components,groups=groups,
          caveat='Conditional circuit reference. Dashed = provisional. Ports are logical, NOT physical header positions.',
          omitted=[dict(id='W32',reason='Mechanical case attachment only; not an electrical wire'),dict(id='W33',reason='Optional TVS omitted: part and coordination unresolved'),dict(id='W34–W36',reason='Relay and GPIO25 reserved, no routed leads')])

def write_files():
    with (OUT/'corrected-wiring-table.csv').open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
    data['connections']=list(csv.DictReader((OUT/'corrected-wiring-table.csv').open(encoding='utf-8')))
    data['csv_sha256']=hashlib.sha256((OUT/'corrected-wiring-table.csv').read_bytes()).hexdigest()
    (OUT/'assembly-reference.json').write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
    draw_schematic(data)

def draw_schematic(data):
    # Complete terminal schedule plus architecture: every conductive row appears exactly once.
    im=Image.new('RGB',(2200,2480),'#f4f7fb'); d=ImageDraw.Draw(im)
    regular='C:/Windows/Fonts/segoeui.ttf'; bold='C:/Windows/Fonts/segoeuib.ttf'
    def text(x,y,s,size=22,color='#243347',b=False): d.text((x,y),s,font=ImageFont.truetype(bold if b else regular,size),fill=color)
    text(70,40,'ECS / BATTERY MONITORING',42,b=True)
    text(70,100,'Corrected conditional schematic + complete terminal schedule · 13 October 2026',26)
    text(70,145,'Logical terminals only. Physical board header order and power ratings are NOT established.',23,'#995d19')
    boxes=[('BAT+ →',80,240),('F1 / TBD',420,240),('SW1 / TBD',760,240),('ACS IP+ → IP−',1100,240),('J1 / LOAD BUS',1520,240)]
    for title,x,y in boxes:
        d.rounded_rectangle((x,y,x+280,y+100),16,fill='white',outline='#677d94',width=2); text(x+18,y+30,title,25,b=True)
    for x1,x2 in [(360,420),(700,760),(1040,1100),(1380,1520)]: d.line((x1,290,x2,290),fill='#c75a55',width=5)
    text(80,375,'J1 → M+ ; M− → BAT− star (separate motor return)',25,b=True)
    text(80,415,'J1 → F2 (rating TBD, at takeoff) → LM2596 IN+ AND R3 top',25,b=True)
    text(80,455,'LM2596 OUT+ = 5.00 V → ESP32 5V and ACS VCC; OUT− → J2 logic GND',25)
    text(80,495,'ACS OUT → R1 27k → JA → GPIO34; JA → R2 20k || C1 100nF → J2',25)
    text(80,535,'F2 OUT → R3 68k → JB → GPIO35; JB → R4 10k || C2 100nF → J2',25)
    text(80,575,'OLED: 3V3 / GND / GPIO21 SDA / GPIO22 SCL. DS18B20: 3V3 / GND / GPIO4 DQ.',25)
    text(80,615,'R5 4.7k: 3V3 → DQ. C3 100nF and D1 (K to M+, A to M−) across motor, provisional.',25)
    text(80,655,'Relay and GPIO25 UNWIRED. Optional TVS omitted. DS18B20 is proposed, not confirmed present.',23,'#995d19')
    text(70,735,'Every drawn conductor · source → destination',30,b=True)
    lookup={c['id']:c for c in components}
    for idx,r in enumerate(data['connections']):
        col=idx//21; line=idx%21; x=70+col*1080; y=800+line*65
        d.line((x,y+54,x+1020,y+54),fill='#d8e0e9',width=1)
        color=groups[r['wire_group']][0]
        if r['depiction']=='dashed':
            for z in range(0,42,14): d.line((x+z,y+12,x+z+8,y+12),fill=color,width=4)
        else: d.line((x,y+12,x+42,y+12),fill=color,width=4)
        sc=r['source_component'].upper(); dc=r['destination_component'].upper()
        text(x+55,y,f"{r['id']}  {sc}.{r['source_terminal']} → {dc}.{r['destination_terminal']}",21,b=True)
        text(x+55,y+28,f"{r['status']} · {groups[r['wire_group']][1]}",18,'#647386')
    text(70,2230,'Solid = calculated passive topology. Dashed = CONDITIONAL or UNVERIFIED.',25,b=True)
    text(70,2270,'None of these wires is physically verified. Crossings are not junctions; JA, JB, J1 and J2 are explicit nodes.',23)
    text(70,2310,'Voltage = protected load bus relative to logic ground. V × I is an approximation to downstream electrical power.',23)
    text(70,2350,'Fuses, switching suppression, module identities and physical measurements remain open: see remaining-verification.md.',23)
    text(70,2400,'Source: corrected-wiring-table.csv · '+data['csv_sha256'][:20],20,'#647386')
    im.save(OUT/'corrected-schematic.png')

if __name__=='__main__': write_files()
