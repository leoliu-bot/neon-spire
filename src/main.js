import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createWorld} from './world.js';
import {Economy,EventBus,BALANCE,ROOM_DEFS} from './economy.js';
import {createPusher} from './pusher.js';
import {createBattle} from './battle.js';
import {createAudio} from './audio.js';
import {createElevatorTransition} from './elevator-transition.js';
import {createSquadUI} from './squad-ui.js';
import {operatorById} from './operators.js';
import {FLOOR_Y} from './constants.js';
import cityArtworkUrl from './assets/city.png';
import operatorArtworkUrl from './assets/operator.png';
import './style.css';
import './squad.css';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const game=$('#game'), viewport=$('#viewport');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), lerp=(a,b,t)=>a+(b-a)*t;
const FLOOR_INFO=[{title:'零号基地',en:'THE WORKSHOP',sub:'让每一道微光，成为下一次出发的能量。',color:0x101b22},{title:'晶核转化',en:'CORE REFINERY',sub:'战场晶核，转为基地建设资金。',color:0x101a1e},{title:'天际防线',en:'THE BREACH',sub:'长夜之上，守住最后一道霓虹。',color:0x081c23}];
const bus=new EventBus(), economy=new Economy(bus), audio=createAudio();
let muted=false, quality='high';
try{muted=localStorage.getItem('neon-spire.muted')==='true';quality=localStorage.getItem('neon-spire.quality')||'high';}catch{}
audio.setMuted(muted);
const state={floor:0,mode:'IDLE',modeClock:0,scrollY:0,targetY:0,cabinY:0,run:null,result:null,travel:null,visitMint:false};
let renderer,world,composer,pusher,battle,elevator,squadUI;
let width=1,height=1,time=0,last=performance.now(),uiClock=0,flashValue=0,shakeValue=0,dropLane=0,holdTimer=null,holdActive=false,holdSuppressClick=false;
const keys=new Set(), moveInput={x:0,z:0}, cameras=[], ambient=[], pools=[];
let shaftCamera;
let modalView=null;
let touch=null;
const cameraCenters=[1.85,1.2,1.8];
const artStatus={city:false,operator:false};

function toast(text,type='info',duration=2600){
 if(!text)return;
 const stack=$('#toast-stack');
 if(stack.children.length>=3)stack.firstChild.remove();
 const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=text;stack.append(el);
 setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),250);},duration);
}
function sound(name){try{audio.play(name);}catch{}}
function unlock(){try{audio.unlock();}catch{}}
document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
function shake(strength=.4){shakeValue=Math.max(shakeValue,strength);game.classList.remove('shake');void game.offsetWidth;game.classList.add('shake');}
function flash(color='#eeffdf',value=.7){$('#flash').style.background=typeof color==='number'?`#${color.toString(16).padStart(6,'0')}`:color;flashValue=value;}
function announce(text){const el=$('#stage-announcement');el.textContent=text;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function floatText(text,x,y,color='#dfffaa',kind=''){const layer=$('#float-layer');if(layer.children.length>28)layer.firstChild.remove();const el=document.createElement('span');el.className=`float-number ${kind}`;el.style.cssText=`left:${x}px;top:${y}px;color:${color}`;el.textContent=text;layer.append(el);setTimeout(()=>el.remove(),kind==='combat'?700:950);}
let combatFloatIndex=0;
function worldFloat(text,x,y,color='#dfffaa'){if(state.floor!==2)return;const v=world.floors[2].localToWorld(new THREE.Vector3(x,y+.4,0)).project(cameras[2]);floatText(text,(v.x*.5+.5)*width+[-16,16,0][combatFloatIndex++%3],(-v.y*.5+.5)*height,color,'combat');}

function createParticlePool(scene){
 const cap=260,mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.12,0),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}),cap);
 mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;scene.add(mesh);
 const items=[],dummy=new THREE.Object3D(),color=new THREE.Color();
 return {burst(x,y,z,tint,count=16){for(let i=0;i<Math.min(count,cap-items.length);i++)items.push({x,y,z,vx:(Math.random()-.5)*6,vy:Math.random()*5+1,vz:(Math.random()-.5)*6,life:.5+Math.random()*.6,max:1,color:tint,size:.4+Math.random()});},update(dt){for(let i=items.length-1;i>=0;i--){const p=items[i];p.life-=dt;if(p.life<=0){items.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=6*dt;}mesh.count=items.length;for(let i=0;i<items.length;i++){const p=items[i];dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(time*3+i,time+i,0);dummy.scale.setScalar(p.size*Math.min(1,p.life*3));dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);color.set(p.color||0xb8f97e);mesh.setColorAt(i,color);}mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}};
}
const effects={burst(x,y,z,color,count){const f=clamp(Math.round(y/12),0,2);pools[f]?.burst(x,y,z,color,count);},shake,flash};

class SceneStackPass extends Pass{
 constructor(){super();this.needsSwap=false;}
 render(r,writeBuffer,readBuffer){
  r.setRenderTarget(this.renderToScreen?null:readBuffer);r.autoClear=false;
  r.setClearColor(FLOOR_INFO[state.floor].color,1);r.clear(true,true,true);
  r.render(world.scenes[state.floor],cameras[state.floor]);

 }
}
function init(){
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.autoClear=false;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
 renderer.info.autoReset=false;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;viewport.append(renderer.domElement);
 world=createWorld(THREE);if(world.scenes.length!==3||!world.shaftScene.isScene)throw new Error('Four independent scenes are required');
 new THREE.TextureLoader().load(cityArtworkUrl,t=>{t.colorSpace=THREE.SRGBColorSpace;world.battleScene.setArtwork({backgroundTexture:t});artStatus.city=true;});
 new THREE.TextureLoader().load(operatorArtworkUrl,t=>{
  t.colorSpace=THREE.SRGBColorSpace;world.battleScene.setArtwork({operatorTexture:t});
  artStatus.operator=true;

 });
 world.scenes.forEach((scene,i)=>{scene.background=null;scene.fog=new THREE.FogExp2(FLOOR_INFO[i].color,i===2?.014:.009);pools.push(createParticlePool(scene));const points=[];for(let j=0;j<100;j++)points.push((Math.random()-.5)*21,FLOOR_Y[i]+Math.random()*12,(Math.random()-.5)*18);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));const stars=new THREE.Points(geo,new THREE.PointsMaterial({color:[0xffd392,0xb4cbc6,0x82dfd9][i],size:.025,transparent:true,opacity:.6,depthWrite:false}));scene.add(stars);ambient.push(stars);});
 world.shaftScene.background=null;
 elevator=createElevatorTransition({container:game});
 // Front elevation: parallel projection, no yaw, pitch or perspective convergence.
 cameras.push(...[0,1,2].map(()=>new THREE.OrthographicCamera(-6.3,6.3,11,-11,.1,180)));
 shaftCamera=new THREE.PerspectiveCamera(45,1,.1,150);shaftCamera.position.set(0,12.5,68);shaftCamera.lookAt(0,12.5,-3.8);
 composer=new EffectComposer(renderer);composer.addPass(new SceneStackPass());
 const bloom=new UnrealBloomPass(new THREE.Vector2(500,850),.30,.55,1.10);composer.addPass(bloom);composer.addPass(new OutputPass());
 pusher=createPusher({THREE,group:world.floors[1],economy,bus});
 battle=createBattle({THREE,group:world.floors[2],hero:world.heroBattle,economy,bus,effects:{...effects,burst:(...args)=>pools[2].burst(...args)}});
 squadUI=createSquadUI({economy,battle,openModal,toast});
 const resize=()=>{const rect=game.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=quality==='high'?Math.min(window.devicePixelRatio||1,1.6):1;renderer.setPixelRatio(dpr);renderer.setSize(width,height);composer.setPixelRatio(dpr);composer.setSize(width,height);cameras.forEach((c,i)=>{const limits=[[-3.1,8.45],[-5.1,8.25],[-4.2,7.1]][i],top=height<760?[169,185,168][i]:[235,250,205][i],bottom=height-(height<760?[182,230,175]:[206,230,192])[i],scale=Math.min(width/12.8,(bottom-top)/(limits[1]-limits[0]));const halfWidth=width/(2*scale);cameraCenters[i]=(limits[0]+limits[1])/2+((top+bottom)/2-height/2)/scale;c.left=-halfWidth;c.right=halfWidth;c.top=halfWidth*height/width;c.bottom=-c.top;c.updateProjectionMatrix();});shaftCamera.aspect=width/height;shaftCamera.position.z=68*Math.max(1,820/height);shaftCamera.lookAt(0,12.5,-3.8);shaftCamera.setViewOffset(width,height,-width*.386,Math.max(0,820-height)*.2,width,height);shaftCamera.updateProjectionMatrix();shaftCamera.updateMatrixWorld();
renderer.shadowMap.enabled=quality==='high';bloom.enabled=quality==='high';};
 window.addEventListener('resize',resize);window.__resizeGame=resize;resize();setFloor(economy.state.hopperRemaining>0?1:0,true);bindEvents();if(state.floor===1)pusher.revealHopper();updateUI();
 $('#loading').style.transition='opacity .55s';$('#loading').style.opacity='0';setTimeout(()=>$('#loading').remove(),600);
 requestAnimationFrame(frame);
}
function locked(){return ['TRAVEL','RESULT'].includes(state.mode);}
function mode(value){state.mode=value;state.modeClock=0;game.classList.toggle('traveling',value==='TRAVEL');game.classList.toggle('in-battle',value==='BATTLE'&&state.floor===2);$('#bottom-hud').hidden=locked();$('#hero-tag').hidden=true;$$('button[data-floor]').forEach(b=>b.disabled=locked()||value==='BATTLE');}
function setFloor(index,instant=false){
 const next=clamp(index,0,2);
 if(!instant){if(locked()||state.mode==='BATTLE'||next===state.floor)return;travelTo(next,'browse');return;}
 battle?.setTrigger(false);state.floor=next;state.targetY=FLOOR_Y[next];state.scrollY=state.targetY;state.cabinY=state.targetY;
 if(next===1)state.visitMint=true;
 world.setFloor?.(next);game.dataset.floor=next;game.classList.toggle('in-battle',state.mode==='BATTLE'&&next===2);
 const info=FLOOR_INFO[next];$('#floor-number').textContent=`0${next+1}`;$('#floor-english').textContent=info.en;$('#floor-title').textContent=info.title;$('#floor-subtitle').textContent=info.sub;
 $$('button[data-floor]').forEach(b=>b.classList.toggle('active',Number(b.dataset.floor)===next));
 $('#warehouse-controls').hidden=next!==0;$('#pusher-controls').hidden=next!==1;$('#battle-idle-controls').hidden=next!==2||state.mode==='BATTLE';$('#battle-controls').hidden=next!==2||state.mode!=='BATTLE';$('#battle-hud').hidden=next!==2||state.mode!=='BATTLE';$('#hero-tag').hidden=true;
 const side=[['每一次出发，<br>都带回一点光。','基地漏斗承接转化所得金币。招募不同武器的驾驶员，最多三人编队出击；红点提示可建设或招募。'],['让等待，<br>也有回响。','上两层横移的 ×5 / ×10 放大器将晶核变为 5 / 10 枚金币，未命中得到 1 枚。金币进入底层推币台，落袋每枚入账 1 合金币。'],['灯光之外，<br>还有新的黎明。','点击头像或 1 / 2 / 3 切换主控。按住瞄准，全队协同射击；松手隐蔽，各自换弹。战后晶核直接送往转化层。']][next];
 $('#side-title').innerHTML=side[0];$('#side-description').textContent=side[1];$('.section-index>span').textContent=`0${next+1} / 03`;
}
function travelTo(next,purpose='browse'){
 if(elevator.getState().active)return false;
 const from=state.floor;closeModal();cancelGameplayInput();
 state.travel={from,to:next,purpose};mode('TRAVEL');world.setDoor?.(false);sound('elevator');
 return elevator.start({from,to:next,onCovered(){setFloor(next,true);},onComplete(){
  state.travel=null;mode('IDLE');setFloor(next,true);world.setDoor?.(true);sound('arrive');
  if(purpose==='battle')beginBattle();
  else if(purpose==='delivery'){pusher.revealHopper();toast('10 枚战斗晶核已送达 · 等待漏斗装载','success');}
  economy.save();updateUI();
 }});
}
function openModal(html){modalView=null;battle?.setTrigger(false);$('#modal-content').innerHTML=html;$('#modal-backdrop').hidden=false;$('#modal-close').focus();}
function closeModal(){modalView=null;if(state.mode==='CALL'){mode('IDLE');world.setDoor?.(false);}$('#modal-backdrop').hidden=true;}
function callElevator(){
 if(locked()||state.mode==='BATTLE')return;
 if(state.floor!==0){setFloor(0);return;}
 const s=economy.state;
 if(s.hopperRemaining>0){setFloor(1);toast('请先投完漏斗中剩余的晶核');return;}
 if(s.repairRemaining>0){showWorkshop();toast(`火花正在修复 · 还需 ${Math.ceil(s.repairRemaining)} 秒`,'warning');return;}
 if(s.energy<2){world.setDoor?.(false);toast('能量不足 · 基地正在自动充能，稍后再出击','warning');flash('#ff8777',.2);return;}
 if(!s.squad.length){squadUI.showRoster(0);toast('先选择至少一名驾驶员');return;}
 mode('CALL');world.setDoor?.(true);sound('door');
 const charge=Math.min(BALANCE.battleSeconds,Math.max(0,s.energy-1));
 openModal(`<p class="modal-eyebrow">SQUAD · ${s.squad.length} OPERATORS READY</p><h2 class="modal-title">下一站，天际。</h2>${squadUI.missionMarkup(s.squad)}<p class="modal-description">${s.squad.map(id=>operatorById(id).name).join('、')}已就位。电梯直达防线，战后将 10 枚晶核送往转化层。</p><div class="mission-preview"><div class="preview-row"><span>本次装载</span><b>${Math.ceil(charge)+1} 能量</b></div><div class="preview-row"><span>战斗时限</span><b>${Math.ceil(charge)} 秒</b></div><div class="preview-row"><span>全队装备</span><b>LV.${String(s.weaponLevel).padStart(2,'0')}</b></div><div class="preview-row"><span>基地增益</span><b>攻击 ×${s.attackMultiplier.toFixed(2)} · 护甲 ×${s.defenseMultiplier.toFixed(2)}</b></div></div><button id="launch-button" class="primary-button"><span class="button-icon">↟</span><span>小队出击<small>装载能量 · 升降舱上行</small></span><span class="button-end">→</span></button><p class="modal-footnote">点击战斗头像或 1 / 2 / 3 切换主控 · 本局固定 10 晶核</p>`);
 $('#launch-button').onclick=launch;
}
function launch(){
 if(state.mode!=='CALL')return;
 const result=economy.dispatch('LAUNCH');if(!result.ok){closeModal();return;}
 state.run=result;state.result=null;$('#modal-backdrop').hidden=true;sound('launch');travelTo(2,'battle');
}

function beginBattle(){
 mode('BATTLE');setFloor(2,true);world.setDoor?.(true);
 battle.start({duration:state.run?.battleEnergy||0,weaponLevel:economy.state.weaponLevel,hp:economy.state.hp,squad:state.run?.squad||economy.state.squad});
 flash('#e6ffe5',.75);announce('按住瞄准射击 · 松手回掩体');sound('arrive');
}
function endBattle(result){
 if(state.mode!=='BATTLE')return;
 cancelGameplayInput();
 closeModal();const settled=economy.dispatch('BATTLE_END',{...result,runId:state.run?.runId});
 state.result={...result,cores:settled.cores??result.cores,blueprints:settled.blueprints??result.blueprints};state.floor=2;state.scrollY=24;state.cabinY=24;mode('RESULT');setFloor(2,true);
 $('#battle-hud').hidden=true;$('#result-overlay').hidden=false;$('#result-count').textContent='0';$('#result-title').textContent=result.hp<=0?'带着微光归来':'满载而归';$('#result-kills').textContent=result.kills||0;$('#result-blueprints').textContent=state.result.blueprints||0;
 $('#result-accuracy').textContent=`${result.accuracy||0}%`;
 flash('#fffbee',1);sound('result');shake(.8);
 for(let i=0;i<8;i++)effects.burst((Math.random()-.5)*8,28+Math.random()*4,Math.random()*5-2,0xfda9e2,25);
}
function returnElevator(){
 if(state.mode!=='RESULT')return;
 $('#result-overlay').hidden=true;travelTo(1,'delivery');
}
function showWorkshop(){
 if(locked()||state.mode==='BATTLE')return;closeModal();const s=economy.state;
 openModal(`<p class="modal-eyebrow">THE WORKSHOP · GROWTH</p><h2 class="modal-title">为下一次，更强。</h2><p class="modal-description">合金币来自熔金机台。投资生产与火力，让每次出击都更进一步。</p><div class="upgrade-card"><div class="upgrade-title">工坊产能<span>LV.${s.warehouseLevel} → ${Math.min(8,s.warehouseLevel+1)}</span></div><p>能量产速提升 22%<br>能量储存上限增加 12</p><button id="upgrade-warehouse" ${s.warehouseLevel>=8?'disabled':''}>${s.warehouseLevel>=8?'已达最高等级':`升级工坊 · ${s.upgradeWarehouseCost} 合金币`}</button></div><div class="upgrade-card"><div class="upgrade-title">双相脉冲<span>LV.${s.weaponLevel} → ${Math.min(8,s.weaponLevel+1)}</span></div><p>提升脉冲伤害与射击效率<br>精英机群掉落强化蓝图</p><button id="upgrade-weapon" ${s.weaponLevel>=8?'disabled':''}>${s.weaponLevel>=8?'已达最高等级':`强化武器 · ${s.upgradeWeaponCost} 合金币${s.upgradeBlueprintCost?` + ${s.upgradeBlueprintCost} 蓝图`:''}`}</button></div>${s.repairRemaining>0?`<div class="upgrade-card"><div class="upgrade-title">火花修复中<span>${Math.ceil(s.repairRemaining)} SEC</span></div><p>自动修复完成即可再次出击。</p><button id="repair-button">立即修复 · ${s.repairCost} 合金币</button></div>`:''}<p class="modal-footnote">持有 ${s.alloy} 合金币 · ${s.blueprints} 蓝图</p>`);
 $('#upgrade-warehouse').onclick=()=>{const r=economy.dispatch('UPGRADE_WAREHOUSE');if(r.ok){sound('upgrade');effects.burst(0,2,0,0xb8f97e,30);showWorkshop();}};
 $('#upgrade-weapon').onclick=()=>{if(economy.dispatch('UPGRADE_WEAPON').ok){sound('upgrade');showWorkshop();}};
 if($('#repair-button'))$('#repair-button').onclick=()=>{if(economy.dispatch('REPAIR').ok)showWorkshop();};
}
function showRooms(){
 if(locked()||state.mode==='BATTLE')return;
 const s=economy.state;
 openModal(`<p class="modal-eyebrow">OUTPOST / ROOM MANAGEMENT</p><h2 class="modal-title">让基地成为后盾。</h2><div class="base-bonuses"><span>攻击 <b>×${s.attackMultiplier.toFixed(2)}</b></span><span>护甲 <b>×${s.defenseMultiplier.toFixed(2)}</b></span><span>铸币 <b>${(s.coinProduction*60).toFixed(1)}/分</b></span></div><div class="room-list">${s.roomStats.map(r=>`<button class="room-card ${r.unlocked?'built':'locked-room'}" data-room="${r.id}" style="--room-color:${r.color}"><span class="room-icon">${r.icon}</span><span class="room-card-copy"><b>${r.name}</b><small>${r.effect}</small><span class="room-level-track" aria-label="等级 ${r.level} / ${r.maxLevel}"><i style="width:${r.level/r.maxLevel*100}%"></i></span></span><i class="room-notification" data-room-dot="${r.id}" ${r.canPurchase?'':'hidden'} aria-label="可购买"></i><em>${r.unlocked?`LV.${String(r.level).padStart(2,'0')} / ${r.maxLevel}`:`${r.cost} 金币`}<small data-room-status="${r.id}"></small></em></button>`).join('')}</div><button id="base-arsenal" class="secondary-button">装备强化与修复 →</button><p id="rooms-balance" class="modal-footnote">持有 ${s.alloy} 合金币 · 点击场景中的房间也可建设</p>`);
 modalView={type:'rooms'};updateRoomPanel(s);$('#workshop-button').classList.toggle('has-purchase',s.roomStats.some(r=>r.canPurchase));
 $$('[data-room]').forEach(b=>b.onclick=()=>showRoom(b.dataset.room));$('#base-arsenal').onclick=showWorkshop;
}
function roomBenefitRows(r){
 const next=Math.min(r.maxLevel,r.level+1),after=r.level>=r.maxLevel?r.level:next;
 const value=(level,step,initial=0,suffix='%',cap=Infinity)=>`${Math.min(cap,(Math.max(0,level-initial))*step).toFixed(suffix===' / 分'?1:0)}${suffix}`;
 const rows=r.id==='command'?[['攻击加成',6,1,'%']]:r.id==='energy'?[['基础产能加成',14,1,'%']]:r.id==='armory'?[['攻击加成',18,0,'%']]:r.id==='armor'?[['护甲系数加成',20,0,'%'],['掩体减伤加成（上限 24%）',6,0,'%',24]]:r.id==='mint'?[['金币产出',4.8,0,' / 分']]:[['小队攻击加成',2,0,'%']];
 return rows.map(([label,step,initial,suffix,cap])=>`<div><span>${label}</span><b>${value(r.level,step,initial,suffix,cap)}</b><i>→</i><strong>${value(after,step,initial,suffix,cap)}</strong></div>`).join('');
}
function updateRoomPanel(s){
 if(!modalView||$('#modal-backdrop').hidden)return;
 if(modalView.type==='room'){
  const r=s.roomStats.find(r=>r.id===modalView.id);if(!r)return;
  const cost=r.unlocked?r.upgradeCost:r.cost,capped=r.level>=r.maxLevel;
  $('#room-balance').textContent=s.alloy;$('#room-action').disabled=capped||s.alloy<cost;
  $('#room-shortfall').textContent=capped?'所有设施已强化至最高等级':s.alloy<cost?`还需 ${cost-s.alloy} 合金币 · 推币台金币落袋后获取`:`建设后剩余 ${s.alloy-cost} 合金币`;
 }else if(modalView.type==='rooms'){
  $('#rooms-balance').textContent=`持有 ${s.alloy} 合金币 · 点击房间查看收益与建设`;
  for(const r of s.roomStats){const dot=$(`[data-room-dot="${r.id}"]`);if(dot)dot.hidden=!r.canPurchase;const el=$(`[data-room-status="${r.id}"]`);if(el){el.textContent=r.level>=r.maxLevel?'最高等级':s.alloy>=(r.unlocked?r.upgradeCost:r.cost)?r.unlocked?'可升级':'可建设':r.unlocked?'运转中':'资金不足';el.classList.toggle('affordable',r.level<r.maxLevel&&s.alloy>=(r.unlocked?r.upgradeCost:r.cost));}}
 }
}
function showRoom(id){
 if(locked()||state.mode==='BATTLE')return;
 if(id==='reactor'){squadUI.showRecruitment();return;}
 const s=economy.state,r=s.roomStats.find(r=>r.id===id);if(!r)return;
 const cost=r.unlocked?r.upgradeCost:r.cost,capped=r.level>=r.maxLevel;
 openModal(`<p class="modal-eyebrow">${r.subtitle} / ${r.unlocked?'ONLINE':'CONSTRUCTION'}</p><h2 class="modal-title">${r.name}</h2><div class="room-inspector" style="--room-color:${r.color}"><strong>${r.icon}</strong><span>${r.unlocked?`等级 ${r.level} / ${r.maxLevel}`:'待建设区域'}</span></div><div class="room-benefits"><p>${capped?'当前房间收益':'本次建设收益 · 当前 → 完成后'}</p>${roomBenefitRows(r)}</div><p class="modal-description">${r.id==='mint'?'建成后持续产出金币，离线最多累计 15 分钟。':'战斗加成在下次出击时生效，生产设施立即投入运转。'}</p><div class="room-price"><span>持有合金币</span><b id="room-balance">${s.alloy}</b></div><button id="room-action" class="primary-button" ${capped||s.alloy<cost?'disabled':''}>${capped?'已达最高等级':`${r.unlocked?'升级房间':'建设房间'} · ${cost} 合金币`}</button><p id="room-shortfall" class="modal-footnote"></p><button id="room-back" class="secondary-button">← 返回基地总览</button>`);
 modalView={type:'room',id};updateRoomPanel(s);
 $('#room-action').onclick=()=>{const result=economy.dispatch(r.unlocked?'UPGRADE_ROOM':'UNLOCK_ROOM',{id});if(result.ok){sound('upgrade');flash(r.color,.12);closeModal();world.rooms.highlight?.(id);}};$('#room-back').onclick=showRooms;
}
function showHelp(){if(locked()||state.mode==='BATTLE')return;openModal('<p class="modal-eyebrow">AFTERHOURS FIELD GUIDE</p><h2 class="modal-title">向光而行。</h2><div class="guide-step"><span>01</span><div><b>基地准备</b><br>六个房间最高 20 级，铭牌显示等级；右上红点表示金币足够建造或升级。建设提高攻击、护甲和金币产出，招募中心可用金币招募火箭筒和加特林驾驶员。出击按钮上方设置最多三人编队，顶部漏斗实时显示金币余额。</div></div><div class="guide-step"><span>02</span><div><b>天际作战</b><br>按住目标瞄准射击，拖动准星；松手回掩体并自动换弹。点击头像或 1/2/3 切换主控，按住时其他队员协同射击。R 手动换弹，空格释放超载。每局最多 38 秒，结算固定获得 10 枚晶核。</div></div><div class="guide-step"><span>03</span><div><b>漏斗投币</b><br>战后电梯直接送来 10 枚晶核。瞄准上两层横移的 ×5、×10 放大器，首次命中生成 5 或 10 枚金币；未命中生成 1 枚，同一晶核不叠乘。金币落到底层实体推币台，每枚落入收集区后入账 1 合金币。漏斗用完后可返回基地。</div></div><div class="guide-step"><span>↟</span><div><b>楼层转运</b><br>待机时使用楼层按钮、上下滑动或方向键，每次切换都经过完整电梯过场。出击期间保持在战场。</div></div><p class="modal-footnote">未投完的晶核自动保存 · 先投完本轮再出击</p>');}

function showSettings(){if(locked()||state.mode==='BATTLE')return;openModal(`<p class="modal-eyebrow">CABINET SETTINGS</p><h2 class="modal-title">机台设置</h2><div class="settings-row"><span>街机音景与音效</span><button id="setting-sound">${muted?'已静音':'已开启'}</button></div><div class="settings-row"><span>画面品质</span><button id="setting-quality">${quality==='high'?'高 · 光晕与柔影':'流畅 · 基础光照'}</button></div><div class="settings-row"><span>沉浸游玩</span><button id="setting-fullscreen">全屏</button></div><div class="settings-row"><span>本地存档</span><button id="setting-reset" class="danger-button">重置进度</button></div><p class="modal-footnote">游戏支持触屏与键盘 · 无联网、无付费<br>离线积累最多计入 15 分钟</p>`);
 $('#setting-sound').onclick=()=>{toggleSound();showSettings();};$('#setting-quality').onclick=()=>{quality=quality==='high'?'low':'high';try{localStorage.setItem('neon-spire.quality',quality);}catch{}window.__resizeGame();showSettings();};$('#setting-fullscreen').onclick=async()=>{try{if(!document.fullscreenElement)await game.requestFullscreen();else await document.exitFullscreen();closeModal();}catch{toast('当前浏览器不支持全屏','warning');}};
 $('#setting-reset').onclick=()=>{openModal('<p class="modal-eyebrow">RESET LOCAL SAVE</p><h2 class="modal-title">重新点亮机台？</h2><p class="modal-description">将清除本机的资源、等级和出击记录。这个操作无法撤销。</p><button id="confirm-reset" class="primary-button">确认重置进度</button>');$('#confirm-reset').onclick=()=>{try{localStorage.removeItem(BALANCE.storageKey);}catch{}location.reload();};};
}
function toggleSound(){muted=!muted;audio.setMuted(muted);try{localStorage.setItem('neon-spire.muted',muted);}catch{}$('#sound-button').style.opacity=muted?'.4':'1';$('#sound-button').setAttribute('aria-label',muted?'开启声音':'静音');if(!muted){unlock();sound('ui');}}
function selectLane(x){dropLane=clamp(x,-2.8,2.8);pusher.setLane?.(dropLane);$$('[data-lane]').forEach(el=>el.classList.toggle('active',Math.abs(Number(el.dataset.lane)-dropLane)<.22));}
function insert(){if(state.mode!=='IDLE'||state.floor!==1||!$('#modal-backdrop').hidden||economy.state.hopperRemaining<=0||pusher.getStats().hopperLoading>0)return false;const result=pusher.insert(dropLane);if(result===false||result?.ok===false)return false;sound('coin');return true;}
function startHold(delay=370){if(holdActive||!insert())return;holdActive=true;holdSuppressClick=true;holdTimer=setTimeout(function repeat(){if(!holdActive)return;if(!insert()){stopHold();return;}holdTimer=setTimeout(repeat,230);},delay);}
function stopHold(){holdActive=false;clearTimeout(holdTimer);setTimeout(()=>holdSuppressClick=false,50);}
function cancelGameplayInput(){const pointerId=touch?.pointerId;touch=null;if(pointerId!==undefined&&viewport.hasPointerCapture(pointerId))viewport.releasePointerCapture(pointerId);stopHold();battle?.setTrigger(false);}
function useUltimate(){if(state.mode==='BATTLE'&&state.floor===2&&$('#modal-backdrop').hidden){if(battle.ultimate())sound('ultimate');}}
function bindEvents(){
 $$('button[data-floor]').forEach(b=>b.onclick=()=>setFloor(Number(b.dataset.floor)));
 $('#hero-tag').onclick=callElevator;$('#call-button').onclick=callElevator;$('#return-workshop').onclick=()=>setFloor(0);$('#workshop-button').onclick=showRooms;
 $('#mint-next-button').onclick=()=>setFloor(0);

 $('#help-button').onclick=showHelp;$('#settings-button').onclick=showSettings;$('#sound-button').onclick=toggleSound;
 $('#modal-close').onclick=closeModal;$('#modal-backdrop').onclick=e=>{if(e.target===$('#modal-backdrop'))closeModal();};$('#result-continue').onclick=returnElevator;
 $('#ultimate-button').onclick=useUltimate;
 $$('[data-lane]').forEach(b=>b.onclick=()=>{selectLane(Number(b.dataset.lane));sound('ui');});
 $('#insert-button').addEventListener('pointerdown',e=>{e.preventDefault();startHold();$('#insert-button').setPointerCapture(e.pointerId);});
 $('#insert-button').addEventListener('pointerup',stopHold);$('#insert-button').addEventListener('pointercancel',stopHold);$('#insert-button').onclick=()=>{if(!holdSuppressClick)insert();};
 window.addEventListener('pointerup',stopHold);window.addEventListener('blur',()=>{keys.clear();moveInput.x=moveInput.z=0;stopHold();});
 const aimRay=new THREE.Raycaster(),aimPlane=new THREE.Plane(new THREE.Vector3(0,0,1),0),aimPoint=new THREE.Vector3();
 function pointAt(e,pressed){const r=game.getBoundingClientRect();aimRay.setFromCamera(new THREE.Vector2((e.clientX-r.left)/width*2-1,-(e.clientY-r.top)/height*2+1),cameras[2]);if(aimRay.ray.intersectPlane(aimPlane,aimPoint)){world.floors[2].worldToLocal(aimPoint);battle.aim(aimPoint.x,aimPoint.y,pressed);}}
 function pointMint(e){const r=game.getBoundingClientRect();aimRay.setFromCamera(new THREE.Vector2((e.clientX-r.left)/width*2-1,-(e.clientY-r.top)/height*2+1),cameras[1]);if(aimRay.ray.intersectPlane(aimPlane,aimPoint)){world.floors[1].worldToLocal(aimPoint);selectLane(aimPoint.x);}}
 viewport.addEventListener('pointerdown',e=>{
  if(locked()||!$('#modal-backdrop').hidden||e.isPrimary===false||e.button!==0)return;const rect=game.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;touch={x,y,pointerId:e.pointerId,moved:false,gesture:null,floor:state.floor,battle:state.floor===2&&state.mode==='BATTLE'};viewport.setPointerCapture(e.pointerId);
  if(touch.battle){pointAt(e,true);return;}
  if(state.floor===1&&!locked()){pointMint(e);holdTimer=setTimeout(()=>{if(touch&&touch.floor===1&&touch.gesture!=='scroll')startHold(230);},400);}

 });
 viewport.addEventListener('pointermove',e=>{
  if(state.floor===2&&state.mode==='BATTLE'){pointAt(e,!!touch?.battle);return;}
  if(!touch)return;const rect=game.getBoundingClientRect(),dx=e.clientX-rect.left-touch.x,dy=e.clientY-rect.top-touch.y;
  if(Math.hypot(dx,dy)>12){touch.moved=true;if(!touch.gesture)touch.gesture=Math.abs(dy)>Math.abs(dx)?'scroll':'aim';}
  if(touch.floor===1&&state.floor===1&&!locked()){
   if(touch.gesture==='scroll'){stopHold();return;}pointMint(e);
  }else if(touch.moved)clearTimeout(holdTimer);
 });
 const pointerEnd=e=>{
  if(!touch)return;if(touch.battle){battle.setTrigger(false);touch=null;return;}
  clearTimeout(holdTimer);const rect=game.getBoundingClientRect(),dy=e.clientY-rect.top-touch.y,wasHold=holdActive;stopHold();
  if(state.floor!==touch.floor){touch=null;return;}
  if(!locked()&&touch.gesture!=='aim'&&Math.abs(dy)>55)setFloor(state.floor+(dy<0?1:-1));
  else if(state.floor===1&&!locked()&&touch.gesture!=='scroll'&&!wasHold){pointMint(e);insert();}
  else if(!touch.moved&&!wasHold&&!locked()){
   if(state.floor===0&&state.mode==='IDLE'){const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(touch.x/width*2-1,-touch.y/height*2+1),cameras[0]);const rooms=world.rooms.roomTargets;const hits=ray.intersectObjects(rooms.map(r=>r.object),true);if(hits.length){let o=hits[0].object;while(o&&!rooms.some(r=>r.object===o))o=o.parent;const selected=rooms.find(r=>r.object===o);if(selected)showRoom(selected.id);}}
  }touch=null;
 };
 viewport.addEventListener('pointerup',pointerEnd);viewport.addEventListener('pointercancel',()=>{touch=null;stopHold();battle.setTrigger(false);});window.addEventListener('pointerup',()=>battle.setTrigger(false));window.addEventListener('blur',()=>battle.setTrigger(false));
 $('#reload-button').onclick=()=>battle.reload();
 window.addEventListener('keydown',e=>{if(state.mode==='BATTLE'&&$('#modal-backdrop').hidden&&!e.repeat&&/^Digit[123]$/.test(e.code)){e.preventDefault();squadUI.select(Number(e.code.slice(-1))-1);}});
 window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','Space','KeyR'].includes(e.code)&&e.target.tagName!=='INPUT')e.preventDefault();if(e.target.tagName==='INPUT')return;if(e.code==='Escape'){closeModal();battle.setTrigger(false);return;}if(!$('#modal-backdrop').hidden||e.repeat)return;if(e.code==='ArrowUp')setFloor(state.floor+1);if(e.code==='ArrowDown')setFloor(state.floor-1);if(e.code==='Space')useUltimate();if(e.code==='KeyR'&&state.floor===2)battle.reload();});
 let lastWheel=0;viewport.addEventListener('wheel',e=>{e.preventDefault();if(performance.now()-lastWheel>600&&Math.abs(e.deltaY)>10){setFloor(state.floor+(e.deltaY<0?1:-1));lastWheel=performance.now();}},{passive:false});
 window.addEventListener('beforeunload',()=>economy.save());
 bus.on('battle:shot',v=>sound(`shot-${v.kind||'rifle'}`));bus.on('battle:explosion',()=>sound('rocket-explosion'));bus.on('battle:end',endBattle);bus.on('battle:hit',()=>{sound('hit');flash('#ff5488',.13);});bus.on('battle:kill',()=>sound('kill'));
 bus.on('battle:ultimate',()=>{flash('#b5ffd2',.5);shake(.7);sound('ultimate');});bus.on('battle:stage',v=>{announce(v.text||v);sound('wave');});bus.on('battle:feedback',v=>worldFloat(v.text,v.x,v.y??v.z,v.color));
 bus.on('feedback',v=>{
  const el=v.resource?$(`[data-resource="${v.resource}"]`):null;if(el){el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse');const r=el.getBoundingClientRect(),g=game.getBoundingClientRect();if(v.amount)floatText(`${v.amount>0?'+':''}${Math.round(v.amount)}`,r.left-g.left+r.width/2,r.top-g.top+35,({energy:'#b8f97e',cores:'#f5a5e0',alloy:'#ffcf77',blueprints:'#82cfff'})[v.resource]);}
  if(v.type==='spend'){shake(.16);sound('coin');}
  else if(v.type==='upgrade'){sound('upgrade');shake(.35);}
  else if(v.amount>0)sound('collect');
  if(v.type==='warning'||v.type==='upgrade'||!v.resource)toast(v.text,v.type);
 });
 bus.on('pusher:amplification',v=>{if(state.floor===1){toast(v.multiplier>1?`命中 ×${v.multiplier} · 生成 ${v.count} 枚金币`:'晶核转化 · 1 枚金币','success');sound('collect');}});
 bus.on('hopper:empty',()=>{stopHold();toast('本轮 10 枚晶核已投完 · 前往基地建设','success',4800);});
 bus.on('pusher:conversion',v=>{if(state.floor===1){sound('collect');if((v.count||1)>1)toast(`收集 ${v.count} 枚金币`);}});
}
function updateUI(){
 const s=economy.state;$('#energy-value').textContent=Math.floor(s.energy);$('#cores-value').textContent=s.cores;$('#alloy-value').textContent=s.alloy;$('#blueprints-value').textContent=s.blueprints;
 squadUI?.update(s,battle?.getState()||{},state.mode);
 updateRoomPanel(s);$('#workshop-button').classList.toggle('has-purchase',s.roomStats.some(r=>r.canPurchase));
 if(state.floor===0)$('#floor-subtitle').textContent=`攻击 ×${s.attackMultiplier.toFixed(2)} · 护甲 ×${s.defenseMultiplier.toFixed(2)} · 金币 ${(s.coinProduction*60).toFixed(1)}/分`;
 if(state.floor===1)$('#floor-subtitle').textContent=s.hopperRemaining>0?'瞄准移动放大器 · 晶核变成金币':'漏斗已空 · 金币继续推落';
 $('#warehouse-level').textContent=`${s.roomStats.filter(r=>r.unlocked).length} / 6 房间`;$('#production-speed').textContent=`+${s.production.toFixed(2)} 能量/秒 · +${s.coinProduction.toFixed(2)} 金币/秒`;
 $('#energy-rate').textContent=`+${s.production.toFixed(2)}/秒`;$('#gold-rate').textContent=`+${(s.coinProduction*60).toFixed(1)}/分`;

 $('#hero-status').textContent=s.repairRemaining>0?`伤重 · 修复 ${Math.ceil(s.repairRemaining)}s`:s.energy<2?'待机 · 等待充能':s.energy>=39?'满电 · 点击出击':'待机 · 短途出击';
 $('#call-button').disabled=state.mode==='BATTLE';$('#call-button').querySelector('span:nth-child(2)').innerHTML=s.repairRemaining>0?`机甲修复中<small>剩余 ${Math.ceil(s.repairRemaining)} 秒 · 点击查看</small>`:state.mode==='BATTLE'?'驾驶员出击中<small>前往 03 层查看战况</small>':s.hopperRemaining>0?`继续本轮投币<small>漏斗还剩 ${s.hopperRemaining} 枚晶核</small>`:`小队出击<small>${s.squad.length} 名驾驶员就位 · 固定 10 晶核</small>`;
 $('#insert-button').disabled=s.cores<=0||locked()||pusher.getStats().hopperLoading>0;$('#insert-button').hidden=s.hopperRemaining===0;$('#mint-next-button').hidden=s.hopperRemaining>0;$('#mint-next-title').textContent=s.runs>0?'前往基地建设':'返回基地准备出击';$('#mint-next-note').textContent=s.runs>0?'本轮晶核已投完 · 落币继续结算':'完成战斗后获得 10 枚晶核';$('#hopper-count').textContent=`漏斗 ${s.hopperRemaining} / 10`;$('#insert-button small').textContent=pusher.getStats().hopperLoading>0?'战利品装载中…':`长按连续投放 · 剩余 ${s.hopperRemaining} 枚`;$('#sound-button').style.opacity=muted?'.4':'1';
 $('#objective').textContent=s.runs===0?'完成首次出击':!state.visitMint?'前往熔金层投币':s.warehouseLevel===1?'建设或升级基地房间':s.weaponLevel===1?'强化双相脉冲':`完成第 ${s.runs+1} 次远征`;
 const activeDef=operatorById(state.mode==='BATTLE'?battle.getState().activeOperatorId:s.squad[0]);$('#weapon-label').textContent=`${activeDef?.weapon||'尚未编队'} · LV.${s.weaponLevel}`;$('#crew-label').textContent=s.squad.length?s.squad.map(id=>operatorById(id).name).join(' / '):'等待编组';
 if(pusher){const p=pusher.getStats();$('#pusher-count').textContent=`${p.count??0} / ${p.capacity??240}`;$('#pusher-cycle').textContent=`本次铸金 ${p.earnedAlloy??0}`;
  (p.amplifiers||[]).forEach((amp,i)=>{const el=$(`[data-amplifier="${i}"]`);if(el){el.querySelector('b').textContent=`命中 ${amp.hits??0}`;el.querySelector('i').style.left=`${clamp((amp.x+2.8)/5.6,0,1)*100}%`;}});$('#mint-status').textContent=p.coresInFlight>0?`${p.coresInFlight} 枚晶核下落中`:p.pendingCoins>0?`${p.pendingCoins} 枚金币等待入台`:`已生成 ${p.mintedCoins??0} 枚金币`;
  (p.stages||[]).forEach((stage,i)=>{const el=$(`[data-stage="${i}"]`);if(!el)return;el.querySelector('b').textContent=`${stage.count} 枚 · ${stage.advancing?'推进':'回程'}`;el.querySelector('i').style.width=`${clamp(stage.progress,0,1)*100}%`;el.classList.toggle('advancing',stage.advancing);});
 }
 if(battle&&state.mode==='BATTLE'){
  const cover=battle.getState();$('#cover-status').textContent=cover.reloading?(cover.teamExposed?'主控换弹 · 队友仍在开火':'换弹中 · 全队隐蔽'):cover.teamExposed?'小队射击 · 松手进入掩体':'全队掩体保护';$('#cover-status').classList.toggle('exposed',!!cover.teamExposed);$('#ammo-value').innerHTML=`${cover.ammo??0}<span>/${cover.maxAmmo??24}</span>`;$('#cover-fill').style.width=`${clamp((cover.coverHp??100)/(cover.maxCoverHp||100)*100,0,100)}%`;$('#cover-value').textContent=`COVER ${Math.ceil(cover.coverHp??100)}`;$('#reload-button').disabled=!!cover.reloading;$('#reload-button').innerHTML=cover.reloading?'换弹中':`换弹 <small>R</small>`;
  const b=battle.getState();const seconds=Math.ceil(Math.max(0,b.remaining));$('#battle-timer').textContent=`00:${String(seconds).padStart(2,'0')}`;$('#battle-kills').textContent=b.kills;$('#time-fill').style.width=`${clamp(b.remaining/(state.run?.battleEnergy||38)*100,0,100)}%`;$('#hp-fill').style.width=`${b.hp}%`;$('#hp-value').textContent=Math.ceil(b.hp);$('#battle-stage').textContent=b.stage||'WAVE 01';$('#elite-bar').hidden=!(b.eliteHp>0);$('#elite-bar>span').textContent=`◆ 赤曜执法者 · ${b.elitePhase==='overload'?'过载连射':'装甲警戒'}`;$('#elite-fill').style.width=`${b.eliteMaxHp?b.eliteHp/b.eliteMaxHp*100:0}%`;$('#ultimate-button').disabled=b.skillCooldown>.05;$('#skill-label').textContent=b.skillCooldown>0?'脉冲充能':'超载脉冲';$('#skill-cooldown').textContent=b.skillCooldown>0?`${Math.ceil(b.skillCooldown)} 秒`:'SPACE · 就绪';
 }
}
function updateTransition(dt){
 state.modeClock+=dt;elevator?.update(dt);
 if(state.mode==='RESULT'){
  $('#result-count').textContent=Math.round((state.result?.cores||0)*Math.min(1,state.modeClock/.8));
  $('#result-continue').innerHTML=`前往推币机 <span>${Math.max(0,Math.ceil(3-state.modeClock))}s ↓</span>`;
  if(state.modeClock>=3)returnElevator();
 }
}
function updateCameras(){
 const centers=cameraCenters;
 for(let i=0;i<3;i++){
  const sx=(Math.random()-.5)*shakeValue*.055,sy=(Math.random()-.5)*shakeValue*.055,y=centers[i]+state.scrollY+sy;
  cameras[i].position.set(sx,y,50);cameras[i].lookAt(sx,y,0);
 }
}
function frame(now){
 const rawDelta=Math.max(0,(now-last)/1000);window.__frameDelta=rawDelta;last=now;const dt=Math.min(rawDelta,.1);time+=dt;
 const battleWasRunning=state.mode==='BATTLE';
 economy.tick(Math.min(rawDelta,10));updateTransition(dt);updateCameras();
 pusher.update(dt,time);
 if(state.mode==='BATTLE'){
  // Include elapsed background time; navigation and tab hiding cannot freeze the run.
  battle.update(battleWasRunning?Math.min(rawDelta,60):0,time);
 }
 world.setCabinY?.(state.cabinY);world.update(dt,time,{...state,level:economy.state.warehouseLevel,production:economy.state.production,hp:economy.state.hp,economy:economy.state,battle:battle?.getState(),pusher:pusher?.getStats()});
 pools.forEach(p=>p.update(dt));ambient.forEach((a,i)=>a.rotation.y=Math.sin(time*.04+i)*.05);
 if(!$('#hero-tag').hidden){const p=new THREE.Vector3();world.hero.getWorldPosition(p);p.y+=2.75;p.project(cameras[0]);$('#hero-tag').style.left=`${(p.x*.5+.5)*width}px`;$('#hero-tag').style.top=`${(-p.y*.5+.5)*height}px`;}
 flashValue=Math.max(0,flashValue-dt*2.2);$('#flash').style.opacity=flashValue;shakeValue=Math.max(0,shakeValue-dt*3);
 audio.update?.(dt,state.mode);renderer.info.reset();composer.render(dt);uiClock+=dt;if(uiClock>.1){updateUI();uiClock=0;}
 requestAnimationFrame(frame);
}
try{init();}catch(error){console.error(error);$('#loading').innerHTML='<span class="loading-mark">!</span><h2>机台启动未完成</h2><p>请使用支持 WebGL 2 的 Chrome 或 Edge 浏览器。</p><p id="boot-error"></p>';$('#boot-error').textContent=error.message;}

// Read-only diagnostics for QA: no resource mutation or animation shortcuts.
function viewSnapshot(){
 const h=world?.heroBattle;if(!h)return null;
 const point=h.getWorldPosition(new THREE.Vector3()).project(cameras[2]);
 const targets=(battle?.getState().targets||[]).map(t=>{const v=world.floors[2].localToWorld(new THREE.Vector3(t.x,t.weakY,0)).project(cameras[2]);return{...t,screenX:(v.x*.5+.5)*width,screenY:(-v.y*.5+.5)*height};});
 const rooms=world.rooms.roomTargets.map(r=>{const v=r.object.getWorldPosition(new THREE.Vector3()).project(cameras[0]);return{id:r.id,visual:world.rooms.getRoomState?.(r.id)||null,screenX:(v.x*.5+.5)*width,screenY:(-v.y*.5+.5)*height};});
 return {mode:'front',art:{...artStatus},targets,rooms,baseHopper:world.rooms.getHopperState?.()||null,projection:cameras.map((c,i)=>({scale:width/(c.right-c.left),centerY:cameraCenters[i]})),cameras:cameras.map(c=>({projection:c.type,direction:c.getWorldDirection(new THREE.Vector3()).toArray()})),hero:{motion:world.battleScene.getMotionState?.()||h.userData.motion||null,x:h.position.x,z:h.position.z,screenX:(point.x*.5+.5)*width,screenY:(-point.y*.5+.5)*height}};
}
window.__NEON_SPIRE__=Object.freeze({snapshot:()=>({mode:state.mode,transition:elevator?.getState(),travel:state.travel,floor:state.floor,scrollY:state.scrollY,cabinY:state.cabinY,economy:economy.state,battle:battle?.getState(),pusher:pusher?.getStats(),view:viewSnapshot(),sceneCount:world?world.scenes.length+1:0,sceneIds:world?[...world.scenes,world.shaftScene].map(s=>s.uuid):[],drawCalls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,fps:Math.round(1/Math.max(.001,window.__frameDelta||.016))}),version:'5.0.0'});








