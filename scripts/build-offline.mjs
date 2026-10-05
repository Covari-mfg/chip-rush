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
const modules=[['assets/models.js','Models'],['core.js','Core'],['manager.js','Manager'],['audio.js','Audio'],['analytics.js','Analytics'],['social.js','Social'],['technology.js','Technology'],['workflow.js','Workflow'],['device.js','Device'],['tap-navigation.js','TapNavigation']];
const musicData=(await readFile(path.join(root,'dist/assets/music/country-bluegrass-104.mp3'))).toString('base64');
let bundle=three;
for(const [file,name] of modules){const content=(await read('dist/'+file)).replace('./assets/music/country-bluegrass-104.mp3',`data:audio/mpeg;base64,${musicData}`);const names=[...content.matchAll(/export (?:function|class|const) (\w+)/g)].map(m=>m[1]);let clean=content.replace(/^import .*?;\s*$/gm,'').replace(/export (?=function|class|const)/g,'');if(file==='analytics.js')clean=`const RULESET=Core.RULESET;\n${clean}`;
  // ManagerGame extends ShopGame while the bundle is evaluating, so bind core first.
  if(file==='manager.js')clean=`const {ShopGame,SHIFTS,OPS,stockType}=Core;\n${clean}`;bundle+=`\nconst ${name}=(()=>{${clean}\nreturn {${names.join(',')}};})();`;}
bundle+='\nconst {createWorkshop,createMachine,createCharacter,createPart,createWorker,createAnnex}=Models;const {ManagerGame,MANAGER_ROLE,MANAGER_MODE,MACHINES,BAY_SIZES,UPGRADES,WING,STAFF,RUN_LENGTHS,DAY_SECONDS,COVARI_SLOTS,QUOTE_WINDOW,AD,START_CASH,RESALE,BIDS,SALES_DELAY,BREAK_FROM,SERVICE_FROM,rentFor,opInfo,boardId}=Manager;const {ShopGame,SHIFTS,OPS,PROGRAM_DURATION,stockType,STOCK_TYPES}=Core;const {ShopAudio}=Audio;const {RULESET}=Core;const {createGameAnalytics}=Analytics;const {createSocial}=Social;const {technologyBadges,technologyIcon}=Technology;const {orderWorkflow,stockIcon}=Workflow;const {deviceInterface,isPhoneDevice}=Device;const {createTapNavigation}=TapNavigation;\n';
bundle+=(await read('dist/main.js')).replace(/^import .*?;\s*$/gm,'');
const fontData=(await readFile(path.join(root,'dist/assets/fonts/instrument-sans-latin.woff2'))).toString('base64');
const css=(await read('dist/style.css')).replace('./assets/fonts/instrument-sans-latin.woff2',`data:font/woff2;base64,${fontData}`);
const mobileCSS=await read('dist/mobile.css');
const logoData=(await readFile(path.join(root,'dist/assets/covari-logo.png'))).toString('base64');
const html=(await read('dist/index.html')).replaceAll('src="./assets/covari-logo.png"',()=>`src="data:image/png;base64,${logoData}"`).replace('href="./"','href=""').replace('<link rel="stylesheet" href="./style.css">',()=>`<style>${css}</style>`).replace('<link rel="stylesheet" href="./mobile.css">',()=>`<style>${mobileCSS}</style>`).replace('<script type="module" src="./main.js"></script>',()=>`<script>(()=>{\n${bundle.replace(/<\/script/gi,'<\\/script')}\n})();</script>`);
if(/(?:src|href)="\.\//.test(html.replace('href="./"','')))throw new Error('Unexpected external asset reference in standalone game.');
await writeFile(path.join(root,'dist/CHIP-RUSH.html'),html);
await writeFile(path.join(root,'qa/offline-syntax.js'),bundle);
console.log(`Built dist/CHIP-RUSH.html (${Math.round(Buffer.byteLength(html)/1024)} KB), all assets embedded.`);
