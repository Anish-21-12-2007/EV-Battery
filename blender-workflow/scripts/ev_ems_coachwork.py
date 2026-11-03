"""Continuous original EV-EMS coupe coachwork, authorable parametric surfaces."""
import math
import ev_detail_geometry as g

def ease(t):
    return .5-.5*math.cos(math.pi*max(0,min(1,t)))

def width(x):
    return .885 + .035*math.exp(-((x+1.32)/.44)**2) + .055*math.exp(-((x-1.32)/.50)**2) - .023*math.exp(-(x/.65)**2) - .14*(abs(x)/2.15)**5

def shoulder(x):
    return .656 + .028*math.exp(-((x+1.32)/.50)**2) + .045*math.exp(-((x-1.27)/.53)**2) - .20*ease((-x-.82)/1.34) - .074*ease((x-1.23)/.90)

def lower(x):
    z=.070
    for axle in (-1.32,1.32):
        d=abs(x-axle)
        if d < .36: z=max(z,.18+math.sqrt(.36**2-d*d))
    return z

def top(x,t):
    # Tangential rolled shoulder: the flat hood/deck is seamlessly joined to the flank.
    return shoulder(x) + .028*(1-t*t) - .014*math.exp(-((x+1.45)/.62)**2)*(1-t*t)

def boundary(x,side=1):
    # Curved foot of canopy around the fully modelled cockpit.
    return side*(.770-.015*((x-.15)/1.5)**2), shoulder(x)+.024

def body():
    for side in (-1,1):
        g.CID = "ev_body_front"
        def flank(u,v):
            x=-2.025+4.05*u
            z0,z1=lower(x),shoulder(x)
            z=z0+(z1-z0)*v
            y=width(x)-.06*(1-v)**2+.011*math.sin(math.pi*v)-.025*ease((v-.65)/.35)
            y-=.016*math.exp(-(x/.75)**2)*math.sin(math.pi*v)**2
            return x,side*y,z
        g.surface("GT_Continuous_Sculpted_Flank_"+str(side),flank,128,24,"paint",.003,side>0)
        # Door shoulder strip follows the same tangency as the hood and deck.
        def shoulder_strip(u,v):
            x=-.86+2.23*u
            outer=width(x)-.025
            inner=abs(boundary(x)[0])
            y=inner+(outer-inner)*v
            return x,side*y,shoulder(x)+.024*(1-v*v)
        g.surface("GT_Shoulder_Transition_"+str(side),shoulder_strip,72,12,"paint",.003,side<0)
        g.CID="ev_aero"
        # Flush sill aero extrusion follows the pinched waist.
        pts=[(x,side*(width(x)-.028),.082) for x in [-.93+i*1.86/40 for i in range(41)]]
        g.pipe("GT_Rocker_Aero_"+str(side),pts,.019,"carbon",10)
        # Arch lips make a continuous semicircle with distinct dark inner lining.
        for axle in (-1.32,1.32):
            g.CID="ev_body_front" if axle<0 else "ev_body_rear"
            pts=[(axle-.36,side*(width(axle-.36)+.002),.080)]
            pts += [(axle-.36*math.cos(i*math.pi/64),side*(width(axle-.36*math.cos(i*math.pi/64))+.002),.18+.36*math.sin(i*math.pi/64)) for i in range(65)]
            pts += [(axle+.36,side*(width(axle+.36)+.002),.080)]
            g.pipe("GT_Fender_Lip_"+str((side,axle)),pts,.0055,"paint",8)
            g.pipe("GT_Wheelhouse_Seal_"+str((side,axle)),[(x,y-side*.014,z-.003) for x,y,z in pts],.008,"rubber",8)
        # Tapered door shut-lines and flush handles.
        g.CID="ev_door_l" if side>0 else "ev_door_r"
        for x in (-.82,.86):
            points=[]
            for i in range(25):
                v=.05+.90*i/24
                xx=x+.035*math.sin(v*math.pi)
                z=lower(xx)+(shoulder(xx)-lower(xx))*v
                yy=width(xx)-.06*(1-v)**2+.011*math.sin(math.pi*v)-.025*ease((v-.65)/.35)-.016*math.exp(-(xx/.75)**2)*math.sin(math.pi*v)**2
                points.append((xx,side*(yy+.001),z))
            g.pipe("GT_Door_Shutline_"+str((side,x)),points,.0016,"seam",6)
        g.box("GT_Flush_Handle_"+str(side),(.55,side*(width(.55)-.012),.57),(.15,.011,.024),"gloss_black",.009)
        g.box("GT_Handle_Insert_"+str(side),(.55,side*(width(.55)-.005),.57),(.12,.006,.010),"chrome",.003)
    # Full curved hood from swept nose edge to the windshield root.
    g.CID="ev_body_front"
    def hood(u,v):
        t=2*v-1
        x0=-2.025-.125*math.sqrt(max(0,1-t*t))
        x1=-.86-.055*(1-t*t)
        x=x0+(x1-x0)*u
        return x,(width(x)-.025)*t,top(x,t)
    g.surface("GT_Seamless_Compound_Hood",hood,64,36,"paint",.003)
    # The continuous hood surface carries its own highlights. Deliberately avoid
    # coplanar trim curves, which alias at browser camera distances.
    g.CID="ev_body_rear"
    def deck(u,v):
        t=2*v-1
        x0=1.36
        x1=2.025+.125*math.sqrt(max(0,1-t*t))
        x=x0+(x1-x0)*u
        return x,(width(x)-.025)*t,top(x,t)
    g.surface("GT_Fastback_Deck",deck,40,32,"paint",.003)
    # Compound front/rear fascias share exact outer hood/flank endpoints.
    for end in (-1,1):
        g.CID="ev_body_front" if end<0 else "ev_body_rear"
        def fascia(u,v):
            t=2*u-1
            x=end*(2.025+.125*math.sqrt(max(0,1-t*t)))
            x+=end*.020*math.sin(math.pi*v)*(1-t*t)
            y=(width(x)-.06*(1-v)**2+.011*math.sin(math.pi*v)-.025*ease((v-.65)/.35)-.016*math.exp(-(x/.75)**2)*math.sin(math.pi*v)**2)*t
            high=top(x,t)
            return x,y,.070+(high-.070)*v
        g.surface("GT_Continuous_Fascia_"+str(end),fascia,64,24,"paint",.003,end<0)
        g.CID="ev_aero"
        pts=[(end*(2.17-.14*t*t),(width(end*2.1)-.008)*t,.083) for t in [-1+2*i/64 for i in range(65)]]
        g.pipe("GT_Satin_Splitter_"+str(end),pts,.012,"carbon",8)
    g.CID="ev_aero"
    g.box("GT_Lower_Intake",(-2.171,0,.176),(.026,1.02,.090),"seam",.025)
    for y in (-.42,-.28,-.14,0,.14,.28,.42):
        g.box("GT_Active_Aero_Vane_"+str(y),(-2.186,y,.176),(.009,.010,.065),"carbon",.002)
    for side in (-1,1):
        g.box("GT_Air_Curtain_"+str(side),(-2.086,side*.635,.236),(.018,.072,.12),"gloss_black",.017,rotation=(0,0,side*.20))
    g.box("GT_Rear_Diffuser",(2.141,0,.160),(.090,1.29,.117),"carbon",.018)
    for y in (-.50,-.25,0,.25,.50):
        g.box("GT_Diffuser_Strake_"+str(y),(2.17,y,.115),(.14,.010,.063),"graphite",.003)
    pts=[(2.04-.03*t*t,.77*t,shoulder(2.04)+.035-.015*t*t) for t in [-1+2*i/48 for i in range(49)]]
    g.pipe("GT_Integral_Deck_Lip",pts,.008,"carbon",8)
    g.CID="ev_body_front"
    g.label("GT_Hood_Badge","E V - E M S",(-1.94,0,top(-1.94,0)+.010),.032,"chrome",(0,.14,0))
    g.CID="ev_body_rear"
    g.label("GT_Rear_Lettering","E V - E M S",(2.168,0,.43),.035,"chrome",(math.pi/2,0,math.pi/2))
    g.box("GT_Rear_Plate",(2.176,0,.285),(.008,.29,.058),"gloss_black",.006)
    g.label("GT_Rear_Plate_Text","GT / ELECTRIC",(2.182,0,.285),.020,"lettering",(math.pi/2,0,math.pi/2))

def canopy():
    # Rounded panoramic fastback canopy. All edges are sampled curves rather
    # than straight tubular corners; glazing perimeter and painted rails agree.
    front_bottom, front_top = -.87,-.26
    rear_top,rear_bottom=.65,1.36
    def roof(u,v):
        t=2*v-1
        x=front_top+(rear_top-front_top)*u
        w=.623+.018*math.sin(math.pi*u)
        z=1.097+.037*math.sin(math.pi*u)+.035*(1-t*t)
        return x,w*t,z
    g.CID="ev_roof"
    g.surface("GT_Curved_Roof",roof,40,32,"paint",.004)
    g.CID="ev_glass"
    def wind(u,v):
        t=2*v-1
        x0=front_bottom-.045*(1-t*t)
        x=x0+(front_top-x0)*u-.028*math.sin(math.pi*u)*(1-t*t)
        y=(.759+(.623-.759)*u)*t
        z0=shoulder(front_bottom)+.026
        z=z0+(1.097-z0)*u+.035*(1-t*t)*u
        return x,y,z
    def rear(u,v):
        t=2*v-1
        x=rear_top+(rear_bottom-rear_top)*u+.035*math.sin(math.pi*u)*(1-t*t)
        y=(.623+(.761-.623)*u)*t
        z=1.097+(shoulder(rear_bottom)+.026-1.097)*u+.035*(1-t*t)*(1-u)
        return x,y,z
    g.surface("GT_Panoramic_Windshield",wind,40,32,"glass",0)
    g.surface("GT_Fastback_Rear_Glass",rear,44,32,"glass",0)
    for side in (-1,1):
        def sidewindow(u,v):
            # Horizontal strip between lower belt line and gently curved roof.
            bottom_x=front_bottom+(rear_bottom-front_bottom)*u
            top_x=front_top+(rear_top-front_top)*u
            x=bottom_x+(top_x-bottom_x)*v
            y0=.759+.003*math.sin(math.pi*u)
            y1=.623+.018*math.sin(math.pi*u)
            y=y0+(y1-y0)*v+.006*math.sin(math.pi*v)
            z0=shoulder(bottom_x)+.026
            z1=1.097+.037*math.sin(math.pi*u)
            z=z0+(z1-z0)*v
            return x,side*y,z
        g.CID="ev_glass"
        g.surface("GT_Curved_Side_Glass_"+str(side),lambda u,v: sidewindow(.024+.812*u,v),48,24,"glass",0,side>0)
        g.CID="ev_roof"
        g.surface("GT_Sculpted_C_Pillar_"+str(side),lambda u,v:sidewindow(.836+.164*u,v),12,24,"paint",.003,side>0)
        g.surface("GT_Slim_A_Pillar_"+str(side),lambda u,v:sidewindow(.024*u,v),4,24,"paint",.003,side>0)
        # Thin painted rails and black flush seals define the curved canopy.
        border=[wind(i/32,1 if side>0 else 0) for i in range(33)]
        border += [roof(i/32,1 if side>0 else 0) for i in range(1,33)]
        border += [rear(i/32,1 if side>0 else 0) for i in range(1,33)]
        g.pipe("GT_Slim_Canopy_Rail_"+str(side),border,.012,"paint",10)
        sill=[sidewindow(i/48,0) for i in range(49)]
        g.pipe("GT_Glass_Belt_Seal_"+str(side),sill,.007,"gloss_black",8)
        # Flat glossy B-pillar follows the side window, not a protruding tube.
        pts=[sidewindow(.63,v) for v in [i/24 for i in range(25)]]
        g.pipe("GT_Flush_B_Pillar_"+str(side),pts,.013,"gloss_black",8)
        g.CID="ev_mirrors"
        g.rod("GT_Mirror_Stalk_"+str(side),(-.65,side*.777,.704),(-.59,side*.938,.719),.011,"carbon")
        g.box("GT_Aerodynamic_Mirror_"+str(side),(-.60,side*.978,.751),(.19,.115,.057),"paint",.025)
        g.box("GT_Mirror_Glass_"+str(side),(-.506,side*.978,.751),(.004,.087,.037),"mirror",.015)
    g.CID="ev_roof"
    for fn,edge in ((wind,0),(wind,1),(rear,0),(rear,1)):
        g.pipe("GT_Glazing_Seal_"+str((fn.__name__,edge)),[fn(edge,i/48) for i in range(49)],.005,"gloss_black",8)
    for y in (-.29,.29):
        g.pipe("GT_Recessed_Wiper_"+str(y),[(-.88,y,.70),(-.76,y+.12,.79)],.003,"graphite",6)

def lights():
    g.CID="ev_lights"
    for side in (-1,1):
        pts=[]
        for i in range(33):
            u=i/32
            y=side*(.28+.46*u)
            t=y/(width(-2.1)-.025)
            x=-2.15+.125*t*t-.026
            z=.388+.040*u
            pts.append((x,y,z))
        g.pipe("GT_Headlamp_Housing_"+str(side),pts,.024,"gloss_black",12)
        g.pipe("GT_Signature_DRL_"+str(side),[(x-.022,y,z+.007) for x,y,z in pts],.0055,"led_white",8)
        g.pipe("GT_Headlamp_Lower_Reflector_"+str(side),[(x-.021,y,z-.009) for x,y,z in pts],.003,"chrome",8)
        for j in range(6):
            u=.10+j*.14
            y=side*(.28+.46*u)
            t=y/(width(-2.1)-.025)
            x=-2.15+.125*t*t-.050
            z=.388+.040*u
            g.box("GT_LED_Projector_"+str((side,j)),(x,y,z),(.011,.028,.017),"led_white",.004)
    pts=[]
    for i in range(65):
        t=-1+2*i/64
        pts.append((2.15-.12*t*t+.025,.745*t,.509+.022*(1-t*t)))
    g.pipe("GT_Rear_Light_Housing",pts,.020,"gloss_black",10)
    g.pipe("GT_Rear_Fullwidth_LED",[(x+.018,y,z) for x,y,z in pts],.005,"led_red",8)
    for side in (-1,1):
        g.box("GT_Rear_Reflector_"+str(side),(2.112,side*.64,.27),(.007,.085,.016),"red_lens",.005)

def install():
    g.build_body=body
    g.build_canopy=canopy
    g.build_lights=lights
