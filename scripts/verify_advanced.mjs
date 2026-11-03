// Freeze final source/evidence hashes only after every relevant check passed.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const readJson=async path=>JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));
const digest=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const receipts=[
  'validation/unit-validation.json','validation/browser-validation.json',
  'validation/phase2-browser-validation.json','validation/energy-display-browser.json',
  'validation/circuit-3d-browser-validation.json','validation/schematic-layout-audit.json',
  'validation/engineering-browser.json','assets/circuit/source-validation.json',
  'validation/vehicle-camera-browser.json','validation/advanced-circuit-audit/source-check-report.json',
  'validation/hardware-schematic-browser.json','validation/driving-scenarios-validation.json',
];
const data=await Promise.all(receipts.map(readJson));
for(const report of data.slice(0,3)){assert.equal(report.failed,0);assert.ok(report.passed>0);}
assert.ok(data[3].checks.length>=5 && data[3].checks.every(c=>c.passed));
assert.equal(data[3].error,undefined);assert.deepEqual(data[3].pageErrors,[]);
assert.equal(data[4].status,'passed');assert.ok(data[4].checks.length>=7);assert.deepEqual(data[4].errors,[]);
assert.equal(data[5].symbols,33);assert.equal(data[5].sourceWires,60);assert.deepEqual(data[5].overlaps,[]);
assert.equal(data[6].status,'passed');assert.ok(data[6].checks.length>=5);
assert.equal(data[7].status,'passed');assert.equal(data[7].sourceWires,60);assert.equal(data[7].logicalContacts,87);
assert.ok(data[8].checks.length>=7 && data[8].checks.every(c=>c.passed));assert.deepEqual(data[8].errors,[]);
assert.equal(data[9].packageFilesUnchanged,36);assert.equal(data[9].calculationScriptRan,true);assert.equal(data[9].consistencyScriptRan,true);assert.equal(data[9].recalculatedJsonMatchesStoredJson,true);
assert.equal(data[10].status,'passed');assert.equal(data[10].wireIds.length,28);assert.equal(data[10].modules,8);assert.deepEqual(data[10].clipped,[]);assert.deepEqual(data[10].overlaps,[]);
assert.equal(data[11].scenarios.length,5);assert.ok(data[11].scenarios.every(s=>Math.abs(s.mechanicalEnergyBalanceErrorWh)<1e-9&&Math.abs(s.electricalEnergyBalanceErrorWh)<1e-9));
const authoritative=await readJson('validation/engineering-package-sha256.json');
for(const file of authoritative)assert.equal(await digest(file.Path.replaceAll('\\','/')),file.SHA256.toLowerCase(),file.Path);
async function walk(dir){const paths=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory()){if(e.name!=='__pycache__')paths.push(...await walk(p));}else paths.push(p);}return paths;}
const rootFiles=(await readdir('.', {withFileTypes:true})).filter(e=>e.isFile()&&/\.(?:html|css|js|json|md)$/.test(e.name)).map(e=>e.name);
const files=[...rootFiles,...await walk('tests'),...await walk('scripts'),...await walk('docs'),...await walk('hardware'),...await walk('blender-workflow/scripts'),...await walk('assets/circuit'),...(await walk('assets/vehicle')).filter(p=>/\.(?:blend|glb|json)$/.test(p))].filter(p=>!p.endsWith('.pyc')&&!p.endsWith('.log')&&!p.endsWith('.blend1')).sort();
const result={date:'2026-11-03',timezone:'Asia/Calcutta',allChecksPassed:true,hardwareTested:false,authoritativeFilesChecked:authoritative.length,
  scope:'Software behavior, source connectivity, multi-scenario vehicle physics, numerical regression and documentary checks only. No physical safety certification, hardware/firmware validation or battery-build approval.',
  summary:{unit:data[0].passed,applicationBrowser:data[1].passed,phase2Browser:data[2].passed,energyBrowser:data[3].checks.length,circuitBrowser:data[4].checks.length,schematicSymbols:data[5].symbols,cameraBrowser:data[8].checks.length,engineeringBrowser:data[6].checks.length,drivingScenarios:data[11].scenarios.length},
  testedSources:await Promise.all(files.map(async path=>({path,sha256:await digest(path)}))),
  testedReceipts:await Promise.all(receipts.map(async path=>({path,sha256:await digest(path)}))),
};
await writeFile('validation/advanced-acceptance-manifest.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({allChecksPassed:true,...result.summary,authoritativeFilesUnchanged:authoritative.length,sourceFiles:files.length},null,2));
