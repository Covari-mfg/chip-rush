import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(path.join(root,p),'utf8');
const source=await read('dist/vendor/three.module.js');
const match=source.match(/export\s*\{([^}]+)\};?\s*$/);
if(!match)throw new Error('Expected pinned Three.js named exports.');
const exports=match[1].split(',').map(s=>{const [local,name]=s.trim().split(/\s+as\s+/);return `${name||local}:${local}`;}).join(',');
const three=`const THREE=(()=>{${source.slice(0,match.index)}\nreturn {${exports}};})();`;
// Dependency order: each module is evaluated after the modules it imports.
const modules=[['assets/models.js','Models'],['core.js','Core'],['manager.js','Manager'],['launch.js','Launch'],['audio.js','Audio'],['analytics.js','Analytics'],['records.js','Records'],['social.js','Social'],['technology.js','Technology'],['workflow.js','Workflow'],['device.js','Device'],['tap-navigation.js','TapNavigation']];
const bundleName=new Map(modules);
// Every music file a module names is embedded, so the standalone file plays offline.
const music=new Map();
async function embedMusic(content){
  for(const [url,file] of content.matchAll(/\.\/assets\/music\/([\w.-]+\.mp3)/g))
    if(!music.has(url))music.set(url,`data:audio/mpeg;base64,${(await readFile(path.join(root,'dist/assets/music',file))).toString('base64')}`);
  return content.replace(/\.\/assets\/music\/[\w.-]+\.mp3/g,url=>music.get(url));
}
// Named imports become bindings to the already-evaluated module objects. They
// are read from each file, so a new import can never be left out of the bundle.
function bindImports(content,from){
  const lines=[];
  for(const [,names,target] of content.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';\s*$/gm)){
    const key=path.posix.normalize(path.posix.join(path.posix.dirname(from),target));
    const name=bundleName.get(key);if(!name)throw new Error(`Standalone build: ${from} imports ${target}, which is not bundled.`);
    const bindings=names.split(',').map(s=>s.trim()).filter(Boolean).map(s=>{const [imported,local]=s.split(/\s+as\s+/);return local?`${imported}:${local}`:imported;});
    lines.push(`const {${bindings.join(',')}}=${name};`);
  }
  return lines.join('\n');
}
const strip=content=>content.replace(/^import .*?;\s*$/gm,'');
let bundle=three;
for(const [file,name] of modules){
  const content=await embedMusic(await read('dist/'+file));
  const names=[...content.matchAll(/export (?:function|class|const) (\w+)/g)].map(m=>m[1]);
  const clean=strip(content).replace(/export (?=function|class|const)/g,'');
  bundle+=`\nconst ${name}=(()=>{${bindImports(content,file)}\n${clean}\nreturn {${names.join(',')}};})();`;
}
const main=await read('dist/main.js');
bundle+=`\n${bindImports(main,'main.js')}\n${strip(main)}`;
const fontData=(await readFile(path.join(root,'dist/assets/fonts/instrument-sans-latin.woff2'))).toString('base64');
const css=(await read('dist/style.css')).replace('./assets/fonts/instrument-sans-latin.woff2',`data:font/woff2;base64,${fontData}`);
const mobileCSS=await read('dist/mobile.css');
const logoData=(await readFile(path.join(root,'dist/assets/covari-logo.png'))).toString('base64');
const html=(await read('dist/index.html')).replaceAll('src="./assets/covari-logo.png"',()=>`src="data:image/png;base64,${logoData}"`).replace('href="./"','href=""').replace('<link rel="stylesheet" href="./style.css">',()=>`<style>${css}</style>`).replace('<link rel="stylesheet" href="./mobile.css">',()=>`<style>${mobileCSS}</style>`).replace('<script type="module" src="./main.js"></script>',()=>`<script>(()=>{\n${bundle.replace(/<\/script/gi,'<\\/script')}\n})();</script>`);
if(/(?:src|href)="\.\//.test(html.replace('href="./"','')))throw new Error('Unexpected external asset reference in standalone game.');
if(/\.\/assets\/music\//.test(bundle))throw new Error('Unexpected external music reference in standalone game.');
await writeFile(path.join(root,'dist/CHIP-RUSH.html'),html);
await writeFile(path.join(root,'qa/offline-syntax.js'),bundle);
console.log(`Built dist/CHIP-RUSH.html (${Math.round(Buffer.byteLength(html)/1024)} KB), all assets embedded.`);
