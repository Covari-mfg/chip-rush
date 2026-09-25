// A visible, automated demonstration. This controller reads the live
// game and sends the same station, ticket, phone and dash inputs as a player.
// It never advances the clock or changes a score, order, position or rule.
export function parseWatchMode(search) {
  const value=new URLSearchParams(search).get('watch');
  return {enabled:['operator','manager','owner','sequence'].includes(value),sequence:value==='sequence',role:Math.max(0,['operator','manager','owner'].indexOf(value))};
}

export function nextWatchRole(mode,role) {
  return mode.sequence&&role<2?role+1:mode.role;
}

export function createShopDemo(api, {sourcing=false}={}) {
  const { game } = api;
  const reaction = .06;
  let pending, delay, actions, dashes, caption, sourceSeenAt, sourceSelected, callOfferId, callOfferAt;

  function reset() {
    pending = null;
    delay = reaction;
    actions = 0;
    dashes = 0;
    sourceSeenAt=null;
    sourceSelected=false;
    callOfferId=null;
    callOfferAt=0;
    caption = game.config.programming?'Start the first program, then keep the machines running in parallel.':'Collect a billet and keep the machines running in parallel.';
  }

  function go(station, order, program = false) {
    if (order) api.selectOrder(order.id);
    pending = { station, program, orderId:order?.id };
    const held = game.heldOrder;
    caption = station === 'office'
      ? game.call?.state === 'ringing'
        ? 'The customer is calling. The shop clock keeps running.'
        : `Program order #${order?.id ?? game.selectedId} while the machines work.`
      : station === 'material'
        ? `Collect stock for order #${order?.id ?? game.selectedId}.`
        : station === 'ship'
          ? `Ship order #${held?.id}. Every completed order counts.`
          : held
            ? `Load order #${held.id}, then use the cycle time elsewhere.`
            : 'Collect the output so the machine can take its next order.';
    actions++;
    api.goToStation(station);
  }

  function tick(dt) {
    if (game.mode !== 'playing') return;
    if(sourcing&&game.sourcing?.state==='offer'&&sourceSeenAt===null)sourceSeenAt=game.elapsed;
    const navigation = api.navigation();
    const onPhone = ['answering','offer'].includes(game.call?.state);

    // Dashes obey the production cooldown and end at the next route corner.
    if (navigation.path.length) {
      const next = navigation.path[0];
      if (!onPhone && navigation.dashCooldown <= 0 &&
          Math.hypot(next.x-navigation.x,next.z-navigation.z) >= 2.2) {
        api.dash();
        dashes++;
      }
      return;
    }

    if (pending) {
      const order = game.order(pending.orderId);
      if (pending.program && order && !order.programmed &&
          !['ringing','answering','offer'].includes(game.call?.state)) return;
      pending = null;
      delay = reaction;
    }
    if (delay > 0) { delay -= dt; return; }

    const call = game.call;
    if (call && ['ringing','answering','offer'].includes(call.state)) {
      if (call.state === 'ringing') { go('office'); return; }
      if (call.state === 'answering') {
        caption = 'Stay on the phone. Machines and deadlines continue during the call.';
        return;
      }
      if(sourcing){
        if(callOfferId!==call.orderId){callOfferId=call.orderId;callOfferAt=game.elapsed;}
        if(game.elapsed-callOfferAt<2.5){caption='Review the customer’s rush request before choosing a promise.';return;}
      }
      const rush = game.order(call.orderId);
      const accept = call.rushAvailable !== false;
      api.respondCall(accept);
      caption = accept ? 'Accept the expedite and replan around the rush order.' : 'Keep the original promise. There is no room for a safe expedite.';
      if (accept && rush && !rush.programmed && !(sourcing&&['offer','approving'].includes(game.sourcing?.state))) go('office', rush, true);
      else delay = reaction;
      return;
    }

    // Review mode visibly selects the ordinary Covari card, then takes the
    // same office route and attended approval as a human player. All deadlines
    // and machines keep running while the card and customer reply are read.
    if(sourcing&&game.sourcing?.state==='offer'&&game.elapsed-sourceSeenAt>=3){
      if(!sourceSelected){
        if(api.selectSource()){
          sourceSelected=true;delay=.8;
          caption='Select Outsource with Covari. Next, walk to the office computer.';
        }
        return;
      }
      go('office');caption='Place the selected Covari job at the office computer.';return;
    }
    if(sourcing&&game.sourcing?.state==='approving'){
      if(!game.office.present)go('office');
      caption='Stay at the computer for the two-second Covari approval. The shop keeps running.';
      return;
    }

    const held = game.heldOrder;
    if (held) {
      if (!held.programmed) { go('office',held,true); return; }
      const next = held.route[held.index];
      if (next === 'ship' || !game.stations[next]?.part) go(next);
      return;
    }

    const rush = game.call?.state === 'active' ? game.order(game.call.orderId) : null;
    if (rush && !rush.started && !game.stations[rush.route[0]]?.part) {
      go(rush.programmed ? 'material' : 'office',rush,!rush.programmed);
      return;
    }

    const priority = order => game.call?.state === 'active' && game.call.orderId === order.id
      ? -1000 : order.remaining;
    const distances = new Map();
    const distanceTo = station => {
      if (!distances.has(station)) distances.set(station,api.distanceTo(station));
      return distances.get(station);
    };
    const ready = Object.entries(game.stations)
      .filter(([station,state]) => state.ready ||
        (state.part && state.remaining <= distanceTo(station)/11))
      .map(([station,state]) => ({station,state,order:game.order(state.part.orderId)}))
      .filter(({state,order}) => {
        // A still-running machine will advance the route when it completes.
        // Read its countdown and walk there only if it will finish even before
        // the earliest possible arrival at the legal maximum dash speed.
        const next = order.route[order.index+(state.ready ? 0 : 1)];
        return next === 'ship' || !game.stations[next]?.part;
      });
    const cost = candidate => (candidate.order.route.length-candidate.order.index)*4 +
      priority(candidate.order)*.08 + distanceTo(candidate.station)*.3;
    ready.sort((a,b) => cost(a)-cost(b));
    if (ready.length) { go(ready[0].station); return; }

    const fresh = game.orders
      .filter(order => !order.started && !game.stations[order.route[0]]?.part)
      .sort((a,b) => priority(a)-priority(b));
    if (fresh.length) {
      const order = fresh[0];
      go(order.programmed ? 'material' : 'office',order,!order.programmed);
      return;
    }

    const next = game.orders.filter(order => !order.started && !order.programmed)
      .sort((a,b) => a.remaining-b.remaining)[0];
    if (next) go('office',next,true);
    else caption = game.shipped >= game.config.stars[2]
      ? `Three-star ${game.config.name} achieved. Keep the shop flowing until closing.`
      : 'Let the active cycle finish, then keep the next handoff moving.';
  }

  reset();
  return { tick, reset, status:() => ({caption,actions,dashes}) };
}

// Keep the original mastery route and timing unchanged for existing links.
export function createOwnerDemo(api) {return createShopDemo(api);}
