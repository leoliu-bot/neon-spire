import test from 'node:test';
import assert from 'node:assert/strict';
import * as CANNON from 'cannon-es';
import { Economy, EventBus, BALANCE, ROOM_DEFS, bindPhysicalPusher } from '../src/economy.js';

const storageFor = state => {
  const data = new Map(state ? [[BALANCE.storageKey, JSON.stringify({ version: 1, savedAt: Date.now(), state })]] : []);
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const make = state => new Economy(new EventBus(), { storage: state ? storageFor(state) : null });

test('launch atomically reserves ticket and combat energy; repeat settlement cannot duplicate drops', () => {
  const e = make(); const before = e.state;
  const launch = e.dispatch('LAUNCH');
  assert.equal(launch.battleEnergy, 38); assert.equal(e.state.energy, before.energy - 39);
  assert.equal(e.dispatch('LAUNCH').ok, false);
  const result = e.dispatch('BATTLE_END', { runId: launch.runId, cores: 17, blueprints: 1, hp: 0 });
  assert.equal(result.cores, 10); assert.equal(e.state.cores, 10); assert.equal(e.state.alloy, 0);
  assert.equal(e.dispatch('BATTLE_END', { cores: 100, hp: 100 }).ok, false);
  assert.equal(e.state.cores, 10); assert.equal(e.state.runs, 1);
  assert.equal(e.dispatch('LAUNCH').ok, false);
  e.tick(BALANCE.repairSeconds); assert.equal(e.state.hp, 100); assert.equal(e.state.repairRemaining, 0);
});

test('low battery budgets a shorter round, never spends below zero', t => {
  t.mock.method(Date, 'now', () => 1750000000000);
  const e = make({ energy: 7.5 });
  const launch = e.dispatch('LAUNCH'); assert.equal(launch.battleEnergy, 6.5); assert.equal(e.state.energy, 0);
  e.dispatch('BATTLE_END', { cores: 0, hp: 100 });
  assert.equal(e.dispatch('LAUNCH').ok, false); assert.equal(e.state.energy, 0);
});

test('read-only snapshots and unsupported bus/actions cannot convert cores', () => {
  const bus = new EventBus(); const e = new Economy(bus, { storage: null });
  assert.throws(() => { e.state.alloy = 1000; }, TypeError);
  bus.emit('pusher:reward', { amount: 1000 }); bus.emit('economy:change', { alloy: 1000 });
  for (const action of ['CONVERT', 'CONVERT_CORE', 'PUSHER_REWARD', 'ADD_ALLOY']) assert.equal(e.dispatch(action, { amount: 1000 }).ok, false);
  assert.equal(e.state.alloy, 0); assert.equal(e.state.cores, 0);
});

test('base production generates energy only and never refills the battle hopper', () => {
  const e = make(); assert.equal(e.dispatch('SET_ALLOCATION', { value: 0 }).ok, false);
  assert.equal(e.state.allocation, 1); assert.equal(e.state.coreProduction, 0);
  for (let i = 0; i < 4000; i++) e.tick(60);
  assert.equal(e.state.energy, e.state.maxEnergy); assert.equal(e.state.cores, 0);
  const snapshot = e.state; e.tick(Infinity); e.tick(NaN); e.tick(-30); assert.deepEqual(e.state, snapshot);
});

test('corrupt storage, future timestamps, invalid levels and negative resources are sanitized', () => {
  const e = make({ energy: -9, cores: -4, alloy: 1e30, warehouseLevel: 100, weaponLevel: -1, allocation: 30, hp: -90, blueprints: 1e9 });
  assert.ok(e.state.energy >= 0); assert.equal(e.state.cores, 0); assert.equal(e.state.alloy, BALANCE.maxAlloy);
  assert.equal(e.state.warehouseLevel, BALANCE.maxLevel); assert.equal(e.state.weaponLevel, 1);
  assert.equal(e.state.allocation, 1); assert.equal(e.state.hp, 0); assert.ok(e.state.repairRemaining > 17);
  const corrupt = new Economy(new EventBus(), { storage: { getItem: () => '{broken', setItem() { throw Error('quota'); } } });
  assert.equal(corrupt.state.cores, 0); assert.equal(corrupt.save(), false);
});

test('offline production credits at most the configured offline window', () => {
  const s = storageFor({ energy: 0, cores: 0, allocation: 0 });
  const raw = JSON.parse(s.getItem(BALANCE.storageKey)); raw.savedAt = Date.now() - 365 * 86400000; s.setItem(BALANCE.storageKey, JSON.stringify(raw));
  const e = new Economy(new EventBus(), { storage: s });
  assert.equal(e.state.cores, 0); assert.equal(e.state.energy, e.state.maxEnergy);
});

test('upgrades spend currency and blueprint requirements atomically', () => {
  const e = make({ energy: 0, alloy: 100, warehouseLevel: 1, weaponLevel: 1, blueprints: 0 });
  assert.equal(e.dispatch('UPGRADE_WAREHOUSE').ok, true); assert.equal(e.state.alloy, 100 - BALANCE.warehouseCost(1));
  assert.equal(e.dispatch('UPGRADE_WEAPON').ok, true); assert.equal(e.state.weaponLevel, 2);
  const before = e.state.alloy; assert.equal(e.dispatch('UPGRADE_WEAPON').ok, false); assert.equal(e.state.alloy, before);
});

test('physical escrow refuses unsupported/fake tokens and side exits, and consumes valid tokens once', () => {
  const e = make({ cores: 3, alloy: BALANCE.maxAlloy - 1 });
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) }); const gate = bindPhysicalPusher(e, world);
  const token = gate.reserve('player'); const body = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(0.1), position: new CANNON.Vec3(0, 1.1, 0) });
  world.addBody(body); assert.equal(gate.bind(token, body), true);
  assert.equal(gate.settle([token], 3), 0); assert.equal(gate.settle([{}], 3), 0);
  world.step(1 / 60); gate.observe(token);
  body.position.set(4.5, 0, 3.8); world.step(1 / 60); assert.equal(gate.observe(token), false); assert.equal(gate.settle([token]), 0);
  body.position.set(0, 0.3, 3.8); world.step(1 / 60); assert.equal(gate.observe(token), true);
  assert.equal(gate.settle([token, token], 3), 1); assert.equal(e.state.alloy, BALANCE.maxAlloy);
  assert.equal(gate.settle([token], 3), 0); assert.equal(e.state.platformCores, 0); gate.close();
});

test('the event bus unsubscribe remains safe while listeners change during emission', () => {
  const bus = new EventBus(); let called = 0;
  const stop = bus.on('event', () => { called++; stop(); }); bus.emit('event'); bus.emit('event'); assert.equal(called, 1);
});

test('room construction spends its exact cost once; failed or unknown construction spends nothing', () => {
  const e = make({ alloy: 12 });
  assert.equal(e.state.rooms.command, 1); assert.equal(e.state.rooms.energy, 1);
  assert.equal(e.state.rooms.armory, 0); assert.equal(e.state.coinProduction, 0);
  assert.equal(e.dispatch('UNLOCK_ROOM', { id: 'armor' }).ok, false);
  assert.equal(e.dispatch('UNLOCK_ROOM', { id: 'unknown' }).ok, false);
  assert.equal(e.dispatch('UPGRADE_ROOM', { id: 'armory' }).ok, false);
  assert.equal(e.state.alloy, 12);
  assert.deepEqual(e.dispatch('UNLOCK_ROOM', { id: 'armory' }), { ok: true, id: 'armory', level: 1, cost: 12 });
  assert.equal(e.state.alloy, 0); assert.equal(e.state.attackMultiplier, 1.18);
  assert.equal(e.dispatch('UNLOCK_ROOM', { id: 'armory' }).ok, false);
  assert.equal(e.state.rooms.armory, 1); assert.equal(e.state.alloy, 0);
});

test('room upgrades have bounded levels, increasing cost and actual combat/production effects', () => {
  for (const def of ROOM_DEFS) {
    const e = make({ alloy: BALANCE.maxAlloy }); const initial = e.state;
    assert.equal(def.maxLevel,20);
    if (!def.initialLevel) assert.equal(e.dispatch('UNLOCK_ROOM', { id: def.id }).ok, true);
    let lastCost = 0;
    while (e.state.rooms[def.id] < def.maxLevel) {
      const stats = e.state.roomStats.find(room => room.id === def.id), before = e.state.alloy;
      assert.ok(stats.upgradeCost >= lastCost); lastCost = stats.upgradeCost;
      assert.equal(e.dispatch('UPGRADE_ROOM', { id: def.id }).ok, true);
      assert.equal(e.state.alloy, before - stats.upgradeCost);
    }
    const before = e.state.alloy;
    assert.equal(e.dispatch('UPGRADE_ROOM', { id: def.id }).ok, false);
    assert.equal(e.state.alloy, before); assert.equal(e.state.rooms[def.id], 20);
    assert.equal(e.state.roomStats.find(r=>r.id===def.id).canPurchase,def.id==='reactor'&&e.state.recruitAvailable);
    if(def.id==='armory'||def.id==='command'||def.id==='reactor')assert.ok(e.state.attackMultiplier>initial.attackMultiplier);
    if(def.id==='armor'){assert.equal(e.state.defenseMultiplier,5);assert.equal(e.state.coverBonus,.24);}
    if(def.id==='energy')assert.ok(e.state.production>initial.production);
    if(def.id==='mint')assert.equal(e.state.coinProduction,1.6);
    assert.equal(e.state.coreProduction,0);
    assert.throws(() => { e.state.rooms.armory = 100; }, TypeError);
    assert.throws(() => { e.state.roomStats[0].level = 99; }, TypeError);
  }
});

test('old saves migrate to two starter rooms; purchased rooms and partial mint production survive reload', () => {
  const oldStorage = storageFor({ alloy: 50, warehouseLevel: 2, weaponLevel: 3 });
  const old = new Economy(new EventBus(), { storage: oldStorage });
  assert.deepEqual(old.state.rooms, { command: 1, energy: 1, armory: 0, armor: 0, mint: 0, reactor: 0 });
  assert.equal(old.state.alloy, 50); assert.equal(old.state.weaponLevel, 3);
  assert.equal(old.dispatch('UNLOCK_ROOM', { id: 'mint' }).ok, true);
  old.tick(6.25); old.save();
  const restored = new Economy(new EventBus(), { storage: oldStorage });
  assert.equal(restored.state.rooms.mint, 1); assert.equal(restored.state.alloy, 26);
  restored.tick(6.26); assert.equal(restored.state.alloy, 27);
  const invalid = make({ rooms: { command: -8, energy: 50, armory: Infinity, armor: 100, mint: -2, reactor: '4' } });
  assert.deepEqual(invalid.state.rooms, { command: 1, energy: 20, armory: 0, armor: 20, mint: 0, reactor: 0 });
});

test('room purchase notifications track exact cost, spending, cap and restored high levels',()=>{
  const storage=storageFor({alloy:11,rooms:{command:19,energy:20,armory:0,armor:4,mint:1}});
  const e=new Economy(new EventBus(),{storage});
  assert.equal(e.state.rooms.command,19);assert.equal(e.state.rooms.armor,4);
  assert.equal(e.state.roomStats.find(r=>r.id==='armory').canPurchase,false);
  e.tick(12.51);
  assert.equal(e.state.roomStats.find(r=>r.id==='armory').canPurchase,true);
  assert.equal(e.state.roomStats.find(r=>r.id==='energy').canPurchase,false);
  e.dispatch('UNLOCK_ROOM',{id:'armory'});
  assert.equal(e.state.roomStats.find(r=>r.id==='armory').canPurchase,false);
  e.save();const restored=new Economy(new EventBus(),{storage});
  assert.equal(restored.state.rooms.command,19);assert.equal(restored.state.rooms.energy,20);
});

test('only a purchased mint earns coins and offline mint income is capped without overflow', () => {
  const locked = make(); locked.tick(60); assert.equal(locked.state.alloy, 0);
  const storage = storageFor({ alloy: 20, rooms: { mint: 1 } });
  const raw = JSON.parse(storage.getItem(BALANCE.storageKey)); raw.savedAt = Date.now() - 86400000;
  storage.setItem(BALANCE.storageKey, JSON.stringify(raw));
  const e = new Economy(new EventBus(), { storage });
  assert.equal(e.state.alloy, 20 + 72);
  const capped = make({ alloy: BALANCE.maxAlloy - 1, rooms: { mint: 4 } }); capped.tick(60);
  assert.equal(capped.state.alloy, BALANCE.maxAlloy);
});

test('each actual battle grants exactly ten cores and an unfinished hopper blocks a new run without losing inventory', () => {
  const e = make();
  assert.equal(e.state.hopperRemaining, 0); assert.equal(e.state.hopperCapacity, 10); assert.equal(e.state.hopperVersion, 3);
  assert.equal(e.dispatch('INSERT_CORE').ok, false);
  for (const declaredCores of [0, 999999, -100]) {
    e.tick(60);
    const run = e.dispatch('LAUNCH'); assert.equal(run.ok, true);
    assert.equal(e.dispatch('BATTLE_END', { runId: run.runId + 1, cores: declaredCores }).ok, false);
    assert.equal(e.state.hopperRemaining, 0);
    assert.equal(e.dispatch('BATTLE_END', { runId: run.runId, cores: declaredCores, hp: 100 }).cores, 10);
    assert.equal(e.state.hopperRemaining, 10); assert.equal(e.state.hopperReady, true);
    const before = e.state.energy;
    assert.equal(e.dispatch('LAUNCH').ok, false); assert.equal(e.state.energy, before); assert.equal(e.state.hopperRemaining, 10);
    assert.equal(e.dispatch('BATTLE_END', { runId: run.runId, cores: 10 }).ok, false);
    for (let i = 9; i >= 0; i--) { assert.equal(e.dispatch('INSERT_CORE').ok, true); assert.equal(e.state.cores, i); assert.equal(e.state.hopperRemaining, i); }
    assert.equal(e.dispatch('INSERT_CORE').ok, false); assert.equal(e.state.hopperReady, false);
  }
  assert.equal(e.state.runs, 3);
});

test('legacy large stock migrates once to one ten-core batch and partial hopper survives reload without offline refill', () => {
  const storage = storageFor({ cores: 240, alloy: 37, weaponLevel: 3, rooms: { armor: 2 }, runs: 9 });
  const e = new Economy(new EventBus(), { storage });
  assert.equal(e.state.cores, 10); assert.equal(e.state.hopperBatch, 9); assert.equal(e.state.alloy, 37); assert.equal(e.state.rooms.armor, 2);
  for (let i = 0; i < 4; i++) e.dispatch('INSERT_CORE');
  const raw = JSON.parse(storage.getItem(BALANCE.storageKey)); assert.equal(raw.state.hopperVersion, 3);
  raw.savedAt -= 86400000; storage.setItem(BALANCE.storageKey, JSON.stringify(raw));
  const reloaded = new Economy(new EventBus(), { storage });
  assert.equal(reloaded.state.hopperRemaining, 6); assert.equal(reloaded.state.weaponLevel, 3);
  const world = new CANNON.World(); const gate = bindPhysicalPusher(reloaded, world);
  assert.equal(gate.reserve('passive'), null); assert.equal(reloaded.state.hopperRemaining, 6); gate.close();
});

test('motor starts only after a successful paid insertion and legacy progress migrates without overriding an explicit idle motor', () => {
  const e = make(); assert.equal(e.state.pusherStarted, false);
  assert.equal(e.dispatch('INSERT_CORE').ok, false); assert.equal(e.state.pusherStarted, false);
  const run = e.dispatch('LAUNCH'); e.dispatch('BATTLE_END', { runId: run.runId, hp: 100 });
  assert.equal(e.state.pusherStarted, false, 'battle rewards fill the hopper without starting the table');
  assert.equal(e.dispatch('INSERT_CORE').ok, true); assert.equal(e.state.pusherStarted, true);
  assert.equal(make({ seedGranted: true, platformCores: 63, runs: 0 }).state.pusherStarted, false);
  for (const legacy of [{ runs: 1 }, { totalConverted: 1 }, { platformCores: 64 }]) assert.equal(make(legacy).state.pusherStarted, true);
  assert.equal(make({ pusherStarted: false, runs: 1 }).state.pusherStarted, false);
});
