import * as CANNON from 'cannon-es';
import { BALANCE, bindPhysicalPusher } from './economy.js';

const STEP = 1 / 60, CAPACITY = BALANCE.platformCapacity, RADIUS = 0.28, CYCLE = 8;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Physics remains horizontal. This oblique display matrix exposes the coin faces
// to a truly level, centered camera without tilting the surrounding cabinet.
export const PUSHER_VIEW = Object.freeze({ shear: -0.54, offsetY: -1.9 });
const STAGES = Object.freeze([
  { name: 'LOWER', y: 1.0, rear: -1.0, cliff: 3.2, width: 7.7 },
]);
export const AMPLIFIERS = Object.freeze([
  Object.freeze({ multiplier: 5, y: 3.12, width: 1.52, amplitude: 2.42, speed: .82, phase: 0 }),
  Object.freeze({ multiplier: 10, y: 1.15, width: 1.18, amplitude: 2.48, speed: .67, phase: 2.0 }),
]);
export const amplifierX = (gate, time) => Math.sin(time * gate.speed + gate.phase) * gate.amplitude;
/** Swept relative collision also catches a moving gate between render frames. */
export function crystalGateHit(from, to, fromTime, toTime) {
  const hits = [];
  for (const gate of AMPLIFIERS) {
    const x0 = amplifierX(gate, fromTime), x1 = amplifierX(gate, toTime);
    const start = [from.x - x0, from.y - gate.y], delta = [to.x - x1 - start[0], to.y - gate.y - start[1]], half = [gate.width / 2 + .14, .31];
    let enter = 0, leave = 1, valid = true;
    for (let axis = 0; axis < 2; axis++) {
      if (Math.abs(delta[axis]) < 1e-9) { if (Math.abs(start[axis]) > half[axis]) valid = false; continue; }
      const a = (-half[axis] - start[axis]) / delta[axis], b = (half[axis] - start[axis]) / delta[axis];
      enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
    }
    if (valid && enter <= leave && enter >= 0 && enter <= 1) hits.push({ multiplier: gate.multiplier, fraction: enter, x: from.x + (to.x - from.x) * enter, y: from.y + (to.y - from.y) * enter });
  }
  return hits.sort((a, b) => a.fraction - b.fraction)[0] || null;
}

/** A crystal crosses moving multipliers, then gold reaches one real pusher bed. */
export function createPusher({ THREE, group, economy, bus }) {
  const root = new THREE.Group(); root.name = 'rigid-body-core-pusher'; group.add(root);
  const front = new THREE.Group(); front.name = 'moving-amplifier-chamber'; group.add(front);
  root.matrixAutoUpdate = false;
  root.matrix.set(1, 0, 0, 0, 0, 1, PUSHER_VIEW.shear, PUSHER_VIEW.offsetY, 0, 0, 1, 0, 0, 0, 0, 1);
  const physics = new CANNON.World({ gravity: new CANNON.Vec3(0, -15, 0), allowSleep: true });
  physics.broadphase = new CANNON.SAPBroadphase(physics);
  physics.solver.iterations = 14; physics.solver.tolerance = 0.00001;
  const coinMaterial = new CANNON.Material('minted-gold');
  const tableMaterial = new CANNON.Material('enamel-table');
  const carriageMaterial = new CANNON.Material('polished-carriage');
  physics.addContactMaterial(new CANNON.ContactMaterial(coinMaterial, tableMaterial, { friction: 0.045, restitution: 0.025 }));
  // The returning carriage must slide out from beneath a deposited coin.
  // Sharing the floor's friction made top coins ride it indefinitely.
  physics.addContactMaterial(new CANNON.ContactMaterial(coinMaterial, carriageMaterial, { friction: 0.004, restitution: 0.025 }));
  physics.addContactMaterial(new CANNON.ContactMaterial(coinMaterial, coinMaterial, { friction: 0.20, restitution: 0.045 }));
  const authority = bindPhysicalPusher(economy, physics);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const material = params => { const m = new THREE.MeshStandardMaterial(params); materials.add(m); return m; };
  const brass = material({ color: 0x707a72, metalness: 0.62, roughness: 0.67 });
  const dark = material({ color: 0x1a252d, metalness: 0.48, roughness: 0.73 });
  const enamel = material({ color: 0x49564f, metalness: 0.25, roughness: 0.76 });
  const stageEnamels = [0x55645b, 0x48564f, 0x505e58].map(color => material({ color, metalness: 0.28, roughness: 0.72 }));
  const light = material({ color: 0x89b9bf, emissive: 0x467b80, emissiveIntensity: .38, metalness: 0.22, roughness: .53 });
  const amber = material({ color: 0xc2a16b, emissive: 0x785d2b, emissiveIntensity: .08, metalness: .4, roughness: .62 });
  const rose = material({ color: 0xb8bcb0, emissive: 0x627277, emissiveIntensity: .04, metalness: .25, roughness: .74 });
  const silver = material({ color: 0xc1c4b6, metalness: .42, roughness: .68 });
  const coinGold = material({ color: 0xd2ad60, metalness: .74, roughness: .34 });
  let coinFace = coinGold;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = c.height = 256; const a = c.getContext('2d');
    const g = a.createRadialGradient(80, 65, 10, 128, 128, 140); g.addColorStop(0, '#fff8d7'); g.addColorStop(.45, '#d8b975'); g.addColorStop(1, '#90672f');
    a.fillStyle = g; a.fillRect(0, 0, 256, 256); a.strokeStyle = '#fff3bf'; a.lineWidth = 6;
    for (const r of [116, 104]) { a.beginPath(); a.arc(128, 128, r, 0, Math.PI * 2); a.stroke(); }
    a.strokeStyle = '#70542d'; a.lineWidth = 2; for (let i = 0; i < 36; i++) { const t = i * Math.PI / 18; a.beginPath(); a.moveTo(128 + Math.cos(t) * 109, 128 + Math.sin(t) * 109); a.lineTo(128 + Math.cos(t) * 117, 128 + Math.sin(t) * 117); a.stroke(); }
    a.fillStyle = '#806135'; a.font = '900 112px Arial'; a.textAlign = 'center'; a.fillText('N', 129, 165); a.fillStyle = '#fff1b6'; a.font = '900 106px Arial'; a.fillText('N', 126, 161);
    a.font = 'bold 15px Arial'; a.fillText('ALLOY  •  CREDIT', 128, 199);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; textures.add(tex);
    coinFace = material({ map: tex, metalness: 0.65, roughness: .3, color: 0xffeabd });
  }
  function box(w, h, d, x, y, z, mat, parent = root) {
    const geometry = new THREE.BoxGeometry(w, h, d); geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function staticBox(x, y, z, w, h, d) {
    const body = new CANNON.Body({ mass: 0, material: tableMaterial, position: new CANNON.Vec3(x, y, z) });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2))); physics.addBody(body); return body;
  }
  const supportingBodies = new Map();
  const plates = STAGES.map((stage, index) => {
    const length = stage.cliff - stage.rear, midZ = (stage.rear + stage.cliff) / 2;
    const table = staticBox(0, stage.y - .10, midZ, stage.width, .20, length);
    supportingBodies.set(table.id, { stage: index, top: stage.y });
    box(stage.width + .1, .18, length + .02, 0, stage.y - .11, midZ, dark);
    box(stage.width, .055, length, 0, stage.y - .025, midZ, stageEnamels[index]);
    // Actual shelf lips are flush: decorative fascia must never block falling coins.
    box(stage.width + .12, .18, .12, 0, stage.y - .1, stage.cliff, brass);
    box(stage.width - .18, .075, .026, 0, stage.y - .20, stage.cliff + .075, light);
    // A solid step riser closes the rear of each receiving shelf. Without it,
    // its returning carriage sweeps freshly transferred coins under the tier above.
    if (index > 0) staticBox(0, stage.y + .39, stage.rear - .10, stage.width, .78, .20);
    for (const side of [-1, 1]) {
      const x = side * (stage.width / 2 + .10);
      staticBox(x, stage.y + .13, midZ, .16, .32, length + .07);
      box(.15, .24, length + .02, x, stage.y + .08, midZ, brass);
      box(.045, .036, length - .16, x - side * .03, stage.y + .225, midZ, index === 1 ? rose : light);
    }
    for (let i = -3; i <= 3; i++) {
      box(.017, .012, length - .2, i * .91, stage.y + .007, midZ, dark);
      box(.19, .012, .24, i * .91, stage.y + .014, stage.cliff - .20, amber);
    }
    // Small inlaid direction marks remain visible when the moving bed opens.
    for (const x of [-2.73, 0, 2.73]) for (const side of [-1, 1]) {
      const arrow = box(.034, .013, .32, x + side * .094, stage.y + .013, stage.cliff - .72, brass);
      arrow.rotation.y = side * -.58;
    }
    const phase = index % 2 ? CYCLE / 2 : 0, stroke = length - .65 - .56 - .40;
    const initialZ = stage.rear + .65 + stroke * .5 * (1 - Math.cos(phase * Math.PI * 2 / CYCLE));
    const body = new CANNON.Body({ type: CANNON.Body.KINEMATIC, material: carriageMaterial, position: new CANNON.Vec3(0, stage.y + .12, initialZ) });
    body.addShape(new CANNON.Box(new CANNON.Vec3(stage.width / 2 - .05, .12, .56))); physics.addBody(body);
    supportingBodies.set(body.id, { stage: index, top: stage.y + .24 });
    const visual = new THREE.Group(); root.add(visual);
    box(stage.width - .1, .24, 1.12, 0, 0, 0, dark, visual);
    box(stage.width - .18, .035, 1.06, 0, .137, 0, brass, visual);
    const motionLight = material({ color: 0x87bdc2, emissive: 0x42747c, emissiveIntensity: .3, metalness: .2, roughness: .55 });
    box(stage.width - .26, .22, .025, 0, -.04, .577, stageEnamels[index], visual);
    for (let x = -2.5; x <= 2.5; x += 1.0) { box(.36, .055, .025, x, .03, .595, (Math.round(x + 2.5) % 2) ? amber : light, visual); }
    box(stage.width - .4, .022, .035, 0, -.145, .596, motionLight, visual);
    visual.position.copy(body.position);
    return { ...stage, body, visual, phase, motionLight, passed: 0,
      // Keep a front bed of coins: the carriage transfers pressure through the
      // pile instead of sweeping every token off the empty shelf in one cycle.
      stroke };
  });
  // Backstop and overhead, animated drop nozzle are part of the real upper-stage input.
  staticBox(0, 1.35, -1.14, 7.8, 1.0, .20);
  box(7.72, .7, .22, 0, 1.27, -1.14, dark);
  box(7.4, .04, .06, 0, 1.63, -1.0, light);
  const nozzle = new THREE.Group(); root.add(nozzle);
  box(.90, .32, .52, 0, 0, 0, brass, nozzle); box(.61, .19, .55, 0, -.15, .02, dark, nozzle); box(.39, .035, .12, 0, -.27, .22, light, nozzle);
  box(.16, .48, .12, 0, .28, -.03, silver, nozzle);
  nozzle.position.set(0, 4.4, -4.02);
  // The rail and dotted drop guide make any horizontal input location readable.
  box(6.9, .19, .22, 0, 4.78, -4.07, dark);
  box(6.7, .034, .05, 0, 4.78, -3.935, silver);
  for (let x = -3.1; x <= 3.11; x += .31) box(.035, .1, .026, x, 4.74, -3.90, brass);
  const aimGuide = new THREE.Group(); root.add(aimGuide);
  const aimMaterial = new THREE.MeshBasicMaterial({ color: 0xa3c5cb, transparent: true, opacity: .30, depthWrite: false }); materials.add(aimMaterial);
  for (let i = 0; i < 5; i++) box(.035, .095, .03, 0, 3.04 + i * .18, -3.91, aimMaterial, aimGuide);
  const aimRingGeometry = new THREE.TorusGeometry(.28, .016, 5, 28); aimRingGeometry.rotateX(Math.PI / 2); geometries.add(aimRingGeometry);
  const aimRing = new THREE.Mesh(aimRingGeometry, aimMaterial); aimRing.position.set(0, 2.823, -3.91); aimGuide.add(aimRing);
  // A recessed front collection tray makes successful drops visible.
  // The chute's back plate continues the final cliff below the thin shelf.
  // It prevents a tipped coin from curling back underneath the payout edge
  // during the combo window; only coins that have crossed that edge enter it.
  staticBox(0, -.18, 3.05, 8.1, 1.90, .30);
  box(8.15, .16, 1.45, 0, -.52, 4.0, dark);
  box(7.89, .045, 1.29, 0, -.42, 3.99, enamel);
  box(8.10, .56, .16, 0, -.22, 4.74, dark);
  box(7.87, .055, .04, 0, .075, 4.80, amber);
  for (let i = 0; i < 17; i++) box(.052, .035, 1.14, -3.7 + i * .46, -.38, 4.0, brass);
  for (const x of [-4, 4]) box(.2, .5, 1.4, x, -.21, 4.0, brass);

  const discGeo = new THREE.CylinderGeometry(RADIUS, RADIUS, .12, 20, 1); geometries.add(discGeo);
  const ringGeo = new THREE.TorusGeometry(.22, .012, 5, 20); ringGeo.rotateX(Math.PI / 2); geometries.add(ringGeo);
  const discs = new THREE.InstancedMesh(discGeo, [coinGold, coinFace, coinGold], CAPACITY);
  const rings = new THREE.InstancedMesh(ringGeo, coinGold, CAPACITY);
  for (const mesh of [discs, rings]) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; root.add(mesh); }
  const dummy = new THREE.Object3D(), bodyMatrix = new THREE.Matrix4(), localRing = new THREE.Matrix4().makeTranslation(0, .065, 0);
  const coinShape = new CANNON.Cylinder(RADIUS, RADIUS, .12, 12);
  const coins = [], fallingGhosts = [], pendingRewards = [];
  let accumulator = 0, elapsed = 0, rewardClock = 0, flash = 0, disposed = false, serial = 0, lane = 0;
  let hopperLoading = 0, hopperFeed = 0, hopperFeedLane = 0;
  let gateTime = authority.getAmplifier().time, emissionClock = 0, lastAmplification = null;
  const HOPPER_LOAD_SECONDS = 1.65;
  const stats = { converted: 0, earnedAlloy: 0, overflow: 0, recycled: 0, spawnedCoins: 0, inserted: 0, passive: 0, seeded: 0, restored: 0, steps: 0, peakCount: 0, peakStackHeight: 0, initialStackCoins: 0, cascadeTransfers: [], completeTraversals: 0, paidTraversals: 0, overflowReasons: { capacity: 0, side: 0, rear: 0, fallen: 0, nonfinite: 0 } };
  const stageOf = () => 0;
  const gateVisuals = AMPLIFIERS.map((gate, i) => {
    const visual = new THREE.Group(); visual.position.set(amplifierX(gate, gateTime), gate.y, 1.3); front.add(visual);
    box(gate.width + .22, .78, .29, 0, 0, 0, silver, visual);
    box(gate.width + .08, .61, .31, 0, 0, .035, brass, visual);
    box(gate.width - .04, .48, .32, 0, 0, .075, dark, visual);
    for (const side of [-1, 1]) {
      box(.13, .76, .34, side * (gate.width / 2 + .10), 0, .075, dark, visual);
      box(.035, .33, .03, side * (gate.width / 2 - .045), 0, .255, light, visual);
      for (const sy of [-.28, .28]) box(.045, .045, .032, side * (gate.width / 2 + .10), sy, .26, silver, visual);
    }
    box(gate.width - .21, .028, .025, 0, -.29, .254, light, visual);
    visual.userData.scanBar = box(gate.width - .27, .014, .017, 0, .21, .287, light, visual);
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192; const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#172b34'; ctx.fillRect(0, 0, 512, 192); ctx.fillStyle = '#e0e5d5'; ctx.textAlign = 'center'; ctx.font = '800 142px Arial'; ctx.fillText(`×${gate.multiplier}`, 256, 151);
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; textures.add(tex);
      const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); materials.add(m); const g = new THREE.PlaneGeometry(gate.width - .16, .40); geometries.add(g); const label = new THREE.Mesh(g, m); label.position.z = .265; visual.add(label);
    }
    return visual;
  });
  const crystalGeo = new THREE.OctahedronGeometry(.16, 0); geometries.add(crystalGeo);
  const crystalMat = material({ color: 0x9cdae4, emissive: 0x367e97, emissiveIntensity: .62, metalness: .25, roughness: .31 });
  const conversionGeometry = new THREE.OctahedronGeometry(.043, 0); geometries.add(conversionGeometry);
  const conversionMaterial = new THREE.MeshBasicMaterial({ color: 0xa4e1e5, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }); materials.add(conversionMaterial);
  const conversionTransform = new THREE.Object3D();
  const fragments = new THREE.InstancedMesh(conversionGeometry, conversionMaterial, 12); fragments.frustumCulled = false; fragments.count = 0; front.add(fragments);
  const scanRingGeometry = new THREE.RingGeometry(.14, .17, 32); geometries.add(scanRingGeometry);
  const scanRing = new THREE.Mesh(scanRingGeometry, conversionMaterial); scanRing.visible = false; front.add(scanRing);
  function makeFlight(record) { const mesh = new THREE.Mesh(crystalGeo, crystalMat); mesh.position.set(record.x, record.y, 2.0); mesh.scale.y = 1.45; front.add(mesh); return { ...record, mesh }; }
  const flights = authority.restoreCrystals().map(makeFlight);
  function animateAmplifiers(dt) {
    const fromTime = gateTime; gateTime += dt; authority.clock(gateTime);
    for (const crystal of [...flights]) {
      const from = { x: crystal.x, y: crystal.y };
      crystal.vy -= dt * 4.8; crystal.y += crystal.vy * dt;
      const hit = crystalGateHit(from, crystal, fromTime, gateTime);
      if (hit || crystal.y < -.15) {
        const result = hit || { multiplier: 1, x: crystal.x, y: -.15 };
        const count = authority.resolveCrystal(crystal.token, result.multiplier, result.x, result.y);
        if (count) { lastAmplification = { multiplier: result.multiplier, count, x: result.x, y: result.y, time: gateTime }; bus?.emit('pusher:amplification', Object.freeze({ ...lastAmplification })); }
        front.remove(crystal.mesh); flights.splice(flights.indexOf(crystal), 1);
      } else {
        authority.moveCrystal(crystal.token, crystal.y, crystal.vy); crystal.mesh.position.y = crystal.y; crystal.mesh.rotation.y += dt * 4;
      }
    }
    gateVisuals.forEach((visual, i) => { visual.position.x = amplifierX(AMPLIFIERS[i], gateTime); const recent = lastAmplification?.multiplier === AMPLIFIERS[i].multiplier && gateTime - lastAmplification.time < .28; visual.scale.setScalar(recent ? 1 + .025 * Math.sin((gateTime - lastAmplification.time) / .28 * Math.PI) : 1); visual.userData.scanBar.position.y = Math.sin(gateTime * 3.2 + i) * .20; });
    const formationAge = lastAmplification ? gateTime - lastAmplification.time : 1;
    fragments.count = formationAge < .52 ? 12 : 0; scanRing.visible = formationAge < .52;
    if (scanRing.visible) {
      const t = formationAge / .52; conversionMaterial.opacity = (1 - t) * .7; conversionMaterial.color.setHex(t < .36 ? 0xa4e1e5 : 0xe0bd79);
      scanRing.position.set(lastAmplification.x, lastAmplification.y, 2.3); scanRing.scale.setScalar(1 + t * 2.4);
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; conversionTransform.position.set(lastAmplification.x + Math.cos(a) * t * .48, lastAmplification.y + Math.sin(a) * t * .36 - t * t * .24, 2.34); conversionTransform.rotation.set(t * 3, a, t * 5); conversionTransform.scale.setScalar(1 - t * .65); conversionTransform.updateMatrix(); fragments.setMatrixAt(i, conversionTransform.matrix); } fragments.instanceMatrix.needsUpdate = true;
    }
  }
  function ghost(coin, overflow) {
    if (fallingGhosts.length >= 12) return;
    const mesh = new THREE.Mesh(discGeo, [coinGold, coinFace, coinGold]); mesh.position.copy(coin.body.position); mesh.quaternion.copy(coin.body.quaternion); root.add(mesh);
    fallingGhosts.push({ mesh, velocity: new THREE.Vector3(overflow ? Math.sign(coin.body.position.x || 1) * 1.8 : coin.body.velocity.x * .2, Math.min(-.6, coin.body.velocity.y), overflow ? 0 : .65), age: 0, overflow });
  }
  function destroy(coin, overflow = false, showFall = false, reason = 'capacity') {
    authority.discard(coin.token); physics.removeBody(coin.body);
    const i = coins.indexOf(coin); if (i >= 0) coins.splice(i, 1);
    if (showFall || overflow) ghost(coin, overflow);
    if (overflow) { stats.overflow++; stats.overflowReasons[reason]++; bus?.emit('pusher:overflow', { count: 1, reason, x: coin.body.position.x, y: coin.body.position.y, z: coin.body.position.z, stage: coin.stage }); }
  }
  function spawn(token, x, y, z, seed = false, source = 'seed') {
    if (!token) return false;
    if (coins.length >= CAPACITY) { authority.requeue(token, x); return false; }
    const body = new CANNON.Body({ mass: .17, material: coinMaterial, shape: coinShape, position: new CANNON.Vec3(x, y, z),
      linearDamping: .08, angularDamping: .76, allowSleep: true, sleepSpeedLimit: .10, sleepTimeLimit: .8 });
    if (!seed) { body.quaternion.setFromEuler(.06 * Math.sin(serial * 2.1), serial * 1.7, .10 * Math.cos(serial * 1.3)); body.angularVelocity.set(.15, .4, .08); }
    physics.addBody(body); authority.bind(token, body);
    const stage = stageOf(body.position); coins.push({ body, token, id: ++serial, pending: false, stage, startStage: stage, source, supportedStages: 0 });
    stats.peakCount = Math.max(stats.peakCount, coins.length); return true;
  }
  function populate(source, number) {
    for (let i = 0; i < number; i++) {
      const stageIndex = 0, stage = STAGES[0], slot = i % 63;
      let col = slot % 9, row = Math.floor(slot / 9), layer = Math.floor(i / 63);
      const z = stage.cliff - .33 - row * .51;
      const onCarriage = Math.abs(z - plates[stageIndex].body.position.z) < .56 + RADIUS;
      const token = authority.reserve(source);
      if (spawn(token, (col - 4) * .64 + (row % 2 ? .015 : -.015), stage.y + .09 + (onCarriage ? .24 : 0) + layer * .14, z, true, source)) { stats[source === 'restore' ? 'restored' : 'seeded']++; if (layer > 0) stats.initialStackCoins++; }
    }
  }
  populate('restore', Math.min(CAPACITY, economy.state.platformCores - authority.getAmplifier().pending)); populate('seed', BALANCE.seedCoins);
  function setLane(x) { lane = clamp(Number.isFinite(x) ? x : 0, -2.8, 2.8); }
  function insert(x = lane) {
    if (disposed || hopperLoading > 0) return false;
    setLane(x); const record = authority.launchCrystal(lane); if (!record) return false;
    flights.push(makeFlight(record));
    hopperFeed = .38; hopperFeedLane = lane;
    stats.inserted++; bus?.emit('pusher:insert', { x: lane }); return true;
  }
  function revealHopper() { hopperLoading = economy.state.hopperRemaining > 0 ? HOPPER_LOAD_SECONDS : 0; return hopperLoading; }
  function unload(count) {
    let inserted = 0; count = clamp(Math.floor(Number.isFinite(count) ? count : 0), 0, 12);
    for (let i = 0; i < count; i++) if (insert((i - (count - 1) / 2) * .48)) inserted++; else break;
    return inserted;
  }
  function flushRewards() {
    if (!pendingRewards.length) return;
    // Recheck the physical chute at settlement time: a side exit during the
    // short combo window is not a forward drop and must never be counted.
    const valid = pendingRewards.filter(({ body }) => body.position.z > 3.2 && body.position.y < .58 && Math.abs(body.position.x) < 4.1);
    for (const coin of pendingRewards) if (!valid.includes(coin)) coin.pending = false;
    const multiplier = 1;
    const count = valid.length, amount = authority.settle(valid.map(coin => coin.token), multiplier);
    for (const coin of valid) { if (coin.supportedStages === 1) { stats.completeTraversals++; if (coin.source === 'pending') stats.paidTraversals++; } destroy(coin, false, true); }
    pendingRewards.length = 0; rewardClock = 0; stats.converted += count; stats.earnedAlloy += amount; flash = multiplier > 1 ? .8 : .4;
    if (count) bus?.emit('pusher:conversion', { count, multiplier, amount });
  }
  function step() {
    elapsed += STEP;
    animateAmplifiers(STEP);
    emissionClock = Math.min(.104, emissionClock + STEP);
    while (emissionClock >= .052 && coins.length < CAPACITY) {
      const batch = authority.nextPending(); if (!batch) { emissionClock = 0; break; }
      const token = authority.reserve('pending'), z = -.30 + (serial % 3) * .18;
      if (spawn(token, clamp(batch.x + ((serial % 5) - 2) * .125, -3.0, 3.0), Math.max(2.2, batch.y + .54 * z + 1.9), z, false, 'pending')) stats.spawnedCoins++;
      emissionClock -= .052;
    }
    for (const plate of plates) {
      // Independent reciprocating shelves. Velocity contacts, never teleported collision bodies.
      const targetZ = plate.rear + .65 + plate.stroke * .5 * (1 - Math.cos((elapsed + plate.phase) * Math.PI * 2 / CYCLE));
      plate.body.velocity.set(0, 0, (targetZ - plate.body.position.z) / STEP);
      if (plate.body.velocity.z > .03) for (const coin of coins) if (coin.stage === plates.indexOf(plate)) coin.body.wakeUp();
    }
    physics.step(STEP); stats.steps++;
    // A full traversal requires real upward supporting contacts on all tiers,
    // including a coin resting on a supported pile rather than bare enamel.
    // Only contacts from this step propagate; old contact history cannot make
    // an airborne chain qualify as a supported shelf.
    const byBody = new Map(coins.map(coin => [coin.body.id, coin]));
    const supportedNow = new Map(), above = new Map();
    for (const contact of physics.contacts) {
      const coin = byBody.get(contact.bi.id) || byBody.get(contact.bj.id);
      if (!coin || Math.abs(contact.ni.y) < .5) continue;
      const otherBody = contact.bi === coin.body ? contact.bj : contact.bi;
      const support = supportingBodies.get(otherBody.id), otherCoin = byBody.get(otherBody.id);
      if (support && coin.body.position.y >= support.top + .03) supportedNow.set(coin.body.id, (supportedNow.get(coin.body.id) || 0) | 1 << support.stage);
      if (otherCoin) {
        const lower = coin.body.position.y < otherBody.position.y ? coin.body : otherBody;
        const upper = lower === coin.body ? otherBody : coin.body;
        const list = above.get(lower.id) || []; list.push(upper.id); above.set(lower.id, list);
      }
    }
    const contactQueue = [...supportedNow.keys()];
    for (let i = 0; i < contactQueue.length; i++) {
      const id = contactQueue[i], mask = supportedNow.get(id);
      for (const upper of above.get(id) || []) {
        const previous = supportedNow.get(upper) || 0;
        if ((previous | mask) !== previous) { supportedNow.set(upper, previous | mask); contactQueue.push(upper); }
      }
    }
    for (const coin of coins) coin.supportedStages |= supportedNow.get(coin.body.id) || 0;
    for (const coin of [...coins]) {
      if (coin.pending) continue;
      const p = coin.body.position;
      const overflowReason = !Number.isFinite(p.x + p.y + p.z) ? 'nonfinite' : Math.abs(p.x) > 4.32 ? 'side' : p.z < -7.15 ? 'rear' : p.y < -3 ? 'fallen' : null;
      if (overflowReason) {
        // A rare sideways bounce is collected by the cabinet return channel.
        // The same valued token is queued again; neither currency nor inventory is lost.
        if (authority.requeue(coin.token, Number.isFinite(p.x) ? p.x : 0)) { stats.recycled++; physics.removeBody(coin.body); coins.splice(coins.indexOf(coin), 1); }
        continue;
      }
      const stage = stageOf(p);
      if (stage > coin.stage) { for (let i = coin.stage; i < stage; i++) stats.cascadeTransfers[i]++; coin.stage = stage; bus?.emit('pusher:cascade', { stage, x: p.x }); }
      if (authority.observe(coin.token)) { coin.pending = true; pendingRewards.push(coin); }
      stats.peakStackHeight = Math.max(stats.peakStackHeight, p.y - STAGES[Math.min(2, stage)].y + 1);
    }
    if (pendingRewards.length) { rewardClock += STEP; if (rewardClock >= .16) flushRewards(); }
  }
  function syncVisuals(dt) {
    for (const plate of plates) { plate.visual.position.copy(plate.body.position); plate.motionLight.emissiveIntensity = plate.body.velocity.z > .01 ? .58 : .15; }
    nozzle.position.x += (lane - nozzle.position.x) * Math.min(1, dt * 12);
    aimGuide.position.x = nozzle.position.x;
    aimMaterial.opacity = .32 + .14 * Math.sin(elapsed * 3.2);
    let i = 0;
    for (const coin of coins) {
      dummy.position.copy(coin.body.position); dummy.quaternion.copy(coin.body.quaternion); dummy.updateMatrix(); bodyMatrix.copy(dummy.matrix);
      discs.setMatrixAt(i, bodyMatrix); rings.setMatrixAt(i, dummy.matrix.multiplyMatrices(bodyMatrix, localRing)); i++;
    }
    for (const mesh of [discs, rings]) { mesh.count = i; mesh.instanceMatrix.needsUpdate = true; }
    for (let j = fallingGhosts.length - 1; j >= 0; j--) {
      const g = fallingGhosts[j]; g.age += dt; g.velocity.y -= dt * 12; g.mesh.position.addScaledVector(g.velocity, dt); g.mesh.rotation.z += dt * 2;
      if (!g.overflow && g.mesh.position.y < -.27) { g.mesh.position.y = -.27; g.velocity.set(0, 0, 0); g.mesh.rotation.x = 0; }
      if (g.age > (g.overflow ? .7 : 1.25)) { root.remove(g.mesh); fallingGhosts.splice(j, 1); }
    }
    flash = Math.max(0, flash - dt * 1.5); light.emissiveIntensity = .32 + flash * .48;
  }
  syncVisuals(0);
  return {
    insert, unload, setLane, revealHopper,
    update(dt) {
      if (disposed) return;
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .1); accumulator += dt;
      hopperLoading = Math.max(0, hopperLoading - dt); hopperFeed = Math.max(0, hopperFeed - dt);
      // The starter bed is display stock until the first paid drop starts the
      // motor. Hopper loading remains animated, and saved machines keep running
      // so a refresh cannot strand coins that were already purchased.
      if (!economy.state.pusherStarted) { accumulator = 0; animateAmplifiers(dt); syncVisuals(dt); return; }
      let substeps = 0; while (accumulator >= STEP && substeps < 6) { step(); accumulator -= STEP; substeps++; }
      syncVisuals(dt);
    },
    getStats: () => Object.freeze({ ...stats, overflowReasons: Object.freeze({ ...stats.overflowReasons }), cascadeTransfers: Object.freeze([...stats.cascadeTransfers]), count: coins.length, capacity: CAPACITY, elapsed, pusherZ: plates[0].body.position.z,
      amplifiers: Object.freeze(AMPLIFIERS.map(gate => Object.freeze({ multiplier: gate.multiplier, x: amplifierX(gate, gateTime), y: gate.y, progress: (amplifierX(gate, gateTime) / gate.amplitude + 1) / 2, hits: authority.getAmplifier()[gate.multiplier === 5 ? 'hits5' : 'hits10'] }))),
      coresInFlight: flights.length, pendingCoins: authority.getAmplifier().pending, mintedCoins: authority.getAmplifier().minted, missedCores: authority.getAmplifier().misses,
      lastAmplification: lastAmplification ? Object.freeze({ ...lastAmplification }) : null, gateTime,
      hopperRemaining: economy.state.hopperRemaining, hopperCapacity: BALANCE.hopperCapacity, hopperBatch: economy.state.hopperBatch,
      started: economy.state.pusherStarted,
      hopperLoading, hopperLoadDuration: HOPPER_LOAD_SECONDS, hopperFeed, hopperFeedLane,
      cycleDuration: CYCLE, cycleProgress: (elapsed % CYCLE) / CYCLE, laneRange: Object.freeze([-2.8, 2.8]),
      stages: Object.freeze(plates.map((p, i) => Object.freeze({ name: p.name, progress: clamp((p.body.position.z - p.rear - .65) / p.stroke, 0, 1), advancing: ((elapsed + p.phase) % CYCLE) < CYCLE / 2, count: coins.filter(c => c.stage === i).length }))),
      stageCounts: Object.freeze(STAGES.map((_, i) => coins.filter(c => c.stage === i).length)), stagePushers: Object.freeze(plates.map(p => p.body.position.z)), lane,
      maxHeight: Math.max(0, ...coins.map(c => c.body.position.y)), awakeBodies: coins.filter(c => c.body.sleepState !== CANNON.Body.SLEEPING).length,
      finite: coins.every(c => Number.isFinite(c.body.position.x + c.body.position.y + c.body.position.z)), physics: 'cannon-es', fixedStep: STEP }),
    dispose() {
      if (disposed) return; disposed = true; authority.close();
      for (const body of [...physics.bodies]) physics.removeBody(body);
      for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of textures) t.dispose();
      group.remove(root); group.remove(front); coins.length = 0; flights.length = 0; fallingGhosts.length = 0; pendingRewards.length = 0;
    },
  };
}
