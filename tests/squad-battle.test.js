import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBattle } from '../src/battle.js';
import { EventBus } from '../src/economy.js';
import { OPERATOR_DEFS } from '../src/operators.js';

function create() {
  const group = new THREE.Group(), hero = new THREE.Group(), bus = new EventBus(); group.add(hero);
  const events = { shots: [], reloads: [], explosions: [], results: [], muzzles: [], selections: [], formations: [] };
  bus.on('battle:shot', e => events.shots.push(e)); bus.on('battle:reload', e => events.reloads.push(e));
  bus.on('battle:explosion', e => events.explosions.push(e)); bus.on('battle:end', e => events.results.push(e));
  hero.userData.resolveMuzzle = (x, y, exposed, id) => { events.muzzles.push({ x, y, exposed, id }); return new THREE.Vector3(id === 'ember' ? -2.7 : id === 'volt' ? 2.7 : -.4, -.5, 4); };
  hero.userData.setActiveOperator = id => events.selections.push(id);
  hero.userData.setSquad = (ids, id) => events.formations.push({ ids, id });
  return { group, hero, events, battle: createBattle({ THREE, group, hero, bus, economy: { state: { hp: 100 } } }) };
}
function advance(battle, seconds) { let left = seconds; while (left > 1e-8) { const dt = Math.min(1 / 60, left); battle.update(dt, battle.getState().elapsed + dt); left -= dt; } }
const member = (battle, id) => battle.getState().squad.find(unit => unit.id === id);
const allIds = ['spark', 'ember', 'volt'];

test('squad slots use unique real operators, cap at three and default to the original rifle', () => {
  const { battle, events } = create(); battle.start();
  assert.deepEqual(battle.getState().squad.map(unit => unit.id), ['spark']); assert.equal(battle.getState().maxAmmo, 24);
  battle.start({ squad: ['unknown', 'ember', 'ember', 'spark', 'volt', 'unknown'], activeOperatorId: 'volt' });
  assert.deepEqual(battle.getState().squad.map(unit => unit.id), ['ember', 'spark', 'volt']); assert.equal(battle.getState().activeOperatorId, 'volt');
  assert.deepEqual(events.formations.at(-1), { ids: ['ember', 'spark', 'volt'], id: 'volt' });
  assert.equal(battle.selectOperator(0), true); assert.equal(battle.getState().activeOperatorId, 'ember'); assert.equal(battle.getState().maxAmmo, 4);
  assert.equal(battle.selectOperator('spark'), true); assert.equal(battle.selectOperator(3), false); assert.equal(battle.selectOperator('unknown'), false);
  assert.equal(battle.getState().activeOperatorId, 'spark'); battle.start({ squad: [] }); assert.deepEqual(battle.getState().squad.map(unit => unit.id), ['spark']); battle.dispose();
});

test('each weapon uses its real magazine and cadence: gatling is fastest and rocket is slowest', () => {
  const counts = {};
  for (const def of OPERATOR_DEFS) {
    const { battle } = create(); battle.start({ squad: [def.id] }); battle.aim(5.4, .6, true); advance(battle, 2);
    const s = battle.getState(), unit = s.squad[0]; counts[def.id] = s.shots;
    assert.equal(s.maxAmmo, def.maxAmmo); assert.equal(s.ammo, def.maxAmmo - s.shots); assert.equal(unit.interval, def.interval); assert.equal(unit.kind, def.kind);
    assert.equal(s.reloading, false); battle.dispose();
  }
  assert.equal(counts.ember, 2); assert.equal(counts.spark, 14); assert.equal(counts.volt, 41);
  assert.ok(counts.volt > counts.spark * 2); assert.ok(counts.spark > counts.ember * 4);
});

test('a rocket travels visibly to empty aim space then damages multiple nearby enemies inside its explosion radius', () => {
  const { battle, group, events } = create(); battle.start({ squad: ['ember'] }); advance(battle, 1.9);
  const before = battle.getState(), a = before.targets[0], b = before.targets[2];
  const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 4.7);
  assert.ok(Math.abs(a.y - y) > .48 && Math.abs(b.y - y) > .48, 'the reticle is outside both ordinary body hitboxes');
  battle.aim(x, y, true); battle.setTrigger(false);
  const launched = battle.getState(); assert.equal(launched.rocketCount, 1); assert.equal(launched.ammo, 3); assert.equal(launched.hits, 0);
  assert.deepEqual(launched.targets.map(t => t.hp), before.targets.map(t => t.hp), 'rocket damage is delayed until actual impact');
  assert.equal(group.getObjectByName('rocket-projectile').visible, true);
  advance(battle, .38); const impact = battle.getState();
  assert.equal(impact.rocketCount, 0); assert.equal(impact.explosionCount, 1); assert.equal(impact.hits, 1);
  assert.ok(events.explosions[0].targets >= 2); assert.equal(events.explosions[0].radius, 2.35);
  assert.ok(member(battle, 'ember').targetsHit >= 2); assert.ok(member(battle, 'ember').damageDone > 50);
  assert.equal(group.getObjectByName('rocket-blast-radius').visible, true); assert.equal(impact.shots, 1); battle.dispose();
});

test('support operators shoot the shared reticle for reduced actual damage and resolve their own muzzle', () => {
  const { battle, events, group } = create(); battle.start({ squad: allIds, activeOperatorId: 'volt' });
  const target = battle.getState().targets[0]; battle.aim(target.x, target.y - .2, true); battle.setTrigger(false);
  assert.equal(battle.getState().shots, 3); assert.equal(battle.getState().activeShots, 1);
  assert.equal(member(battle, 'volt').damageDone, 3);
  assert.ok(Math.abs(member(battle, 'spark').damageDone - 9 * .45) < 1e-8);
  assert.equal(member(battle, 'ember').damageDone, 0, 'the supporting rocket remains in flight');
  assert.ok(Math.abs(battle.getState().targets[0].hp - (target.hp - 3 - 9 * .45)) < 1e-8);
  assert.deepEqual(events.muzzles.map(e => e.id), ['volt', 'spark', 'ember']);
  assert.ok(events.muzzles.every(e => e.x === target.x && e.y === target.y - .2 && e.exposed));
  assert.equal(events.shots.find(e => e.operatorId === 'spark').support, true);
  assert.equal(events.shots.find(e => e.operatorId === 'volt').support, false);
  assert.equal(group.getObjectByName('muzzle-ember').position.x, -2.7); assert.equal(group.getObjectByName('muzzle-volt').position.x, 2.7);
  const shots = battle.getState().shots; advance(battle, .2); assert.equal(battle.getState().shots, shots, 'release stops every squad weapon');
  assert.ok(battle.getState().squad.every(unit => !unit.exposed)); battle.dispose();
});

test('switching and rapid taps cannot refill a magazine or bypass independent weapon cooldowns', () => {
  const { battle, events } = create(); battle.start({ squad: allIds }); battle.aim(5.4, .6, true); advance(battle, .2);
  const before = battle.getState().squad.map(unit => ({ id: unit.id, ammo: unit.ammo, shots: unit.shots, cooldown: unit.cooldown }));
  for (let i = 0; i < 24; i++) { battle.setTrigger(false); assert.equal(battle.selectOperator(i % 3), true); battle.setTrigger(true); }
  assert.deepEqual(battle.getState().squad.map(unit => ({ id: unit.id, ammo: unit.ammo, shots: unit.shots, cooldown: unit.cooldown })), before);
  assert.equal(battle.selectOperator('ember'), true); assert.equal(battle.reload(), true); assert.equal(battle.reload(), false);
  const emberShots = member(battle, 'ember').shots, sparkShots = member(battle, 'spark').shots;
  battle.selectOperator('spark'); advance(battle, .35);
  assert.equal(member(battle, 'ember').shots, emberShots); assert.equal(member(battle, 'ember').ammo, 3); assert.equal(member(battle, 'ember').reloading, true);
  assert.ok(member(battle, 'spark').shots > sparkShots); assert.equal(battle.getState().reloading, false);
  assert.ok(events.reloads.some(e => e.operatorId === 'ember' && e.duration === 2.1)); battle.dispose();
});

test('release covers the entire squad and reloads each magazine on its own duration while switching preserves progress', () => {
  const { battle } = create(); battle.start({ squad: allIds }); battle.aim(5.4, .6, true); advance(battle, .2); battle.setTrigger(false);
  const shots = battle.getState().shots; assert.equal(battle.getState().teamExposed, false);
  advance(battle, .30); assert.ok(battle.getState().squad.every(unit => unit.reloading && !unit.exposed));
  advance(battle, 1.18); assert.equal(member(battle, 'spark').ammo, 24); assert.equal(member(battle, 'spark').reloading, false);
  assert.equal(member(battle, 'ember').reloading, true); assert.equal(member(battle, 'volt').reloading, true);
  const progress = member(battle, 'ember').reloadProgress; battle.selectOperator('ember'); assert.equal(battle.getState().reloadProgress, progress);
  advance(battle, .95); assert.equal(member(battle, 'ember').ammo, 4); assert.equal(member(battle, 'ember').reloading, false);
  assert.equal(member(battle, 'volt').reloading, true); battle.selectOperator('volt'); assert.ok(battle.getState().reloadProgress > .8);
  advance(battle, .5); assert.equal(battle.getState().ammo, 120); assert.equal(battle.getState().reloading, false);
  assert.equal(battle.getState().shots, shots); assert.ok(battle.getState().squad.every(unit => !unit.exposed)); battle.dispose();
});

test('three-person settlement retains carried HP and the fixed wall-clock ten-core contract exactly once', () => {
  const { battle, events } = create(); battle.start({ squad: allIds, hp: 72, duration: 38 }); battle.aim(5.4, .6, true);
  assert.equal(battle.getState().hp, 72); assert.equal(battle.getState().shots, 3); battle.update(60);
  assert.equal(events.results.length, 1); assert.equal(events.results[0].duration, 38); assert.equal(events.results[0].cores, 10); assert.equal(events.results[0].hp, 72);
  assert.equal(events.results[0].squad.length, 3); assert.ok(battle.getState().squad.every(unit => !unit.exposed)); assert.equal(battle.getState().rocketCount, 0);
  battle.setTrigger(true); battle.reload(); battle.update(60); assert.equal(events.results.length, 1); assert.equal(battle.getState().shots, 3); battle.dispose();
});
