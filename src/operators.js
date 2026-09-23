/** Shared roster: UI, recruitment and actual combat use the same weapon data. */
export const OPERATOR_DEFS = Object.freeze([
 {id:'spark',name:'火花',codename:'SPARK',weapon:'双相步枪',kind:'rifle',role:'精准突击',description:'均衡射速，瞄准核心造成弱点伤害。',color:'#b8f97e',cost:0,maxAmmo:24,interval:.15,reloadDuration:1.15,damage:9,weakMultiplier:2.35,splashRadius:0},
 {id:'ember',name:'余烬',codename:'EMBER',weapon:'破城火箭筒',kind:'rocket',role:'范围轰击',description:'4 发重型火箭，射速慢；爆炸覆盖大范围敌人。',color:'#edb075',cost:42,maxAmmo:4,interval:1.05,reloadDuration:2.1,damage:36,weakMultiplier:1.25,splashRadius:2.35},
 {id:'volt',name:'雷霆',codename:'VOLT',weapon:'六管加特林',kind:'gatling',role:'持续压制',description:'120 发大弹匣，射速最快，单发伤害较低。',color:'#8ccbe8',cost:64,maxAmmo:120,interval:.05,reloadDuration:2.6,damage:3,weakMultiplier:1.65,splashRadius:0},
].map(def=>Object.freeze(def)));
export const operatorById = id => OPERATOR_DEFS.find(def=>def.id===id);
export const normalizeSquad = (raw,owned=['spark']) => {
 const valid=Array.isArray(raw)?raw:[];
 return [...new Set(valid.filter(id=>operatorById(id)&&owned.includes(id)))].slice(0,3);
};
