import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBattle } from '../src/battle.js';
import { createBattleScene, createOperatorMotion, deformOperatorPoint, OPERATOR_AIM_POSES } from '../src/battle-scene.js';
import { EventBus } from '../src/economy.js';
import { createAudio } from '../src/audio.js';

function create(stats = {}) {
  const group = new THREE.Group(), hero = new THREE.Group(), bus = new EventBus();
  const results = [], hits = [], reloads = [];
  group.add(hero);
  bus.on('battle:end', result => results.push(result));
  bus.on('battle:hit', hit => hits.push(hit));
  bus.on('battle:reload', () => reloads.push(true));
  return { group, hero, results, hits, reloads, battle: createBattle({ THREE, group, hero, bus, economy: { state: { hp: 100, ...stats } } }) };
}

function advance(battle, seconds) {
  let remaining = seconds;
  while (remaining > 1e-8) {
    const dt = Math.min(1 / 60, remaining);
    battle.update(dt, battle.getState().elapsed + dt);
    remaining -= dt;
  }
}

const aimStubs=()=>Object.fromEntries(OPERATOR_AIM_POSES.map(p=>[p.angle,new THREE.Texture({width:1024,height:1536})]));
// Sample the actual triangulated mesh at the painted barrel pixel, not the aim solver's output.
function artworkPoint(artwork,hero,point){
 const g=artwork.geometry,uv=g.attributes.uv,pos=g.attributes.position,idx=g.index;
 const x=point.x+.5,y=point.y+.5;
 for(let i=0;i<idx.count;i+=3){
  const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2),ax=uv.getX(a),ay=uv.getY(a),bx=uv.getX(b),by=uv.getY(b),cx=uv.getX(c),cy=uv.getY(c);
  const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy),wa=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det,wb=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det,wc=1-wa-wb;
  if(Math.min(wa,wb,wc)<-1e-5)continue;
  return new THREE.Vector3(pos.getX(a)*wa+pos.getX(b)*wb+pos.getX(c)*wc,pos.getY(a)*wa+pos.getY(b)*wb+pos.getY(c)*wc,0).applyMatrix4(artwork.matrix).applyMatrix4(hero.matrix);
 }
 assert.fail('Painted barrel anchor was clipped outside the sprite mesh');
}

test('aiming only damages the clicked target; an empty-screen shot consumes ammunition and misses', () => {
  const { battle } = create();
  battle.start();
  const before = battle.getState();
  advance(battle, .2);
  assert.equal(battle.getState().shots, 0, 'there is no autonomous firing');
  battle.aim(5.4, .6, true);
  advance(battle, 1 / 60);
  battle.setTrigger(false);
  const missed = battle.getState();
  assert.equal(missed.shots, 1); assert.equal(missed.hits, 0);
  assert.equal(missed.ammo, 23);
  assert.deepEqual(missed.targets.map(t => t.hp), before.targets.map(t => t.hp));
  advance(battle, .16);
  const target = battle.getState().targets[0];
  battle.aim(target.x, target.y - .2, true);
  advance(battle, 1 / 60);
  const hit = battle.getState();
  assert.equal(hit.shots, 2); assert.equal(hit.hits, 1); assert.equal(hit.weakpointHits, 0);
  assert.equal(hit.targets[0].hp, target.hp - 9);
  assert.equal(hit.targets[1].hp, before.targets[1].hp);
  battle.dispose();
});

test('a tap between animation frames fires once and repeated taps respect the weapon rate', () => {
  const { battle } = create();battle.start();const target=battle.getState().targets[0];
  battle.aim(target.x,target.weakY,true);battle.setTrigger(false);
  assert.equal(battle.getState().shots,1);assert.equal(battle.getState().hits,1);
  battle.setTrigger(true);battle.setTrigger(false);assert.equal(battle.getState().shots,1);
  advance(battle,.16);battle.aim(target.x,target.weakY,true);battle.setTrigger(false);
  assert.equal(battle.getState().shots,2);battle.dispose();
});

test('a confirmed weakpoint marker survives release and stays at the hit while aim moves', () => {
  const { battle, group } = create();battle.start();const target=battle.getState().targets[0];
  battle.aim(target.x,target.weakY,true);battle.setTrigger(false);
  const marker=group.getObjectByName('confirmed-hit-marker');
  assert.equal(battle.getState().hitConfirmed,true);assert.equal(battle.getState().lastHitWeak,true);
  assert.equal(marker.visible,true);const confirmedPosition=marker.position.toArray();
  advance(battle,.12);battle.aim(5.4,.6,false);
  assert.equal(battle.getState().hitConfirmed,true);assert.deepEqual(marker.position.toArray(),confirmedPosition);
  advance(battle,.15);assert.equal(battle.getState().hitConfirmed,false);assert.equal(marker.visible,false);
  battle.dispose();
});

test('core weakpoints and purchased attack bonuses multiply real damage', () => {
  function shot(stats, weak) {
    const { battle } = create(stats); battle.start();
    const target = battle.getState().targets[0];
    battle.aim(target.x, weak ? target.weakY : target.y - .2, true);
    advance(battle, 1 / 60);
    const after = battle.getState(), damage = target.hp - after.targets[0].hp;
    battle.dispose(); return { damage, weakpointHits: after.weakpointHits };
  }
  const body = shot({}, false), weak = shot({}, true), upgraded = shot({ attackMultiplier: 1.18 }, true);
  assert.equal(body.damage, 9); assert.equal(body.weakpointHits, 0);
  assert.ok(Math.abs(weak.damage - body.damage * 2.35) < 1e-8);
  assert.equal(weak.weakpointHits, 1);
  assert.ok(Math.abs(upgraded.damage - weak.damage * 1.18) < 1e-8);
});

test('releasing fire immediately enters cover; the same hostile shot deals less damage', () => {
  const exposed = create(), covered = create();
  for (const instance of [exposed, covered]) {
    instance.battle.start(); instance.battle.aim(5.4, .6, true); advance(instance.battle, 2.65);
  }
  covered.battle.setTrigger(false);
  assert.equal(covered.battle.getState().exposed, false);
  advance(exposed.battle, .4); advance(covered.battle, .4);
  assert.equal(exposed.hits.length, 1); assert.equal(covered.hits.length, 1);
  assert.equal(exposed.hits[0].covered, false); assert.equal(covered.hits[0].covered, true);
  assert.equal(exposed.hits[0].amount, 7); assert.equal(covered.hits[0].amount, 1.75);
  assert.equal(exposed.battle.getState().coverHp, 120);
  assert.equal(covered.battle.getState().coverHp, 114.75);
  exposed.battle.dispose(); covered.battle.dispose();
});

test('armor-room bonuses reduce incoming damage and add cover absorption instead of fractional cover HP', () => {
  const baseline = create(), upgraded = create({ defenseMultiplier: 1.2, coverBonus: .06 });
  for (const instance of [baseline, upgraded]) { instance.battle.start(); advance(instance.battle, 3.05); }
  assert.equal(baseline.battle.getState().maxCoverHp, 120);
  assert.equal(upgraded.battle.getState().maxCoverHp, 120);
  assert.equal(upgraded.battle.getState().coverReduction, .81);
  assert.ok(Math.abs(upgraded.hits[0].amount - (7 / 1.2) * .19) < 1e-8);
  assert.ok(upgraded.battle.getState().hp > baseline.battle.getState().hp);
  const capped = create({ coverBonus: 99 }); capped.battle.start();
  assert.equal(capped.battle.getState().coverReduction, .97);
  baseline.battle.dispose(); upgraded.battle.dispose(); capped.battle.dispose();
});

test('releasing a partly spent magazine automatically reloads while protected by cover', () => {
  const { battle, reloads } = create(); battle.start(); battle.aim(5.4, .6, true);
  advance(battle, .35); battle.setTrigger(false);
  const spent = battle.getState().ammo; assert.ok(spent < 24);
  advance(battle, .3);
  assert.equal(battle.getState().reloading, true); assert.equal(battle.getState().exposed, false);
  advance(battle, 1.2);
  assert.equal(battle.getState().ammo, 24); assert.equal(battle.getState().reloading, false);
  assert.equal(reloads.length, 1); battle.dispose();
});

test('holding fire exhausts a finite magazine and enters cover for its automatic reload', () => {
  const { battle, reloads } = create(); battle.start(); battle.aim(5.4, .6, true);
  for (let i = 0; i < 250 && !battle.getState().reloading; i++) advance(battle, 1 / 60);
  const loading = battle.getState();
  assert.equal(loading.shots, 24); assert.equal(loading.ammo, 0);
  assert.equal(loading.reloading, true); assert.equal(loading.exposed, false); assert.equal(reloads.length, 1);
  advance(battle, 1.5);
  assert.ok(battle.getState().shots > 24, 'held fire resumes after the magazine is replenished');
  battle.dispose();
});

test('combat preserves carried HP, honors the wall-clock deadline and settles exactly once', () => {
  const { battle, results } = create(); battle.start({ duration: 38, hp: 72 });
  assert.equal(battle.getState().hp, 72);
  battle.aim(0, 3, true);
  const beforeDeadlineShots = battle.getState().shots;
  battle.update(60);
  assert.equal(results.length, 1); assert.equal(results[0].duration, 38); assert.equal(results[0].hp, 72);
  assert.equal(battle.getState().active, false); assert.equal(battle.getState().exposed, false);
  battle.update(60); battle.setTrigger(true); battle.reload(); battle.ultimate();
  assert.equal(results.length, 1); assert.equal(battle.getState().shots, beforeDeadlineShots); battle.dispose();
});

test('ultimate damages enemies without minting per-kill cores and enforces its cooldown', () => {
  const { battle } = create(); battle.start();
  assert.equal(battle.ultimate(), true); assert.equal(battle.getState().kills, 2);
  assert.equal(battle.getState().cores, 0); assert.equal(battle.ultimate(), false);
  assert.equal(battle.getState().skillCooldown, 14);
  battle.update(15); assert.equal(battle.getState().skillCooldown, 0);
  assert.equal(battle.ultimate(), true); battle.dispose();
});

test('the elite enters its visible overload phase below half health and maintains a readable attack warning', () => {
  const { battle }=create();battle.start();battle.update(23.01);
  assert.equal(battle.getState().elitePhase,'guard');
  for(let i=0;i<7;i++){
    const elite=battle.getState().targets.find(t=>t.elite);
    battle.aim(elite.x,elite.weakY,true);battle.setTrigger(false);advance(battle,.16);
  }
  const state=battle.getState(),elite=state.targets.find(t=>t.elite);
  assert.ok(state.eliteHp>0&&state.eliteHp<=state.eliteMaxHp*.5);
  assert.equal(state.elitePhase,'overload');assert.equal(elite.enraged,true);
  assert.match(state.stage,/核心过载/);
  advance(battle,.2);assert.equal(battle.getState().targets.find(t=>t.elite).charging,true);
  battle.dispose();
});

test('a manually aimed complete run spawns its elite and yields cores and blueprints without moving the player', () => {
  const { battle, results, hero } = create(); let eliteSeen = false;
  battle.start({ duration: 38, weaponLevel: 1 });
  for (let i = 0; i < 2281 && battle.getState().active; i++) {
    const state = battle.getState(), target = state.targets.find(t => t.elite) ?? state.targets[0];
    eliteSeen ||= state.eliteHp > 0;
    if (target) battle.aim(target.x, target.weakY, true); else battle.setTrigger(false);
    if (state.eliteHp > 0 && state.skillCooldown === 0) battle.ultimate();
    battle.update(1 / 60, i / 60);
  }
  assert.equal(results.length, 1); assert.equal(results[0].duration, 38);
  assert.equal(results[0].cores, 10); assert.ok(results[0].kills > 0);
  assert.ok(eliteSeen); assert.equal(results[0].eliteKilled, true); assert.equal(results[0].blueprints, 1);
  assert.ok(results[0].accuracy > 80); assert.ok(results[0].weakpointHits > 0);
  assert.equal('alloy' in results[0], false);
  assert.deepEqual(hero.position.toArray(), [0, -3.05, 4]); battle.dispose();
});

test('zero-energy arrival emits a zero-reward result, and stopping cancels further simulation', () => {
  const { battle, results } = create(); battle.start({ duration: 0 });
  assert.equal(results.length, 1); assert.equal(results[0].cores, 0);
  battle.start(); battle.stop(); battle.update(60);
  assert.equal(results.length, 1); battle.dispose();
});

test('cover-scene artwork exposes its compositing material and visibly rises on fire', () => {
  const group = new THREE.Group(), scene = createBattleScene(THREE, group);
  const texture = new THREE.Texture({ width: 1024, height: 1536 });
  scene.setArtwork({ operatorTexture: texture });
  const artwork = scene.hero.getObjectByName('operator-artwork');
  assert.ok(artwork); assert.equal(artwork.material.map, texture);
  scene.update(1, 0, { exposed: false, ammo: 24 }); const shelteredY = artwork.position.y;
  scene.update(1, 0, { exposed: true, ammo: 24 });
  assert.ok(artwork.position.y - shelteredY > 1, 'ducking puts visibly more of the body behind the foreground barricade');
  assert.ok(scene.hero.position.y + artwork.position.y + 2.9 > 1.8, 'the upper body clears the foreground cover');
  scene.dispose(); texture.dispose();
});

test('a quick tap resolves the new shoulder and exact rotated barrel position before a render update', () => {
  const group=new THREE.Group(),scene=createBattleScene(THREE,group);
  const texture=new THREE.Texture({width:1024,height:1536}),poses=aimStubs();scene.setArtwork({operatorTexture:texture,aimTextures:poses});
  const artwork=scene.hero.getObjectByName('operator-artwork');
  const battle=createBattle({THREE,group,hero:scene.hero,economy:{state:{hp:100}}});battle.start();
  scene.update(1,0,{exposed:false,ammo:24,aimX:4});
  assert.ok(artwork.scale.x>0);const oldMuzzle=scene.hero.userData.muzzleLocal.clone();
  battle.aim(-4,3,true);battle.setTrigger(false);
  assert.ok(artwork.scale.x<0,'the new side is applied in the tap handler itself');
  assert.ok(scene.hero.userData.muzzleLocal.x<oldMuzzle.x-2);
  const state=scene.getMotionState(),pose=OPERATOR_AIM_POSES.find(p=>p.angle===state.poseAngle);
  const expected=artworkPoint(artwork,scene.hero,pose.tip);
  assert.ok(expected.distanceTo(scene.hero.userData.muzzleLocal)<.003);
  assert.ok(state.barrelErrorDegrees<1e-7);
  assert.equal(battle.getState().shots,1);battle.dispose();scene.dispose();texture.dispose();Object.values(poses).forEach(t=>t.dispose());
});

test('all eight painted aim poses keep the rendered bore aimed through the target during exposure and recoil',()=>{
 const group=new THREE.Group(),scene=createBattleScene(THREE,group),texture=new THREE.Texture({width:1024,height:1536}),poses=aimStubs();
 scene.setArtwork({operatorTexture:texture,aimTextures:poses});const artwork=scene.hero.getObjectByName('operator-artwork');
 const seen=new Set();let shots=0;
 for(const exposed of [false,true])for(const side of [-1,1])for(const angle of [30,45,60,75]){
  scene.update(1,0,{exposed,shots});
  const shoulderY=-3.05+artwork.position.y+.30*8.2,shoulderX=-.62+.08*8.2*2/3*side;
  const rad=angle*Math.PI/180,x=shoulderX+side*Math.cos(rad)*5.5,y=shoulderY+Math.sin(rad)*5.5;
  scene.update(1/60,0,{exposed,shots:++shots,aimX:x,aimY:y});
  const state=scene.getMotionState();assert.equal(state.poseAngle,angle);assert.equal(state.side,side);assert.equal(state.poseAssetsReady,true);seen.add(`${side}:${angle}`);
  const pose=OPERATOR_AIM_POSES.find(p=>p.angle===angle),root=artworkPoint(artwork,scene.hero,pose.root),tip=artworkPoint(artwork,scene.hero,pose.tip);
  const barrel=new THREE.Vector2(tip.x-root.x,tip.y-root.y).normalize(),target=new THREE.Vector2(x-root.x,y-root.y).normalize();
  const error=Math.abs(Math.atan2(barrel.x*target.y-barrel.y*target.x,barrel.dot(target)))*180/Math.PI;
  assert.ok(error<.15,`${side} ${angle}: drawn mesh bore error ${error}°`);
  assert.ok(tip.distanceTo(scene.hero.userData.muzzleLocal)<.003,'muzzle effect uses the visible tip');
  assert.ok(barrel.dot(new THREE.Vector2(x-tip.x,y-tip.y))>0,'tracer travels forward, never backwards through the gun');
  assert.ok([...artwork.geometry.attributes.position.array].every(Number.isFinite));
 }
 assert.equal(seen.size,8);scene.dispose();texture.dispose();Object.values(poses).forEach(t=>t.dispose());
});

test('low/near targets and the first shot after reload retain a forward-facing bore without moving the boots',()=>{
 const group=new THREE.Group(),scene=createBattleScene(THREE,group),texture=new THREE.Texture({width:1024,height:1536}),poses=aimStubs();
 scene.setArtwork({operatorTexture:texture,aimTextures:poses});const art=scene.hero.getObjectByName('operator-artwork');
 scene.update(.4,0,{exposed:true,reloading:true,reloadProgress:.52});
 const boot=artworkPoint(art,scene.hero,{x:-.27,y:-.48});
 for(const [x,y] of [[-5,.5],[5,.5],[0,3],[-.62,2],[.1,7],[-4,4]]){
  scene.hero.userData.resolveMuzzle(x,y,true);const state=scene.getMotionState();
  assert.ok(state.barrelErrorDegrees<1e-7,JSON.stringify(state));
  assert.ok(state.lengthScale>0&&state.lengthScale<=1);
 }
 // Same facing, same motion, only aim changed: feet are not part of the weapon warp.
 scene.hero.userData.resolveMuzzle(4,6,true);const a=art.geometry.attributes.position;const before=[a.getX(a.count-1),a.getY(a.count-1)];
 scene.hero.userData.resolveMuzzle(4,1,true);assert.deepEqual([a.getX(a.count-1),a.getY(a.count-1)],before);
 assert.ok(Number.isFinite(boot.y));scene.dispose();texture.dispose();Object.values(poses).forEach(t=>t.dispose());
});

test('rifle recoil travels through the waist and ponytail while the feet remain planted',()=>{
  const motion=createOperatorMotion(),rest=motion.update(1/60,0,{shots:0});
  const first=motion.update(1/60,0,{shots:1,exposed:true});
  const later=motion.update(.06,0,{shots:1,exposed:true});
  assert.ok(first.gun>.4);assert.ok(later.gun<first.gun,'the weapon returns before secondary motion settles');
  assert.ok(later.hips>first.hips);assert.ok(later.hair>first.hair,'the ponytail follows the shot with a delay');
  const foot=deformOperatorPoint(-.27,-.48,later),hip=deformOperatorPoint(-.02,.085,later);
  assert.ok(Math.hypot(foot.x+.27,foot.y+.48)<.00001);
  assert.ok(Math.abs(hip.x+.02)>.003,'the pelvis visibly reacts independently of the fixed boots');
  const gun=deformOperatorPoint(.45,.44,first),gunRest=deformOperatorPoint(.45,.44,rest);
  assert.ok(Math.hypot(gun.x-gunRest.x,gun.y-gunRest.y)>.01);
  for(let i=0;i<90;i++)motion.update(1/60,0,{shots:1});
  assert.equal(motion.getState().gun,0);assert.equal(motion.getState().hips,0);assert.equal(motion.getState().hair,0);
});

test('reload motion shows removal, insertion, bolt rack and return, with no firing during reload',()=>{
  const motion=createOperatorMotion(),{battle}=create();battle.start();battle.aim(5.4,.6,true);battle.setTrigger(false);battle.reload();
  const shots=battle.getState().shots;
  for(const [progress,stage] of [[.05,'lower'],[.25,'remove'],[.52,'insert'],[.74,'rack'],[.94,'raise']]){
    const pose=motion.update(1/60,0,{reloading:true,reloadProgress:progress,shots});
    assert.equal(pose.reloadStage,stage);assert.ok(pose.reloadMix>0);
    if(stage==='remove')assert.equal(pose.insertMix,0);
    if(stage==='rack')assert.equal(pose.insertMix,1);
  }
  battle.setTrigger(true);advance(battle,.8);assert.equal(battle.getState().shots,shots);
  const completed=motion.update(1/60,0,{reloading:false,reloadProgress:1,shots});
  assert.equal(completed.reloadMix,0);assert.equal(completed.reloadStage,'ready');
  battle.dispose();
});

test('a complete zero-kill round and a successful round both settle a single fixed ten-core batch',()=>{
  const {battle,results}=create();battle.start();battle.update(38);
  assert.equal(results[0].kills,0);assert.equal(results[0].cores,10);
  battle.update(38);assert.equal(results.length,1);battle.dispose();
});

test('audio degrades safely without an audio device', () => {
  const audio = createAudio(); audio.unlock(); audio.setMuted(true); audio.play('ultimate');
  audio.update(1, 'BATTLE'); assert.equal(audio.muted, true); audio.dispose();
});
