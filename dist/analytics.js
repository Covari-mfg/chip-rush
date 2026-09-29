import { RULESET } from './core.js';

const POSTHOG_HOST='https://us.i.posthog.com';
// Public ingestion token for Covari's US PostHog project 442189.
const POSTHOG_KEY='phc_uedod5FmepoVRfv5y23S9bVMP2NhDTUegzMLkxkcMDwP';
const EVENTS=new Set(['chip_rush.shift_started','chip_rush.shift_completed','chip_rush.covari_clicked']);
const NUMERIC_PROPERTIES=['role','score','shipped','sourced'];

function anonymousId(cryptoLike){
  try{if(typeof cryptoLike?.randomUUID==='function')return cryptoLike.randomUUID();}catch{}
  return `tab-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function createGameAnalytics({locationLike=globalThis.location,navigatorLike=globalThis.navigator,fetchLike=globalThis.fetch,cryptoLike=globalThis.crypto}={}){
  const enabled=locationLike?.origin==='https://play.covari.io'
    && navigatorLike?.doNotTrack!=='1' && navigatorLike?.doNotTrack!=='yes'
    && navigatorLike?.globalPrivacyControl!==true;
  const distinctId=anonymousId(cryptoLike);
  function track(event,values={}){
    if(!enabled||!EVENTS.has(event)||typeof fetchLike!=='function')return;
    const properties={ruleset:RULESET,product_surface:'chip_rush',distinct_id:distinctId,$process_person_profile:false,$geoip_disable:true};
    for(const key of NUMERIC_PROPERTIES){const value=values?.[key];if(typeof value==='number'&&Number.isFinite(value))properties[key]=value;}
    try{
      Promise.resolve(fetchLike(`${POSTHOG_HOST}/capture/`,{method:'POST',headers:{'content-type':'application/json'},keepalive:true,body:JSON.stringify({api_key:POSTHOG_KEY,event,distinct_id:distinctId,properties})})).catch(()=>{});
    }catch{}
  }
  return {track};
}
