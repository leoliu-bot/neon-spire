/** A read-only visual reservoir for already credited base currency. */
export function createBaseHopper(T, parent) {
  const root = new T.Group(); root.name = 'Base / credited alloy reservoir'; parent.add(root);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const geometry = value => { geometries.add(value); return value; };
  const material = (color, metalness = .5, roughness = .64, glow = 0) => {
    const value = new T.MeshStandardMaterial({ color, metalness, roughness, emissive: color, emissiveIntensity: glow }); materials.add(value); return value;
  };
  const steel = material('#3e494b'), edge = material('#82918b'), armor = material('#a9afa0', .25, .78), dark = material('#15222b'), gold = material('#d5ae62', .72, .33), light = material('#8fbfc0', .3, .5, .3);
  function box(w, h, d, x, y, z, mat) { const mesh = new T.Mesh(geometry(new T.BoxGeometry(w, h, d)), mat); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh; }
  box(9.88, 1.52, .42, 0, 7.46, -.38, steel);
  box(9.50, 1.27, .08, 0, 7.47, -.13, dark);
  for (const side of [-1, 1]) {
    box(.29, 1.36, .39, side * 4.77, 7.48, .12, armor);
    box(.075, .48, .06, side * 4.78, 7.64, .36, light);
    box(.65, .19, .48, side * 3.89, 6.81, .05, steel);
    const brace = box(.13, 1.22, .15, side * 4.24, 7.30, .28, edge); brace.rotation.z = side * .37;
    for (let y = 7.03; y < 8.02; y += .44) box(.07, .07, .045, side * 4.76, y, .36, dark);
  }
  box(9.76, .16, .55, 0, 8.18, .05, armor);
  box(9.52, .035, .04, 0, 8.10, .36, edge);
  box(6.58, .17, .44, 0, 6.82, .15, edge);
  box(6.28, .06, .05, 0, 6.89, .42, dark);
  const shape = new T.Shape(); shape.moveTo(-4.59, 8.05); shape.lineTo(4.59, 8.05); shape.lineTo(3.18, 6.94); shape.lineTo(-3.18, 6.94); shape.closePath();
  const glass = new T.MeshPhysicalMaterial({ color: '#9fb7b7', metalness: .05, roughness: .3, transparent: true, opacity: .13, side: T.DoubleSide, depthWrite: false }); materials.add(glass);
  const windowMesh = new T.Mesh(geometry(new T.ShapeGeometry(shape)), glass); windowMesh.position.z = .49; root.add(windowMesh);
  for (let i = 0; i < 9; i++) box(.21, .025, .035, -1.58 + i * .40, 8.185, .347, i % 2 ? dark : edge);

  const coinGeometry = geometry(new T.CylinderGeometry(.158, .158, .047, 20)); coinGeometry.rotateX(Math.PI / 2);
  const coins = new T.InstancedMesh(coinGeometry, gold, 48); coins.frustumCulled = false; root.add(coins);
  const incoming = new T.InstancedMesh(coinGeometry, gold, 8); incoming.frustumCulled = false; root.add(incoming);
  const transform = new T.Object3D();
  for (let i = 0; i < 48; i++) {
    const row = Math.floor(i / 16), col = i % 16;
    transform.position.set(-3.8 + col * .506 + (row % 2 ? .08 : 0), 7.11 + row * .29 + Math.sin(i * 2.1) * .033, .25 + row * .024);
    transform.rotation.set(0, 0, Math.sin(i * 3.72) * .24); transform.scale.set(1, .61, 1); transform.updateMatrix(); coins.setMatrixAt(i, transform.matrix);
  }
  coins.count = incoming.count = 0; coins.instanceMatrix.needsUpdate = true;

  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(768, 224) : null;
  if (canvas) { canvas.width = 768; canvas.height = 224; }
  const context = canvas?.getContext('2d');
  const texture = context ? new T.CanvasTexture(canvas) : null;
  if (texture) { texture.colorSpace = T.SRGBColorSpace; textures.add(texture); }
  const displayMaterial = new T.MeshBasicMaterial(texture ? { map: texture, toneMapped: false } : { color: '#203139', toneMapped: false }); materials.add(displayMaterial);
  const display = new T.Mesh(geometry(new T.PlaneGeometry(3.18, .91)), displayMaterial); display.name = 'Base alloy balance / exact'; display.position.set(0, 7.47, .59); root.add(display);
  box(3.33, 1.04, .08, 0, 7.47, .53, dark);
  let balance = 0, shown = 0, previousBalance = null, previousConverted = null, collectionLeft = 0, collectionCount = 0, collectedTotal = 0, spendingLeft = 0, disposed = false, lastVisible = true;
  const duration = 1.12;
  function draw() {
    display.userData.balance = balance; display.userData.label = `基地资源库 · ${balance} 合金币`;
    if (!context) return;
    context.fillStyle = '#182933'; context.fillRect(0, 0, 768, 224);
    context.fillStyle = '#627577'; context.fillRect(0, 0, 768, 4);
    context.textAlign = 'center'; context.fillStyle = '#abbdb7'; context.font = '600 34px "Microsoft YaHei", Arial'; context.fillText('基地资源库  /  已入账合金币', 384, 51);
    context.fillStyle = '#f2d49a'; context.font = '700 107px "Bahnschrift", "Segoe UI", Arial'; context.fillText(String(balance), 384, 166, 694);
    context.fillStyle = '#698a8d'; context.fillRect(32, 204, 704, 3); texture.needsUpdate = true;
  }
  function update(dt, time, economy = {}, visible = true) {
    if (disposed) return;
    if (!Number.isFinite(economy.alloy) && !Number.isFinite(economy.totalConverted)) return;
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
    lastVisible = !!visible;
    const next = Number.isFinite(economy.alloy) ? Math.max(0, Math.floor(economy.alloy)) : 0;
    const converted = Number.isFinite(economy.totalConverted) ? Math.max(0, Math.floor(economy.totalConverted)) : 0;
    if (previousConverted !== null && converted > previousConverted) {
      const gained = converted - previousConverted; collectionCount = Math.min(8, gained + (!visible && collectionLeft > 0 ? collectionCount : 0)); collectionLeft = duration; collectedTotal += gained;
    }
    if (previousBalance !== null && next < previousBalance) spendingLeft = .55;
    if (next !== balance || previousBalance === null) { balance = next; shown = balance ? Math.min(48, balance, Math.ceil(Math.log2(balance + 1) * 4)) : 0; coins.count = shown; draw(); }
    previousBalance = next; previousConverted = converted;
    if (visible) collectionLeft = Math.max(0, collectionLeft - dt); spendingLeft = Math.max(0, spendingLeft - dt);
    incoming.count = visible && collectionLeft > 0 ? collectionCount : 0;
    if (incoming.count) {
      const progress = 1 - collectionLeft / duration;
      for (let i = 0; i < incoming.count; i++) {
        const t = Math.max(0, Math.min(1, (progress - i * .036) / .73));
        const side = i % 2 ? 1 : -1;
        transform.position.set(side * (1.84 + (i % 4) * .42), 8.28 - .94 * t * t, .63);
        transform.rotation.set(0, t * 3.1 + i, t * .8); transform.scale.set(.8, .8, .8); transform.updateMatrix(); incoming.setMatrixAt(i, transform.matrix);
      }
      incoming.instanceMatrix.needsUpdate = true;
    }
    light.emissiveIntensity = .18 + (collectionLeft > 0 ? .26 * Math.sin((duration - collectionLeft) * 12) ** 2 : 0);
    display.scale.setScalar(spendingLeft > 0 ? 1 - .018 * Math.sin(spendingLeft / .55 * Math.PI) : 1);
  }
  draw();
  return { root, update,
    getState: () => Object.freeze({ balance, displayCoins: shown, visualCapacity: 48, collectionActive: lastVisible && collectionLeft > 0, collectionQueued: !lastVisible && collectionLeft > 0, incomingCoins: incoming.count, collectionProgress: collectionLeft > 0 ? 1 - collectionLeft / duration : 1, collectedTotal, spendingActive: spendingLeft > 0, bounds: Object.freeze({ minX: -4.95, maxX: 4.95, minY: 6.66, maxY: 8.43 }) }),
    dispose() { if (disposed) return; disposed = true; root.removeFromParent(); for (const value of geometries) value.dispose(); for (const value of materials) value.dispose(); for (const value of textures) value.dispose(); },
  };
}
