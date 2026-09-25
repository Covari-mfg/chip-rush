import { RULESET, SHIFTS } from './core.js';

export function parseChallenge(search) {
  const p=new URLSearchParams(search);
  if(p.get('challenge')!=='1'||p.get('rules')!==RULESET)return null;
  const values=['role','score','shipped'].map(k=>/^\d{1,5}$/.test(p.get(k)||'')?Number(p.get(k)):NaN);
  const [role,score,shipped]=values;
  if(!Number.isInteger(role)||role>2||!Number.isInteger(score)||score>20000||!Number.isInteger(shipped)||shipped>(role===0?8:12)||score>shipped*1600+60+(role===2?75:0))return null;
  return Object.freeze({role,score,shipped,stars:SHIFTS[role].stars.filter(n=>shipped>=n).length});
}
export function challengeURL(result,base) {
  const url=new URL(base);url.search='';url.hash='';
  for(const [key,value] of Object.entries({challenge:1,rules:RULESET,role:result.role,score:result.score,shipped:result.shipped}))url.searchParams.set(key,value);
  return url.href;
}
export function createSocial({onChallenge}) {
  const $=id=>document.getElementById(id),challenge=parseChallenge(location.search);
  const online=location.protocol!=='file:';
  const localLink=!online||['localhost','[::1]','0.0.0.0'].includes(location.hostname)||location.hostname.endsWith('.localhost')||/^127(?:\.\d{1,3}){3}$/.test(location.hostname);
  const shareNotice=!online?'Local file link: opens on this computer only. Another computer needs its own copy of the game files.':localLink?'Local preview link: opens on this computer only while this preview is running.':'';
  const shareStatus=message=>message+(shareNotice?' '+shareNotice:'');
  let run=null,result=null,generation=0,posted=false,boardGeneration=0;
  const api=async(path,data)=>{
    if(!online)throw new Error('The shared board is available in the hosted game.');
    const response=await fetch('/api/'+path,{method:data?'POST':'GET',headers:data?{'content-type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(12000)});
    let value;try{value=await response.json();}catch{throw new Error('The shared board is unavailable here. You can still play and share a challenge.');}
    if(!response.ok)throw new Error(value.error||'The board is unavailable. Try again.');return value;
  };
  const summary=value=>`${value.stars} ★ · ${value.shipped} shipped · ${value.score.toLocaleString()} points`;
  if(challenge){$('friend-challenge').hidden=false;$('friend-target').textContent=summary(challenge);$('accept-challenge').onclick=()=>onChallenge(challenge.role);}
  function renderScores(id,entries){
    const list=$(id);list.replaceChildren();
    for(const [index,row] of entries.entries()){
      const li=document.createElement('li'),rank=document.createElement('span'),identity=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small'),score=document.createElement('b');
      rank.className='score-rank';rank.textContent=String(index+1).padStart(2,'0');
      name.textContent=row.name;detail.textContent=`${row.shipped} shipped · ${row.stars} ★`;identity.append(name,detail);
      score.className='score-points';score.textContent=row.score.toLocaleString();li.append(rank,identity,score);list.append(li);
    }
  }
  async function loadBoard(showFull=true){
    const token=++boardGeneration;
    if(showFull){$('board-list').replaceChildren();$('board-status').textContent='Loading scores…';}
    try{const data=await api('leaderboard');if(token!==boardGeneration)return;
      $('board-status').textContent=data.entries.length?'Top 30 · all shifts · points':'No scores yet. Set the first one.';
      $('home-board-status').textContent=data.entries.length?'All shifts. One leaderboard.':'No scores yet. Your shift could be first.';
      renderScores('board-list',data.entries);renderScores('home-board-list',data.entries.slice(0,10));
    }catch(error){if(token!==boardGeneration)return;$('board-status').textContent=error.message;$('home-board-status').textContent=online?'Scores unavailable. Try again from the full board.':'Play online to see the community scores.';}
  }
  function openBoard(withResult=false){
    $('post-form').hidden=!withResult||!result;
    $('post-result-summary').textContent=result?`Your shift · ${summary(result)}`:'';
    $('post-score').disabled=!run||posted;
    $('post-status').textContent=posted?'Posted. Nice shift.':!run?'This shift was not connected. Play a new shift online to post.':'';
    $('leaderboard-dialog').showModal();loadBoard();
  }
  $('board-open').onclick=()=>openBoard();$('result-board').onclick=()=>openBoard(true);
  $('board-close').onclick=()=>$('leaderboard-dialog').close();
  $('post-form').onsubmit=async event=>{
    event.preventDefault();if(!run||!result||posted)return;
    const current=result,token=generation;$('post-score').disabled=true;$('post-status').textContent='Posting…';
    try{await api('scores',{...current,runId:run,name:$('player-name').value});if(token!==generation||current!==result)return;posted=true;$('post-status').textContent='Posted. Nice shift.';loadBoard();}
    catch(error){if(token!==generation||current!==result)return;$('post-status').textContent=error.message;$('post-score').disabled=false;}
  };
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
    start(role){const token=++generation;result=null;run=null;posted=false;api('runs',{role,ruleset:RULESET}).then(value=>{if(token===generation)run=value.id;}).catch(()=>{});},
    finish(value){
      result=Object.freeze({...value,stars:SHIFTS[value.role].stars.filter(n=>value.shipped>=n).length});
      $('social-results').hidden=false;$('share-status').textContent='';$('share-link').hidden=true;$('copy-challenge').hidden=true;
      $('friend-result').hidden=!challenge;
      if(challenge){$('friend-result').textContent=value.score>challenge.score?'Challenge won. Your friend has a new score to chase.':value.score===challenge.score?'A tie! One more shift to take the lead?':`${(challenge.score-value.score).toLocaleString()} points to catch your friend. One more shift?`;}
    },
  };
}
