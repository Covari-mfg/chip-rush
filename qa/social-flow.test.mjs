import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { RULESET, SHIFTS } from '../dist/core.js';
import { parseChallenge } from '../dist/social.js';

const source=await readFile(new URL('../dist/social.js',import.meta.url),'utf8');
const executable=source.replace(/^import .*;\n/,'').replaceAll('export function ','function ')
  +'\nthis.createSocial=createSocial;';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const response=(value,ok=true)=>({ok,json:async()=>value});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

// Only the DOM surface and external services are stubbed. All event handlers,
// snapshots, sharing logic, and asynchronous generation guards are production.
function setup({url='https://chip-rush.example/',nativeShare,clipboard,fetcher}={}) {
  const nodes=new Map(),requests=[],copies=[],shares=[];let nextRun=0;
  const element=()=>({hidden:true,disabled:false,value:'',textContent:'',children:[],open:false,selected:false,
    append(...children){this.children.push(...children);},replaceChildren(...children){this.children=[...children];},
    showModal(){this.open=true;},close(){this.open=false;},select(){this.selected=true;}});
  const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  $('board-role').value='0';$('player-name').value='Test Player';
  const navigator={clipboard:{writeText:async text=>{copies.push(text);if(clipboard)return clipboard(text);}}};
  if(nativeShare)navigator.share=async payload=>{shares.push(payload);return nativeShare(payload);};
  const fetch=async(path,options)=>{
    const request={path,method:options.method,body:options.body?JSON.parse(options.body):null};requests.push(request);
    if(fetcher){const value=fetcher(request);if(value!==undefined)return value;}
    if(path==='/api/runs')return response({id:'run-'+(++nextRun)});
    if(path==='/api/scores')return response({posted:true});
    return response({entries:[]});
  };
  const context=vm.createContext({RULESET,SHIFTS,URL,URLSearchParams,AbortSignal,
    document:{getElementById:$,createElement:element},location:new URL(url),navigator,fetch});
  vm.runInContext(executable,context);
  const social=context.createSocial({onChallenge(){}});
  const finish=(extra={})=>social.finish({role:2,score:4173,shipped:10,missed:0,sourced:1,calls:3,...extra});
  const submit=()=>$('post-form').onsubmit({preventDefault(){}});
  return {$,social,finish,submit,requests,copies,shares};
}

test('canceling native share retains a usable manual challenge link and copy control',async()=>{
  const f=setup({nativeShare:async()=>{const error=new Error('Canceled');error.name='AbortError';throw error;}});
  f.finish();await f.$('challenge-friend').onclick();
  assert.equal(f.shares.length,1);assert.equal(f.copies.length,0,'Cancel does not silently copy to the clipboard');
  assert.equal(f.$('share-link').hidden,false);assert.equal(f.$('copy-challenge').hidden,false);
  assert.deepEqual(parseChallenge(new URL(f.$('share-link').value).search),{role:2,score:4173,shipped:10,stars:3});
  await f.$('copy-challenge').onclick();assert.equal(f.copies[0],f.$('share-link').value);
  assert.match(f.$('share-status').textContent,/copied/);
});

test('sharing uses the exact finished snapshot and derived stars even if its input object changes',async()=>{
  const f=setup({url:'https://chip-rush.example/?challenge=1&old=1#results'});
  const result={role:2,score:3895,shipped:10,missed:0,sourced:0,calls:3,stars:99};
  f.social.finish(result);result.score=9000;result.shipped=0;result.role=0;
  await f.$('challenge-friend').onclick();
  const url=new URL(f.$('share-link').value);
  assert.deepEqual(parseChallenge(url.search),{role:2,score:3895,shipped:10,stars:3});
  assert.equal(url.hash,'');assert.equal(url.searchParams.has('old'),false);
  assert.match(f.copies[0],/Owner · 3 ★ · 10 shipped · 3,895 points/);
  assert.doesNotMatch(f.copies[0],/9,000|99 ★/);
});

test('successful posting sends the finished result once and keeps subsequent submits disabled',async()=>{
  const f=setup();f.social.start(2);await settle();f.finish();
  f.$('result-board').onclick();await settle();assert.equal(f.$('post-score').disabled,false);
  await f.submit();await settle();await f.submit();
  const posts=f.requests.filter(request=>request.path==='/api/scores');
  assert.equal(posts.length,1);
  assert.deepEqual(posts[0].body,{role:2,score:4173,shipped:10,missed:0,sourced:1,calls:3,stars:3,runId:'run-1',name:'Test Player'});
  assert.equal(f.$('post-score').disabled,true);assert.equal(f.$('post-status').textContent,'Posted. Nice shift.');
});

for(const outcome of ['success','failure'])test('a stale post '+outcome+' cannot mark a new shift posted or alter its form',async()=>{
  const pending=deferred();let scoreRequests=0;
  const f=setup({fetcher:request=>request.path==='/api/scores'&&++scoreRequests===1?pending.promise:undefined});
  f.social.start(2);await settle();f.finish({score:3000,shipped:8});
  const oldSubmission=f.submit();assert.equal(f.$('post-score').disabled,true);
  f.social.start(1);await settle();f.finish({role:1,score:2700,shipped:7,calls:0});
  f.$('result-board').onclick();await settle();
  assert.equal(f.$('post-score').disabled,false);assert.equal(f.$('post-status').textContent,'');
  if(outcome==='success')pending.resolve(response({posted:true}));else pending.reject(new Error('Old request failed'));
  await oldSubmission;await settle();
  assert.equal(f.$('post-score').disabled,false);assert.equal(f.$('post-status').textContent,'');
  assert.equal(f.$('board-role').value,'1');
  await f.submit();
  const posts=f.requests.filter(request=>request.path==='/api/scores');assert.equal(posts.length,2);
  assert.equal(posts[1].body.runId,'run-2');assert.equal(posts[1].body.role,1);assert.equal(posts[1].body.score,2700);
  assert.equal(f.$('post-status').textContent,'Posted. Nice shift.');
});

test('an older run-registration response cannot replace the new shift ownership token',async()=>{
  const pending=deferred();let starts=0;
  const f=setup({fetcher:request=>{
    if(request.path==='/api/runs')return ++starts===1?pending.promise:response({id:'current-run'});
  }});
  f.social.start(2);f.social.start(1);await settle();
  pending.resolve(response({id:'stale-run'}));await settle();
  f.finish({role:1,shipped:7,score:2500,calls:0});await f.submit();
  assert.equal(f.requests.find(request=>request.path==='/api/scores').body.runId,'current-run');
});

test('demonstration mode never registers a run or posts its result',async()=>{
  const f=setup({url:'https://chip-rush.example/?watch=owner'});
  f.social.start(2);await settle();f.finish();await f.submit();
  f.$('result-board').onclick();await settle();
  assert.equal(f.requests.some(request=>request.path==='/api/runs'||request.path==='/api/scores'),false);
  assert.equal(f.$('social-results').hidden,true);assert.equal(f.$('post-form').hidden,true);
  assert.equal(f.$('post-score').disabled,true);
});

test('offline play keeps sharing available and explains that the community board needs hosting',async()=>{
  const f=setup({url:'file:///tmp/CHIP-RUSH.html'});
  f.social.start(0);await settle();f.finish({role:0,score:800,shipped:3,calls:0});
  f.$('result-board').onclick();await settle();
  assert.equal(f.requests.length,0);assert.equal(f.$('post-score').disabled,true);
  assert.match(f.$('board-status').textContent,/hosted game/);
  await f.$('challenge-friend').onclick();
  const url=new URL(f.$('share-link').value);assert.equal(url.protocol,'https:');
  assert.deepEqual(parseChallenge(url.search),{role:0,score:800,shipped:3,stars:1});
});

test('denied clipboard permission leaves the challenge text selected for manual copying',async()=>{
  const f=setup({clipboard:async()=>{throw new Error('Clipboard denied');}});f.finish();
  await f.$('challenge-friend').onclick();
  assert.equal(f.$('share-link').hidden,false);assert.equal(f.$('copy-challenge').hidden,false);
  assert.equal(f.$('share-link').selected,true);assert.match(f.$('share-status').textContent,/Copy this challenge link/);
  await f.$('copy-challenge').onclick();assert.match(f.$('share-status').textContent,/Select and copy/);
});
