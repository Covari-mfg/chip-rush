import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { SHIFTS, isPlayableShift, shiftRuleset } from '../dist/core.js';
import { shiftGame } from '../dist/launch.js';
import {
  RedlineGame, REDLINE_LEVEL, REDLINE_RECIPES, REDLINE_SOURCE_JOBS,
  CHANGEOVER_SECONDS, WARM_HOLD_SECONDS, BATCH_BONUS, HOT_BONUS, flowMultiplier,
} from '../dist/redline.js';
import { ShopAudio } from '../dist/audio.js';
import { challengeURL, parseChallenge } from '../dist/social.js';
import worker, { validateResult } from '../server/worker.js';
import { simulateRedline } from './redline-balance.mjs';

const START = 1_760_000_000_000;

function advance(game, seconds, dt = 0.05) {
  let left = seconds;
  while (left > 1e-9 && game.mode === 'playing') {
    const step = Math.min(dt, left);
    game.tick(step);
    left -= step;
  }
}

test('Redline appends at legacy index 9 with paddock engine, ruleset, and credit while preserving 0-8', () => {
  const cfg = SHIFTS[REDLINE_LEVEL];
  assert.equal(SHIFTS.length, 10);
  assert.equal(cfg.id, 'redline');
  assert.equal(cfg.name, 'Redline');
  assert.equal(cfg.engine, 'redline');
  assert.equal(cfg.mapId, 'paddock-garage');
  assert.equal(cfg.ruleset, 'redline-v1-paddock');
  assert.equal(cfg.recordId, 'redline-v1-paddock');
  assert.equal(cfg.musicTrack, 'redline');
  assert.equal(cfg.author, 'Gemini 4 Neon');
  assert.equal(cfg.harness, 'Antigravity');
  assert.equal(cfg.sourcing, true);
  assert.deepEqual(cfg.stars, [6, 9, 10]);
  assert.equal(cfg.passTarget, 6);
  assert.equal(cfg.maxOrders, 10);
  assert.equal(isPlayableShift(REDLINE_LEVEL), true);
  assert.equal(shiftRuleset(REDLINE_LEVEL), 'redline-v1-paddock');
  assert.ok(shiftGame(REDLINE_LEVEL) instanceof RedlineGame);
  assert.equal(REDLINE_RECIPES.length, 10);
});

test('Alloy matching triggers 0s setup & Warm-Spindle Flow (1.38x -> 1.82x); alloy mismatch triggers 6s changeover', () => {
  const game = shiftGame(REDLINE_LEVEL);
  assert.equal(game.stations.lathe.setup, 'alu');
  assert.equal(game.stations.mill.setup, 'ti');
  assert.equal(game.orders.length, 3, 'Opens with three tickets so scheduling starts immediately');

  // Pull ALU #101 Brake calipers -> load into ALU Lathe (0s setup, jumps to 1.38x!)
  assert.equal(game.interact('material-round'), true);
  assert.equal(game.heldOrder.alloy, 'alu');
  assert.equal(game.interact('lathe'), true);
  assert.equal(game.stations.lathe.changingOver, false);
  assert.equal(game.stations.lathe.streak, 2);
  assert.equal(flowMultiplier(game.stations.lathe.streak), 1.38);
  assert.equal(game.stats.batchHits, 1);

  // Pull TI #102 Gearbox casing -> load into TI Mill (0s setup, jumps to 1.38x!)
  game.selectOrder(game.orders[1].id);
  assert.equal(game.interact('material-block'), true);
  assert.equal(game.heldOrder.id, game.orders[1].id);
  assert.equal(game.interact('mill'), true);
  assert.equal(game.stations.mill.changingOver, false);
  assert.equal(game.stations.mill.streak, 2);

  // Finish Lathe #101, empty it, then jam mismatched TI #103 Drive shafts into ALU Lathe -> 6s changeover!
  advance(game, 7.0);
  assert.equal(game.stations.lathe.ready, true);
  assert.equal(game.interact('lathe'), true);
  assert.equal(game.interact('buffer'), true);
  assert.equal(game.stations.lathe.warmRemaining > 0, true, 'Hot spindle starts 12s warm-hold countdown when emptied');

  game.selectOrder(game.orders[2].id);
  assert.equal(game.interact('material-block'), true);
  assert.equal(game.interact('lathe'), true);
  assert.equal(game.stations.lathe.changingOver, true);
  assert.equal(game.stations.lathe.setup, 'ti');
  assert.equal(game.stations.lathe.streak, 1);
  assert.equal(game.stats.changeovers, 1);
  assert.ok(Math.abs(game.stations.lathe.remaining - CHANGEOVER_SECONDS) < 0.01);

  // After 6s changeover, Lathe automatically transitions to cutting TI
  advance(game, CHANGEOVER_SECONDS + 0.1);
  assert.equal(game.stations.lathe.changingOver, false);
  assert.equal(game.stations.lathe.ready, false);
  assert.ok(game.stations.lathe.remaining > 0);
});

test('Selection-aware stock bin + 1-beat Ready-Swap chain 1.82x Redline flow without idle cooldown', () => {
  const game = shiftGame(REDLINE_LEVEL);
  // Load #101 ALU into ALU Lathe -> 1.38x
  assert.equal(game.interact('material-round'), true);
  assert.equal(game.interact('lathe'), true);
  advance(game, 9.5); // #104 Front uprights (ALU, lathe->deburr->inspect) arrives at 9s and #101 is READY!
  assert.equal(game.stations.lathe.ready, true);
  const aluNext = game.orders.find(o => !o.started && o.alloy === 'alu');
  assert.ok(aluNext, 'Second ALU lathe order arrived');

  // Select #104 ALU explicitly and pull from ALU stock while #101 sits READY on Lathe
  assert.equal(game.selectOrder(aluNext.id), true);
  assert.equal(game.interact('material-round'), true);
  assert.equal(game.heldOrder.id, aluNext.id);

  // One-beat Ready-Swap on Lathe: loads #104 into Lathe at 1.82x REDLINE and puts #101 in hands!
  assert.equal(game.interact('lathe'), true);
  assert.equal(game.heldOrder.id, 101);
  assert.equal(game.stations.lathe.part.orderId, aluNext.id);
  assert.equal(game.stations.lathe.streak, 3);
  assert.equal(flowMultiplier(game.stations.lathe.streak), 1.82);
  assert.equal(game.stats.swaps, 1);
});

test('Empty hot CNC spindle cools down back to 1.0x after 12s without matching work', () => {
  const game = shiftGame(REDLINE_LEVEL);
  game.interact('material-round');
  game.interact('lathe');
  advance(game, 7.0);
  game.interact('lathe'); // empties Lathe -> starts 12s warmRemaining
  assert.equal(game.stations.lathe.streak, 2);
  assert.ok(Math.abs(game.stations.lathe.warmRemaining - WARM_HOLD_SECONDS) < 0.01);
  advance(game, WARM_HOLD_SECONDS - 1.0);
  assert.equal(game.stations.lathe.streak, 2, 'Still hot before 12s elapse');
  advance(game, 1.2);
  assert.equal(game.stations.lathe.streak, 1, 'Cools back to 1.0x once 12s window expires');
});

test('Covari capability gap obeys shared rules: real floor gap, offer gates, Receiving -> Inspect -> Pit Bay = +300 without star credit', () => {
  const game = shiftGame(REDLINE_LEVEL);
  const floorOps = new Set(game.config.unlocks);
  assert.ok(Array.isArray(game.config.sourceJobs) && game.config.sourceJobs.length > 0, 'Catalog sourceJobs configured directly on shift');
  for (const job of game.config.sourceJobs) {
    assert.ok(!floorOps.has(job.technology));
    assert.match(job.gap, /No .* on this floor/i);
  }
  assert.deepEqual(game.config.sourceJobs, REDLINE_SOURCE_JOBS);

  // Must not trigger before 2 normal shipments
  game.elapsed = 40;
  game.time = game.config.duration - 40;
  game.shipped = 1;
  game.tickSourcing(0.05);
  assert.equal(game.sourcing, null);

  // Must trigger once shipped >= 2, elapsed >= 35, time >= 45
  game.shipped = 2;
  game.tickSourcing(0.05);
  assert.equal(game.sourcing?.state, 'offer');

  const scoreBefore = game.score;
  const comboBefore = game.combo;
  const clearBefore = game.clearElapsed;
  assert.equal(game.requestSource(), true);
  advance(game, 22.1);
  assert.equal(game.sourcing.state, 'delivered');
  assert.ok(game.receiving);

  assert.equal(game.interact('receiving'), true);
  assert.equal(game.interact('inspect'), true);
  advance(game, 4.5);
  assert.equal(game.stations.inspect.ready, true);
  assert.equal(game.sourcing.route[game.sourcing.index], 'ship', 'Covari route index advances when inspect finishes');
  assert.equal(game.interact('inspect'), true);
  assert.equal(game.interact('ship'), true);

  assert.equal(game.sourced, 1);
  assert.equal(game.sourcePoints, 300);
  assert.equal(game.score, scoreBefore + 300);
  assert.equal(game.shipped, 2, 'Covari does not add shipment or star credit');
  assert.equal(game.combo, comboBefore, 'Covari does not alter combo streak');
  assert.equal(game.clearElapsed, clearBefore, 'Covari never advances clear clock');
  assert.equal(game.covariFitted, true, 'Mounts visible Covari aero fin on Formula car');
  assert.equal(game.sourcing.started, false, 'Fulfilled Covari job clears started flag so no ghost mesh stays at Pit Bay');
  assert.equal(game.sourcing.location, 'shipped');
});

test('Anti-farming recycle, mid-changeover expiry, ready index advance, pause/reset hygiene, and validation bounds', () => {
  // 1. Recycling a part at a stock bin resets zeroSetups/changeovers and caps batch score strictly under Worker bounds
  const game = shiftGame(REDLINE_LEVEL);
  assert.equal(game.events.length, 0, 'Fresh reset does not retain stale opening arrival events');
  assert.equal(game.interact('material-round'), true);
  const o1 = game.heldOrder;
  assert.equal(game.interact('lathe'), true);
  advance(game, 7.0);
  assert.equal(game.stations.lathe.ready, true);
  assert.equal(o1.index, 1, 'order.index advances immediately when station becomes READY');
  assert.equal(o1.zeroSetups, 1);
  assert.equal(game.interact('lathe'), true);
  assert.equal(game.interact('material-round'), true, 'Recycle ALU part back into ALU stock');
  assert.equal(o1.zeroSetups, 0, 'Recycling clears zeroSetups so batch bonus cannot be farmed');
  assert.equal(o1.changeovers, 0);
  assert.equal(o1.started, false);
  assert.equal(o1.index, 0);

  // Even if zeroSetups were manually inflated, shipment caps batch bonus to the order CNC op count and keeps per-shipment < 1600
  assert.equal(game.interact('material-round'), true);
  o1.zeroSetups = 99;
  o1.index = o1.route.length - 1;
  assert.equal(game.interact('ship'), true);
  assert.equal(game.scoreDetails.batch, BATCH_BONUS, 'Single-CNC order caps batch bonus to 1x BATCH_BONUS');
  assert.ok(game.fitted[0].points < 1600, `Per-shipment score (${game.fitted[0].points}) stays within Worker 1600 cap`);

  // 2. Expiring an order mid-changeover clears changingOver & duration so the machine stays usable
  const expGame = shiftGame(REDLINE_LEVEL);
  expGame.selectOrder(expGame.orders[2].id); // TI order #103 (needs lathe -> mill -> inspect)
  assert.equal(expGame.interact('material-block'), true);
  assert.equal(expGame.interact('lathe'), true); // ALU -> TI triggers 6.0s changeover
  assert.equal(expGame.stations.lathe.changingOver, true);
  expGame.orders.find(o => o.id === 103).remaining = 0.02;
  advance(expGame, 0.05);
  assert.equal(expGame.stations.lathe.part, null);
  assert.equal(expGame.stations.lathe.changingOver, false, 'Expiry mid-changeover clears changingOver');
  assert.equal(expGame.stations.lathe.duration, 0);
  assert.equal(expGame.missed, 1);

  // 3. Expiring orders in ready, held, and buffer states leaves no stranded parts
  const stGame = shiftGame(REDLINE_LEVEL);
  stGame.interact('material-round'); // #101 in hands
  stGame.interact('lathe');
  advance(stGame, 7.0);
  assert.equal(stGame.stations.lathe.ready, true);
  stGame.orders.find(o => o.id === 101).remaining = 0.02;
  stGame.selectOrder(102);
  stGame.interact('material-block'); // #102 -> buffer
  stGame.interact('buffer');
  stGame.orders.find(o => o.id === 102).remaining = 0.02;
  stGame.selectOrder(103);
  stGame.interact('material-block'); // #103 in hands
  stGame.orders.find(o => o.id === 103).remaining = 0.02;
  advance(stGame, 0.05);
  assert.equal(stGame.stations.lathe.part, null);
  assert.equal(stGame.stations.lathe.ready, false);
  assert.equal(stGame.buffer, null);
  assert.equal(stGame.hand, null);
  assert.equal(stGame.missed, 3);

  // 4. Pause freezes clock, deadlines, machining, changeover, and warm-hold; reset clears all state cleanly
  const pGame = shiftGame(REDLINE_LEVEL);
  pGame.interact('material-round');
  pGame.interact('lathe');
  pGame.mode = 'paused';
  const snapElapsed = pGame.elapsed;
  const snapRem = pGame.stations.lathe.remaining;
  const snapDue = pGame.orders[0].remaining;
  pGame.tick(1.0);
  assert.equal(pGame.elapsed, snapElapsed);
  assert.equal(pGame.stations.lathe.remaining, snapRem);
  assert.equal(pGame.orders[0].remaining, snapDue);
  pGame.mode = 'playing';
  pGame.tick(0.1);
  assert.ok(pGame.elapsed > snapElapsed);
  pGame.reset();
  assert.equal(pGame.fitted.length, 0);
  assert.equal(pGame.covariFitted, false);
  assert.equal(pGame.events.length, 0);
  assert.equal(pGame.orders.length, 3);

  // 5. workResolved waits for active Covari offer and does not suppress 2nd-shipment Covari offer
  const wGame = shiftGame(REDLINE_LEVEL);
  wGame.spawnIndex = 10; // no more arrivals
  wGame.orders = wGame.orders.slice(0, 1);
  wGame.shipped = 1;
  wGame.elapsed = 45;
  wGame.time = wGame.config.duration - 45;
  const lastOrder = wGame.orders[0];
  lastOrder.started = true;
  lastOrder.index = lastOrder.route.length - 1;
  wGame.hand = { orderId: lastOrder.id };
  assert.equal(wGame.interact('ship'), true);
  assert.equal(wGame.mode, 'playing', 'interact(ship) defers work-complete to tick so Covari can still trigger');
  wGame.tick(0.05);
  assert.equal(wGame.sourcing?.state, 'offer', '2nd shipment opens Covari offer before work-complete ends shift');
  assert.equal(wGame.workResolved(), false, 'Active Covari offer keeps shift open');
  assert.equal(wGame.mode, 'playing');
  assert.equal(wGame.declineSource(), true);
  wGame.tick(0.05);
  assert.equal(wGame.mode, 'results');
  assert.equal(wGame.finishReason, 'work-complete');

  // 6. Unlocked station guard rejects anodize on paddock floor
  const lockGame = shiftGame(REDLINE_LEVEL);
  assert.equal(lockGame.interact('anodize'), false);

  // 7. Worker validateResult rejects forged Covari (<2 shipped), forged spawned (<3), and inflated score
  const run = { role: REDLINE_LEVEL, ruleset: shiftRuleset(REDLINE_LEVEL), started_at: START };
  const badSourced = validateResult({ role: REDLINE_LEVEL, score: 800, shipped: 1, missed: 0, sourced: 1, calls: 0, elapsed: 160, finishReason: 'time-up', spawned: 3 }, run, START + 162_000);
  assert.ok(badSourced, 'Rejects sourced=1 with shipped<2');
  const badSpawned = validateResult({ role: REDLINE_LEVEL, score: 500, shipped: 2, missed: 0, sourced: 0, calls: 0, elapsed: 160, finishReason: 'time-up', spawned: 2 }, run, START + 162_000);
  assert.ok(badSpawned, 'Rejects spawned<3 on time-up when Redline opens with 3 orders');
  const badEarlySpawned = validateResult({ role: REDLINE_LEVEL, score: 500, shipped: 2, missed: 0, sourced: 0, calls: 0, elapsed: 140, finishReason: 'work-complete', spawned: 2 }, run, START + 142_000);
  assert.ok(badEarlySpawned, 'Rejects spawned<3 on work-complete when Redline opens with 3 orders');
  const badScore = validateResult({ role: REDLINE_LEVEL, score: 99999, shipped: 10, missed: 0, sourced: 1, calls: 0, elapsed: 140, clearElapsed: 86, finishReason: 'work-complete', spawned: 10 }, run, START + 142_000);
  assert.ok(badScore, 'Rejects score above Worker bound');
});

test('Physical balance curves separate idle, serial, fifo, batch, and master play and validate with Worker & challenge links', () => {
  const idle = simulateRedline({ strategy: 'idle' });
  const serial = simulateRedline({ strategy: 'serial', reaction: 0.6, dash: false });
  const fifo = simulateRedline({ strategy: 'fifo', reaction: 0.55, dash: false });
  const batch = simulateRedline({ strategy: 'batch', reaction: 0.45, dash: false });
  const master = simulateRedline({ strategy: 'master', reaction: 0.25, dash: true, covari: 'decline' });
  const masterCov = simulateRedline({ strategy: 'master', reaction: 0.25, dash: true, covari: 'accept' });

  assert.equal(idle.shipped, 0);
  assert.equal(serial.pass, false, 'Serial one-by-one play should not clear Redline');
  assert.equal(fifo.stars, 1, `Unbatched FIFO play should land at 1 star, got ${fifo.stars}★ (${fifo.shipped}/10)`);
  assert.equal(batch.stars, 2, `Alloy-batching walk should earn 2 stars, got ${batch.stars}★ (${batch.shipped}/10)`);
  assert.ok(batch.changeovers < fifo.changeovers && batch.score > fifo.score, 'Alloy batching cuts changeovers and raises score');
  assert.equal(master.shipped, 10);
  assert.equal(master.stars, 3);
  assert.equal(master.finishReason, 'work-complete');
  assert.equal(masterCov.shipped, 10);
  assert.equal(masterCov.sourced, 1);
  assert.ok(masterCov.score > master.score);

  for (const r of [idle, serial, fifo, batch, master, masterCov]) {
    const run = { role: REDLINE_LEVEL, ruleset: shiftRuleset(REDLINE_LEVEL), started_at: START };
    const payload = {
      role: REDLINE_LEVEL,
      score: r.score,
      shipped: r.shipped,
      missed: r.missed,
      sourced: r.sourced,
      calls: 0,
      elapsed: r.elapsed,
      clearElapsed: r.clearElapsed,
      finishReason: r.finishReason,
      spawned: r.spawned,
    };
    const err = validateResult(payload, run, START + Math.ceil(r.elapsed * 1000) + 1500);
    assert.equal(err, null, `validateResult rejected ${r.strategy}: ${err}`);

    const url = challengeURL({ role: REDLINE_LEVEL, score: r.score, shipped: r.shipped }, 'https://chiprush.example/');
    const parsed = parseChallenge(new URL(url).search);
    assert.ok(parsed, `Challenge URL failed to parse for ${r.strategy}`);
    assert.equal(parsed.role, REDLINE_LEVEL);
    assert.equal(parsed.score, r.score);
    assert.equal(parsed.stars, r.stars);
  }
});

test('Worker SQLite leaderboard round-trips Redline scores and rejects forged early submissions', async t => {
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
  const migrations = await Promise.all(journal.entries.map(({ tag }) => readFile(new URL('../drizzle/' + tag + '.sql', import.meta.url), 'utf8')));
  const sqlite = new DatabaseSync(':memory:');
  for (const sql of migrations) sqlite.exec(sql);
  t.after(() => sqlite.close());
  const prepare = (sql, values = []) => ({
    bind: (...next) => prepare(sql, next),
    first: async () => sqlite.prepare(sql).get(...values) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...values), success: true }),
    run: async () => { const res = sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: res.changes } }; },
  });
  const DB = {
    prepare,
    batch: async statements => {
      sqlite.exec('BEGIN');
      try { const res = []; for (const s of statements) res.push(await s.run()); sqlite.exec('COMMIT'); return res; }
      catch (err) { sqlite.exec('ROLLBACK'); throw err; }
    },
  };
  const env = { DB, ASSETS: { fetch: async () => new Response('ok') } };
  let cookie = '';
  const send = async (path, init = {}, now = START) => {
    const headers = new Headers(init.headers);
    if (init.method === 'POST') headers.set('origin', 'https://chiprush.example');
    if (cookie) headers.set('cookie', cookie);
    const req = new Request('https://chiprush.example' + path, { ...init, headers });
    const prevNow = Date.now;
    Date.now = () => now;
    try {
      const res = await worker.fetch(req, env);
      const sc = res.headers.get('set-cookie');
      if (sc) cookie = sc.split(';')[0];
      return res;
    } finally {
      Date.now = prevNow;
    }
  };

  const startRes = await send('/api/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: REDLINE_LEVEL, ruleset: shiftRuleset(REDLINE_LEVEL) }),
  }, START);
  assert.equal(startRes.status, 201);
  const { id: runId } = await startRes.json();

  const master = simulateRedline({ strategy: 'master', reaction: 0.25, dash: true, covari: 'accept' });
  const payload = {
    runId,
    name: 'PaddockBoss',
    role: REDLINE_LEVEL,
    score: master.score,
    shipped: master.shipped,
    missed: master.missed,
    sourced: master.sourced,
    calls: 0,
    elapsed: master.elapsed,
    clearElapsed: master.clearElapsed,
    finishReason: master.finishReason,
    spawned: master.spawned,
  };

  const early = await send('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }, START + 10_000);
  assert.equal(early.status, 400);

  const ok = await send('/api/scores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }, START + Math.ceil(master.elapsed * 1000) + 2000);
  assert.equal(ok.status, 200);

  const board = await (await send('/api/leaderboard')).json();
  assert.equal(board.entries.length, 1);
  assert.equal(board.entries[0].name, 'PaddockBoss');
  assert.equal(board.entries[0].shiftId, 'redline');
  assert.equal(board.entries[0].score, master.score);
  assert.equal(board.entries[0].stars, 3);
});

test('Redline 120 BPM E-Dorian paddock groove synthesizes bounded, seamless stereo PCM', () => {
  const rate = 44100;
  const fakeCtx = {
    sampleRate: rate,
    currentTime: 0,
    state: 'running',
    destination: {},
    createGain: () => ({ gain: { value: 1, setValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }, connect() {}, disconnect() {} }),
    createBuffer: (ch, len, sr) => {
      const chans = Array.from({ length: ch }, () => new Float32Array(len));
      return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: i => chans[i] };
    },
    createBufferSource: () => ({ connect() {}, disconnect() {}, start() {}, stop() {} }),
  };
  const audio = new ShopAudio();
  audio.ctx = fakeCtx;
  audio.master = fakeCtx.createGain();
  audio.musicGain = fakeCtx.createGain();
  audio.setTrack('redline');
  audio.update(true, false);

  const buf = audio.redlineBuffer;
  assert.ok(buf, 'redlineBuffer created on demand');
  assert.equal(buf.numberOfChannels, 2);
  assert.ok(Math.abs(buf.duration - 16.0) < 0.002, 'Exact 8-bar 120 BPM (16.0s) duration');

  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0, rms = 0;
  for (let i = 0; i < buf.length; i++) {
    assert.ok(Number.isFinite(L[i]) && Number.isFinite(R[i]));
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    rms += L[i] * L[i] + R[i] * R[i];
  }
  rms = Math.sqrt(rms / (buf.length * 2));
  assert.ok(peak > 0.1 && peak <= 0.72, `Healthy peak headroom (${peak.toFixed(3)})`);
  assert.ok(rms > 0.04 && rms < 0.16, `Balanced RMS level (${rms.toFixed(4)})`);
  assert.ok(Math.abs(L[buf.length - 1] - L[0]) < 0.12 && Math.abs(R[buf.length - 1] - R[0]) < 0.12, 'Click-free loop seam');
});
