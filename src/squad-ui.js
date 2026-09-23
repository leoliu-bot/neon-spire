import { OPERATOR_DEFS,operatorById } from './operators.js';
import sparkPortrait from './assets/portrait-spark-v5.png';
import emberPortrait from './assets/portrait-ember-v5.png';
import voltPortrait from './assets/portrait-volt-v5.png';

const portraits={spark:sparkPortrait,ember:emberPortrait,volt:voltPortrait};
const $=s=>document.querySelector(s);
const portrait=id=>`<img src="${portraits[id]}" alt="${operatorById(id).name}" draggable="false">`;
export function createSquadUI({economy,battle,openModal,toast}){
 let baseKey='',battleKey='';
 const slotsMarkup=(ids,combat=false)=>Array.from({length:3},(_,index)=>{const id=ids[index],def=operatorById(id);return `<button class="squad-slot ${def?'occupied':'empty'}" ${combat?'data-battle-slot':'data-squad-slot'}="${index}" ${combat&&!def?'disabled':''} ${def?`data-operator="${id}" style="--operator-color:${def.color}"`:''} aria-label="${combat?'主控':'编队槽位'} ${index+1}${def?' '+def.name:' 空位'}">${def?`${portrait(id)}<span><b>${def.name}</b><small data-slot-status>${def.role}</small></span>`:`<i>+</i><span><b>空位 ${index+1}</b><small>选择驾驶员</small></span>`}<em>${index+1}</em>${combat&&def?'<div class="squad-ammo"><i></i></div>':''}</button>`;}).join('');
 function showRoster(slot=0){
  const s=economy.state;
  openModal(`<div class="roster-view" data-slot="${slot}"><p class="modal-eyebrow">SQUAD / SLOT 0${slot+1}</p><h2 class="modal-title">编组出击小队</h2><p class="modal-description">最多上阵三名。战斗中点击头像切换主控；按住瞄准时协同射击，松手一起回到掩体。</p><div class="roster-list">${s.operatorStats.map(def=>`<button class="roster-pick ${def.owned?'owned':'not-owned'}" data-roster-id="${def.id}" style="--operator-color:${def.color}">${portrait(def.id)}<span><small>${def.codename} / ${def.role}</small><b>${def.name}</b><span>${def.weapon} · ${def.maxAmmo} 发</span></span><em>${def.owned?s.squad[slot]===def.id?'当前槽位':def.assigned?'移至此位':'上阵':'前往招募 →'}</em></button>`).join('')}</div>${s.squad[slot]?'<button id="remove-squad-slot" class="secondary-button">将当前槽位留空</button>':''}<p class="modal-footnote">当前上阵 ${s.squad.length} / 3 · 编队自动保存</p></div>`);
  document.querySelectorAll('[data-roster-id]').forEach(button=>button.onclick=()=>{
   const id=button.dataset.rosterId,s=economy.state;if(!s.ownedOperators.includes(id)){showRecruitment();return;}
   const slots=Array.from({length:3},(_,i)=>s.squad[i]||null),old=slots[slot],from=slots.indexOf(id);if(from>=0)slots[from]=old;slots[slot]=id;
   if(economy.dispatch('SET_SQUAD',{squad:slots.filter(Boolean)}).ok){$('#modal-backdrop').hidden=true;update(economy.state,battle.getState(),'IDLE');}
  });
  if($('#remove-squad-slot'))$('#remove-squad-slot').onclick=()=>{const ids=[...economy.state.squad];ids.splice(slot,1);economy.dispatch('SET_SQUAD',{squad:ids});$('#modal-backdrop').hidden=true;update(economy.state,battle.getState(),'IDLE');};
 }
 function showRecruitment(){
  const s=economy.state,room=s.roomStats.find(r=>r.id==='reactor');
  openModal(`<div class="recruitment-view"><p class="modal-eyebrow">PERSONNEL / RECRUITMENT</p><h2 class="modal-title">让火力，各有所长。</h2><div class="recruit-wallet"><span>基地金币收集槽</span><b data-recruit-wallet>${s.alloy}</b><small>合金币</small></div><div class="recruit-station"><div><b>招募中心 <small>LV.${String(room.level).padStart(2,'0')} /20</small></b><p>${room.unlocked?'招募后永久加入基地，并自动填入空槽。':'建成招募中心，即可用金币邀请驾驶员。'}</p></div><button id="recruit-station-action" ${room.level>=20?'disabled':''}>${!room.unlocked?`建设 · ${room.cost}`:room.level<20?`升级 · ${room.upgradeCost}`:'已满级'}</button></div><div class="recruit-grid">${OPERATOR_DEFS.filter(def=>def.id!=='spark').map(def=>`<article class="recruit-card" data-recruit-card="${def.id}" style="--operator-color:${def.color}"><div class="recruit-art">${portrait(def.id)}<span>${def.codename}</span></div><div class="recruit-copy"><small>${def.role}</small><h3>${def.name}<span>${def.weapon}</span></h3><p>${def.description}</p><div class="weapon-spec"><span>弹匣 <b>${def.maxAmmo}</b></span><span>射速 <b>${(1/def.interval).toFixed(1)}/秒</b></span></div><button data-recruit="${def.id}"></button></div></article>`).join('')}</div><p class="modal-footnote">金币直接招募指定驾驶员 · 每名仅招募一次<br>招募中心每级增加 2% 小队攻击</p><button id="recruit-to-squad" class="secondary-button">调整出击编队 →</button></div>`);
  $('#recruit-station-action').onclick=()=>{const current=economy.state.roomStats.find(r=>r.id==='reactor');if(economy.dispatch(current.unlocked?'UPGRADE_ROOM':'UNLOCK_ROOM',{id:'reactor'}).ok)showRecruitment();};
  document.querySelectorAll('[data-recruit]').forEach(button=>button.onclick=()=>{const id=button.dataset.recruit;if(economy.dispatch('RECRUIT_OPERATOR',{id}).ok){showRecruitment();toast(`${operatorById(id).name}已就位 · 编队自动保存`,'success');}});
  $('#recruit-to-squad').onclick=()=>showRoster(Math.min(2,economy.state.squad.length));update(s,battle.getState(),'IDLE');
 }
 function select(index){const s=battle.getState();const id=s.squad?.[index]?.id;if(id&&battle.selectOperator(id)){update(economy.state,battle.getState(),'BATTLE');return true;}return false;}
 function update(s,b,mode){
  const key=s.squad.join(',');
  if(baseKey!==key||!$('#base-squad').children.length){baseKey=key;$('#base-squad').innerHTML=slotsMarkup(s.squad);document.querySelectorAll('[data-squad-slot]').forEach(button=>button.onclick=()=>showRoster(Number(button.dataset.squadSlot)));}
  $('#squad-count').textContent=`${s.squad.length} / 3`;
  $('#recruit-button').classList.toggle('has-purchase',s.recruitAvailable||(!s.rooms.reactor&&s.alloy>=32));
  const battleIds=(b.squad||[]).map(m=>m.id),bk=battleIds.join(',');
  if(battleKey!==bk||!$('#battle-squad').children.length){battleKey=bk;$('#battle-squad').innerHTML=slotsMarkup(battleIds,true);document.querySelectorAll('[data-battle-slot]').forEach(button=>button.onclick=()=>select(Number(button.dataset.battleSlot)));}
  for(const [index,m] of (b.squad||[]).entries()){const button=$(`[data-battle-slot="${index}"]`);if(!button)continue;button.classList.toggle('selected',m.id===b.activeOperatorId);button.querySelector('[data-slot-status]').textContent=m.reloading?'换弹中':`${m.ammo} / ${m.maxAmmo}`;button.querySelector('.squad-ammo i').style.width=`${Math.max(0,m.ammo/m.maxAmmo)*100}%`;}
  if(!$('#modal-backdrop').hidden&&$('.recruitment-view')){
   $('[data-recruit-wallet]').textContent=s.alloy;const r=s.roomStats.find(r=>r.id==='reactor');$('#recruit-station-action').disabled=r.level>=20||s.alloy<(r.unlocked?r.upgradeCost:r.cost);
   for(const def of s.operatorStats){const button=$(`[data-recruit="${def.id}"]`);if(!button)continue;button.disabled=!def.canRecruit;button.textContent=def.owned?'已招募':!r.unlocked?'先建设招募中心':def.canRecruit?`招募 · ${def.cost} 合金币`:`${def.cost} 合金币 · 还需 ${def.cost-s.alloy}`;button.closest('article').classList.toggle('recruited',def.owned);}
  }
  $('#base-squad').querySelectorAll('button').forEach(button=>button.disabled=mode==='BATTLE'||mode==='TRAVEL'||mode==='RESULT');
 }
 $('#recruit-button').onclick=showRecruitment;
 return{update,showRoster,showRecruitment,select,missionMarkup:ids=>`<div class="mission-squad">${ids.map(id=>`<div style="--operator-color:${operatorById(id).color}">${portrait(id)}<b>${operatorById(id).name}</b><small>${operatorById(id).weapon}</small></div>`).join('')}</div>`};
}
