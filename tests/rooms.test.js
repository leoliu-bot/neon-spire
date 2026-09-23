import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRooms } from '../src/rooms.js';
import { Economy, EventBus, BALANCE, ROOM_DEFS } from '../src/economy.js';

function economyWith(state) {
  const data = new Map([[BALANCE.storageKey, JSON.stringify({ version: BALANCE.version, savedAt: Date.now(), state })]]);
  return new Economy(new EventBus(), { storage: { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) } });
}
function scene() {
  const parent = new THREE.Group();
  return { parent, rooms: createRooms(THREE, parent) };
}
function assetCount(root) {
  const geometries = new Set(), materials = new Set(); let meshes = 0;
  root.traverse(object => { if (!object.isMesh) return; meshes++; geometries.add(object.geometry); materials.add(object.material); });
  return { geometries: geometries.size, materials: materials.size, meshes };
}

test('scene nameplates and corner notifications follow real room affordability, including a purchase', () => {
  const { rooms } = scene();
  try {
    const economy = economyWith({ alloy: 12 });
    rooms.update(.016, 1, economy.state);
    assert.equal(rooms.getRoomState('command').displayLevel, 'LV.01 /20');
    assert.equal(rooms.getRoomState('armory').displayLevel, 'LV.00 /20');
    for (const state of rooms.getRoomStates()) {
      const live = economy.state.roomStats.find(room => room.id === state.id);
      assert.equal(state.canPurchase, live.canPurchase);
      assert.equal(state.notificationVisible, live.canPurchase);
      assert.equal(rooms.root.getObjectByName(`Upgrade notification / ${state.id}`).visible, live.canPurchase);
      assert.ok(rooms.root.getObjectByName(`Room nameplate / ${state.id}`).userData.label.includes(state.displayLevel));
    }
    assert.equal(rooms.getRoomState('command').notificationVisible, false);
    assert.equal(rooms.getRoomState('energy').notificationVisible, true);
    assert.equal(rooms.getRoomState('armory').notificationVisible, true);
    assert.equal(rooms.getRoomState('armor').notificationVisible, false);
    assert.equal(economy.dispatch('UNLOCK_ROOM', { id: 'armory' }).ok, true);
    rooms.update(.016, 2, economy.state);
    assert.equal(rooms.getRoomState('armory').displayLevel, 'LV.01 /20');
    assert.equal(rooms.getRoomState('armory').notificationVisible, false);
    assert.ok(rooms.getRoomStates().every(room => !room.notificationVisible));
  } finally { rooms.dispose(); }
});

test('nineteen successive upgrades update the scene to level 20 without allocating more geometry or materials', () => {
  const { rooms } = scene();
  try {
    const economy = economyWith({ alloy: 9999 });
    rooms.update(0, 0, economy.state);
    const baseline = assetCount(rooms.root);
    const label = rooms.root.getObjectByName('Room nameplate / command');
    const geometry = label.geometry, material = label.material;
    for (let level = 2; level <= 20; level++) {
      assert.equal(economy.dispatch('UPGRADE_ROOM', { id: 'command' }).ok, true);
      rooms.update(.016, level, economy.state);
      assert.equal(rooms.getRoomState('command').level, level);
      assert.equal(rooms.getRoomState('command').displayLevel, `LV.${String(level).padStart(2, '0')} /20`);
      assert.deepEqual(assetCount(rooms.root), baseline);
      assert.equal(label.geometry, geometry); assert.equal(label.material, material);
    }
    assert.equal(rooms.getRoomState('command').notificationVisible, false);
    assert.equal(economy.dispatch('UPGRADE_ROOM', { id: 'command' }).ok, false);
  } finally { rooms.dispose(); }
});

test('old room saves remain visible and room resources are disposed once', () => {
  const { parent, rooms } = scene();
  const economy = economyWith({ rooms: { command: 4, energy: 2, armor: 3 }, alloy: 19 });
  rooms.update(0, 0, economy.state);
  assert.equal(rooms.getRoomState('command').displayLevel, 'LV.04 /20');
  assert.equal(rooms.getRoomState('energy').displayLevel, 'LV.02 /20');
  assert.equal(rooms.getRoomState('armory').displayLevel, 'LV.00 /20');
  assert.equal(rooms.getRoomStates().length, ROOM_DEFS.length);
  assert.throws(() => { rooms.getRoomState('command').level = 100; }, TypeError);
  const assets = new Set();
  rooms.root.traverse(object => { if (object.geometry) assets.add(object.geometry); if (object.material) assets.add(object.material); });
  const counts = new Map();
  for (const asset of assets) asset.addEventListener('dispose', () => counts.set(asset, (counts.get(asset) || 0) + 1));
  rooms.dispose(); rooms.dispose();
  assert.equal(parent.children.length, 0);
  assert.equal(counts.size, assets.size);
  assert.ok([...counts.values()].every(count => count === 1));
});

test('the base reservoir mirrors credited money without paying twice and preserves hidden collection feedback', () => {
  const { rooms } = scene();
  try {
    const initial = Object.freeze({ alloy: 12, totalConverted: 100 });
    rooms.update(0, 0, initial);
    assert.equal(rooms.getHopperState().balance, 12);
    assert.equal(rooms.getHopperState().collectionActive, false, 'loading a save is not new income');
    assert.equal(rooms.getHopperState().collectedTotal, 0);
    const earned = Object.freeze({ alloy: 17, totalConverted: 105 });
    for (let n = 0; n < 40; n++) rooms.update(.1, n / 10, earned, false);
    let hopper = rooms.getHopperState();
    assert.equal(hopper.balance, 17); assert.equal(hopper.collectedTotal, 5);
    assert.equal(hopper.collectionQueued, true); assert.equal(hopper.collectionActive, false);
    assert.equal(hopper.collectionProgress, 0);
    rooms.update(.05, 5, earned, true);
    assert.equal(rooms.getHopperState().collectionActive, true);
    assert.equal(rooms.getHopperState().incomingCoins, 5);
    for (let n = 0; n < 15; n++) rooms.update(.1, 6 + n / 10, earned, true);
    assert.equal(rooms.getHopperState().collectionActive, false);
    rooms.update(.016, 8, { alloy: 2, totalConverted: 105 });
    assert.equal(rooms.getHopperState().balance, 2);
    assert.ok(rooms.getHopperState().displayCoins <= 2);
    assert.equal(rooms.getHopperState().spendingActive, true);
    rooms.update(.016, 9, { alloy: 9999, totalConverted: 105 });
    assert.equal(rooms.getHopperState().balance, 9999);
    assert.equal(rooms.getHopperState().displayCoins, 48);
    assert.equal(rooms.getHopperState().collectedTotal, 5, 'unrelated balance changes do not replay pusher receipts');
    assert.deepEqual(initial, { alloy: 12, totalConverted: 100 });
    assert.deepEqual(earned, { alloy: 17, totalConverted: 105 });
  } finally { rooms.dispose(); }
});

test('a level 20 recruitment room keeps its corner notification until all affordable recruits are owned', () => {
  const { rooms } = scene();
  try {
    const economy = economyWith({ alloy: 200, rooms: { reactor: 20 } });
    rooms.update(0, 0, economy.state);
    assert.equal(rooms.getRoomState('reactor').displayLevel, 'LV.20 /20');
    assert.equal(rooms.getRoomState('reactor').notificationVisible, true);
    for (const operator of economy.state.operatorStats.filter(operator => !operator.owned)) {
      assert.equal(economy.dispatch('RECRUIT_OPERATOR', { id: operator.id }).ok, true);
    }
    rooms.update(.016, 1, economy.state);
    assert.equal(rooms.getRoomState('reactor').notificationVisible, false);
    assert.equal(rooms.getHopperState().balance, economy.state.alloy);
  } finally { rooms.dispose(); }
});
