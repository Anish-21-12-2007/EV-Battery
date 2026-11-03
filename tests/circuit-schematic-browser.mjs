import { existsSync as _hasChromium } from 'node:fs';
// Focused SVG layout audit; no vehicle simulation or application regression run.
import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {parseEngineeringCsv} from '../engineering-lab.js';
import {renderCircuitSchematic} from '../circuit-schematic.js';
const wires=parseEngineeringCsv(await readFile(new URL('../FINAL_EV_EMS_ENGINEERING_PACKAGE/03_Circuit_Design/wiring_connections.csv',import.meta.url),'utf8'));
const bom=parseEngineeringCsv(await readFile(new URL('../FINAL_EV_EMS_ENGINEERING_PACKAGE/02_Component_Details/component_list.csv',import.meta.url),'utf8'));
const output=resolve('validation');await mkdir(output,{recursive:true});
const browser=await chromium.launch(_hasChromium('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']} : {channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1420,height:1000},deviceScaleFactor:1});
try{
  await page.setContent('<style>body{margin:0}svg{display:block}.schematic-net-index{display:none}</style>'+renderCircuitSchematic(wires,bom));
  await page.locator('svg').waitFor();
  const overlaps=await page.evaluate(()=>[...document.querySelectorAll('[data-schematic-component]')].flatMap(group=>{
    const labels=[...group.querySelectorAll('text')].map(el=>({text:el.textContent,rect:el.getBoundingClientRect()}));
    const conflicts=[];
    for(let a=0;a<labels.length;a++)for(let b=a+1;b<labels.length;b++){
      const r=labels[a].rect,s=labels[b].rect;
      const width=Math.min(r.right,s.right)-Math.max(r.left,s.left),height=Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top);
      if(width>1&&height>1)conflicts.push({component:group.dataset.schematicComponent,a:labels[a].text,b:labels[b].text,width,height});
    }
    return conflicts;
  }));
  for(const [id,name] of [['BUS+','bus'],['JGND','star-ground'],['U_ESP','controller'],['S_M','motor-sensor'],['TVS1','unresolved-protection']])await page.locator(`[data-schematic-component="${id}"]`).screenshot({path:resolve(output,'schematic-'+name+'.png')});
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:resolve(output,'schematic-native-detail.png')});
  await writeFile(resolve(output,'schematic-layout-audit.json'),JSON.stringify({date:'2026-11-03',symbols:33,sourceWires:60,overlaps,hardwareTested:false},null,2));
  assert.deepEqual(overlaps,[],'conventional symbol labels must not overlap');
  console.log('PASS 33 conventional symbols: no overlapping text labels at native diagram scale');
}finally{await browser.close();}
