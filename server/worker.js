import { RULESET, SHIFTS } from '../dist/core.js';
const MAX_BODY=4096;
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const fail=(message,status=400)=>json({error:message},status);
const validRole=role=>Number.isInteger(role)&&role>=0&&role<3;
const playerId=request=>request.headers.get('cookie')?.match(/(?:^|;\s*)chip_player=([a-f0-9-]{36})(?:;|$)/)?.[1];
async function body(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('Send JSON.');
  const reader=request.body?.getReader();if(!reader)throw new Error('Missing request.');
  let length=0,text='';const decoder=new TextDecoder();
  while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BODY){await reader.cancel();throw new Error('Request too large.');}text+=decoder.decode(value,{stream:true});}
  text+=decoder.decode();const value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))throw new SyntaxError('Expected an object.');return value;
}
export function validateResult(value,run,now=Date.now()){
  if(!run||run.ruleset!==RULESET||value.role!==run.role)return 'Start a new shift before posting.';
  if(now-run.started_at<(SHIFTS[run.role].duration-5)*1000)return 'Finish the full shift before posting.';
  if(now-run.started_at>86400000)return 'This score submission has expired. Play another shift.';
  const ranges={score:[0,20000],shipped:[0,run.role===0?8:12],missed:[0,15],sourced:[0,1],calls:[0,run.role===2?3:0]};
  for(const [key,[min,max]] of Object.entries(ranges))if(!Number.isInteger(value[key])||value[key]<min||value[key]>max)return 'That result is outside this shift’s limits.';
  const support=value.sourced*60+value.calls*25;
  if(value.score<support||value.score>value.shipped*1600+support)return 'That score does not match the completed work.';
  return null;
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    if(!env.DB)return fail('The community board is unavailable. Your game still works.',503);
    if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return fail('Use the game page to post.',403);
    try{
      if(url.pathname==='/api/leaderboard'&&request.method==='GET'){
        const data=await env.DB.prepare('SELECT name,role,score AS rawScore,points AS score,shipped,missed,sourced,calls,created_at FROM scores WHERE ruleset=? ORDER BY points DESC,shipped DESC,created_at ASC LIMIT 30').bind(RULESET).all();
        return json({ruleset:RULESET,entries:(data.results||[]).map(({role,...row})=>({...row,stars:SHIFTS[role].stars.filter(n=>row.shipped>=n).length}))});
      }
      if(url.pathname==='/api/runs'&&request.method==='POST'){
        const value=await body(request);if(!validRole(value.role)||value.ruleset!==RULESET)return fail('Reload the game to start a current shift.');
        const player=playerId(request)||crypto.randomUUID(),now=Date.now();
        const recent=await env.DB.prepare('SELECT COUNT(*) AS count FROM runs WHERE player=? AND started_at>?').bind(player,now-60000).first();
        if(recent.count>=10)return fail('Too many restarts. Try again in a minute.',429);
        const id=crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare('DELETE FROM runs WHERE started_at<?').bind(now-86400000),
          env.DB.prepare('INSERT INTO runs(id,player,role,ruleset,started_at) VALUES(?,?,?,?,?)').bind(id,player,value.role,RULESET,now),
        ]);
        return json({id},201,{'set-cookie':`chip_player=${player}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${url.protocol==='https:'?'; Secure':''}`});
      }
      if(url.pathname==='/api/scores'&&request.method==='POST'){
        const value=await body(request),player=playerId(request);
        if(typeof value.runId!=='string'||!player)return fail('This shift was not connected to the community board. Try another shift.');
        const run=await env.DB.prepare('SELECT * FROM runs WHERE id=? AND player=?').bind(value.runId,player).first();
        const error=validateResult(value,run);if(error)return fail(error);
        const name=typeof value.name==='string'?value.name.trim().replace(/\s+/g,' '):'';
        if(!/^[\p{L}\p{N} ._'-]{2,24}$/u.test(name))return fail('Use a display name with 2–24 letters, numbers, spaces or . _ - apostrophe.');
        await env.DB.prepare('INSERT OR IGNORE INTO scores(id,name,role,ruleset,score,points,shipped,missed,sourced,calls,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(run.id,name,run.role,RULESET,value.score,value.score,value.shipped,value.missed,value.sourced,value.calls,Date.now()).run();
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
