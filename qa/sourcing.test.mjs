import test from 'node:test';
import assert from 'node:assert/strict';
import { ShopGame } from '../dist/core.js';

function advance(game, seconds) {
  for (let left=seconds;left>1e-8;left-=.05) game.tick(Math.min(.05,left));
}

function offer(shift=1) {
  const game=new ShopGame();game.reset(shift);
  // Isolate sourcing timing from unrelated arrivals and scripted calls. Tests
  // below also exercise the normal arrival schedule and a real phone state flow.
  game.nextArrival=Infinity;game.nextCallAt=Infinity;
  advance(game,35.05);assert.equal(game.sourcing.state,'offer');game.drain();
  return game;
}

function ring(game) {
  game.nextCallAt=game.elapsed;game.maybeCall();game.nextCallAt=Infinity;
  assert.equal(game.call.state,'ringing');
}

function ordinaryState(game) {
  const {sourcing,sourced,sourcePoints,score,...state}=game.snapshot();
  return {...state,ordinaryScore:score-sourcePoints,nextId:game.nextId,
    spawnIndex:game.spawnIndex,nextArrival:game.nextArrival};
}

test('each role gets one optional sourcing offer without using an ordinary order slot',()=>{
  for(const shift of [0,1,2]) {
    const game=new ShopGame();game.reset(shift);game.nextCallAt=Infinity;
    advance(game,34.95);assert.equal(game.sourcing,null);
    advance(game,.1);assert.equal(game.sourcing.state,'offer');
    assert.equal(game.order(game.sourcing.id),undefined);
    assert.ok(game.orders.length<=4);
    advance(game,100);
    assert.equal(game.sourcing.state,'declined');
    assert.equal(game.drain().filter(event=>event.type==='sourceOffer').length,1);
    assert.equal(game.sourced,0);assert.equal(game.sourcePoints,0);
  }
});

test('approval requires two attended office seconds and resumes after leaving',()=>{
  const game=offer();
  assert.equal(game.requestSource(),false,'Cannot place the job remotely');
  assert.equal(game.interact('source'),false);
  game.setOfficePresence(true);assert.equal(game.interact('source'),true);
  assert.equal(game.requestSource(),false,'A second click cannot restart approval');
  advance(game,.75);assert.ok(Math.abs(game.sourcing.approvalRemaining-1.25)<1e-8);
  game.setOfficePresence(false);advance(game,3);
  assert.ok(Math.abs(game.sourcing.approvalRemaining-1.25)<1e-8);
  assert.equal(game.interact('office'),false,'Remote office interaction must not report success');
  game.setOfficePresence(true);assert.equal(game.interact('office'),true);
  advance(game,1.2);assert.equal(game.sourcing.state,'approving');
  advance(game,.1);assert.equal(game.sourcing.state,'sourcing');
  assert.equal(game.drain().filter(event=>event.type==='sourcePlaced').length,1);
});

test('pause freezes offer, approval, and partner delivery and rejects sourcing actions',()=>{
  for(const stage of ['offer','approving','sourcing']) {
    const game=offer();game.setOfficePresence(true);
    if(stage!=='offer')game.requestSource();
    if(stage==='sourcing')advance(game,2.05);
    assert.equal(game.sourcing.state,stage);game.mode='paused';
    const before=game.snapshot();
    assert.equal(game.requestSource(),false);assert.equal(game.declineSource(),false);
    advance(game,40);assert.deepEqual(game.snapshot(),before);
  }
});

test('new sourcing approval waits until the whole customer conversation is resolved',()=>{
  const game=offer(2);game.setOfficePresence(true);ring(game);
  assert.equal(game.requestSource(),false);
  assert.equal(game.interact('phone'),true);assert.equal(game.requestSource(),false);
  advance(game,3.05);assert.equal(game.call.state,'offer');
  assert.equal(game.requestSource(),false);assert.equal(game.sourcing.state,'offer');
  assert.equal(game.respondCall(false),true);assert.equal(game.requestSource(),true);
});

test('an interrupted approval preserves CAM progress while machines and deadlines keep running',()=>{
  const game=offer(2),first=game.selected;
  game.setOfficePresence(true);game.interact('office');advance(game,4.05);
  game.interact('material');game.interact('lathe');game.spawn();
  const second=game.orders[1];game.select(second.id);game.interact('office');advance(game,.5);
  const camRemaining=second.programRemaining;
  assert.equal(game.requestSource(),true);assert.equal(game.office.orderId,null);
  advance(game,.5);const approvalRemaining=game.sourcing.approvalRemaining;
  ring(game);const time=game.time,deadline=second.remaining;
  advance(game,1);assert.equal(game.sourcing.approvalRemaining,approvalRemaining);
  game.interact('phone');advance(game,3.05);assert.equal(game.call.state,'offer');
  advance(game,3);assert.equal(game.sourcing.approvalRemaining,approvalRemaining);
  assert.equal(second.programRemaining,camRemaining);
  assert.equal(game.stations.lathe.ready,true);assert.equal(game.stations.lathe.part.orderId,first.id);
  assert.ok(game.time<time);assert.ok(second.remaining<deadline);
  game.respondCall(false);advance(game,approvalRemaining+.05);
  assert.equal(game.sourcing.state,'sourcing');assert.equal(second.programRemaining,camRemaining);
  assert.equal(game.interact('office'),true);advance(game,.5);
  assert.ok(second.programRemaining<camRemaining,'CAM resumes on an explicit office interaction');
});

test('partner delivery awards sixty points once without shipment, star, or streak credit',()=>{
  const game=offer(2);game.shipped=5;game.combo=4;game.bestCombo=4;game.score=900;
  game.setOfficePresence(true);game.requestSource();advance(game,2.05);
  game.setOfficePresence(false);advance(game,21);
  assert.equal(game.sourcing.state,'sourcing');assert.equal(game.score,900);
  advance(game,1.1);assert.equal(game.sourcing.state,'delivered');
  assert.equal(game.score,960);assert.equal(game.sourcePoints,60);assert.equal(game.sourced,1);
  assert.equal(game.shipped,5);assert.equal(game.stars(),0);assert.equal(game.passed(),false);
  assert.equal(game.combo,4);assert.equal(game.bestCombo,4);
  assert.equal(game.requestSource(),false);assert.equal(game.declineSource(),false);
  advance(game,5);assert.equal(game.score,960);assert.equal(game.sourced,1);
  assert.equal(game.drain().filter(event=>event.type==='sourceDelivered').length,1);
});

test('delivery and declining leave regular arrivals, four-order capacity, and deadlines identical',()=>{
  const placed=new ShopGame(),declined=new ShopGame();placed.reset(1);declined.reset(1);
  advance(placed,35.05);advance(declined,35.05);
  placed.setOfficePresence(true);declined.setOfficePresence(true);
  assert.equal(placed.requestSource(),true);assert.equal(declined.declineSource(),true);
  advance(placed,24.1);advance(declined,24.1);
  assert.equal(placed.sourced,1);assert.equal(declined.sourced,0);
  assert.deepEqual(ordinaryState(placed),ordinaryState(declined));
  assert.equal(placed.orders.length,4);
});

test('declining and ignoring the offer have identical ordinary effects and no penalty',()=>{
  const declined=new ShopGame(),ignored=new ShopGame();declined.reset(2);ignored.reset(2);
  advance(declined,35.05);advance(ignored,35.05);
  assert.equal(declined.declineSource(),true);assert.equal(declined.declineSource(),false);
  advance(declined,31);advance(ignored,31);
  assert.deepEqual(ordinaryState(declined),ordinaryState(ignored));
  for(const game of [declined,ignored]) {
    assert.equal(game.sourcing.state,'declined');assert.equal(game.score,0);
    assert.equal(game.combo,0);assert.equal(game.missed,0);assert.equal(game.sourcePoints,0);
  }
});

test('closing prevents a late supplier payout and reset clears every sourcing stage',()=>{
  for(const stage of ['offer','approving','sourcing','delivered']) {
    const game=offer();game.setOfficePresence(true);
    if(stage!=='offer')game.requestSource();
    if(['sourcing','delivered'].includes(stage))advance(game,2.05);
    if(stage==='delivered')advance(game,22.05);
    assert.equal(game.sourcing.state,stage);game.time=.1;advance(game,.2);
    assert.equal(game.mode,'results');const atClose=game.snapshot();
    assert.equal(game.requestSource(),false);assert.equal(game.declineSource(),false);
    advance(game,100);assert.deepEqual(game.snapshot(),atClose);
    assert.equal(game.sourcePoints,stage==='delivered'?60:0);
    game.reset(1);assert.equal(game.sourcing,null);assert.equal(game.sourceOffered,false);
    assert.equal(game.sourced,0);assert.equal(game.sourcePoints,0);assert.equal(game.score,0);
    advance(game,24);assert.equal(game.sourcing,null,'Old supplier work cannot leak into the next shift');
  }
});

for(const role of [0,1,2])test(`role ${role+1}: Covari delivery earns only the optional points bonus`,()=>{
  const game=offer(role),shipped=game.shipped,stars=game.stars();
  game.setOfficePresence(true);assert.equal(game.requestSource(),true);
  advance(game,24.2);assert.equal(game.sourcing.state,'delivered');
  assert.equal(game.sourced,1);assert.equal(game.score,60);assert.equal(game.sourcePoints,60);
  assert.equal(game.shipped,shipped);assert.equal(game.stars(),stars);
});
