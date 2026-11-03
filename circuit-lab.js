import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { wireCategory, connectionClass } from './wiring-layout.js';
import { circuitReviewHtml } from './circuit-review.js';

// Logical connectivity always comes from the preserved CSV, never from model art.
const SOURCE = './FINAL_EV_EMS_ENGINEERING_PACKAGE/';
const COLORS = { power:'#e86a55', logic:'#e6ad45', supply3v3:'#bb8dde', ground:'#667d8b', analog:'#39bdba', communication:'#709aef', motor:'#cc8749', unresolved:'#cb99a8' };
const html = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pinKey = (id, name) => `${id}.${name}`;
const finitePoint = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);

export function validateCircuitManifest(manifest, wires, bom) {
  if (!Array.isArray(manifest?.components)) throw new Error('Circuit component manifest is missing');
  const ids = new Set(bom.map(row => row.ID)), components = new Map(), terminals = new Map();
  for (const component of manifest.components) {
    if (!ids.has(component.id) || components.has(component.id) || !component.node || !finitePoint(component.position)) throw new Error(`Invalid component ${component.id}`);
    components.set(component.id, component);
    for (const terminal of component.terminals ?? []) {
      const key = pinKey(component.id, terminal.name);
      if (!terminal.name || terminals.has(key) || !finitePoint(terminal.position)) throw new Error(`Invalid terminal ${key}`);
      terminals.set(key, { ...terminal, component: component.id });
    }
  }
  const wireIds = new Set();
  for (const wire of wires) {
    if (!wire.wire_id || wireIds.has(wire.wire_id)) throw new Error('Duplicate or missing source wire ID');
    wireIds.add(wire.wire_id);
    for (const [id, pin] of [[wire.source_component, wire.source_terminal], [wire.destination_component, wire.destination_terminal]]) {
      if (!terminals.has(pinKey(id, pin))) throw new Error(`Missing modeled contact ${id}.${pin} for ${wire.wire_id}`);
    }
  }
  // Do not promote a candidate header position to a measured physical fact.
  if ([...terminals.values()].some(t => !String(t.physicalStatus).startsWith('UNRESOLVED'))) throw new Error('Physical terminal verification must remain unresolved');
  return { components, terminals, wireCount: wireIds.size };
}

function distance(a, b) { return Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]); }
function simplify(points) {
  const clean = points.filter((p, i) => !i || distance(p, points[i-1]) > .002);
  for (let i=clean.length-2; i>0; i--) {
    const a=clean[i-1], b=clean[i], c=clean[i+1];
    const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], bc=[c[0]-b[0],c[1]-b[1],c[2]-b[2]];
    if (ab.reduce((sum,v,k)=>sum+v*bc[k],0)>0 && Math.hypot(ab[1]*bc[2]-ab[2]*bc[1],ab[2]*bc[0]-ab[0]*bc[2],ab[0]*bc[1]-ab[1]*bc[0]) < 1e-7) clean.splice(i,1);
  }
  return clean;
}

// Floor-level routing avoids all component footprints. Each lead rises out of its
// contact, clears its own housing, then descends into an aisle. Units are model
// presentation units, not a conductor length or a fabrication dimension.
export function routeCircuitCable(source, destination, boxes, sourceId, destinationId, index=0, directions={}) {
  const padding=.13, step=.13, routeY=.065+(index%7)*.016;
  const escape = (point, id, direction=[0,1,0]) => {
    const box=boxes.find(b=>b.id===id);
    const norm=Math.hypot(...direction)||1,exit=point.map((v,i)=>v+direction[i]/norm*.105);
    if(!box) return {outside:[...exit],lead:[...exit],outlet:[...exit],exit};
    const candidates=[
      [Math.abs(point[0]-box.min[0]),[box.min[0]-padding-.1,point[1],point[2]]],
      [Math.abs(point[0]-box.max[0]),[box.max[0]+padding+.1,point[1],point[2]]],
      [Math.abs(point[2]-box.min[2]),[point[0],point[1],box.min[2]-padding-.1]],
      [Math.abs(point[2]-box.max[2]),[point[0],point[1],box.max[2]+padding+.1]],
    ].sort((a,b)=>a[0]-b[0]);
    const outside=candidates[0][1],outlet=[outside[0],exit[1],outside[2]];
    const lead=[outside[0],Math.max(exit[1]+.07,box.max[1]+.07),outside[2]];outside[1]=lead[1];
    return {lead,outside,outlet,exit};
  };
  const s=escape(source,sourceId,directions.source), d=escape(destination,destinationId,directions.destination);
  const minX=Math.min(...boxes.map(b=>b.min[0]),s.outside[0],d.outside[0])-1;
  const maxX=Math.max(...boxes.map(b=>b.max[0]),s.outside[0],d.outside[0])+1;
  const minZ=Math.min(...boxes.map(b=>b.min[2]),s.outside[2],d.outside[2])-1;
  const maxZ=Math.max(...boxes.map(b=>b.max[2]),s.outside[2],d.outside[2])+1;
  const cols=Math.ceil((maxX-minX)/step)+1, rows=Math.ceil((maxZ-minZ)/step)+1;
  const snap=p=>[Math.round((p[0]-minX)/step),Math.round((p[2]-minZ)/step)];
  const key=(x,z)=>z*cols+x;
  const blocked=new Set();
  for(const b of boxes) for(let z=Math.max(0,Math.floor((b.min[2]-padding-minZ)/step));z<=Math.min(rows-1,Math.ceil((b.max[2]+padding-minZ)/step));z++)
    for(let x=Math.max(0,Math.floor((b.min[0]-padding-minX)/step));x<=Math.min(cols-1,Math.ceil((b.max[0]+padding-minX)/step));x++) blocked.add(key(x,z));
  // Route in the connected outside aisle, not in isolated free cells trapped
  // between dense component labels or neighboring plinths.
  const reachable=new Set([0]),queue=[0];
  for(let i=0;i<queue.length;i++){
    const current=queue[i],x=current%cols,z=Math.floor(current/cols);
    for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]){
      const nx=x+dx,nz=z+dz,k=key(nx,nz);
      if(nx>=0&&nz>=0&&nx<cols&&nz<rows&&!blocked.has(k)&&!reachable.has(k)){reachable.add(k);queue.push(k);}
    }
  }
  const freeCell = point => {
    const origin=snap(point);
    for(let r=0;r<12;r++){
      const candidates=[];
      for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
        const x=origin[0]+dx,z=origin[1]+dz;
        if(x>=0&&z>=0&&x<cols&&z<rows&&reachable.has(key(x,z)))candidates.push([x,z]);
      }
      if(candidates.length)return candidates.sort((a,b)=>Math.hypot(a[0]-origin[0],a[1]-origin[1])-Math.hypot(b[0]-origin[0],b[1]-origin[1]))[0];
    }
    return origin;
  };
  const start=freeCell(s.outside),end=freeCell(d.outside),sk=key(...start),ek=key(...end);
  blocked.delete(sk);blocked.delete(ek);
  const scores=new Map([[sk,0]]), previous=new Map(), open=[{k:sk,x:start[0],z:start[1],f:0}], closed=new Set();
  let found=false;
  while(open.length && closed.size<15000) {
    let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;
    const current=open.splice(best,1)[0];if(closed.has(current.k))continue;
    if(current.k===ek){found=true;break;}closed.add(current.k);
    for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]) {
      const x=current.x+dx,z=current.z+dz,k=key(x,z);
      if(x<0||z<0||x>=cols||z>=rows||blocked.has(k)||closed.has(k))continue;
      const g=scores.get(current.k)+1;
      if(g<(scores.get(k)??Infinity)){scores.set(k,g);previous.set(k,current.k);open.push({k,x,z,f:g+Math.abs(x-end[0])+Math.abs(z-end[1])});}
    }
  }
  let points;
  if(found) {
    const path=[];let k=ek;
    while(k!==undefined){path.push([minX+(k%cols)*step,routeY,minZ+Math.floor(k/cols)*step]);if(k===sk)break;k=previous.get(k);}
    path.reverse();
    const first=path[0],last=path.at(-1);
    points=[source,s.exit,s.outlet,s.lead,[first[0],s.lead[1],first[2]],...path,[last[0],d.lead[1],last[2]],d.lead,d.outlet,d.exit,destination];
  } else {
    // Inspection transforms may overlap components. Show a continuous lifted
    // inspection cable rather than claim a collision-free installation route.
    const high=Math.max(source[1],destination[1],...boxes.map(b=>b.max[1]))+.3+(index%7)*.04;
    points=[source,s.exit,s.outlet,[s.outlet[0],high,s.outlet[2]],[d.outlet[0],high,d.outlet[2]],d.outlet,d.exit,destination];
  }
  return {points:simplify(points),overhead:!found};
}

function roundedCurve(points) {
  const path=new THREE.CurvePath(), p=points.map(a=>new THREE.Vector3(...a));
  let start=p[0];
  for(let i=1;i<p.length-1;i++) {
    const prev=p[i-1],middle=p[i],next=p[i+1];
    const radius=Math.min(.10,middle.distanceTo(prev)*.3,middle.distanceTo(next)*.3);
    const before=middle.clone().lerp(prev,radius/middle.distanceTo(prev)),after=middle.clone().lerp(next,radius/middle.distanceTo(next));
    if(start.distanceTo(before)>.0001)path.add(new THREE.LineCurve3(start,before));
    path.add(new THREE.QuadraticBezierCurve3(before,middle,after));start=after;
  }
  if(start.distanceTo(p.at(-1))>.0001)path.add(new THREE.LineCurve3(start,p.at(-1)));
  return path;
}

export async function initCircuitLab(container, data) {
  if(!container || container.circuitLab)return container?.circuitLab;
  container.classList.add('cl-root');
  container.innerHTML=`
    <div class="cl-heading"><div><span class="lab-kicker">12 V EDUCATIONAL REFERENCE · PHYSICAL ASSEMBLY</span><h3>The circuit, in three dimensions.</h3><p>Inspect modeled contacts, follow a cable, or separate a component. Every logical connection comes from the final engineering package.</p></div><a class="lab-source" href="assets/circuit/circuit-lab.blend" download>Blender source ↗</a></div>
    <p class="cl-source-note"><strong>Physical identification unresolved.</strong> Candidate shapes, dimensions, pin positions and wire colours illustrate the design. Fuse ratings, conductor sizes and unselected hardware remain open.</p>
    <div class="cl-toolbar">
      <label class="lab-field cl-selector"><span>Component</span><select id="circuit-component" aria-label="Select circuit component"><option value="">Choose a component</option></select></label>
      <label class="lab-field cl-selector"><span>Connection</span><select id="circuit-wire" aria-label="Select circuit wire"><option value="">Choose a wire</option></select></label>
      <div class="cl-view-buttons" aria-label="Circuit arrangement"><button type="button" class="lab-action is-active" data-circuit-view="assembled" aria-pressed="true">Assembled</button><button type="button" class="lab-action" data-circuit-view="exploded" aria-pressed="false">Exploded</button><button type="button" class="lab-action" id="circuit-reset-all">Restore assembly</button></div>
    </div>
    <div class="cl-workspace">
      <div class="cl-stage-wrap"><div class="cl-stage" id="circuit-stage" aria-label="Interactive 3D physical circuit assembly"><div class="cl-labels" aria-hidden="true"></div><div class="cl-loading" role="status">Loading detailed Blender components…</div></div>
        <div class="cl-stage-tools"><div><button type="button" class="lab-action" data-circuit-camera="perspective">Perspective</button><button type="button" class="lab-action" data-circuit-camera="top">Top</button><button type="button" class="lab-action" id="circuit-fit">Fit all</button></div><label>Labels <select id="circuit-labels" aria-label="Circuit label visibility"><option value="components">Components</option><option value="pins">Pins + components</option><option value="off">Off</option></select></label><label><input id="circuit-show-wires" type="checkbox" checked> Wires</label></div>
        <div class="cl-stage-caption"><span>Drag: orbit · scroll: zoom · right drag / two fingers: pan</span><span id="circuit-route-count">Reading connection records…</span></div>
      </div>
      <aside class="cl-inspector" aria-label="3D circuit item inspector"><div class="cl-inspector-content" aria-live="polite"></div><div class="cl-edit" hidden>
        <div class="cl-edit-actions"><button type="button" class="lab-action" data-circuit-transform="translate" aria-pressed="true">Move</button><button type="button" class="lab-action" data-circuit-transform="rotate" aria-pressed="false">Rotate</button><button type="button" class="lab-action" id="circuit-focus">Focus</button><button type="button" class="lab-action" id="circuit-hide">Hide component</button></div>
        <span class="cl-transform-label">Position offset · presentation units</span><div class="cl-axis-fields">${['x','y','z'].map(axis=>`<label>${axis.toUpperCase()}<input id="circuit-${axis}" type="number" min="-8" max="8" step="0.1" value="0" aria-label="Circuit ${axis.toUpperCase()} position offset"></label>`).join('')}</div>
        <p class="cl-edit-feedback" role="status"></p><button type="button" class="lab-action" id="circuit-reset-part">Reset selected component</button>
      </div></aside>
    </div>
    <div class="cl-legend">${[['power','Power'],['ground','Return'],['analog','Analog'],['logic','5 V proposal'],['supply3v3','3V3 proposal'],['communication','Digital']].map(([id,name])=>`<span><i style="--cable-color:${COLORS[id]}"></i>${name}</span>`).join('')}<span class="cl-stripe-key"><i></i>Striped: conditional / unresolved record</span></div>
    <p class="cl-boundary">This circuit is separate from the 96 V vehicle simulation. The original <a href="${SOURCE}03_Circuit_Design/2D_circuit_schematic.svg" target="_blank" rel="noopener">electrical schematic</a> uses the same reference design. RP1 insertion, the TVS return, optional pullup and motor suppression remain unscheduled; the relay is retained unwired.</p>`;
  const $=selector=>container.querySelector(selector), $$=selector=>[...container.querySelectorAll(selector)];
  const stage=$('.cl-stage'), labels=$('.cl-labels'), loading=$('.cl-loading');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#19252a');
  const camera=new THREE.PerspectiveCamera(39,1,.02,100);
  const wireGroup=new THREE.Group();wireGroup.name='Source_CSV_Connections';scene.add(wireGroup);
  const componentMap=new Map(), terminalMap=new Map(), cableMap=new Map(), labelEntries=[], endpointMarkers=[];
  let renderer,controls,transform,model,manifest,selected=null,mode='translate',exploded=false,disposed=false,frame=0,labelMode='components',needsRender=true,slowFrames=0;
  const scratch=new THREE.Vector3(), pointer=new THREE.Vector2(), raycaster=new THREE.Raycaster();
  const pickables=[];let pointerStart=null;
  function fail(error) {
    loading.hidden=false;loading.setAttribute('role','alert');loading.innerHTML=`<strong>3D assembly unavailable</strong><span>${html(error.message)}</span><p>The source schematic and wiring register remain available in their tabs.</p><button type="button" class="lab-action" id="circuit-retry">Retry 3D assembly</button>`;
    stage.dataset.ready='error';$('#circuit-retry').addEventListener('click',()=>{api?.dispose();container.circuitLab=null;initCircuitLab(container,data);});
  }
  const api={
    selectComponent:id=>select('component',id),selectWire:id=>select('wire',id),
    reset:()=>resetAll(),setExploded:value=>setExploded(value),
    snapshot:()=>({ready:stage.dataset.ready,selected,exploded,componentCount:componentMap.size,terminalCount:terminalMap.size,wireCount:cableMap.size,
      components:[...componentMap].map(([id,c])=>({id,position:c.node.position.toArray(),rotation:c.node.rotation.toArray().slice(0,3),visible:c.node.visible,base:c.base.toArray()})),
      wires:[...cableMap].map(([id,c])=>({id,source:c.row.source_component+'.'+c.row.source_terminal,destination:c.row.destination_component+'.'+c.row.destination_terminal,status:c.row.status,visible:c.mesh.visible,points:c.route.points,sourceContact:terminalWorld(c.row.source_component,c.row.source_terminal).toArray(),destinationContact:terminalWorld(c.row.destination_component,c.row.destination_terminal).toArray(),sourceDirection:terminalDirection(c.row.source_component,c.row.source_terminal),destinationDirection:terminalDirection(c.row.destination_component,c.row.destination_terminal),overhead:c.route.overhead})),
      camera:{position:camera.position.toArray(),target:controls?.target.toArray()}}),
    project:(kind,id)=>{const t=kind==='terminal'?terminalMap.get(id):null;const p=t?terminalWorld(t.component,t.name):kind==='wire'?cableMap.get(id)?.curve.getPoint(.5):componentMap.get(id)?.node.getWorldPosition(new THREE.Vector3());if(!p)return null;p.project(camera);return {x:(p.x+1)*stage.clientWidth/2,y:(1-p.y)*stage.clientHeight/2,width:stage.clientWidth,height:stage.clientHeight};},
    dispose:()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();intersection?.disconnect();controls?.dispose();transform?.dispose();scene.traverse(o=>{o.geometry?.dispose();for(const m of [o.material??[]].flat()){m.map?.dispose();m.dispose?.();}});renderer?.dispose();container.circuitLab=null;},
  };
  container.circuitLab=api;
  let observer,intersection;
  function makeLabel(text,kind,point,owner) {
    const element=document.createElement('span');element.className=`cl-world-label cl-label-${kind}`;element.textContent=text;labels.append(element);
    const entry={element,kind,point,owner};labelEntries.push(entry);return entry;
  }
  function terminalWorld(id,name) {
    const t=terminalMap.get(pinKey(id,name)),c=componentMap.get(id);
    return c.node.localToWorld(new THREE.Vector3(...t.position));
  }
  function terminalDirection(id,name) {
    const t=terminalMap.get(pinKey(id,name)),c=componentMap.get(id);
    return new THREE.Vector3(...(t.direction??[0,1,0])).transformDirection(c.node.matrixWorld).toArray();
  }
  function boxes() {return [...componentMap].map(([id,c])=>{const box=new THREE.Box3().setFromObject(c.node);return {id,min:box.min.toArray(),max:box.max.toArray()};});}
  function rebuildCables() {
    scene.updateMatrixWorld(true);const obstacles=boxes();let overhead=0;
    const originalAssembly=!exploded&&[...componentMap.values()].every(c=>c.offset.lengthSq()<1e-10&&Math.abs(c.node.rotation.x)+Math.abs(c.node.rotation.y)+Math.abs(c.node.rotation.z)<1e-8);
    for(const [id,cable] of cableMap) {
      const row=cable.row,s=terminalWorld(row.source_component,row.source_terminal),d=terminalWorld(row.destination_component,row.destination_terminal);
      const original=originalAssembly?manifest.wires?.find(w=>w.wire_id===id):null;
      const matches=original&&['source_component','source_terminal','destination_component','destination_terminal','status','net_or_domain','evidence_or_condition'].every(key=>original[key]===row[key])&&original.points?.every(finitePoint)&&distance(original.points[0],s.toArray())<.0001&&distance(original.points.at(-1),d.toArray())<.0001;
      // In assembly view, use the checked Blender wire guides themselves. The
      // current CSV still owns identity, status and both endpoint assignments.
      const route=matches?{points:original.points.map(p=>[...p]),overhead:false}:routeCircuitCable(s.toArray(),d.toArray(),obstacles,row.source_component,row.destination_component,cable.index,{source:terminalDirection(row.source_component,row.source_terminal),destination:terminalDirection(row.destination_component,row.destination_terminal)});
      route.points[0]=s.toArray();route.points[route.points.length-1]=d.toArray();
      const curve=roundedCurve(route.points);cable.mesh.geometry?.dispose();
      cable.mesh.geometry=new THREE.TubeGeometry(curve,Math.min(210,Math.max(36,Math.ceil(curve.getLength()*18))),cable.radius,7,false);
      cable.curve=curve;cable.route=route;if(route.overhead)overhead++;
      cable.mesh.visible=$('#circuit-show-wires').checked && componentMap.get(row.source_component).node.visible && componentMap.get(row.destination_component).node.visible;
    }
    $('#circuit-route-count').textContent=`${cableMap.size} source routes · ${terminalMap.size} logical contacts${overhead?' · '+overhead+' lifted inspection routes':''}`;
    updateEndpointMarkers();needsRender=true;
  }
  function resetMaterialHighlights() {
    for(const c of componentMap.values())c.node.traverse(o=>{if(!o.isMesh)return;for(const m of [o.material].flat()){if(m.userData.circuitBaseEmissive){m.emissive.copy(m.userData.circuitBaseEmissive);m.emissiveIntensity=m.userData.circuitBaseIntensity;}}});
  }
  function markComponent(id) {componentMap.get(id)?.node.traverse(o=>{if(!o.isMesh)return;for(const m of [o.material].flat()){if(m.emissive){m.emissive.set('#62cbd2');m.emissiveIntensity=.38;}}});}
  function updateEndpointMarkers() {
    for(const marker of endpointMarkers)marker.visible=false;
    if(selected?.type!=='wire')return;
    const c=cableMap.get(selected.id);if(!c)return;
    const ends=[[c.row.source_component,c.row.source_terminal],[c.row.destination_component,c.row.destination_terminal]];
    ends.forEach(([id,name],i)=>{endpointMarkers[i].position.copy(terminalWorld(id,name));endpointMarkers[i].visible=componentMap.get(id).node.visible;});
  }
  function updateHighlights() {
    resetMaterialHighlights();
    if(selected?.type==='component')markComponent(selected.id);
    if(selected?.type==='wire'){const c=cableMap.get(selected.id);markComponent(c.row.source_component);markComponent(c.row.destination_component);}
    for(const [id,c] of cableMap) {
      const relevant=!selected || (selected.type==='wire'?selected.id===id:c.row.source_component===selected.id||c.row.destination_component===selected.id);
      c.mesh.material.opacity=relevant?1:.12;c.mesh.material.depthWrite=relevant;c.mesh.material.emissiveIntensity=selected?.type==='wire'&&id===selected.id ? .55 : .03;
      c.mesh.renderOrder=relevant?3:0;
    }
    updateEndpointMarkers();needsRender=true;
  }
  function syncEditor() {
    const c=selected?.type==='component'?componentMap.get(selected.id):null;
    $('.cl-edit').hidden=!c;
    if(!c){transform?.detach();return;}
    $('.cl-transform-label').textContent=mode==='translate'?'Position offset · presentation units':'Rotation · degrees';
    const values=mode==='translate'?c.offset.toArray():[c.node.rotation.x,c.node.rotation.y,c.node.rotation.z].map(THREE.MathUtils.radToDeg);
    ['x','y','z'].forEach((axis,i)=>{const input=$('#circuit-'+axis);input.value=values[i].toFixed(2);input.min=mode==='translate'?'-8':'-180';input.max=mode==='translate'?'8':'180';input.step=mode==='translate'?'.1':'5';input.setAttribute('aria-label',`Circuit ${axis.toUpperCase()} ${mode==='translate'?'position offset':'rotation degrees'}`);});
    $('#circuit-hide').textContent=c.node.visible?'Hide component':'Reveal component';
    $$('.cl-edit-actions [data-circuit-transform]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.circuitTransform===mode)));
    if(c.node.visible){transform?.attach(c.node);transform?.setMode(mode);}else transform?.detach();
  }
  function renderInspector() {
    const host=$('.cl-inspector-content');
    if(!selected) {host.innerHTML='<span class="lab-kicker">EXPLORE THE ASSEMBLY</span><h3>Select a component or cable.</h3><p>The selector menus also reach small or hidden parts. Selecting a cable reveals both logical endpoints and its original source condition.</p><div class="cl-inspector-note">Copper contacts are modeled connection points. Their positions do not establish an installed board pinout.</div>';syncEditor();return;}
    if(selected.type==='wire') {
      const row=cableMap.get(selected.id).row;
      host.innerHTML=`<span class="lab-kicker">SOURCE CONNECTION</span><h3>${html(row.wire_id)}</h3><div class="cl-status">${html(row.status)}</div><div class="cl-endpoints">${[[row.source_component,row.source_terminal],[row.destination_component,row.destination_terminal]].map(([id,pin],i)=>`<button type="button" data-circuit-end="${html(id)}"><small>${i?'TO':'FROM'}</small><strong>${html(id)}</strong><code>${html(pin)}</code></button>${i?'':'<span aria-hidden="true">↓</span>'}`).join('')}</div><dl><dt>Network</dt><dd>${html(row.net_or_domain)}</dd><dt>Source condition</dt><dd>${html(row.evidence_or_condition)}</dd><dt>Physical placement</dt><dd>UNRESOLVED. Logical contacts follow the source table; connector positions, conductor colour, gauge and length are illustrative.</dd></dl><button type="button" class="lab-action" id="circuit-focus-wire">Frame this connection</button>`;
      $$('[data-circuit-end]').forEach(b=>b.addEventListener('click',()=>select('component',b.dataset.circuitEnd)));$('#circuit-focus-wire').addEventListener('click',focusSelection);
    } else {
      const c=componentMap.get(selected.id),row=c.row,incident=data.wires.filter(w=>w.source_component===selected.id||w.destination_component===selected.id);
      host.innerHTML=`<span class="lab-kicker">COMPONENT INSPECTOR${c.node.visible?'':' · HIDDEN'}</span><h3>${html(row.ID)}</h3><p class="cl-component-name">${html(row.Class)}</p><div class="cl-status">${html(row.Status)}</div><dl><dt>Documented identity / proposal</dt><dd>${html(row['Proposed identity / rating'])}</dd><dt>Engineering evidence</dt><dd>${html(row['Audit note'])}</dd><dt>Sources</dt><dd>${html(row['Evidence source'])} · register quantity ${html(row.Qty)}</dd><dt>Model geometry</dt><dd>${html(c.definition.geometryStatus || 'Illustrative candidate dimensions and physical terminal positions; not measured hardware.')}</dd></dl><details class="cl-connections"><summary>${incident.length} source connection${incident.length===1?'':'s'}</summary>${incident.length?incident.map(w=>`<button type="button" data-circuit-incident="${w.wire_id}"><strong>${w.wire_id}</strong><span>${html(w.source_component+'.'+w.source_terminal)} → ${html(w.destination_component+'.'+w.destination_terminal)}</span></button>`).join(''):'<p>No connection is scheduled in the source table. This component is shown for unresolved design review only.</p>'}</details>`;
      $$('[data-circuit-incident]').forEach(b=>b.addEventListener('click',()=>select('wire',b.dataset.circuitIncident)));
    }
    host.insertAdjacentHTML('beforeend',circuitReviewHtml(selected.type,selected.id));
    syncEditor();
  }
  function select(type,id) {
    if(!id || !(type==='wire'?cableMap:componentMap).has(id)){selected=null;}else selected={type,id};
    if(selected?.type==='wire') {
      const row=cableMap.get(id).row;let changed=false;
      if(!$('#circuit-show-wires').checked){$('#circuit-show-wires').checked=true;changed=true;}
      for(const component of [row.source_component,row.destination_component]){const node=componentMap.get(component).node;if(!node.visible){node.visible=true;changed=true;}}
      if(changed)rebuildCables();
    }
    $('#circuit-component').value=selected?.type==='component'?id:'';$('#circuit-wire').value=selected?.type==='wire'?id:'';
    stage.dataset.selection=selected?`${selected.type}:${selected.id}`:'';updateHighlights();renderInspector();
  }
  function arrangementOffset(c,index) {
    if(!exploded)return new THREE.Vector3();
    return new THREE.Vector3(c.base.x*.24,.25+(index%3)*.2,c.base.z*.24);
  }
  function updateTransforms() {let index=0;for(const c of componentMap.values())c.node.position.copy(c.base).add(c.offset).add(arrangementOffset(c,index++));rebuildCables();syncEditor();}
  function setExploded(value) {exploded=Boolean(value);$$('[data-circuit-view]').forEach(b=>{const active=b.dataset.circuitView===(exploded?'exploded':'assembled');b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});updateTransforms();fitAll();}
  function resetAll() {exploded=false;for(const c of componentMap.values()){c.offset.set(0,0,0);c.node.rotation.set(0,0,0);c.node.visible=true;}setExploded(false);renderInspector();}
  function frameBox(box,top=false) {
    const center=box.getCenter(new THREE.Vector3());
    const direction=(top?new THREE.Vector3(0,1,.0001):new THREE.Vector3(.65,.95,1)).normalize();
    const right=new THREE.Vector3().crossVectors(camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
    const tanVertical=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanHorizontal=tanVertical*camera.aspect;
    let distance=1.3;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const p=new THREE.Vector3(x,y,z).sub(center),depth=p.dot(direction);
      distance=Math.max(distance,depth+Math.abs(p.dot(right))/tanHorizontal,depth+Math.abs(p.dot(up))/tanVertical);
    }
    distance*=1.12;
    controls.target.copy(center);camera.position.copy(center).add(direction.multiplyScalar(distance));controls.update();needsRender=true;
  }
  function fitAll(top=false) {const box=new THREE.Box3();for(const c of componentMap.values())if(c.node.visible)box.expandByObject(c.node);for(const c of cableMap.values())if(c.mesh.visible)box.expandByObject(c.mesh);if(!box.isEmpty())frameBox(box,top);}
  function focusSelection() {
    if(!selected)return;
    if(selected.type==='component'){const c=componentMap.get(selected.id);if(!c.node.visible){c.node.visible=true;rebuildCables();renderInspector();}frameBox(new THREE.Box3().setFromObject(c.node));}
    else {const c=cableMap.get(selected.id);frameBox(new THREE.Box3().setFromPoints(c.route.points.map(p=>new THREE.Vector3(...p))));}
  }
  function updateLabels() {
    const width=stage.clientWidth,height=stage.clientHeight;
    for(const label of labelEntries) {
      const owner=componentMap.get(label.owner),isSelected=selected?.type==='component'&&selected.id===label.owner;
      const selectedWire=selected?.type==='wire'?cableMap.get(selected.id)?.row:null;
      const isEndpoint=label.kind==='pin'&&selectedWire&&[pinKey(selectedWire.source_component,selectedWire.source_terminal),pinKey(selectedWire.destination_component,selectedWire.destination_terminal)].includes(label.key);
      let visible=owner.node.visible&&labelMode!=='off'&&(label.kind==='component'||labelMode==='pins'||isSelected||isEndpoint);
      if(visible){scratch.copy(label.point);owner.node.localToWorld(scratch);scratch.project(camera);visible=scratch.z<1&&scratch.z>-1&&Math.abs(scratch.x)<1.05&&Math.abs(scratch.y)<1.05;}
      if(label.element.hidden!==!visible)label.element.hidden=!visible;
      if(visible){const tx=`translate(${((scratch.x+1)*width/2).toFixed(1)}px,${((1-scratch.y)*height/2).toFixed(1)}px) translate(-50%,-110%)`;if(label.lastTx!==tx){label.lastTx=tx;label.element.style.transform=tx;}const sel=Boolean(isSelected||isEndpoint);if(label.lastSel!==sel){label.lastSel=sel;label.element.classList.toggle('is-selected',sel);}}
    }
  }
  try {
    const response=await fetch('./assets/circuit/circuit-manifest.json');if(!response.ok)throw new Error(`Circuit manifest returned HTTP ${response.status}`);manifest=await response.json();
    const verified=validateCircuitManifest(manifest,data.wires,data.bom);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-label','3D circuit. Select components and wires with the menus or pointer.');stage.prepend(renderer.domElement);
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#d2e8ed','#53606c',1.6));
    const sun=new THREE.DirectionalLight('#e6f8ff',2.2);sun.position.set(-3,9,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;sun.shadow.normalBias=.015;scene.add(sun);
    const rim=new THREE.DirectionalLight('#6dbdc7',1.3);rim.position.set(4,4,-5);scene.add(rim);
    const floor=new THREE.Mesh(new THREE.BoxGeometry(12,.07,10),new THREE.MeshStandardMaterial({color:'#26373d',roughness:.82,metalness:.12}));floor.position.y=-.075;floor.receiveShadow=true;scene.add(floor);
    const grid=new THREE.GridHelper(12,60,'#54696c','#3a4c52');grid.position.y=-.034;grid.material.transparent=true;grid.material.opacity=.23;scene.add(grid);
    controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=.4;controls.maxDistance=32;controls.maxPolarAngle=Math.PI*.49;controls.target.set(0,0,0);controls.addEventListener('change',()=>{needsRender=true;});
    transform=new TransformControls(camera,renderer.domElement);transform.setSize(.8);transform.setSpace('world');scene.add(transform.getHelper());
    transform.addEventListener('dragging-changed',event=>{controls.enabled=!event.value;needsRender=true;});transform.addEventListener('change',()=>{needsRender=true;});
    transform.addEventListener('objectChange',()=>{if(selected?.type!=='component')return;const c=componentMap.get(selected.id),i=[...componentMap.keys()].indexOf(selected.id);c.offset.copy(c.node.position).sub(c.base).sub(arrangementOffset(c,i));rebuildCables();syncEditor();});
    const gltf=await new GLTFLoader().loadAsync('./'+manifest.webAsset.replace(/^\.\//,''));model=gltf.scene;scene.add(model);
    for(const definition of verified.components.values()) {
      const node=model.getObjectByName(definition.node);if(!node)throw new Error(`Missing Blender component ${definition.node}`);
      const c={definition,node,base:node.position.clone(),offset:new THREE.Vector3(),row:data.bom.find(row=>row.ID===definition.id)};componentMap.set(definition.id,c);
      node.traverse(o=>{if(!o.isMesh)return;o.userData.circuitComponent=definition.id;o.castShadow=true;o.receiveShadow=true;o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of [o.material].flat())if(m.emissive){m.userData.circuitBaseEmissive=m.emissive.clone();m.userData.circuitBaseIntensity=m.emissiveIntensity;}pickables.push(o);});
      node.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(node);const localTop=node.worldToLocal(bounds.getCenter(new THREE.Vector3()).setY(bounds.max.y+.10));makeLabel(definition.id,'component',localTop,definition.id);
      for(const t of definition.terminals){
        const modeledContact=model.getObjectByName(t.node);if(!modeledContact)throw new Error(`Missing modeled terminal ${definition.id}.${t.name}`);
        const contactLocal=node.worldToLocal(modeledContact.getWorldPosition(new THREE.Vector3()));
        if(contactLocal.distanceTo(new THREE.Vector3(...t.position))>.0001)throw new Error(`Contact metadata mismatch for ${definition.id}.${t.name}`);
        terminalMap.set(pinKey(definition.id,t.name),{...t,component:definition.id});const entry=makeLabel(t.name,'pin',new THREE.Vector3(...t.position).add(new THREE.Vector3(0,.055,0)),definition.id);entry.key=pinKey(definition.id,t.name);
      }
    }
    const standardWire=new THREE.MeshStandardMaterial({roughness:.45,metalness:.02,transparent:true});
    data.wires.forEach((row,index)=>{
      const category=wireCategory(row),material=standardWire.clone();material.color.set(COLORS[category]);material.emissive.copy(material.color);material.emissiveIntensity=.03;
      if(connectionClass(row)==='unresolved') {
        material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vCircuitArc;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCircuitArc = uv.x;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vCircuitArc;').replace('#include <color_fragment>','#include <color_fragment>\nif (mod(vCircuitArc * 36.0, 1.0) > 0.67) diffuseColor.rgb *= 0.34;');};material.customProgramCacheKey=()=> 'circuit-unresolved-stripe';
      }
      const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);mesh.userData.circuitWire=row.wire_id;mesh.castShadow=true;wireGroup.add(mesh);pickables.push(mesh);
      cableMap.set(row.wire_id,{row,index,mesh,category,radius:['power','ground','motor'].includes(category)?.021:.014});
    });standardWire.dispose();
    for(let i=0;i<2;i++){const marker=new THREE.Mesh(new THREE.SphereGeometry(.055,16,10),new THREE.MeshBasicMaterial({color:'#efffc0',depthTest:false}));marker.visible=false;marker.renderOrder=12;scene.add(marker);endpointMarkers.push(marker);}
    $('#circuit-component').innerHTML='<option value="">Choose a component</option>'+[...componentMap].map(([id,c])=>`<option value="${html(id)}">${html(id)} · ${html(c.row.Class)}</option>`).join('');
    $('#circuit-wire').innerHTML='<option value="">Choose a wire</option>'+data.wires.map(w=>`<option value="${w.wire_id}">${w.wire_id} · ${html(w.source_component+'.'+w.source_terminal)} → ${html(w.destination_component+'.'+w.destination_terminal)}</option>`).join('');
    $('#circuit-component').addEventListener('change',e=>select('component',e.target.value));$('#circuit-wire').addEventListener('change',e=>select('wire',e.target.value));
    $$('[data-circuit-view]').forEach(b=>b.addEventListener('click',()=>setExploded(b.dataset.circuitView==='exploded')));$('#circuit-reset-all').addEventListener('click',resetAll);
    $('#circuit-fit').addEventListener('click',()=>fitAll());$$('[data-circuit-camera]').forEach(b=>b.addEventListener('click',()=>fitAll(b.dataset.circuitCamera==='top')));
    $('#circuit-labels').addEventListener('change',e=>{labelMode=e.target.value;needsRender=true;});$('#circuit-show-wires').addEventListener('change',rebuildCables);
    $$('[data-circuit-transform]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.circuitTransform;syncEditor();}));
    $('#circuit-focus').addEventListener('click',focusSelection);$('#circuit-hide').addEventListener('click',()=>{const c=componentMap.get(selected.id);c.node.visible=!c.node.visible;rebuildCables();renderInspector();});
    $('#circuit-reset-part').addEventListener('click',()=>{const c=componentMap.get(selected.id);c.offset.set(0,0,0);c.node.rotation.set(0,0,0);c.node.visible=true;updateTransforms();renderInspector();});
    ['x','y','z'].forEach(axis=>$('#circuit-'+axis).addEventListener('change',event=>{
      if(selected?.type!=='component')return;const input=event.target,value=Number(input.value),limit=mode==='translate'?8:180;
      if(!input.value.trim()||!Number.isFinite(value)||Math.abs(value)>limit){$('.cl-edit-feedback').textContent=`Enter a finite value between −${limit} and ${limit}.`;syncEditor();return;}
      $('.cl-edit-feedback').textContent='';const c=componentMap.get(selected.id);if(mode==='translate')c.offset[axis]=value;else c.node.rotation[axis]=THREE.MathUtils.degToRad(value);updateTransforms();
    }));
    renderer.domElement.addEventListener('pointerdown',e=>{pointerStart=[e.clientX,e.clientY];});
    renderer.domElement.addEventListener('pointerup',e=>{
      if(!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>5||transform.dragging||transform.axis){pointerStart=null;return;}pointerStart=null;
      const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
      const hit=raycaster.intersectObjects(pickables,false).find(h=>{let n=h.object;while(n){if(!n.visible)return false;n=n.parent;}return true;});
      if(hit?.object.userData.circuitWire)select('wire',hit.object.userData.circuitWire);else if(hit?.object.userData.circuitComponent)select('component',hit.object.userData.circuitComponent);else select(null,null);
    });
    const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;if(w<2||h<2)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();needsRender=true;};
    observer=new ResizeObserver(resize);observer.observe(stage);resize();
    let visible=true;intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});intersection.observe(stage);
    rebuildCables();fitAll();renderInspector();loading.hidden=true;stage.dataset.ready='true';
    function render(){if(disposed)return;frame=requestAnimationFrame(render);if(!visible||!stage.getClientRects().length)return;const moved=controls.update();if(!moved&&!needsRender&&!transform.dragging)return;needsRender=false;const t0=performance.now();updateLabels();renderer.render(scene,camera);if(renderer.shadowMap.enabled&&performance.now()-t0>35&&++slowFrames>=2){renderer.shadowMap.enabled=false;renderer.setPixelRatio(1);needsRender=true;}}render();
    return api;
  } catch(error) {fail(error);return api;}
}
