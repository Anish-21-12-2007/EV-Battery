// Conventional symbols and electrically joined net labels, generated solely from
// the same source connection rows as the 3D assembly. Only the documented BUS+
// distribution rail internally joins ports; devices retain their boundaries.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pinKey = (component, terminal) => `${component}.${terminal}`;

export function buildCircuitNets(wires) {
  const parent = new Map(), ports = new Map();
  const find = key => { if (!parent.has(key)) parent.set(key,key); if (parent.get(key)!==key) parent.set(key,find(parent.get(key))); return parent.get(key); };
  for (const wire of wires) {
    const a=pinKey(wire.source_component,wire.source_terminal), b=pinKey(wire.destination_component,wire.destination_terminal);
    parent.set(find(b),find(a));
    for (const [component,terminal] of [[wire.source_component,wire.source_terminal],[wire.destination_component,wire.destination_terminal]]) {
      const key=pinKey(component,terminal);
      if (!ports.has(key)) ports.set(key,{key,component,terminal,wires:[]});
      ports.get(key).wires.push(wire.wire_id);
    }
  }
  // BUS+ is one conductive distribution block, not several isolated devices.
  // JGND's quiet and power terminals join only through the explicit W053 row.
  const busPorts=[...ports.values()].filter(port=>port.component==='BUS+');
  for(const port of busPorts.slice(1))parent.set(find(port.key),find(busPorts[0].key));
  const groups=new Map();
  for (const port of ports.values()) { const root=find(port.key); if(!groups.has(root))groups.set(root,[]); groups.get(root).push(port); }
  const nets=[...groups.values()].map((members,index)=>({id:`N${String(index+1).padStart(2,'0')}`,ground:members.some(p=>p.component==='JGND'),members}));
  for (const net of nets) for(const port of net.members) { port.net=net.id; port.ground=net.ground; }
  return {nets,ports:[...ports.values()]};
}

function symbol(id) {
  if(id==='BAT1')return '<path d="M-88 0H-40M-40-52V52M-20-26V26M0-52V52M20-26V26M20 0H88"/><text x="-58" y="-32">+</text><text x="38" y="-32">−</text>';
  if(/^R_/.test(id))return '<path d="M-88 0H-60L-50-16L-30 16L-10-16L10 16L30-16L50 16L60 0H88"/>';
  if(/^C_/.test(id))return '<path d="M-88 0H-10M-10-35V35M10-35V35M10 0H88"/>';
  if(['F1','FL','FM','F2'].includes(id))return '<path d="M-88 0H88"/><rect x="-45" y="-18" width="90" height="36" fill="white"/><path d="M-45 0H45"/>';
  if(id==='SW1')return '<path d="M-88 0H-42M-37-3L35-42M42 0H88"/><circle cx="-40" cy="0" r="5" fill="white"/><circle cx="40" cy="0" r="5" fill="white"/>';
  if(id==='L1')return '<path d="M-88 0H-40M40 0H88"/><circle r="40"/><path d="M-28-28L28 28M-28 28L28-28"/>';
  if(id==='M1')return '<path d="M-88 0H-40M40 0H88"/><circle r="40"/><text x="0" y="10" text-anchor="middle" font-size="32">M</text>';
  return null;
}

function netFlag(port,x,y,direction=1) {
  const right=direction>0, textX=x+direction*12;
  const gnd=port.ground?`<path d="M${x} ${y}v18m-15 0h30m-24 7h18m-12 7h6" stroke="#176146" fill="none"/>`:'';
  return `<circle cx="${x}" cy="${y}" r="4" fill="#176146"/><text x="${textX}" y="${y-8}" text-anchor="${right?'start':'end'}" fill="#176146" font-weight="700">${esc(port.net)}</text>${gnd}`;
}

function componentSymbol(id,ports,bom,x,y) {
  const row=bom.find(b=>b.ID===id), basic=symbol(id), title=row?.Component || row?.Name || row?.['Component / function'] || '';
  const values={'R_LH':'68 kΩ · 1% assumed','R_VH':'68 kΩ · 1% assumed','R_LL':'10 kΩ · 1% assumed','R_VL':'10 kΩ · 1% assumed','R_MH':'27 kΩ · conditional','R_ML':'20 kΩ · conditional','C_L':'100 nF assumed','C_V':'100 nF assumed','C_M':'100 nF assumed','C_BYP_M':'100 nF conditional','C_FILTER_M':'1 nF / 47 nF conditional','BAT1':'12 V / 7.6 Ah listing candidate','S_M':'ACS712-30A candidate','U_ESP':'Classic ESP32 carrier unresolved','U_BUCK_BOARD':'LM2596 module candidate','S_L':'Transducer unresolved','U_I_L':'Conditioning unresolved','L1':'12 V lamp · identity unresolved','M1':'DC motor · identity unresolved','MDRV':'Motor controller unresolved','U_OLED_BOARD':'Optional OLED · pin order unresolved','T1_PROBE':'Optional DS18B20 · leads unresolved','TVS1':'Type / rating / return unresolved','F1':'Main fuse · rating TBD','FL':'Light fuse · rating TBD','FM':'Motor fuse · rating TBD','F2':'Logic fuse · rating TBD','SW1':'Master switch · DC rating TBD','BUS+':'Positive distribution rail','JGND':'W053 tie · converter return loop unresolved'};
  let drawing=`<g data-schematic-component="${esc(id)}" transform="translate(${x} ${y})"><text x="0" y="0" font-size="22" font-weight="700" fill="#172f3c">${esc(id)}</text><text x="0" y="27" font-size="17" fill="#526976">${esc(values[id]||title||'Documented sense junction')}</text>`;
  if (basic && ports.length===2) {
    drawing+=`<g transform="translate(305 113)" stroke="#233b49" stroke-width="2.5" fill="none">${basic}</g>`;
    ports.forEach((port,i)=>{const left=i===0, px=left?125:485, inner=left?217:393;
      drawing+=`<path d="M${px} 113H${inner}" stroke="#176146" stroke-width="2"/>${netFlag(port,px,113,left?-1:1)}<text x="${left?184:426}" y="87" text-anchor="middle">${esc(port.terminal)}</text><text x="${left?15:595}" y="158" text-anchor="${left?'start':'end'}" font-size="14" fill="#637782">${esc(port.wires.join(' · '))}</text>`;
    });
  } else if (id.startsWith('NODE_') || id==='BUS+' || id==='JGND') {
    drawing+='<path d="M120 93H490" stroke="#176146" stroke-width="4"/>';
    ports.forEach((port,i)=>{const px=120+i*370/Math.max(1,ports.length-1);drawing+=`<path d="M${px} 93V125" stroke="#176146" stroke-width="2"/>${netFlag(port,px,125)}<text x="${px}" y="76" text-anchor="middle" font-size="14">${esc(port.terminal)}</text>`;});
    // Distribution terminals are internally connected by the documented bus,
    // but keep labels and W053 visible to preserve the intended star topology.
    const wireIds=[...new Set(ports.flatMap(p=>p.wires))];
    for(let i=0;i<wireIds.length;i+=9) drawing+=`<text x="0" y="${190+Math.floor(i/9)*22}" font-size="14" fill="#637782">${esc(wireIds.slice(i,i+9).join(' · '))}</text>`;
  } else {
    const rows=Math.ceil(ports.length/2), height=Math.max(100,rows*40+30);
    drawing+=`<rect x="205" y="60" width="200" height="${height}" fill="#f4f8f9" stroke="#233b49" stroke-width="2.5"/>`;
    ports.forEach((port,i)=>{const left=i<rows,row=i%rows, py=85+row*40, px=left?110:500, edge=left?205:405;
      drawing+=`<path d="M${px} ${py}H${edge}" stroke="#176146" stroke-width="2"/>${netFlag(port,px,py,left?-1:1)}<text x="${left?215:395}" y="${py+6}" font-size="15" text-anchor="${left?'start':'end'}">${esc(port.terminal)}</text><text x="${left?15:595}" y="${py+12}" font-size="11" text-anchor="${left?'start':'end'}" fill="#637782">${esc(port.wires.join(' · '))}</text>`;
    });
    if(id==='TVS1')drawing+='<text x="305" y="116" text-anchor="middle" font-size="15">Unselected suppressor</text><path d="M305 160v28" stroke="#bf7a20" stroke-dasharray="5 4"/><circle cx="305" cy="192" r="5" fill="white" stroke="#bf7a20"/><text x="305" y="220" text-anchor="middle" font-size="14" fill="#9a6015">Return not scheduled</text>';
  }
  return drawing+'</g>';
}

export function renderCircuitSchematic(wires,bom=[]) {
  const {nets,ports}=buildCircuitNets(wires);
  const groups=[
    {name:'A / Power distribution, loads and reference',ids:['BAT1','F1','SW1','BUS+','FL','S_L','L1','FM','S_M','MDRV','M1','F2','U_BUCK_BOARD','JGND','TVS1']},
    {name:'B / Analog sensing and filtering',ids:['R_LH','NODE_VL','R_LL','C_L','R_VH','NODE_VM','R_VL','C_V','R_MH','NODE_IM','R_ML','C_M','C_BYP_M','C_FILTER_M','U_I_L']},
    {name:'C / Controller and optional interfaces',ids:['U_ESP','U_OLED_BOARD','T1_PROBE']},
  ];
  let y=142, symbols='';
  for(const group of groups) {
    symbols+=`<text x="40" y="${y}" font-size="26" font-weight="700" fill="#172f3c">${group.name}</text><path d="M40 ${y+18}H2060" stroke="#d6e0e4"/>`;
    y+=60;
    group.ids.forEach((id,i)=>symbols+=componentSymbol(id,ports.filter(p=>p.component===id),bom,40+(i%3)*690,y+Math.floor(i/3)*335));
    y+=Math.ceil(group.ids.length/3)*335+30;
  }
  const height=y+110;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="conventional-schematic" viewBox="0 0 2100 ${height}" width="2100" height="${height}" role="img" aria-label="Conventional electrical schematic of the 60 source connections. Repeated N labels join terminals electrically; wire identities preserve physical routing. Symbols are conditional engineering proposals."><style>.conventional-schematic text{font-family:Arial,sans-serif;fill:#233b49}.conventional-schematic{background:#fff;font-size:17px}</style><rect width="2100" height="${height}" fill="#fff"/><text x="40" y="48" font-size="32" font-weight="700">EV–EMS / 12 V educational monitoring circuit</text><text x="40" y="82" font-size="20">Conventional symbols · ${wires.length} source wires · ${ports.length} logical terminals · repeated N labels indicate electrical connections</text>${symbols}<text x="40" y="${y}" font-size="19" fill="#9a6015">UNRESOLVED: RP1 insertion, TVS1 return, motor suppression, probe pullup scheduling and exact hardware variants.</text><text x="40" y="${y+32}" font-size="18">RLY1 is quantity zero and unwired. Connection crossings do not join. This diagram is generated from the unchanged source CSV.</text><text x="40" y="${y+64}" font-size="18">All ratings and component assumptions retain the authoritative package conditions. No 96 V vehicle connections or physical test claims.</text></svg><details class="schematic-net-index"><summary>Connection and net index · ${wires.length} wires</summary><p>Repeated net labels connect the same terminals. Dedicated home-run conductors and the single W053 Kelvin tie retain their individual wire identities.</p><div class="table-scroll"><table><thead><tr><th>Wire</th><th>Source terminal</th><th>Destination terminal</th><th>Net</th><th>Source status</th></tr></thead><tbody>${wires.map(w=>`<tr data-schematic-wire="${esc(w.wire_id)}"><td>${esc(w.wire_id)}</td><td>${esc(pinKey(w.source_component,w.source_terminal))}</td><td>${esc(pinKey(w.destination_component,w.destination_terminal))}</td><td>${esc(ports.find(p=>p.key===pinKey(w.source_component,w.source_terminal)).net)}</td><td>${esc(w.status)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
