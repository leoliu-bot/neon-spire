import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBattleScene,OPERATOR_AIM_POSES,SQUAD_ART_DEFS} from '../src/battle-scene.js';

function setup(){
 const textures=Array.from({length:7},()=>new THREE.Texture({width:1024,height:1536}));
 const group=new THREE.Group(),scene=createBattleScene(THREE,group);
 scene.setArtwork({operatorTexture:textures[0],aimTextures:Object.fromEntries(OPERATOR_AIM_POSES.map((p,i)=>[p.angle,textures[i+1]])),operatorTextures:{ember:textures[5],volt:textures[6]}});
 const art=id=>scene.hero.getObjectByName(id==='spark'?'operator-artwork':`operator-artwork-${id}`);
 return{scene,art,dispose(){scene.dispose();textures.forEach(t=>t.dispose());}};
}
const squad=(extra={})=>['spark','ember','volt'].map(id=>({id,shots:0,exposed:true,reloading:false,reloadProgress:1,...extra[id]}));
// Independently interpolate the actual rendered triangles at the annotated source-image pixels.
function drawnPoint(art,hero,point){
 const {uv,position:p}=art.geometry.attributes,index=art.geometry.index,x=point.x+.5,y=point.y+.5;
 for(let i=0;i<index.count;i+=3){
  const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),ax=uv.getX(a),ay=uv.getY(a),bx=uv.getX(b),by=uv.getY(b),cx=uv.getX(c),cy=uv.getY(c);
  const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy),wa=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det,wb=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det,wc=1-wa-wb;
  if(Math.min(wa,wb,wc)<-1e-5)continue;
  return new THREE.Vector3(p.getX(a)*wa+p.getX(b)*wb+p.getX(c)*wc,p.getY(a)*wa+p.getY(b)*wb+p.getY(c)*wc,0).applyMatrix4(art.matrix).applyMatrix4(hero.matrix);
 }
 assert.fail('Annotated muzzle is outside the rendered character mesh');
}

test('only actual squad members are drawn and selecting a teammate immediately places her in the center',()=>{
 const t=setup(),{scene,art}=t;
 assert.equal(art('spark').visible,true);assert.equal(art('ember').visible,false);assert.equal(art('volt').visible,false);
 scene.hero.userData.setSquad(['spark','ember','volt'],'spark');
 scene.update(.4,0,{squad:squad(),activeOperatorId:'spark',aimX:2,aimY:4});
 assert.ok(['spark','ember','volt'].every(id=>art(id).visible));
 assert.equal(scene.getMotionState().operators.find(o=>o.id==='spark').slot,'center');
 assert.equal(scene.hero.userData.setActiveOperator('ember'),true);
 const state=scene.getMotionState();assert.equal(state.activeOperatorId,'ember');
 assert.equal(state.operators.find(o=>o.id==='ember').slot,'center');assert.ok(art('spark').position.x<art('ember').position.x);assert.ok(art('volt').position.x>art('ember').position.x);
 assert.equal(scene.hero.userData.setActiveOperator('invalid'),false);
 scene.hero.userData.setSquad(['volt'],'volt');
 assert.equal(art('spark').visible,false);assert.equal(art('ember').visible,false);assert.equal(art('volt').visible,true);
 assert.equal(scene.hero.userData.resolveMuzzle(1,4,true,'ember'),null,'an unequipped teammate cannot emit a shot');t.dispose();
});

test('both new heavy weapons keep their visible bore and their own muzzle aligned for left/right and near targets in every slot',()=>{
 const t=setup(),{scene,art}=t;
 for(const active of ['spark','ember','volt']){
  scene.update(.5,0,{squad:squad(),activeOperatorId:active,aimX:1,aimY:4});
  for(const id of ['ember','volt'])for(const [x,y]of [[-4,5],[4,5],[.2,3],[-.5,.5],[4,.6],[-3,7]]){
   const muzzle=scene.hero.userData.resolveMuzzle(x,y,true,id).clone(),def=SQUAD_ART_DEFS[id];
   const root=drawnPoint(art(id),scene.hero,def.root),tip=drawnPoint(art(id),scene.hero,def.tip);
   const bore=new THREE.Vector2(tip.x-root.x,tip.y-root.y).normalize(),target=new THREE.Vector2(x-root.x,y-root.y).normalize();
   const error=Math.abs(Math.atan2(bore.x*target.y-bore.y*target.x,bore.dot(target)))*180/Math.PI;
   assert.ok(error<.2,`${id} while ${active} leads: drawn bore error ${error}`);
   assert.ok(tip.distanceTo(muzzle)<.004,'shot starts at this character’s drawn muzzle');
   assert.ok(bore.dot(new THREE.Vector2(x-tip.x,y-tip.y))>0,'the target remains forward of the weapon');
  }
 }
 const left=scene.hero.userData.resolveMuzzle(1,5,true,'ember').clone(),right=scene.hero.userData.resolveMuzzle(1,5,true,'volt').clone();
 assert.ok(left.distanceTo(right)>.1,'support fire does not reuse the active character muzzle');t.dispose();
});

test('shot recoil, ammo mechanism and reload states remain independent for each visible member',()=>{
 const t=setup(),{scene}=t;
 scene.update(.016,0,{squad:squad(),activeOperatorId:'ember',aimX:3,aimY:4});
 scene.update(.016,.016,{squad:squad({ember:{shots:1},volt:{shots:0}}),activeOperatorId:'ember',aimX:3,aimY:4});
 let state=scene.getMotionState(),ember=state.operators.find(o=>o.id==='ember'),volt=state.operators.find(o=>o.id==='volt'),spark=state.operators.find(o=>o.id==='spark');
 assert.ok(ember.gun>.6);assert.equal(volt.gun,0);assert.equal(spark.gun,0);
 scene.update(.016,.032,{squad:squad({ember:{shots:1,reloading:true,reloadProgress:.48,exposed:false},volt:{shots:1}}),activeOperatorId:'ember',aimX:3,aimY:4});
 state=scene.getMotionState();ember=state.operators.find(o=>o.id==='ember');volt=state.operators.find(o=>o.id==='volt');
 assert.equal(ember.reloadAttachmentVisible,true);assert.equal(ember.barrelErrorDegrees,null,'a lowered reload weapon does not claim to be aligned');
 assert.equal(volt.reloadAttachmentVisible,false);assert.equal(volt.rotorActive,true);assert.ok(volt.gun>0);
 scene.update(.016,.048,{squad:squad({ember:{shots:1},volt:{shots:1,reloading:true,reloadProgress:.5,exposed:false}}),activeOperatorId:'volt',aimX:3,aimY:4});
 state=scene.getMotionState();assert.equal(state.operators.find(o=>o.id==='ember').reloadAttachmentVisible,false);assert.equal(state.reloadAttachmentVisible,true);assert.equal(state.rotorActive,false);
 scene.hero.userData.setSquad(['spark'],'spark');
 assert.equal(scene.hero.getObjectByName('operator-reload-volt').visible,false);t.dispose();
});
