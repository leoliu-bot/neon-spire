import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** The cabinet is built in screen-facing coordinates; physics lives in pusher.js. */
export function createMintScene(T, parent) {
  const root = new T.Group(); root.name = 'N07 military crystal resource converter'; parent.add(root);
  const geometries = new Set(), materials = new Set(), textures = new Set(), moving = [];
  const mat = (color, metalness = .45, roughness = .34, glow = 0) => { const m = new T.MeshStandardMaterial({ color, metalness, roughness, emissive: color, emissiveIntensity: glow }); materials.add(m); return m; };
  const ink = mat(0x1b262e, .45, .72), teal = mat(0x48544d, .26, .83), gold = mat(0x82897a, .52, .68), cream = mat(0xc3c5b5, .25, .78), black = mat(0x111c23, .3, .80), silver = mat(0x98a299, .55, .67);
  const glowMint = mat(0x94c2c7, .12, .53, .32), glowPink = mat(0x8caeb5, .14, .58, .22), glowGold = mat(0xc4a973, .24, .65, .09);
  const stageLamps = [0x95bdc2, 0x95bdc2, 0xbda876].map(color => mat(color, .1, .55, .25));
  const glass = new T.MeshPhysicalMaterial({ color: 0xa5bdc0, transparent: true, opacity: .06, metalness: .1, roughness: .36, side: T.DoubleSide, depthWrite: false }); materials.add(glass);
  function box(w, h, d, x, y, z, material, parent = root) { const g = new T.BoxGeometry(w, h, d); geometries.add(g); const mesh = new T.Mesh(g, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; }
  function tube(points, material, radius = .06, parent = root) { const g = new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), points.length * 5, radius, 6, false); geometries.add(g); const mesh = new T.Mesh(g, material); parent.add(mesh); return mesh; }
  function cylinder(r, h, x, y, z, material, parent = root) { const g = new T.CylinderGeometry(r, r, h, 24); geometries.add(g); const mesh = new T.Mesh(g, material); mesh.position.set(x, y, z); parent.add(mesh); return mesh; }
  function panel(w, h, x, y, z, draw) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w); draw(c.getContext('2d'), c.width, c.height);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; textures.add(tex);
    const m = new T.MeshBasicMaterial({ map: tex, toneMapped: false }); materials.add(m);
    const g = new T.PlaneGeometry(w, h); geometries.add(g); const mesh = new T.Mesh(g, m); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  }
  // An armored industrial conversion unit shares the base's worn material palette.
  box(11.45, 12.9, .65, 0, 1.40, -7.4, ink);
  box(10.98, 12.55, .16, 0, 1.40, -7.0, gold);
  box(10.67, 12.28, .14, 0, 1.40, -6.88, teal);
  panel(9.8, 9.0, 0, 1.68, -6.76, (a, w, h) => {
    const gradient = a.createLinearGradient(0, 0, 0, h); gradient.addColorStop(0, '#3e4c4d'); gradient.addColorStop(.38, '#26373c'); gradient.addColorStop(1, '#172830'); a.fillStyle = gradient; a.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) { const x = 24 + i * 201; a.fillStyle = '#0d192380'; a.fillRect(x, 0, 3, h); a.fillStyle = '#b7c3b526'; a.fillRect(x + 4, 0, 2, h); }
    for (let j = 0; j < 7; j++) { const y = 27 + j * h / 7; a.fillStyle = '#141e23'; a.fillRect(0, y, w, 6); a.fillStyle = '#9dab9a39'; a.fillRect(0, y + 6, w, 2); }
    let seed = 1973; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let j = 0; j < 1100; j++) { const x = random() * w, y = random() * h; a.fillStyle = j % 3 ? '#dee0c40c' : '#070e1b18'; a.fillRect(x, y, 2 + random() * 31, 1 + random() * 2); }
    for (const x of [49, w - 49]) for (let j = 0; j < 9; j++) { const y = 33 + j * (h - 68) / 8; a.fillStyle = '#718075'; a.beginPath(); a.arc(x, y, 7, 0, Math.PI * 2); a.fill(); a.fillStyle = '#1a2931'; a.fillRect(x - 4, y - 1, 8, 2); }
    a.strokeStyle = '#899b9155'; a.lineWidth = 9; a.beginPath(); a.moveTo(w * .1, h * .08); a.lineTo(w * .1, h * .75); a.lineTo(w * .28, h * .75); a.stroke();
    a.strokeStyle = '#17262e'; a.lineWidth = 4; a.stroke();
    a.fillStyle = '#aebbb385'; a.font = '700 26px Arial'; a.fillText('N-07 / MATERIAL RECOVERY', 99, 88);
  });
  for (const side of [-1, 1]) {
    box(.32, 12.62, 1.0, side * 5.4, 1.40, -4.0, gold);
    box(.38, 11.58, 1.0, side * 5.11, 1.08, -4.2, ink);
    box(.12, 10.62, .17, side * 5.09, .72, -3.60, black);
    for (const y of [-2.40, 1.36, 5.35]) { box(.055, .54, .045, side * 5.09, y, -3.49, glowMint); box(.08, .08, .07, side * 5.45, y + .43, -3.39, silver); }
    for (const level of [2]) {
      const y = 3.0 - level * 2.80, x = side * (4.14 + level * .13);
      box(1.08, 2.50, .38, x + side * .25, y, -2 + level * 2, teal);
      const trim = box(1.0, .095, .20, x + side * .18, y + .91, -.7 + level * 2, gold); trim.rotation.z = side * -.16;
      const stripe = box(.99, .065, .15, x + side * .18, y + .77, -.64 + level * 2, stageLamps[0]); stripe.rotation.z = side * -.16;
      for (let k = 0; k < 4; k++) box(.45, .05, .16, x + side * .20, y + .32 - k * .15, -.65 + level * 2, black);
      const rail = box(.055, 1.46, 2.20, side * (3.73 + level * .18), y + .34, -.15 + level * 2, glass); rail.rotation.x = -.40;
      // Sealed motor housings flank the real playfield; collectible objects live
      // exclusively on the physical tables, with no decorative prize promises.
      const motor = new T.Group(); root.add(motor); motor.position.set(x + side * .13, y - .44, -.38 + level * 2); motor.rotation.z = side * -.13;
      box(.56, .77, .32, 0, 0, 0, silver, motor); box(.47, .57, .027, 0, 0, .18, ink, motor);
      for (let slot = 0; slot < 4; slot++) box(.31, .035, .035, 0, -.15 + slot * .1, .205, slot === 3 ? stageLamps[0] : silver, motor);
    }
  }
  // Two open rails replace the former upper tables. The multiplier carriages
  // and their collision regions are animated by pusher.js on these tracks.
  for (const [index, y] of [3.12, 1.15].entries()) {
    box(7.95, .18, .18, 0, y, -.2, ink);
    box(7.75, .035, .03, 0, y + .11, -.08, silver);
    for (let x = -3.6; x <= 3.61; x += .30) box(.025, .13, .04, x, y, -.04, silver);
    for (const side of [-1, 1]) { box(.32, .60, .40, side * 4.04, y, -.1, cream); box(.045, .19, .04, side * 4.04, y, .13, glowMint); }
  }
  panel(6.7, .34, 0, 4.08, -.06, (a, w, h) => { a.fillStyle = '#172a33'; a.fillRect(0, 0, w, h); a.fillStyle = '#bdccc4'; a.textAlign = 'center'; a.font = '700 33px Arial'; a.fillText('02  扫描分解  →  03  金币成形', w / 2, h * .73); });
  // A flat service identification plate replaces the arcade marquee.
  box(10.6, .64, 1.3, 0, 7.72, -4.65, ink);
  box(10.2, .54, .12, 0, 7.72, -3.92, gold);
  panel(9.92, .43, 0, 7.73, -3.83, (a, w, h) => {
    a.fillStyle = '#26373c'; a.fillRect(0, 0, w, h);
    a.strokeStyle = '#9ba68f'; a.lineWidth = 2; a.strokeRect(3, 3, w - 6, h - 6); a.fillStyle = '#e0e1cb'; a.textAlign = 'center'; a.font = '800 35px "Microsoft YaHei", Arial'; a.fillText('N-07  /  晶核资源转化装置', w / 2, h * .77);
  });
  for (const side of [-1, 1]) { box(.18, .77, .31, side * 5.12, 7.72, -3.8, cream); cylinder(.095, .06, side * 5.12, 8.045, -3.56, black); }
  box(10.62, .16, .92, 0, 8.11, -4.10, cream);
  // Leave the input rail and nozzle exposed. The small coin formations below
  // are separate simulated bodies, not a static tower in the backboard.
  for (const side of [-1, 1]) panel(2.05, .72, side * 3.82, 6.6, -3.1, (a, w, h) => { a.fillStyle = '#26383f'; a.fillRect(0, 0, w, h); a.fillStyle = '#c9cebc'; a.textAlign = 'center'; a.font = '700 106px "Microsoft YaHei", Arial'; a.fillText(side < 0 ? '01 晶核输入' : '批次 / 10 核', w / 2, h * .64); });
  // Transparent funnel, including a narrow outlet directly above the nozzle.
  const hopperShape = new T.Shape(); hopperShape.moveTo(-2.62, 7.27); hopperShape.lineTo(2.62, 7.27); hopperShape.lineTo(.34, 5.32); hopperShape.lineTo(.34, 5.08); hopperShape.lineTo(-.34, 5.08); hopperShape.lineTo(-.34, 5.32); hopperShape.closePath();
  const hopperGlass = new T.MeshPhysicalMaterial({ color: 0xabbec2, transparent: true, opacity: .12, roughness: .37, metalness: .15, side: T.DoubleSide, depthWrite: false }); materials.add(hopperGlass);
  const hopperGeo = new T.ShapeGeometry(hopperShape); geometries.add(hopperGeo);
  const hopperBack = new T.Mesh(hopperGeo, ink); hopperBack.position.z = -3.0; root.add(hopperBack);
  const hopperFront = new T.Mesh(hopperGeo, hopperGlass); hopperFront.position.z = -.50; root.add(hopperFront);
  tube([[-2.62, 7.27, -.45], [-1.76, 6.65, -.45], [-.34, 5.32, -.45], [-.34, 5.08, -.45]], gold, .07);
  tube([[2.62, 7.27, -.45], [1.76, 6.65, -.45], [.34, 5.32, -.45], [.34, 5.08, -.45]], gold, .07);
  box(5.34, .075, .13, 0, 7.29, -.44, cream); box(.83, .18, .40, 0, 5.12, -.47, gold);
  // Front apron surrounds, but never covers, the visible falling/collection zone.
  box(10.94, .8, 1.1, 0, -4.47, 4.15, ink);
  box(10.66, .08, .08, 0, -4.05, 4.77, gold);
  box(10.52, .045, .05, 0, -4.15, 4.80, black);
  panel(5.75, .43, 0, -4.49, 5.18, (a, w, h) => { a.fillStyle = '#23353c'; a.fillRect(0, 0, w, h); a.fillStyle = '#d4c79e'; a.textAlign = 'center'; a.font = '800 42px Arial'; a.fillText('04  落币输送  /  自动入账', w / 2, h * .69); });
  for (const side of [-1, 1]) {
    box(.64, .29, .16, side * 4.5, -4.46, 4.76, gold);
    box(.49, .11, .06, side * 4.5, -4.46, 4.87, black);
  }
  // Combine static meshes by material: elaborate cabinet detail costs few draw calls.
  root.updateMatrixWorld(true);
  const buckets = new Map(), remove = [], inverse = root.matrixWorld.clone().invert();
  root.traverse(mesh => { if (!mesh.isMesh || mesh.material.transparent) return; const source = mesh.geometry.clone(); const geo = source.index ? source.toNonIndexed() : source; if (geo !== source) source.dispose(); geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)); const list = buckets.get(mesh.material) || []; list.push(geo); buckets.set(mesh.material, list); remove.push(mesh); });
  for (const mesh of remove) mesh.removeFromParent();
  for (const [material, list] of buckets) { const geo = mergeGeometries(list, false); if (geo) { geometries.add(geo); const mesh = new T.Mesh(geo, material); mesh.receiveShadow = true; mesh.castShadow = false; root.add(mesh); } for (const g of list) g.dispose(); }
  // Dynamic crystals mirror the authoritative unspent batch. They cannot pay out
  // or increase inventory: only a player insertion creates a valued physical coin.
  const crystalMat = mat(0xa0d5df, .24, .34, .39), crystalGeo = new T.OctahedronGeometry(.23, 0); geometries.add(crystalGeo);
  const slots = [[0, 5.69], [-.38, 6.07], [.38, 6.07], [-.8, 6.47], [0, 6.47], [.8, 6.47], [-1.23, 6.91], [-.41, 6.91], [.41, 6.91], [1.23, 6.91]];
  const crystals = slots.map((slot, i) => { const crystal = new T.Mesh(crystalGeo, crystalMat); crystal.name = `hopper-crystal-${i + 1}`; crystal.scale.set(1, 1.32, 1); crystal.position.set(slot[0], slot[1], -.92); crystal.rotation.set(.15, i * 1.24, (i % 2 ? 1 : -1) * .12); root.add(crystal); return crystal; });
  const feed = new T.Mesh(crystalGeo, crystalMat); feed.name = 'hopper-dispensed-crystal'; feed.scale.set(.85, 1.15, .85); feed.visible = false; root.add(feed);
  const countCanvas = document.createElement('canvas'); countCanvas.width = 512; countCanvas.height = 192; const countContext = countCanvas.getContext('2d');
  const countTexture = new T.CanvasTexture(countCanvas); countTexture.colorSpace = T.SRGBColorSpace; textures.add(countTexture);
  const countMaterial = new T.MeshBasicMaterial({ map: countTexture, toneMapped: false }); materials.add(countMaterial);
  const countGeometry = new T.PlaneGeometry(1.56, .585); geometries.add(countGeometry); const countPanel = new T.Mesh(countGeometry, countMaterial); countPanel.position.set(3.82, 5.66, -.40); root.add(countPanel);
  let previousCount = -1, previousLoading = false;
  moving.push({ update(time, stats) {
    const remaining = Math.max(0, Math.min(10, Math.floor(stats.hopperRemaining || 0))), loading = stats.hopperLoading > 0;
    const progress = loading ? 1 - stats.hopperLoading / (stats.hopperLoadDuration || 1.65) : 1;
    crystals.forEach((crystal, i) => {
      const fall = Math.max(0, Math.min(1, (progress - i * .048) / .50));
      crystal.visible = i < remaining && (!loading || fall > 0);
      crystal.position.set(slots[i][0] * fall, 8.07 + (slots[i][1] - 8.07) * (1 - Math.pow(1 - fall, 2)), -.92);
      crystal.rotation.y = i * 1.24 + Math.sin(time * 1.5 + i) * .09;
    });
    feed.visible = stats.hopperFeed > 0 && !loading;
    if (feed.visible) { const t = 1 - stats.hopperFeed / .38; feed.position.set((stats.hopperFeedLane || 0) * t * t, 5.49 - .82 * t, -.37 - t * 3.6); feed.rotation.z = t * 3.4; }
    if (remaining !== previousCount || loading !== previousLoading) {
      countContext.fillStyle = '#23353e'; countContext.fillRect(0, 0, 512, 192); countContext.textAlign = 'center'; countContext.fillStyle = remaining ? '#d2e1d5' : '#d5b77e'; countContext.font = '800 92px Arial'; countContext.fillText(`${remaining} / 10`, 256, 103); countContext.font = '600 35px Arial'; countContext.fillText(loading ? '回收晶核装载中' : remaining ? '输入仓剩余晶核' : '本批次转化完毕', 256, 157); countTexture.needsUpdate = true; previousCount = remaining; previousLoading = loading;
    }
  } });
  return {
    root,
    update(time, stats = {}) { glowMint.emissiveIntensity = .24; glowPink.emissiveIntensity = .16; stageLamps.forEach((lamp, i) => { lamp.emissiveIntensity = stats.stages?.[i]?.advancing ? .42 : .14; }); for (const item of moving) item.update(time, stats); },
    dispose() { root.removeFromParent(); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); for (const t of textures) t.dispose(); },
  };
}
