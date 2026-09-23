import { ROOM_DEFS } from './economy.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBaseHopper } from './base-hopper.js';
export { ROOM_DEFS } from './economy.js';

/** A front cutaway base: six independently furnished, inspectable rooms. */
export function createRooms(T, group) {
  const root = new T.Group(); root.name = 'Six-room cutaway outpost'; group.add(root);
  const baseHopper = createBaseHopper(T, root);
  const geometries = new Map(), ownedGeometries = new Set(), textures = [], materials = new Set(), roomTargets = [], entries = [];
  const ownGeometry = geometry => { ownedGeometries.add(geometry); return geometry; };
  let disposed = false;
  const material = (color, glow = false) => {
    const m = new T.MeshStandardMaterial({ color, roughness: .66, metalness: .22, emissive: color, emissiveIntensity: glow ? .8 : .075 });
    materials.add(m); return m;
  };
  const m = { frame: material('#111c2d'), edge: material('#526170'), steel: material('#354558'), wall: material('#1d3041'), floor: material('#65747f'), black: material('#081522'), white: material('#dde4de'), skin: material('#dab59a'), amber: material('#ffb762', true) };
  const notificationRed = new T.MeshBasicMaterial({ color: '#ff354d', toneMapped: false });
  const notificationRim = new T.MeshBasicMaterial({ color: '#182432', toneMapped: false });
  materials.add(notificationRed); materials.add(notificationRim);
  function box(g, w, h, d, mat, x = 0, y = 0, z = 0, rz = 0) {
    const key = `${w},${h},${d}`;
    if (!geometries.has(key)) geometries.set(key, new T.BoxGeometry(w, h, d));
    const o = new T.Mesh(geometries.get(key), mat); o.position.set(x, y, z); o.rotation.z = rz; o.castShadow = true; o.receiveShadow = true; g.add(o); return o;
  }
  function circle(g, radius, mat, x, y, z, inner = 0) {
    const geo = ownGeometry(inner ? new T.RingGeometry(inner, radius, 32) : new T.CircleGeometry(radius, 24));
    const o = new T.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o;
  }
  function canvas(width, height) {
    const c = typeof document !== 'undefined' ? document.createElement('canvas') : typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : null;
    if (c) { c.width = width; c.height = height; }
    return c;
  }
  function paintedPlane(g, width, height, x, y, z, paint, fallback = '#344451') {
    const c = canvas(1024, 576), ctx = c?.getContext('2d');
    let mat;
    if (ctx) {
      paint(ctx, c.width, c.height);
      const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; textures.push(tex);
      mat = new T.MeshBasicMaterial({ map: tex, toneMapped: false });
    } else mat = new T.MeshBasicMaterial({ color: fallback, toneMapped: false });
    materials.add(mat); const mesh = new T.Mesh(ownGeometry(new T.PlaneGeometry(width, height)), mat); mesh.position.set(x, y, z); g.add(mesh); return mesh;
  }
  // These original textures supply fine wall seams, light falloff and wear without extra draw calls.
  function interior(g, def, index) {
    const colors = ['#354c53', '#554a3b', '#493d4a', '#394a60', '#534b39', '#3b5045'];
    paintedPlane(g, 5.16, 2.91, 0, 0, .015, (ctx, w, h) => {
      ctx.fillStyle = colors[index]; ctx.fillRect(0, 0, w, h);
      const depth = ctx.createLinearGradient(0, 0, 0, h); depth.addColorStop(0, '#040d1ddd'); depth.addColorStop(.3, '#07142022'); depth.addColorStop(.68, '#08142044'); depth.addColorStop(1, '#07101dcc'); ctx.fillStyle = depth; ctx.fillRect(0, 0, w, h);
      for (let k = 0; k < 7; k++) {
        const px = 35 + k * 151; ctx.fillStyle = '#070e1855'; ctx.fillRect(px, 78, 2, 400); ctx.fillStyle = '#d7e3d417'; ctx.fillRect(px + 3, 78, 2, 400);
        for (let j = 0; j < 3; j++) { const py = 135 + j * 141; ctx.strokeStyle = '#bed4cf1c'; ctx.lineWidth = 2; ctx.strokeRect(px + 11, py, 119, 109); ctx.fillStyle = '#090f1999'; ctx.fillRect(px + 18, py + 8, 5, 5); }
      }
      // The reflected overhead light and bevelled side walls make the fixed front view read as a cutaway.
      const light = ctx.createRadialGradient(w * .5, 105, 20, w * .5, 180, 490); light.addColorStop(0, def.color + '38'); light.addColorStop(1, def.color + '00'); ctx.fillStyle = light; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0a152599'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(61, 48); ctx.lineTo(61, h - 65); ctx.lineTo(0, h); ctx.fill();
      ctx.fillStyle = '#c0c3ac1b'; ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w - 61, 48); ctx.lineTo(w - 61, h - 65); ctx.lineTo(w, h); ctx.fill();
      ctx.fillStyle = '#0b172099'; ctx.fillRect(55, 91, w - 110, 21);
      ctx.strokeStyle = '#89978a66'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(65, 112); ctx.lineTo(770, 112); ctx.lineTo(770, 270); ctx.lineTo(960, 270); ctx.stroke();
      ctx.strokeStyle = '#141e2a'; ctx.lineWidth = 3; ctx.stroke();
      for (let k = 0; k < 17; k++) { ctx.fillStyle = '#d8ddd914'; ctx.fillRect(50 + ((k * 127) % 913), 164 + ((k * 79) % 307), 10 + k % 4 * 7, 1); }
      ctx.fillStyle = '#13202d'; ctx.fillRect(832, 133, 101, 88); ctx.fillStyle = '#748184'; for (let k = 0; k < 7; k++) ctx.fillRect(842, 144 + k * 9, 80, 3);
      ctx.font = 'bold 22px Arial'; ctx.fillStyle = '#d6dbcd55'; ctx.fillText(`SECTOR 0${index + 1}`, 79, 470);
      const floor = ctx.createLinearGradient(0, h - 83, 0, h); floor.addColorStop(0, '#101c27'); floor.addColorStop(.65, '#69746b'); floor.addColorStop(1, '#273c45'); ctx.fillStyle = floor; ctx.fillRect(0, h - 80, w, 80);
      ctx.strokeStyle = '#b2c6b13d'; ctx.lineWidth = 2; for (let k = -2; k < 12; k++) { ctx.beginPath(); ctx.moveTo(110 + k * 87, h - 80); ctx.lineTo(-50 + k * 126, h); ctx.stroke(); }
      ctx.fillStyle = def.color + '20'; ctx.fillRect(80, h - 56, w - 160, 11); ctx.fillStyle = '#00000066'; ctx.fillRect(0, h - 3, w, 3);
    }, colors[index]);
  }
  function sign(g, text, small, color, w, h, x, y, z, compact = false) {
    const c = canvas(w < 1 ? 240 : 640, compact ? 160 : 224), ctx = c?.getContext('2d');
    if (!ctx) { const object = box(g, w, h, .02, m.black, x, y, z); return { draw() {}, object }; }
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    textures.push(tex); const mat = new T.MeshBasicMaterial({ map: tex, toneMapped: false }); materials.add(mat);
    const o = new T.Mesh(ownGeometry(new T.PlaneGeometry(w, h)), mat); o.position.set(x, y, z); g.add(o);
    function draw(title, sub) {
      ctx.fillStyle = '#122330'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = color; ctx.fillRect(0, 0, 8, c.height); ctx.fillStyle = '#afc6c522'; ctx.fillRect(8, 0, c.width, 2);
      ctx.fillStyle = '#f5f2df'; ctx.font = `700 ${compact ? (w < 1 ? 70 : 78) : 61}px "Microsoft YaHei", Arial`; ctx.fillText(title, 24, compact ? 87 : 88, c.width - 43);
      ctx.fillStyle = color; ctx.font = `600 ${compact ? 29 : 33}px "Microsoft YaHei", Arial`; ctx.fillText(sub, 25, compact ? 137 : 163, c.width - 42);
      tex.needsUpdate = true;
    }
    draw(text, small); return { draw, object: o };
  }
  // One broad label keeps the name and full level fraction legible in the two-column
  // mobile layout. Repainting the same texture avoids allocating assets per upgrade.
  function roomPlaque(room, def) {
    const c = canvas(1024, 172), ctx = c?.getContext('2d');
    let tex = null;
    if (ctx) { tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; textures.push(tex); }
    const mat = new T.MeshBasicMaterial({ ...(tex ? { map: tex } : { color: '#142935' }), toneMapped: false }); materials.add(mat);
    const object = new T.Mesh(ownGeometry(new T.PlaneGeometry(4.70, .72)), mat);
    object.name = `Room nameplate / ${def.id}`; object.position.set(0, 1.075, 1.65); room.add(object);
    function draw(level, maxLevel) {
      const displayLevel = `LV.${String(level).padStart(2, '0')} /${maxLevel}`;
      object.userData.label = `${def.name} · ${displayLevel}`;
      object.userData.displayLevel = displayLevel;
      if (!ctx) return;
      ctx.fillStyle = '#122330'; ctx.fillRect(0, 0, 1024, 172);
      const background = ctx.createLinearGradient(0, 0, 0, 172);
      background.addColorStop(0, '#305064'); background.addColorStop(.18, '#1b3544'); background.addColorStop(1, '#101d29');
      ctx.fillStyle = background; ctx.fillRect(8, 3, 1013, 166);
      ctx.fillStyle = def.color; ctx.fillRect(0, 0, 9, 172);
      ctx.fillStyle = '#c5e4df49'; ctx.fillRect(9, 0, 1015, 3);
      ctx.fillStyle = '#f5f2df'; ctx.font = '700 81px "Microsoft YaHei", Arial'; ctx.textAlign = 'left';
      ctx.fillText(def.name, 28, 113, 551);
      ctx.fillStyle = level ? def.color : '#a6b7bc'; ctx.font = '700 77px "Bahnschrift", "Segoe UI", Arial'; ctx.textAlign = 'right';
      ctx.fillText(displayLevel, 996, 113, 404);
      ctx.fillStyle = '#d4e3d619'; ctx.fillRect(27, 151, 969, 4);
      ctx.fillStyle = def.color; ctx.fillRect(27, 151, 969 * level / maxLevel, 4);
      tex.needsUpdate = true;
    }
    return { draw, object };
  }
  function batch(g) {
    g.updateMatrixWorld(true); const inverse = g.matrixWorld.clone().invert(), buckets = new Map(), old = [];
    g.traverse(o => {
      if (!o.isMesh || o.userData.dynamic || o.material.map) return;
      let geo = o.geometry.clone(); if (geo.index) { const indexed = geo; geo = geo.toNonIndexed(); indexed.dispose(); }
      geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
      if (!buckets.has(o.material)) buckets.set(o.material, []); buckets.get(o.material).push(geo); old.push(o);
    });
    old.forEach(o => o.removeFromParent());
    for (const [mat, geos] of buckets) { const geo = mergeGeometries(geos, false); if (geo) { const o = new T.Mesh(ownGeometry(geo), mat); o.castShadow = true; o.receiveShadow = true; g.add(o); } geos.forEach(o => o.dispose()); }
  }
  function resident(parent, color, x, y, variant = 0) {
    const actor = new T.Group(), body = new T.Group(); actor.add(body); actor.position.set(x, y, 1.1); parent.add(actor);
    const suit = material(color), hair = material(variant % 2 ? '#6d4b47' : '#34404b');
    for (const side of [-1, 1]) { box(body, .13, .27, .18, m.black, side * .10, .13); box(body, .18, .10, .24, m.steel, side * .10, .025, .035); }
    box(body, .39, .37, .22, suit, 0, .45); box(body, .09, .31, .24, m.white, -.13, .45, .015);
    const head = new T.Mesh(ownGeometry(new T.SphereGeometry(.165, 12, 9)), m.skin); head.scale.set(.91, 1.03, .84); head.position.set(0, .8, .015); body.add(head);
    const cap = new T.Mesh(ownGeometry(new T.SphereGeometry(.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * .54)), hair); cap.scale.set(1, .7, .88); cap.position.set(0, .84, 0); body.add(cap);
    box(body, .07, .19, .24, hair, -.14, .8, -.02);
    if (variant % 2 === 0) { box(body, .41, .13, .34, suit, 0, .98); box(body, .48, .04, .38, m.white, 0, .9, .02); }
    box(body, .04, .035, .015, m.black, .055, .82, .14); box(body, .04, .035, .015, m.black, -.065, .82, .14);
    box(body, .11, .02, .015, hair, 0, .74, .145); box(body, .065, .08, .035, m.amber, .07, .52, .132);
    const arm = box(body, .12, .32, .18, suit, .25, .48, 0, -.2); arm.userData.dynamic = true;
    box(body, .13, .16, .17, m.skin, .29, .25); box(body, .12, .34, .18, suit, -.25, .48, 0, .16);
    batch(body); return { actor, body, arm, x, phase: x * 1.7 + variant };
  }
  function consoleDesk(g, x, y, accent, width = 1.65) {
    box(g, width, .55, .6, m.steel, x, y + .275, .28); box(g, width + .13, .09, .72, m.floor, x, y + .6, .31);
    box(g, width - .25, .53, .08, m.black, x, y + 1.04, .10); box(g, width - .38, .38, .025, accent, x, y + 1.06, .16);
    for (let k = 0; k < 5; k++) box(g, .055, .035, .03, k % 2 ? accent : m.white, x - .39 + k * .19, y + .42, .602);
    for (let k = 0; k < 3; k++) box(g, .57, .025, .02, m.black, x - .1, y + .95 + k * .09, .182);
  }
  // A continuous concrete shell makes the room grid read as a single habitable base.
  box(root, 11.05, 9.66, .65, m.frame, 0, 1.82, -.45);
  for (const x of [-5.43, 0, 5.43]) { box(root, .22, 9.7, 1.6, m.edge, x, 1.82, .05); box(root, .06, 9.5, .05, m.black, x, 1.82, .9); }
  for (const y of [-3.0, .15, 3.3, 6.48]) { box(root, 11.15, .20, 1.7, m.edge, 0, y, .10); box(root, 10.85, .075, .09, m.black, 0, y - .03, 1.02); }
  const shell = new T.Group(); root.add(shell);
  for (let i = 0; i < 18; i++) box(shell, .12, .045, .05, m.amber, -5.04 + i * .59, 6.48, 1.02);
  batch(shell);
  ROOM_DEFS.forEach((def, index) => {
    const x = index % 2 ? 2.72 : -2.72, y = 4.89 - Math.floor(index / 2) * 3.15;
    const room = new T.Group(); room.name = `Room / ${def.id}`; room.position.set(x, y, 0); room.userData.roomId = def.id; root.add(room);
    const accent = material(def.color, true), flatAccent = material(def.color), staticRoom = new T.Group(); room.add(staticRoom);
    box(staticRoom, 5.18, 2.93, .15, m.wall, 0, 0, -.10);
    interior(staticRoom, def, index);
    box(staticRoom, 5.16, .15, 1.48, m.floor, 0, -1.40, .58);
    box(staticRoom, 5.1, .10, .60, m.steel, 0, 1.4, .38);
    for (const px of [-2.27, 2.27]) { box(staticRoom, .12, 2.55, .22, m.edge, px, 0, .08); box(staticRoom, .022, .64, .04, accent, px + (px < 0 ? .10 : -.10), .72, .23); }
    for (const py of [-.86, .02, .93]) box(staticRoom, 4.42, .032, .07, m.steel, 0, py, .03);
    for (let j = 0; j < 6; j++) box(staticRoom, .13, .05, .05, m.black, -1.25 + j * .28, 1.06, .13);
    box(staticRoom, 3.6, .09, .20, m.black, 0, .80, .32); box(staticRoom, 3.27, .035, .04, m.amber, 0, .758, .43);
    box(staticRoom, 2.9, .06, .08, accent, 0, 1.22, .23);
    for (const px of [-2.32, 2.32]) { box(staticRoom, .085, 2.36, .19, m.black, px, -.05, 1.46); box(staticRoom, .023, 2.29, .03, m.edge, px, -.05, 1.565); }
    box(staticRoom, 4.68, .085, .16, m.black, 0, -1.25, 1.4);
    for (let k = 0; k < 5; k++) { box(staticRoom, .22, .035, .03, flatAccent, -2.02 + k * .18, -1.25, 1.495, -.3); box(staticRoom, .22, .035, .03, flatAccent, 1.30 + k * .18, -1.25, 1.495, -.3); }
    for (const px of [-2.39, 2.39]) for (const py of [-1.18, 1.12]) circle(staticRoom, .039, m.white, px, py, .55);
    batch(staticRoom);
    const furniture = new T.Group(); room.add(furniture); const workers = [];
    if (def.id === 'command') {
      box(furniture, 2.2, 1.1, .12, m.black, -.85, .20, .14); box(furniture, 1.96, .89, .035, accent, -.85, .21, .215);
      for (let i = 0; i < 6; i++) { box(furniture, .028, .82, .04, m.wall, -1.65 + i * .32, .22, .242); box(furniture, 1.9, .025, .04, m.wall, -.85, -.12 + i * .135, .242); }
      circle(furniture, .37, m.white, -.92, .27, .271, .335); circle(furniture, .09, m.amber, -.52, .42, .275);
      consoleDesk(furniture, -.9, -1.31, accent, 2.22); consoleDesk(furniture, 1.52, -1.31, accent, .78);
      workers.push(resident(furniture, '#55b5c4', .65, -1.30, 1), resident(furniture, '#729aad', -1.88, -1.30, 2));
    } else if (def.id === 'energy') {
      for (let k = 0; k < 3; k++) { const px = -.3 + k * .67; box(furniture, .54, 1.64, .5, m.steel, px, -.33, .3); box(furniture, .32, 1.15, .04, accent, px, -.29, .575); for (let j = 0; j < 5; j++) box(furniture, .41, .045, .055, m.black, px, -.82 + j * .24, .61); box(furniture, .42, .13, .44, m.white, px, .52, .31); }
      consoleDesk(furniture, -1.75, -1.3, accent, .79); box(furniture, 2.65, .08, .19, m.edge, .54, .76, .25);
      workers.push(resident(furniture, '#cf9b50', -.79, -1.30, 0));
    } else if (def.id === 'armory') {
      box(furniture, 2.55, 1.30, .18, m.black, -.91, .14, .20);
      for (let j = 0; j < 3; j++) { box(furniture, 1.28, .11, .12, m.edge, -.94, -.29 + j * .4, .4); box(furniture, .61, .23, .14, m.white, -1.23, -.31 + j * .4, .42); box(furniture, .12, .28, .12, flatAccent, -1.12, -.46 + j * .4, .42, -.2); box(furniture, .23, .05, .1, accent, -.86, -.2 + j * .4, .43); }
      consoleDesk(furniture, -.92, -1.31, accent, 2.6); box(furniture, .90, 1.85, .59, m.steel, 1.73, -.36, .28);
      for (let j = 0; j < 5; j++) box(furniture, .64, .22, .05, m.black, 1.73, -.96 + j * .29, .60);
      workers.push(resident(furniture, '#d77593', .70, -1.30, 1));
    } else if (def.id === 'armor') {
      box(furniture, 1.3, 2.0, .2, m.black, -.97, -.26, .16); circle(furniture, .67, accent, -.97, -.02, .285, .635);
      box(furniture, .64, .61, .29, m.white, -.97, -.16, .38); box(furniture, .43, .30, .28, m.steel, -.97, .41, .36);
      for (const side of [-1, 1]) { box(furniture, .24, .51, .28, flatAccent, -.97 + side * .43, -.17, .35, side * .13); box(furniture, .23, .40, .3, m.edge, -.97 + side * .19, -.69, .39); }
      box(furniture, .20, .09, .05, accent, -.97, .42, .515); consoleDesk(furniture, 1.61, -1.31, accent, 1.06);
      workers.push(resident(furniture, '#82a6d2', .57, -1.30, 0));
    } else if (def.id === 'mint') {
      box(furniture, 1.72, 1.50, .56, m.steel, -.92, -.39, .28); box(furniture, 1.16, .82, .1, m.black, -.92, -.41, .61);
      box(furniture, 1.24, .22, .57, flatAccent, -.92, .22, .31); box(furniture, .18, .48, .1, m.white, -.92, -.11, .69);
      for (let j = 0; j < 5; j++) { box(furniture, .54, .09, .20, flatAccent, -1.18 + (j % 2) * .5, -.69 + Math.floor(j / 2) * .11, .80); }
      box(furniture, 1.46, 1.02, .5, m.black, 1.43, -.79, .24); circle(furniture, .33, m.edge, 1.43, -.73, .51, .25); circle(furniture, .08, accent, 1.43, -.73, .53);
      box(furniture, 1.51, .12, .58, m.floor, 1.43, -.22, .27); for (let j = 0; j < 3; j++) box(furniture, .30, .17, .23, flatAccent, 1.01 + j * .4, -.06, .40);
      workers.push(resident(furniture, '#cbae52', .38, -1.30, 0));
    } else {
      // Personnel processing terminal, a human scan and an equipment locker.
      // The former fusion ring is deliberately absent from the recruitment room.
      box(furniture, 1.98, 1.87, .35, m.steel, -.99, -.20, .22);
      box(furniture, 1.70, 1.51, .05, m.black, -.99, -.10, .43);
      box(furniture, .045, 1.40, .025, accent, -1.72, -.10, .47);
      box(furniture, .045, 1.40, .025, accent, -.26, -.10, .47);
      const hologram = new T.MeshBasicMaterial({ color: '#8cbfc3', transparent: true, opacity: .67, toneMapped: false }); materials.add(hologram);
      circle(furniture, .157, hologram, -.99, .42, .47);
      box(furniture, .35, .47, .045, hologram, -.99, .035, .47);
      for (const side of [-1, 1]) { box(furniture, .10, .45, .045, hologram, -.99 + side * .27, .025, .47, side * .14); box(furniture, .13, .39, .045, hologram, -.99 + side * .12, -.40, .47, side * .03); }
      box(furniture, 2.05, .12, .67, m.white, -.99, -.94, .40);
      for (let k = 0; k < 6; k++) box(furniture, .15, .035, .06, k === 5 ? accent : m.edge, -1.56 + k * .22, -.855, .71);
      box(furniture, 1.20, 1.93, .45, m.steel, 1.54, -.24, .28);
      box(furniture, 1.04, 1.67, .06, m.black, 1.54, -.22, .54);
      for (const px of [1.26, 1.80]) { box(furniture, .34, .43, .065, m.white, px, .09, .59); box(furniture, .13, .46, .08, m.edge, px, -.47, .60); }
      box(furniture, 1.09, .07, .08, accent, 1.54, .66, .59);
      workers.push(resident(furniture, '#81949a', .40, -1.30, 0));
    }
    // Workers keep independent meshes; furniture is merged per material to limit draw calls.
    const actorNodes = workers.map(worker => worker.actor); actorNodes.forEach(node => furniture.remove(node)); batch(furniture); actorNodes.forEach(node => furniture.add(node));
    // Moving mechanisms remain separate from the batched architecture.
    const mechanism = new T.Group(); furniture.add(mechanism); const moving = [];
    if (def.id === 'command') {
      const scan = new T.Group(); scan.position.set(-.92, .27, .295); mechanism.add(scan);
      box(scan, .023, .33, .025, m.amber, 0, .165); batch(scan); moving.push({ object: scan, type: 'rotate', speed: -.63 });
    } else if (def.id === 'energy') {
      for (let k = 0; k < 3; k++) { const bar = box(mechanism, .19, .96, .022, m.white, -.3 + k * .67, -.29, .655); moving.push({ object: bar, type: 'charge', phase: k * 1.5, y: -.29 }); }
    } else if (def.id === 'armory') {
      const scan = box(mechanism, 2.04, .025, .02, accent, -.91, .30, .515); moving.push({ object: scan, type: 'scan', y: .18 });
      for (let k = 0; k < 4; k++) circle(mechanism, .035, accent, 1.51 + (k % 2) * .38, -.69 + Math.floor(k / 2) * .3, .647);
    } else if (def.id === 'armor') {
      const ring = new T.Group(); ring.position.set(-.97, -.02, .59); mechanism.add(ring);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; box(ring, .035, .17, .025, m.white, Math.sin(a) * .68, Math.cos(a) * .68, 0, -a); } batch(ring); moving.push({ object: ring, type: 'rotate', speed: .35 });
    } else if (def.id === 'mint') {
      const press = box(mechanism, .70, .11, .07, m.white, -.92, -.21, .87); moving.push({ object: press, type: 'press', y: -.21 });
      for (let k = 0; k < 3; k++) { const coin = circle(mechanism, .085, m.amber, 1.43, -.105, .55); moving.push({ object: coin, type: 'coin', phase: k / 3 }); }
    } else {
      const scan = box(mechanism, 1.34, .026, .027, accent, -.99, .18, .535); moving.push({ object: scan, type: 'scan', y: .03 });
      for (const px of [-1.52, -.46]) box(mechanism, .10, .08, .028, m.white, px, -.66, .535);
    }
    const extras = [];
    // Three prebuilt additions mark progression tiers; level 20 needs no new meshes.
    for (let tier = 1; tier <= 3; tier++) {
      const extra = new T.Group(); furniture.add(extra);
      const px = tier === 2 ? -1.65 : -2.09, py = tier === 3 ? -.79 : -1.04;
      box(extra, .36, .25, .32, m.steel, px, py, 1.24); box(extra, .38, .045, .34, m.edge, px, py + .14, 1.24);
      box(extra, .06, .23, .03, flatAccent, px - .09, py, 1.42); box(extra, .12, .06, .03, m.white, px + .055, py, 1.42);
      if (tier === 3) { box(extra, .54, .34, .05, m.black, 1.63, .45, .73); box(extra, .44, .23, .02, accent, 1.63, .46, .769); }
      batch(extra); extras.push({ level: tier * 5, object: extra });
    }
    const shutter = new T.Group(), slats = []; room.add(shutter);
    const doorMetal = material(['#334851', '#574d3c', '#4b4149', '#3a4657', '#534c3e', '#3e4c44'][index]);
    for (let j = 0; j < 10; j++) {
      const slat = new T.Group(), baseY = -1.14 + j * .218; slat.position.y = baseY; shutter.add(slat);
      box(slat, 4.58, .209, .075, doorMetal, 0, 0, 1.47); box(slat, 4.53, .015, .022, m.edge, 0, .093, 1.524);
      box(slat, 4.54, .022, .023, m.black, 0, -.09, 1.525);
      for (const px of [-1.96, 1.96]) box(slat, .24, .059, .025, flatAccent, px, 0, 1.535, -.45);
      batch(slat); slats.push({ object: slat, baseY, targetY: 1.30 - j * .011 });
    }
    const lockLabel = sign(shutter, `${def.cost} 合金币`, '建造此房间  /  点击查看', def.color, 3.23, .88, 0, -.29, 1.60);
    const seal = sign(shutter, def.icon, `SECTOR 0${index + 1}`, def.color, 1.22, .53, 0, .56, 1.59, true);
    const plaque = roomPlaque(room, def);
    const notification = new T.Group(); notification.name = `Upgrade notification / ${def.id}`;
    notification.position.set(2.35, 1.415, 1.78); notification.visible = false; room.add(notification);
    circle(notification, .194, notificationRim, 0, 0, 0);
    circle(notification, .144, notificationRed, 0, 0, .012);
    const lamps = [];
    for (let k = 0; k < 4; k++) { box(room, .24, .049, .03, m.black, -1.94 + k * .31, 1.441, 1.66); lamps.push(box(room, .17, .031, .03, accent, -1.94 + k * .31, 1.441, 1.68)); }
    const highlightMaterial = new T.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }); materials.add(highlightMaterial);
    const outline = new T.Group(); room.add(outline); box(outline, 4.93, .042, .025, highlightMaterial, 0, -1.34, 1.71); box(outline, 4.93, .042, .025, highlightMaterial, 0, 1.43, 1.71);
    for (const px of [-2.44, 2.44]) box(outline, .042, 2.8, .025, highlightMaterial, px, .045, 1.71); batch(outline);
    const sparkGeometry = ownGeometry(new T.PlaneGeometry(.043, .043)), sparks = new T.InstancedMesh(sparkGeometry, highlightMaterial, 12); sparks.position.z = 1.73; sparks.frustumCulled = false; room.add(sparks);
    const hit = new T.Mesh(ownGeometry(new T.PlaneGeometry(5.12, 3.02)), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.position.z = 1.85; hit.name = `Inspect ${def.id}`; hit.userData.roomId = def.id; materials.add(hit.material); room.add(hit);
    roomTargets.push({ id: def.id, object: hit }); entries.push({ def, room, furniture, shutter, plaque, notification, canPurchase: false, lockLabel, seal, slats, workers, moving, extras, lamps, outline, sparks, highlightMaterial, highlightLeft: 0, open: def.initialLevel ? 1 : 0, level: -1 });
  });
  const sparkTransform = new T.Object3D();
  function highlight(id, seconds = 2.2) {
    const entry = entries.find(item => item.def.id === id);
    if (entry) { entry.highlightLeft = Math.max(.1, seconds); entry.highlightDuration = entry.highlightLeft; }
  }
  function update(dt, time, economyState = {}, visible = true) {
    if (disposed) return;
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, .1)) : 0;
    time = Number.isFinite(time) ? time : 0;
    baseHopper.update(dt, time, economyState, visible);
    for (const entry of entries) {
      const stats = economyState.roomStats?.find(room => room.id === entry.def.id);
      const rawLevel = economyState.rooms?.[entry.def.id] ?? stats?.level ?? entry.def.initialLevel;
      const level = Math.max(0, Math.min(entry.def.maxLevel, Number.isFinite(rawLevel) ? Math.floor(rawLevel) : entry.def.initialLevel));
      const cost = level ? stats?.upgradeCost : stats?.unlockCost ?? entry.def.cost;
      entry.canPurchase = typeof stats?.canPurchase === 'boolean' ? stats.canPurchase : !!stats?.recruitAvailable || level < entry.def.maxLevel && Number.isFinite(cost) && (economyState.alloy ?? 0) >= cost;
      entry.notification.visible = entry.canPurchase;
      entry.room.userData.level = level; entry.room.userData.canPurchase = entry.canPurchase;
      if (level !== entry.level) {
        const previous = entry.level; entry.level = level; entry.furniture.visible = level > 0;
        if (previous < 0) entry.open = level ? 1 : 0;
        else if (level > previous) highlight(entry.def.id, previous ? 2.1 : 2.6);
        entry.plaque.draw(level, entry.def.maxLevel);
        entry.extras.forEach(extra => extra.object.visible = level >= extra.level);
        entry.lamps.forEach((lamp, index) => lamp.visible = level >= [1, 5, 10, 20][index]);
      }
      entry.open = level ? Math.min(1, entry.open + dt / 1.55) : Math.max(0, entry.open - dt / 1.1);
      const lift = entry.open * entry.open * (3 - 2 * entry.open);
      entry.shutter.visible = entry.open < 1;
      for (const slat of entry.slats) { slat.object.position.y = slat.baseY + (slat.targetY - slat.baseY) * lift; slat.object.scale.y = 1 - lift * .91; }
      entry.lockLabel.object.visible = entry.open < .26; entry.seal.object.visible = entry.open < .26;
      entry.lockLabel.object.position.y = -.29 + lift * 1.14; entry.seal.object.position.y = .56 + lift * .42;
      entry.highlightLeft = Math.max(0, entry.highlightLeft - dt);
      const flash = entry.highlightLeft ? Math.min(1, entry.highlightLeft / .55) : 0;
      entry.highlightMaterial.opacity = flash * (.50 + Math.sin(time * 11) * .20);
      entry.outline.visible = flash > 0; entry.sparks.visible = flash > 0;
      if (flash) {
        const progress = 1 - entry.highlightLeft / (entry.highlightDuration || 2.2);
        for (let i = 0; i < 12; i++) {
          const p = (progress * 1.2 + i * .079) % 1;
          sparkTransform.position.set((i % 2 ? 1 : -1) * (2.25 + Math.sin(i * 4.7 + p * 7) * .13), -1.21 + p * 2.51, 0);
          sparkTransform.rotation.z = p * 5 + i; sparkTransform.scale.setScalar(.45 + Math.sin(p * Math.PI) * 1.2); sparkTransform.updateMatrix(); entry.sparks.setMatrixAt(i, sparkTransform.matrix);
        }
        entry.sparks.instanceMatrix.needsUpdate = true;
      }
      if (level) {
        entry.workers.forEach((worker, j) => {
        worker.body.position.y = Math.sin(time * 2 + worker.phase) * .021;
        worker.arm.rotation.z = -.30 + Math.sin(time * 1.8 + worker.phase) * .24;
        worker.actor.position.x = worker.x + Math.sin(time * .20 + worker.phase) * .10;
        });
        for (const part of entry.moving) {
          if (part.type === 'rotate') part.object.rotation.z = time * part.speed * (1 + Math.min(4, Math.floor((level - 1) / 5)) * .14);
          else if (part.type === 'charge') { const charge = .35 + ((Math.sin(time * .9 + part.phase) + 1) / 2) * .65; part.object.scale.y = charge; part.object.position.y = -.77 + .48 * charge; }
          else if (part.type === 'scan') part.object.position.y = part.y + Math.sin(time * .72) * .40;
          else if (part.type === 'press') part.object.position.y = part.y - Math.max(0, Math.sin(time * 1.9)) * .34;
          else if (part.type === 'coin') { part.object.position.x = .91 + ((time * .23 + part.phase) % 1) * 1.06; part.object.scale.x = .5 + Math.abs(Math.sin(time * 2 + part.phase)) * .5; }
        }
      }
    }
  }
  update(0, 0);
  const snapshotRoom = entry => Object.freeze({ id: entry.def.id, level: entry.level, maxLevel: entry.def.maxLevel, displayLevel: entry.plaque.object.userData.displayLevel, label: entry.plaque.object.userData.label, canPurchase: entry.canPurchase, notificationVisible: entry.notification.visible });
  return { root, roomTargets, update, highlight,
    getRoomState(id) { const entry = entries.find(room => room.def.id === id); return entry ? snapshotRoom(entry) : undefined; },
    getRoomStates: () => Object.freeze(entries.map(snapshotRoom)),
    getHopperState: () => baseHopper.getState(),
    dispose() {
    if (disposed) return; disposed = true;
    baseHopper.dispose();
    root.removeFromParent(); const geos = new Set([...geometries.values(), ...ownedGeometries]); root.traverse(o => { if (o.geometry) geos.add(o.geometry); });
    geos.forEach(g => g.dispose()); materials.forEach(mat => mat.dispose()); textures.forEach(tex => tex.dispose());
  } };
}
