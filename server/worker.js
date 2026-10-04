import { RULESET, SHIFTS, ShopGame } from '../dist/core.js';
import { MANAGER_ROLE, DAY_SECONDS, START_CASH, START_ASSETS, MAX_DAYS, parseBoard, maxPayout } from '../dist/manager.js';
const MAX_BODY=4096;
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const fail=(message,status=400)=>json({error:message},status);
const validRole=role=>Number.isInteger(role)&&role>=0&&role<SHIFTS.length;
const playerId=request=>request.headers.get('cookie')?.match(/(?:^|;\s*)chip_player=([a-f0-9-]{36})(?:;|$)/)?.[1];
async function body(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('Send JSON.');
  const reader=request.body?.getReader();if(!reader)throw new Error('Missing request.');
  let length=0,text='';const decoder=new TextDecoder();
  while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BODY){await reader.cancel();throw new Error('Request too large.');}text+=decoder.decode(value,{stream:true});}
  text+=decoder.decode();const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw new SyntaxError('Expected an object.');return value;
}
export function validateResult(value,run,now=Date.now()){
  if(!run||!validRole(run.role)||run.ruleset!==RULESET||value.role!==run.role)return 'Start a new shift before posting.';
  const config=SHIFTS[run.role],wallSeconds=(now-run.started_at)/1000;
  if(wallSeconds>86400)return 'This score submission has expired. Play another shift.';
  const ranges={score:[0,20000],shipped:[0,config.maxOrders??8],missed:[0,15],sourced:[0,config.sourcing?1:0],calls:[0,config.calls?config.callTimes.length:0]};
  for(const [key,[min,max]] of Object.entries(ranges))if(!Number.isInteger(value[key])||value[key]<min||value[key]>max)return 'That result is outside this shift’s limits.';
  if(value.finishReason!==undefined&&!['work-complete','time-up'].includes(value.finishReason))return 'Finish this shift before posting.';
  if(value.elapsed!==undefined&&(!Number.isFinite(value.elapsed)||value.elapsed<0||value.elapsed>config.duration+.1||wallSeconds<value.elapsed-5))return 'That finish time does not match this run.';
  if(value.finishReason==='work-complete'){
    if(!Number.isFinite(value.elapsed)||!Number.isInteger(value.spawned)||value.spawned<1||value.spawned>(config.maxOrders??8)||value.spawned!==value.shipped+value.missed)return 'Finish every outstanding order before posting.';
    const lastArrival=value.spawned<2?0:config.firstArrival+(value.spawned-2)*config.interval;
    if(value.elapsed<lastArrival)return 'Those orders have not all arrived yet.';
    // Conservative eligibility check, not an authoritative replay. Give the
    // next arrival its longest possible gap; even then it must be ineligible.
    // This shares the game's late-arrival cutoff instead of inventing a timer.
    const probe=new ShopGame();probe.reset(run.role);probe.orders=[];
    probe.spawnIndex=value.spawned;probe.elapsed=value.elapsed;probe.time=config.duration-value.elapsed;
    // Before four arrivals the queue cannot have been full. Those scheduled
    // arrivals cannot be omitted; allow the engine's 0.1s tick rounding per gap.
    if(value.spawned<Math.min(4,config.maxOrders??Infinity)){
      const nextScheduled=config.firstArrival+(value.spawned-1)*config.interval+.1*(value.spawned+1);
      if(nextScheduled<=value.elapsed&&probe.spawnRecipe(config.duration-nextScheduled))return 'Those scheduled orders are missing from this result.';
    }
    probe.nextArrival=value.elapsed+Math.max(config.firstArrival,config.interval,2);
    if(probe.hasEligibleFutureArrival())return 'There is still work scheduled for this shift.';
    if(value.calls>config.callTimes.filter(at=>at+3<=value.elapsed).length)return 'Those calls have not finished yet.';
  }else{
    // Older clients may omit completion metadata; they still need the full clock.
    if(wallSeconds<config.duration-5)return 'Finish the full shift before posting.';
    if(value.elapsed!==undefined&&value.elapsed<config.duration-.1)return 'Finish the full shift before posting.';
  }
  if(value.sourced&&value.shipped<2)return 'That score does not match the completed work.';
  const support=value.sourced*300+value.calls*25;
  // Each answered call can lose its 25 points if the accepted rush misses.
  // Sourcing points remain earned even when every rush is missed.
  if(value.score<value.sourced*300||value.score>value.shipped*1600+support)return 'That score does not match the completed work.';
  return null;
}

// Open for Business posts net worth for one run length. Like shift scores
// these are self-reported; the checks bound them by the game's own economy.
export function validateManagerResult(value,run,now=Date.now()){
  const length=parseBoard(run?.ruleset);
  if(!run||length===null||run.role!==MANAGER_ROLE||value.role!==MANAGER_ROLE||(value.board!==undefined&&value.board!==run.ruleset))return 'Start a new run before posting.';
  const wallSeconds=(now-run.started_at)/1000;
  if(wallSeconds>3*86400)return 'This score submission has expired. Play another run.';
  const maxDays=length||MAX_DAYS;
  for(const key of ['score','shipped','missed','sourced','days'])if(!Number.isInteger(value[key])||value[key]<0)return 'That result is outside this run’s limits.';
  if(value.days>maxDays)return 'That result is outside this run’s limits.';
  if(!['complete','bankrupt','retired'].includes(value.finishReason))return 'Finish this run before posting.';
  if(value.finishReason==='complete'&&(!length||value.days!==length))return 'That run did not finish its days.';
  if(value.finishReason==='retired'&&length)return 'Only an Endless run can retire early.';
  if(value.finishReason==='bankrupt'&&length&&value.days>=length)return 'That run did not finish its days.';
  const played=value.finishReason==='bankrupt'?value.days+1:value.days;
  if(!Number.isFinite(value.elapsed)||Math.abs(value.elapsed-played*DAY_SECONDS)>1||wallSeconds<value.elapsed-5)return 'That finish time does not match this run.';
  if(value.sourced>value.shipped||value.shipped>Math.ceil(value.elapsed/4)+4||value.missed>Math.ceil(value.elapsed/4)+4)return 'That score does not match the completed work.';
  // Net worth counts the starting lathe, mill and QC bench at resale.
  if(value.score>START_CASH+START_ASSETS+value.shipped*maxPayout(Math.max(1,played)))return 'That score does not match the completed work.';
  return null;
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    if(!env.DB)return fail('The community board is unavailable. Your game still works.',503);
    if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return fail('Use the game page to post.',403);
    try{
      if(url.pathname==='/api/leaderboard'&&request.method==='GET'&&url.searchParams.has('board')){
        const board=url.searchParams.get('board'),length=parseBoard(board);
        if(length===null)return fail('Choose a leaderboard.',404);
        const order=length?'points DESC,days DESC,created_at ASC':'days DESC,points DESC,created_at ASC';
        const data=await env.DB.prepare(`SELECT name,points AS score,shipped,missed,sourced,days,created_at FROM scores WHERE ruleset=? ORDER BY ${order} LIMIT 30`).bind(board).all();
        return json({ruleset:board,entries:data.results||[]});
      }
      if(url.pathname==='/api/leaderboard'&&request.method==='GET'){
        // Operator's workload and scoring are unchanged from v5. Preserve those
        // comparable scores without mixing older Manager and Owner runs.
        const data=await env.DB.prepare('SELECT name,role,score AS rawScore,points AS score,shipped,missed,sourced,calls,created_at FROM scores WHERE ruleset=? ORDER BY points DESC,shipped DESC,created_at ASC LIMIT 30').bind(RULESET).all();
        return json({ruleset:RULESET,entries:(data.results||[]).map(({role,...row})=>({...row,stars:SHIFTS[role].stars.filter(n=>row.shipped>=n).length}))});
      }
      if(url.pathname==='/api/runs'&&request.method==='POST'){
        const value=await body(request);
        const managerRun=value.role===MANAGER_ROLE&&parseBoard(value.ruleset)!==null;
        if(!managerRun&&(!validRole(value.role)||value.ruleset!==RULESET))return fail('Reload the game to start a current shift.');
        const player=playerId(request)||crypto.randomUUID(),now=Date.now();
        const recent=await env.DB.prepare('SELECT COUNT(*) AS count FROM runs WHERE player=? AND started_at>?').bind(player,now-60000).first();
        if(recent.count>=10)return fail('Too many restarts. Try again in a minute.',429);
        const id=crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare('DELETE FROM runs WHERE started_at<?').bind(now-86400000),
          env.DB.prepare('INSERT INTO runs(id,player,role,ruleset,started_at) VALUES(?,?,?,?,?)').bind(id,player,value.role,value.ruleset,now),
        ]);
        return json({id},201,{'set-cookie':`chip_player=${player}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${url.protocol==='https:'?'; Secure':''}`});
      }
      if(url.pathname==='/api/scores'&&request.method==='POST'){
        const value=await body(request),player=playerId(request);
        if(typeof value.runId!=='string'||!player)return fail('This shift was not connected to the community board. Try another shift.');
        const run=await env.DB.prepare('SELECT * FROM runs WHERE id=? AND player=?').bind(value.runId,player).first();
        const manager=parseBoard(run?.ruleset)!==null;
        const error=manager?validateManagerResult(value,run):validateResult(value,run);if(error)return fail(error);
        const name=typeof value.name==='string'?value.name.trim().replace(/\s+/g,' '):'';
        if(!/^[\p{L}\p{N} ._'-]{2,24}$/u.test(name))return fail('Use a display name with 2–24 letters, numbers, spaces or . _ - apostrophe.');
        if(manager)await env.DB.prepare('INSERT OR IGNORE INTO scores(id,name,role,ruleset,score,points,shipped,missed,sourced,calls,days,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(run.id,name,run.role,run.ruleset,value.score,value.score,value.shipped,value.missed,value.sourced,0,value.days,Date.now()).run();
        else await env.DB.prepare('INSERT OR IGNORE INTO scores(id,name,role,ruleset,score,points,shipped,missed,sourced,calls,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(run.id,name,run.role,RULESET,value.score,value.score,value.shipped,value.missed,value.sourced,value.calls,Date.now()).run();
        return json({posted:true,id:run.id});
      }
      return fail('Not found.',404);
    }catch(error){
      if(error instanceof SyntaxError||['Send JSON.','Missing request.','Request too large.'].includes(error.message))return fail('The score request could not be read.');
      console.error('chip-rush-board',error?.message);
      return fail('The community board is unavailable. Try again shortly.',503);
    }
  }
};
