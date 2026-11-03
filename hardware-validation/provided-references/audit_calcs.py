# Independent recalculation for ECS battery-monitor audit. Pure arithmetic; no hardware data.
import math
def div(rt, rb, v, tol=0.01):
    r = rb/(rt+rb)
    lo = rb*(1-tol)/(rt*(1+tol)+rb*(1-tol)); hi = rb*(1+tol)/(rt*(1-tol)+rb*(1+tol))
    return r, v*r, v*lo, v*hi
ADC_TOP = 2.450  # ESP-IDF 11/12 dB documented measurable range upper bound (V)
print("== Battery divider ==")
for name,(rt,rb) in {"orig 120k/22k":(120e3,22e3),"new 56k/10k":(56e3,10e3)}.items():
    zs = rt*rb/(rt+rb)
    for v in (12.0,13.8,14.8,16.0,18.0):
        r,n,lo,hi = div(rt,rb,v)
        print(f"{name} V={v:5.1f} ratio={r:.5f} node={n:.3f} V (1% band {lo:.3f}-{hi:.3f}) {'>2.45 LIMIT' if hi>ADC_TOP else 'ok'}")
    print(f"  Zsource={zs/1e3:.2f} k  I@12.6V={12.6/(rt+rb)*1e6:.0f} uA  P_top@16V={(16*rt/(rt+rb))**2/rt*1e3:.2f} mW  fc(100nF)={1/(2*math.pi*zs*100e-9):.0f} Hz")
    print(f"  Vbat at node=2.45V (max valid reading) = {ADC_TOP/(rb/(rt+rb)):.2f} V")
print("== ACS712 scaling (5.00 V supply) ==")
for name,(rt,rb) in {"orig 15k/20k":(15e3,20e3),"new 10k/22k":(10e3,22e3),"new 4.7k/10k":(4.7e3,10e3)}.items():
    r = rb/(rt+rb)
    print(f"{name} ratio={r:.4f} zero={2.5*r:.3f} V sens={66*r:.2f} mV/A  at +30A={(2.5+30*.066)*r:.3f} V  at -30A={(2.5-30*.066)*r:.3f} V  Imax_in_range={(ADC_TOP/r-2.5)/.066:.1f} A  Zs={rt*rb/(rt+rb)/1e3:.2f}k fc(100nF)={1/(2*math.pi*(rt*rb/(rt+rb))*100e-9):.0f}Hz")
r=20/35
print(f"orig: Vout limit 2.45 reached at I = {(2.45/r-2.5)/0.066:.1f} A (ACS side {2.45/r:.2f} V)")
print("ACS noise 7 mV p-p (2 kHz BW, CF=47nF) ->", round(7/66*1000), "mA p-p at ACS output; at 12-bit ADC 0.8 mV/LSB, node sens 37.7 mV/A ->", round(0.8/37.7*1000), "mA/LSB ideal")
print("== Peukert example (k assumed 1.2, C20=7.6Ah, NOT a datasheet value) ==")
C=7.6;H=20;k=1.2
for I in (0.38,1,2,5,10):
    cap = I*H*(C/(I*H))**k
    print(f"I={I:5.2f} A capacity={cap:.2f} Ah ({cap/C*100:.0f}%) runtime={cap/I:.2f} h")
print("== Power / energy ==")
print("P = 12.2 V*5 A =",12.2*5,"W ; 7.6Ah*12V nominal =",7.6*12,"Wh (nominal, not usable)")
print("== Buck budget ==  ESP32 WiFi peak ~0.5 A + ACS 13 mA + OLED 30 mA @5V -> P5=",round(5*0.55,2),"W; Iin@12V,80% eff =",round(5*0.55/0.8/12,3),"A")
print("== Relay SRD-05VDC coil ~ 70-72 mA @5V (datasheet-class value; verify module) ==")
