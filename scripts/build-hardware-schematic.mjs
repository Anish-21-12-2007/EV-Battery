// A conventional logical schematic of revision B; deliberately not physical placement.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const plan=JSON.parse(await readFile(new URL('../hardware/revision-b.json',import.meta.url),'utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const parent=new Map();
function find(x){if(!parent.has(x))parent.set(x,x);if(parent.get(x)!==x)parent.set(x,find(parent.get(x)));return parent.get(x);}
function join(a,b){parent.set(find(b),find(a));}
for(const c of plan.connections)join(c.from,c.to);
for(const id of ['QM','QL'])join(id+'.V+',id+'.output +');
const nets=[
 ['USB.Micro-B','USB5'],['ESP.J2.1 3V3','3V3'],['JSTAR.COMMON','G0'],
 ['ESP.J3.6 GPIO21','SDA'],['ESP.J3.3 GPIO22','SCL'],['ESP.J2.10 GPIO26','M_CTL'],
 ['ESP.J2.11 GPIO27','L_CTL'],['JPOS.BUS','12V_BENCH'],['IM.Vin-','M_SUP'],
 ['IL.Vin-','L_SUP'],['QM.output −','M_SW'],['QL.output −','L_SW']
];
const netName=new Map(nets.map(([endpoint,name])=>[find(endpoint),name]));
for(const c of plan.connections)assert.ok(netName.has(find(c.from)),c.id);
const modules=[
 {id:'ESP',x:70,y:230,w:390,h:520,title:'ESP · ESP32-DevKitC-32E',subtitle:'Micro-USB power only'},
 {id:'IM',x:600,y:230,w:390,h:445,title:'IM · Adafruit 904',subtitle:'INA219 · 0x40 · 0.1 Ω shunt'},
 {id:'QM',x:1130,y:230,w:390,h:390,title:'QM · Adafruit 5648',subtitle:'On/off MOSFET + flyback diode'},
 {id:'M1',x:1650,y:230,w:390,h:245,title:'M1 · Pololu 3041',subtitle:'12 V motor · no deliberate stalls',symbol:'motor'},
 {id:'OLED',x:70,y:810,w:390,h:320,title:'OLED · Adafruit 4440',subtitle:'128×32 · 0x3C · STEMMA QT'},
 {id:'IL',x:600,y:730,w:390,h:445,title:'IL · Adafruit 904',subtitle:'INA219 · 0x41 · A0 bridged'},
 {id:'QL',x:1130,y:730,w:390,h:390,title:'QL · Adafruit 5648',subtitle:'On/off MOSFET + flyback diode'},
 {id:'L1',x:1650,y:730,w:390,h:245,title:'L1 · Adafruit 5864',subtitle:'175 mm / ten marked sections',symbol:'lamp'},
];
const elements=[];
const text=(x,y,s,cls='text',more='')=>elements.push(`<text x="${x}" y="${y}" class="${cls}" ${more}>${esc(s)}</text>`);
const line=(x1,y1,x2,y2,cls='wire')=>elements.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`);
const rect=(x,y,w,h,cls)=>elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${cls}"/>`);
text(60,60,'REVISION B · TWO-LOAD 12 V PROTOTYPE','heading');
text(60,103,'PROPOSED — NOT BATTERY WIRING — NO HARDWARE QUALIFICATION','warning');
text(60,143,'Conventional module symbols. Equal net names connect electrically; positions are logical, not physical.','subheading');
text(60,181,'Each endpoint lists its B record(s). The index below preserves all 28 proposed connections and their gates.','subheading');

const renderedEndpoints=new Set();
for(const m of modules){
 const endpointRows=new Map();
 for(const c of plan.connections)for(const endpoint of [c.from,c.to])if(endpoint.startsWith(m.id+'.')){if(!endpointRows.has(endpoint))endpointRows.set(endpoint,[]);endpointRows.get(endpoint).push(c.id);}
 elements.push(`<g data-component="${m.id}">`);rect(m.x,m.y,m.w,m.h,'module');
 text(m.x+18,m.y+34,m.title,'module-title');text(m.x+18,m.y+66,m.subtitle,'small');line(m.x,m.y+84,m.x+m.w,m.y+84,'rule');
 let i=0;for(const [endpoint,ids]of endpointRows){
   const y=m.y+120+i*58;assert.ok(y+25<m.y+m.h,`${m.id} too small`);const net=netName.get(find(endpoint));
   const label=endpoint.slice(m.id.length+1);renderedEndpoints.add(endpoint);
   elements.push(`<g data-endpoint="${esc(endpoint)}" data-records="${ids.join(' ')}">`);
   line(m.x+m.w-14,y,m.x+m.w+24,y);elements.push(`<circle cx="${m.x+m.w-14}" cy="${y}" r="3" class="junction"/>`);
   text(m.x+18,y-4,label,'pin');text(m.x+18,y+20,ids.join(' / '),'small');
   text(m.x+m.w+29,y+5,net,'net');elements.push('</g>');i++;
 }
 if(m.symbol){const cx=m.x+m.w-66,cy=m.y+m.h-58;elements.push(`<circle cx="${cx}" cy="${cy}" r="25" class="symbol"/>`);if(m.symbol==='motor')text(cx,cy+7,'M','symbol-text','text-anchor="middle"');else{line(cx-17,cy-17,cx+17,cy+17);line(cx-17,cy+17,cx+17,cy-17);}}
 elements.push('</g>');
}

rect(70,1230,1970,290,'external');text(92,1266,'EXTERNAL CONNECTIONS · SOURCE AND WIRING GATES REMAIN OPEN','module-title');
const external=plan.connections.filter(c=>[c.from,c.to].some(ep=>['USB','BENCH','JPOS','JSTAR'].includes(ep.split('.')[0])));
const extLabels=[
 ['USB.Micro-B','USB only → controller; no header input power'],
 ['BENCH.POS','Qualified isolated source +; setpoint ≤12.0 V'],
 ['BENCH.NEG','Qualified source return'],
 ['JPOS.BUS','Insulated positive distribution; ratings pending'],
 ['JSTAR.COMMON','One physical junction; review USB/scope/earth paths']
];
extLabels.forEach(([endpoint,label],i)=>{const x=i<3?95:1080,y=1310+(i<3?i:i-3)*72;const ids=external.filter(c=>c.from===endpoint||c.to===endpoint).map(c=>c.id);renderedEndpoints.add(endpoint);text(x,y,`${endpoint} → ${netName.get(find(endpoint))}`,'pin');text(x,y+24,label,'small');text(x+500,y,ids.join(' / '),'small');});
text(70,1568,'NET LEGEND','module-title');
text(70,1604,'3V3 / SDA / SCL: logic only. G0: shared reference. 12V_BENCH: load input. M_SUP / L_SUP: after shunts.','text');
text(70,1638,'M_SW / L_SW: switched load returns, not GND. V+ and output + join inside each driver. Shunt terminals do not short.','text');
text(70,1672,'Load connections stay gated until source, wiring, current limits, flyback and measurement setup are reviewed.','text');

text(70,1730,'PROPOSED CONNECTION INDEX','module-title');
const widths=[90,560,560,760],xcols=[70,160,720,1280],rowH=36,top=1754;
rect(70,top,1970,rowH,'table-head');['ID','From','To','Disposition'].forEach((s,i)=>text(xcols[i]+8,top+25,s,'table-title'));
for(let i=0;i<plan.connections.length;i++){const c=plan.connections[i],y=top+rowH*(i+1);elements.push(`<g data-wire-id="${c.id}">`);rect(70,y,1970,rowH,i%2?'table-alt':'table-row');[c.id,c.from,c.to,c.status].forEach((s,j)=>text(xcols[j]+8,y+25,s,'table-text'));elements.push('</g>');}
const bottom=top+rowH*(plan.connections.length+1);
text(70,bottom+48,'Read docs/hardware-build-proposal.md for exact parts, measurement boundaries and commissioning gates.','text');
text(70,bottom+82,'The inherited 60-wire circuit is a separate design. Do not combine wiring instructions.','warning');
for(const c of plan.connections)for(const ep of [c.from,c.to])assert.ok(renderedEndpoints.has(ep),ep);
const height=bottom+118;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="2200" height="${height}" viewBox="0 0 2200 ${height}" role="img" aria-labelledby="title desc"><title id="title">Revision B proposed two-load circuit schematic</title><desc id="desc">Eight module symbols and named nets show all 28 connections. Separate USB logic and qualified bench load supply. Not battery wiring. Original 60-wire diagram is a separate design.</desc><style>text{font-family:Arial,Helvetica,sans-serif;fill:#142c3a}.heading{font-size:32px;font-weight:700}.subheading{font-size:22px}.warning{font-size:23px;fill:#a13518;font-weight:700}.module-title{font-size:23px;font-weight:700}.small{font-size:18px;fill:#405969}.text,.pin{font-size:21px}.net{font-size:18px;font-weight:700;fill:#145979}.module{fill:#fff;stroke:#203c4f;stroke-width:2}.external{fill:#f2f7fa;stroke:#546f80;stroke-width:2;stroke-dasharray:9 5}.wire,.rule{stroke:#203c4f;stroke-width:2;fill:none}.rule{stroke:#9db0ba}.junction{fill:#203c4f}.symbol{fill:#fff;stroke:#203c4f;stroke-width:2}.symbol-text{font-size:23px}.table-head{fill:#dce9f0}.table-row{fill:#fff}.table-alt{fill:#f1f5f7}.table-title{font-size:21px;font-weight:700}.table-text{font-size:20px}</style><rect width="2200" height="${height}" fill="#fff"/>${elements.join('\n')}</svg>\n`;
await writeFile(new URL('../hardware/revision-b-schematic.svg',import.meta.url),svg);
console.log(JSON.stringify({status:'passed',records:plan.connections.length,modules:modules.length,endpoints:renderedEndpoints.size,width:2200,height}));
