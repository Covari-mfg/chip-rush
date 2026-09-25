import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { ShopGame, OPS, RECIPES, SOURCE_JOBS } from '../dist/core.js';

const main=await readFile(new URL('../dist/main.js',import.meta.url),'utf8');
function section(from,to) {
  const start=main.indexOf(from),end=main.indexOf(to,start);
  assert.ok(start>=0&&end>start,'Production UI section exists');
  return main.slice(start,end);
}

// Execute the production rendering functions. The DOM and badge renderer are
// small fakes so these tests verify which technology reaches each real card,
// without duplicating or asserting the SVG drawing implementation.
function setup() {
  const nodes=new Map(),badgeCalls=[];
  function element() {
    let id='',html='';
    const children=new Map();
    return {
      dataset:{},style:{},classList:{toggle(){},add(){}},children:[],
      scrollTop:0,scrollLeft:0,hidden:false,innerHTMLWrites:0,
      get id(){return id;},set id(value){id=value;nodes.set(value,this);},
      get innerHTML(){return html;},set innerHTML(value){html=value;this.innerHTMLWrites++;},
      setAttribute(){},focus(){},scrollIntoView(){},
      appendChild(child){this.children.push(child);},
      replaceChildren(){this.children=[];},
      querySelector(selector){if(!children.has(selector))children.set(selector,element());return children.get(selector);},
    };
  }
  const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
  const game=new ShopGame();game.reset(0);
  const context=vm.createContext({
    game,OPS,$,sourceCard:$('source-card'),
    document:{activeElement:null,createElement:element},
    renderedTickets:'',renderedSelection:null,pendingSource:false,selectedByPlayer:false,
    sourceReveal:false,reduced:false,
    revealSelectedTicket(){},ticketState(){return 'Ordinary order status';},processEvents(){},updateUI(){},
    technologyBadges(keys){
      const selected=Array.from(keys),markup=`<technology-test>${selected.join(',')}</technology-test>`;
      badgeCalls.push({keys:selected,markup});return markup;
    },
  });
  vm.runInContext(section('function updateTickets(','\nfunction nextTarget(')
    +'\n'+section('function updateSourceUI(','\nfunction updateOfficeUI('),context);
  return {game,$,context,badgeCalls};
}

function ticket(recipe,id) {
  return {...recipe,id,route:[...recipe.route,'ship'],index:0,location:'material',
    programmed:true,programRemaining:0,remaining:50,deadline:80};
}

test('every recipe card receives only its required cutting technologies in route order',()=>{
  const f=setup();
  f.game.orders=RECIPES.map((recipe,index)=>ticket(recipe,101+index));
  f.game.selectedId=f.game.orders[0].id;
  f.context.updateTickets(true);
  const expected=[['lathe'],['mill'],['lathe'],['lathe','mill'],['mill'],['lathe'],['lathe','mill']];
  assert.deepEqual(f.badgeCalls.map(call=>call.keys),expected);
  for(let index=0;index<RECIPES.length;index++) {
    const card=f.$('ticket-'+(101+index));
    assert.ok(card.innerHTML.includes(f.badgeCalls[index].markup),'Badge output is placed on its matching card');
  }
});

test('repeated cuts show one badge per machine and keep inspection or finishing out of machine badges',()=>{
  const f=setup();
  f.game.orders=[ticket({...RECIPES[0],route:['mill','lathe','mill','deburr','lathe','inspect']},101),
    ticket({...RECIPES[0],route:['inspect']},102)];
  f.context.updateTickets(true);
  assert.deepEqual(f.badgeCalls.map(call=>call.keys),[['mill','lathe'],[]]);
  const count=f.badgeCalls.length;
  f.game.orders[0].remaining-=1;f.context.updateTickets(false);
  assert.equal(f.badgeCalls.length,count,'Countdown-only updates do not regenerate stable technology badges');
});

test('each actual Covari offer maps its capability to the corresponding technology badge',()=>{
  const expected=[['Injection molding','im'],['Wire EDM','edm'],['Sheet metal fabrication','sm']];
  assert.deepEqual(SOURCE_JOBS.map(job=>[job.capability,job.technology]),expected);
  for(let role=0;role<3;role++) {
    const f=setup();f.game.reset(role);f.game.nextCallAt=Infinity;
    for(let tick=0;tick<701;tick++)f.game.tick(.05);
    assert.equal(f.game.sourcing.state,'offer');f.context.updateSourceUI();
    assert.deepEqual(f.badgeCalls.map(call=>call.keys),[[expected[role][1]]]);
    assert.equal(f.$('source-title').textContent,SOURCE_JOBS[role].name);
    assert.ok(f.$('source-detail').textContent.includes(expected[role][0]));
    assert.equal(f.$('source-technology').innerHTML,f.badgeCalls[0].markup);
  }
});

test('source badge rendering is cached across countdowns and workflow states, then replaced for the next technology',()=>{
  const f=setup(),badge=f.$('source-technology');
  f.context.updateSourceUI();assert.equal(f.badgeCalls.length,0);
  f.game.sourcing={...SOURCE_JOBS[0],state:'offer',offerRemaining:30,approvalRemaining:2,remaining:22,points:60};
  f.context.updateSourceUI();assert.equal(f.badgeCalls.length,1);
  const firstMarkup=badge.innerHTML;
  for(const state of ['offer','approving','sourcing','delivered']) {
    f.game.sourcing.state=state;
    f.game.sourcing.offerRemaining-=1;f.game.sourcing.remaining-=1;
    f.context.updateSourceUI();
    assert.equal(badge.innerHTML,firstMarkup);assert.equal(badge.innerHTMLWrites,1);
  }
  Object.assign(f.game.sourcing,SOURCE_JOBS[1],{state:'offer'});f.context.updateSourceUI();
  assert.deepEqual(f.badgeCalls.map(call=>call.keys),[['im'],['edm']]);
  assert.equal(badge.innerHTMLWrites,2);assert.equal(badge.dataset.technology,'edm');
  assert.equal(badge.innerHTML,f.badgeCalls[1].markup);
  f.game.sourcing.state='declined';f.context.updateSourceUI();
  assert.equal(f.$('source-card').hidden,true);assert.equal(badge.innerHTMLWrites,2);
  Object.assign(f.game.sourcing,SOURCE_JOBS[2],{state:'offer'});f.context.updateSourceUI();
  assert.deepEqual(f.badgeCalls.at(-1).keys,['sm']);assert.equal(badge.innerHTMLWrites,3);
});
