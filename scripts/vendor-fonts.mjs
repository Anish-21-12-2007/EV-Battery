import { mkdir, writeFile } from 'node:fs/promises';
const root='assets/fonts';await mkdir(root,{recursive:true});
const cssUrl='https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap';
let css=await (await fetch(cssUrl,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'}})).text();
const urls=[...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m=>m[1]))];
for(const [i,url] of urls.entries()) {
  const response=await fetch(url);if(!response.ok)throw new Error(`Font download failed: ${response.status}`);
  const name=`font-${i}.${url.endsWith('.woff2')?'woff2':'ttf'}`;
  await writeFile(`${root}/${name}`,new Uint8Array(await response.arrayBuffer()));css=css.replaceAll(url,name);
}
await writeFile(`${root}/fonts.css`,css);
for(const name of ['manrope','dmmono']) {
  const response=await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${name}/OFL.txt`);
  if(!response.ok)throw new Error(`Font license unavailable: ${name}`);
  await writeFile(`${root}/${name}-OFL.txt`,await response.text());
}
console.log(`Vendored ${urls.length} font files and SIL Open Font Licenses.`);
