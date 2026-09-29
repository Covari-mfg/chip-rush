import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameAnalytics } from '../dist/analytics.js';

const location=origin=>({origin});
const requestLog=()=>{const calls=[];const fetch=async(...args)=>{calls.push(args);return {ok:true};};return {calls,fetch};};

test('analytics posts only the allowlisted event and numeric properties on production origin',async()=>{
  const log=requestLog();
  const analytics=createGameAnalytics({locationLike:location('https://play.covari.io'),navigatorLike:{},fetchLike:log.fetch,cryptoLike:{randomUUID:()=> 'tab-id'}});
  analytics.track('chip_rush.shift_started',{role:2,score:9,shipped:3,sourced:1,name:'omit',url:'omit'});
  await Promise.resolve();
  assert.equal(log.calls.length,1);
  const [url,options]=log.calls[0],body=JSON.parse(options.body);
  assert.equal(url,'https://us.i.posthog.com/capture/');assert.equal(options.method,'POST');assert.equal(options.keepalive,true);
  assert.equal(body.api_key,'phc_uedod5FmepoVRfv5y23S9bVMP2NhDTUegzMLkxkcMDwP');assert.equal(body.event,'chip_rush.shift_started');
  assert.equal(body.distinct_id,'tab-id');
  assert.deepEqual(body.properties,{ruleset:'roles-v8-optional-calls',product_surface:'chip_rush',distinct_id:'tab-id',role:2,score:9,shipped:3,sourced:1,$process_person_profile:false,$geoip_disable:true});
});

test('analytics stays silent outside production and when privacy signals are enabled',async()=>{
  for(const navigatorLike of [{doNotTrack:'1'},{doNotTrack:'yes'},{globalPrivacyControl:true},{}]){
    const log=requestLog();const origin=navigatorLike.globalPrivacyControl||navigatorLike.doNotTrack? 'https://play.covari.io':'http://localhost:5173';
    const analytics=createGameAnalytics({locationLike:location(origin),navigatorLike,fetchLike:log.fetch});
    analytics.track('chip_rush.shift_completed',{role:1,score:1,shipped:1,sourced:0});await Promise.resolve();assert.equal(log.calls.length,0);
  }
});

test('unknown events, failed requests, and missing fetch cannot affect the game',async()=>{
  const throwing=()=>{throw new Error('network down');};
  const analytics=createGameAnalytics({locationLike:location('https://play.covari.io'),navigatorLike:{},fetchLike:throwing});
  assert.doesNotThrow(()=>analytics.track('chip_rush.other',{role:1}));
  assert.doesNotThrow(()=>analytics.track('chip_rush.covari_clicked'));
  const missing=createGameAnalytics({locationLike:location('https://play.covari.io'),navigatorLike:{},fetchLike:undefined});
  assert.doesNotThrow(()=>missing.track('chip_rush.covari_clicked'));
});

test('anonymous id is generated in memory for each analytics instance',async()=>{
  const ids=[];let sequence=0;const fetch=async(_,options)=>ids.push(JSON.parse(options.body).properties.distinct_id);
  const options={locationLike:location('https://play.covari.io'),navigatorLike:{},fetchLike:fetch,cryptoLike:{randomUUID:()=>`id-${++sequence}`}};
  createGameAnalytics(options).track('chip_rush.covari_clicked');createGameAnalytics(options).track('chip_rush.covari_clicked');await Promise.resolve();
  assert.equal(ids.length,2);assert.notEqual(ids[0],ids[1]);
});
