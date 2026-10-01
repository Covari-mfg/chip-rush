import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createTapNavigation} from '../dist/tap-navigation.js';

const main = await readFile(new URL('../dist/main.js', import.meta.url), 'utf8');
function productionFunction(name) {
  const start = main.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Production function ${name} exists`);
  const end = main.indexOf('\nfunction ', start + 1);
  assert.ok(end > start, `Production function ${name} has a following boundary`);
  return main.slice(start, end);
}
const behavior = ['onPhone','goToStation','tapStation','tapFloor','dash','mobileDash','updateMobileDash','phonePortrait',
  'syncPhoneOrientation','clearMovement','startShift','pause','resume','closeHelp']
  .map(productionFunction).join('\n');

function fixture({interfaceMode = 'mobile', phoneDevice = false, portrait = false} = {}) {
  const nodes = new Map(), events = [], routes = [], interactions = [];
  let time = 100;
  function classes() {
    const value = new Set();
    return {add:name=>value.add(name),remove:name=>value.delete(name),
      toggle:(name,on)=>on ? value.add(name) : value.delete(name),contains:name=>value.has(name)};
  }
  const $ = id => {
    if (!nodes.has(id)) {
      const children=new Map();
      nodes.set(id, {hidden:true,inert:false,style:{},textContent:'',attributes:{},
        classList:classes(),focus(){},setAttribute(name,value){this.attributes[name]=value;},
        querySelector(selector){if(!children.has(selector))children.set(selector,{textContent:'',style:{}});return children.get(selector);}});
    }
    return nodes.get(id);
  };
  const player = {x:0,z:0,angle:0};
  const game = {mode:'playing',call:null,config:{sourcing:true},
    reset(){events.push('reset');throw new Error('An allowed start needs the full game fixture');}};
  const context = vm.createContext({Math,Number,performance:{now:()=>time},$,game,player,
    interfaceMode,phoneDevice,innerWidth:portrait?390:844,innerHeight:portrait?844:390,
    mobileTaps:createTapNavigation(),keys:new Set(),touchVector:{x:0,y:0},path:[],pathStation:null,
    dashTime:0,dashCooldown:0,last:0,helpReturn:null,
    stations:{mill:{model:{visible:true},access:{x:5,z:1}},
      ship:{model:{visible:true},access:{x:6,z:2}}},
    findPath(x,z){routes.push({x,z});return Math.hypot(player.x-x,player.z-z)<.01?[]:[{x,z}];},
    targetRing:{visible:false,position:{set(){}}},dashDirection:{set(){}},
    useStation:id=>interactions.push(id),processEvents(){},toast:message=>events.push(message),
    audio:{event:name=>events.push(name),update:value=>events.push(`audio:${value}`),init:()=>events.push('audio:init')},
    hidePanels(){for(const id of ['welcome','pause-panel','help-panel','results-panel','briefing-panel'])$(id).hidden=true;},
    document:{body:{classList:classes()}},
  });
  vm.runInContext(behavior,context);
  return {context,$,game,player,events,routes,interactions,
    at:now=>{time=now;},tap:(x=100,y=100)=>({clientX:x,clientY:y})};
}

test('mobile station double taps preserve the route without navigating again or dashing', () => {
  const f=fixture();
  f.context.tapStation('mill',f.tap());
  assert.equal(f.routes.length,1);
  assert.equal(f.context.pathStation,'mill');
  f.at(200);f.context.tapStation('mill',f.tap(220,180));
  assert.equal(f.routes.length,1,'The second tap preserves the route');
  assert.equal(f.events.filter(event=>event==='dash').length,0);
  f.at(300);f.context.tapStation('mill',f.tap());
  assert.equal(f.routes.length,1,'A rapid third tap cannot repeat an interaction');
});

test('double and extra taps at a nearby station interact only once and never dash', () => {
  const f=fixture();f.player.x=5;f.player.z=1;
  f.context.tapStation('mill',f.tap());
  f.at(200);f.context.tapStation('mill',f.tap());
  f.at(300);f.context.tapStation('mill',f.tap());
  assert.deepEqual(f.interactions,['mill']);
  assert.equal(f.events.includes('dash'),false);
  assert.equal(f.routes.length,1);
});

test('mobile floor double taps preserve the first destination without dashing; other targets walk immediately', () => {
  const f=fixture();
  f.context.tapFloor({x:2,z:1},f.tap());
  f.at(200);f.context.tapFloor({x:2.1,z:1.1},f.tap(108,107));
  assert.deepEqual(f.routes,[{x:2,z:1}]);
  assert.equal(f.events.includes('dash'),false);
  f.at(250);f.context.tapStation('ship',f.tap());
  assert.equal(f.routes.length,2);
  assert.equal(f.context.pathStation,'ship');
});

test('an active customer conversation blocks station and floor navigation', () => {
  const f=fixture();
  for(const state of ['answering','offer']) {
    f.game.call={state};
    f.context.tapStation('mill',f.tap());
    f.context.tapFloor({x:2,z:1},f.tap());
  }
  assert.equal(f.routes.length,0);
  assert.equal(f.interactions.length,0);
  assert.equal(f.events.filter(event=>event==='Finish the customer call first.').length,4);
  f.game.call={state:'ringing'};
  f.context.tapStation('mill',f.tap());
  assert.equal(f.routes.length,1,'A ringing phone does not stop floor work');
});

test('desktop repeated clicks retain their existing station interactions', () => {
  const f=fixture({interfaceMode:'desktop'});f.player.x=5;f.player.z=1;
  for(const time of [100,200,300]) {f.at(time);f.context.tapStation('mill',f.tap());}
  assert.deepEqual(f.interactions,['mill','mill','mill']);
  assert.equal(f.events.includes('dash'),false);
});

test('an explicit dash follows the current route and respects cooldown, calls and pause', () => {
  const f=fixture();f.context.tapStation('mill',f.tap());
  const route=f.context.path;
  f.context.mobileDash();
  assert.equal(f.events.filter(event=>event==='dash').length,1);
  assert.equal(f.context.path,route,'Dash preserves tap navigation');
  assert.equal(f.context.pathStation,'mill');
  f.context.mobileDash();
  assert.equal(f.events.filter(event=>event==='dash').length,1,'Cooldown blocks a second dash');
  f.context.dashCooldown=0;f.game.call={state:'answering'};f.context.mobileDash();
  f.game.call={state:'offer'};f.context.mobileDash();
  f.game.call=null;f.game.mode='paused';f.context.mobileDash();
  assert.equal(f.events.filter(event=>event==='dash').length,1,'Conversations and pause block dash');
});

test('the mobile Dash button enables on a route and explains idle, call and cooldown states', () => {
  const f=fixture(),button=f.$('mobile-dash');
  f.context.updateMobileDash();
  assert.equal(button.disabled,true);
  assert.equal(button.attributes['aria-label'],'Tap a destination, then Dash');
  f.context.mobileDash();
  assert.equal(f.events.includes('dash'),false,'An idle button cannot launch a stationary dash');
  f.context.tapStation('mill',f.tap());f.context.updateMobileDash();
  assert.equal(button.disabled,false);
  f.context.mobileDash();
  assert.equal(button.disabled,true);
  assert.equal(button.attributes['aria-label'],'Dash recharging');
  assert.equal(button.querySelector('i').style.width,'0%');
  f.context.dashCooldown=0;f.game.call={state:'answering'};f.context.updateMobileDash();
  assert.equal(button.disabled,true);
  assert.equal(button.querySelector('span').textContent,'On call');
  assert.equal(button.attributes['aria-label'],'Dash unavailable during a customer call');
  f.game.call=null;f.game.mode='paused';f.context.updateMobileDash();
  assert.equal(button.disabled,true);
});

test('rotating an active phone to portrait pauses once and clears movement', () => {
  const f=fixture({phoneDevice:true,portrait:true});
  f.context.path=[{x:1,z:1}];f.context.keys.add('KeyW');
  f.context.syncPhoneOrientation();f.context.syncPhoneOrientation();
  assert.equal(f.game.mode,'paused');
  assert.equal(f.$('game').inert,true);
  assert.equal(f.$('phone-rotate-screen').hidden,false);
  assert.equal(f.events.filter(event=>event==='audio:false').length,1);
  assert.equal(f.context.path.length,0);
  assert.equal(f.context.keys.size,0);
  assert.match(f.$('phone-rotate-status').textContent,/paused/);
});

test('landscape clears the phone gate without automatically resuming the shift', () => {
  const f=fixture({phoneDevice:true,portrait:true});f.context.syncPhoneOrientation();
  f.context.innerWidth=844;f.context.innerHeight=390;f.context.syncPhoneOrientation();
  assert.equal(f.$('game').inert,false);
  assert.equal(f.$('phone-rotate-screen').hidden,true);
  assert.equal(f.game.mode,'paused');
  f.context.resume();
  assert.equal(f.game.mode,'playing');
  assert.equal(f.events.filter(event=>event==='audio:init').length,1);
});

test('phone portrait guards prevent starting or resuming a shift', () => {
  const f=fixture({phoneDevice:true,portrait:true});f.game.mode='menu';
  f.context.startShift(0);
  assert.equal(f.game.mode,'menu');
  assert.equal(f.events.includes('reset'),false);
  f.game.mode='paused';f.context.resume();
  assert.equal(f.game.mode,'paused');
  assert.equal(f.events.includes('audio:init'),false);
});

test('tablet and desktop portrait do not activate the phone rotation gate', () => {
  for(const interfaceMode of ['mobile','desktop']) {
    const f=fixture({interfaceMode,phoneDevice:false,portrait:true});
    f.context.syncPhoneOrientation();
    assert.equal(f.game.mode,'playing');
    assert.equal(f.$('game').inert,false);
    assert.equal(f.$('phone-rotate-screen').hidden,true);
    assert.equal(f.events.length,0);
  }
});

test('closing help in phone portrait keeps the shift paused behind the rotation gate', () => {
  const f=fixture({phoneDevice:true,portrait:true});
  f.game.mode='help';f.context.helpReturn={mode:'playing',panel:null,centered:false};
  f.context.syncPhoneOrientation();
  f.context.closeHelp();
  assert.equal(f.game.mode,'paused');
  assert.equal(f.$('game').inert,true);
  assert.equal(f.$('phone-rotate-screen').hidden,false);
  assert.equal(f.events.filter(event=>event==='audio:false').length,1);
});
