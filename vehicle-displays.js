import * as THREE from 'three';

const names = { tractionMotor: 'Traction motor', headlights: 'Headlights', airConditioning: 'Air conditioning', cabinLights: 'Cabin lights', infotainment: 'Infotainment' };
const clusterNames = { headlights: 'HEADLIGHTS', airConditioning: 'CLIMATE', cabinLights: 'CABIN LIGHTS', infotainment: 'INFOTAINMENT' };
const number = (n, digits=0) => Number.isFinite(n) ? n.toFixed(digits) : '—';

// Both physical screen textures consume the exact snapshot used by the vehicle.
export function displayReadings(state) {
  return {
    running: state.running, speedKmh: state.speedKmh, socPercent: state.socPercent,
    powerW: state.powerW, voltageV: state.voltageV, currentA: state.currentA,
    netEnergyWh: state.netBatteryEnergyWh ?? state.netEnergyWh ?? 0,
    energy: {
      totalKwh: state.totalDeviceEnergyKwh,
      totalBatteryPercent: state.totalDeviceBatteryPercent,
      totalCostInr: state.totalDeviceCostInr,
      tariffInrPerKwh: state.tariffInrPerKwh,
      costCalculationStatus: state.costCalculationStatus,
      nominalCapacityKwh: state.nominalPackEnergyWh / 1000,
      usableCapacityKwh: state.usablePackEnergyWh / 1000,
      usableCapacityVerified: state.usableCapacityVerified,
      usableCapacityBasis: state.usableCapacityBasis,
    },
    devices: state.devices.filter(d => d.id in names).map(d => ({
      id:d.id, name:names[d.id], enabled:d.enabled, operating:state.running && d.enabled && d.demandW>0,
      status:!d.enabled?'OFF':!state.running?'PAUSED':d.demandW>0?'ON':'NO POWER',
      demandW:d.demandW, batteryInputW:d.batteryInputW, energyWh:d.energyWh,
      energyKwh:d.energyKwh, batteryPercentConsumed:d.batteryPercentConsumed, costInr:d.costInr,
    })),
  };
}

export function createVehicleDisplays(model) {
  const screens=[];
  for(const [meshName,width,height] of [['Screen_Cluster',1280,400],['Screen_Infotainment',1024,640]]) {
    const mesh=model.getObjectByName(meshName);
    if(!mesh?.isMesh) continue;
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;
    texture.anisotropy=4;
    const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide});
    material.name=meshName+'_Live';mesh.material=material;
    screens.push({meshName,mesh,canvas,texture,material,ctx:canvas.getContext('2d')});
  }
  let lastUpdate=-Infinity, readings=null, lastControls='';
  function update(state,now=performance.now()) {
    const controlsKey=[state.running,state.tariffInrPerKwh,state.usablePackEnergyWh,state.totalDeviceEnergyKwh===0,...state.devices.map(d=>d.enabled)].join('|');
    if(now-lastUpdate<100 && controlsKey===lastControls)return;
    lastControls=controlsKey;
    lastUpdate=now;readings=displayReadings(state);
    for(const screen of screens) {
      const {ctx:c,canvas,meshName}=screen,w=canvas.width,h=canvas.height;
      c.fillStyle='#081317';c.fillRect(0,0,w,h);
      const text=(value,x,y,size=24,color='#dae8e7',align='left')=>{c.font=`500 ${size}px Manrope, Arial, sans-serif`;c.fillStyle=color;c.textAlign=align;c.fillText(String(value),x,y);};
      const line=(x,y,x2,y2)=>{c.strokeStyle='#284048';c.lineWidth=2;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();};
      if(meshName==='Screen_Cluster') {
        text('AERIS  /  EV—01',46,47,23,'#8ba8b0');text(state.running?'DRIVE SYSTEM ACTIVE':'SIMULATION PAUSED',w-46,47,22,'#a6c3ba','right');
        text(number(state.speedKmh,0),w/2,225,144,'#eff6f3','center');text('km/h',w/2,265,26,'#8ba8b0','center');
        text('BATTERY',48,110,22,'#8ba8b0');text(number(state.socPercent,1)+'%',48,178,52);text(number(state.voltageV,1)+' V',48,229,26);
        c.fillStyle='#243a3d';c.fillRect(48,260,290,9);c.fillStyle='#99c6b4';c.fillRect(48,260,290*Math.max(0,Math.min(1,state.socPercent/100)),9);
        text('PACK POWER',w-48,110,22,'#8ba8b0','right');text(number(state.powerW/1000,2)+' kW',w-48,178,51,'#e9b18f','right');text(number(state.currentA,1)+' A',w-48,229,26,'#dae8e7','right');
        line(46,300,w-46,300);
        readings.devices.filter(d=>d.id in clusterNames).forEach((d,i)=>{const x=48+i*310;text(clusterNames[d.id],x,340,18,'#8ba8b0');text(d.status+'  '+number(d.demandW)+' W',x,376,24,d.operating?'#ace7cf':'#98a5ab');});
      } else {
        const infotainment=readings.devices.find(d=>d.id==='infotainment');
        // The education viewer keeps its energy page legible with the infotainment
        // load OFF. It is a retained visual readout, not an extra simulated load.
        const accent=infotainment.operating?'#ace7cf':'#9fb4bd';
        text('TRIP ENERGY',40,55,34,'#eaf3ef');
        text(state.running?'LIVE':'PAUSED',w-40,53,22,accent,'right');
        text(infotainment.operating?'AERIS  /  ENERGY':'AERIS  /  RETAINED ENERGY VIEW',40,88,17,'#829fa7');
        line(40,108,w-40,108);
        const columns={energy:552,battery:782,cost:984};
        text('Device',40,144,20,'#96afb4');
        text('Electricity (kWh)',columns.energy,144,20,'#96afb4','right');
        text('Battery used (%)',columns.battery,144,20,'#96afb4','right');
        text('Cost (₹)',columns.cost,144,20,'#96afb4','right');
        readings.devices.forEach((d,i)=>{
          const y=193+i*70;
          c.fillStyle=d.operating?'#98d6ba':'#465d64';c.beginPath();c.arc(47,y-9,4,0,Math.PI*2);c.fill();
          text(d.name,62,y,25,'#e4ece9');text(d.status,62,y+23,14,d.operating?'#98d6ba':'#7e969d');
          text(number(d.energyKwh,6),columns.energy,y+7,29,'#eaf1ee','right');
          text(number(d.batteryPercentConsumed,4),columns.battery,y+7,29,'#badbd0','right');
          text(number(d.costInr,4),columns.cost,y+7,29,'#e4bea1','right');
          if(i<4)line(40,y+37,w-40,y+37);
        });
        line(40,515,w-40,515);
        text('TOTAL',40,560,26,'#eaf3ef');
        text(number(readings.energy.totalKwh,6),columns.energy,560,31,'#eaf3ef','right');
        text(number(readings.energy.totalBatteryPercent,4),columns.battery,560,31,'#bce9d5','right');
        text(number(readings.energy.totalCostInr,4),columns.cost,560,31,'#efc3a2','right');
        text('Assumed usable battery: '+number(readings.energy.usableCapacityKwh,2)+' kWh · unverified',40,603,17,'#829fa7');
        text(readings.energy.costCalculationStatus==='numeric-overflow'?'Tariff too large for cost calculation':readings.energy.tariffInrPerKwh===null?'Enter a tariff outside the car to show costs':'OFF devices retain their trip totals',w-40,626,16,'#829fa7','right');
      }
      screen.texture.needsUpdate=true;
    }
  }
  return {update, snapshot:()=>({readings,screens:screens.map(s=>({mesh:s.meshName,material:s.material.name,width:s.canvas.width,height:s.canvas.height,textureVersion:s.texture.version}))}),dispose(){screens.forEach(s=>{s.texture.dispose();s.material.dispose();});}};
}
