// Physical-style planning layout. Terminal positions are deliberately logical:
// no installed board variant or header position is established by the handoff.
const NS = 'http://www.w3.org/2000/svg';
const BASE = './FINAL_EV_EMS_ENGINEERING_PACKAGE/';
const W = 1840, H = 1710, GRID = 20;
const html = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keyOf = (id, pin) => `${id}.${pin}`;
const PLACEMENTS = {
  BAT1:[40,100,220,280,'battery','Battery · identity pending'], F1:[340,100,120,150,'fuse','Main fuse'],
  SW1:[540,100,140,150,'switch','Master switch'], 'BUS+':[780,100,220,200,'terminal','Positive distribution'],
  FL:[1090,20,120,150,'fuse','Light fuse'], S_L:[1280,20,200,240,'sensor','Light sensor · TBD'], L1:[1570,20,200,220,'light','12 V lamp candidate'],
  FM:[1090,340,120,150,'fuse','Motor fuse'], S_M:[1280,340,200,280,'sensor','ACS712 IC candidate'],
  MDRV:[1570,340,200,280,'board','Motor controller · TBD'], M1:[1570,690,200,220,'motor','Motor · identity pending'],
  F2:[540,500,120,150,'fuse','Electronics fuse'], U_BUCK_BOARD:[780,480,240,260,'converter','DC/DC module · TBD'],
  JGND:[40,540,340,210,'ground','Separate return domains'], U_I_L:[1070,690,180,190,'board','Light conditioner · TBD'],
  C_BYP_M:[1290,690,120,180,'capacitor','100 nF candidate'], C_FILTER_M:[1430,690,120,180,'capacitor','FILTER capacitor · TBD'],
  R_LH:[70,960,140,170,'resistor','68 kΩ · 1% assumed'], NODE_VL:[300,1020,90,80,'node','V_L junction'],
  R_LL:[250,1190,140,170,'resistor','10 kΩ · 1% assumed'], C_L:[70,1190,140,170,'capacitor','100 nF assumed'],
  R_MH:[510,960,140,170,'resistor','27 kΩ · 1% assumed'], NODE_IM:[740,1020,90,80,'node','I_M junction'],
  R_ML:[690,1190,140,170,'resistor','20 kΩ · 1% assumed'], C_M:[510,1190,140,170,'capacitor','100 nF assumed'],
  R_VH:[950,960,140,170,'resistor','68 kΩ · 1% assumed'], NODE_VM:[1180,1020,90,80,'node','V_M junction'],
  R_VL:[1130,1190,140,170,'resistor','10 kΩ · 1% assumed'], C_V:[950,1190,140,170,'capacitor','100 nF assumed'],
  U_ESP:[1400,1010,360,370,'esp','Classic ESP32 candidate'], U_OLED_BOARD:[50,1460,260,210,'oled','Optional OLED · TBD'],
  T1_PROBE:[370,1460,230,210,'probe','Optional DS18B20 · TBD'], TVS1:[40,410,250,100,'protection','Bus TVS · unresolved'],
  RP1:[730,1470,200,160,'unwired','Reverse polarity · TBD'], D1:[1000,1470,180,160,'unwired','Motor suppression · TBD'],
  RLY1:[1250,1470,260,160,'relay','Legacy relay · UNWIRED'],
};
const COLORS = { power:'#c5453c', logic:'#c77b21', supply3v3:'#986aa9', ground:'#242b31', analog:'#18858a', communication:'#4b67bd', motor:'#a25d2e', unresolved:'#8b737d' };

export function wireCategory(wire) {
  const n = wire.net_or_domain;
  if (/RETURN|GND|GROUND|KELVIN/.test(n) || [wire.source_terminal,wire.destination_terminal].some(pin=>['GND','LOGIC_GND','STAR_RETURN'].includes(pin))) return 'ground';
  if (/3V3/.test(n) || wire.source_terminal==='3V3') return 'supply3v3';
  if (/I2C|1WIRE/.test(n)) return 'communication';
  if (/ADC|SIGNAL|FILTER|BANDWIDTH|TAP/.test(n)) return 'analog';
  if (/MOTOR_DRIVE_OUT/.test(n)) return 'motor';
  if (/5V|LOGIC_SUPPLY/.test(n)) return 'logic';
  if (/SENSOR_SUPPLY|CLAMP/.test(n)) return 'unresolved';
  return 'power';
}
export function connectionClass(wire) {
  return /CALCULATED AND CROSS-CHECKED|DESIGN ASSUMPTION/.test(wire.status) ? 'proposed' : 'unresolved';
}

function pinSide(component, pin, index) {
  if (component === 'U_ESP') return ['5V_IN','GND','GPIO32','GPIO33','GPIO34','GPIO35'].includes(pin) ? 'left' : 'right';
  if (component === 'JGND') return pin === 'STAR_RETURN' ? 'left' : 'right';
  if (component === 'BUS+') return pin === 'IN' ? 'left' : 'right';
  if (component === 'BAT1') return 'right';
  if (/^NODE_/.test(component)) return 'right';
  if (['IN','IN+','IN-','INPUT+','INPUT-','IP+','A'].includes(pin)) return 'left';
  if (['OUT','OUT+','OUT-','MOTOR_OUT+','MOTOR_OUT-','IP-','B'].includes(pin)) return 'right';
  return index % 2 ? 'left' : 'right';
}

function routeWire(source, destination, components, wireIndex, occupancy) {
  const sourceOut = {x: source.x + (source.side === 'left' ? -30 : 30), y:source.y};
  const destinationOut = {x: destination.x + (destination.side === 'left' ? -30 : 30), y:destination.y};
  const cols = Math.ceil(W / GRID), rows = Math.ceil(H / GRID);
  const snap = (p) => [Math.max(0,Math.min(cols-1,Math.round(p.x/GRID))),Math.max(0,Math.min(rows-1,Math.round(p.y/GRID)))];
  const start = snap(sourceOut), end = snap(destinationOut);
  const index = (x,y) => y * cols + x;
  const endKey = index(...end), startKey = index(...start);
  const blocked = new Set();
  for (const c of components) {
    for (let y=Math.ceil((c.y-5)/GRID);y<=Math.floor((c.y+c.h+5)/GRID);y++) {
      for (let x=Math.ceil((c.x-5)/GRID);x<=Math.floor((c.x+c.w+5)/GRID);x++) blocked.add(index(x,y));
    }
  }
  blocked.delete(startKey); blocked.delete(endKey);
  const cost = new Map([[startKey,0]]), parent = new Map(), direction = new Map();
  const open = [{key:startKey,x:start[0],y:start[1],f:0}], closed = new Set();
  let found = false;
  while(open.length) {
    let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;
    const current=open.splice(best,1)[0];
    if(closed.has(current.key))continue;
    if(current.key===endKey){found=true;break;}closed.add(current.key);
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]) {
      const x=current.x+dx,y=current.y+dy,k=index(x,y);
      if(x<0||y<0||x>=cols||y>=rows||blocked.has(k)||closed.has(k))continue;
      const previous=direction.get(current.key), d=dx?1:2;
      const g=cost.get(current.key)+1+(previous && previous !== d ? .2 : 0)+(occupancy.get(k)||0)*.035;
      if(g<(cost.get(k)??Infinity)){cost.set(k,g);parent.set(k,current.key);direction.set(k,d);open.push({key:k,x,y,f:g+Math.abs(x-end[0])+Math.abs(y-end[1])});}
    }
  }
  if(!found) throw new Error(`Cannot route source wire ${wireIndex + 1} without entering a component`);
  const path=[];let k=endKey;
  while(k!==undefined){path.push([k%cols*GRID,Math.floor(k/cols)*GRID]);occupancy.set(k,(occupancy.get(k)||0)+1);if(k===startKey)break;k=parent.get(k);}
  path.reverse();
  const pts=[[source.x,source.y],[sourceOut.x,source.y],[sourceOut.x,path[0][1]],...path,[destinationOut.x,path.at(-1)[1]],[destinationOut.x,destination.y],[destination.x,destination.y]];
  const simplified=pts.filter((p,i)=>!i||p[0]!==pts[i-1][0]||p[1]!==pts[i-1][1]);
  for(let i=simplified.length-2;i>0;i--)if((simplified[i-1][0]===simplified[i][0]&&simplified[i][0]===simplified[i+1][0])||(simplified[i-1][1]===simplified[i][1]&&simplified[i][1]===simplified[i+1][1]))simplified.splice(i,1);
  return simplified;
}
function roundedPath(points) {
  let d=`M ${points[0][0]} ${points[0][1]}`;
  for(let i=1;i<points.length-1;i++) {
    const a=points[i-1],b=points[i],c=points[i+1],r=Math.min(9,Math.hypot(b[0]-a[0],b[1]-a[1])/2,Math.hypot(c[0]-b[0],c[1]-b[1])/2);
    const before=[b[0]+Math.sign(a[0]-b[0])*r,b[1]+Math.sign(a[1]-b[1])*r],after=[b[0]+Math.sign(c[0]-b[0])*r,b[1]+Math.sign(c[1]-b[1])*r];
    d+=` L ${before[0]} ${before[1]} Q ${b[0]} ${b[1]} ${after[0]} ${after[1]}`;
  }
  return d+` L ${points.at(-1)[0]} ${points.at(-1)[1]}`;
}

export function buildWiringModel(wires, bom) {
  const ids = new Set(bom.map(row=>row.ID));
  const terminals = new Map();
  for (const wire of wires) {
    for(const [id,terminal] of [[wire.source_component,wire.source_terminal],[wire.destination_component,wire.destination_terminal]]) {
      if(!ids.has(id)||!PLACEMENTS[id]||!terminal)throw new Error(`Unrecognized source endpoint ${id}.${terminal}`);
      if(!terminals.has(id))terminals.set(id,[]);if(!terminals.get(id).includes(terminal))terminals.get(id).push(terminal);
    }
  }
  const components=[...terminals].map(([id,terminalNames])=>{
    const [x,y,w,h,type,name]=PLACEMENTS[id], row=bom.find(row=>row.ID===id);
    return {id,x,y,w,h,type,name,row,terminalNames,placementStatus:'UNRESOLVED — logical anchors; physical footprint and pin positions not verified'};
  });
  const pins=[];
  for(const c of components) {
    const sides={left:[],right:[]};c.terminalNames.forEach((pin,i)=>sides[pinSide(c.id,pin,i)].push(pin));
    for(const side of ['left','right'])sides[side].forEach((terminal,i)=>{
      const available=c.h-84,step=Math.min(28,available/Math.max(1,sides[side].length));
      const y=c.type==='node'?c.y+40:c.y+76+i*step;
      pins.push({key:keyOf(c.id,terminal),component:c.id,terminal,side,x:side==='left'?c.x:c.x+c.w,y,
        wireIds:wires.filter(w=>(w.source_component===c.id&&w.source_terminal===terminal)||(w.destination_component===c.id&&w.destination_terminal===terminal)).map(w=>w.wire_id)});
    });
  }
  const byPin=new Map(pins.map(pin=>[pin.key,pin])), occupancy=new Map();
  const routes=wires.map((wire,i)=>{
    const source=byPin.get(keyOf(wire.source_component,wire.source_terminal)),destination=byPin.get(keyOf(wire.destination_component,wire.destination_terminal));
    const points=routeWire(source,destination,components,i,occupancy);
    return {...wire,source,destination,points,path:roundedPath(points),category:wireCategory(wire),classification:connectionClass(wire),physicalVerification:'UNVERIFIED'};
  });
  return {components,pins,wires:routes,unwired:bom.filter(row=>!terminals.has(row.ID)),width:W,height:H};
}

function artwork(c) {
  const cx=c.w/2, y=Math.min(c.h-60,Math.max(82,c.h*.57));
  const hole=(x,y)=>`<circle cx="${x}" cy="${y}" r="6" fill="#849789" stroke="#35483d"/><path d="M${x-3} ${y}h6" stroke="#26392f"/>`;
  if(c.type==='battery')return `<rect x="35" y="108" width="150" height="112" rx="9" fill="#303b43"/><path d="M35 118l18-17h115l17 17" fill="#4b5b63"/><rect x="72" y="140" width="78" height="47" rx="2" fill="#d9dfd3"/><text x="111" y="160" text-anchor="middle" class="wl-art-label">12 V</text><text x="111" y="179" text-anchor="middle" class="wl-art-mini">CANDIDATE</text><rect x="53" y="94" width="18" height="13" rx="3" fill="#c05c4c"/><rect x="152" y="94" width="18" height="13" rx="3" fill="#293034"/>`;
  if(c.type==='fuse')return `<rect x="27" y="74" width="66" height="34" rx="13" fill="#27333a"/><rect x="44" y="81" width="32" height="20" rx="3" fill="#b3d1c5" stroke="#6a8177"/><rect x="36" y="80" width="10" height="22" fill="#aab0b1"/><rect x="75" y="80" width="10" height="22" fill="#aab0b1"/><path d="M47 91h26" stroke="#b5885b" stroke-width="2"/>`;
  if(c.type==='switch')return `<rect x="47" y="73" width="45" height="48" rx="7" fill="#263136"/><path d="M51 78h37v29l-37 8z" fill="#667979"/><path d="M68 83v13M65 105h8" stroke="#e2e8de" stroke-width="2"/>`;
  if(c.type==='terminal'||c.type==='ground')return `<rect x="${cx-65}" y="${y-25}" width="130" height="50" rx="5" fill="${c.type==='ground'?'#384349':'#437367'}"/>${[-42,-14,14,42].map(dx=>hole(cx+dx,y)).join('')}<text x="${cx}" y="${y+49}" text-anchor="middle" class="wl-art-mini">${c.type==='ground'?'STAR / LOGIC — SEPARATE':'TERMINAL BLOCK TBD'}</text>`;
  if(c.type==='resistor')return `<path d="M25 ${y}h90" stroke="#8d9e9d" stroke-width="3"/><rect x="44" y="${y-12}" width="52" height="24" rx="9" fill="#709ab0" stroke="#436879"/><path d="M51 ${y-11}v22m36-22v22" stroke="#3e6273" stroke-width="3"/>`;
  if(c.type==='capacitor')return `<path d="M${cx-8} ${y+5}v26m16-26v26" stroke="#85938d" stroke-width="3"/><ellipse cx="${cx}" cy="${y-5}" rx="24" ry="20" fill="#b28843" stroke="#815b26"/><path d="M${cx-13} ${y-15}q14-10 26 0" fill="none" stroke="#d5b978"/>`;
  if(c.type==='node')return `<circle cx="${cx}" cy="40" r="16" fill="#cbba85" stroke="#7a7048" stroke-width="3"/><circle cx="${cx}" cy="40" r="5" fill="#667568"/>`;
  if(c.type==='light')return `<path d="M${cx-45} ${y+22}h90l-12-57h-66z" fill="#425462"/><ellipse cx="${cx}" cy="${y-29}" rx="40" ry="14" fill="#d5e0d2" stroke="#667d7f"/><path d="M${cx-27} ${y-29}h54" stroke="#f9f3bd" stroke-width="4"/>`;
  if(c.type==='motor')return `<rect x="${cx-59}" y="${y-26}" width="105" height="57" rx="10" fill="#839598" stroke="#42585c"/><ellipse cx="${cx-51}" cy="${y+2}" rx="15" ry="29" fill="#a7b4af"/><ellipse cx="${cx+43}" cy="${y+2}" rx="15" ry="29" fill="#627d82"/><path d="M${cx+45} ${y+2}h32" stroke="#354b51" stroke-width="12"/><path d="M${cx-26} ${y-20}v45m18-45v45m18-45v45" stroke="#60797b"/>`;
  if(c.type==='probe')return `<path d="M${cx-78} ${y+16}h70" stroke="#4f5b58" stroke-width="7"/><rect x="${cx-12}" y="${y+5}" width="84" height="23" rx="11" fill="#a7b9bb" stroke="#597678"/><path d="M${cx+3} ${y+10}h56" stroke="#d3dcda" stroke-width="3"/>`;
  if(c.type==='oled')return `<rect x="${cx-66}" y="${y-37}" width="132" height="72" rx="5" fill="#254b5c"/><rect x="${cx-55}" y="${y-27}" width="110" height="51" rx="4" fill="#142b32"/><text x="${cx}" y="${y-1}" text-anchor="middle" fill="#b2cfd1" font-size="12">OPTIONAL</text><text x="${cx}" y="${y+15}" text-anchor="middle" fill="#758e8d" font-size="9">PIN ORDER UNKNOWN</text>`;
  if(c.type==='protection'||c.type==='unwired'||c.type==='relay')return `<rect x="${cx-40}" y="${y-21}" width="80" height="42" rx="4" fill="${c.type==='relay'?'#44688a':'#635756'}" stroke="#8f8780" stroke-dasharray="4 4"/><text x="${cx}" y="${y+5}" text-anchor="middle" fill="#e1d3c5" font-size="13">TBD</text>`;
  const bw=c.type==='esp'?145:80,bh=c.type==='esp'?135:65;
  return `<rect x="${cx-bw/2-16}" y="${y-bh/2-12}" width="${bw+32}" height="${bh+24}" rx="6" fill="#38604f" stroke="#294336"/>${hole(cx-bw/2-6,y-bh/2-2)}${hole(cx+bw/2+6,y+bh/2+2)}<rect x="${cx-bw/2}" y="${y-bh/2}" width="${bw}" height="${bh}" rx="4" fill="${c.type==='esp'?'#a6b1ae':c.type==='converter'?'#70828a':'#344747'}" stroke="#28393a"/>${c.type==='converter'?`<circle cx="${cx}" cy="${y}" r="24" fill="#3c4440"/><circle cx="${cx}" cy="${y}" r="14" fill="#7d897c"/>`:`<text x="${cx}" y="${y-3}" text-anchor="middle" class="wl-art-label">${c.type==='esp'?'ESP32':c.type==='sensor'?'SENSOR':'MODULE'}</text><text x="${cx}" y="${y+16}" text-anchor="middle" class="wl-art-mini">CANDIDATE</text>`}`;
}

export function initWiringLayout(container, data) {
  const model=buildWiringModel(data.wires,data.bom);
  let selection={type:'wire',id:'W001'}, category='all', zoom=1, box={x:0,y:0,w:W,h:H}, drag=null;
  container.innerHTML=`<div class="wl-heading"><div><span class="lab-kicker">12 V EDUCATIONAL CIRCUIT / CONNECTION-LEVEL VIEW</span><h3>Trace every terminal.</h3><p>Component-style layout with source-matched wires. Physical footprints and pin positions are <strong>UNRESOLVED</strong>.</p></div><a class="lab-source" href="validation/wiring-source-verification.json" target="_blank" rel="noopener">36 files matched to original ZIP ↗</a></div>
    <div class="wl-toolbar"><label class="lab-field wl-find"><span>Find wire, component or terminal</span><input id="wiring-search" type="search" placeholder="W037, ESP32, GPIO34…" autocomplete="off" aria-controls="wiring-search-results"></label><label class="lab-field"><span>Wire family</span><select id="wiring-family"><option value="all">All 60 connections</option><option value="power">Positive distribution</option><option value="logic">5 V supply</option><option value="supply3v3">3.3 V optional supply</option><option value="ground">Return / reference</option><option value="analog">Analog / sensing</option><option value="communication">Communication</option><option value="motor">Switched motor output</option><option value="unresolved">Unresolved supply / protection</option></select></label><div class="wl-tools"><button type="button" class="lab-action" data-wiring-tool="out" aria-label="Zoom wiring layout out">−</button><output id="wiring-zoom">100%</output><button type="button" class="lab-action" data-wiring-tool="in" aria-label="Zoom wiring layout in">+</button><button type="button" class="lab-action" data-wiring-tool="fit">Fit all</button><button type="button" class="lab-action" data-wiring-tool="focus">Focus selection</button><button type="button" class="lab-action" data-wiring-tool="clear">Clear selection</button></div></div><div id="wiring-search-results" class="wl-search-results" hidden></div>
    <div class="wl-workspace"><div class="wl-canvas-wrap"><div class="wl-canvas-caption"><span>LOGICAL TERMINAL ANCHORS · NOT A BOARD PINOUT</span><span>Drag background to pan · wheel to zoom</span></div><svg id="wiring-canvas" class="wl-canvas" viewBox="0 0 ${W} ${H}" role="img" aria-label="Interactive physical-style component layout. Exact logical source endpoints; installed footprints and physical pin locations unresolved." tabindex="0"><defs><pattern id="wl-dot-pattern" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#94a6a5" opacity=".33"/></pattern><filter id="wl-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#1f3836" flood-opacity=".12"/></filter></defs><rect class="wl-mat" x="-10000" y="-10000" width="20000" height="20000" fill="#d1dbd7"/><rect x="0" y="0" width="${W}" height="${H}" fill="url(#wl-dot-pattern)"/><g class="wl-districts"><text x="40" y="55">01 / SUPPLY &amp; DISTRIBUTION</text><text x="1080" y="320">02 / MOTOR BRANCH</text><text x="40" y="930">03 / VOLTAGE &amp; CURRENT CONDITIONING</text><text x="1400" y="970">04 / MEASUREMENT</text><text x="40" y="1430">05 / OPTIONAL PERIPHERALS</text><text x="730" y="1430">06 / UNSCHEDULED — DO NOT INFER CONNECTIONS</text></g><g class="wl-wire-layer"></g><g class="wl-component-layer"></g><g class="wl-highlight-layer" pointer-events="none"></g><g class="wl-pin-layer"></g></svg><div class="wl-canvas-footer"><span id="wiring-route-status">60 source-matched routes · 87 logical terminals</span><div class="wl-pan-tools" aria-label="Pan wiring layout"><button type="button" data-wiring-pan="left" aria-label="Pan wiring left">←</button><button type="button" data-wiring-pan="up" aria-label="Pan wiring up">↑</button><button type="button" data-wiring-pan="down" aria-label="Pan wiring down">↓</button><button type="button" data-wiring-pan="right" aria-label="Pan wiring right">→</button></div></div></div><aside class="wl-inspector" aria-label="Selected wiring connection" aria-live="polite"></aside></div>
    <div class="wl-legend">${Object.entries(COLORS).map(([name,color])=>`<span><i style="background:${color}"></i>${({power:'Positive',logic:'5 V',supply3v3:'3.3 V',ground:'Return',analog:'Analog',communication:'Communication',motor:'PWM motor',unresolved:'Unresolved'})[name]}</span>`).join('')}<span class="wl-line-key">Solid: proposed · Dashed: unresolved</span></div>
    <p class="wl-boundary">Wire colours are display conventions, not actual conductor colours or ratings. Crossings and overlapping routes do not create junctions; only the same labeled terminal joins connections. Every endpoint and condition comes from W001–W060. <strong>No connection is physically verified; none is simulation-only.</strong> Unknown footprints are illustrative bodies with explicitly logical anchors. W060's anode return, RP1 insertion, relay terminals and other unscheduled connections are not invented.</p>
    <details class="wl-register"><summary>Complete connection index · 60 source rows</summary><div class="wl-index">${model.wires.map(w=>`<button type="button" data-wiring-index="${w.wire_id}"><strong>${w.wire_id}</strong><span>${html(w.source.key)} → ${html(w.destination.key)}</span><small>${w.classification.toUpperCase()}</small></button>`).join('')}</div></details>`;
  const $=s=>container.querySelector(s),$$=s=>[...container.querySelectorAll(s)];
  const canvas=$('#wiring-canvas'),wireLayer=$('.wl-wire-layer'),componentLayer=$('.wl-component-layer'),pinLayer=$('.wl-pin-layer'),highlight=$('.wl-highlight-layer');
  wireLayer.innerHTML=model.wires.map(w=>`<g data-wire-id="${w.wire_id}" data-source-component="${html(w.source_component)}" data-source-pin="${html(w.source_terminal)}" data-destination-component="${html(w.destination_component)}" data-destination-pin="${html(w.destination_terminal)}" data-physical-status="UNVERIFIED" data-source-status="${html(w.status)}" class="wl-wire ${w.classification}" style="--wire-color:${COLORS[w.category]}"><path class="wl-wire-sheath" d="${w.path}"/><path class="wl-wire-core" d="${w.path}"/><path class="wl-wire-hit" d="${w.path}" role="button" tabindex="0" aria-label="${w.wire_id}: ${html(w.source.key)} to ${html(w.destination.key)}; ${w.classification}"/><title>${w.wire_id} · ${html(w.net_or_domain)}</title></g>`).join('');
  const extras=['RP1','D1','RLY1'].map(id=>{const [x,y,w,h,type,name]=PLACEMENTS[id];return{id,x,y,w,h,type,name,row:model.unwired.find(row=>row.ID===id),terminalNames:[]};});
  const renderedComponents=[...model.components,...extras];
  componentLayer.innerHTML=renderedComponents.map(c=>`<g class="wl-component ${c.type}" data-component-id="${html(c.id)}" transform="translate(${c.x},${c.y})" role="button" tabindex="0" aria-label="${html(c.id)} ${html(c.name)}. Physical footprint unresolved"><rect class="wl-component-case" width="${c.w}" height="${c.h}" rx="${c.type==='node'?35:10}" filter="url(#wl-shadow)"/><text x="12" y="23" class="wl-component-code">${html(c.id)}</text>${c.type==='node'?'':`<text x="12" y="44" class="wl-component-name">${html(c.name)}</text>`}${artwork(c)}<text x="${c.w/2}" y="${c.h-12}" text-anchor="middle" class="wl-component-unresolved">${c.type==='node'?'LOGICAL NODE':c.type==='unwired'||c.type==='relay'?'NO SCHEDULED TERMINALS':'FOOTPRINT UNRESOLVED'}</text></g>`).join('');
  pinLayer.innerHTML=model.pins.map(pin=>`<g class="wl-pin" data-pin-key="${html(pin.key)}" data-component="${html(pin.component)}" data-terminal="${html(pin.terminal)}" role="button" tabindex="0" aria-label="${html(pin.key)}: ${pin.wireIds.length} source connections; logical anchor only"><circle class="wl-pin-hit" cx="${pin.x}" cy="${pin.y}" r="15"/><circle class="wl-pin-ring" cx="${pin.x}" cy="${pin.y}" r="6"/><circle class="wl-pin-center" cx="${pin.x}" cy="${pin.y}" r="2"/><text x="${pin.x+(pin.side==='left'?11:-11)}" y="${pin.y+4}" text-anchor="${pin.side==='left'?'start':'end'}">${html(pin.terminal)}</text></g>`).join('');
  function selectedWires(){return !selection?[]:selection.type==='wire'?model.wires.filter(w=>w.wire_id===selection.id):selection.type==='pin'?model.wires.filter(w=>w.source.key===selection.id||w.destination.key===selection.id):model.wires.filter(w=>w.source_component===selection.id||w.destination_component===selection.id);}
  function setBox(next){box=next;zoom=W/box.w;canvas.setAttribute('viewBox',`${box.x} ${box.y} ${box.w} ${box.h}`);$('#wiring-zoom').textContent=`${Math.round(zoom*100)}%`;canvas.dataset.zoom=String(zoom);canvas.dataset.pan=`${box.x.toFixed(1)},${box.y.toFixed(1)}`;}
  function fit(){setBox({x:-25,y:-25,w:W+50,h:H+50});}
  function zoomAt(factor,x=.5,y=.5){const next=Math.max(.65,Math.min(5,zoom*factor)),nw=W/next,nh=H/next;setBox({x:box.x+(box.w-nw)*x,y:box.y+(box.h-nh)*y,w:nw,h:nh});}
  function focusSelection(){const selected=selectedWires();let pts=selected.flatMap(w=>w.points);if(selection?.type==='component'){const c=renderedComponents.find(c=>c.id===selection.id);if(c)pts=[[c.x,c.y],[c.x+c.w,c.y+c.h]];}if(!pts.length)return;const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const width=Math.max(560,Math.max(...xs)-Math.min(...xs)+150),height=Math.max(420,Math.max(...ys)-Math.min(...ys)+150);const scale=Math.max(width/W,height/H);setBox({x:(Math.max(...xs)+Math.min(...xs)-W*scale)/2,y:(Math.max(...ys)+Math.min(...ys)-H*scale)/2,w:W*scale,h:H*scale});}
  function renderSelection(){
    const selected=selectedWires(),selectedIds=new Set(selected.map(w=>w.wire_id));
    $$('.wl-wire').forEach(el=>{const w=model.wires.find(w=>w.wire_id===el.dataset.wireId);el.classList.toggle('is-dimmed',!!selection&&!selectedIds.has(w.wire_id));el.classList.toggle('is-filtered',category!=='all'&&w.category!==category&&!selectedIds.has(w.wire_id));el.classList.toggle('is-selected',selectedIds.has(w.wire_id));});
    $$('.wl-component').forEach(el=>el.classList.toggle('is-selected',selection?.type==='component'&&selection.id===el.dataset.componentId));
    $$('.wl-pin').forEach(el=>el.classList.toggle('is-selected',selected.some(w=>w.source.key===el.dataset.pinKey||w.destination.key===el.dataset.pinKey)));
    highlight.innerHTML=selected.map(w=>`<path d="${w.path}" fill="none" stroke="#fbf8df" stroke-width="9" opacity=".86"/><path data-highlight-wire="${w.wire_id}" d="${w.path}" fill="none" stroke="${COLORS[w.category]}" stroke-width="4" stroke-linecap="round" ${w.classification==='unresolved'?'stroke-dasharray="8 4"':''}/><g class="wl-wire-tag" transform="translate(${w.points[Math.floor(w.points.length/2)][0]},${w.points[Math.floor(w.points.length/2)][1]})"><rect x="-24" y="-11" width="48" height="22" rx="5"/><text text-anchor="middle" y="4">${w.wire_id}</text></g>`).join('');
    const inspector=$('.wl-inspector');
    if(!selection){inspector.innerHTML='<span class="lab-kicker">CONNECTION INSPECTOR</span><h3>Choose a wire or terminal.</h3><p>Click a visible cable, pin anchor or component. Search or the complete index can find routes in dense areas.</p><p class="wl-inspector-warning">The arrangement is illustrative. No board footprint, header position or conductor rating is established.</p>';}
    else if(selection.type==='wire'){
      const w=selected[0];inspector.innerHTML=`<span class="lab-kicker">SOURCE CONNECTION / ${w.wire_id}</span><div class="wl-selection-title"><h3>${w.wire_id}</h3><span>${w.classification.toUpperCase()}</span></div><div class="wl-endpoint"><small>FROM</small><strong>${html(w.source_component)}</strong><code>${html(w.source_terminal)}</code></div><div class="wl-endpoint-arrow">↓</div><div class="wl-endpoint"><small>TO</small><strong>${html(w.destination_component)}</strong><code>${html(w.destination_terminal)}</code></div><dl><dt>Purpose / domain</dt><dd>${html(w.net_or_domain)}</dd><dt>Original source status</dt><dd>${html(w.status)}</dd><dt>Engineering condition</dt><dd>${html(w.evidence_or_condition)}</dd><dt>Physical verification</dt><dd>UNVERIFIED. Endpoint identity is source-matched; drawn terminal locations are logical anchors.</dd></dl><a class="lab-source" href="${BASE}03_Circuit_Design/wiring_connections.csv" target="_blank" rel="noopener">Original W001–W060 register ↗</a>`;
    } else {
      const id=selection.type==='pin'?model.pins.find(p=>p.key===selection.id).component:selection.id,row=data.bom.find(c=>c.ID===id);
      inspector.innerHTML=`<span class="lab-kicker">${selection.type==='pin'?'LOGICAL TERMINAL':'COMPONENT'} INSPECTOR</span><h3>${html(selection.id)}</h3><p>${html(row?.['Proposed identity / rating']||'Unresolved component')}</p><p class="wl-inspector-warning">UNRESOLVED physical footprint and pin positions. Anchor order and body dimensions are illustrative.</p><dl><dt>Original component status</dt><dd>${html(row?.Status||'UNRESOLVED')}</dd><dt>Source audit note</dt><dd>${html(row?.['Audit note']||'No source note')}</dd></dl><h4>${selected.length} ${selection.type==='pin'?'incident':'scheduled'} connections</h4><div class="wl-incident">${selected.map(w=>`<button type="button" data-wiring-inspect="${w.wire_id}"><strong>${w.wire_id}</strong><span>${html(w.source.key)} → ${html(w.destination.key)}</span></button>`).join('')||'<p>No endpoints are scheduled for this item. No wire or pin mapping has been added.</p>'}</div>`;
    }
    inspector.querySelectorAll('[data-wiring-inspect]').forEach(el=>el.addEventListener('click',()=>select('wire',el.dataset.wiringInspect)));
    $('#wiring-route-status').textContent=selection?`${selected.length} complete route${selected.length===1?'':'s'} highlighted · ${model.wires.length} source rows retained`:`${model.wires.length} source-matched routes · ${model.pins.length} logical terminals`;
    canvas.dataset.selection=selection?`${selection.type}:${selection.id}`:'none';
  }
  function select(type,id,focus=false){selection={type,id};renderSelection();if(focus)focusSelection();}
  function bindActivate(el,fn){el.addEventListener('click',e=>{e.stopPropagation();fn();});el.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopPropagation();fn();}});}
  $$('.wl-wire').forEach(el=>bindActivate(el,()=>select('wire',el.dataset.wireId)));
  $$('.wl-pin').forEach(el=>bindActivate(el,()=>select('pin',el.dataset.pinKey)));
  $$('.wl-component').forEach(el=>bindActivate(el,()=>select('component',el.dataset.componentId)));
  $$('[data-wiring-index]').forEach(el=>el.addEventListener('click',()=>{select('wire',el.dataset.wiringIndex,true);$('.wl-workspace').scrollIntoView({block:'start',behavior:'smooth'});}));
  $('#wiring-family').addEventListener('change',e=>{category=e.target.value;selection=null;renderSelection();});
  $$('[data-wiring-tool]').forEach(el=>el.addEventListener('click',()=>{const t=el.dataset.wiringTool;if(t==='in')zoomAt(1.3);if(t==='out')zoomAt(1/1.3);if(t==='fit')fit();if(t==='focus')focusSelection();if(t==='clear'){selection=null;renderSelection();}}));
  $$('[data-wiring-pan]').forEach(el=>el.addEventListener('click',()=>{const dx=el.dataset.wiringPan==='left'?-1:el.dataset.wiringPan==='right'?1:0,dy=el.dataset.wiringPan==='up'?-1:el.dataset.wiringPan==='down'?1:0;setBox({...box,x:box.x+dx*box.w*.15,y:box.y+dy*box.h*.15});}));
  canvas.addEventListener('wheel',e=>{e.preventDefault();const rect=canvas.getBoundingClientRect();zoomAt(e.deltaY<0?1.12:1/1.12,(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height);},{passive:false});
  canvas.addEventListener('pointerdown',e=>{if(e.target.closest('.wl-wire,.wl-pin,.wl-component'))return;drag={x:e.clientX,y:e.clientY,box:{...box}};canvas.setPointerCapture(e.pointerId);canvas.classList.add('is-panning');});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const rect=canvas.getBoundingClientRect(),scale=Math.max(drag.box.w/rect.width,drag.box.h/rect.height);setBox({...drag.box,x:drag.box.x-(e.clientX-drag.x)*scale,y:drag.box.y-(e.clientY-drag.y)*scale});});
  const endDrag=()=>{drag=null;canvas.classList.remove('is-panning');};canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('keydown',e=>{if(e.target!==canvas)return;const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){e.preventDefault();setBox({...box,x:box.x+d[0]*box.w*.1,y:box.y+d[1]*box.h*.1});}if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(1.3);}if(e.key==='-'){e.preventDefault();zoomAt(1/1.3);}if(e.key==='0'){e.preventDefault();fit();}});
  $('#wiring-search').addEventListener('input',e=>{
    const q=e.target.value.trim().toLowerCase(),results=$('#wiring-search-results');results.hidden=!q;if(!q)return;
    const matches=[...model.wires.filter(w=>[w.wire_id,w.source.key,w.destination.key,w.net_or_domain].some(v=>v.toLowerCase().includes(q))).map(w=>({type:'wire',id:w.wire_id,label:`${w.wire_id} · ${w.source.key} → ${w.destination.key}`})),...data.bom.filter(c=>[c.ID,c.Class,c['Proposed identity / rating']].some(v=>v.toLowerCase().includes(q))).map(c=>({type:'component',id:c.ID,label:`${c.ID} · ${c.Class}`})),...model.pins.filter(p=>p.key.toLowerCase().includes(q)).map(p=>({type:'pin',id:p.key,label:`${p.key} · ${p.wireIds.length} connections`}))].sort((a,b)=>Number(b.id.toLowerCase()===q)-Number(a.id.toLowerCase()===q));
    results.innerHTML=matches.length?matches.slice(0,12).map(m=>`<button type="button" data-find-type="${m.type}" data-find-id="${html(m.id)}"><small>${m.type.toUpperCase()}</small>${html(m.label)}</button>`).join(''):`<p>No matching source endpoint or component. Try a wire ID such as W037.</p>`;
    results.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{select(button.dataset.findType,button.dataset.findId,true);results.hidden=true;}));
  });
  fit();renderSelection();container.dataset.ready='true';container.dataset.wires=String(model.wires.length);container.dataset.pins=String(model.pins.length);
  return {model,select,fit};
}
