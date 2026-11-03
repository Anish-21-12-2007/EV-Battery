import { existsSync as _hasChromium } from 'node:fs';
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const plan=JSON.parse(await readFile('hardware/revision-b.json','utf8'));
const browser=await chromium.launch(_hasChromium('/usr/bin/chromium') ? {executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu']} : {channel:'msedge',headless:true,args:['--disable-gpu']});
const page=await browser.newPage({viewport:{width:2200,height:1800},deviceScaleFactor:1});
try{
 await page.setContent('<style>body{margin:0}svg{display:block}</style>'+await readFile('hardware/revision-b-schematic.svg','utf8'));
 const report=await page.evaluate(()=>{
  const svg=document.querySelector('svg'),view=svg.viewBox.baseVal;
  const texts=[...document.querySelectorAll('text')].map(e=>{const b=e.getBBox();return{text:e.textContent,x:b.x,y:b.y,w:b.width,h:b.height};});
  const clipped=texts.filter(t=>t.x<0||t.y<0||t.x+t.w>view.width||t.y+t.h>view.height);
  const overlaps=[];
  for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const a=texts[i],b=texts[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1)overlaps.push([a.text,b.text]);}
  return{wireIds:[...document.querySelectorAll('[data-wire-id]')].map(e=>e.dataset.wireId),modules:document.querySelectorAll('[data-component]').length,endpoints:document.querySelectorAll('[data-endpoint]').length,texts:texts.length,clipped,overlaps};
 });
 assert.deepEqual(report.wireIds,plan.connections.map(c=>c.id));assert.equal(report.modules,8);assert.deepEqual(report.clipped,[]);assert.deepEqual(report.overlaps,[]);
 await page.screenshot({path:'validation/hardware-proposal-schematic.png',fullPage:true});
 await page.screenshot({path:'validation/hardware-proposal-schematic-detail.png',clip:{x:500,y:200,width:1100,height:1000}});
 await writeFile('validation/hardware-schematic-browser.json',JSON.stringify({date:'2026-11-03',status:'passed',hardwareTested:false,...report},null,2)+'\n');
 console.log(JSON.stringify({status:'passed',records:report.wireIds.length,modules:report.modules,overlaps:report.overlaps.length}));
}finally{await browser.close();}
