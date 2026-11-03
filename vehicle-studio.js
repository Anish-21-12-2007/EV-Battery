import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { drivetrainKinematics } from './drivetrain-kinematics.js';
import { createVehicleDisplays } from './vehicle-displays.js';
import { createVehicleAssembly, assemblyGroupNames } from './vehicle-assembly.js';

const COMPONENTS = {
  overview: ['00','DESIGN STUDY','A system, in balance.','Select a component on the vehicle or use the component menu. Reveal the powertrain with a cutaway or exploded view.'],
  battery: ['01','ENERGY STORAGE','Traction battery','An underfloor pack supplies the traction inverter and DC/DC converter. Its visible modules illustrate packaging, not a verified cell topology or build drawing.'],
  motor: ['02','PROPULSION','Traction motor','Electrical power becomes wheel torque through the motor and reduction gear. Demand follows throttle, road load and the speed limit; braking can return a modeled fraction of energy.'],
  inverter: ['03','POWER ELECTRONICS','Traction inverter','The inverter converts pack DC into the AC drive used by the motor. Its assumed efficiency is included in the propulsion energy calculation.'],
  dcdc: ['04','POWER CONVERSION','DC/DC converter','The converter supplies the auxiliary loads from the traction pack. Pack demand includes conversion losses. This illustrative low-voltage bus is independent of the physical monitoring circuit.'],
  charger: ['05','CHARGING','On-board charger','An illustrative AC-to-DC charger shows where charging electronics can be packaged. A charging session and battery charge limits are not simulated.'],
  cooling: ['06','THERMAL SYSTEM','Cooling system','The radiator and coolant paths illustrate heat rejection from the powertrain. Temperatures, coolant flow and thermal control are not numerically modeled.'],
  headlights: ['07','EXTERIOR LIGHTING','Headlights','The front light signatures and projected beams follow this independent load. The editable watt value is output demand; battery draw also includes DC/DC losses.'],
  cabinLights: ['08','INTERIOR LIGHTING','Cabin lighting','Cabin illumination follows its own switch and energy ledger. Reveal the interior or choose the interior camera to see the ambient light sources.'],
  airConditioning: ['09','CABIN CLIMATE','Air conditioning','The selected constant electrical load models climate-control demand. Airflow animation indicates operation; no cabin temperature or compressor cycle is predicted.'],
  infotainment: ['10','CONNECTED CABIN','Infotainment','The center display shows each device’s trip electricity, battery percentage and entered-tariff cost. Its load is independent; the inspection view retains the energy page when the load is off.'],
};
const GROUP_KEYS = { battery:'Battery', motor:'Motor', inverter:'Inverter', dcdc:'DCDC', charger:'Charger', cooling:'Cooling', headlights:'Headlights', cabinLights:'CabinLights', airConditioning:'Cooling', infotainment:'Infotainment' };
const ENERGY_PARTS = ['Battery','Motor','Inverter','DCDC','Charger','Cooling'];
const setText = (id, text) => { const el = document.getElementById(id); if (el && el.textContent !== text) el.textContent = text; };
const fmt = (n, p=0) => Number.isFinite(n) ? n.toLocaleString(undefined,{maximumFractionDigits:p,minimumFractionDigits:p}) : '—';

export async function createVehicleStudio(getState) {
  const host = document.getElementById('vehicle-canvas');
  const stage = document.getElementById('vehicle-stage');
  const loading = document.getElementById('vehicle-loading');
  const fallback = document.getElementById('vehicle-fallback');
  let renderer, model, controls, assembly, displays, frame = 0, active = true, disposed = false;
  let selected = 'overview', layer = 'exterior', environment = 'studio', quality = 'auto';
  let autoOrbit = false, transition = null, previousTime = 0, frameCount=0, frameMs=0, needsStudioRender=3, lastSceneKey='';
  let framingFactor=1, energyFitDistance=0, dragMode='orbit', returnFocus=null, wasNativeFullscreen=false, requestedCamera=null;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const groups = new Map(), materials = new Set(), wheels=[], rotatingParts=[];
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .005, 100);
  const target = new THREE.Vector3(0,.6,0);
  camera.position.set(-4.75,2.2,4.6);
  const cameras = {
    hero:[[-4.75,2.2,4.6],[0,.62,0]], front:[[-6.4,1.35,0],[0,.6,0]], side:[[0,1.55,6.8],[0,.6,0]],
    rear:[[6.6,2,3.1],[0,.65,0]], top:[[0,8,.001],[0,0,0]], interior:[[.20,1.16,-.08],[-.65,.9,-.12]], mechanism:[[3.45,1.7,3.2],[1.05,.45,0]],
    energy:[[.03,.964,.135],[-.413,.934,.135]],
  };
  const disposable = [];
  const eventCleanups = [];
  function listen(el,event,handler) { if (!el) return; el.addEventListener(event,handler); eventCleanups.push(()=>el.removeEventListener(event,handler)); }
  function stopAutoOrbit() { autoOrbit=false;if(controls)controls.autoRotate=false;document.getElementById('studio-orbit')?.setAttribute('aria-pressed','false'); }
  function setDragMode(value) {
    dragMode=value==='pan'?'pan':'orbit';
    if(controls){controls.mouseButtons.LEFT=dragMode==='pan'?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;controls.touches.ONE=dragMode==='pan'?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;}
    document.querySelectorAll('[data-camera-drag]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.cameraDrag===dragMode)));
    host.dataset.drag=dragMode;
  }
  function setExpanded(value,focus=true) {
    if(!stage)return;
    const wasExpanded=stage.classList.contains('is-expanded');
    if(value&&!wasExpanded)returnFocus=document.activeElement;
    stage.classList.toggle('is-expanded',value);document.body.classList.toggle('studio-expanded',value);
    stage.setAttribute('role',value?'dialog':'region');
    if(value)stage.setAttribute('aria-modal','true');else stage.removeAttribute('aria-modal');
    document.getElementById('studio-expand').textContent=value?'Close view ×':'Expand view ↗';
    document.getElementById('studio-expand').setAttribute('aria-expanded',String(value));
    document.getElementById('studio-fullscreen').textContent=document.fullscreenElement===stage?'Exit full screen ⛶':'Full screen ⛶';
    const status=document.getElementById('studio-view-status');
    if(status){status.hidden=!value;status.textContent='Scroll or pinch to zoom · choose Pan to move around · turn your phone sideways for a wider view';}
    size();
    if(focus&&value)document.getElementById('studio-expand').focus({preventScroll:true});
    if(focus&&!value&&wasExpanded)returnFocus?.focus?.({preventScroll:true});
  }
  async function closeExpanded() {
    if(stage)delete stage.dataset.fullscreenFallback;
    if(document.fullscreenElement===stage)await document.exitFullscreen().catch(()=>{});
    setExpanded(false);
  }
  async function toggleFullscreen() {
    if(document.fullscreenElement===stage||stage?.dataset.fullscreenFallback==='true'){await closeExpanded();return;}
    setExpanded(true);
    try {if(!stage?.requestFullscreen)throw new Error('Native fullscreen unavailable');await stage.requestFullscreen();}
    catch {if(stage)stage.dataset.fullscreenFallback='true';const status=document.getElementById('studio-view-status');if(status)status.textContent='Expanded view is open. Use + / − or pinch to zoom; turn your phone sideways for a wider view.';}
  }
  listen(document.getElementById('studio-expand'),'click',()=>stage.classList.contains('is-expanded')?closeExpanded():setExpanded(true));
  listen(document.getElementById('studio-fullscreen'),'click',toggleFullscreen);
  listen(document,'fullscreenchange',()=>{const native=document.fullscreenElement===stage;if(native){wasNativeFullscreen=true;setExpanded(true,false);}else if(wasNativeFullscreen){wasNativeFullscreen=false;setExpanded(false);}size();});
  listen(document,'keydown',event=>{
    if(!stage?.classList.contains('is-expanded'))return;
    if(event.key==='Escape'&&!document.fullscreenElement){event.preventDefault();closeExpanded();}
    if(event.key==='Tab'){
      const choices=[...stage.querySelectorAll('button,select,input,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=choices[0],last=choices.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  document.querySelectorAll('[data-camera-drag]').forEach(button=>listen(button,'click',()=>{stopAutoOrbit();setDragMode(button.dataset.cameraDrag);}));
  function fail(message) {
    loading.hidden=true; fallback.hidden=false;
    setText('vehicle-fallback-message', message);
    host.dataset.ready='fallback';
  }
  function inspect(key) {
    selected = COMPONENTS[key] ? key : 'overview';
    const [number,category,title,description] = COMPONENTS[selected];
    setText('component-index',number); setText('component-category',category); setText('component-title-studio',title); setText('component-description',description);
    document.getElementById('studio-component').value=selected;
    for (const material of materials) {
      if (!material.userData.studioOriginalEmissive) continue;
      material.emissive.copy(material.userData.studioOriginalEmissive);
      material.emissiveIntensity=material.userData.studioOriginalIntensity;
    }
    const selectedGroup = groups.get(GROUP_KEYS[selected]);
    if(selectedGroup)assembly?.select(selectedGroup.name,false);
    if (selectedGroup && ENERGY_PARTS.includes(selectedGroup.name)) selectedGroup.traverse(obj=>{
      if (!obj.isMesh) return;
      for(const m of [obj.material].flat()) { if (m.emissive) {m.emissive.set('#bc6b3c');m.emissiveIntensity=.28;} }
    });
    updateReading();
  }
  function updateReading() {
    const s=getState(), device=s.devices.find(d=>d.id===(selected==='motor'?'tractionMotor':selected));
    if(device) {setText('component-reading',`${fmt(device.batteryInputW,1)} W / ${fmt(device.energyWh,3)} Wh`);setText('component-reading-note','Simulated pack-side demand / energy');}
    else if(selected==='battery') {setText('component-reading',`${fmt(s.voltageV,1)} V / ${fmt(s.currentA,1)} A`);setText('component-reading-note',`${fmt(s.socPercent,1)}% state of charge · modeled`);}
    else if(selected==='dcdc') {setText('component-reading',`${fmt(s.auxiliaryBatteryInputW,1)} W`);setText('component-reading-note',`${fmt(s.assumptions.dcdcEff*100)}% assumed efficiency`);}
    else if(selected==='inverter') {setText('component-reading',`${fmt(s.tractionPowerW,1)} W`);setText('component-reading-note',`${fmt(s.assumptions.inverterEff*100)}% assumed efficiency`);}
    else if(selected==='overview') {setText('component-reading',`${fmt(s.assumptions.nominalVoltageV)} V / ${fmt(s.nominalPackEnergyWh/1000,1)} kWh`);setText('component-reading-note','Editable scenario assumptions');}
    else {setText('component-reading','Illustrative geometry');setText('component-reading-note','No physical or thermal validation');}
  }
  listen(document.getElementById('studio-component'),'change',e=>{
    inspect(e.target.value);
    if (ENERGY_PARTS.includes(GROUP_KEYS[selected]) && layer==='exterior') setLayer('cutaway');
  });
  document.querySelectorAll('button[data-layer]').forEach(el=>listen(el,'click',()=>setLayer(el.dataset.layer)));
  function setLayer(value) {
    const previousLayer=layer;
    layer=value;
    document.querySelectorAll('button[data-layer]').forEach(el=>{el.classList.toggle('selected',el.dataset.layer===layer);el.setAttribute('aria-pressed',String(el.dataset.layer===layer));});
    for(const name of ['Body','Glass','Door_L','Door_R','Bonnet']) {
      const group=groups.get(name); if(group) group.visible=!['cutaway','energy','mechanism'].includes(layer);
    }
    for(const name of ['Interior','Battery','DCDC','Charger','Cooling','CabinLights','Infotainment','InstrumentCluster','Headlights','Taillights','Seat_FL','Seat_FR','Seat_RL','Seat_RR','Dashboard','SteeringWheel','CenterConsole']) { const group=groups.get(name);if(group)group.visible=layer!=='mechanism'; }
    groups.get('Motor')?.traverse(obj=>{if(!obj.isMesh)return;[obj.material].flat().forEach(m=>{m.opacity=layer==='mechanism'?.13:m.userData.baseOpacity;m.transparent=layer==='mechanism'||m.userData.baseTransparent;m.depthWrite=layer!=='mechanism';});});
    document.getElementById('mechanism-readout').hidden=layer!=='mechanism';
    if(layer==='mechanism') {goCamera('mechanism');inspect('motor');}
    else if(previousLayer==='mechanism') goCamera('hero');
    // Cutaway exposes the interior and all power electronics; the frame remains readable.
    if (layer==='exploded') goCamera('hero');
    energyLines.visible=layer==='energy';
    assembly?.setExploded(layer==='exploded');
    host.dataset.layer=layer;
  }
  function energyFraming() {
    const screen=model?.getObjectByName('Screen_Infotainment');if(!screen)return null;
    screen.updateWorldMatrix(true,false);screen.geometry.computeBoundingBox();
    const box=screen.geometry.boundingBox,center=new THREE.Vector3();box.getCenter(center).applyMatrix4(screen.matrixWorld);
    const orientation=screen.getWorldQuaternion(new THREE.Quaternion());
    const normal=new THREE.Vector3(1,0,0).applyQuaternion(orientation).normalize(),up=new THREE.Vector3(0,1,0).applyQuaternion(orientation).normalize();
    const right=up.clone().cross(normal).normalize();let halfWidth=0,halfHeight=0;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const offset=new THREE.Vector3(x,y,z).applyMatrix4(screen.matrixWorld).sub(center);halfWidth=Math.max(halfWidth,Math.abs(offset.dot(right)));halfHeight=Math.max(halfHeight,Math.abs(offset.dot(up)));
    }
    // Keep the eye in the clear space immediately in front of the display.
    // A portrait viewport widens the lens instead of backing into the seats.
    const distance=.32;
    camera.fov=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.max(halfHeight,halfWidth/camera.aspect)*1.14/distance)),20,110);
    camera.updateProjectionMatrix();
    return {center,normal,up,distance};
  }
  function cameraDiagnostics() {
    const screen=model.getObjectByName('Screen_Infotainment');screen.geometry.computeBoundingBox();screen.updateWorldMatrix(true,false);camera.updateMatrixWorld();
    const box=screen.geometry.boundingBox,center=box.getCenter(new THREE.Vector3()).applyMatrix4(screen.matrixWorld);
    const corners=[new THREE.Vector3(box.min.x,box.min.y,box.min.z),new THREE.Vector3(box.max.x,box.max.y,box.max.z),new THREE.Vector3(box.min.x,box.max.y,box.min.z),new THREE.Vector3(box.max.x,box.min.y,box.max.z)].map(p=>p.applyMatrix4(screen.matrixWorld));
    const sightRay=new THREE.Raycaster();
    const unobstructed=host.dataset.camera==='energy'?[center,...corners.map(p=>center.clone().lerp(p,.9))].map(point=>{
      const offset=point.clone().sub(camera.position);sightRay.set(camera.position,offset.clone().normalize());sightRay.near=camera.near;sightRay.far=offset.length()+.003;
      const hit=sightRay.intersectObject(model,true).find(h=>{let node=h.object;while(node){if(!node.visible)return false;node=node.parent;}return true;});return hit?.object===screen;
    }):null;
    return {position:camera.position.toArray(),target:controls.target.toArray(),distance:camera.position.distanceTo(controls.target),near:camera.near,fov:camera.fov,minDistance:controls.minDistance,maxDistance:controls.maxDistance,enablePan:controls.enablePan,enableZoom:controls.enableZoom,dragMode,autoOrbit,expanded:stage.classList.contains('is-expanded'),nativeFullscreen:document.fullscreenElement===stage,width:host.clientWidth,height:host.clientHeight,energyScreenCorners:corners.map(p=>p.clone().project(camera).toArray()),energyScreenUnobstructed:unobstructed};
  }
  function goCamera(name) {
    if(!controls||!model){requestedCamera=name;return;}
    requestedCamera=null;
    stopAutoOrbit();
    if(['energy','interior'].includes(name)&&['exterior','mechanism','exploded'].includes(layer))setLayer('cutaway');
    if(name==='energy') {
      assembly?.reveal('Infotainment');
      // Selection helpers would otherwise cross the values on the real display.
      assembly?.select('',false);
    }
    const preset=cameras[name]; if(!preset) return;
    const inCabin=name==='interior'||name==='energy';
    camera.fov=name==='interior'?58:36;camera.up.set(0,1,0);camera.updateProjectionMatrix();
    const pos=new THREE.Vector3(...preset[0]); const aim=new THREE.Vector3(...preset[1]);
    if(name==='energy') {
      const framing=energyFraming();
      if(framing){aim.copy(framing.center);pos.copy(aim).addScaledVector(framing.normal,framing.distance);camera.up.copy(framing.up);energyFitDistance=framing.distance;}
    }
    framingFactor=inCabin?1:Math.max(1,1.3/camera.aspect);
    pos.sub(aim).multiplyScalar(framingFactor).add(aim);
    if(layer==='exploded' && name==='hero') {pos.multiplyScalar(1.25);aim.y=.95;}
    controls.minDistance=.015;controls.maxDistance=25;controls.maxPolarAngle=Math.PI-.01;controls.enablePan=true;
    if(reducedMotion||inCabin) {transition=null;camera.position.copy(pos);controls.target.copy(aim);controls.update();}
    else transition={from:camera.position.clone(),to:pos,aimFrom:controls.target.clone(),aimTo:aim,start:performance.now(),duration:1000};
    document.querySelectorAll('button[data-camera]').forEach(el=>{el.classList.toggle('selected',el.dataset.camera===name);el.setAttribute('aria-pressed',String(el.dataset.camera===name));});
    host.dataset.camera=name;
  }
  document.querySelectorAll('button[data-camera]').forEach(el=>listen(el,'click',()=>goCamera(el.dataset.camera)));
  listen(document.getElementById('studio-reset-camera'),'click',()=>goCamera(cameras[host.dataset.camera]?host.dataset.camera:'hero'));
  for(const [id,name] of [['studio-open-energy','energy'],['studio-open-cabin','interior']])listen(document.getElementById(id),'click',()=>{
    setExpanded(true);goCamera(name);
  });
  listen(document.getElementById('studio-orbit'),'click',()=>{autoOrbit=!autoOrbit;document.getElementById('studio-orbit').setAttribute('aria-pressed',String(autoOrbit));});
  for(const [id,scale] of [['studio-zoom-in',.83],['studio-zoom-out',1.2]]) listen(document.getElementById(id),'click',()=>{
    if(!controls)return;stopAutoOrbit();transition=null;const offset=camera.position.clone().sub(controls.target);offset.setLength(THREE.MathUtils.clamp(offset.length()*scale,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);controls.update();
  });
  document.querySelectorAll('[data-paint]').forEach(el=>listen(el,'click',()=>{
    materials.forEach(m=>{if (/^Paint/i.test(m.name)) m.color.set(el.dataset.paint);});
    document.querySelectorAll('[data-paint]').forEach(b=>{b.classList.toggle('selected',b===el);b.setAttribute('aria-pressed',String(b===el));});
    setText('paint-name',el.getAttribute('aria-label').replace(' paint',''));
  }));
  const energyLines=new THREE.Group(); scene.add(energyLines); energyLines.visible=false;
  const powerMat=new THREE.LineDashedMaterial({color:0xefab78,dashSize:.12,gapSize:.075,transparent:true,opacity:.95});disposable.push(powerMat);
  for(const end of [[-1.5,.39,0],[-.75,.72,.38],[.4,1.05,0]]) {
    const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.45,.35,0),new THREE.Vector3(-.5,.35,0),new THREE.Vector3(...end)]);
    const line=new THREE.Line(geometry,powerMat);line.computeLineDistances();energyLines.add(line);disposable.push(geometry);
  }
  const airflowGeometry=new THREE.BufferGeometry(); const airflowPositions=new Float32Array(60*3);
  airflowGeometry.setAttribute('position',new THREE.BufferAttribute(airflowPositions,3));
  const airSprite=document.createElement('canvas');airSprite.width=32;airSprite.height=32;
  const airContext=airSprite.getContext('2d'),airGradient=airContext.createRadialGradient(16,16,0,16,16,16);
  airGradient.addColorStop(0,'#ffffff');airGradient.addColorStop(1,'rgba(255,255,255,0)');airContext.fillStyle=airGradient;airContext.fillRect(0,0,32,32);
  const airTexture=new THREE.CanvasTexture(airSprite);disposable.push(airTexture);
  const airflowMaterial=new THREE.PointsMaterial({color:0xa5d3dd,map:airTexture,size:.007,transparent:true,opacity:.35,depthWrite:false});
  const airflow=new THREE.Points(airflowGeometry,airflowMaterial);scene.add(airflow);disposable.push(airflowGeometry,airflowMaterial);
  let mainLight, cabinLight, headlamps=[];
  function size() {
    if(!renderer||disposed)return;const {width,height}=host.getBoundingClientRect();if(!width||!height)return;
    camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
    if(host.dataset.camera==='energy'&&controls){const next=energyFraming()?.distance;if(next&&energyFitDistance){camera.position.sub(controls.target).multiplyScalar(next/energyFitDistance).add(controls.target);energyFitDistance=next;transition=null;}return;}
    const factor=host.dataset.camera==='interior'?1:Math.max(1,1.3/camera.aspect);
    if(controls&&Math.abs(factor-framingFactor)>.001) {camera.position.sub(controls.target).multiplyScalar(factor/framingFactor).add(controls.target);transition=null;}
    framingFactor=factor;
  }
  function applyQuality() {
    if(!renderer)return;
    const isSoftware=Boolean(navigator.webdriver);
    const low=quality==='low'||(quality==='auto'&&(innerWidth<760||navigator.hardwareConcurrency<=4||isSoftware));
    renderer.setPixelRatio(low?(isSoftware?.22:1):Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=!low;
    host.dataset.quality=low?'efficient':'high';needsStudioRender=2;size();
  }
  listen(document.getElementById('studio-quality'),'change',e=>{quality=e.target.value;applyQuality();});
  listen(document.getElementById('studio-environment'),'change',e=>{
    environment=e.target.value;if(renderer) renderer.toneMappingExposure=environment==='night'?.64:.98;
    if(mainLight) mainLight.intensity=environment==='night'?1.1:2.5;
    host.parentElement.style.background=environment==='night'?'radial-gradient(ellipse at 50% 45%,#252b37,#151c24 70%)':'';
  });
  inspect('overview');
  try {
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:!navigator.webdriver,powerPreference:'high-performance'});
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Interactive Aeris GT vehicle');
    controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(target);controls.enableDamping=!reducedMotion;controls.dampingFactor=.07;controls.addEventListener('change',()=>{needsStudioRender=Math.max(needsStudioRender,2);});controls.minDistance=.015;controls.maxDistance=25;controls.maxPolarAngle=Math.PI-.01;controls.enablePan=true;controls.screenSpacePanning=true;controls.zoomSpeed=1.25;controls.panSpeed=.85;controls.autoRotateSpeed=.55;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;setDragMode(dragMode);
    controls.addEventListener('start',()=>{transition=null;stopAutoOrbit();});
    const isSw=Boolean(navigator.webdriver);
    if(!isSw){const pmrem=new THREE.PMREMGenerator(renderer), room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.8;disposable.push(env);room.dispose();pmrem.dispose();}
    scene.add(new THREE.HemisphereLight(0xd8efff,0x292c25,.9));
    mainLight=new THREE.DirectionalLight(0xffe7d3,2.5);mainLight.position.set(-3.5,6,4);mainLight.castShadow=true;mainLight.shadow.mapSize.set(1024,1024);mainLight.shadow.camera.left=-5;mainLight.shadow.camera.right=5;mainLight.shadow.camera.top=5;mainLight.shadow.camera.bottom=-5;mainLight.shadow.normalBias=.025;mainLight.shadow.bias=-.0002;scene.add(mainLight);
    const rim=new THREE.DirectionalLight(0xc3e4f6,1.7);rim.position.set(4,2,-4);scene.add(rim);
    const floorGeometry=new THREE.PlaneGeometry(200,200),floorMat=new THREE.ShadowMaterial({opacity:.3});
    const floor=new THREE.Mesh(floorGeometry,floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=-.017;floor.receiveShadow=true;scene.add(floor);disposable.push(floorGeometry,floorMat);
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=128;
    const shadowContext=shadowCanvas.getContext('2d');shadowContext.scale(1,.5);
    const gradient=shadowContext.createRadialGradient(128,128,30,128,128,125);gradient.addColorStop(0,'rgba(0,0,0,.58)');gradient.addColorStop(.5,'rgba(0,0,0,.3)');gradient.addColorStop(1,'rgba(0,0,0,0)');shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,256,256);
    const contactMap=new THREE.CanvasTexture(shadowCanvas),contactMat=new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false}),contactGeo=new THREE.PlaneGeometry(5.8,3.2);
    const contact=new THREE.Mesh(contactGeo,contactMat);contact.rotation.x=-Math.PI/2;contact.position.y=-.006;scene.add(contact);disposable.push(contactMap,contactMat,contactGeo);
    const ringGeometry=new THREE.RingGeometry(3.05,3.06,128), ringMat=new THREE.MeshBasicMaterial({color:0x596266,transparent:true,opacity:.35,side:THREE.DoubleSide});
    const ring=new THREE.Mesh(ringGeometry,ringMat);ring.rotation.x=-Math.PI/2;ring.position.y=-.011;scene.add(ring);disposable.push(ringGeometry,ringMat);
    for(const z of [-.65,.65]) {
      const light=new THREE.SpotLight(0xd1edff,0,7,.42,.7,1.5);light.position.set(-1.92,.6,z);light.target.position.set(-6,0,z);scene.add(light,light.target);headlamps.push(light);
    }
    cabinLight=new THREE.PointLight(0xfac699,0,2.5,2);cabinLight.position.set(.05,1.13,0);scene.add(cabinLight);
    applyQuality();
    const gltf=await new GLTFLoader().loadAsync('./assets/vehicle/ev-ems-gt-phase2.glb?v=20261103.3',e=>{
      if(e.total) setText('vehicle-loading-text',`Loading vehicle · ${Math.round(e.loaded/e.total*100)}%`);
    });
    if(disposed)return;
    model=gltf.scene;scene.add(model);
    model.traverse(obj=>{
      if(assemblyGroupNames.includes(obj.name)) groups.set(obj.name,obj);
      if(/^(Wheel|BrakeDisc)_[FR][LR]$/.test(obj.name)) wheels.push(obj);
      if(/^(MotorRotor|DriveShaft_L|DriveShaft_R|GearIntermediate|Differential)$/.test(obj.name)) rotatingParts.push(obj);
      if(!obj.isMesh)return;
      obj.castShadow=true;obj.receiveShadow=true;
      const cloned=[obj.material].flat().map(material=>{
        const m=isSw&&material.color?new THREE.MeshLambertMaterial({name:material.name,color:material.color.clone(),map:material.map||null,emissive:material.emissive?material.emissive.clone():new THREE.Color(0),emissiveIntensity:material.emissiveIntensity??1,opacity:material.opacity,transparent:material.transparent,side:material.side}):material.clone();
        materials.add(m);disposable.push(m);
        m.userData.baseOpacity=m.opacity;m.userData.baseTransparent=m.transparent;
        if(m.emissive) {m.userData.studioOriginalEmissive=m.emissive.clone();m.userData.studioOriginalIntensity=m.emissiveIntensity;}
        if(/^Paint/i.test(m.name)) {m.color.set(document.querySelector('button[data-paint].selected')?.dataset.paint||'#aabec7');if('metalness' in m){m.metalness=.72;m.roughness=.24;}if('clearcoat' in m)m.clearcoat=1;obj.receiveShadow=false;}
        return m;
      });obj.material=Array.isArray(obj.material)?cloned:cloned[0];
    });
    displays=createVehicleDisplays(model);
    assembly=createVehicleAssembly({model,scene,camera,renderer,controls,host,
      onSelect(name){const key=Object.keys(GROUP_KEYS).find(k=>GROUP_KEYS[k]===name);if(key)inspect(key);if(['Battery','Motor','Inverter','Seat_FL','Seat_FR','Seat_RL','Seat_RR','Dashboard','SteeringWheel','CenterConsole'].includes(name)&&layer==='exterior')setLayer('cutaway');},
      onRestore(){setLayer('exterior');goCamera('hero');},
      onFocus(bounds){transition=null;stopAutoOrbit();const center=bounds.getCenter(new THREE.Vector3()),radius=bounds.getSize(new THREE.Vector3()).length();controls.minDistance=.015;controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(-1,.6,1).normalize().multiplyScalar(Math.max(.7,radius*1.6)));host.dataset.camera='component';},
    });
    for(const light of headlamps){groups.get('Headlights')?.attach(light);groups.get('Headlights')?.attach(light.target);}
    groups.get('CabinLights')?.attach(cabinLight);
    displays.update(getState(),performance.now());assembly.update();renderer.render(scene,camera);
    window.EVStudioDiagnostics=()=>({state:getState(),assembly:assembly.snapshot(),displays:displays.snapshot(),wheelAngles:Object.fromEntries(wheels.map(w=>[w.name,w.rotation.z])),rotorAngles:Object.fromEntries(rotatingParts.map(w=>[w.name,w.rotation.z])),lights:{headlights:headlamps.map(l=>l.intensity),cabin:cabinLight.intensity},airflow:airflow.visible,
      camera:cameraDiagnostics(),
    });
    loading.hidden=true;fallback.hidden=true;host.dataset.ready='true';host.dataset.meshes=String([...materials].length);
    host.dataset.camera='hero';setLayer(layer);if(requestedCamera)goCamera(requestedCamera);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerDown=null;
    listen(renderer.domElement,'pointerdown',e=>{pointerDown=[e.clientX,e.clientY];});
    listen(renderer.domElement,'pointerup',e=>{
      if(assembly?.interacting||!pointerDown||Math.hypot(e.clientX-pointerDown[0],e.clientY-pointerDown[1])>6)return;
      const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
      const hit=raycaster.intersectObject(model,true).find(h=>{let p=h.object;while(p){if(!p.visible)return false;p=p.parent;}return true;});
      if(hit){let obj=hit.object;while(obj&&!assembly.has(obj.name))obj=obj.parent;if(obj)assembly.select(obj.name);}
    });
    const resizeObserver=new ResizeObserver(()=>{needsStudioRender=2;size();});resizeObserver.observe(host);eventCleanups.push(()=>resizeObserver.disconnect());
    for(const evt of ['click','change','pointerup','wheel'])listen(window,evt,e=>{const id=String(e?.target?.id||'');if(/^assembly-(x|y|z|component|apply|hide|reset-selected)$/.test(id)||e?.target?.closest?.('#assembly-mode'))return;needsStudioRender=Math.max(needsStudioRender,1);});
    listen(renderer.domElement,'webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);fail('The graphics context was interrupted. Retry the 3D view; your simulation remains available.');});
    function animate(now) {
      if(disposed)return;frame=requestAnimationFrame(animate);
      if(!active||document.hidden) {previousTime=now;return;}
      const dt=Math.min((now-previousTime)/1000||.016,.05);previousTime=now;
      if(quality==='auto') {frameMs+=dt*1000;frameCount++;if(frameCount===3&&frameMs/frameCount>27){renderer.setPixelRatio(1);renderer.shadowMap.enabled=false;host.dataset.quality='efficient';size();}}
      const state=getState();
      if(transition){const p=THREE.MathUtils.clamp((now-transition.start)/transition.duration,0,1),t=p*p*(3-2*p);camera.position.lerpVectors(transition.from,transition.to,t);controls.target.lerpVectors(transition.aimFrom,transition.aimTo,t);if(p===1)transition=null;needsStudioRender=Math.max(needsStudioRender,2);}
      controls.autoRotate=autoOrbit&&!reducedMotion;const moved=controls.update(dt);
      const sceneKey=[state.running,state.speedMps,state.distanceM,state.soc,state.powerW,state.tariffInrPerKwh,state.totalDeviceEnergyKwh,state.braking,layer,selected,environment,quality,host.dataset.camera,assembly?.exploded,...state.devices.map(d=>`${d.enabled}:${d.demandW}:${d.energyWh}`)].join('|');
      if(sceneKey!==lastSceneKey){lastSceneKey=sceneKey;needsStudioRender=Math.max(needsStudioRender,2);}
      if(!state.running&&!transition&&!autoOrbit&&!moved&&!assembly?.interacting&&needsStudioRender<=0)return;
      if(needsStudioRender>0)needsStudioRender--;
      const {wheelAngle,rotations}=drivetrainKinematics(state);
      // Operating motion is driven by distance, even when decorative motion is reduced.
      wheels.forEach(w=>{w.rotation.z=wheelAngle%(Math.PI*2);});
      rotatingParts.forEach(part=>{part.rotation.z=rotations[part.name]%(Math.PI*2);});
      displays.update(state,now);assembly.update();
      const operating=id=>{const d=state.devices.find(d=>d.id===id);return state.running&&d?.enabled&&d.demandW>0;};
      const headlights=operating('headlights'),cabin=operating('cabinLights'),display=operating('infotainment'),air=operating('airConditioning');
      for(const material of materials) {
        if(/^Headlight/i.test(material.name)) {material.emissive.set('#c9eaff');material.emissiveIntensity=headlights?4:.08;}
        if(/^Taillight/i.test(material.name)) {material.emissive.set('#ff250d');material.emissiveIntensity=state.running?(state.braking>0?4:1.2):.14;}
        if(/^CabinLight/i.test(material.name)) {material.emissive.set('#ffd1a8');material.emissiveIntensity=cabin?3:.02;}
        if(/^Display/i.test(material.name)) {material.emissive.set('#65c8e5');material.emissiveIntensity=display?1.4:0;material.color.set(display?'#3b91a8':'#091418');}
      }
      headlamps.forEach(light=>light.intensity=headlights?18:0);cabinLight.intensity=cabin?2.3:0;
      airflow.visible=air&&(layer!=='exterior'||['interior','energy'].includes(host.dataset.camera));
      for(let i=0;i<60;i++){const t=(now*.0003+i/60)%1;airflowPositions[i*3]=-.65+t*1.25;airflowPositions[i*3+1]=.83+Math.sin(t*4+i)*.09;airflowPositions[i*3+2]=Math.sin(i*13.4)*.38;}
      airflowGeometry.attributes.position.needsUpdate=true;
      energyLines.visible=layer==='energy';powerMat.opacity=state.running?.6+.3*Math.sin(now*.002):.3;
      if(frameCount%6===0||quality!=='auto')updateReading();
      renderer.render(scene,camera);
    }
    frame=requestAnimationFrame(animate);
    return {setActive(value){active=value;if(value)size();},inspect,dispose(){setExpanded(false);disposed=true;cancelAnimationFrame(frame);eventCleanups.forEach(f=>f());assembly.dispose();displays.dispose();delete window.EVStudioDiagnostics;controls.dispose();model.traverse(o=>o.geometry?.dispose());disposable.forEach(d=>d.dispose());renderer.dispose();host.replaceChildren();}};
  } catch(error) {
    console.warn('Vehicle studio unavailable:',error.message);
    fail('The 3D vehicle could not load. Check WebGL support and local assets. All simulation controls and component descriptions remain available.');
    return {setActive(){},inspect,dispose(){disposed=true;cancelAnimationFrame(frame);eventCleanups.forEach(f=>f());renderer?.dispose();host.replaceChildren();}};
  }
}
