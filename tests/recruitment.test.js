import test from 'node:test';
import assert from 'node:assert/strict';
import {Economy,EventBus,BALANCE} from '../src/economy.js';
import {OPERATOR_DEFS} from '../src/operators.js';
const fixture=(state={})=>{const data=new Map([[BALANCE.storageKey,JSON.stringify({version:1,savedAt:Date.now(),state})]]);const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};return{storage,e:new Economy(new EventBus(),{storage})};};

test('old saves keep resources/room levels and receive only the original starter operator',()=>{
 const {e}=fixture({alloy:250,rooms:{reactor:19,armory:4},weaponLevel:3});
 assert.deepEqual(e.state.ownedOperators,['spark']);assert.deepEqual(e.state.squad,['spark']);
 assert.equal(e.state.rooms.reactor,19);assert.equal(e.state.alloy,250);assert.equal(e.state.weaponLevel,3);
 assert.equal(e.state.roomStats.find(r=>r.id==='reactor').name,'招募中心');
 assert.ok(Math.abs(e.state.attackMultiplier-(1+.72+.38))<1e-10);
 assert.equal(e.state.production,.76,'recruitment center is no longer a fusion energy producer');
});
test('recruitment requires a built station and exact coins; duplicate and invalid recruits never spend',()=>{
 const {e}=fixture({alloy:200});
 assert.equal(e.dispatch('RECRUIT_OPERATOR',{id:'ember'}).ok,false);assert.equal(e.state.alloy,200);
 assert.equal(e.dispatch('UNLOCK_ROOM',{id:'reactor'}).ok,true);assert.equal(e.state.alloy,168);
 for(const id of ['ember','volt']){const cost=OPERATOR_DEFS.find(d=>d.id===id).cost,before=e.state.alloy;assert.equal(e.dispatch('RECRUIT_OPERATOR',{id}).ok,true);assert.equal(e.state.alloy,before-cost);assert.ok(e.state.ownedOperators.includes(id));const paid=e.state.alloy;assert.equal(e.dispatch('RECRUIT_OPERATOR',{id}).ok,false);assert.equal(e.state.alloy,paid);}
 assert.deepEqual(e.state.squad,['spark','ember','volt']);const before=e.state.alloy;assert.equal(e.dispatch('RECRUIT_OPERATOR',{id:'unknown'}).ok,false);assert.equal(e.state.alloy,before);
});
test('insufficient recruitment balance cannot partially deduct or create a character',()=>{
 const {e}=fixture({alloy:41,rooms:{reactor:1}});assert.equal(e.dispatch('RECRUIT_OPERATOR',{id:'ember'}).ok,false);
 assert.equal(e.state.alloy,41);assert.deepEqual(e.state.ownedOperators,['spark']);assert.equal(e.state.operatorStats.find(d=>d.id==='ember').canRecruit,false);
});
test('three-slot roster rejects duplicates, unknown/locked characters, over-cap and live-run edits',()=>{
 const {e}=fixture({alloy:500,rooms:{reactor:1}});
 for(const squad of [['ember'],['spark','spark'],['unknown'],['spark','ember','volt','spark']])assert.equal(e.dispatch('SET_SQUAD',{squad}).ok,false);
 e.dispatch('RECRUIT_OPERATOR',{id:'ember'});e.dispatch('RECRUIT_OPERATOR',{id:'volt'});
 assert.equal(e.dispatch('SET_SQUAD',{squad:['volt','ember']}).ok,true);
 const run=e.dispatch('LAUNCH');assert.deepEqual(run.squad,['volt','ember']);assert.ok(Object.isFrozen(run.squad));
 assert.equal(e.dispatch('SET_SQUAD',{squad:['spark']}).ok,false);assert.deepEqual(e.state.squad,['volt','ember']);
 e.dispatch('BATTLE_END',{runId:run.runId,hp:100});assert.equal(e.dispatch('SET_SQUAD',{squad:['spark']}).ok,true);
});
test('an explicitly empty roster cannot spend launch energy and stays empty after reload',()=>{
 const {e,storage}=fixture();assert.equal(e.dispatch('SET_SQUAD',{squad:[]}).ok,true);const energy=e.state.energy;
 assert.equal(e.dispatch('LAUNCH').ok,false);assert.equal(e.state.energy,energy);assert.equal(e.state.activeRun,false);
 assert.deepEqual(new Economy(new EventBus(),{storage}).state.squad,[]);
});
test('recruited operators and roster order survive reload with frozen isolated snapshots',()=>{
 const {e,storage}=fixture({alloy:200,rooms:{reactor:1}});e.dispatch('RECRUIT_OPERATOR',{id:'ember'});e.dispatch('RECRUIT_OPERATOR',{id:'volt'});e.dispatch('SET_SQUAD',{squad:['ember','volt','spark']});
 const s=e.state;assert.throws(()=>s.squad.push('spark'),TypeError);assert.throws(()=>s.ownedOperators[0]='fake',TypeError);assert.throws(()=>s.operatorStats[0].cost=999,TypeError);
 const restored=new Economy(new EventBus(),{storage});assert.deepEqual(restored.state.squad,['ember','volt','spark']);assert.deepEqual(restored.state.ownedOperators,['spark','ember','volt']);assert.equal(restored.state.alloy,94);
 e.dispatch('SET_SQUAD',{squad:['spark']});assert.deepEqual(s.squad,['ember','volt','spark']);
});
test('recruit affordance remains at max room level until both operators are owned',()=>{
 const {e}=fixture({alloy:200,rooms:{reactor:20}});assert.equal(e.state.roomStats.find(r=>r.id==='reactor').canPurchase,true);
 e.dispatch('RECRUIT_OPERATOR',{id:'ember'});assert.equal(e.state.recruitAvailable,true);e.dispatch('RECRUIT_OPERATOR',{id:'volt'});
 assert.equal(e.state.recruitAvailable,false);assert.equal(e.state.roomStats.find(r=>r.id==='reactor').canPurchase,false);
});
test('malformed saved ownership and squad are sanitized without granting locked roles',()=>{
 const {e}=fixture({ownedOperators:['unknown','ember','ember'],squad:['volt','ember','ember','unknown','spark']});
 assert.deepEqual(e.state.ownedOperators,['spark','ember']);assert.deepEqual(e.state.squad,['ember','spark']);
});
