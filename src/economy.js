import { OPERATOR_DEFS, operatorById, normalizeSquad } from './operators.js';
/** All spendable resources live here. Scene modules receive immutable snapshots. */
export const BALANCE = Object.freeze({
  version: 1, storageKey: 'neon-spire.save.v1', baseRunYield: 10, hopperCapacity: 10,
  maxEnergy: 120, maxCores: 10, maxAlloy: 9999, maxBlueprints: 99,
  maxLevel: 8, battleSeconds: 38, launchTicket: 1,
  repairSeconds: 18, offlineSeconds: 900, seedCoins: 63, platformCapacity: 240,
  alloyPerCore: 1,
  warehouseCost: level => Math.ceil(18 * 0.65 * Math.pow(1.6, level - 1)),
  weaponCost: level => Math.ceil(18 * 0.8 * Math.pow(1.55, level - 1)),
  blueprintCost: level => level < 2 ? 0 : Math.ceil(level / 2),
  repairCost: 6,
});

/** The six rooms share one definition between the economy, model and room inspector. */
export const ROOM_DEFS = Object.freeze([
  { id: 'command', name: '指挥中心', subtitle: 'COMMAND', effect: '协调火力 · 每次升级攻击 +6%', cost: 0, upgradeBase: 14, initialLevel: 1, color: '#58dce4', icon: 'CMD' },
  { id: 'energy', name: '能源工坊', subtitle: 'POWER WORKS', effect: '电池生产 · 每次升级基础产能 +14%', cost: 0, upgradeBase: 12, initialLevel: 1, color: '#f7bb66', icon: 'PWR' },
  { id: 'armory', name: '武器研究室', subtitle: 'ARMORY', effect: '火力研发 · 每级攻击 +18%', cost: 12, upgradeBase: 18, initialLevel: 0, color: '#f78fae', icon: 'ATK' },
  { id: 'armor', name: '装甲实验室', subtitle: 'ARMOR LAB', effect: '护甲 +20% / 级 · 掩体加成最高 +24%', cost: 18, upgradeBase: 22, initialLevel: 0, color: '#82b9ff', icon: 'DEF' },
  { id: 'mint', name: '合金铸造室', subtitle: 'ALLOY MINT', effect: '每级每 12.5 秒产出 1 合金币', cost: 24, upgradeBase: 30, initialLevel: 0, color: '#f4d578', icon: 'GOLD' },
  { id: 'reactor', name: '招募中心', subtitle: 'PERSONNEL', effect: '金币招募驾驶员 · 每级小队攻击 +2%', cost: 32, upgradeBase: 36, initialLevel: 0, color: '#a6c9bd', icon: 'OPS' },
].map(def => Object.freeze({ ...def, maxLevel: 20 })));
const defaultRooms = () => Object.fromEntries(ROOM_DEFS.map(def => [def.id, def.initialLevel]));
// Twenty levels need a curve whose final cost remains below the wallet limit.
const roomUpgradeCost = (def, level) => Math.ceil(def.upgradeBase * Math.pow(1.22, Math.max(0, level - 1)));

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const finite = (n, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const integer = (n, min, max, fallback = min) => clamp(Math.floor(finite(n, fallback)), min, max);
const authorities = new WeakMap();
const emptyAmplifier = () => ({ serial: 0, flights: [], pending: [], minted: 0, hits5: 0, hits10: 0, misses: 0, time: 0 });
function loadAmplifier(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return { serial: integer(s.serial, 0, 999999999), minted: integer(s.minted, 0, 999999999), hits5: integer(s.hits5, 0, 999999999), hits10: integer(s.hits10, 0, 999999999), misses: integer(s.misses, 0, 999999999), time: Math.max(0, finite(s.time)),
    flights: (Array.isArray(s.flights) ? s.flights : []).slice(0, 20).map(f => ({ id: integer(f.id, 1, 999999999, 1), x: clamp(finite(f.x), -2.8, 2.8), y: clamp(finite(f.y, 4.65), -.4, 4.8), vy: clamp(finite(f.vy, -1), -12, 0) })),
    pending: (Array.isArray(s.pending) ? s.pending : []).slice(0, 2000).map(p => ({ remaining: integer(p.remaining, 0, 1000), x: clamp(finite(p.x), -2.8, 2.8), y: clamp(finite(p.y, 2), -.3, 4.6) })).filter(p => p.remaining > 0) };
}

export class EventBus {
  #listeners = new Map();
  on(name, listener) {
    if (typeof listener !== 'function') throw new TypeError('Event listener must be a function');
    if (!this.#listeners.has(name)) this.#listeners.set(name, new Set());
    this.#listeners.get(name).add(listener);
    return () => this.off(name, listener);
  }
  off(name, listener) { this.#listeners.get(name)?.delete(listener); }
  emit(name, payload) {
    for (const listener of [...(this.#listeners.get(name) || [])]) listener(payload);
  }
  clear() { this.#listeners.clear(); }
}

export class Economy {
  #bus; #storage; #s; #activeRun = null; #runSerial = 0;
  #saveClock = 0;
  #authorityConnected = false;
  constructor(bus = new EventBus(), { storage } = {}) {
    this.#bus = bus;
    try { this.#storage = storage === undefined ? globalThis.localStorage : storage; } catch { this.#storage = null; }
    this.#s = { energy: 120, cores: 0, hopperVersion: 3, alloy: 0, blueprints: 0,
      warehouseLevel: 1, weaponLevel: 1, allocation: 1, hp: 100,
      repairRemaining: 0, runs: 0, seedGranted: false, totalConverted: 0, platformCores: 0,
      rooms: defaultRooms(), coinProgress: 0, pusherStarted: false, amplifier: emptyAmplifier(), ownedOperators:['spark'], squad:['spark'] };
    this.#load();
    authorities.set(this, world => this.#connectPhysics(world));
  }
  get state() {
    const s = this.#s;
    const capacity = BALANCE.maxEnergy + (s.warehouseLevel - 1) * 12;
    const rooms = Object.freeze({ ...s.rooms });
    const ownedOperators=Object.freeze([...s.ownedOperators]),squad=Object.freeze([...s.squad]);
    const operatorStats=Object.freeze(OPERATOR_DEFS.map(def=>Object.freeze({...def,owned:ownedOperators.includes(def.id),assigned:squad.includes(def.id),canRecruit:rooms.reactor>0&&!ownedOperators.includes(def.id)&&s.alloy>=def.cost&&!this.#activeRun})));
    const recruitAvailable=operatorStats.some(def=>def.canRecruit);
    const productivity = Math.pow(1.22, s.warehouseLevel - 1) * (1 + Math.max(0, rooms.energy - 1) * .14);
    const roomStats = Object.freeze(ROOM_DEFS.map(def => Object.freeze({ ...def, level: rooms[def.id], unlocked: rooms[def.id] > 0, unlockCost: def.cost, upgradeCost: roomUpgradeCost(def, rooms[def.id]), canUpgrade: rooms[def.id] > 0 && rooms[def.id] < def.maxLevel, recruitAvailable:def.id==='reactor'&&recruitAvailable, canPurchase: (rooms[def.id] < def.maxLevel && s.alloy >= (rooms[def.id] > 0 ? roomUpgradeCost(def, rooms[def.id]) : def.cost))||(def.id==='reactor'&&recruitAvailable) })));
    const amplifier = Object.freeze({ ...s.amplifier, flights: Object.freeze(s.amplifier.flights.map(f => Object.freeze({ ...f }))), pending: Object.freeze(s.amplifier.pending.map(p => Object.freeze({ ...p }))) });
    return Object.freeze({ ...s, amplifier, rooms, roomStats, ownedOperators,squad,operatorStats,recruitAvailable, maxEnergy: capacity, maxCores: BALANCE.maxCores,
      maxAlloy: BALANCE.maxAlloy, maxBlueprints: BALANCE.maxBlueprints,
      production: (0.1 + s.allocation * 0.66) * productivity,
      coreProduction: 0,
      hopperRemaining: s.cores, hopperCapacity: BALANCE.hopperCapacity, hopperReady: s.cores > 0, hopperBatch: s.runs,
      attackMultiplier: 1 + rooms.armory * .18 + Math.max(0, rooms.command - 1) * .06 + rooms.reactor*.02,
      defenseMultiplier: 1 + rooms.armor * .20, coverBonus: Math.min(.24, rooms.armor * .06),
      coinProduction: rooms.mint * .08,
      upgradeWarehouseCost: BALANCE.warehouseCost(s.warehouseLevel),
      upgradeWeaponCost: BALANCE.weaponCost(s.weaponLevel),
      upgradeBlueprintCost: BALANCE.blueprintCost(s.weaponLevel),
      repairCost: BALANCE.repairCost, activeRun: this.#activeRun !== null,
    });
  }
  #load() {
    try {
      const raw = JSON.parse(this.#storage?.getItem(BALANCE.storageKey) || 'null');
      if (!raw || raw.version !== BALANCE.version || typeof raw.state !== 'object' || !raw.state) return;
      const s = raw.state;
      const warehouseLevel = integer(s.warehouseLevel, 1, BALANCE.maxLevel, 1);
      const ownedOperators=['spark',...OPERATOR_DEFS.filter(def=>def.id!=='spark'&&Array.isArray(s.ownedOperators)&&s.ownedOperators.includes(def.id)).map(def=>def.id)];
      this.#s = {
        energy: clamp(finite(s.energy, 120), 0, 120 + (warehouseLevel - 1) * 12),
        cores: integer(s.cores, 0, BALANCE.hopperCapacity, 0), hopperVersion: 3,
        alloy: integer(s.alloy, 0, BALANCE.maxAlloy),
        blueprints: integer(s.blueprints, 0, BALANCE.maxBlueprints),
        warehouseLevel, weaponLevel: integer(s.weaponLevel, 1, BALANCE.maxLevel, 1),
        allocation: 1, hp: clamp(finite(s.hp, 100), 0, 100),
        repairRemaining: clamp(finite(s.repairRemaining), 0, BALANCE.repairSeconds),
        runs: integer(s.runs, 0, 999999), seedGranted: s.seedGranted === true,
        totalConverted: integer(s.totalConverted, 0, 9999999), platformCores: integer(s.platformCores, 0, 2000000), amplifier: loadAmplifier(s.amplifier),
        rooms: Object.fromEntries(ROOM_DEFS.map(def => [def.id, integer(s.rooms?.[def.id], def.initialLevel, def.maxLevel, def.initialLevel)])),
        coinProgress: clamp(finite(s.coinProgress), 0, .999999),ownedOperators,squad:normalizeSquad(Array.isArray(s.squad)?s.squad:['spark'],ownedOperators),
        // Preserve machines already in use. Old saves did not record the motor
        // latch, so completed runs, prior conversions or extra table coins count
        // as established play. An explicit false on a new save always wins.
        pusherStarted: typeof s.pusherStarted === 'boolean' ? s.pusherStarted :
          finite(s.runs) > 0 || finite(s.totalConverted) > 0 || finite(s.platformCores) > BALANCE.seedCoins,
      };
      if (this.#s.hp === 0 && this.#s.repairRemaining === 0) this.#s.repairRemaining = BALANCE.repairSeconds;
      const offline = clamp((Date.now() - finite(raw.savedAt, Date.now())) / 1000, 0, BALANCE.offlineSeconds);
      this.#produce(offline, false);
      if (s.hopperVersion !== 3 || typeof s.pusherStarted !== 'boolean') this.save();
    } catch { /* A corrupt or unavailable save must never stop a session. */ }
  }
  save() {
    try {
      this.#storage?.setItem(BALANCE.storageKey, JSON.stringify({ version: BALANCE.version, savedAt: Date.now(), state: this.#s }));
      return true;
    } catch { return false; }
  }
  #feedback(text, type = 'info', resource, amount = 0) {
    this.#bus.emit('feedback', Object.freeze({ text, type, resource, amount }));
  }
  #changed() { this.#bus.emit('economy:change', this.state); }
  #failure(reason) { this.#feedback(reason, 'warning'); return { ok: false, reason }; }
  #produce(dt, feedback = true) {
    const s = this.#s, beforeEnergy = Math.floor(s.energy), beforeAlloy = s.alloy;
    const stats = this.state;
    s.energy = Math.min(stats.maxEnergy, s.energy + stats.production * dt);
    // Construction is a paid investment; the locked mint cannot generate free currency.
    s.coinProgress += stats.coinProduction * dt;
    if (s.coinProgress >= 1) {
      const earned = Math.floor(s.coinProgress);
      s.coinProgress -= earned;
      s.alloy = Math.min(BALANCE.maxAlloy, s.alloy + earned);
    }
    if (s.repairRemaining > 0) {
      s.repairRemaining = Math.max(0, s.repairRemaining - dt);
      if (s.repairRemaining === 0) {
        s.hp = 100;
        if (feedback) this.#feedback('自动修复完成 · 可以出击', 'success', 'hp', 100);
      }
    } else if (!this.#activeRun) s.hp = Math.min(100, s.hp + dt * 2.8);
    if (feedback && Math.floor(s.energy) > beforeEnergy) this.#feedback('能量生产', 'production', 'energy', Math.floor(s.energy) - beforeEnergy);
    if (feedback && s.alloy > beforeAlloy) this.#feedback('铸造室产出', 'production', 'alloy', s.alloy - beforeAlloy);
  }
  tick(dt) {
    dt = clamp(finite(dt), 0, 60);
    if (dt === 0) return;
    this.#produce(dt);
    this.#saveClock += dt;
    if (this.#saveClock >= 5) { this.save(); this.#saveClock = 0; }
    this.#changed();
  }
  dispatch(action, payload = {}) {
    const s = this.#s;
    let result = { ok: true };
    switch (action) {
      case 'SET_ALLOCATION': {
        return this.#failure('基地专注生产能量 · 晶核由每局战斗提供');
      }
      case 'LAUNCH': {
        if (this.#activeRun) return this.#failure('出击正在进行');
        if (s.cores > 0) return this.#failure('请先投完漏斗中的晶核');
        if (s.hp <= 0 || s.repairRemaining > 0) return this.#failure('角色修复中');
        if(s.squad.length===0)return this.#failure('请先选择至少一名上阵驾驶员');
        if (s.energy < BALANCE.launchTicket + 1) return this.#failure('能量不足 · 前往仓库排产');
        const battleEnergy = Math.min(BALANCE.battleSeconds, s.energy - BALANCE.launchTicket);
        s.energy -= battleEnergy + BALANCE.launchTicket;
        this.#activeRun = { id: ++this.#runSerial, battleEnergy, squad:[...s.squad] };
        this.#feedback('电梯启动 · 战斗能量装载', 'spend', 'energy', -(battleEnergy + 1));
        result = { ok: true, battleEnergy, runId: this.#activeRun.id, squad:Object.freeze([...s.squad]) };
        break;
      }
      case 'RECRUIT_OPERATOR': {
        if(this.#activeRun)return this.#failure('战斗期间无法招募');
        const def=operatorById(payload.id);
        if(!def)return this.#failure('没有找到这名驾驶员');
        if(s.ownedOperators.includes(def.id))return this.#failure('驾驶员已加入基地');
        if(s.rooms.reactor<1)return this.#failure('请先建成招募中心');
        if(s.alloy<def.cost)return this.#failure(`招募${def.name}需要 ${def.cost} 合金币`);
        s.alloy-=def.cost;s.ownedOperators.push(def.id);if(s.squad.length<3)s.squad.push(def.id);
        this.#feedback(`${def.name}已加入基地${s.squad.includes(def.id)?' · 已上阵':''}`,'upgrade','alloy',-def.cost);
        this.#bus.emit('operator:recruited',Object.freeze({id:def.id,cost:def.cost}));
        result={ok:true,id:def.id,cost:def.cost};break;
      }
      case 'SET_SQUAD': {
        if(this.#activeRun)return this.#failure('战斗期间无法修改出击编队');
        const ids=payload.squad;
        if(!Array.isArray(ids)||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>!operatorById(id)||!s.ownedOperators.includes(id)))return this.#failure('编队最多三名已招募驾驶员，不能重复');
        s.squad=[...ids];result={ok:true,squad:Object.freeze([...ids])};break;
      }
      case 'BATTLE_END': {
        if (!this.#activeRun) return this.#failure('没有可结算的战斗');
        if (payload.runId !== undefined && payload.runId !== this.#activeRun.id) return this.#failure('战斗凭据不匹配');
        const blueprints = integer(payload.blueprints, 0, 5);
        const gainedCores = BALANCE.hopperCapacity;
        const gainedBlueprints = Math.min(blueprints, BALANCE.maxBlueprints - s.blueprints);
        s.cores = gainedCores; s.blueprints += gainedBlueprints;
        s.hp = clamp(finite(payload.hp, 100), 0, 100);
        if (s.hp === 0) s.repairRemaining = BALANCE.repairSeconds;
        s.runs++; this.#activeRun = null;
        this.#feedback(`战斗晶核装载 +${gainedCores} · 前往推币机`, 'success', 'cores', gainedCores);
        if (gainedBlueprints) this.#feedback(`精英蓝图 +${gainedBlueprints}`, 'success', 'blueprints', gainedBlueprints);
        result = { ok: true, cores: gainedCores, blueprints: gainedBlueprints, hp: s.hp, hopperRemaining: s.cores };
        break;
      }
      case 'INSERT_CORE': {
        if (s.cores < 1) return this.#failure('漏斗已空 · 返回基地准备下一次出击');
        s.cores--; s.pusherStarted = true; this.#feedback('晶核投入机台', 'spend', 'cores', -1);
        if (s.cores === 0) this.#bus.emit('hopper:empty', Object.freeze({ batch: s.runs }));
        break;
      }
      case 'UNLOCK_ROOM': {
        const def = ROOM_DEFS.find(room => room.id === payload.id);
        if (!def) return this.#failure('没有找到这个房间');
        if (s.rooms[def.id] > 0) return this.#failure('房间已建成');
        if (s.alloy < def.cost) return this.#failure(`建造${def.name}需要 ${def.cost} 合金币`);
        s.alloy -= def.cost; s.rooms[def.id] = 1;
        this.#feedback(`${def.name}建造完成`, 'upgrade', 'alloy', -def.cost);
        this.#bus.emit('room:built', Object.freeze({ id: def.id, level: 1 }));
        result = { ok: true, id: def.id, level: 1, cost: def.cost };
        break;
      }
      case 'UPGRADE_ROOM': {
        const def = ROOM_DEFS.find(room => room.id === payload.id);
        if (!def) return this.#failure('没有找到这个房间');
        const level = s.rooms[def.id];
        if (!level) return this.#failure('请先建造房间');
        if (level >= def.maxLevel) return this.#failure('房间已达到最高等级');
        const cost = roomUpgradeCost(def, level);
        if (s.alloy < cost) return this.#failure(`升级${def.name}需要 ${cost} 合金币`);
        s.alloy -= cost; s.rooms[def.id]++;
        this.#feedback(`${def.name}升级至 Lv.${s.rooms[def.id]}`, 'upgrade', 'alloy', -cost);
        this.#bus.emit('room:built', Object.freeze({ id: def.id, level: s.rooms[def.id] }));
        result = { ok: true, id: def.id, level: s.rooms[def.id], cost };
        break;
      }
      case 'UPGRADE_WAREHOUSE': {
        if (s.warehouseLevel >= BALANCE.maxLevel) return this.#failure('仓库已达到最高等级');
        const cost = BALANCE.warehouseCost(s.warehouseLevel);
        if (s.alloy < cost) return this.#failure(`需要 ${cost} 合金币 · 去推币机转化`);
        s.alloy -= cost; s.warehouseLevel++;
        this.#feedback(`仓库升级至 Lv.${s.warehouseLevel}`, 'upgrade', 'alloy', -cost);
        break;
      }
      case 'UPGRADE_WEAPON': {
        if (s.weaponLevel >= BALANCE.maxLevel) return this.#failure('武器已达到最高等级');
        const cost = BALANCE.weaponCost(s.weaponLevel), blueprints = BALANCE.blueprintCost(s.weaponLevel);
        if (s.alloy < cost || s.blueprints < blueprints) return this.#failure(`强化需要 ${cost} 合金币${blueprints ? ` + ${blueprints} 蓝图` : ''}`);
        s.alloy -= cost; s.blueprints -= blueprints; s.weaponLevel++;
        this.#feedback(`脉冲武器升级至 Lv.${s.weaponLevel}`, 'upgrade', 'alloy', -cost);
        if (blueprints) this.#feedback('强化蓝图已应用', 'spend', 'blueprints', -blueprints);
        break;
      }
      case 'REPAIR': {
        if (s.repairRemaining <= 0) return this.#failure('角色状态良好');
        if (s.alloy < BALANCE.repairCost) return this.#failure(`立即修复需要 ${BALANCE.repairCost} 合金币`);
        s.alloy -= BALANCE.repairCost; s.hp = 100; s.repairRemaining = 0;
        this.#feedback('即时修复完成', 'spend', 'alloy', -BALANCE.repairCost);
        break;
      }
      default: return { ok: false, reason: 'UNKNOWN_ACTION' };
    }
    this.#changed(); this.save();
    return result;
  }
  #connectPhysics(world) {
    if (this.#authorityConnected) throw new Error('A physical pusher is already bound to this economy');
    if (!world || typeof world.step !== 'function' || !Array.isArray(world.bodies)) throw new TypeError('A physics world is required');
    this.#authorityConnected = true;
    const tickets = new Map();
    const crystalTickets = new Map(), amp = this.#s.amplifier;
    for (const flight of amp.flights) crystalTickets.set(flight.id, Object.freeze({ id: flight.id }));
    let recoveryRemaining = Math.max(0, this.#s.platformCores - amp.pending.reduce((sum, batch) => sum + batch.remaining, 0));
    let seedRemaining = this.#s.seedGranted ? 0 : BALANCE.seedCoins;
    this.#s.seedGranted = true; this.save();
    return Object.freeze({
      launchCrystal: x => {
        if (!this.dispatch('INSERT_CORE').ok) return null;
        const flight = { id: ++amp.serial, x: clamp(finite(x), -2.8, 2.8), y: 4.65, vy: -1 };
        amp.flights.push(flight); const token = Object.freeze({ id: flight.id }); crystalTickets.set(flight.id, token); this.save(); return { token, ...flight };
      },
      restoreCrystals: () => amp.flights.map(f => ({ ...f, token: crystalTickets.get(f.id) })),
      moveCrystal: (token, y, vy) => {
        if (crystalTickets.get(token?.id) !== token) return false;
        const flight = amp.flights.find(f => f.id === token.id); if (!flight) return false;
        flight.y = clamp(finite(y, flight.y), -.4, 4.8); flight.vy = clamp(finite(vy, flight.vy), -12, 0); return true;
      },
      resolveCrystal: (token, multiplier, x, y) => {
        if (![1, 5, 10].includes(multiplier) || crystalTickets.get(token?.id) !== token) return 0;
        const index = amp.flights.findIndex(f => f.id === token.id); if (index < 0) return 0;
        crystalTickets.delete(token.id); amp.flights.splice(index, 1);
        amp.pending.push({ remaining: multiplier, x: clamp(finite(x), -2.8, 2.8), y: clamp(finite(y, 1), -.3, 4.6) });
        amp.minted += multiplier; amp[multiplier === 5 ? 'hits5' : multiplier === 10 ? 'hits10' : 'misses']++;
        this.#s.platformCores += multiplier; this.#changed(); this.save(); return multiplier;
      },
      getAmplifier: () => ({ time: amp.time, minted: amp.minted, hits5: amp.hits5, hits10: amp.hits10, misses: amp.misses, pending: amp.pending.reduce((sum, batch) => sum + batch.remaining, 0), flights: amp.flights.length }),
      clock: time => { amp.time = Math.max(0, finite(time, amp.time)); },
      nextPending: () => amp.pending[0] ? { ...amp.pending[0] } : null,
      reserve: (source = 'player') => {
        if (source === 'restore') { if (recoveryRemaining <= 0) return null; recoveryRemaining--; }
        else if (source === 'seed') { if (seedRemaining <= 0) return null; seedRemaining--; }
        else if (source === 'pending') {
          const batch = amp.pending[0]; if (!batch) return null;
          batch.remaining--; if (batch.remaining === 0) amp.pending.shift();
        }
        else if (source === 'player') {
          if (!this.dispatch('INSERT_CORE').ok) return null;
        } else return null;
        const token = Object.freeze({});
        tickets.set(token, { body: null, supported: false, forward: false, lastStep: -1 });
        if (source !== 'restore' && source !== 'pending') this.#s.platformCores++;
        this.save();
        return token;
      },
      bind: (token, body) => {
        const ticket = tickets.get(token);
        if (!ticket || ticket.body || !world.bodies.includes(body) || !(body.mass > 0)) return false;
        ticket.body = body; return true;
      },
      observe: token => {
        const ticket = tickets.get(token), body = ticket?.body;
        if (!body || !world.bodies.includes(body) || !Number.isFinite(world.stepnumber) || world.stepnumber <= ticket.lastStep) return false;
        ticket.lastStep = world.stepnumber;
        const { x, y, z } = body.position;
        if (Math.abs(x) <= 3.8 && y >= 1.04 && y <= 3.2 && z >= -3.4 && z <= 3.2) ticket.supported = true;
        if (ticket.supported && z > 3.2 && Math.abs(x) < 4.1) ticket.forward = true;
        return ticket.forward && z > 3.2 && y < 0.58 && Math.abs(x) < 4.1;
      },
      settle: (tokens, combo = 1) => {
        const valid = [];
        for (const token of new Set(tokens)) {
          const ticket = tickets.get(token), body = ticket?.body;
          if (ticket?.forward && body && world.bodies.includes(body) && body.position.z > 3.2 && body.position.y < 0.58 && Math.abs(body.position.x) < 4.1) valid.push(token);
        }
        if (!valid.length) return 0;
        for (const token of valid) tickets.delete(token);
        this.#s.platformCores = Math.max(0, this.#s.platformCores - valid.length);
        const multiplier = 1;
        const amount = Math.min(valid.length, BALANCE.maxAlloy - this.#s.alloy);
        this.#s.alloy += amount; this.#s.totalConverted += valid.length;
        this.#feedback(`落下 ${valid.length} 枚金币 · +${amount} 合金币`, 'conversion', 'alloy', amount);
        this.#bus.emit('pusher:reward', Object.freeze({ amount, count: valid.length, multiplier }));
        this.#changed(); this.save(); return amount;
      },
      discard: token => {
        if (!tickets.delete(token)) return false;
        this.#s.platformCores = Math.max(0, this.#s.platformCores - 1); this.save(); return true;
      },
      requeue: (token, x = 0) => {
        if (!tickets.delete(token)) return false;
        amp.pending.push({ remaining: 1, x: clamp(finite(x), -2.8, 2.8), y: .6 }); this.save(); return true;
      },
      close: () => { tickets.clear(); this.#authorityConnected = false; },
    });
  }
}

/** Module-level capability, held only by the physical pusher. No bus action can mint currency. */
export function bindPhysicalPusher(economy, world) {
  const connect = authorities.get(economy);
  if (!connect) throw new TypeError('An Economy instance is required');
  return connect(world);
}


