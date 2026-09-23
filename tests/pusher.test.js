import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Economy, EventBus, BALANCE, bindPhysicalPusher } from '../src/economy.js';
import { createPusher, AMPLIFIERS, amplifierX, crystalGateHit } from '../src/pusher.js';

const memory = state => {
  const data = new Map(state ? [[BALANCE.storageKey, JSON.stringify({ version: 1, savedAt: Date.now(), state })]] : []);
  return { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
};
const create = storage => {
  const bus = new EventBus(), economy = new Economy(bus, { storage: storage ?? null }), group = new THREE.Group();
  const pusher = createPusher({ THREE, group, economy, bus }); return { bus, economy, group, pusher };
};
const advance = (pusher, seconds) => { for (let i = 0; i < Math.round(seconds * 60); i++) pusher.update(1 / 60); };
const completeRun = economy => {
  const run = economy.dispatch('LAUNCH'); assert.equal(run.ok, true, run.reason);
  assert.equal(economy.dispatch('BATTLE_END', { runId: run.runId, cores: 999, hp: 100 }).cores, 10);
};
const assertConserved = (economy, pusher, expected) => {
  const s = pusher.getStats();
  assert.equal(s.count + s.pendingCoins, economy.state.platformCores);
  assert.equal(s.count + s.pendingCoins + economy.state.totalConverted, expected);
  assert.equal(s.overflow, 0); assert.equal(s.finite, true); assert.ok(s.count <= s.capacity);
};

test('both moving gates remain readable while a new idle machine produces no free coins', () => {
  const { economy, pusher, group } = create(); const initial = pusher.getStats();
  assert.equal(initial.stages.length, 1); assert.deepEqual(initial.stageCounts, [63]);
  assert.equal(initial.capacity, 240); assert.equal(initial.seeded, 63); assert.equal(pusher.insert(), false);
  advance(pusher, 3);
  assert.equal(pusher.getStats().steps, 0); assert.equal(economy.state.alloy, 0);
  assert.notDeepEqual(pusher.getStats().amplifiers.map(a => a.x), initial.amplifiers.map(a => a.x));
  assert.deepEqual(pusher.getStats().amplifiers.map(a => a.multiplier), [5, 10]);
  assert.ok(Object.isFrozen(pusher.getStats().amplifiers[0]));
  pusher.setLane(99); assert.equal(pusher.getStats().lane, 2.8); assert.equal(economy.state.cores, 0);
  pusher.dispose(); assert.equal(group.children.length, 0);
});

for (const scenario of [{ multiplier: 5, wait: 0, lane: 1.2 }, { multiplier: 10, wait: 3, lane: -2.4 }, { multiplier: 1, wait: 0, lane: -2.8 }]) {
  test('crystal resolves to exactly ' + scenario.multiplier + ' coins once; each real final fall credits one gold', () => {
    const { economy, pusher, bus } = create(); const hits = [], rewards = [];
    bus.on('pusher:amplification', e => hits.push(e)); bus.on('pusher:reward', e => rewards.push(e));
    advance(pusher, scenario.wait); completeRun(economy);
    assert.equal(pusher.insert(scenario.lane), true); assert.equal(economy.state.cores, 9);
    assert.equal(pusher.getStats().coresInFlight, 1); assert.equal(pusher.getStats().mintedCoins, 0);
    assert.equal(economy.state.alloy, 0, 'a launched crystal does not award gold');
    advance(pusher, 2.5);
    assert.equal(hits.length, 1); assert.equal(hits[0].multiplier, scenario.multiplier); assert.equal(hits[0].count, scenario.multiplier);
    assert.equal(pusher.getStats().mintedCoins, scenario.multiplier); assert.equal(pusher.getStats().coresInFlight, 0);
    assert.equal(pusher.getStats().pendingCoins, 0); assert.equal(pusher.getStats().spawnedCoins, scenario.multiplier);
    assert.ok(rewards.length > 0); assert.ok(rewards.every(e => e.multiplier === 1 && e.amount === e.count));
    assert.equal(economy.state.alloy, pusher.getStats().converted);
    assertConserved(economy, pusher, BALANCE.seedCoins + scenario.multiplier);
    advance(pusher, 1); assert.equal(hits.length, 1); assert.equal(pusher.getStats().mintedCoins, scenario.multiplier, 'the second gate cannot amplify minted gold again');
    pusher.dispose();
  });
}

test('swept collision catches a gate crossing a crystal between frames and rejects clear misses', () => {
  const gate = AMPLIFIERS[0];
  const fromTime = (Math.PI - .65) / gate.speed, toTime = (Math.PI + .65) / gate.speed;
  const hit = crystalGateHit({ x: 0, y: gate.y }, { x: 0, y: gate.y }, fromTime, toTime);
  assert.equal(hit?.multiplier, 5); assert.ok(hit.fraction > 0 && hit.fraction < 1);
  assert.ok(Math.abs(amplifierX(gate, fromTime)) > gate.width / 2 + .14);
  assert.ok(Math.abs(amplifierX(gate, toTime)) > gate.width / 2 + .14);
  assert.equal(crystalGateHit({ x: -9, y: 4.5 }, { x: -9, y: -1 }, 0, 1), null);
});

test('amplifier capability consumes crystal identity once and cannot settle before a real fall; snapshots are deeply read-only', () => {
  const e = new Economy(new EventBus(), { storage: null }); completeRun(e);
  const world = new CANNON.World(), gate = bindPhysicalPusher(e, world), crystal = gate.launchCrystal(1.2);
  const liveSnapshot = e.state.amplifier;
  assert.throws(() => { liveSnapshot.flights[0].y = -100; }, TypeError);
  assert.throws(() => { liveSnapshot.flights.push({ id: 999 }); }, TypeError);
  assert.throws(() => { liveSnapshot.minted = 1000; }, TypeError);
  assert.equal(e.state.amplifier.flights[0].y, 4.65);
  assert.equal(gate.resolveCrystal({ id: crystal.id }, 10, 1.2, 3), 0);
  assert.equal(gate.resolveCrystal(crystal.token, 50, 1.2, 3), 0);
  assert.equal(gate.resolveCrystal(crystal.token, 5, 1.2, 3), 5);
  assert.equal(gate.resolveCrystal(crystal.token, 10, 1.2, 1), 0);
  assert.equal(liveSnapshot.flights.length, 1, 'earlier snapshots do not change when the ledger changes');
  assert.equal(e.state.amplifier.flights.length, 0);
  const mintedSnapshot = e.state.amplifier;
  assert.throws(() => { mintedSnapshot.pending[0].remaining = 999; }, TypeError);
  assert.throws(() => { mintedSnapshot.pending.length = 0; }, TypeError);
  assert.equal(e.state.cores, 9); assert.equal(gate.getAmplifier().pending, 5); assert.equal(e.state.alloy, 0);
  const coin = gate.reserve('pending'); assert.equal(gate.settle([coin], 3), 0); assert.equal(e.state.alloy, 0); gate.close();
});

test('ten x10 hits emit 100 real coins through a saved queue; in-flight and pending value survive refresh', { timeout: 120000 }, () => {
  const storage = memory(); const first = create(storage); advance(first.pusher, 3); completeRun(first.economy);
  for (let i = 0; i < 10; i++) assert.equal(first.pusher.insert(-2.4), true);
  assert.equal(first.pusher.insert(), false); assert.equal(first.economy.state.cores, 0);
  advance(first.pusher, .35); assert.equal(first.pusher.getStats().coresInFlight, 10); first.economy.save(); first.pusher.dispose();
  const second = create(storage); assert.equal(second.pusher.getStats().coresInFlight, 10); assert.equal(second.economy.state.cores, 0);
  advance(second.pusher, 1.25);
  assert.equal(second.pusher.getStats().mintedCoins, 100); assert.equal(second.pusher.getStats().amplifiers[1].hits, 10);
  assert.ok(second.pusher.getStats().pendingCoins > 0); assert.equal(second.pusher.getStats().coresInFlight, 0);
  assertConserved(second.economy, second.pusher, 163);
  const pending = second.pusher.getStats().pendingCoins; second.economy.save(); second.pusher.dispose();
  const third = create(storage); assert.equal(third.pusher.getStats().pendingCoins, pending); assert.equal(third.pusher.getStats().mintedCoins, 100);
  advance(third.pusher, 24);
  assert.equal(third.pusher.getStats().pendingCoins, 0); assert.ok(third.pusher.getStats().paidTraversals > 0, 'minted coins contact the real table and reach its payout chute');
  assert.equal(third.pusher.getStats().mintedCoins, 100); assert.equal(third.pusher.insert(), false);
  assert.equal(third.economy.state.alloy, third.economy.state.totalConverted); assertConserved(third.economy, third.pusher, 163);
  third.pusher.dispose();
});

test('a full 240-coin bed queues new gold instead of destroying paid inventory', { timeout: 120000 }, () => {
  const storage = memory({ cores: 0, hopperVersion: 3, pusherStarted: true, seedGranted: true, platformCores: 340, amplifier: { minted: 100, pending: [{ remaining: 100, x: 0, y: 2 }] } });
  const { economy, pusher } = create(storage);
  assert.equal(pusher.getStats().count, 240); assert.equal(pusher.getStats().pendingCoins, 100);
  pusher.update(1 / 60); assert.equal(pusher.getStats().pendingCoins, 100); assertConserved(economy, pusher, 340);
  advance(pusher, 6); assertConserved(economy, pusher, 340); assert.ok(pusher.getStats().peakCount <= 240);
  economy.save(); const before = economy.state.platformCores; pusher.dispose();
  const restored = create(storage); assert.equal(restored.economy.state.platformCores, before); assertConserved(restored.economy, restored.pusher, 340); restored.pusher.dispose();
});

test('hopper pouring blocks spending without starting the table and the first paid launch persists', () => {
  const storage = memory(), first = create(storage); assert.equal(first.pusher.revealHopper(), 0); completeRun(first.economy);
  assert.equal(first.pusher.revealHopper(), 1.65); assert.equal(first.pusher.insert(), false);
  advance(first.pusher, 1.8); assert.equal(first.pusher.getStats().hopperLoading, 0); assert.equal(first.pusher.getStats().steps, 0);
  assert.equal(first.pusher.insert(0), true); first.pusher.update(1 / 60); assert.equal(first.pusher.getStats().steps, 1);
  first.economy.save(); first.pusher.dispose(); const second = create(storage);
  assert.equal(second.pusher.getStats().started, true); assert.equal(second.economy.state.cores, 9);
  assert.equal(second.pusher.getStats().coresInFlight, 1); second.pusher.dispose();
});

