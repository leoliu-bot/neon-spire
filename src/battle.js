import { OPERATOR_DEFS, operatorById } from './operators.js';

/** Fixed-position squad combat: every weapon follows the player's screen aim. */
export function createBattle({ THREE:T, group, hero, economy, bus, effects={} }) {
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), emit=(n,d)=>bus?.emit?.(n,d);
 const layer=new T.Group();layer.name='aimed-cover-combat';group.add(layer);
 const wp=new T.Vector3(),materials=[],geometries=[];
 function burst(x,y,color=0xffaa75,count=12){wp.set(x,y,1);group.localToWorld(wp);effects.burst?.(wp.x,wp.y,wp.z,color,count);}
 const mat=(color,emissive=0,intensity=0)=>{const m=new T.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,metalness:.55,roughness:.5});materials.push(m);return m;};
 const basic=(color,opacity=1)=>{const m=new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,toneMapped:false,depthWrite:false});materials.push(m);return m;};
 const steel=mat(0x657575),dark=mat(0x202b31),armor=mat(0xa1aba2),red=mat(0xff735e,0xff432e,1.5),amber=mat(0xffb75e,0xff7826,1.5);
 const white=basic(0xfff0c4),warning=basic(0xff584c,.85),tracer=basic(0xffd992,.9),cyan=basic(0x9febff,.9);
 const geo=g=>{geometries.push(g);return g;},box=geo(new T.BoxGeometry(1,1,1)),orb=geo(new T.IcosahedronGeometry(1,1)),ring=geo(new T.TorusGeometry(1,.025,4,44));
 function mesh(g,m,p,x=0,y=0,z=0,sx=1,sy=sx,sz=sx){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);p.add(o);return o;}
 function drone(i){
  const root=new T.Group(),body=new T.Group();root.add(body);layer.add(root);const elite=i===13,color=elite?amber:red;
  mesh(orb,steel,body,0,0,0,.52,.4,.32);mesh(box,dark,body,0,-.03,.22,.9,.28,.18);mesh(box,color,body,0,.16,.38,.38,.1,.06);mesh(orb,color,body,0,.16,.42,.14,.11,.09);
  for(const s of[-1,1]){const wing=mesh(box,steel,body,s*.59,-.02,0,.42,.17,.34);wing.rotation.z=s*.25;mesh(box,dark,body,s*.62,-.22,.07,.16,.31,.2);mesh(box,color,body,s*.62,-.28,.2,.1,.05,.02);mesh(box,dark,body,s*.2,-.3,.2,.15,.3,.14);mesh(box,steel,body,s*.17,.28,-.06,.1,.18,.12);}
  const coreHalo=mesh(ring,color,body,0,.16,.46,.215);coreHalo.scale.y=.8;
  // Small bright bevels, engine nozzles and separated armor plates remain legible at phone scale.
  for(const s of[-1,1]){
   mesh(box,armor,body,s*.34,.22,.25,.22,.085,.08).rotation.z=s*-.28;
   mesh(box,steel,body,s*.15,-.24,.32,.23,.06,.06).rotation.z=s*.15;
   mesh(ring,armor,body,s*.64,-.12,.25,.15);
   mesh(orb,dark,body,s*.64,-.12,.24,.115,.115,.045);
   mesh(box,color,body,s*.57,.13,.24,.19,.035,.025);
   mesh(box,dark,body,s*.33,-.35,.14,.09,.22,.09);
   mesh(box,armor,body,s*.33,-.48,.19,.1,.07,.08);
  }
  const engineGlow=mesh(box,cyan,body,0,-.39,-.02,.23,.09,.03);
  const telegraph=new T.Group();root.add(telegraph);telegraph.position.z=.56;telegraph.visible=false;
  mesh(ring,warning,telegraph,0,0,0,.88);
  for(const s of[-1,1]){mesh(box,warning,telegraph,s*.98,0,0,.13,.055,.015);mesh(box,warning,telegraph,0,s*.63,0,.055,.13,.015);}
  const charge=mesh(ring,white,root,0,.16,.58,.08);charge.visible=false;
  mesh(box,dark,root,0,.7,.25,1.15,.055,.02);const bar=mesh(box,color,root,0,.7,.29,1.15,.055,.02);
  if(elite){root.scale.setScalar(1.6);for(const s of[-1,1]){
   mesh(box,steel,body,s*.65,.25,-.05,.58,.43,.38).rotation.z=s*-.2;
   mesh(box,armor,body,s*.75,.39,.17,.51,.085,.08).rotation.z=s*-.2;
   mesh(box,color,body,s*.69,.3,.22,.18,.1,.03);
   const rail=mesh(box,dark,body,s*.87,-.17,.08,.16,.6,.24);rail.rotation.z=s*.13;
   mesh(box,armor,body,s*.91,-.48,.2,.2,.1,.08);
   mesh(box,color,body,s*.91,-.5,.25,.09,.045,.025);
   for(let v=0;v<3;v++)mesh(box,color,body,s*(.5+v*.14),.57-v*.025,.12,.055,.1,.03);
   mesh(box,armor,body,s*.21,.44,-.02,.085,.32,.13).rotation.z=s*-.26;
  }}
  root.visible=false;return{root,body,telegraph,charge,coreHalo,engineGlow,bar,active:false,elite,enraged:false,hp:0,maxHp:0,fire:0,baseX:0,baseY:0,age:0,phase:i*2.3,flash:0};
 }
 const enemies=Array.from({length:14},(_,i)=>drone(i));
 const lines=Array.from({length:22},()=>{const root=mesh(box,tracer,layer,0,0,2,.035,1,.025);root.visible=false;return{root,life:0};});
 function line(x1,y1,x2,y2,hostile=false){const l=lines.find(v=>v.life<=0)||lines[0];l.life=hostile?.16:.07;l.root.visible=true;l.root.material=hostile?warning:tracer;l.root.position.set((x1+x2)/2,(y1+y2)/2,hostile?5.92:5.94);l.root.rotation.z=-Math.atan2(x2-x1,y2-y1);l.root.scale.set(hostile?.045:.023,Math.hypot(x2-x1,y2-y1),.02);}
 const reticle=new T.Group();reticle.name='manual-aim-reticle';layer.add(reticle);mesh(ring,cyan,reticle,0,0,2.6,.23);mesh(box,white,reticle,0,0,2.61,.045,.045,.01);
 for(const s of[-1,1]){mesh(box,cyan,reticle,s*.35,0,2.6,.16,.02,.01);mesh(box,cyan,reticle,0,s*.35,2.6,.02,.16,.01);}reticle.visible=false;
 reticle.position.z=3.5;
 const hitMarker=new T.Group();hitMarker.name='confirmed-hit-marker';layer.add(hitMarker);
 const hitMarkerMat=basic(0xd3ffff),weakMarkerMat=basic(0xffda72);
 const hitMarkerParts=[];for(const x of[-1,1])for(const y of[-1,1]){const part=mesh(box,hitMarkerMat,hitMarker,x*.15,y*.15,0,.15,.045,.012);part.rotation.z=x*y*Math.PI/4;hitMarkerParts.push(part);}hitMarker.visible=false;
 const shockMat=basic(0xaff5ff,.8),shock=mesh(ring,shockMat,layer,0,2,3);shock.visible=false;
 const muzzle=mesh(orb,white,layer,-.35,-2.1,4.5,.16);muzzle.visible=false;
 const weaponMuzzles=new Map(OPERATOR_DEFS.map((def,i)=>{const flash=i?mesh(orb,def.kind==='rocket'?amber:cyan,layer,0,0,5.95,def.kind==='rocket'?.23:.12):muzzle;flash.visible=false;flash.name=`muzzle-${def.id}`;return[def.id,flash];}));
 const rockets=Array.from({length:8},()=>{const root=new T.Group();root.name='rocket-projectile';layer.add(root);mesh(box,armor,root,0,0,0,.11,.42,.10);mesh(orb,amber,root,0,-.26,0,.12,.20,.08);mesh(box,white,root,0,.19,.02,.07,.11,.03);root.visible=false;return{root,active:false,age:0,duration:0,from:new T.Vector2(),to:new T.Vector2(),unit:null,damage:0};});
 const explosions=Array.from({length:8},()=>{const material=basic(0xffb867,.9),root=mesh(ring,material,layer,0,0,5.85,.1);root.name='rocket-blast-radius';root.visible=false;return{root,material,life:0,radius:0};});
 let active=false,hp=100,elapsed=0,duration=38,kills=0,cores=0,blueprints=0,weaponLevel=1,attackMultiplier=1,defenseMultiplier=1,coverReduction=.75,maxCoverHp=120,coverHp=120;
 let trigger=false,aimX=0,aimY=3,skillCooldown=0,spawnClock=0,eliteSpawned=false,eliteKilled=false,stage='WAVE 01',phase=0,shotCount=0,hitCount=0,weakpointHits=0,shockLife=0,hitConfirmLife=0,lastHitWeak=false,lastShotHit=false;
 const makeUnit=id=>({id,def:operatorById(id),ammo:operatorById(id).maxAmmo,shootClock:0,reloadClock:0,releaseClock:0,shots:0,hits:0,damageDone:0,targetsHit:0,muzzleLife:0,explosions:0});
 let units=[makeUnit('spark')],activeOperatorId='spark';
 const primary=()=>units.find(unit=>unit.id===activeOperatorId)||units[0],unitExposed=unit=>trigger&&unit.reloadClock<=0&&unit.ammo>0,exposed=()=>unitExposed(primary()),teamExposed=()=>units.some(unitExposed);
 const interval=unit=>unit.def.kind==='rifle'?Math.max(.09,unit.def.interval-(weaponLevel-1)*.005):unit.def.interval;
 const unitSnapshot=unit=>({id:unit.id,kind:unit.def.kind,name:unit.def.name,ammo:unit.ammo,maxAmmo:unit.def.maxAmmo,reloading:unit.reloadClock>0,reloadProgress:unit.reloadClock>0?1-unit.reloadClock/unit.def.reloadDuration:1,reloadDuration:unit.def.reloadDuration,shots:unit.shots,hits:unit.hits,damageDone:unit.damageDone,targetsHit:unit.targetsHit,exposed:active&&unitExposed(unit),interval:interval(unit),cooldown:unit.shootClock,explosions:unit.explosions,support:unit.id!==activeOperatorId});
 function syncHero(){hero.userData.exposed=active&&exposed();hero.userData.aimX=aimX;hero.userData.aimY=aimY;hero.userData.activeOperatorId=activeOperatorId;hero.userData.shotSerial=primary().shots;hero.userData.shotsByOperator=Object.fromEntries(units.map(unit=>[unit.id,unit.shots]));hero.userData.squadState=units.map(unitSnapshot);}
 const feedback=(text,x,y,color='#fff1be')=>emit('battle:feedback',{text,x,y,z:0,color});
 function clear(){for(const e of enemies){e.active=false;e.root.visible=false;}for(const l of lines){l.life=0;l.root.visible=false;}for(const flash of weaponMuzzles.values())flash.visible=false;for(const rocket of rockets){rocket.active=false;rocket.root.visible=false;}for(const blast of explosions){blast.life=0;blast.root.visible=false;}reticle.visible=shock.visible=hitMarker.visible=false;shockLife=hitConfirmLife=0;}
 function spawn(isElite=false){
  const e=enemies.find(v=>!v.active&&v.elite===isElite);if(!e)return;
  const positions=[[-2.6,4.7],[2.35,3.6],[-.25,5.5],[-3.4,2.5],[3.45,5.1],[1.2,1.9]],n=enemies.filter(v=>v.active).length,p=positions[(Math.floor(elapsed*.73)+n)%positions.length];
  e.active=true;e.root.visible=true;e.baseX=isElite?0:p[0];e.baseY=isElite?4.65:p[1];e.age=0;e.root.position.set(e.baseX,e.baseY,isElite?.35:0);e.body.rotation.set(0,0,0);e.hp=e.maxHp=isElite?260:38+Math.floor(elapsed/15)*7;e.fire=isElite?2.2:2.9+n*.22;e.flash=0;e.enraged=false;e.charge.visible=e.telegraph.visible=false;burst(e.baseX,e.baseY,isElite?0xffae58:0x91d3d4,8);
 }
 function kill(e){if(!e.active)return;e.active=false;e.root.visible=false;kills++;
  if(e.elite){eliteKilled=true;blueprints++;stage='ELITE DOWN';emit('battle:stage',{text:'精英击破 · 强化蓝图已回收'});effects.shake?.(.4);}
  burst(e.root.position.x,e.root.position.y,e.elite?0xffc47a:0xff936d,e.elite?30:13);feedback(e.elite?'精英击破':'击破',e.root.position.x,e.root.position.y+.5,'#ffe5a1');emit('battle:kill',{type:e.elite?'elite':'drone',kills,cores,reward:0});
 }
 function damageEnemy(e,damage,weak=false,unit=null){if(!e.active)return;if(unit){unit.damageDone+=Math.min(e.hp,damage);unit.targetsHit++;}e.hp-=damage;e.flash=.12;feedback(weak?`弱点 ${Math.ceil(damage)}`:String(Math.ceil(damage)),e.root.position.x,e.root.position.y+.65,weak?'#ffd566':'#eef8ee');if(e.hp<=0)kill(e);else if(e.elite&&!e.enraged&&e.hp<=e.maxHp*.5){e.enraged=true;stage='ELITE · 核心过载';emit('battle:stage',{text:'核心过载 · 红圈蓄满前松手躲入掩体'});burst(e.root.position.x,e.root.position.y,0xffaa55,16);}}
 function confirmHit(x,y,weak=false){hitConfirmLife=.23;lastHitWeak=weak;hitMarker.position.set(x,y,6.1);hitMarker.visible=true;for(const p of hitMarkerParts)p.material=weak?weakMarkerMat:hitMarkerMat;}
 function explode(rocket){
  rocket.active=false;rocket.root.visible=false;const {x,y}=rocket.to,unit=rocket.unit,radius=unit.def.splashRadius;let count=0;
  for(const e of enemies){if(!e.active)continue;const distance=Math.hypot(x-e.root.position.x,y-e.root.position.y);if(distance>radius)continue;const scale=e.elite?1.6:1,weak=Math.hypot((x-e.root.position.x)/scale,(y-e.root.position.y)/scale-.16)<.19;damageEnemy(e,rocket.damage*(1-.25*distance/radius)*(weak?unit.def.weakMultiplier:1),weak,unit);count++;}
  unit.explosions++;lastShotHit=count>0;if(count){unit.hits++;hitCount++;confirmHit(x,y);}
  const blast=explosions.find(value=>value.life<=0)||explosions[0];blast.life=.55;blast.radius=radius;blast.root.position.set(x,y,5.85);blast.root.visible=true;blast.root.scale.setScalar(.08);blast.material.opacity=.9;
  burst(x,y,0xffb467,24);effects.shake?.(unit.id===activeOperatorId?.12:.05);emit('battle:explosion',{operatorId:unit.id,x,y,radius,targets:count});
 }
 function fire(unit){
  if(!active||unit.ammo<=0||unit.reloadClock>0)return;unit.ammo--;unit.shots++;shotCount++;unit.muzzleLife=unit.def.kind==='rocket'?.09:.055;const flash=weaponMuzzles.get(unit.id);flash.visible=true;
  // Resolve the shoulder and muzzle synchronously: a touch may start and end between render frames.
  const origin=hero.userData.resolveMuzzle?.(aimX,aimY,true,unit.id)||hero.userData.muzzleLocal;flash.position.set(origin?.x??-.38,origin?.y??-2.1,5.95);
  const support=unit.id!==activeOperatorId,damage=(unit.def.damage+(weaponLevel-1)*(unit.def.kind==='rifle'?2:unit.def.damage*.12))*attackMultiplier*(support?.45:1);
  emit('battle:shot',{x:aimX,y:aimY,ammo:unit.ammo,operatorId:unit.id,kind:unit.def.kind,support,shots:unit.shots,teamShots:shotCount});syncHero();
  if(unit.def.kind==='rocket'){
   const rocket=rockets.find(value=>!value.active)||rockets[0];rocket.active=true;rocket.age=0;rocket.unit=unit;rocket.damage=damage;rocket.from.set(flash.position.x,flash.position.y);rocket.to.set(aimX,aimY);rocket.duration=clamp(rocket.from.distanceTo(rocket.to)/22,.14,.5);rocket.root.position.copy(flash.position);rocket.root.rotation.z=-Math.atan2(aimX-flash.position.x,aimY-flash.position.y);rocket.root.visible=true;lastShotHit=false;if(unit.ammo===0)reloadUnit(unit);return;
  }
  line(flash.position.x,flash.position.y,aimX,aimY);
  let target=null,closest=Infinity,weak=false;
  for(const e of enemies){if(!e.active)continue;const s=e.elite?1.6:1,dx=aimX-e.root.position.x,dy=aimY-e.root.position.y,d=(dx/(.79*s))**2+(dy/(.48*s))**2;if(d<=1&&d<closest){target=e;closest=d;weak=Math.hypot(dx/s,dy/s-.16)<.19;}}
  lastShotHit=!!target;
  if(target){hitCount++;unit.hits++;if(weak)weakpointHits++;confirmHit(aimX,aimY,weak);damageEnemy(target,damage*(weak?unit.def.weakMultiplier:1),weak,unit);burst(aimX,aimY,weak?0xffd674:0xbaf6ff,unit.def.kind==='gatling'?1:3);}else burst(aimX,aimY,0xc4ae8b,unit.def.kind==='gatling'?1:2);
  if(unit.ammo===0)reloadUnit(unit);
 }
 function hostileAttack(e){
  if(!active)return;const raw=(e.elite?18:7)/defenseMultiplier;let damage=raw;
  const visible=teamExposed();if(!visible&&coverHp>0){const absorbed=Math.min(coverHp,raw*coverReduction);coverHp-=absorbed;damage-=absorbed;feedback(coverHp>0?'掩体格挡':'掩体破损',2.1,-1.85,'#a7dfeb');}
  hp=Math.max(0,hp-damage);line(e.root.position.x,e.root.position.y,visible?-.7:2,-2.6,true);emit('battle:hit',{hp,amount:damage,covered:!visible,coverHp});effects.shake?.(visible?.15:.045);burst(visible?-.8:2,-2.45,0xff9162,5);if(hp<=0)finish();
 }
 function finish(){if(!active)return;active=false;trigger=false;cores=elapsed>0?10:0;const result={cores,blueprints,hp:Math.ceil(hp),kills,eliteKilled,duration:Math.min(elapsed,duration),shots:shotCount,accuracy:shotCount?Math.round(hitCount/shotCount*100):0,weakpointHits,squad:units.map(unitSnapshot)};clear();syncHero();emit('battle:end',result);}
 function start(options={}){
  clear();duration=clamp(Number(options.duration??38)||0,0,38);weaponLevel=clamp(Math.floor(options.weaponLevel||1),1,8);hp=clamp(Number(options.hp??economy?.state?.hp??100)||0,0,100);
  attackMultiplier=clamp(Number(options.attackMultiplier??economy?.state?.attackMultiplier??1)||1,1,8);defenseMultiplier=clamp(Number(options.defenseMultiplier??economy?.state?.defenseMultiplier??1)||1,1,8);
  // Armor rooms add damage reduction; their fractional bonus is not cover HP.
  coverReduction=clamp(.75+(Number(options.coverBonus??economy?.state?.coverBonus??0)||0),.75,.97);maxCoverHp=120;coverHp=maxCoverHp;
  const requested=Array.isArray(options.squad)?options.squad:['spark'],ids=[...new Set(requested.filter(id=>operatorById(id)))].slice(0,3);
  units=(ids.length?ids:['spark']).map(makeUnit);activeOperatorId=units.some(unit=>unit.id===options.activeOperatorId)?options.activeOperatorId:units[0].id;
  elapsed=kills=cores=blueprints=shotCount=hitCount=weakpointHits=0;trigger=false;aimX=0;aimY=3;skillCooldown=0;spawnClock=1.7;eliteSpawned=eliteKilled=false;lastHitWeak=lastShotHit=false;stage='WAVE 01';phase=0;active=true;
  hero.position.set(0,-3.05,4);hero.rotation.set(0,0,0);hero.userData.setSquad?.(units.map(unit=>unit.id),activeOperatorId);hero.userData.setActiveOperator?.(activeOperatorId);syncHero();spawn();spawn();reticle.position.set(aimX,aimY,3.5);if(duration<=0||hp<=0)finish();
 }
 function aim(x,y,pressed){if(Number.isFinite(x))aimX=clamp(x,-5.5,5.5);if(Number.isFinite(y))aimY=clamp(y,.5,7);reticle.position.set(aimX,aimY,3.5);hero.userData.aimX=aimX;hero.userData.aimY=aimY;if(typeof pressed==='boolean')setTrigger(pressed);}
 function fireReady(){for(const unit of [primary(),...units.filter(unit=>unit.id!==activeOperatorId)])if(unit.shootClock<=1e-8&&unit.reloadClock<=0&&unit.ammo>0){fire(unit);unit.shootClock=interval(unit);}}
 function setTrigger(value){if(!active)return;const next=!!value,rising=next&&!trigger;if(!next&&trigger)for(const unit of units)unit.releaseClock=0;trigger=next;reticle.visible=trigger;if(rising)fireReady();syncHero();}
 function reloadUnit(unit){if(!active||unit.ammo===unit.def.maxAmmo||unit.reloadClock>0)return false;unit.reloadClock=unit.def.reloadDuration;unit.releaseClock=0;emit('battle:reload',{operatorId:unit.id,kind:unit.def.kind,duration:unit.def.reloadDuration});return true;}
 function reload(id=activeOperatorId){const unit=units.find(value=>value.id===id);if(!unit)return false;const changed=reloadUnit(unit);syncHero();return changed;}
 function selectOperator(value){const unit=typeof value==='number'&&Number.isInteger(value)?units[value]:units.find(unit=>unit.id===value);if(!unit)return false;activeOperatorId=unit.id;hero.userData.setActiveOperator?.(unit.id);syncHero();emit('battle:operator',{operatorId:unit.id,index:units.indexOf(unit)});return true;}
 function ultimate(){if(!active||skillCooldown>0)return false;skillCooldown=14;shockLife=.6;shock.visible=true;shock.scale.setScalar(.1);shockMat.opacity=.8;for(const e of enemies)if(e.active)damageEnemy(e,(62+weaponLevel*6)*attackMultiplier);hp=Math.min(100,hp+4);coverHp=Math.min(maxCoverHp,coverHp+15);emit('battle:ultimate',{hp});burst(0,3,0xbff5ff,30);return true;}
 function simulate(dt,time){
  skillCooldown=Math.max(0,skillCooldown-dt);
  for(const unit of units){unit.shootClock=Math.max(0,unit.shootClock-dt);if(unit.reloadClock>0){unit.reloadClock=Math.max(0,unit.reloadClock-dt);if(unit.reloadClock===0){unit.ammo=unit.def.maxAmmo;emit('battle:ready',{operatorId:unit.id});}}else if(!trigger&&unit.ammo<unit.def.maxAmmo){unit.releaseClock+=dt;if(unit.releaseClock>.25)reloadUnit(unit);}}
  if(trigger)fireReady();syncHero();spawnClock-=dt;
  for(const rocket of rockets){if(!rocket.active)continue;rocket.age+=dt;const t=Math.min(1,rocket.age/rocket.duration);rocket.root.position.set(rocket.from.x+(rocket.to.x-rocket.from.x)*t,rocket.from.y+(rocket.to.y-rocket.from.y)*t,5.94);if(t>=1)explode(rocket);}
  for(const blast of explosions){if(blast.life<=0)continue;blast.life=Math.max(0,blast.life-dt);const t=1-blast.life/.55;blast.root.scale.setScalar(.08+blast.radius*Math.min(1,t*1.8));blast.material.opacity=(1-t)*.9;blast.root.visible=blast.life>0;}
  if(spawnClock<=0){if(enemies.filter(e=>e.active&&!e.elite).length<(elapsed>18?6:4))spawn();spawnClock=Math.max(1.4,2.4-elapsed*.018);}
  for(const e of enemies){
   if(!e.active)continue;e.age+=dt;e.flash=Math.max(0,e.flash-dt);
   e.root.position.x=e.baseX+Math.sin(e.age*(e.elite?(e.enraged?.84:.65):.9)+e.phase)*(e.elite?1.1:.22);
   e.root.position.y=e.baseY+Math.sin(time*2+e.phase)*.075;
   e.body.rotation.z=Math.sin(time*1.8+e.phase)*.045;e.body.scale.setScalar(e.flash>0?1.06:1);
   e.coreHalo.rotation.z+=dt*(e.enraged?5:1.4);e.coreHalo.material=e.flash>0?white:(e.elite?amber:red);
   e.engineGlow.scale.y=.07+Math.sin(time*13+e.phase)*.025;
   e.bar.scale.x=1.15*Math.max(0,e.hp/e.maxHp);e.bar.position.x=-(1.15-e.bar.scale.x)/2;
   e.fire-=dt;e.telegraph.visible=e.charge.visible=e.fire<1.05;
   if(e.telegraph.visible){
    const charge=1-clamp(e.fire/1.05,0,1);
    e.telegraph.scale.setScalar(1.18-charge*.4);e.telegraph.rotation.z=Math.sin(time*11)*.025;
    e.charge.scale.setScalar(.07+charge*.19);e.charge.rotation.z=-time*3;
   }
   if(e.fire<=0){hostileAttack(e);e.fire=e.elite?(e.enraged?1.9:2.5):3.8+(e.phase%1);if(!active)return;}
  }
  for(const l of lines){l.life=Math.max(0,l.life-dt);l.root.visible=l.life>0;}for(const unit of units){unit.muzzleLife=Math.max(0,unit.muzzleLife-dt);weaponMuzzles.get(unit.id).visible=unit.muzzleLife>0;}
  if(shockLife>0){shockLife-=dt;shock.scale.setScalar((.6-shockLife)*18+.1);shockMat.opacity=Math.max(0,shockLife);shock.visible=shockLife>0;}
  hitConfirmLife=Math.max(0,hitConfirmLife-dt);hitMarker.visible=hitConfirmLife>0;
  hitMarker.scale.setScalar(1+Math.max(0,hitConfirmLife-.15)*2);reticle.rotation.z=0;
 }
 function update(dt,time=0){
  if(!active)return;dt=Number.isFinite(dt)?Math.max(0,dt):0;elapsed+=dt;
  // Wall-clock deadline precedes bounded simulation, including after hidden tabs.
  if(elapsed>=duration){elapsed=duration;finish();return;}
  if(phase===0&&elapsed>=10){phase=1;stage='WAVE 02';emit('battle:stage',{text:'敌方增援 · 红圈即将开火，松手进入掩体'});}if(phase<2&&elapsed>=19){phase=2;stage='WAVE 03';emit('battle:stage',{text:'交叉火力 · 瞄准发光核心造成弱点伤害'});}if(!eliteSpawned&&elapsed>=23){eliteSpawned=true;spawn(true);stage='ELITE · 赤曜执法者';emit('battle:stage',{text:'警告 · 赤曜执法者接近'});effects.shake?.(.25);}if(phase<3&&duration-elapsed<=6){phase=3;emit('battle:stage',{text:'能量将尽 · 把握最后一轮射击'});}
  const simulated=Math.min(dt,.25),skipped=dt-simulated;skillCooldown=Math.max(0,skillCooldown-skipped);for(const unit of units){unit.shootClock=Math.max(0,unit.shootClock-skipped);if(unit.reloadClock>0){unit.reloadClock=Math.max(0,unit.reloadClock-skipped);if(!unit.reloadClock)unit.ammo=unit.def.maxAmmo;}}let left=simulated;while(left>0&&active){const step=Math.min(left,1/60);simulate(step,time-left);left-=step;}
 }
 function stop(){active=false;trigger=false;clear();syncHero();}
 function getState(){const boss=enemies.find(e=>e.elite&&e.active),controlled=unitSnapshot(primary());return{hp,maxHp:100,remaining:Math.max(0,duration-elapsed),kills,cores,blueprints,skillCooldown,eliteHp:boss?.hp||0,eliteMaxHp:boss?.maxHp||0,elitePhase:boss?(boss.enraged?'overload':'guard'):null,active,stage,eliteKilled,elapsed,enemyCount:enemies.filter(e=>e.active).length,projectileCount:lines.filter(l=>l.life>0).length+rockets.filter(r=>r.active).length,rocketCount:rockets.filter(r=>r.active).length,explosionCount:explosions.filter(e=>e.life>0).length,ammo:controlled.ammo,maxAmmo:controlled.maxAmmo,reloading:controlled.reloading,reloadProgress:controlled.reloadProgress,reloadDuration:controlled.reloadDuration,coverHp,maxCoverHp,coverReduction,exposed:controlled.exposed,teamExposed:active&&teamExposed(),aimX,aimY,shots:shotCount,activeShots:controlled.shots,hits:hitCount,weakpointHits,hitConfirmed:hitConfirmLife>0,hitConfirmRemaining:hitConfirmLife,lastHitWeak,lastShotHit,accuracy:shotCount?Math.round(hitCount/shotCount*100):0,activeOperatorId,squad:units.map(unitSnapshot),targets:enemies.filter(e=>e.active).map(e=>({x:e.root.position.x,y:e.root.position.y,weakY:e.root.position.y+.16*(e.elite?1.6:1),hp:e.hp,elite:e.elite,enraged:e.enraged,attackIn:e.fire,charging:e.fire<1.05}))};}
 function dispose(){stop();layer.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
 return{start,update,aim,setTrigger,reload,selectOperator,ultimate,stop,getState,dispose};
}
