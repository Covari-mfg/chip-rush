import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { RULESET, SHIFTS } from '../dist/core.js';
import { challengeURL, parseChallenge } from '../dist/social.js';

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
  const $=id=>{assert.notEqual(id,'board-role','The unified board must not depend on a role picker');if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  $('player-name').value='Test Player';
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
  assert.match(f.copies[0],/3 ★ · 10 shipped · 3,895 points/);
  assert.doesNotMatch(f.copies[0],/Owner ·|Production Manager ·|Operator ·/);
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
  assert.ok(f.requests.filter(request=>request.path.startsWith('/api/leaderboard')).every(request=>request.path==='/api/leaderboard'));
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

test('one unfiltered board shows server scores in rank order without role labels',async()=>{
  const f=setup({fetcher:request=>request.path==='/api/leaderboard'?response({entries:[
    {name:'First Player',score:5100,shipped:10,stars:3},
    {name:'Second Player',score:3500,shipped:7,stars:3},
  ]}):undefined});
  f.$('board-open').onclick();await settle();
  assert.deepEqual(f.requests.map(request=>request.path),['/api/leaderboard']);
  const rows=f.$('board-list').children;
  assert.equal(rows.length,2);assert.equal(rows[0].children[0].textContent,'01');
  assert.equal(rows[0].children[1].children[0].textContent,'First Player');
  assert.equal(rows[0].children[1].children[1].textContent,'10 shipped · 3 ★');
  assert.equal(rows[0].children[2].textContent,'5,100');
  assert.equal(rows[1].children[2].textContent,'3,500');
});

test('friend challenges compare actual total points across roles without hiding the result',()=>{
  const url=challengeURL({role:0,score:2500,shipped:5},'https://chip-rush.example/');
  const f=setup({url});
  assert.equal(f.$('friend-target').textContent,'3 ★ · 5 shipped · 2,500 points');
  f.finish({role:2,score:2400});assert.equal(f.$('friend-result').hidden,false);
  assert.match(f.$('friend-result').textContent,/100 points to catch/);
  f.finish({role:2,score:2500});assert.match(f.$('friend-result').textContent,/tie/);
  f.finish({role:2,score:2501});assert.match(f.$('friend-result').textContent,/Challenge won/);
});

for(const mode of ['operator','manager','owner','sequence'])test('old '+mode+' watch URLs behave as ordinary playable games',async()=>{
  const f=setup({url:'https://chip-rush.example/?watch='+mode});
  f.social.start(2);await settle();f.finish();
  f.$('result-board').onclick();await settle();await f.submit();
  assert.equal(f.requests.some(request=>request.path==='/api/runs'),true);
  assert.equal(f.requests.some(request=>request.path==='/api/scores'),true);
  assert.equal(f.$('social-results').hidden,false);assert.equal(f.$('post-form').hidden,false);
});

test('offline play keeps sharing available and explains that the community board needs hosting',async()=>{
  const f=setup({url:'file:///tmp/CHIP-RUSH.html',nativeShare:async()=>{}});
  f.social.start(0);await settle();f.finish({role:0,score:800,shipped:3,calls:0});
  f.$('result-board').onclick();await settle();
  assert.equal(f.requests.length,0);assert.equal(f.$('post-score').disabled,true);
  assert.match(f.$('board-status').textContent,/hosted game/);
  await f.$('challenge-friend').onclick();
  const url=new URL(f.$('share-link').value);assert.equal(url.protocol,'file:');assert.equal(url.pathname,'/tmp/CHIP-RUSH.html');
  assert.deepEqual(parseChallenge(url.search),{role:0,score:800,shipped:3,stars:1});
  assert.equal(f.shares.length,0,'An offline file link is copied locally, not sent through native sharing');
  assert.match(f.$('share-status').textContent,/Local file link.*this computer only.*copy of the game files/);
  assert.match(f.copies[0],/Local file link.*this computer only/);
  assert.doesNotMatch(f.copies[0],/chatgpt\.site/);
});

test('loopback challenge links preserve the preview origin and path and explain their local scope',async()=>{
  for(const origin of ['http://localhost:4173','http://127.0.0.1:4173','http://127.0.0.2:8080','http://[::1]:4173','http://game.localhost:4173','http://0.0.0.0:4173']) {
    const f=setup({url:origin+'/preview/chip-rush/?old=1#results',nativeShare:async()=>{}});
    f.finish();await f.$('challenge-friend').onclick();
    const url=new URL(f.$('share-link').value);
    assert.equal(url.origin,origin);assert.equal(url.pathname,'/preview/chip-rush/');
    assert.equal(url.hash,'');assert.equal(url.searchParams.has('old'),false);
    assert.deepEqual(parseChallenge(url.search),{role:2,score:4173,shipped:10,stars:3});
    assert.equal(f.shares.length,0);assert.equal(f.copies.length,1);
    assert.match(f.$('share-status').textContent,/Local preview link.*this computer only.*preview is running/);
    assert.match(f.copies[0],/Local preview link.*this computer only/);
    assert.doesNotMatch(f.copies[0],/chatgpt\.site/);
    await f.$('copy-challenge').onclick();
    assert.equal(f.copies[1],url.href);assert.match(f.$('share-status').textContent,/this computer only/);
  }
});

test('manual-copy fallback keeps the local-link limitation visible when clipboard permission is denied',async()=>{
  const f=setup({url:'http://127.0.0.1:4173/game/',clipboard:async()=>{throw new Error('Clipboard denied');}});
  f.finish();await f.$('challenge-friend').onclick();
  assert.equal(f.$('share-link').hidden,false);assert.equal(f.$('copy-challenge').hidden,false);
  assert.equal(f.$('share-link').selected,true);assert.match(f.$('share-status').textContent,/local challenge link.*this computer only/);
  await f.$('copy-challenge').onclick();assert.match(f.$('share-status').textContent,/Select and copy.*this computer only/);
});

test('denied clipboard permission leaves the challenge text selected for manual copying',async()=>{
  const f=setup({clipboard:async()=>{throw new Error('Clipboard denied');}});f.finish();
  await f.$('challenge-friend').onclick();
  assert.equal(f.$('share-link').hidden,false);assert.equal(f.$('copy-challenge').hidden,false);
  assert.equal(f.$('share-link').selected,true);assert.match(f.$('share-status').textContent,/Copy this challenge link/);
  await f.$('copy-challenge').onclick();assert.match(f.$('share-status').textContent,/Select and copy/);
});


test('start page shows the first ten real server scores while the full board retains all ranks',async()=>{
  const entries=Array.from({length:18},(_,i)=>({name:i===0?'<img src=x onerror=alert(1)>':'Player '+i,score:6800-i*211,shipped:10,stars:3}));
  const f=setup({fetcher:request=>request.path==='/api/leaderboard'?response({entries}):undefined});
  await f.social.refreshBoard();
  const small=f.$('home-board-list').children,full=f.$('board-list').children;
  assert.equal(small.length,10);assert.equal(full.length,18);
  assert.equal(small[0].children[1].children[0].textContent,entries[0].name);
  assert.equal(small[0].children[1].children[0].innerHTML,undefined,'Names are assigned as text, never HTML');
  assert.equal(small[9].children[2].textContent,entries[9].score.toLocaleString());
  assert.equal(f.$('leaderboard-dialog').open,false,'Loading the start-page board does not open a modal');
});

test('an empty community board has no fabricated scores on either surface',async()=>{
  const f=setup();await f.social.refreshBoard();
  assert.equal(f.$('home-board-list').children.length,0);assert.equal(f.$('board-list').children.length,0);
  assert.match(f.$('home-board-status').textContent,/No scores yet/);
});
