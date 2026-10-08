import { RULESET, SHIFTS } from './core.js';
import { createGameAnalytics } from './analytics.js';

// One Open for Business board, beside the shift board and never mixed with it.
// Older day-length ids still count as this board so a run already in progress
// opens the same list.
const MANAGER_BOARD = 'manager-v1-endless';
const LEGACY_MANAGER_BOARDS = ['manager-v1-d3', 'manager-v1-d5', 'manager-v1-d7', MANAGER_BOARD];
const isManagerBoard = board => LEGACY_MANAGER_BOARDS.includes(board);

export function parseChallenge(search) {
  const p=new URLSearchParams(search);
  if(p.get('challenge')!=='1')return null;
  const values=['role','score','shipped'].map(k=>/^\d{1,5}$/.test(p.get(k)||'')?Number(p.get(k)):NaN);
  const [role,score,shipped]=values;
  // Keep legacy numeric role indices stable when appending campaign shifts.
  if(p.get('rules')!==RULESET)return null;
  if(!Number.isInteger(role)||role>=SHIFTS.length||!Number.isInteger(score)||score>20000||!Number.isInteger(shipped)||shipped>(SHIFTS[role].maxOrders??8)||score>shipped*1600+(SHIFTS[role].sourcing&&shipped>=2?300:0)+(SHIFTS[role].calls?SHIFTS[role].callTimes.length*25:0))return null;
  return Object.freeze({role,score,shipped,stars:SHIFTS[role].stars.filter(n=>shipped>=n).length});
}
export function challengeURL(result,base) {
  const url=new URL(base);url.search='';url.hash='';
  for(const [key,value] of Object.entries({challenge:1,rules:RULESET,role:result.role,score:result.score,shipped:result.shipped}))url.searchParams.set(key,value);
  return url.href;
}
export function createSocial({onChallenge,analytics=createGameAnalytics()}) {
  const $=id=>document.getElementById(id),challenge=parseChallenge(location.search);
  const online=location.protocol!=='file:';
  const localLink=!online||['localhost','[::1]','0.0.0.0'].includes(location.hostname)||location.hostname.endsWith('.localhost')||/^127(?:\.\d{1,3}){3}$/.test(location.hostname);
  const shareNotice=!online?'Local file link: opens on this computer only. Another computer needs its own copy of the game files.':localLink?'Local preview link: opens on this computer only while this preview is running.':'';
  const shareStatus=message=>message+(shareNotice?' '+shareNotice:'');
  let run=null,result=null,generation=0,finishedGeneration=-1,posted=false,boardGeneration=0,posting=null,skipped=false,board='';
  const BOARD_KEY='chip-rush-board';
  function readBoardName(){
    try{
      const value=JSON.parse(localStorage.getItem(BOARD_KEY)||'null');
      if(!value||typeof value!=='object'||Array.isArray(value))return '';
      return typeof value.name==='string'?value.name.trim():'';
    }catch{return '';}
  }
  function writeBoardName(name){
    try{localStorage.setItem(BOARD_KEY,JSON.stringify({name:name.trim()}));}catch{}
  }
  const api=async(path,data)=>{
    if(!online)throw new Error('The shared board is available in the hosted game.');
    const response=await fetch('/api/'+path,{method:data?'POST':'GET',headers:data?{'content-type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(12000)});
    let value;try{value=await response.json();}catch{throw new Error('The shared board is unavailable here. You can still play and share a challenge.');}
    if(!response.ok)throw new Error(value.error||'The board is unavailable. Try again.');return value;
  };
  const money=value=>`$${value.toLocaleString()}`;
  const summary=value=>value.board?`${value.days} day${value.days===1?'':'s'} · ${value.shipped} shipped · ${money(value.score)} net worth`:`${value.stars} ★ · ${value.shipped} shipped · ${value.score.toLocaleString()} points`;
  if(challenge){$('friend-challenge').hidden=false;$('friend-target').textContent=summary(challenge);$('accept-challenge').onclick=()=>onChallenge(challenge.role);}
  function renderScores(id,entries){
    const list=$(id);list.replaceChildren();
    for(const [index,row] of entries.entries()){
      const li=document.createElement('li'),rank=document.createElement('span'),identity=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small'),score=document.createElement('b');
      rank.className='score-rank';rank.textContent=String(index+1).padStart(2,'0');
      const manager=row.days!==undefined;
      name.textContent=row.name;detail.textContent=manager?`${row.days} day${row.days===1?'':'s'} · ${row.shipped} shipped`:`${row.shipped} shipped · ${row.stars} ★`;identity.append(name,detail);
      score.className='score-points';score.textContent=manager?money(row.score):row.score.toLocaleString();li.append(rank,identity,score);list.append(li);
    }
  }
  function renderTabs(){
    const tabs=$('board-tabs');if(!tabs)return;tabs.replaceChildren();
    for(const [id,label] of [['','Shifts'],[MANAGER_BOARD,'Open for Business']]){
      const b=document.createElement('button');b.type='button';b.role='tab';b.ariaSelected=String(id===board);b.textContent=label;
      b.onclick=()=>{if(board===id)return;board=id;renderTabs();loadBoard();};tabs.append(b);
    }
    const manager=isManagerBoard(board);
    $('board-note').textContent=manager?'Open for Business. One board, ranked by net worth.':'One leaderboard for every shift. More complex work. Faster shipping. Higher scores.';
    $('board-scoring').textContent=manager?'Net worth at closing: cash plus equipment at resale.':'Part complexity + early shipping + streaks. CAD, customer calls and rush deliveries earn extra. Missed accepted rushes deduct points.';
  }
  async function loadBoard(showFull=true){
    const token=++boardGeneration,shown=showFull?board:'';
    if(showFull){$('board-list').replaceChildren();$('board-status').textContent='Loading scores…';}
    try{const data=await api('leaderboard'+(shown?`?board=${encodeURIComponent(shown)}`:''));if(token!==boardGeneration)return;
      if(showFull||!board){$('board-status').textContent=data.entries.length?(shown?'Top 30 · Open for Business':'Top 30 · all shifts · points'):'No scores yet. Set the first one.';renderScores('board-list',data.entries);}
      if(!shown){$('home-board-status').textContent=data.entries.length?'All shifts. One leaderboard.':'No scores yet. Your shift could be first.';renderScores('home-board-list',data.entries.slice(0,10));}
    }catch(error){if(token!==boardGeneration)return;if(showFull)$('board-status').textContent=error.message;if(!shown)$('home-board-status').textContent=online?'Scores unavailable. Try again from the full board.':'Play online to see the community scores.';}
  }
  function syncPostControls(){
    if(posting&&posting.token===generation)return;
    $('post-score').disabled=!run||posted;
    if(posted)$('post-status').textContent='Posted. Nice shift.';
    else if(result&&!run)$('post-status').textContent='This shift was not connected. Play a new shift online to post.';
    else $('post-status').textContent='';
  }
  function postScore(){
    if(!run||!result||posted)return Promise.resolve();
    const name=$('player-name').value.trim();
    if(name.length<2)return Promise.resolve();
    if(posting&&posting.token===generation)return posting.promise;
    const token=generation,current=result,runId=run;
    $('post-score').disabled=true;$('post-status').textContent='Posting…';
    const promise=(async()=>{
      try{
        await api('scores',{...current,runId,name});
        if(token!==generation||current!==result)return;
        posted=true;writeBoardName(name);
        $('post-status').textContent='Posted. Nice shift.';loadBoard();
      }catch(error){
        if(token!==generation||current!==result)return;
        $('post-status').textContent=error.message;$('post-score').disabled=false;
      }
    })();
    posting={token,promise};
    promise.finally(()=>{if(posting&&posting.promise===promise)posting=null;});
    return promise;
  }
  function maybePost(){
    if(skipped||!result)return;
    if($('player-name').value.trim().length>=2)return postScore();
    if(online)openBoard(true);
  }
  function skipLeaderboard(event){
    event?.preventDefault();
    if(!posted)skipped=true;
    $('post-form').hidden=true;
    $('leaderboard-dialog').close();
  }
  function openBoard(withResult=false){
    const requested=withResult&&result?.board?result.board:withResult?'':board;
    board=isManagerBoard(requested)?MANAGER_BOARD:requested;renderTabs();
    $('post-form').hidden=!withResult||!result;
    $('post-result-summary').textContent=result?`Your ${result.board?'run':'shift'} · ${summary(result)}`:'';
    syncPostControls();
    $('leaderboard-dialog').showModal();loadBoard();
  }
  const savedName=readBoardName();
  if(savedName)$('player-name').value=savedName;
  $('player-name').oninput=()=>writeBoardName($('player-name').value.trim());
  $('skip-leaderboard').onclick=skipLeaderboard;
  $('board-open').onclick=()=>openBoard();$('result-board').onclick=()=>openBoard(true);
  $('board-close').onclick=()=>$('leaderboard-dialog').close();
  $('post-form').onsubmit=event=>{event.preventDefault();return postScore();};
  $('copy-challenge').onclick=async()=>{try{await navigator.clipboard.writeText($('share-link').value);$('share-status').textContent=shareStatus(localLink?'Local challenge link copied.':'Challenge link copied. Paste it to a friend.');}catch{$('share-link').select();$('share-status').textContent=shareStatus('Select and copy the challenge link below.');}};
  $('challenge-friend').onclick=async()=>{
    if(!result)return;
    const url=challengeURL(result,location.href),text=`My CHIP RUSH shift: ${summary(result)}.`+(localLink?' '+shareNotice:' Can you beat it?');
    $('share-link').value=url;$('share-link').hidden=false;$('copy-challenge').hidden=false;$('share-status').textContent=shareStatus(localLink?'Copy this local challenge link.':'Share your score with a friend, or copy the link below.');
    if(navigator.share&&!localLink){try{await navigator.share({title:'CHIP RUSH · Your shift starts here',text,url});return;}catch(error){if(error.name==='AbortError')return;}}
    try{await navigator.clipboard.writeText(text+' '+url);$('share-status').textContent=shareStatus(localLink?'Local challenge and score copied.':'Challenge and score copied. Paste them to a friend.');}
    catch{$('share-link').hidden=false;$('share-link').select();$('share-status').textContent=shareStatus(localLink?'Select and copy this local challenge link.':'Copy this challenge link and send it to a friend.');}
  };
  return {
    challenge,
    refreshBoard:()=>loadBoard(false),
    start(role,ruleset=RULESET){const token=++generation;result=null;run=null;posted=false;skipped=false;analytics.track('chip_rush.shift_started',{role});api('runs',{role,ruleset}).then(value=>{if(token!==generation)return;run=value.id;if(result)maybePost();syncPostControls();}).catch(()=>{});},
    // A saved manager run picks its board run back up; it was registered when the run began.
    resume(runId){++generation;result=null;run=typeof runId==='string'&&runId?runId:null;posted=false;skipped=false;},
    runId:()=>run,
    finish(value){
      if(generation>0&&finishedGeneration===generation)return;
      finishedGeneration=generation;
      // Manager runs carry their own stars (days survived); shift stars come from the level.
      result=Object.freeze({...value,stars:value.board?value.stars:SHIFTS[value.role].stars.filter(n=>value.shipped>=n).length});
      analytics.track('chip_rush.shift_completed',{role:value.role,score:value.score,shipped:value.shipped,sourced:value.sourced});
      $('social-results').hidden=false;$('share-status').textContent='';$('share-link').hidden=true;$('copy-challenge').hidden=true;$('challenge-friend').hidden=!!value.board;
      $('friend-result').hidden=!challenge;
      if(challenge){$('friend-result').textContent=value.score>challenge.score?'Challenge won. Your friend has a new score to chase.':value.score===challenge.score?'A tie! One more shift to take the lead?':`${(challenge.score-value.score).toLocaleString()} points to catch your friend. One more shift?`;}
      maybePost();
    },
    track(event,values){analytics.track(`chip_rush.${event}`,values);},
  };
}
