import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import worker, { validateResult } from '../server/worker.js';
import { RULESET, SHIFTS } from '../dist/core.js';

const migration=await readFile(new URL('../drizzle/0000_omniscient_wasp.sql',import.meta.url),'utf8');
const ORIGIN='https://chip-rush.example';
const START=1_800_000_000_000;

// Exercise the real worker and migration with SQLite, adapting only D1's
// prepare/bind/result envelopes. No network or deployed database is involved.
function fixture(t) {
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(migration);t.after(()=>sqlite.close());
  const prepare=(sql,values=[])=>({
    bind(...next){return prepare(sql,next);},
    async first(){return sqlite.prepare(sql).get(...values)??null;},
    async all(){return {results:sqlite.prepare(sql).all(...values),success:true};},
    async run(){const result=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:result.changes}};},
  });
  const DB={prepare,async batch(statements){
    sqlite.exec('BEGIN');
    try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}
    catch(error){sqlite.exec('ROLLBACK');throw error;}
  }};
  const env={DB,ASSETS:{fetch:async()=>new Response('static game')}};
  async function send(path,{method='GET',data,raw,cookie,origin=ORIGIN,contentType='application/json',now=START}={}) {
    const headers=new Headers();
    if(method==='POST'&&origin!==null)headers.set('origin',origin);
    if(method==='POST'&&contentType!==null)headers.set('content-type',contentType);
    if(cookie)headers.set('cookie',cookie);
    const request=new Request(ORIGIN+path,{method,headers,body:raw??(data===undefined?undefined:JSON.stringify(data))});
    const realNow=Date.now;Date.now=()=>now;
    try{return await worker.fetch(request,env);}finally{Date.now=realNow;}
  }
  async function start(role=2,options={}) {
    const response=await send('/api/runs',{method:'POST',data:{role,ruleset:RULESET},...options});
    assert.equal(response.status,201,await response.clone().text());
    return {id:(await response.json()).id,role,cookie:response.headers.get('set-cookie').split(';')[0],response};
  }
  const result=(run,extra={})=>({runId:run.id,role:run.role,name:'Test Player',score:1000,
    shipped:SHIFTS[run.role].passTarget,missed:0,sourced:0,calls:run.role===2?3:0,...extra});
  const post=(run,extra={},options={})=>send('/api/scores',{method:'POST',cookie:run.cookie,
    data:result(run,extra),now:START+180_000,...options});
  return {sqlite,env,send,start,result,post};
}

test('starting a run issues an ownership cookie and a completed owned run can post',async t=>{
  const f=fixture(t),run=await f.start(2);
  assert.match(run.id,/^[a-f0-9-]{36}$/);
  const cookie=run.response.headers.get('set-cookie');
  for(const attribute of ['HttpOnly','SameSite=Lax','Path=/','Max-Age=31536000','Secure'])assert.ok(cookie.includes(attribute));
  assert.equal(run.response.headers.get('cache-control'),'no-store');
  assert.equal(run.response.headers.get('x-content-type-options'),'nosniff');
  const response=await f.post(run,{name:'  Josué   Parker  '});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{posted:true,id:run.id});
  const board=await f.send('/api/leaderboard?role=2');assert.equal(board.status,200);
  const data=await board.json();assert.equal(data.ruleset,RULESET);assert.equal(data.role,2);
  assert.equal(data.entries.length,1);assert.equal(data.entries[0].name,'Josué Parker');
  assert.equal(data.entries[0].stars,1);assert.equal(data.entries[0].score,1000);
  assert.equal('player' in data.entries[0],false,'Public entries do not expose ownership identifiers');
});

test('posting requires the same ownership cookie that started the run',async t=>{
  const f=fixture(t),owner=await f.start(),other=await f.start();
  for(const cookie of [undefined,'chip_player=not-a-player',other.cookie]) {
    const response=await f.post(owner,{}, {cookie});assert.equal(response.status,400);
  }
  const response=await f.post(owner,{}, {cookie:`theme=dark; ${owner.cookie}; other=ok`});
  assert.equal(response.status,200);assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM scores').get().n,1);
});

test('only same-origin POSTs are accepted, including run creation',async t=>{
  const f=fixture(t),run=await f.start();
  for(const origin of [null,'https://other.example','https://chip-rush.example.evil','http://chip-rush.example']) {
    assert.equal((await f.send('/api/runs',{method:'POST',data:{role:2,ruleset:RULESET},origin})).status,403);
    assert.equal((await f.post(run,{}, {origin})).status,403);
  }
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM runs').get().n,1);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM scores').get().n,0);
});

test('run creation rejects invalid roles and stale rulesets',async t=>{
  const f=fixture(t);
  for(const role of [-1,3,.5,'2',null]) {
    assert.equal((await f.send('/api/runs',{method:'POST',data:{role,ruleset:RULESET}})).status,400);
  }
  assert.equal((await f.send('/api/runs',{method:'POST',data:{role:2,ruleset:'old-rules'}})).status,400);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM runs').get().n,0);
});

test('malformed, missing, non-object, and oversized JSON are client errors with no writes',async t=>{
  const f=fixture(t);
  for(const path of ['/api/runs','/api/scores']) {
    for(const raw of ['{','null','[]','42','"text"',' '.repeat(4097),'"'+'é'.repeat(2100)+'"']) {
      const response=await f.send(path,{method:'POST',raw});
      assert.equal(response.status,400,path+' rejects malformed/unsupported JSON without a server error');
    }
    assert.equal((await f.send(path,{method:'POST'})).status,400);
    assert.equal((await f.send(path,{method:'POST',raw:'{}',contentType:'text/plain'})).status,400);
    assert.equal((await f.send(path,{method:'POST',raw:'{}',contentType:null})).status,400);
  }
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM runs').get().n,0);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM scores').get().n,0);
});

test('display-name validation rejects markup, control content, and length violations',async t=>{
  const f=fixture(t),run=await f.start();
  for(const name of ['', 'A','a'.repeat(25),'<img src=x>','Name/Path','Name\u0000',null,123]) {
    const response=await f.post(run,{name});assert.equal(response.status,400,JSON.stringify(name));
  }
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM scores').get().n,0);
  assert.equal((await f.post(run,{name:"O'Neil-Smith_2"})).status,200);
});

test('result validation enforces full-shift eligibility, one-day expiry, and ruleset/role identity',()=>{
  for(const role of [0,1,2]) {
    const run={role,ruleset:RULESET,started_at:START};
    const value={role,score:1000,shipped:SHIFTS[role].passTarget,missed:0,sourced:0,calls:role===2?3:0};
    const eligibleAt=START+(SHIFTS[role].duration-5)*1000;
    assert.match(validateResult(value,run,eligibleAt-1),/full shift/);
    assert.equal(validateResult(value,run,eligibleAt),null,'The documented five-second network allowance is honored');
    assert.equal(validateResult(value,run,START+86400000),null);
    assert.match(validateResult(value,run,START+86400001),/expired/);
    assert.match(validateResult({...value,role:(role+1)%3},run,eligibleAt),/new shift/);
    assert.match(validateResult(value,{...run,ruleset:'previous'},eligibleAt),/new shift/);
    assert.match(validateResult(value,null,eligibleAt),/new shift/);
  }
});

test('HTTP score posts reject early and expired runs without consuming the valid run',async t=>{
  const f=fixture(t),run=await f.start(2);
  assert.equal((await f.post(run,{}, {now:START+174999})).status,400);
  assert.equal((await f.post(run,{}, {now:START+86400001})).status,400);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM scores').get().n,0);
  assert.equal((await f.post(run,{}, {now:START+180000})).status,200);
});

test('result caps reject noninteger counts, impossible role counts, and unearned score points',()=>{
  const run={role:2,ruleset:RULESET,started_at:START};
  const valid={role:2,score:3000,shipped:6,missed:0,sourced:0,calls:3};
  for(const key of ['score','shipped','missed','sourced','calls']) {
    for(const value of [-1,.5,'1',null,undefined,Infinity])assert.ok(validateResult({...valid,[key]:value},run,START+180000),key+' rejects '+String(value));
  }
  for(const [key,value] of [['score',9001],['shipped',13],['missed',16],['sourced',2],['calls',4]]) {
    assert.ok(validateResult({...valid,[key]:value},run,START+180000));
  }
  assert.equal(validateResult({...valid,score:4560,sourced:1},run,START+180000),null);
  assert.match(validateResult({...valid,score:4561,sourced:1},run,START+180000),/shipment count/);
  assert.match(validateResult({...valid,score:59,sourced:1},run,START+180000),/shipment count/);
  assert.match(validateResult({...valid,score:1,shipped:0,calls:0},run,START+180000),/shipment count/);
  assert.equal(validateResult({...valid,score:60,shipped:0,sourced:1,calls:0},run,START+180000),null,'A sourced job may earn points without an in-house shipment');
  for(const role of [0,1]) {
    assert.ok(validateResult({...valid,role,calls:1},{...run,role},START+180000));
  }
  assert.ok(validateResult({...valid,role:0,shipped:9,calls:0},{...run,role:0},START+180000));
});

test('repeated posts are idempotent and cannot overwrite the first accepted result',async t=>{
  const f=fixture(t),run=await f.start();
  assert.equal((await f.post(run,{name:'First Player',score:1000})).status,200);
  assert.equal((await f.post(run,{name:'Changed Player',score:4000})).status,200);
  assert.equal((await f.post(run,{name:'First Player',score:1000})).status,200);
  const rows=f.sqlite.prepare('SELECT name,score FROM scores').all();
  assert.equal(rows.length,1);assert.equal(rows[0].name,'First Player');assert.equal(rows[0].score,1000);
});

test('boards separate roles and rulesets and derive stars from shipments',async t=>{
  const f=fixture(t);
  for(const role of [0,1,2]) {
    const run=await f.start(role);assert.equal((await f.post(run,{name:'Role '+role,score:1000+role,shipped:SHIFTS[role].stars[2]})).status,200);
  }
  f.sqlite.prepare('INSERT INTO scores VALUES(?,?,?,?,?,?,?,?,?,?)').run('old-score','Legacy',2,'old-rules',9000,12,0,0,3,START);
  for(const role of [0,1,2]) {
    const response=await f.send('/api/leaderboard?role='+role);assert.equal(response.status,200);
    const {entries}=await response.json();assert.equal(entries.length,1);assert.equal(entries[0].name,'Role '+role);assert.equal(entries[0].stars,3);
  }
  for(const suffix of ['', '?role=-1','?role=3','?role=1.5','?role=owner'])assert.equal((await f.send('/api/leaderboard'+suffix)).status,400);
});

test('boards return at most thirty entries in score, shipment, then creation order',async t=>{
  const f=fixture(t),insert=f.sqlite.prepare('INSERT INTO scores VALUES(?,?,?,?,?,?,?,?,?,?)');
  for(let i=0;i<32;i++)insert.run('entry-'+i,'Player '+i,2,RULESET,1000+i,6,0,0,3,START+i);
  insert.run('tie-a','Tie earlier',2,RULESET,2000,8,0,0,3,START);
  insert.run('tie-b','Tie later',2,RULESET,2000,8,0,0,3,START+1);
  insert.run('tie-c','Fewer shipped',2,RULESET,2000,6,0,0,3,START-1);
  const {entries}=await (await f.send('/api/leaderboard?role=2')).json();
  assert.equal(entries.length,30);
  assert.deepEqual(entries.slice(0,4).map(row=>row.name),['Tie earlier','Tie later','Fewer shipped','Player 31']);
});

test('run restart throttle rejects the eleventh request and recovers after one minute',async t=>{
  const f=fixture(t),run=await f.start();
  for(let i=0;i<9;i++)await f.start(2,{cookie:run.cookie});
  assert.equal((await f.send('/api/runs',{method:'POST',cookie:run.cookie,data:{role:2,ruleset:RULESET}})).status,429);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM runs').get().n,10);
  await f.start(2,{cookie:run.cookie,now:START+60001});
});

test('API unavailability does not prevent the static game from loading',async t=>{
  const f=fixture(t);
  const api=await worker.fetch(new Request(ORIGIN+'/api/leaderboard?role=2'),{ASSETS:f.env.ASSETS});
  assert.equal(api.status,503);
  const staticResponse=await worker.fetch(new Request(ORIGIN+'/'),{ASSETS:f.env.ASSETS});
  assert.equal(await staticResponse.text(),'static game');
  assert.equal((await f.send('/api/unknown')).status,404);
});
