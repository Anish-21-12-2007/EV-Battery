import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const labels={Body:'Body shell',Glass:'Glazing',Interior:'Cabin trim',Battery:'Traction battery',Motor:'Motor housing',MotorStator:'Motor stator',MotorRotor:'Motor rotor',GearIntermediate:'Reduction gear',Differential:'Differential',DriveShaft_L:'Left half-shaft',DriveShaft_R:'Right half-shaft',Inverter:'Traction inverter',DCDC:'DC/DC converter',Charger:'On-board charger',Cooling:'Cooling system',Chassis:'Chassis',Harness:'Wiring harness',Headlights:'Headlights',Taillights:'Taillights',CabinLights:'Cabin lights',Infotainment:'Infotainment assembly',Dashboard:'Dashboard',SteeringWheel:'Steering wheel',CenterConsole:'Center console',Door_L:'Left door',Door_R:'Right door',Bonnet:'Bonnet'};
const corner={FL:'front left',FR:'front right',RL:'rear left',RR:'rear right'};
for(const [prefix,label] of [['Wheel','Wheel'],['BrakeDisc','Brake disc'],['BrakeCaliper','Brake caliper'],['Suspension','Suspension'],['Seat','Seat']]) for(const [suffix,side] of Object.entries(corner)) labels[prefix+'_'+suffix]=label+' · '+side;
labels.InstrumentCluster='Instrument cluster';
export const assemblyGroupNames=Object.keys(labels);

const offsets={Body:[0,1.7,0],Glass:[0,2,0],Interior:[0,1,0],Battery:[0,-.05,1.9],Motor:[.9,.8,0],MotorStator:[.9,.8,.5],MotorRotor:[.9,.8,1],GearIntermediate:[1,.7,-.5],Differential:[1,.25,0],DriveShaft_L:[.7,.15,1.2],DriveShaft_R:[.7,.15,-1.2],Inverter:[0,1.2,-1.25],DCDC:[-.3,.4,1.2],Charger:[.6,.5,-1.2],Cooling:[-1,.2,0],Dashboard:[-.4,.75,0],SteeringWheel:[-.15,.6,.6],CenterConsole:[0,.75,.15],Bonnet:[-.65,1.15,0],Door_L:[0,.2,1.4],Door_R:[0,.2,-1.4],Headlights:[-.6,.8,0],Taillights:[.6,.8,0],CabinLights:[0,2.1,0],Infotainment:[-.4,1,0]};
function explodeOffset(name) {
  if(name==='InstrumentCluster')return new THREE.Vector3(-.4,1,.2);
  if(name==='Bonnet')return new THREE.Vector3(-.65,2.45,0);
  if(name==='Door_L')return new THREE.Vector3(0,.2,-1.4);
  if(name==='Door_R')return new THREE.Vector3(0,.2,1.4);
  if(name==='DriveShaft_L')return new THREE.Vector3(.7,.15,-1.2);
  if(name==='DriveShaft_R')return new THREE.Vector3(.7,.15,1.2);
  if(offsets[name])return new THREE.Vector3(...offsets[name]);
  const side=name.endsWith('L')?-1:1;
  if(name.startsWith('Wheel'))return new THREE.Vector3(0,.05,side*1.3);
  if(name.startsWith('BrakeDisc'))return new THREE.Vector3(0,.1,side*.85);
  if(name.startsWith('BrakeCaliper'))return new THREE.Vector3(.25,.45,side*.65);
  if(name.startsWith('Suspension'))return new THREE.Vector3(0,.6,side*.4);
  if(name.startsWith('Seat'))return new THREE.Vector3(name.includes('_F')?-.3:.3,.85,side*.35);
  return new THREE.Vector3();
}
function description(name) {
  if(name.startsWith('Wheel'))return 'Tire and rim rotate from traveled distance ÷ tire radius. Straight travel assumes no tire slip.';
  if(name.startsWith('BrakeDisc'))return 'Brake rotor follows the wheel angle. It is separately removable from the wheel and fixed caliper.';
  if(name.startsWith('BrakeCaliper'))return 'Fixed brake caliper. It does not rotate with the wheel or brake rotor.';
  if(name.startsWith('Suspension'))return 'Spring, damper and suspension linkage packaging. Suspension travel and loads are not simulated.';
  if(name.startsWith('Seat'))return 'Sculpted cushion, backrest, side bolsters, headrest, rails and upholstery. Geometry is an illustrative cabin design.';
  if(/Rotor|Gear|Differential|Shaft/.test(name))return 'Kinematic driveline component. Its operating rotation continues around its own axle after you reposition the assembly.';
  if(/Door|Bonnet/.test(name))return 'Independent coachwork panel. Translate or rotate it to inspect the cabin and structure.';
  return 'Independent illustrative vehicle component. Position and rotation edits change the inspection assembly, not simulation parameters.';
}

export function createVehicleAssembly({model,scene,camera,renderer,controls,host,onSelect,onRestore,onFocus}) {
  const container=document.getElementById('assembly-workbench');
  container.innerHTML=`<div class="assembly-heading"><div><p class="eyebrow">ASSEMBLY WORKBENCH</p><h3>Take a closer look.</h3></div><button type="button" class="button button-secondary" id="assembly-reset-all">Restore complete assembly</button></div>
  <div class="assembly-toolbar"><label>Component<select id="assembly-component"><option value="">Select a part…</option></select></label><div class="assembly-modes" id="assembly-mode" role="group" aria-label="Component manipulation"><button type="button" data-mode="inspect" aria-pressed="true">Inspect</button><button type="button" data-mode="translate" aria-pressed="false">Move</button><button type="button" data-mode="rotate" aria-pressed="false">Rotate</button></div><button type="button" class="button button-secondary" id="assembly-focus" disabled>Focus part</button><button type="button" class="button button-secondary" id="assembly-hide" disabled>Hide part</button><button type="button" class="button button-secondary" id="assembly-reset-selected" disabled>Reset part</button></div>
  <div class="assembly-coordinate-row"><span id="assembly-units">Position offset · meters</span><label>X<input id="assembly-x" type="number" step="0.05" min="-5" max="5" value="0" disabled></label><label>Y<input id="assembly-y" type="number" step="0.05" min="-5" max="5" value="0" disabled></label><label>Z<input id="assembly-z" type="number" step="0.05" min="-5" max="5" value="0" disabled></label><button type="button" id="assembly-apply" class="button button-secondary" disabled>Apply position</button></div><p id="assembly-details">Choose a part from the menu or click the vehicle. Move with the colored axes; use numeric offsets for precise control.</p><p class="assembly-note" id="assembly-status" aria-live="polite">Assembled · inspection edits do not alter the energy model.</p>`;
  const listeners=[],parts=new Map();let selected='',mode='inspect',exploded=false;
  const listen=(el,event,fn)=>{el.addEventListener(event,fn);listeners.push(()=>el.removeEventListener(event,fn));};
  const el=id=>document.getElementById(id);
  for(const name of assemblyGroupNames) {
    const object=model.getObjectByName(name);if(!object)continue;
    const parent=object.parent,wrapper=new THREE.Group();wrapper.name='Assembly_'+name;
    wrapper.position.copy(object.position);parent.add(wrapper);wrapper.add(object);object.position.set(0,0,0);
    const base=wrapper.position.clone();parts.set(name,{object,wrapper,base,offset:new THREE.Vector3(),rotation:new THREE.Euler(),hidden:false});
    const option=document.createElement('option');option.value=name;option.textContent=labels[name];el('assembly-component').append(option);
  }
  const transform=new TransformControls(camera,renderer.domElement);transform.setSize(.8);transform.setSpace('world');
  const helper=transform.getHelper();scene.add(helper);
  const box=new THREE.Box3Helper(new THREE.Box3(),0xf3b78f);box.material.depthTest=false;box.material.transparent=true;box.material.opacity=.7;box.renderOrder=99;box.visible=false;scene.add(box);
  transform.addEventListener('dragging-changed',e=>{controls.enabled=!e.value;});
  transform.addEventListener('objectChange',()=>{
    const part=parts.get(selected);if(!part)return;
    part.offset.copy(part.wrapper.position).sub(part.base).sub(exploded?explodeOffset(selected):new THREE.Vector3());
    part.rotation.copy(part.wrapper.rotation);syncFields(false);status('Part adjusted');
  });
  const position=part=>{part.wrapper.position.copy(part.base).add(part.offset);if(exploded)part.wrapper.position.add(explodeOffset(part.object.name));part.wrapper.rotation.copy(part.rotation);part.wrapper.updateMatrixWorld(true);};
  const status=text=>{el('assembly-status').textContent=`${text} · ${[...parts.values()].filter(p=>p.hidden).length} hidden`;};
  function syncFields(attach=true){
    const part=parts.get(selected),rotate=mode==='rotate';
    el('assembly-units').textContent=rotate?'Rotation offset · degrees':'Position offset · meters';
    ['x','y','z'].forEach(axis=>{const input=el('assembly-'+axis);input.disabled=!part;input.min=rotate?-360:-5;input.max=rotate?360:5;input.step=rotate?5:.05;input.value=part?(rotate?THREE.MathUtils.radToDeg(part.rotation[axis]):part.offset[axis]).toFixed(rotate?1:3):'0';});
    ['apply','focus','hide','reset-selected'].forEach(id=>el('assembly-'+id).disabled=!part);
    el('assembly-apply').textContent=rotate?'Apply rotation':'Apply position';el('assembly-hide').textContent=part?.hidden?'Reveal part':'Hide part';
    if(attach){transform.detach();if(part&&!part.hidden&&mode!=='inspect') {transform.setMode(mode);transform.attach(part.wrapper);}}
  }
  function select(name,notify=true){
    selected=parts.has(name)?name:'';el('assembly-component').value=selected;
    el('assembly-details').textContent=selected?labels[selected]+' — '+description(selected):'Choose a part from the menu or click the vehicle.';
    if(notify&&selected)onSelect?.(selected);syncFields();status(selected?labels[selected]+' selected':'Assembled');
  }
  function resetAll(){for(const p of parts.values()){p.offset.set(0,0,0);p.rotation.set(0,0,0);p.hidden=false;p.wrapper.visible=true;position(p);}setExploded(false);onRestore?.();syncFields();status('Complete assembly restored');}
  function setExploded(value){exploded=value;for(const p of parts.values())position(p);syncFields();status(value?'Exploded view':'Assembly view');}
  listen(el('assembly-component'),'change',e=>select(e.target.value));
  container.querySelectorAll('[data-mode]').forEach(b=>listen(b,'click',()=>{mode=b.dataset.mode;container.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));syncFields();}));
  listen(el('assembly-apply'),'click',()=>{const p=parts.get(selected);if(!p)return;const inputs=['x','y','z'].map(a=>el('assembly-'+a));if(inputs.some(i=>i.value===''||!i.checkValidity())){status('Enter a value within the allowed range');return;}inputs.forEach((i,index)=>{const axis=['x','y','z'][index];if(mode==='rotate')p.rotation[axis]=THREE.MathUtils.degToRad(Number(i.value));else p.offset[axis]=Number(i.value);});position(p);syncFields();status('Part adjusted');});
  listen(el('assembly-hide'),'click',()=>{const p=parts.get(selected);if(!p)return;p.hidden=!p.hidden;p.wrapper.visible=!p.hidden;if(!p.hidden)p.object.visible=true;syncFields();status(p.hidden?'Part hidden':'Part revealed');});
  listen(el('assembly-reset-selected'),'click',()=>{const p=parts.get(selected);if(!p)return;p.offset.set(0,0,0);p.rotation.set(0,0,0);p.hidden=false;p.wrapper.visible=true;position(p);syncFields();status('Selected part reset');});
  listen(el('assembly-reset-all'),'click',resetAll);
  listen(el('assembly-focus'),'click',()=>{const p=parts.get(selected);if(!p)return;p.hidden=false;p.wrapper.visible=true;p.object.visible=true;onFocus?.(new THREE.Box3().setFromObject(p.object));syncFields();});
  return {select,setExploded,resetAll,reveal(name){const part=parts.get(name);if(!part)return;part.hidden=false;part.wrapper.visible=true;part.object.visible=true;syncFields();},has:name=>parts.has(name),get selected(){return selected;},get interacting(){return transform.dragging||!!transform.axis;},
    update(){const p=parts.get(selected);box.visible=!!p&&!p.hidden&&p.object.visible;if(box.visible)box.box.setFromObject(p.object);},
    snapshot:()=>({selected,mode,exploded,parts:Object.fromEntries([...parts].map(([n,p])=>[n,{position:p.wrapper.position.toArray(),worldPosition:p.object.getWorldPosition(new THREE.Vector3()).toArray(),worldQuaternion:p.object.getWorldQuaternion(new THREE.Quaternion()).toArray(),offset:p.offset.toArray(),rotation:p.rotation.toArray().slice(0,3),operatingRotation:p.object.rotation.toArray().slice(0,3),hidden:p.hidden,visible:p.object.visible&&p.wrapper.visible}]))}),
    dispose(){listeners.forEach(f=>f());transform.dispose();scene.remove(helper,box);box.geometry.dispose();box.material.dispose();container.replaceChildren();},
  };
}
