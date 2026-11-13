// Générateur procédural de vaisseaux : chaque graine donne une coque, des ailes,
// des capteurs et une livrée différents. Les vaisseaux pointent vers +Z.
import * as THREE from 'three';
import { createRng } from './rng.js';
import { canvasTexture, glowTexture } from './textures.js';

const HULL_TONES = ['#b8bec9', '#9aa3ad', '#c9b79c', '#8e9aa8', '#d6d2c8', '#7d8794', '#a89a8a'];
export const SHIP_ACCENTS = ['#7cff9e', '#ffb347', '#5fd3ff', '#ff6fae', '#c6a0ff', '#fff07a'];
// Livrée sombre des vaisseaux de guerre.
const WAR_TONES = ['#4a525c', '#3e444c', '#555049', '#3a4250', '#5a5f66', '#46423f'];
export const SHIP_NAMES = ['Aiguille', 'Pèlerin', 'Lanterne', 'Héron', 'Murmure', 'Sillage', 'Boussole', 'Écume'];

// Plaques de métal, joints, bande de couleur et immatriculation.
function hullTexture(rng, tone, accent, registry) {
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = tone;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const shade = rng.range(-0.12, 0.12);
      ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade})`;
      ctx.fillRect(rng.int(0, w), rng.int(0, h), rng.int(16, 70), rng.int(10, 50));
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    const cols = rng.int(3, 7);
    const rows = rng.int(4, 9);
    for (let i = 1; i < cols; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / cols, 0);
      ctx.lineTo((i * w) / cols, h);
      ctx.stroke();
    }
    for (let j = 1; j < rows; j++) {
      ctx.beginPath();
      ctx.moveTo(0, (j * h) / rows);
      ctx.lineTo(w, (j * h) / rows);
      ctx.stroke();
    }
    ctx.fillStyle = accent;
    const stripe = rng.int(40, 170);
    ctx.fillRect(0, stripe, w, rng.int(10, 26));
    if (rng.chance(0.5)) ctx.fillRect(0, stripe + 34, w, 5);
    ctx.fillStyle = 'rgba(20,24,30,0.85)';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(registry, rng.int(8, 120), rng.int(200, 240));
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let i = 0; i < 60; i++) ctx.fillRect(rng.int(0, w), rng.int(0, h), 2, 2);
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function solarTexture() {
  return canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0e1c3a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d3f7a';
    for (let x = 2; x < w; x += 10) for (let y = 2; y < h; y += 10) ctx.fillRect(x, y, 8, 8);
    ctx.strokeStyle = '#8aa0c0';
    ctx.strokeRect(1, 1, w - 2, h - 2);
  });
}

// Profil de fuselage : une courbe tournée autour de l'axe, avec des renflements aléatoires.
function fuselage(rng, length, radius, facets = null) {
  const points = [new THREE.Vector2(0.001, 0)];
  const bumps = rng.int(1, 3);
  const phase = rng.range(0, Math.PI);
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r = radius * (0.75 + 0.25 * Math.sin(t * Math.PI * bumps + phase));
    if (t < 0.12) r *= 0.75 + t * 2;
    if (t > 0.7) r *= Math.max(0.08, (1 - t) / 0.3);
    points.push(new THREE.Vector2(r, t * length));
  }
  points.push(new THREE.Vector2(0.001, length * 1.04));
  const segments = rng.pick([5, 6, 8, 12]);
  const geometry = new THREE.LatheGeometry(points, facets ?? segments);
  geometry.rotateX(Math.PI / 2); // l'axe Y du tour devient l'axe Z (vers l'avant)
  geometry.translate(0, 0, -length / 2);
  return geometry;
}

// Aile en trapèze, à plat dans le plan XZ, partant de l'axe vers +X.
function wingGeometry(span, rootChord, tipChord, sweep, thickness) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -rootChord / 2);
  shape.lineTo(span, -rootChord / 2 - sweep);
  shape.lineTo(span, -rootChord / 2 - sweep + tipChord);
  shape.lineTo(0, rootChord / 2);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateX(Math.PI / 2); // la flèche de l'aile part vers l'arrière (-Z)
  return geometry;
}

function mirrored(mesh) {
  const copy = mesh.clone();
  copy.scale.x *= -1;
  copy.position.x *= -1;
  return copy;
}

// --- Propulsion animée : jet en cône additif (enveloppe + cœur) derrière chaque tuyère ---

let jetTex = null;
let jetGeo = null;
const jetMats = new Map();
// Dégradé le long du jet : brillant à la tuyère, losanges de choc, extinction vers la queue.
function jetTexture() {
  jetTex ??= canvasTexture(16, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1); // 0 à la tuyère (bas du canvas), 1 en queue
      const a = Math.pow(1 - v, 1.7) * (0.82 + 0.18 * Math.cos(v * 34)) * Math.min(1, v * 14 + 0.35);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(Math.max(0, a) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  return jetTex;
}
function jetGeometry() {
  if (!jetGeo) {
    jetGeo = new THREE.CylinderGeometry(0.3, 1, 1, 16, 1, true);
    jetGeo.rotateX(-Math.PI / 2);
    jetGeo.translate(0, 0, -0.5); // de z = 0 (tuyère) à z = -1 (queue)
  }
  return jetGeo;
}
function jetMaterials(color) {
  const key = new THREE.Color(color).getHexString();
  if (!jetMats.has(key)) {
    const c = new THREE.Color(color);
    const opts = { map: jetTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
    jetMats.set(key, [
      new THREE.MeshBasicMaterial({ ...opts, color: c, opacity: 0.45 }),
      new THREE.MeshBasicMaterial({ ...opts, color: c.clone().lerp(new THREE.Color('#ffffff'), 0.65), opacity: 0.85 }),
    ]);
  }
  return jetMats.get(key);
}
// Jet à la sortie d'une tuyère de rayon r (repère du vaisseau, orienté vers -Z).
function makeJet(parent, x, y, z, r, color, jets) {
  const [outer, inner] = jetMaterials(color);
  const group = new THREE.Group();
  const shell = new THREE.Mesh(jetGeometry(), outer);
  const core = new THREE.Mesh(jetGeometry(), inner);
  core.scale.set(0.45, 0.45, 0.6);
  shell.userData.fx = core.userData.fx = true;
  shell.renderOrder = core.renderOrder = 4;
  group.add(shell, core);
  group.position.set(x, y, z);
  parent.add(group);
  jets.push({ group, w: r * 0.85, len: r * 7, p: jets.length * 2.39 + x * 13 + y * 7 }); // phase sans tirage aléatoire : la forme ne change pas
}

// Anime la propulsion : jets qui pulsent et scintillent, halo des tuyères.
// thrust : 0 (moteurs au repos) à 1 (pleine poussée) ; le changement de régime est progressif.
export function animateShip(model, time, thrust = 1) {
  const u = model.userData;
  u.thrustNow = u.thrustNow == null ? thrust : u.thrustNow + (thrust - u.thrustNow) * 0.05;
  const t = u.thrustNow;
  const seed = u.fxSeed ?? 0;
  for (let i = 0; i < u.flames.length; i++) {
    const p = seed + i * 1.7;
    const flick = 1 + Math.sin(time * 31 + p) * 0.08 + Math.sin(time * 57.3 + p * 2.1) * 0.05;
    u.flames[i].scale.setScalar((0.3 + 0.6 * t) * flick);
  }
  for (const j of u.jets ?? []) {
    const flick = 1 + Math.sin(time * 37 + j.p) * 0.09 + Math.sin(time * 71 + j.p * 1.3) * 0.06 + Math.sin(time * 4.1 + j.p) * 0.07;
    const w = j.w * (0.7 + 0.35 * t) * (1 + Math.sin(time * 53 + j.p) * 0.04);
    j.group.scale.set(w, w, Math.max(0.001, j.len * (0.18 + 0.95 * t) * flick));
  }
}

// Taille de chaque type (voir SHIP_KINDS dans game.js) et échelle correspondante.
export const SHIP_SIZES = {
  arche: 'gigantesque', sonde: 'petit', corvette: 'petit', fregate: 'moyen', colonie: 'moyen',
  croiseur: 'grand', transport: 'grand', cuirasse: 'gigantesque',
};
export const SIZE_SCALE = { petit: 1, moyen: 1.3, grand: 1.7, gigantesque: 2.2 };
const WARSHIPS = new Set(['corvette', 'fregate', 'croiseur', 'cuirasse']);

// Échelle du modèle selon son type (l'Arche garde son échelle d'origine).
export function shipScale(kind) {
  if (kind === 'arche') return 1.5;
  return SIZE_SCALE[SHIP_SIZES[kind]] ?? 1;
}

// Tourelle d'arme : socle, dôme et canons ; elle pivote autour de son axe Y.
function turret(size, barrels, hull, dark) {
  const t = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.5, size * 0.62, size * 0.4, 8), hull);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(size * 0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), dark);
  dome.position.y = size * 0.2;
  t.add(base, dome);
  for (let b = 0; b < barrels; b++) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.07, size * 0.08, size * 1.5, 6), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set((b - (barrels - 1) / 2) * size * 0.24, size * 0.28, size * 0.8);
    t.add(barrel);
  }
  return t;
}

// Emplacements des tourelles : [angle autour de l'axe, position le long de la coque (0 arrière, 1 avant)].
function turretSlots(count) {
  const TOP = 0;
  const BOTTOM = Math.PI;
  if (count === 1) return [[TOP, 0.6]];
  if (count === 2) return [[TOP, 0.75], [TOP, 0.3]];
  if (count === 4) return [[TOP, 0.8], [TOP, 0.4], [BOTTOM, 0.7], [BOTTOM, 0.25]];
  const slots = [[TOP, 0.85], [TOP, 0.55], [TOP, 0.25], [BOTTOM, 0.7], [BOTTOM, 0.35]];
  const sides = [[Math.PI / 2, 0.5], [-Math.PI / 2, 0.5], [Math.PI / 2, 0.15], [-Math.PI / 2, 0.15]];
  return slots.concat(sides).slice(0, count);
}

// style : `shipStyle` d'une espèce (config.js). Sans style, c'est le générateur d'origine, inchangé
// (mêmes tirages, mêmes vaisseaux pour les anciennes parties).
export function createShip(seed, accent, registry = '', kind = 'sonde', style = null) {
  if (style) return createStyledShip(seed, accent, registry, kind, style);
  const rng = createRng(seed);
  const ship = new THREE.Group();
  const accentColor = new THREE.Color(accent);
  const warship = WARSHIPS.has(kind);

  // Le tirage de la teinte est fait pour tous ; les vaisseaux de guerre la remplacent par une teinte sombre.
  const tone = rng.pick(HULL_TONES);
  const hullTone = warship ? WAR_TONES[HULL_TONES.indexOf(tone) % WAR_TONES.length] : tone;
  const hull = new THREE.MeshStandardMaterial({ map: hullTexture(rng, hullTone, accent, registry), metalness: warship ? 0.7 : 0.55, roughness: 0.45, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: warship ? 0x1e2128 : 0x2c3038, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide });
  const paint = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });

  const length = rng.range(1.2, 2);
  const radius = rng.range(0.14, 0.26) * (warship ? 1.12 : 1);
  // Coque anguleuse (4 ou 6 pans) pour les vaisseaux de guerre.
  const body = new THREE.Mesh(fuselage(rng, length, radius, warship ? (seed % 2 ? 4 : 6) : null), hull);
  ship.add(body);

  // Second module accolé (réservoir, soute) pour certains vaisseaux.
  if (rng.chance(0.5)) {
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(radius * 0.45, length * 0.35, 4, 8), dark);
    pod.rotation.x = Math.PI / 2;
    const side = rng.chance(0.5) ? 1 : 0;
    pod.position.set(side ? radius * 1.1 : 0, side ? 0 : -radius * 1.05, -length * 0.1);
    ship.add(pod);
    if (side) ship.add(mirrored(pod));
  }

  // Voilure : ailes, ailerons en étoile, anneau ou panneaux solaires.
  let voilure = rng.pick(['ailes', 'ailerons', 'anneau', 'panneaux']);
  if (warship && voilure === 'anneau') voilure = 'ailerons';
  if (warship && voilure === 'panneaux') voilure = 'ailes';
  if (voilure === 'ailes') {
    const wing = new THREE.Mesh(
      wingGeometry(rng.range(0.4, 0.9), rng.range(0.4, 0.8), rng.range(0.1, 0.3), rng.range(-0.1, 0.4), 0.035),
      rng.chance(0.5) ? hull : paint,
    );
    wing.position.set(radius * 0.6, rng.range(-0.05, 0.05), rng.range(-0.3, 0.1) * length);
    wing.rotation.z = rng.range(-0.25, 0.25);
    ship.add(wing, mirrored(wing));
  } else if (voilure === 'ailerons') {
    const count = rng.pick([3, 4]);
    const geometry = wingGeometry(rng.range(0.25, 0.5), rng.range(0.3, 0.5), rng.range(0.08, 0.2), rng.range(0.05, 0.25), 0.03);
    for (let i = 0; i < count; i++) {
      const fin = new THREE.Mesh(geometry, i === 0 ? paint : hull);
      const holder = new THREE.Group();
      fin.position.set(radius * 0.5, 0, -length * 0.32);
      holder.add(fin);
      holder.rotation.z = (i / count) * Math.PI * 2 + Math.PI / 2;
      ship.add(holder);
    }
  } else if (voilure === 'anneau') {
    const ringRadius = radius * rng.range(2.2, 3.4);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, rng.range(0.03, 0.06), 6, 24), paint);
    ring.position.z = rng.range(-0.25, 0.1) * length;
    ship.add(ring);
    const struts = rng.pick([2, 3, 4]);
    for (let i = 0; i < struts; i++) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(ringRadius, 0.03, 0.05), dark);
      const holder = new THREE.Group();
      strut.position.x = ringRadius / 2;
      holder.add(strut);
      holder.rotation.z = (i / struts) * Math.PI * 2;
      holder.position.z = ring.position.z;
      ship.add(holder);
    }
  } else {
    const panelMat = new THREE.MeshStandardMaterial({ map: solarTexture(), metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide });
    const w = rng.range(0.35, 0.7);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.015, rng.range(0.3, 0.55)), panelMat);
    const boom = rng.range(0.1, 0.25);
    panel.position.set(radius + boom + w / 2, 0, rng.range(-0.15, 0.1) * length);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, boom + radius, 5), dark);
    arm.rotation.z = Math.PI / 2;
    arm.position.set((boom + radius) / 2, 0, panel.position.z);
    ship.add(panel, mirrored(panel), arm, mirrored(arm));
  }

  // Capteurs à l'avant : parabole, antenne ou sphère de mesure.
  const sensor = rng.pick(['parabole', 'antenne', 'sphere']);
  if (sensor === 'parabole') {
    const dish = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3.2), dark);
    dish.rotation.x = -Math.PI / 2;
    dish.position.set(0, radius * 1.3, length * 0.15);
    ship.add(dish);
  } else if (sensor === 'antenne') {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, length * 0.5, 4), dark);
    mast.rotation.x = Math.PI / 2;
    mast.position.z = length * 0.72;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), paint);
    tip.position.z = length * 0.97;
    ship.add(mast, tip);
  } else {
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.8, 0), paint);
    orb.position.set(0, -radius * 0.9, length * 0.2);
    ship.add(orb);
  }

  // Moteur et sa flamme, plus un feu de position qui clignote.
  const engineCount = warship
    ? rng.pick([2, 3, 4]) + { corvette: 0, fregate: 1, croiseur: 2, cuirasse: 3 }[kind]
    : rng.pick([1, 1, 2, 3]);
  const flames = [];
  const jets = [];
  for (let i = 0; i < engineCount; i++) {
    const offset = engineCount === 1 ? 0 : radius * (engineCount > 4 ? 0.85 : 0.7);
    const nr = engineCount > 4 ? 0.3 : engineCount > 3 ? 0.36 : 0.45;
    const angle = (i / engineCount) * Math.PI * 2;
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(radius * nr, radius * nr * 1.33, 0.18, 8, 1, true), dark);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(Math.cos(angle) * offset, Math.sin(angle) * offset, -length / 2 - 0.05);
    const flame = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: accentColor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    flame.position.set(nozzle.position.x, nozzle.position.y, -length / 2 - 0.2);
    ship.add(nozzle, flame);
    flames.push(flame);
    makeJet(ship, nozzle.position.x, nozzle.position.y, -length / 2 - 0.14, radius * nr, accentColor, jets);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: accentColor }));
  beacon.position.set(0, radius * 0.9, -length * 0.25);
  ship.add(beacon);

  // Vaisseaux de guerre : plaques de blindage, arête dorsale peinte, tourelles et feux rouges.
  const turrets = [];
  const lights = [];
  if (warship) {
    const plates = rng.int(2, 4);
    for (let i = 0; i < plates; i++) {
      const plateLen = length * rng.range(0.14, 0.22);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.22, radius * 1.1, plateLen), i % 2 ? dark : hull);
      plate.position.set(radius * 0.82, 0, length * (-0.3 + (i / plates) * 0.55));
      plate.rotation.z = rng.range(-0.15, 0.15);
      ship.add(plate, mirrored(plate));
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.35, radius * 0.25, length * 0.55), dark);
    ridge.position.set(0, radius * 0.85, -length * 0.08);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.37, radius * 0.06, length * 0.5), paint);
    stripe.position.set(0, radius * 0.99, -length * 0.08);
    ship.add(ridge, stripe);

    const count = { corvette: 1, fregate: 2, croiseur: 4, cuirasse: rng.int(6, 8) }[kind];
    const size = radius * (kind === 'cuirasse' ? 0.5 : 0.6);
    const barrels = kind === 'corvette' ? 1 : rng.pick([1, 2, 2, 3]);
    for (const [angle, row] of turretSlots(count)) {
      const mount = new THREE.Group();
      mount.rotation.z = angle;
      mount.position.z = length * (-0.3 + row * 0.55);
      const t = turret(size, barrels, hull, dark);
      t.position.y = radius * (angle === 0 ? 1.02 : 0.9);
      t.rotation.y = rng.range(-0.6, 0.6);
      t.userData.base = t.rotation.y;
      t.userData.phase = rng.range(0, Math.PI * 2);
      t.userData.speed = rng.range(0.25, 0.5);
      mount.add(t);
      ship.add(mount);
      turrets.push(t);
    }

    const red = new THREE.MeshBasicMaterial({ color: 0xff3030 });
    const lightPos = [
      [radius * 1.05, 0, -length * 0.35],
      [-radius * 1.05, 0, -length * 0.35],
      [0, -radius * 0.9, length * 0.25],
    ];
    if (kind === 'croiseur' || kind === 'cuirasse') lightPos.push([radius * 0.95, 0, length * 0.2], [-radius * 0.95, 0, length * 0.2]);
    for (const [x, y, z] of lightPos) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), red);
      l.position.set(x, y, z);
      ship.add(l);
      lights.push(l);
    }
  }

  // Vaisseaux colonie, transports et Arche : anneaux d'habitat en rotation et conteneurs de cargaison.
  const rings = [];
  if (kind === 'arche' || kind === 'colonie' || kind === 'transport') {
    const ringCount = kind === 'colonie' ? 1 : 2;
    for (let i = 0; i < ringCount; i++) {
      const ring = new THREE.Group();
      const r = radius * (kind === 'arche' ? 3.6 - i * 0.8 : kind === 'transport' ? 3.3 - i * 0.5 : 3);
      ring.add(new THREE.Mesh(new THREE.TorusGeometry(r, radius * 0.45, 8, 28), hull));
      for (let k = 0; k < 4; k++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(r, 0.03, 0.04), dark);
        spoke.position.x = r / 2;
        const holder = new THREE.Group();
        holder.add(spoke);
        holder.rotation.z = (k / 4) * Math.PI * 2;
        ring.add(holder);
      }
      ring.position.z = length * (i === 0 ? (kind === 'transport' ? -0.12 : -0.05) : 0.22);
      ship.add(ring);
      rings.push(ring);
    }
    if (kind === 'transport') {
      // Deux rangées de conteneurs autour de la poutre centrale, entre les anneaux et les moteurs.
      for (let row = 0; row < 2; row++) {
        for (let k = 0; k < 6; k++) {
          const box = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.75, radius * 0.75, length * 0.15), (k + row) % 3 === 0 ? paint : k % 2 ? dark : hull);
          const a = (k / 6) * Math.PI * 2 + row * 0.5;
          box.position.set(Math.cos(a) * radius * 1.35, Math.sin(a) * radius * 1.35, length * (-0.38 + row * 0.17));
          box.rotation.z = a;
          ship.add(box);
        }
      }
    }
    if (kind === 'arche') {
      for (let k = 0; k < 6; k++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.7, radius * 0.7, length * 0.22), k % 2 ? paint : dark);
        const a = (k / 6) * Math.PI * 2;
        box.position.set(Math.cos(a) * radius * 1.3, Math.sin(a) * radius * 1.3, -length * 0.3);
        ship.add(box);
      }
    }
  }

  ship.userData = { flames, jets, fxSeed: seed % 1000, beacon, length, rings, turrets, lights, kind, sizeScale: shipScale(kind) };
  // Taille commune pour tous les vaisseaux, quelle que soit leur longueur, multipliée selon la taille du type.
  ship.scale.setScalar((1.6 / length) * shipScale(kind));
  return ship;
}

// ===========================================================================
// Vaisseaux au style d'une espèce (paramètre `style` = SPECIES[...].shipStyle).
// Chaque style a sa silhouette (archétype), ses matériaux et ses détails ; la graine
// rend chaque vaisseau unique à l'intérieur de ce style.
// ===========================================================================

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const WHITE = new THREE.Color('#ffffff');
// Rang de complexité : plus il est haut, plus le vaisseau porte de modules.
const TIER = { sonde: 0, corvette: 1, colonie: 2, fregate: 2, transport: 3, croiseur: 3, cuirasse: 4, arche: 5 };
const WAR_TURRETS = { corvette: 1, fregate: 2, croiseur: 4, cuirasse: 7 };

// Archétype déduit des paramètres du style (ou donné directement par style.archetype).
export function shipArchetype(style) {
  if (!style) return null;
  if (style.archetype) return style.archetype;
  if ((style.sails ?? 0) >= 0.5) return 'voilier';
  if ((style.crystals ?? 0) >= 0.5) return 'cristal';
  if ((style.organic ?? 0) >= 0.7 || style.profile === 'bombe') return 'meduse';
  if (style.profile === 'massif') return (style.armor ?? 0) >= 0.95 ? 'predateur' : 'forteresse';
  if (style.profile === 'modulaire') return (style.organic ?? 0) >= 0.3 ? 'grappe' : 'caravane';
  return 'aiguille';
}

// Rendu de chaque archétype : motif de texture, finition PBR, teinte de guerre.
const LOOKS = {
  forteresse: { saturate: 0.1, pattern: 'plaques', metalness: 0.55, roughness: 0.6, env: 0.7, emissive: 1.2, ring: [4, 8] },
  predateur: { pattern: 'gravures', metalness: 0.55, roughness: 0.36, env: 1.2, emissive: 1.4, ring: [4, 6], warMix: 0.15 },
  aiguille: { pattern: 'liseres', metalness: 0.35, roughness: 0.32, env: 0.9, emissive: 0.8, ring: [8, 40], warTone: '#6b6a64' },
  meduse: { saturate: 0.12, pattern: 'meduse', metalness: 0.1, roughness: 0.35, env: 1, emissive: 1.1, ring: [10, 48], turret: 'organique', warTone: '#1d4450' },
  grappe: { saturate: 0.28, pattern: 'mycelium', metalness: 0.25, roughness: 0.5, env: 0.8, emissive: 1.3, ring: [10, 40], turret: 'organique', warTone: '#3a2f4c' },
  cristal: { pattern: 'facettes', metalness: 0.1, roughness: 0.12, env: 1.4, emissive: 0.9, ring: [6, 30], turret: 'cristal', warTone: '#7c8ea8', warMix: 0.35 },
  voilier: { pattern: 'glyphes', metalness: 0.5, roughness: 0.36, env: 2, emissive: 1.5, ring: [8, 48], warTone: '#5a3e1c', warMix: 0.4 },
  caravane: { pattern: 'cargo', metalness: 0.6, roughness: 0.45, env: 0.9, emissive: 1, ring: [8, 40], warTone: '#3c3430' },
};

// --- Environnement de reflets (partagé) : ciel sombre, soleil chaud, bande galactique ---

let spaceEnvTexture = null;
function spaceEnv() {
  if (spaceEnvTexture) return spaceEnvTexture;
  spaceEnvTexture = canvasTexture(512, 256, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#6a7ea6');
    sky.addColorStop(0.42, '#2a3550');
    sky.addColorStop(0.5, '#0d111a');
    sky.addColorStop(1, '#040508');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const band = ctx.createLinearGradient(0, h * 0.38, 0, h * 0.62);
    band.addColorStop(0, 'rgba(120,140,200,0)');
    band.addColorStop(0.5, 'rgba(150,160,210,0.35)');
    band.addColorStop(1, 'rgba(120,140,200,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, h * 0.38, w, h * 0.24);
    const sun = ctx.createRadialGradient(w * 0.32, h * 0.28, 0, w * 0.32, h * 0.28, 95);
    sun.addColorStop(0, 'rgba(255,248,232,1)');
    sun.addColorStop(0.25, 'rgba(255,236,200,0.6)');
    sun.addColorStop(1, 'rgba(255,230,190,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
    const fill = ctx.createRadialGradient(w * 0.82, h * 0.6, 0, w * 0.82, h * 0.6, 90);
    fill.addColorStop(0, 'rgba(90,140,255,0.45)');
    fill.addColorStop(1, 'rgba(90,140,255,0)');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
  });
  spaceEnvTexture.mapping = THREE.EquirectangularReflectionMapping;
  return spaceEnvTexture;
}

function std(options) {
  return new THREE.MeshStandardMaterial({ envMap: spaceEnv(), side: THREE.DoubleSide, ...options });
}
function basic(color, options = {}) {
  return new THREE.MeshBasicMaterial({ color, ...options });
}

// --- Textures procédurales : couleur + carte d'émission (glyphes, veines, hublots) ---

const css = (color) => `#${color.getHexString()}`;
function shade(color, l) {
  return css(color.clone().offsetHSL(0, 0, l));
}
function rgba(color, a) {
  return `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${a})`;
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}
function toTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

// Glyphe aléatoire tracé à l'identique sur plusieurs contextes (couleur et émission).
function glyph(rng, contexts, x, y, s) {
  const strokes = [];
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) strokes.push([rng.int(0, 3), rng.next(), rng.next()]);
  for (const ctx of contexts) {
    ctx.beginPath();
    for (const [k, a, b] of strokes) {
      if (k === 0) {
        ctx.moveTo(x + a * s, y);
        ctx.lineTo(x + b * s, y + s);
      } else if (k === 1) {
        ctx.moveTo(x, y + a * s);
        ctx.lineTo(x + s, y + b * s);
      } else if (k === 2) {
        ctx.moveTo(x + s * 0.85, y + s / 2);
        ctx.arc(x + s / 2, y + s / 2, s * 0.35, 0, Math.PI * (0.8 + a * 1.2));
      } else {
        ctx.moveTo(x, y + s * a * 0.3);
        ctx.lineTo(x + s / 2, y + s * (0.4 + b * 0.6));
        ctx.lineTo(x + s, y + s * a * 0.3);
      }
    }
    ctx.stroke();
  }
}

// --- Matériaux réalistes : jeux de textures PBR procédurales (couleur, relief, rugosité/métal, émission) ---
// Chaque jeu est dessiné une seule fois par espèce (archétype + teinte de référence) et partagé par tous
// ses vaisseaux : la teinte propre à chaque vaisseau passe par material.color (rapport à la teinte peinte).
// Les CanvasTexture fonctionnent dans tous les contextes WebGL (amas, vignettes) : chaque renderer les
// téléverse de son côté.

const TILE = 0.5; // taille, en unités du modèle, d'une répétition de texture
const SETS = new Map();
const NS = 256;
let NOISE = null;

function smooth01(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

// Bruit fractal raccordable (se répète sans couture), calculé une fois.
function noiseField() {
  if (NOISE) return NOISE;
  const rng = createRng(90210);
  NOISE = new Float32Array(NS * NS);
  let amp = 0.5;
  let total = 0;
  for (const g of [4, 8, 16, 32, 64, 128]) {
    const lat = new Float32Array(g * g).map(() => rng.next());
    for (let y = 0; y < NS; y++) {
      const fy = (y / NS) * g;
      const y0 = Math.floor(fy);
      const ty = smooth01(fy - y0);
      const y1 = (y0 + 1) % g;
      for (let x = 0; x < NS; x++) {
        const fx = (x / NS) * g;
        const x0 = Math.floor(fx);
        const tx = smooth01(fx - x0);
        const x1 = (x0 + 1) % g;
        const a = lat[y0 * g + x0] + (lat[y0 * g + x1] - lat[y0 * g + x0]) * tx;
        const b = lat[y1 * g + x0] + (lat[y1 * g + x1] - lat[y1 * g + x0]) * tx;
        NOISE[y * NS + x] += amp * (a + (b - a) * ty);
      }
    }
    total += amp;
    amp *= 0.55;
  }
  for (let i = 0; i < NOISE.length; i++) NOISE[i] /= total;
  return NOISE;
}

const gray = (v, a = 1) => {
  const k = Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgba(${k},${k},${k},${a})`;
};

// Peintre : cinq calques de même taille. c = couleur, h = relief (gris moyen = 0), r = rugosité,
// m = métal, e = émission (blanc, teinté par material.emissive).
function painter(size, seed, base, rough, metal) {
  const P = { S: size, rng: createRng(seed), cv: {} };
  for (const k of ['c', 'h', 'r', 'm', 'e']) {
    P.cv[k] = makeCanvas(size, size);
    P[k] = P.cv[k].getContext('2d', { willReadFrequently: true }); // canvas en mémoire : lecture des pixels rapide
  }
  P.c.fillStyle = css(base);
  P.h.fillStyle = gray(0.5);
  P.r.fillStyle = gray(rough);
  P.m.fillStyle = gray(metal);
  P.e.fillStyle = '#000';
  for (const k of ['c', 'h', 'r', 'm', 'e']) P[k].fillRect(0, 0, size, size);
  return P;
}

// Dessine un motif et ses copies décalées quand il déborde, pour que la texture se raccorde.
function wrap(P, x, y, w, h, fn) {
  const S = P.S;
  const xs = [0];
  const ys = [0];
  if (x < 0) xs.push(S);
  if (x + w > S) xs.push(-S);
  if (y < 0) ys.push(S);
  if (y + h > S) ys.push(-S);
  for (const dx of xs) for (const dy of ys) fn(x + dx, y + dy);
}

function rivet(P, x, y, r) {
  wrap(P, x - r * 2, y - r * 2, r * 4, r * 4, (X, Y) => {
    X += r * 2;
    Y += r * 2;
    const hg = P.h.createRadialGradient(X - r * 0.2, Y - r * 0.2, 0, X, Y, r * 1.3);
    hg.addColorStop(0, gray(0.85));
    hg.addColorStop(0.7, gray(0.62));
    hg.addColorStop(1, gray(0.5, 0));
    P.h.fillStyle = hg;
    P.h.fillRect(X - r * 1.5, Y - r * 1.5, r * 3, r * 3);
    P.c.fillStyle = 'rgba(0,0,0,0.35)';
    P.c.beginPath();
    P.c.arc(X + r * 0.25, Y + r * 0.3, r * 1.1, 0, Math.PI * 2);
    P.c.fill();
    P.c.fillStyle = 'rgba(255,240,220,0.22)';
    P.c.beginPath();
    P.c.arc(X - r * 0.15, Y - r * 0.2, r * 0.75, 0, Math.PI * 2);
    P.c.fill();
    P.r.fillStyle = gray(0, 0.25);
    P.r.beginPath();
    P.r.arc(X, Y, r, 0, Math.PI * 2);
    P.r.fill();
  });
}

// Grille de plaques : joints creusés, arêtes, nuances et rivets.
function panels(P, o) {
  const { rows, cols, stagger = 0, seam = 2, lift = 0.06, shade: sv = 0.06, roughVar = 0.08, rivetR = 0, rivetStep = 12, jitter = 0 } = o;
  const S = P.S;
  const ph = S / rows;
  const pw = S / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * pw * stagger;
    let x = off;
    const widths = [];
    // Plaques de largeurs inégales si `jitter` : la somme reste S pour garder le raccord.
    let left = S;
    for (let k = 0; k < cols; k++) {
      const w = k === cols - 1 ? left : Math.max(pw * 0.4, pw * (1 + P.rng.range(-jitter, jitter)));
      widths.push(Math.min(w, left));
      left -= widths[k];
    }
    for (const w of widths) {
      const y = r * ph;
      const s = P.rng.range(-sv, sv);
      const rv = P.rng.range(-roughVar, roughVar);
      const hl = lift * P.rng.range(0.6, 1.2);
      wrap(P, x, y, w, ph, (X, Y) => {
        P.c.fillStyle = s > 0 ? `rgba(255,255,255,${s})` : `rgba(0,0,0,${-s})`;
        P.c.fillRect(X, Y, w, ph);
        P.r.fillStyle = rv > 0 ? gray(1, rv) : gray(0, -rv);
        P.r.fillRect(X, Y, w, ph);
        P.h.fillStyle = gray(0.5 + hl);
        P.h.fillRect(X + seam, Y + seam, w - seam * 2, ph - seam * 2);
        // Joint : creux sombre, lèvre claire en haut à gauche.
        P.h.fillStyle = gray(0.3);
        P.h.fillRect(X, Y, w, seam * 0.7);
        P.h.fillRect(X, Y, seam * 0.7, ph);
        P.c.fillStyle = 'rgba(0,0,0,0.45)';
        P.c.fillRect(X, Y, w, Math.max(1, seam * 0.6));
        P.c.fillRect(X, Y, Math.max(1, seam * 0.6), ph);
        P.c.fillStyle = 'rgba(255,255,255,0.08)';
        P.c.fillRect(X, Y + seam * 0.6, w, 1);
        P.c.fillRect(X + seam * 0.6, Y, 1, ph);
        P.r.fillStyle = gray(1, 0.3);
        P.r.fillRect(X, Y, w, seam);
      });
      if (rivetR) {
        const n = Math.max(1, Math.floor((w - rivetStep) / rivetStep));
        for (let i = 0; i <= n; i++) {
          const rx = x + rivetStep * 0.5 + (i * (w - rivetStep)) / n;
          rivet(P, rx, y + rivetStep * 0.45, rivetR);
          rivet(P, rx, y + ph - rivetStep * 0.45, rivetR);
        }
      }
      x += w;
    }
  }
}

function blobs(P, n, color, alpha, rmin, rmax, roughAdd = 0, metalAdd = 0) {
  for (let i = 0; i < n; i++) {
    const r = P.rng.range(rmin, rmax);
    const x0 = P.rng.range(0, P.S);
    const y0 = P.rng.range(0, P.S);
    const sy = P.rng.range(0.5, 1.6);
    const a = alpha * P.rng.range(0.4, 1);
    wrap(P, x0 - r, y0 - r * sy, r * 2, r * 2 * sy, (X, Y) => {
      const cx = X + r;
      const cy = Y + r * sy;
      for (const [ctx, col, k] of [[P.c, color, a], [P.r, roughAdd > 0 ? '255,255,255' : '0,0,0', Math.abs(roughAdd) * a], [P.m, metalAdd > 0 ? '255,255,255' : '0,0,0', Math.abs(metalAdd) * a]]) {
        if (!k) continue;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(${col},${k})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, sy);
        ctx.translate(-cx, -cy);
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
      }
    });
  }
}

// Coulures verticales (rouille, suie).
function streaks(P, n, color, alpha, len, width = [1, 5]) {
  for (let i = 0; i < n; i++) {
    const x = P.rng.range(0, P.S);
    const y = P.rng.range(0, P.S);
    const h = P.rng.range(len[0], len[1]);
    const w = P.rng.range(width[0], width[1]);
    wrap(P, x, y, w, h, (X, Y) => {
      const g = P.c.createLinearGradient(0, Y, 0, Y + h);
      g.addColorStop(0, `rgba(${color},${alpha})`);
      g.addColorStop(1, `rgba(${color},0)`);
      P.c.fillStyle = g;
      P.c.fillRect(X, Y, w, h);
      P.r.fillStyle = gray(1, 0.15);
      P.r.fillRect(X, Y, w, h * 0.6);
    });
  }
}

// Rayures : métal mis à nu (plus brillant, plus métallique).
function scratches(P, n, len, alpha = 0.3) {
  for (let i = 0; i < n; i++) {
    const x = P.rng.range(0, P.S);
    const y = P.rng.range(0, P.S);
    const a = P.rng.range(0, Math.PI * 2);
    const l = P.rng.range(len * 0.3, len);
    const dx = Math.cos(a) * l;
    const dy = Math.sin(a) * l;
    wrap(P, Math.min(x, x + dx), Math.min(y, y + dy), Math.abs(dx), Math.abs(dy), (X, Y) => {
      const sx = X + (dx < 0 ? -dx : 0);
      const sy = Y + (dy < 0 ? -dy : 0);
      for (const [ctx, style, w] of [[P.c, `rgba(255,250,240,${alpha})`, 1], [P.r, gray(0, 0.5), 1.4], [P.m, gray(1, 0.6), 1.4], [P.h, gray(0.38, 0.6), 1]]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + dx, sy + dy);
        ctx.stroke();
      }
    });
  }
}

// Hublots : verre sombre en retrait, la plupart allumés.
function windows(P, x, y, count, w, h, gap, lit = 0.75) {
  for (let i = 0; i < count; i++) {
    const X = x + i * (w + gap);
    P.h.fillStyle = gray(0.28);
    P.h.fillRect(X - 1, y - 1, w + 2, h + 2);
    P.c.fillStyle = 'rgba(30,30,34,1)';
    P.c.fillRect(X - 1.5, y - 1.5, w + 3, h + 3);
    P.c.fillStyle = '#0b0f16';
    P.c.fillRect(X, y, w, h);
    P.r.fillStyle = gray(0.08);
    P.r.fillRect(X, y, w, h);
    P.m.fillStyle = gray(0);
    P.m.fillRect(X, y, w, h);
    if (P.rng.chance(lit)) {
      P.e.fillStyle = gray(P.rng.range(0.65, 1));
      P.e.fillRect(X, y, w, h);
      P.c.fillStyle = 'rgba(255,240,200,0.5)';
      P.c.fillRect(X, y, w, h);
    }
  }
}

function stencil(P, text, x, y, px, color, alpha = 0.7, font = 'monospace') {
  P.c.font = `bold ${px}px ${font}`;
  P.c.fillStyle = `rgba(${color},${alpha})`;
  P.c.fillText(text, x, y);
  P.r.font = P.c.font;
  P.r.fillStyle = gray(0, 0.15);
  P.r.fillText(text, x, y);
}

// Glyphe gravé : creux dans le relief, trait sombre, lueur dans l'émission.
function engraved(P, x, y, s, glowAlpha = 1) {
  P.h.strokeStyle = gray(0.25);
  P.h.lineWidth = 2.2;
  P.c.strokeStyle = 'rgba(40,24,6,0.7)';
  P.c.lineWidth = 1.8;
  P.e.strokeStyle = gray(1, glowAlpha);
  P.e.lineWidth = 1.4;
  glyph(P.rng, [P.h, P.c, P.e], x, y, s);
}

// Réseau de veines qui se ramifient (sur les calques donnés).
function veins(P, layers, x, y, a, steps, width, step = 6) {
  const pts = [[x, y]];
  for (let s = 0; s < steps; s++) {
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    a += P.rng.range(-0.5, 0.5);
    pts.push([x, y]);
    if (width > 0.8 && P.rng.chance(0.07)) veins(P, layers, x, y, a + P.rng.pick([-1, 1]) * 0.9, Math.floor(steps * 0.5), width * 0.6, step);
  }
  for (const [ctx, style, wk] of layers) {
    ctx.strokeStyle = style;
    ctx.lineWidth = width * wk;
    ctx.lineCap = 'round';
    for (const [dx, dy] of [[0, 0], [P.S, 0], [-P.S, 0], [0, P.S], [0, -P.S]]) {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + dx, py + dy) : ctx.moveTo(px + dx, py + dy)));
      ctx.stroke();
    }
  }
}

// Termine un jeu : grain de bruit, carte normale tirée du relief, rugosité (G) + métal (B) réunis.
function finish(P, o = {}) {
  const { grain = 0.1, speck = 0.04, roughGrain = 0.12, heightGrain = 0.06, normal = 1.5, patina = null, blur = 0.8, noEmit = false } = o;
  const S = P.S;
  const N = noiseField();
  const get = (k) => P[k].getImageData(0, 0, S, S);
  const C = get('c');
  const R = get('r');
  const M = get('m');
  // Relief adouci avant le calcul des normales (la carte doit rester raccordable : on recopie autour).
  const hb = makeCanvas(S, S);
  const hx = hb.getContext('2d', { willReadFrequently: true });
  hx.filter = `blur(${blur}px)`;
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) hx.drawImage(P.cv.h, dx, dy);
  const H = hx.getImageData(0, 0, S, S);
  const c = C.data;
  const r = R.data;
  const m = M.data;
  const h = H.data;
  const pat = patina ? [patina.color.r * 255, patina.color.g * 255, patina.color.b * 255] : null;
  for (let y = 0; y < S; y++) {
    const iy1 = Math.floor((y * NS) / S / 2) % NS;
    const iy2 = (Math.floor((y * NS * 2) / S) + 97) % NS;
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const n1 = N[iy1 * NS + (Math.floor((x * NS) / S / 2) % NS)];
      const n2 = N[iy2 * NS + ((Math.floor((x * NS * 2) / S) + 41) % NS)];
      const hash = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
      let k = 1 + (n1 * 0.6 + n2 * 0.4 - 0.5) * grain * 2 + (hash - 0.5) * speck;
      if (pat) {
        // Patine (vert-de-gris) dans les creux du bruit : mate et non métallique.
        const p = smooth01((n1 * 0.7 + n2 * 0.3 - patina.threshold) / patina.soft) * patina.amount;
        if (p > 0) {
          for (let ch = 0; ch < 3; ch++) c[i + ch] = c[i + ch] * (1 - p) + pat[ch] * (0.75 + n2 * 0.5) * p;
          r[i] = r[i] * (1 - p) + 225 * p;
          m[i] = m[i] * (1 - p) + 20 * p;
        }
      }
      c[i] = Math.min(255, c[i] * k);
      c[i + 1] = Math.min(255, c[i + 1] * k);
      c[i + 2] = Math.min(255, c[i + 2] * k);
      r[i] = Math.min(255, Math.max(0, r[i] + (n2 - 0.5) * roughGrain * 255 + (hash - 0.5) * 12));
      h[i] = Math.min(255, Math.max(0, h[i] + (n2 - 0.5) * heightGrain * 255 + (hash - 0.5) * heightGrain * 40));
    }
  }
  P.c.putImageData(C, 0, 0);
  // Normale : (gauche - droite, bas - haut, 1) — l'axe V de la texture monte (canvas inversé).
  const nc = makeCanvas(S, S);
  const nx = nc.getContext('2d');
  const NI = nx.createImageData(S, S);
  const orm = makeCanvas(S, S);
  const ox = orm.getContext('2d');
  const OI = ox.createImageData(S, S);
  const hv = (x, y) => h[(((y + S) % S) * S + ((x + S) % S)) * 4];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const dx = ((hv(x - 1, y) - hv(x + 1, y)) / 255) * normal;
      const dy = ((hv(x, y + 1) - hv(x, y - 1)) / 255) * normal;
      const l = Math.hypot(dx, dy, 1);
      NI.data[i] = (dx / l) * 127.5 + 127.5;
      NI.data[i + 1] = (dy / l) * 127.5 + 127.5;
      NI.data[i + 2] = (1 / l) * 127.5 + 127.5;
      NI.data[i + 3] = 255;
      OI.data[i] = 255;
      OI.data[i + 1] = Math.max(10, r[i]);
      OI.data[i + 2] = m[i];
      OI.data[i + 3] = 255;
    }
  }
  nx.putImageData(NI, 0, 0);
  ox.putImageData(OI, 0, 0);
  const linear = (canvas) => {
    const t = toTexture(canvas);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  };
  return {
    map: toTexture(P.cv.c),
    normalMap: linear(nc),
    orm: linear(orm),
    emissiveMap: noEmit ? null : toTexture(P.cv.e),
    normal: o.normalScale ?? 1,
  };
}

function cachedSet(key, make) {
  if (!SETS.has(key)) SETS.set(key, make());
  return SETS.get(key);
}

// --- Motifs propres à chaque espèce ---

// Vaskhar : blindage lourd riveté, grain de roche, coulures de rouille, fentes éclairées.
function paintForteresse(P) {
  const S = P.S;
  blobs(P, 30, '20,12,6', 0.25, 20, 70, 0.15);
  panels(P, { rows: 4, cols: 2, stagger: 0.5, seam: 5, lift: 0.1, shade: 0.09, roughVar: 0.1, rivetR: 2.6, rivetStep: 14, jitter: 0.25 });
  // Plaques de renfort boulonnées par-dessus.
  for (let i = 0; i < 5; i++) {
    const w = P.rng.range(50, 110);
    const h = P.rng.range(30, 60);
    const x = P.rng.range(0, S);
    const y = P.rng.range(0, S);
    wrap(P, x, y, w, h, (X, Y) => {
      P.h.fillStyle = gray(0.72);
      P.h.fillRect(X, Y, w, h);
      P.c.fillStyle = 'rgba(0,0,0,0.12)';
      P.c.fillRect(X, Y, w, h);
      P.c.fillStyle = 'rgba(0,0,0,0.5)';
      P.c.fillRect(X, Y + h, w, 2);
      P.c.fillRect(X + w, Y, 2, h + 2);
    });
    for (const [rx, ry] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]]) rivet(P, x + rx, y + ry, 3);
  }
  streaks(P, 26, '125,52,18', 0.5, [30, 130], [2, 6]);
  streaks(P, 10, '20,14,10', 0.35, [20, 80], [2, 4]);
  scratches(P, 40, 40, 0.25);
  for (let i = 0; i < 5; i++) {
    const x = P.rng.range(20, S - 80);
    const y = P.rng.range(20, S - 20);
    windows(P, x, y, P.rng.int(2, 4), 12, 4, 6, 0.8);
  }
  stencil(P, `VK-${P.rng.int(10, 99)}`, P.rng.range(30, 300), P.rng.range(60, 460), 16, '25,15,8', 0.55);
  stencil(P, `${P.rng.int(100, 999)}`, P.rng.range(30, 300), P.rng.range(60, 460), 11, '25,15,8', 0.45);
}

// Thrennes : acier sombre poli, lames superposées, gravures rouges.
function paintPredateur(P) {
  const S = P.S;
  for (let i = 0; i < 500; i++) {
    const y = P.rng.range(0, S);
    P.c.fillStyle = P.rng.chance(0.5) ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
    P.c.fillRect(0, y, S, 1);
    P.r.fillStyle = P.rng.chance(0.5) ? gray(1, 0.06) : gray(0, 0.06);
    P.r.fillRect(0, y, S, 1);
  }
  // Rangées de lames en écailles obliques : chaque lame recouvre la suivante.
  const rows = 4;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const n = 5;
    const w = S / n;
    const skew = rh * 0.35;
    for (let k = n; k >= 0; k--) {
      const x0 = k * w + (r % 2) * w * 0.5;
      const y0 = r * rh;
      wrap(P, x0, y0 - skew, w * 1.25, rh + skew * 2, (X, Y) => {
        Y += skew;
        const poly = (ctx) => {
          ctx.beginPath();
          ctx.moveTo(X, Y + skew);
          ctx.lineTo(X + w * 1.15, Y);
          ctx.lineTo(X + w * 1.15, Y + rh - 3);
          ctx.lineTo(X, Y + rh + skew - 3);
          ctx.closePath();
        };
        const hg = P.h.createLinearGradient(X, 0, X + w * 1.15, 0);
        hg.addColorStop(0, gray(0.38));
        hg.addColorStop(1, gray(0.68));
        P.h.fillStyle = hg;
        poly(P.h);
        P.h.fill();
        const s = P.rng.range(-0.05, 0.05);
        P.c.fillStyle = s > 0 ? `rgba(255,255,255,${s})` : `rgba(0,0,0,${-s})`;
        poly(P.c);
        P.c.fill();
        // Fil de la lame : arête claire, ombre portée sur la suivante.
        P.c.strokeStyle = 'rgba(255,235,235,0.22)';
        P.c.lineWidth = 1.2;
        P.c.beginPath();
        P.c.moveTo(X + w * 1.15, Y);
        P.c.lineTo(X + w * 1.15, Y + rh - 3);
        P.c.stroke();
        P.c.strokeStyle = 'rgba(0,0,0,0.55)';
        P.c.lineWidth = 3;
        P.c.beginPath();
        P.c.moveTo(X, Y + rh + skew - 2);
        P.c.lineTo(X + w * 1.15, Y + rh - 2);
        P.c.stroke();
        P.r.fillStyle = gray(P.rng.range(0.18, 0.34));
        poly(P.r);
        P.r.fill();
      });
    }
  }
  scratches(P, 30, 50, 0.18);
  // Marques de victoires gravées, qui rougeoient.
  for (let g = 0; g < 3; g++) {
    const x = P.rng.range(10, S - 40);
    const y = P.rng.range(10, S - 30);
    const marks = P.rng.int(3, 6);
    for (const [ctx, style, lw] of [[P.h, gray(0.2), 2.5], [P.c, 'rgba(90,10,10,0.9)', 2], [P.e, gray(1, 0.9), 1.5]]) {
      ctx.strokeStyle = style;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let i = 0; i < marks; i++) {
        ctx.moveTo(x + i * 5, y);
        ctx.lineTo(x + i * 5 - 2, y + 16);
      }
      if (marks >= 5) {
        ctx.moveTo(x - 3, y + 13);
        ctx.lineTo(x + marks * 5, y + 3);
      }
      ctx.stroke();
    }
  }
  stencil(P, `Ʌ${P.rng.int(10, 99)}`, P.rng.range(40, 380), P.rng.range(60, 470), 14, '120,20,20', 0.6);
  for (let i = 0; i < 3; i++) windows(P, P.rng.range(20, S - 60), P.rng.range(20, S - 20), 3, 8, 3, 5, 0.6);
}

// Kel-Tirr : tuiles de céramique lisse, joints fins, liserés et inscriptions.
function paintAiguille(P, stripe) {
  const S = P.S;
  const n = 16;
  const t = S / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * t + (j % 2) * t * 0.5;
      const y = j * t;
      const s = P.rng.range(-0.035, 0.035) - (P.rng.chance(0.05) ? 0.08 : 0);
      wrap(P, x, y, t, t, (X, Y) => {
        P.c.fillStyle = s > 0 ? `rgba(255,255,255,${s})` : `rgba(40,35,30,${-s})`;
        P.c.fillRect(X, Y, t, t);
        const hg = P.h.createRadialGradient(X + t / 2, Y + t / 2, 0, X + t / 2, Y + t / 2, t * 0.7);
        hg.addColorStop(0, gray(0.56));
        hg.addColorStop(1, gray(0.5));
        P.h.fillStyle = hg;
        P.h.fillRect(X, Y, t, t);
        P.h.fillStyle = gray(0.36);
        P.h.fillRect(X, Y, t, 1.2);
        P.h.fillRect(X, Y, 1.2, t);
        P.c.fillStyle = 'rgba(60,55,45,0.28)';
        P.c.fillRect(X, Y, t, 1);
        P.c.fillRect(X, Y, 1, t);
        P.r.fillStyle = gray(P.rng.range(0.4, 0.55));
        P.r.fillRect(X + 1, Y + 1, t - 1, t - 1);
      });
    }
  }
  // Grandes trappes de service.
  for (let i = 0; i < 3; i++) {
    const x = Math.round(P.rng.range(0, S) / t) * t;
    const y = Math.round(P.rng.range(0, S) / t) * t;
    const w = t * P.rng.int(2, 4);
    const h = t * P.rng.int(2, 3);
    wrap(P, x, y, w, h, (X, Y) => {
      P.h.strokeStyle = gray(0.3);
      P.h.lineWidth = 2;
      P.h.strokeRect(X + 1, Y + 1, w - 2, h - 2);
      P.c.strokeStyle = 'rgba(50,45,40,0.5)';
      P.c.lineWidth = 1.2;
      P.c.strokeRect(X + 1, Y + 1, w - 2, h - 2);
    });
  }
  // Liserés peints et flèches.
  const sc = `${Math.round(stripe.r * 255)},${Math.round(stripe.g * 255)},${Math.round(stripe.b * 255)}`;
  const y0 = Math.round(P.rng.range(0.25, 0.7) * S);
  P.c.fillStyle = `rgba(${sc},0.95)`;
  P.c.fillRect(0, y0, S, 6);
  P.c.fillRect(0, y0 + 10, S, 2);
  P.r.fillStyle = gray(0.3);
  P.r.fillRect(0, y0, S, 12);
  P.e.fillStyle = gray(1, 0.18);
  P.e.fillRect(0, y0 + 1, S, 4);
  for (let x = 16; x < S; x += 64) {
    P.c.beginPath();
    P.c.moveTo(x, y0 + 18);
    P.c.lineTo(x + 10, y0 + 24);
    P.c.lineTo(x, y0 + 30);
    P.c.fill();
  }
  stencil(P, `KT ${P.rng.int(100, 999)}`, P.rng.range(20, 300), y0 - 12, 15, '40,40,48', 0.7);
  stencil(P, 'NE PAS MARCHER', P.rng.range(20, 300), P.rng.range(40, 480), 9, '60,58,60', 0.5, 'sans-serif');
  windows(P, P.rng.range(30, 200), P.rng.range(60, 200), 6, 9, 6, 7, 0.85);
  blobs(P, 12, '70,60,50', 0.08, 30, 90, 0.08);
  streaks(P, 8, '80,70,60', 0.12, [40, 120], [3, 8]);
}

// Ondésiens : membrane nervurée, cellules et veines luminescentes.
function paintMeduse(P) {
  const S = P.S;
  const ribs = 12;
  for (let i = 0; i < ribs; i++) {
    const x = (i / ribs) * S;
    const amp = P.rng.range(4, 10);
    const ph = P.rng.range(0, Math.PI * 2);
    for (const [ctx, style, w] of [[P.h, gray(0.62, 0.6), 12], [P.h, gray(0.78), 4], [P.c, 'rgba(255,255,255,0.12)', 6], [P.c, 'rgba(0,30,40,0.25)', 1], [P.r, gray(0, 0.15), 6]]) {
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      for (const dx of [-S, 0, S]) {
        ctx.beginPath();
        for (let y = 0; y <= S; y += 8) {
          const X = x + dx + Math.sin((y / S) * Math.PI * 4 + ph) * amp;
          y ? ctx.lineTo(X, y) : ctx.moveTo(X, y);
        }
        ctx.stroke();
      }
    }
  }
  for (let i = 0; i < 160; i++) {
    const x = P.rng.range(0, S);
    const y = P.rng.range(0, S);
    const r = P.rng.range(6, 20);
    wrap(P, x - r, y - r, r * 2, r * 2, (X, Y) => {
      X += r;
      Y += r;
      const g = P.h.createRadialGradient(X, Y, 0, X, Y, r);
      g.addColorStop(0, gray(0.58, 0.8));
      g.addColorStop(0.8, gray(0.5, 0.3));
      g.addColorStop(1, gray(0.42, 0.6));
      P.h.fillStyle = g;
      P.h.beginPath();
      P.h.arc(X, Y, r, 0, Math.PI * 2);
      P.h.fill();
      const c = P.c.createRadialGradient(X, Y, 0, X, Y, r);
      c.addColorStop(0, 'rgba(255,255,255,0.14)');
      c.addColorStop(1, 'rgba(0,25,35,0.16)');
      P.c.fillStyle = c;
      P.c.beginPath();
      P.c.arc(X, Y, r, 0, Math.PI * 2);
      P.c.fill();
    });
  }
  for (let i = 0; i < 7; i++) {
    veins(P, [[P.e, gray(1, 0.85), 1], [P.c, 'rgba(220,255,255,0.35)', 1.5], [P.h, gray(0.66), 2]], P.rng.range(0, S), P.rng.range(0, S), P.rng.range(0, Math.PI * 2), 40, 1.8);
  }
  for (let i = 0; i < 60; i++) {
    const x = P.rng.range(0, S);
    const y = P.rng.range(0, S);
    P.e.fillStyle = gray(1, P.rng.range(0.4, 1));
    P.e.beginPath();
    P.e.arc(x, y, P.rng.range(0.8, 2), 0, Math.PI * 2);
    P.e.fill();
  }
}

// Synodes : chitine organique — plaques bombées irrégulières qui se chevauchent, pores, filaments lumineux.
function paintGrappe(P) {
  const S = P.S;
  const plates = [];
  for (let i = 0; i < 260; i++) plates.push([P.rng.range(0, S), P.rng.range(0, S), P.rng.range(10, 30), P.rng.range(0.6, 1), P.rng.range(-0.6, 0.6)]);
  plates.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r, sy, rot] of plates) {
    const s = P.rng.range(-0.07, 0.07);
    const rough = P.rng.range(0.16, 0.34);
    wrap(P, x - r, y - r, r * 2, r * 2, (X, Y) => {
      const cx = X + r;
      const cy = Y + r;
      const shape = (ctx) => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * sy, rot, 0, Math.PI * 2);
      };
      const hg = P.h.createRadialGradient(cx, cy - r * 0.2, 0, cx, cy, r);
      hg.addColorStop(0, gray(0.72));
      hg.addColorStop(0.75, gray(0.6));
      hg.addColorStop(1, gray(0.42));
      P.h.fillStyle = hg;
      shape(P.h);
      P.h.fill();
      const cg = P.c.createRadialGradient(cx, cy - r * 0.25, 0, cx, cy, r);
      cg.addColorStop(0, s > 0 ? `rgba(255,240,255,${0.1 + s})` : 'rgba(255,240,255,0.06)');
      cg.addColorStop(0.8, s < 0 ? `rgba(0,0,0,${-s})` : 'rgba(0,0,0,0)');
      cg.addColorStop(1, 'rgba(25,5,35,0.35)');
      P.c.fillStyle = cg;
      shape(P.c);
      P.c.fill();
      P.r.fillStyle = gray(rough);
      shape(P.r);
      P.r.fill();
    });
  }
  blobs(P, 40, '25,5,35', 0.3, 4, 14, 0.2);
  for (let i = 0; i < 400; i++) {
    const x = P.rng.range(0, S);
    const y = P.rng.range(0, S);
    const r = P.rng.range(0.6, 1.6);
    P.h.fillStyle = gray(0.28);
    P.c.fillStyle = 'rgba(20,5,25,0.55)';
    for (const ctx of [P.h, P.c]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i < 6; i++) {
    veins(P, [[P.e, gray(1, 0.9), 1], [P.c, 'rgba(230,200,255,0.4)', 1.4], [P.h, gray(0.62), 1.6]], P.rng.range(0, S), P.rng.range(0, S), P.rng.range(0, Math.PI * 2), 30, 1.6);
  }
}

// Orrhaïdes : facettes de cristal inclinées, fêlures lumineuses.
function paintCristal(P) {
  const S = P.S;
  const n = 7;
  const cell = S / n;
  const jit = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) jit.push([P.rng.range(-0.35, 0.35), P.rng.range(-0.35, 0.35)]);
  const pt = (i, j) => {
    const [jx, jy] = jit[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
    return [(i + jx) * cell, (j + jy) * cell];
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + 1, j + 1);
      const d = pt(i, j + 1);
      const tris = (i + j) % 2 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      for (const tri of tris) {
        const ang = P.rng.range(0, Math.PI * 2);
        const tilt = P.rng.range(0.05, 0.22);
        const s = P.rng.range(-0.12, 0.16);
        const rough = P.rng.range(0.02, 0.14);
        for (const [dx, dy] of [[0, 0], [-S, 0], [0, -S], [-S, -S]]) {
          const path = (ctx) => {
            ctx.beginPath();
            tri.forEach(([x, y], k) => (k ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
            ctx.closePath();
          };
          const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3 + dx;
          const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3 + dy;
          const g = P.h.createLinearGradient(cx - Math.cos(ang) * cell, cy - Math.sin(ang) * cell, cx + Math.cos(ang) * cell, cy + Math.sin(ang) * cell);
          g.addColorStop(0, gray(0.5 - tilt));
          g.addColorStop(1, gray(0.5 + tilt));
          P.h.fillStyle = g;
          path(P.h);
          P.h.fill();
          P.c.fillStyle = s > 0 ? `rgba(255,255,255,${s})` : `rgba(40,70,120,${-s})`;
          path(P.c);
          P.c.fill();
          P.c.strokeStyle = 'rgba(255,255,255,0.35)';
          P.c.lineWidth = 1;
          P.c.stroke();
          P.r.fillStyle = gray(rough);
          path(P.r);
          P.r.fill();
        }
      }
    }
  }
  for (let i = 0; i < 10; i++) {
    let x = P.rng.range(0, S);
    let y = P.rng.range(0, S);
    const pts = [[x, y]];
    for (let k = 0; k < 6; k++) {
      x += P.rng.range(-30, 30);
      y += P.rng.range(-30, 30);
      pts.push([x, y]);
    }
    for (const [ctx, style, w] of [[P.c, 'rgba(255,255,255,0.7)', 1], [P.e, gray(1, 0.9), 1.2], [P.h, gray(0.3), 1.5]]) {
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    }
  }
  blobs(P, 14, '200,230,255', 0.18, 10, 40);
}

// Liseurs : or brossé, plaques fines, bandeaux de glyphes gravés qui luisent.
function paintVoilier(P) {
  const S = P.S;
  for (let i = 0; i < 700; i++) {
    const y = P.rng.range(0, S);
    const a = P.rng.range(0.02, 0.07);
    P.c.fillStyle = P.rng.chance(0.5) ? `rgba(255,245,210,${a})` : `rgba(60,40,10,${a})`;
    P.c.fillRect(0, y, S, 1);
    P.r.fillStyle = P.rng.chance(0.5) ? gray(1, 0.08) : gray(0, 0.08);
    P.r.fillRect(0, y, S, 1);
  }
  panels(P, { rows: 2, cols: 3, stagger: 0.5, seam: 2, lift: 0.03, shade: 0.04, roughVar: 0.05 });
  const bands = 2;
  for (let b = 0; b < bands; b++) {
    const y = b * (S / bands) + P.rng.range(30, 120);
    P.h.fillStyle = gray(0.42);
    P.h.fillRect(0, y - 8, S, 36);
    P.c.fillStyle = 'rgba(60,35,5,0.3)';
    P.c.fillRect(0, y - 8, S, 36);
    P.c.fillStyle = 'rgba(255,230,160,0.25)';
    P.c.fillRect(0, y + 28, S, 1.5);
    P.r.fillStyle = gray(0.45, 0.6);
    P.r.fillRect(0, y - 8, S, 36);
    for (let x = 6; x < S - 20; x += 24) engraved(P, x, y, 18, 0.95);
  }
  blobs(P, 14, '40,25,5', 0.18, 20, 60, 0.12);
  scratches(P, 18, 30, 0.2);
  windows(P, P.rng.range(40, 300), P.rng.range(20, 60), 5, 6, 10, 8, 0.8);
}

// Ashkari : cuivre ondulé, patine vert-de-gris, joints rivetés, pochoirs et bandes de danger.
function paintCaravane(P) {
  const S = P.S;
  const period = 16;
  for (let x = 0; x < S; x++) {
    const s = Math.sin((x / period) * Math.PI * 2);
    P.h.fillStyle = gray(0.5 + s * 0.16);
    P.h.fillRect(x, 0, 1, S);
    P.c.fillStyle = s > 0 ? `rgba(255,220,180,${s * 0.1})` : `rgba(30,10,0,${-s * 0.14})`;
    P.c.fillRect(x, 0, 1, S);
  }
  for (let y = 0; y < S; y += 128) {
    P.h.fillStyle = gray(0.62);
    P.h.fillRect(0, y, S, 14);
    P.c.fillStyle = 'rgba(40,20,5,0.35)';
    P.c.fillRect(0, y, S, 14);
    P.c.fillStyle = 'rgba(0,0,0,0.5)';
    P.c.fillRect(0, y + 14, S, 2);
    for (let x = 8; x < S; x += 16) rivet(P, x, y + 7, 2.4);
  }
  streaks(P, 30, '30,60,50', 0.35, [30, 110], [2, 6]);
  blobs(P, 30, '20,10,0', 0.3, 15, 50, 0.2);
  scratches(P, 30, 35, 0.3);
  // Bande de danger.
  const hy = Math.round(P.rng.range(0.55, 0.8) * S);
  P.c.save();
  P.c.beginPath();
  P.c.rect(0, hy, S, 20);
  P.c.clip();
  for (let x = -40; x < S + 40; x += 32) {
    P.c.fillStyle = 'rgba(214,160,40,0.9)';
    P.c.beginPath();
    P.c.moveTo(x, hy + 20);
    P.c.lineTo(x + 16, hy + 20);
    P.c.lineTo(x + 36, hy);
    P.c.lineTo(x + 20, hy);
    P.c.fill();
  }
  P.c.restore();
  P.m.fillStyle = gray(0.2);
  P.m.fillRect(0, hy, S, 20);
  P.r.fillStyle = gray(0.55);
  P.r.fillRect(0, hy, S, 20);
  stencil(P, `${P.rng.int(10, 99)}`, P.rng.range(40, 300), P.rng.range(200, 300), 54, '25,12,4', 0.55);
  stencil(P, `ASK-${P.rng.int(100, 999)}`, P.rng.range(30, 300), P.rng.range(40, 100), 15, '25,12,4', 0.6);
  for (let i = 0; i < 3; i++) windows(P, P.rng.range(20, S - 80), P.rng.range(330, 480), 4, 8, 6, 6, 0.75);
}

// Voile tissée des Liseurs : trame, nervures, colonnes de glyphes (UV 0..1 sur toute la voile).
function paintSail(P) {
  const S = P.S;
  const g = P.c.createLinearGradient(0, 0, S, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0.12)');
  P.c.fillStyle = g;
  P.c.fillRect(0, 0, S, S);
  const t = 4;
  for (let y = 0; y < S; y += t) {
    for (let x = 0; x < S; x += t) {
      const over = ((x + y) / t) % 2;
      P.h.fillStyle = gray(over ? 0.6 : 0.42);
      if (over) P.h.fillRect(x, y + 0.5, t, t - 1);
      else P.h.fillRect(x + 0.5, y, t - 1, t);
      P.c.fillStyle = over ? 'rgba(255,240,200,0.06)' : 'rgba(60,40,10,0.08)';
      P.c.fillRect(x, y, t, t);
    }
  }
  const ribs = P.rng.int(5, 7);
  for (let i = 0; i <= ribs; i++) {
    const y = (i / ribs) * S;
    for (const [ctx, style, w] of [[P.h, gray(0.75), 6], [P.c, 'rgba(90,60,15,0.6)', 3], [P.e, gray(1, 0.25), 2], [P.m, gray(0.8), 4], [P.r, gray(0.35), 4]]) {
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(S * 0.5, y + 12, S, y - 36);
      ctx.stroke();
    }
  }
  const cols = 3;
  for (let k = 0; k < cols; k++) {
    const x = 50 + k * 70 + P.rng.range(0, 30);
    for (let y = 20; y < S - 30; y += 28) {
      P.c.strokeStyle = 'rgba(110,70,10,0.85)';
      P.c.lineWidth = 2.2;
      P.e.strokeStyle = gray(1);
      P.e.lineWidth = 2;
      glyph(P.rng, [P.c, P.e], x, y, 18);
    }
  }
  blobs(P, 10, '50,30,5', 0.15, 30, 80, 0.1);
}

// Coque sombre commune : mécanique, grilles d'aération, tuyaux, boulons (neutre, teintée par la couleur).
function paintDark(P) {
  const S = P.S;
  panels(P, { rows: 4, cols: 4, stagger: 0.25, seam: 2, lift: 0.04, shade: 0.07, roughVar: 0.1, rivetR: 1.4, rivetStep: 8, jitter: 0.3 });
  for (let v = 0; v < 4; v++) {
    const x = P.rng.range(0, S - 50);
    const y = P.rng.range(0, S - 30);
    const w = P.rng.range(24, 50);
    for (let k = 0; k < 6; k++) {
      P.h.fillStyle = gray(0.28);
      P.h.fillRect(x, y + k * 5, w, 2.5);
      P.c.fillStyle = 'rgba(0,0,0,0.6)';
      P.c.fillRect(x, y + k * 5, w, 2.5);
    }
  }
  for (let p = 0; p < 3; p++) {
    const y = P.rng.range(0, S);
    const g = P.h.createLinearGradient(0, y, 0, y + 8);
    g.addColorStop(0, gray(0.5));
    g.addColorStop(0.5, gray(0.8));
    g.addColorStop(1, gray(0.5));
    P.h.fillStyle = g;
    P.h.fillRect(0, y, S, 8);
    P.c.fillStyle = 'rgba(255,255,255,0.08)';
    P.c.fillRect(0, y + 2, S, 2);
  }
  blobs(P, 16, '0,0,0', 0.3, 10, 40, 0.15);
  scratches(P, 20, 20, 0.2);
}

// Peinture écaillée (pièces de couleur vive) : métal nu dans les éclats.
function paintChipped(P) {
  panels(P, { rows: 2, cols: 2, seam: 2, lift: 0.03, shade: 0.04 });
  for (let i = 0; i < 70; i++) {
    const x = P.rng.range(0, P.S);
    const y = P.rng.range(0, P.S);
    const r = P.rng.range(1, 4);
    P.c.fillStyle = 'rgba(120,120,125,0.9)';
    P.c.beginPath();
    P.c.ellipse(x, y, r * 1.6, r, P.rng.range(0, 3), 0, Math.PI * 2);
    P.c.fill();
    P.m.fillStyle = gray(0.9);
    P.m.fill();
    P.h.fillStyle = gray(0.4);
    P.h.fill();
  }
  blobs(P, 10, '0,0,0', 0.25, 10, 30, 0.1);
}

// Conteneur (UV ajustées à chaque face) : cadre, tôle ondulée, pochoir.
function paintContainer(P) {
  const S = P.S;
  for (let x = 0; x < S; x++) {
    const s = Math.sin((x / 10) * Math.PI * 2);
    P.h.fillStyle = gray(0.5 + s * 0.12);
    P.h.fillRect(x, 0, 1, S);
    P.c.fillStyle = s > 0 ? `rgba(255,230,200,${s * 0.08})` : `rgba(20,8,0,${-s * 0.12})`;
    P.c.fillRect(x, 0, 1, S);
  }
  const f = 14;
  P.h.fillStyle = gray(0.75);
  for (const [x, y, w, h] of [[0, 0, S, f], [0, S - f, S, f], [0, 0, f, S], [S - f, 0, f, S]]) P.h.fillRect(x, y, w, h);
  P.c.fillStyle = 'rgba(30,18,8,0.55)';
  for (const [x, y, w, h] of [[0, 0, S, f], [0, S - f, S, f], [0, 0, f, S], [S - f, 0, f, S]]) P.c.fillRect(x, y, w, h);
  P.c.strokeStyle = 'rgba(0,0,0,0.6)';
  P.c.lineWidth = 2;
  P.c.strokeRect(f, f, S - f * 2, S - f * 2);
  for (const [x, y] of [[f / 2, f / 2], [S - f / 2, f / 2], [f / 2, S - f / 2], [S - f / 2, S - f / 2]]) rivet(P, x, y, 3);
  stencil(P, `${P.rng.int(10, 99)}`, 40, 150, 70, '20,10,4', 0.5);
  stencil(P, `ASK ${P.rng.int(1000, 9999)}`, 30, 60, 18, '20,10,4', 0.6);
  streaks(P, 12, '35,70,60', 0.3, [20, 80], [2, 5]);
  blobs(P, 14, '20,10,0', 0.3, 10, 40, 0.2);
  scratches(P, 14, 25, 0.25);
}

// Radiateur : ailettes de cuivre.
function paintRadiator(P) {
  const S = P.S;
  for (let y = 0; y < S; y += 8) {
    const g = P.h.createLinearGradient(0, y, 0, y + 8);
    g.addColorStop(0, gray(0.3));
    g.addColorStop(0.4, gray(0.8));
    g.addColorStop(1, gray(0.3));
    P.h.fillStyle = g;
    P.h.fillRect(0, y, S, 8);
    P.c.fillStyle = 'rgba(255,200,150,0.18)';
    P.c.fillRect(0, y + 2, S, 2);
    P.c.fillStyle = 'rgba(0,0,0,0.45)';
    P.c.fillRect(0, y + 6, S, 2);
  }
  blobs(P, 10, '10,5,0', 0.3, 10, 40, 0.15);
}

// Réglages par archétype : teinte de base peinte, rugosité, métal, finition.
const SURFACES = {
  forteresse: { paint: paintForteresse, rough: 0.74, metal: 0.4, finish: { grain: 0.2, speck: 0.08, roughGrain: 0.2, heightGrain: 0.12, normal: 3 }, normalScale: 1.1 },
  predateur: { paint: paintPredateur, rough: 0.3, metal: 0.9, finish: { grain: 0.07, roughGrain: 0.1, heightGrain: 0.03, normal: 3 }, normalScale: 1 },
  aiguille: { paint: paintAiguille, rough: 0.5, metal: 0.03, finish: { grain: 0.05, speck: 0.03, roughGrain: 0.08, heightGrain: 0.02, normal: 2.5 }, normalScale: 0.8 },
  meduse: { paint: paintMeduse, rough: 0.22, metal: 0, finish: { grain: 0.1, roughGrain: 0.1, heightGrain: 0.04, normal: 2.5, blur: 1.2 }, normalScale: 1 },
  grappe: { paint: paintGrappe, rough: 0.28, metal: 0.12, finish: { grain: 0.12, roughGrain: 0.1, heightGrain: 0.04, normal: 3 }, normalScale: 1 },
  cristal: { paint: paintCristal, rough: 0.06, metal: 0.1, finish: { grain: 0.06, speck: 0.02, roughGrain: 0.04, heightGrain: 0.01, normal: 4, blur: 0.4 }, normalScale: 1 },
  voilier: { paint: paintVoilier, rough: 0.38, metal: 0.45, finish: { grain: 0.08, roughGrain: 0.1, heightGrain: 0.02, normal: 3 }, normalScale: 1 },
  caravane: { paint: paintCaravane, rough: 0.38, metal: 0.85, finish: { grain: 0.12, roughGrain: 0.14, heightGrain: 0.05, normal: 3, patina: { color: new THREE.Color('#4f9a86'), threshold: 0.6, soft: 0.08, amount: 0.7 } }, normalScale: 1 },
};

function hullSet(archetype, base, stripe) {
  return cachedSet(`coque|${archetype}|${base.getHexString()}`, () => {
    const s = SURFACES[archetype];
    const P = painter(512, 1000 + Object.keys(SURFACES).indexOf(archetype) * 77, base, s.rough, s.metal);
    s.paint(P, stripe);
    const set = finish(P, { ...s.finish, normalScale: s.normalScale });
    set.base = base.clone();
    return set;
  });
}

const DARK_BASE = new THREE.Color('#6a6e76');
const PAINT_BASE = new THREE.Color('#d0d0d0');
const CONTAINER_BASE = new THREE.Color('#b07850');
const SAIL_BASE = new THREE.Color('#d9b870');
const RADIATOR_BASE = new THREE.Color('#8a5a38');
function darkSet() {
  return cachedSet('sombre', () => Object.assign(finish(paintThen(painter(256, 31, DARK_BASE, 0.45, 0.85), paintDark), { grain: 0.1, roughGrain: 0.12, heightGrain: 0.03, normal: 2.5, noEmit: true }), { base: DARK_BASE }));
}
function paintSet() {
  return cachedSet('peinture', () => Object.assign(finish(paintThen(painter(256, 32, PAINT_BASE, 0.42, 0.2), paintChipped), { grain: 0.06, roughGrain: 0.1, normal: 2, noEmit: true }), { base: PAINT_BASE }));
}
function containerSet() {
  return cachedSet('conteneur', () => Object.assign(finish(paintThen(painter(256, 33, CONTAINER_BASE, 0.4, 0.8), paintContainer), { grain: 0.12, roughGrain: 0.14, normal: 2.5, noEmit: true, patina: { color: new THREE.Color('#4f9a86'), threshold: 0.6, soft: 0.08, amount: 0.6 } }), { base: CONTAINER_BASE }));
}
function sailSet() {
  return cachedSet('voile', () => Object.assign(finish(paintThen(painter(512, 34, SAIL_BASE, 0.7, 0.25), paintSail), { grain: 0.06, roughGrain: 0.08, normal: 2, blur: 0.4 }), { base: SAIL_BASE }));
}
function radiatorSet() {
  return cachedSet('radiateur', () => Object.assign(finish(paintThen(painter(128, 35, RADIATOR_BASE, 0.4, 0.8), paintRadiator), { grain: 0.1, normal: 2.5, noEmit: true }), { base: RADIATOR_BASE }));
}
function paintThen(P, fn) {
  fn(P);
  return P;
}

// Couleur à donner au matériau pour que la texture (peinte en `base`) prenne la teinte `target`.
function tintFor(target, base) {
  const c = new THREE.Color(target);
  c.r = Math.min(3, c.r / Math.max(0.02, base.r));
  c.g = Math.min(3, c.g / Math.max(0.02, base.g));
  c.b = Math.min(3, c.b / Math.max(0.02, base.b));
  return c;
}

// Matériau PBR texturé. uv : 'tile' (répétition à l'échelle du modèle) ou 'fit' (une texture par face).
function pbr(set, o = {}) {
  const mat = new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap, normalScale: new THREE.Vector2(set.normal, set.normal),
    roughnessMap: set.orm, metalnessMap: set.orm, roughness: o.roughness ?? 1, metalness: o.metalness ?? 1,
    emissiveMap: set.emissiveMap, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1,
    color: o.color ?? 0xffffff, envMap: spaceEnv(), envMapIntensity: o.env ?? 1, vertexColors: true, side: THREE.DoubleSide,
  });
  mat.userData = { uv: o.uv ?? 'tile', weather: true };
  return mat;
}

// Variante d'un matériau texturé : même textures, autre teinte ou réglages.
function variant(mat, multiply, o = {}) {
  const v = mat.clone();
  if (multiply) v.color.multiply(new THREE.Color(multiply));
  Object.assign(v, o);
  return v;
}

// --- Coordonnées de texture à l'échelle (une répétition = TILE unités), selon la forme ---

function scaleUV(geometry, su, sv) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}

// Projection sur la face dominante (formes à facettes : blocs, ailes, polyèdres).
function boxProjectUV(geometry, fit) {
  const pos = geometry.attributes.position;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nor = geometry.attributes.normal;
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const size = new THREE.Vector3().subVectors(max, min);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let a;
    let b;
    let flip;
    if (ax >= ay && ax >= az) (a = 2), (b = 1), (flip = nor.getX(i) > 0);
    else if (ay >= az) (a = 0), (b = 2), (flip = nor.getY(i) < 0);
    else (a = 0), (b = 1), (flip = nor.getZ(i) < 0);
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const mn = [min.x, min.y, min.z];
    const sz = [size.x || 1, size.y || 1, size.z || 1];
    // Face opposée : U inversé, pour que les inscriptions ne soient pas en miroir.
    const u = fit ? (p[a] - mn[a]) / sz[a] : p[a] / TILE;
    uv[i * 2] = flip ? (fit ? 1 - u : -u) : u;
    uv[i * 2 + 1] = fit ? (p[b] - mn[b]) / sz[b] : p[b] / TILE;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

const UV_DONE = new WeakSet();
function prepareUV(geometry, mode) {
  if (UV_DONE.has(geometry) || !geometry.attributes.uv) return;
  UV_DONE.add(geometry);
  const p = geometry.parameters ?? {};
  const around = (r) => Math.max(1, Math.round((2 * Math.PI * r) / TILE));
  if (mode === 'fit') return boxProjectUV(geometry, true);
  switch (geometry.type) {
    case 'LatheGeometry': {
      // Abscisse curviligne du profil : la texture ne s'étire plus sur les coques longues.
      const pts = p.points;
      const n = pts.length;
      const acc = [0];
      for (let j = 1; j < n; j++) acc.push(acc[j - 1] + pts[j].distanceTo(pts[j - 1]));
      const rmax = Math.max(...pts.map((q) => q.x));
      const uv = geometry.attributes.uv;
      const su = around(rmax);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, acc[i % n] / TILE);
      uv.needsUpdate = true;
      return;
    }
    case 'CapsuleGeometry':
      return scaleUV(geometry, around(p.radius), (p.length + p.radius * 2) / TILE);
    case 'SphereGeometry':
      return scaleUV(geometry, around((p.radius * p.phiLength) / (2 * Math.PI)), Math.max(0.25, (p.radius * p.thetaLength) / TILE));
    case 'TorusGeometry':
      return scaleUV(geometry, around(p.radius), Math.max(0.2, (2 * Math.PI * p.tube) / TILE));
    case 'CylinderGeometry':
    case 'ConeGeometry':
      return scaleUV(geometry, around(Math.max(p.radiusTop ?? 0, p.radiusBottom ?? p.radius ?? 0)), p.height / TILE);
    case 'TubeGeometry':
      return;
    default:
      return boxProjectUV(geometry, false);
  }
}

// Couleurs de sommet : suie près des réacteurs, ventre un peu plus sombre (occlusion grossière).
function weatherShip(ship, rearZ, L, R) {
  ship.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(ship.matrixWorld).invert();
  const local = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const seen = new Set();
  const span = L * 0.3;
  ship.traverse((o) => {
    if (!o.isMesh || !o.material.userData?.weather) return;
    prepareUV(o.geometry, o.material.userData.uv);
    if (seen.has(o.geometry)) o.geometry = o.geometry.clone();
    seen.add(o.geometry);
    local.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(local);
      const soot = 0.32 + 0.68 * smooth01((v.z - rearZ) / span);
      const belly = 1 - 0.12 * smooth01(-v.y / (R * 1.5));
      const k = soot * belly;
      col[i * 3] = k;
      col[i * 3 + 1] = k * (0.97 + 0.03 * soot);
      col[i * 3 + 2] = k * (0.92 + 0.08 * soot);
    }
    o.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  });
}

// --- Géométries ---

// Corps tourné autour de l'axe Z : profil [[t (0 arrière → 1 avant), r], ...], centré sur l'origine.
function latheZ(profile, length, radius, segments) {
  const pts = profile.map(([t, r]) => new THREE.Vector2(Math.max(0.001, r * radius), t * length));
  const geometry = new THREE.LatheGeometry(pts, segments);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, -length / 2);
  return geometry;
}

// Pointe ou éclat partant de l'origine vers +Z (bipyramide à facettes).
function shardGeometry(length, radius, segments = 5, mid = 0.35) {
  const geometry = latheZ([[0, 0.001], [mid, 1], [1, 0.001]], length, radius, segments);
  geometry.translate(0, 0, length / 2);
  return geometry;
}

// Cône partant de l'origine vers +Z.
function spikeGeometry(length, radius, segments = 4) {
  const geometry = new THREE.ConeGeometry(radius, length, segments);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, length / 2);
  return geometry;
}

// Remet les coordonnées de texture entre 0 et `repeat` (formes extrudées ou planes).
function normalizeUV(geometry, repeat = 1) {
  const uv = geometry.attributes.uv;
  if (!uv) return geometry;
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    minU = Math.min(minU, uv.getX(i));
    maxU = Math.max(maxU, uv.getX(i));
    minV = Math.min(minV, uv.getY(i));
    maxV = Math.max(maxV, uv.getY(i));
  }
  const du = maxU - minU || 1;
  const dv = maxV - minV || 1;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, ((uv.getX(i) - minU) / du) * repeat, ((uv.getY(i) - minV) / dv) * repeat);
  uv.needsUpdate = true;
  return geometry;
}

// Bloc chanfreiné (w en X, h en Y, d en Z), centré.
function slab(w, h, d, bevel = 0.22) {
  const b = Math.min(w, h, d) * bevel;
  const x = w / 2 - b;
  const y = h / 2 - b;
  const shape = new THREE.Shape();
  shape.moveTo(-x, -y);
  shape.lineTo(x, -y);
  shape.lineTo(x, y);
  shape.lineTo(-x, y);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1 });
  geometry.translate(0, 0, -(d - 2 * b) / 2);
  return normalizeUV(geometry);
}

// Poutre cylindrique entre deux points.
function beam(a, b, radius, material, segments = 6) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), segments), material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
  return mesh;
}

function pointAlong(mesh, dir) {
  mesh.quaternion.setFromUnitVectors(Z_AXIS, dir.clone().normalize());
  return mesh;
}

// Vrai symétrique par rapport au plan YZ (rotations comprises), pour les pièces paires.
function mirrorX(mesh) {
  const copy = mesh.clone();
  const q = mesh.quaternion;
  copy.position.x *= -1;
  copy.quaternion.set(q.x, -q.y, -q.z, q.w);
  copy.scale.x *= -1;
  return copy;
}

function v3(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

// Aile à liseré : l'aile, plus une copie fine et un peu plus grande d'une autre couleur dessous.
function edgedWing(geometry, material, edgeMaterial) {
  normalizeUV(geometry);
  const wing = new THREE.Mesh(geometry, material);
  if (edgeMaterial) {
    const edge = new THREE.Mesh(geometry, edgeMaterial);
    edge.scale.set(1.05, 0.45, 1.07);
    wing.add(edge);
  }
  return wing;
}

// Ensemble à symétrie axiale : place `make(i)` tout autour de l'axe Z.
function around(ship, count, phase, make) {
  for (let i = 0; i < count; i++) {
    const holder = new THREE.Group();
    holder.rotation.z = phase + (i / count) * Math.PI * 2;
    holder.add(make(i));
    ship.add(holder);
  }
}

// --- Pièces communes (réacteurs, tourelles, anneaux, soutes) ---

function addEngine(c, x, y, z, r, type = 'tuyere') {
  const { ship, m } = c;
  if (type === 'tuyere') {
    const len = r * 1.5;
    const bell = new THREE.Mesh(latheZ([[0, 1], [0.35, 0.93], [0.75, 0.78], [1, 0.72]], len, r, 16), m.dark);
    bell.position.set(x, y, z - len / 2);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, r * 0.12, 6, 16), m.hull);
    collar.position.set(x, y, z - len * 0.05);
    const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.86, 18), m.glow);
    core.rotation.y = Math.PI;
    core.position.set(x, y, z - len * 0.55);
    ship.add(bell, collar, core);
    z -= len;
  } else if (type === 'cristal') {
    const emitter = new THREE.Mesh(shardGeometry(r * 2, r * 0.8, 6, 0.5), m.glow);
    emitter.rotation.y = Math.PI;
    emitter.position.set(x, y, z);
    ship.add(emitter);
    z -= r * 1.2;
  } else {
    // 'organique' : une poche de lumière au lieu d'une tuyère.
    const orb = new THREE.Mesh(new THREE.SphereGeometry(r * 0.75, 16, 12), m.glow);
    orb.position.set(x, y, z);
    ship.add(orb);
  }
  const flame = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: c.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  // La scène règle l'échelle de la flamme elle-même : un support la proportionne au réacteur.
  const holder = new THREE.Group();
  const k = THREE.MathUtils.clamp(r / 0.09, 0.35, 1.2);
  holder.scale.setScalar(k);
  holder.position.set(x, y, z - 0.15 * k);
  holder.add(flame);
  ship.add(holder);
  c.flames.push(flame);
  makeJet(ship, x, y, z - (type === 'organique' ? r * 0.6 : 0.01), r, type === 'cristal' ? c.glow.clone().lerp(WHITE, 0.3) : c.glow, c.jets);
}

function styledTurret(c, size, barrels) {
  const { m } = c;
  const t = new THREE.Group();
  const kind = c.look.turret ?? 'meca';
  if (kind === 'organique') {
    const polyp = new THREE.Mesh(new THREE.SphereGeometry(size * 0.48, 14, 10), m.hull);
    polyp.scale.y = 0.75;
    t.add(polyp);
    for (let b = 0; b < barrels; b++) {
      const sting = new THREE.Mesh(spikeGeometry(size * 1.5, size * 0.12, 8), m.glow);
      sting.position.set((b - (barrels - 1) / 2) * size * 0.26, size * 0.18, size * 0.1);
      t.add(sting);
    }
  } else if (kind === 'cristal') {
    const base = new THREE.Mesh(new THREE.OctahedronGeometry(size * 0.45, 0), m.hull);
    base.scale.y = 0.6;
    t.add(base);
    for (let b = 0; b < barrels; b++) {
      const shard = new THREE.Mesh(shardGeometry(size * 1.6, size * 0.13, 4, 0.2), m.glow);
      shard.position.set((b - (barrels - 1) / 2) * size * 0.26, size * 0.18, 0);
      t.add(shard);
    }
  } else {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.5, size * 0.62, size * 0.4, 6), m.hull);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(size * 0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m.dark);
    dome.position.y = size * 0.2;
    t.add(base, dome);
    for (let b = 0; b < barrels; b++) {
      const bx = (b - (barrels - 1) / 2) * size * 0.24;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.07, size * 0.09, size * 1.5, 6), m.dark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(bx, size * 0.28, size * 0.8);
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.05, size * 0.05, size * 0.12, 6), m.glow);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(bx, size * 0.28, size * 1.56);
      t.add(barrel, muzzle);
    }
  }
  return t;
}

function mountTurrets(c, count) {
  if (!count) return;
  const { rng } = c;
  const size = c.R * (c.kind === 'cuirasse' ? 0.5 : 0.6) * (c.turretScale ?? 1);
  const barrels = c.kind === 'corvette' || !c.warship ? 1 : rng.pick([1, 2, 2, 3]);
  for (const [angle, row] of turretSlots(count)) {
    const { z, dist } = c.turretAt(angle, row);
    const mount = new THREE.Group();
    mount.rotation.z = angle;
    mount.position.z = z;
    const t = styledTurret(c, size, barrels);
    t.position.y = dist;
    t.rotation.y = rng.range(-0.6, 0.6);
    t.userData.base = t.rotation.y;
    t.userData.phase = rng.range(0, Math.PI * 2);
    t.userData.speed = rng.range(0.25, 0.5);
    mount.add(t);
    c.ship.add(mount);
    c.turrets.push(t);
  }
}

// Module d'habitat allongé (capsule) avec deux bandes de hublots éclairés, sur son pylône.
function habitatPod(c, x, y, z, r, len, material = c.m.hull) {
  const { ship, m } = c;
  const pod = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 14), material);
  pod.rotation.x = Math.PI / 2;
  pod.position.set(x, y, z);
  ship.add(pod);
  const a = Math.atan2(y, x);
  for (const side of [-1, 1]) {
    const b = a + (side * Math.PI) / 2;
    const band = new THREE.Mesh(new THREE.BoxGeometry(r * 0.08, r * 0.14, len * 0.8), m.windows);
    band.position.set(x + Math.cos(b) * r * 0.99, y + Math.sin(b) * r * 0.99, z);
    band.rotation.z = b;
    ship.add(band);
  }
  const d = Math.hypot(x, y);
  if (d > r) ship.add(beam(v3(0, 0, z), v3(x * (1 - r / d), y * (1 - r / d), z), r * 0.18, m.dark, 6));
  return pod;
}

// Soutes génériques des transports : deux rangées de conteneurs autour de la coque.
function cargoRows(c, rows = 2, z0 = -0.38, radiusK = 1.35) {
  const { ship, m, L, R } = c;
  for (let row = 0; row < rows; row++) {
    for (let k = 0; k < 6; k++) {
      const box = new THREE.Mesh(slab(R * 0.72, R * 0.72, L * 0.15, 0.12), (k + row) % 3 === 0 ? m.accent : k % 2 ? m.dark : m.hull);
      const a = (k / 6) * Math.PI * 2 + row * 0.5;
      box.position.set(Math.cos(a) * R * radiusK, Math.sin(a) * R * radiusK, L * (z0 + row * 0.17));
      box.rotation.z = a;
      ship.add(box);
    }
  }
}

// --- Archétypes ---

// Vaskhar : coque massive et anguleuse, plaques de blindage ocre, trois gros réacteurs, ailerons trapus.
function buildForteresse(c) {
  const { rng, ship, m, tier, style, warship, kind } = c;
  const L = (c.L = rng.range(1.45, 1.8));
  const R = (c.R = rng.range(0.25, 0.3));
  const seg = rng.pick(style.segments ?? [5, 6]);
  const body = new THREE.Mesh(latheZ([[0, 0.001], [0.001, 0.82], [0.08, 0.96], [0.5, 1], [0.78, 0.95], [0.92, 0.72], [1, 0.42], [1.001, 0.001]], L, R, seg), m.hull);
  body.scale.y = 0.8;
  body.rotation.z = Math.PI / seg;
  ship.add(body);

  // Plaques de blindage qui se chevauchent sur les flancs et le dos.
  const rust = variant(m.hull, '#c88a6a');
  const n = Math.round(2 + (style.armor ?? 0.8) * 3 + tier * 0.7);
  for (let i = 0; i < n; i++) {
    const z = L * (-0.36 + ((i + 0.5) / n) * 0.74);
    const pl = L * rng.range(0.14, 0.22);
    const plate = new THREE.Mesh(slab(R * 0.2, R * rng.range(0.75, 1.05), pl, 0.25), i % 3 === 2 ? rust : m.hull);
    plate.position.set(R * 0.97, rng.range(-0.08, 0.08) * R, z);
    plate.rotation.set(rng.range(-0.05, 0.05), rng.range(-0.08, 0.08), rng.range(-0.14, 0.14));
    ship.add(plate, mirrorX(plate));
    if (rng.chance(0.55 + (style.armor ?? 0.8) * 0.3)) {
      const top = new THREE.Mesh(slab(R * rng.range(0.8, 1.15), R * 0.16, pl * 0.92, 0.25), i % 2 ? m.hull : rust);
      top.position.set(0, R * 0.8, z + pl * 0.1);
      top.rotation.x = rng.range(-0.06, 0.02);
      ship.add(top);
    }
  }
  // Étrave en coin et mandibules.
  const ram = new THREE.Mesh(slab(R * 1.25, R * 0.32, L * 0.2, 0.3), m.dark);
  ram.position.set(0, -R * 0.42, L * 0.44);
  ram.rotation.x = 0.12;
  ship.add(ram);
  if (rng.chance(0.6) || warship) {
    const tusk = new THREE.Mesh(spikeGeometry(L * 0.16, R * 0.16, 4), rust);
    tusk.position.set(R * 0.52, -R * 0.42, L * 0.48);
    tusk.rotation.y = -0.15;
    ship.add(tusk, mirrorX(tusk));
  }
  // Passerelle avec sa fente éclairée.
  const bridge = new THREE.Mesh(slab(R * 0.62, R * 0.42, L * 0.15, 0.25), m.hull);
  bridge.position.set(0, R * 0.98, -L * 0.2);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(R * 0.5, R * 0.06, 0.012), m.windows);
  slit.position.set(0, R * 1.04, -L * 0.2 + L * 0.077);
  ship.add(bridge, slit);
  // Ailerons trapus.
  const fin = edgedWing(wingGeometry(R * rng.range(1.1, 1.5), L * 0.28, L * 0.13, L * 0.08, 0.06), m.hull, null);
  fin.position.set(R * 0.65, 0, -L * 0.3);
  around(ship, 3, Math.PI / 2, (i) => (i === 0 ? fin : fin.clone()));
  // Bloc moteur et trois gros réacteurs (cinq sur les grands vaisseaux).
  const block = new THREE.Mesh(slab(R * 1.7, R * 1.4, L * 0.12, 0.2), m.dark);
  block.position.z = -L * 0.47;
  ship.add(block);
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + (k / 3) * Math.PI * 2;
    c.engines.push([Math.cos(a) * R * 0.48, Math.sin(a) * R * 0.42, -L * 0.53, R * 0.36]);
  }
  if (tier >= 3) c.engines.push([R * 0.85, 0, -L * 0.53, R * 0.22], [-R * 0.85, 0, -L * 0.53, R * 0.22]);
  // Réservoirs de minerai accolés.
  if (rng.chance(style.pods ?? 0.6) || tier >= 4) {
    const pod = new THREE.Mesh(slab(R * 0.5, R * 0.55, L * 0.32, 0.25), rust);
    pod.position.set(R * 1.32, -R * 0.15, -L * 0.04);
    ship.add(pod, mirrorX(pod));
  }
  c.beaconPos = v3(0, R * 1.22, -L * 0.2);
  c.turretAt = (angle, row) => ({ z: L * (-0.3 + row * 0.55), dist: R * (angle === 0 ? 0.92 : angle === Math.PI ? 0.82 : 1.15) });
  // Colonie, transport, Arche : casemates blindées sur le dos ; l'Arche ajoute deux coques latérales.
  c.habitat = () => {
    const zs = kind === 'arche' ? [0.26, 0.06] : kind === 'transport' ? [0.16] : [0.24, 0.05];
    for (const t of zs) {
      const z = L * t;
      const b = new THREE.Mesh(slab(R * 1.15, R * 0.55, L * 0.17, 0.2), m.hull);
      b.position.set(0, R * 1.08, z);
      ship.add(b);
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.008, R * 0.07, L * 0.12), m.windows);
        w.position.set(sx * R * 0.58, R * 1.1, z);
        ship.add(w);
      }
    }
    if (kind === 'arche') {
      const side = new THREE.Mesh(latheZ([[0, 0.001], [0.001, 0.8], [0.1, 1], [0.75, 0.95], [0.92, 0.6], [1, 0.001]], L * 0.72, R * 0.55, seg), m.hull);
      side.scale.y = 0.8;
      side.position.set(R * 1.85, -R * 0.2, -L * 0.04);
      ship.add(side, mirrorX(side));
      for (const t of [-0.2, 0.15]) ship.add(beam(v3(-R * 1.85, -R * 0.2, L * t), v3(R * 1.85, -R * 0.2, L * t), R * 0.12, m.dark, 6));
      c.engines.push([R * 1.85, -R * 0.2, -L * 0.4, R * 0.3], [-R * 1.85, -R * 0.2, -L * 0.4, R * 0.3]);
    }
  };
}

// Thrennes : coque en losange sombre, double éperon, pointes, lames d'ailes à liseré rouge, tourelles.
function buildPredateur(c) {
  const { rng, ship, m, tier, style, warship } = c;
  const L = (c.L = rng.range(1.6, 1.95));
  const R = (c.R = rng.range(0.2, 0.24));
  const seg = rng.pick(style.segments ?? [4, 6]);
  const body = new THREE.Mesh(latheZ([[0, 0.001], [0.001, 0.75], [0.12, 0.95], [0.35, 1], [0.62, 0.78], [0.86, 0.4], [1, 0.001]], L, R, seg), m.hull);
  body.scale.y = 0.72;
  ship.add(body);
  const red = basic(c.glow);
  const blade = variant(m.hull, '#a8a8a8', { envMapIntensity: 1.4 });
  // Double éperon à l'avant.
  const prong = new THREE.Mesh(spikeGeometry(L * rng.range(0.32, 0.45), R * 0.17, 4), blade);
  prong.position.set(R * 0.42, -R * 0.12, L * 0.18);
  prong.rotation.y = -0.06;
  ship.add(prong, mirrorX(prong));
  // Crête de pointes sur le dos et les flancs.
  const spikes = 3 + tier + (warship ? 2 : 0);
  for (let i = 0; i < spikes; i++) {
    const z = L * (0.25 - (i / spikes) * 0.6);
    const s = new THREE.Mesh(spikeGeometry(R * rng.range(0.55, 1.0), R * 0.09, 4), i % 3 === 0 ? red : blade);
    s.position.set(0, R * 0.6, z);
    pointAlong(s, v3(0, 1, -0.9));
    ship.add(s);
    if (i % 2 === 0) {
      const side = new THREE.Mesh(spikeGeometry(R * rng.range(0.45, 0.8), R * 0.08, 4), blade);
      side.position.set(R * 0.8, 0, z);
      pointAlong(side, v3(1, rng.range(-0.3, 0.2), -1.1));
      ship.add(side, mirrorX(side));
    }
  }
  // Lames d'ailes à liseré rouge, pointées vers le bas.
  const span = R * rng.range(2.6, 3.6) * (1 + tier * 0.05);
  const wing = edgedWing(wingGeometry(span, L * rng.range(0.32, 0.42), L * 0.025, L * rng.range(-0.12, 0.3), 0.03), blade, red);
  wing.position.set(R * 0.5, -R * 0.05, -L * 0.08);
  wing.rotation.z = -rng.range(0.15, 0.35);
  ship.add(wing, mirrorX(wing));
  if (tier >= 3) {
    const wing2 = edgedWing(wingGeometry(span * 0.6, L * 0.22, L * 0.02, L * 0.12, 0.025), blade, red);
    wing2.position.set(R * 0.45, R * 0.15, L * 0.18);
    wing2.rotation.z = 0.25;
    ship.add(wing2, mirrorX(wing2));
  }
  // Dérives jumelles inclinées.
  const fin = edgedWing(wingGeometry(R * 1.9, L * 0.26, L * 0.03, L * 0.2, 0.025), blade, red);
  fin.position.set(R * 0.45, 0, -L * 0.3);
  for (const a of [Math.PI / 2 - 0.45, Math.PI / 2 + 0.45]) {
    const holder = new THREE.Group();
    holder.rotation.z = a;
    holder.add(fin.clone());
    ship.add(holder);
  }
  // Fentes rouges le long de la coque.
  for (let i = 0; i < 3; i++) {
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.012, R * 0.07, L * 0.1), red);
    slit.position.set(R * 0.74, R * 0.08, L * (0.15 - i * 0.16));
    ship.add(slit, mirrorX(slit));
  }
  const engines = tier >= 3 ? 4 : rng.pick([2, 3]);
  for (let k = 0; k < engines; k++) {
    const x = engines === 1 ? 0 : (k / (engines - 1) - 0.5) * R * 1.2;
    c.engines.push([x, engines === 3 && k === 1 ? R * 0.2 : 0, -L * 0.48, R * 0.3]);
  }
  // Même civils, les Thrennes portent une tourelle.
  c.civilTurrets = { sonde: 0, colonie: 1, transport: 2, arche: 3 }[c.kind] ?? 0;
  c.lightSpots = [[R * 0.8, 0, -L * 0.3], [-R * 0.8, 0, -L * 0.3], [0, -R * 0.62, L * 0.1]];
  c.beaconPos = v3(0, R * 0.75, -L * 0.36);
  c.turretAt = (angle, row) => ({ z: L * (-0.25 + row * 0.5), dist: R * (angle === 0 ? 0.74 : 0.7) });
  // Colonie, transport, Arche : quille ventrale en losange (deux quilles latérales en plus pour l'Arche).
  c.habitat = () => {
    const keels = [[0, -R * 0.72, 1]];
    if (c.kind === 'arche') keels.push([R * 1.25, -R * 0.45, 0.75], [-R * 1.25, -R * 0.45, 0.75]);
    for (const [x, y, k] of keels) {
      const keel = new THREE.Mesh(latheZ([[0, 0.001], [0.15, 0.75], [0.5, 1], [0.85, 0.7], [1, 0.001]], L * 0.62 * k, R * 0.6 * k, 4), m.hull);
      keel.scale.x = 0.75;
      keel.position.set(x, y, -L * 0.04);
      ship.add(keel);
      for (let i = 0; i < 3; i++) {
        for (const sx of [-1, 1]) {
          const slit = new THREE.Mesh(new THREE.BoxGeometry(0.01, R * 0.05 * k, L * 0.07 * k), red);
          slit.position.set(x + sx * R * 0.34 * k, y, L * (0.08 - i * 0.12) * k);
          ship.add(slit);
        }
      }
    }
  };
}

// Kel-Tirr : aiguille fine, grandes ailes en flèche liserées de jaune, verrière, sonde avant.
function buildAiguille(c) {
  const { rng, ship, m, tier, style, warship, kind } = c;
  const L = (c.L = rng.range(1.7, 2.1));
  const R = (c.R = rng.range(0.1, 0.125));
  const seg = rng.pick(style.segments ?? [6, 8]);
  const body = new THREE.Mesh(latheZ([[0, 0.001], [0.001, 0.72], [0.08, 0.92], [0.3, 1], [0.55, 0.92], [0.8, 0.5], [0.95, 0.16], [1, 0.001]], L, R, seg), m.hull);
  body.scale.y = 0.85;
  ship.add(body);
  const probe = beam(v3(0, 0, L * 0.47), v3(0, 0, L * 0.68), 0.007, m.dark, 5);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), m.accentGlow);
  tip.position.z = L * 0.68;
  ship.add(probe, tip);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffe9a8', metalness: 0.1, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.75, envMap: spaceEnv(), envMapIntensity: 1.6, emissive: '#5a4310', emissiveIntensity: 0.6 });
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(R * 0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(1, 0.75, 2.8);
  canopy.position.set(0, R * 0.55, L * 0.2);
  ship.add(canopy);
  // Grandes ailes en flèche, plus larges sur les grands vaisseaux.
  const span = R * rng.range(6.5, 8.5) * (1 + tier * 0.07);
  const root = L * rng.range(0.38, 0.5);
  const sweep = root * rng.range(0.6, 1.0);
  const tipChord = L * rng.range(0.03, 0.07);
  const wing = edgedWing(wingGeometry(span, root, tipChord, sweep, 0.018), m.hull, m.accentGlow);
  wing.position.set(R * 0.4, -R * 0.15, -L * 0.04 + root * 0.15);
  wing.rotation.z = rng.range(0.03, 0.12);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), m.accentGlow);
  light.position.set(span, 0, -root / 2 - sweep + tipChord / 2);
  wing.add(light);
  if (warship) {
    const gun = beam(v3(span * 0.92, 0, -root / 2 - sweep), v3(span * 0.92, 0, -root / 2 - sweep + L * 0.32), 0.011, m.dark, 6);
    wing.add(gun);
  }
  ship.add(wing, mirrorX(wing));
  // Biplan pour les grands vaisseaux : une seconde paire plus courte au-dessus.
  if (tier >= 3) {
    const w2 = edgedWing(wingGeometry(span * 0.62, root * 0.7, tipChord, sweep * 0.7, 0.016), m.hull, m.accentGlow);
    w2.position.set(R * 0.4, R * 0.3, -L * 0.2);
    w2.rotation.z = 0.3;
    ship.add(w2, mirrorX(w2));
  }
  // Plans canard à l'avant (pas sur les vaisseaux à anneau, qui l'occupe).
  const ringed = kind === 'colonie' || kind === 'arche' || kind === 'transport';
  if (!ringed && (tier >= 1 || rng.chance(0.5))) {
    const canard = edgedWing(wingGeometry(R * 2.4, L * 0.12, L * 0.03, L * 0.07, 0.012), m.hull, m.accentGlow);
    canard.position.set(R * 0.4, 0, L * 0.3);
    ship.add(canard, mirrorX(canard));
  }
  // Dérive dorsale.
  const fin = edgedWing(wingGeometry(R * rng.range(2.6, 3.4), L * 0.3, L * 0.04, L * 0.22, 0.014), m.hull, m.accentGlow);
  fin.position.set(R * 0.4, 0, -L * 0.26);
  const holder = new THREE.Group();
  holder.rotation.z = Math.PI / 2;
  holder.add(fin);
  ship.add(holder);
  c.engines.push([0, 0, -L * 0.5, R * 0.62]);
  if (tier >= 2) c.engines.push([R * 1.4, -R * 0.15, -L * 0.36, R * 0.34], [-R * 1.4, -R * 0.15, -L * 0.36, R * 0.34]);
  if (tier >= 2) {
    const nac = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.32, L * 0.16, 4, 10), m.hull);
    nac.rotation.x = Math.PI / 2;
    nac.position.set(R * 1.4, -R * 0.15, -L * 0.24);
    ship.add(nac, mirrorX(nac));
  }
  c.beaconPos = v3(0, R * 0.9, -L * 0.1);
  c.lightSpots = [[span + R * 0.4, -R * 0.15, -L * 0.04 - sweep], [-(span + R * 0.4), -R * 0.15, -L * 0.04 - sweep], [0, -R * 0.9, L * 0.25]];
  c.turretScale = 1.5;
  c.turretAt = (angle, row) => ({ z: L * (-0.15 + row * 0.4), dist: R * 0.85 });
  // Colonie, transport, Arche : capsules d'habitat (dorsale ; plus deux sur les ailes pour l'Arche).
  c.habitat = () => {
    habitatPod(c, 0, R * 1.45, L * 0.02, R * 0.55, L * 0.36);
    if (kind === 'arche') for (const sx of [-1, 1]) habitatPod(c, sx * R * 2.8, -R * 0.15, -L * 0.06, R * 0.5, L * 0.3);
  };
}

// Ondésiens : bulbe translucide lobé, cœur lumineux, anneaux flottants, filaments qui traînent.
function buildMeduse(c) {
  const { rng, ship, m, tier, style, warship, kind } = c;
  const L = (c.L = rng.range(1.35, 1.6));
  const R = (c.R = rng.range(0.3, 0.36));
  const seg = Math.max(24, rng.pick(style.segments ?? [12, 16]) * 2);
  const membrane = new THREE.MeshPhysicalMaterial({
    map: m.hull.map, emissiveMap: m.hull.emissiveMap, normalMap: m.hull.normalMap, roughnessMap: m.hull.roughnessMap, emissive: c.glow, emissiveIntensity: 0.9,
    color: m.hull.color.clone().lerp(WHITE, 0.2), metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08,
    sheen: 1, sheenColor: c.glow, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide,
    envMap: spaceEnv(), envMapIntensity: 1.3,
  });
  c.m.membrane = membrane;
  // Cloche lobée : le bord arrière ondule (lobes tirés au hasard).
  const Lb = L * 0.62;
  const bellGeo = latheZ([[0, 0.6], [0.1, 0.86], [0.3, 0.99], [0.5, 1], [0.7, 0.9], [0.86, 0.66], [0.96, 0.3], [1, 0.001]], Lb, R, seg);
  const lobes = rng.int(5, 9);
  const amp = rng.range(0.07, 0.14);
  const pos = bellGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = (pos.getZ(i) + Lb / 2) / Lb;
    const k = 1 + amp * Math.cos(lobes * Math.atan2(y, x)) * Math.max(0, 1 - t * 2);
    pos.setXY(i, x * k, y * k);
  }
  bellGeo.computeVertexNormals();
  const bell = new THREE.Mesh(bellGeo, membrane);
  bell.position.z = L / 2 - Lb / 2;
  bell.renderOrder = 2;
  const inner = new THREE.Mesh(bellGeo, m.hull);
  inner.scale.setScalar(0.62);
  inner.position.z = bell.position.z - Lb * 0.06;
  const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.26, 18, 12), m.glow);
  core.position.z = L * 0.2;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c.glow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(R * 2.4);
  halo.position.z = L * 0.2;
  ship.add(inner, core, halo, bell);
  // Tige arrière.
  const Ls = L * 0.62;
  const stalk = new THREE.Mesh(latheZ([[0, 0.001], [0.001, 0.5], [0.15, 0.8], [0.5, 0.6], [0.85, 0.75], [1, 0.9]], Ls, R * 0.24, 16), m.hull);
  stalk.position.z = -L / 2 + Ls / 2;
  ship.add(stalk);
  // Anneaux flottants, reliés par des fils de lumière.
  const ringMat = std({ color: c.tone.clone().lerp(WHITE, 0.3), emissive: c.glow, emissiveIntensity: 0.75, metalness: 0.2, roughness: 0.25, transparent: true, opacity: 0.9 });
  const thread = basic(c.glow, { transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const ringCount = Math.min(2 + tier, 6);
  for (let i = 0; i < ringCount; i++) {
    const g = new THREE.Group();
    const rr = R * (1.08 - i * 0.1) * rng.range(0.95, 1.05);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(rr, R * rng.range(0.025, 0.045), 8, 56), ringMat));
    const beads = rng.int(3, 6);
    for (let k = 0; k < beads; k++) {
      const a = (k / beads) * Math.PI * 2;
      const bead = new THREE.Mesh(new THREE.SphereGeometry(R * 0.055, 10, 8), m.glow);
      bead.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0);
      g.add(bead);
      if (k % 2 === 0) g.add(beam(v3(0, 0, 0), bead.position, 0.004, thread, 4));
    }
    g.position.z = L * (0.0 - i * 0.12);
    ship.add(g);
    c.rings.push(g);
  }
  // Filaments qui traînent derrière.
  const filament = basic(c.glow, { transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const fils = Math.min(6 + tier * 2, 14);
  const z0 = L / 2 - Lb;
  for (let f = 0; f < fils; f++) {
    const a = (f / fils) * Math.PI * 2 + rng.range(-0.15, 0.15);
    const len = L * rng.range(0.75, 1.2) * (warship ? 0.75 : 1);
    const waves = rng.range(1, 2.2);
    const phase = rng.range(0, Math.PI * 2);
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const rad = R * 0.55 * (1 - 0.4 * t);
      const w = Math.sin(t * Math.PI * waves + phase) * R * 0.28 * t;
      pts.push(v3(Math.cos(a) * rad - Math.sin(a) * w, Math.sin(a) * rad + Math.cos(a) * w, z0 - t * len));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, R * rng.range(0.012, 0.022), 5), filament);
    ship.add(tube);
    if (f % 2 === 0) {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(R * 0.04, 8, 6), m.glow);
      bead.position.copy(pts[6]);
      ship.add(bead);
    }
  }
  // Version armée : dards lumineux sous la cloche.
  if (warship) {
    const dards = 2 + Math.floor(tier / 2);
    for (let i = 0; i < dards; i++) {
      const a = -Math.PI / 2 + (i / Math.max(1, dards - 1) - 0.5) * 1.6;
      const d = new THREE.Mesh(spikeGeometry(R * rng.range(0.9, 1.3), R * 0.08, 8), m.glow);
      d.position.set(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6, L * 0.32);
      pointAlong(d, v3(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 1));
      ship.add(d);
    }
  }
  c.engines.push([0, 0, -L / 2 - R * 0.05, R * 0.22, 'organique']);
  if (tier >= 2) {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
      c.engines.push([Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3, -L / 2 + L * 0.05, R * 0.13, 'organique']);
    }
  }
  c.beaconPos = v3(0, R * 1.0, L * 0.18);
  c.lightSpots = [[R * 1.0, 0, L * 0.15], [-R * 1.0, 0, L * 0.15], [0, -R * 0.95, L * 0.2]];
  c.turretAt = (angle, row) => ({ z: L * (0.02 + row * 0.38), dist: R * (angle === 0 ? 0.92 : 0.88) });
  c.cargo = () => {}; // les bulbes satellites servent de soutes
  // Colonie et Arche : bulbes satellites en rotation autour de la tige.
  c.habitat = () => {
    const groups = kind === 'arche' ? [[6, 1.7, -0.22, 0.3], [4, 1.3, -0.4, 0.24]] : [[kind === 'transport' ? 4 : 3, 1.5, -0.25, 0.28]];
    for (const [count, dist, z, size] of groups) {
      const g = new THREE.Group();
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2;
        const p = v3(Math.cos(a) * R * dist, Math.sin(a) * R * dist, 0);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(R * size, 20, 14), membrane);
        bulb.scale.z = 1.3;
        bulb.position.copy(p);
        bulb.renderOrder = 2;
        const heart = new THREE.Mesh(new THREE.SphereGeometry(R * size * 0.45, 12, 8), m.glow);
        heart.position.copy(p);
        g.add(heart, bulb, beam(v3(0, 0, 0), p, R * 0.03, ringMat, 6));
      }
      g.position.z = L * z;
      ship.add(g);
      c.rings.push(g);
    }
  };
}

// Synodes : grappe de sphères violettes reliées par des poutres, nacelles, lamelles de spores.
function buildGrappe(c) {
  const { rng, ship, m, tier, style, kind } = c;
  const L = (c.L = rng.range(1.5, 1.8));
  const R = (c.R = rng.range(0.14, 0.17));
  const seg = rng.pick(style.segments ?? [8, 10]);
  const dome = new THREE.MeshPhysicalMaterial({
    color: c.tone.clone().lerp(WHITE, 0.25), metalness: 0, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.45,
    depthWrite: false, envMap: spaceEnv(), envMapIntensity: 1.4, side: THREE.DoubleSide,
  });
  const n = Math.min(3 + Math.ceil(tier * 0.7), 7);
  const mid = Math.floor((n - 1) / 2);
  const spheres = [];
  for (let i = 0; i < n; i++) {
    const z = L * (-0.36 + (i / (n - 1)) * 0.78);
    const r = R * (i === mid ? rng.range(1.25, 1.45) : rng.range(0.6, 1.1)) * (i === n - 1 ? 0.8 : 1);
    spheres.push({ z, r, x: 0, y: 0 });
    if (i === mid || rng.chance(0.25)) {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(r, seg * 3, seg * 2), dome);
      const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.62, 1), m.hull);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(r * 0.25, 12, 8), m.glow);
      shell.position.z = heart.position.z = glow.position.z = z;
      shell.renderOrder = 2;
      ship.add(heart, glow, shell);
    } else {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(r, seg * 3, seg * 2), m.hull);
      ball.position.z = z;
      ship.add(ball);
    }
    if (i > 0) {
      const a = spheres[i - 1];
      ship.add(beam(v3(0, 0, a.z), v3(0, 0, z), R * 0.13, m.dark, 8));
      // Treillis : deux poutres fines en parallèle.
      for (const s of [-1, 1]) ship.add(beam(v3(s * R * 0.32, R * 0.1, a.z), v3(s * R * 0.32, R * 0.1, z), R * 0.035, m.dark, 5));
    }
  }
  // Sphères satellites sur bras.
  for (let i = 0; i < n; i++) {
    if (!rng.chance(0.55 * (style.pods ?? 1))) continue;
    const s = spheres[i];
    const a = rng.range(0, Math.PI * 2);
    const sr = R * rng.range(0.32, 0.55);
    const d = s.r + sr + R * rng.range(0.25, 0.6);
    const p = v3(Math.cos(a) * d, Math.sin(a) * d, s.z + rng.range(-0.05, 0.05) * L);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(sr, 16, 12), m.hull);
    ball.position.copy(p);
    ship.add(ball, beam(v3(0, 0, s.z), p, R * 0.05, m.dark, 5));
  }
  // Nacelles motrices sur leurs bras.
  const nz = -L * 0.3;
  const half = L * 0.11 + R * 0.22;
  const nac = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.22, L * 0.22, 6, 14), m.hull);
  nac.rotation.x = Math.PI / 2;
  nac.position.set(R * 1.75, -R * 0.2, nz);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.26, R * 0.04, 6, 20), m.glow);
  ring.position.set(R * 1.75, -R * 0.2, nz + L * 0.06);
  ship.add(nac, mirrorX(nac), ring, mirrorX(ring));
  ship.add(beam(v3(-R * 1.75, -R * 0.2, nz), v3(R * 1.75, -R * 0.2, nz), R * 0.06, m.dark, 6));
  c.engines.push([R * 1.75, -R * 0.2, nz - half, R * 0.2], [-R * 1.75, -R * 0.2, nz - half, R * 0.2]);
  if (tier >= 3) {
    const top = nac.clone();
    top.position.set(0, R * 1.75, nz);
    ship.add(top, beam(v3(0, 0, nz), v3(0, R * 1.75, nz), R * 0.06, m.dark, 6));
    c.engines.push([0, R * 1.75, nz - half, R * 0.2]);
  }
  // Lamelles de spores (panneaux) : disques translucides empilés.
  if (rng.chance(0.65) || tier >= 4) {
    const gill = std({ map: m.hull.map, emissiveMap: m.hull.emissiveMap, normalMap: m.hull.normalMap, emissive: c.glow, emissiveIntensity: 1, color: m.hull.color.clone().lerp(WHITE, 0.3), transparent: true, opacity: 0.7, roughness: 0.6, metalness: 0, depthWrite: false });
    const gz = spheres[mid].z;
    const gx = spheres[mid].r + R * 0.9;
    for (let k = 0; k < 3; k++) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(R * (0.75 - k * 0.12), R * (0.75 - k * 0.12), 0.012, 28), gill);
      disc.rotation.z = Math.PI / 2;
      disc.position.set(gx + k * R * 0.14, 0, gz);
      ship.add(disc, mirrorX(disc));
    }
    ship.add(beam(v3(-gx - R * 0.3, 0, gz), v3(gx + R * 0.3, 0, gz), R * 0.04, m.dark, 5));
  }
  const front = spheres[n - 1];
  c.beaconPos = v3(0, front.r * 1.05, front.z);
  c.turretAt = (angle, row) => {
    const s = spheres[Math.min(n - 1, Math.round(row * (n - 1)))];
    return { z: s.z, dist: s.r * 0.92 };
  };
  // Soutes : couronne de sphères autour de la poutre arrière.
  c.cargo = () => {
    const z = L * -0.12;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const p = v3(Math.cos(a) * R * 1.15, Math.sin(a) * R * 1.15, z);
      const pod = new THREE.Mesh(new THREE.SphereGeometry(R * 0.38, 16, 12), m.hull);
      pod.position.copy(p);
      ship.add(pod, beam(v3(0, 0, z), p, R * 0.05, m.dark, 5));
    }
  };
  // Colonie, transport, Arche : grappes de sphères d'habitat accrochées au tronc.
  c.habitat = () => {
    const bunches = kind === 'arche' ? 3 : kind === 'transport' ? 1 : 2;
    for (let b = 0; b < bunches; b++) {
      const s = spheres[Math.max(0, Math.min(n - 1, mid + (b % 2 ? -1 : 0)))];
      const a = Math.PI / 2 + (b / bunches) * Math.PI * 2 + 0.3;
      const d = s.r + R * 1.1;
      const center = v3(Math.cos(a) * d, Math.sin(a) * d, s.z);
      ship.add(beam(v3(0, 0, s.z), center, R * 0.07, m.dark, 6));
      const count = rng.int(4, 6);
      for (let k = 0; k < count; k++) {
        const r = R * rng.range(0.32, 0.55) * (k === 0 ? 1.3 : 1);
        const p = k === 0 ? center.clone() : center.clone().add(v3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1.6, 1.6)).multiplyScalar(R * 0.55));
        const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), k % 3 === 1 ? dome : m.hull);
        ball.position.copy(p);
        if (k % 3 === 1) {
          ball.renderOrder = 2;
          const heart = new THREE.Mesh(new THREE.SphereGeometry(r * 0.4, 10, 8), m.glow);
          heart.position.copy(p);
          ship.add(heart);
        }
        ship.add(ball);
      }
    }
  };
}

// Orrhaïdes : bipyramide de cristal à facettes, cœur lumineux, éclats qui rayonnent.
function buildCristal(c) {
  const { rng, ship, m, tier, style, warship, kind } = c;
  const L = (c.L = rng.range(1.6, 2.0));
  const R = (c.R = rng.range(0.21, 0.26));
  const seg = rng.pick(style.segments ?? [5, 6]);
  const crystal = new THREE.MeshPhysicalMaterial({
    map: m.hull.map, emissiveMap: m.hull.emissiveMap, normalMap: m.hull.normalMap, roughnessMap: m.hull.roughnessMap, emissive: c.glow, emissiveIntensity: 0.9,
    color: m.hull.color.clone().multiply(new THREE.Color('#8aa6d0')), metalness: 0.05, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04,
    iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 900], transparent: true, opacity: 0.6, flatShading: true,
    envMap: spaceEnv(), envMapIntensity: 1.3, side: THREE.DoubleSide,
  });
  m.crystal = crystal;
  const shine = std({ color: c.glow.clone().lerp(WHITE, 0.2), emissive: c.glow, emissiveIntensity: 0.7, metalness: 0, roughness: 0.2, flatShading: true });
  const midT = rng.range(0.32, 0.45);
  const body = new THREE.Mesh(latheZ([[0, 0.001], [midT, 1], [midT + 0.22, 0.82], [1, 0.001]], L, R, seg), crystal);
  body.scale.y = rng.range(0.75, 0.95);
  body.renderOrder = 2;
  const core = new THREE.Mesh(latheZ([[0, 0.001], [midT, 1], [1, 0.001]], L * 0.6, R * 0.38, seg), basic(c.glow.clone().lerp(WHITE, 0.4)));
  core.position.z = -L * 0.04;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c.glow, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(R * 3, R * 3, 1);
  halo.position.z = L * (midT - 0.5);
  ship.add(core, halo, body);
  // Éclats qui rayonnent vers l'arrière (vers l'avant sur les vaisseaux de guerre).
  const shards = 5 + tier * 2 + (warship ? 3 : 0);
  for (let i = 0; i < shards; i++) {
    const a = rng.range(0, Math.PI * 2);
    const t = rng.range(0.15, 0.75);
    const zr = L * (t - 0.5);
    const rHull = R * (t < midT ? t / midT : (1 - t) / (1 - midT)) * 0.7;
    const len = R * rng.range(0.8, 2.2) * (1 + tier * 0.05);
    const s = new THREE.Mesh(shardGeometry(len, len * rng.range(0.14, 0.2), rng.pick([4, 5, 6]), 0.3), i % 3 === 0 ? shine : crystal);
    s.position.set(Math.cos(a) * rHull, Math.sin(a) * rHull, zr);
    const forward = warship && i % 2 === 0;
    pointAlong(s, v3(Math.cos(a), Math.sin(a), forward ? rng.range(0.6, 1.4) : -rng.range(0.4, 1.4)));
    ship.add(s);
  }
  // Lames de cristal en guise d'ailes.
  const span = R * rng.range(2.6, 3.6);
  const blade = new THREE.Mesh(shardGeometry(span, R * 0.42, 4, 0.3), crystal);
  blade.scale.set(1, 0.25, 1);
  blade.position.set(R * 0.4, 0, L * (midT - 0.55));
  pointAlong(blade, v3(1, rng.range(-0.15, 0.2), -rng.range(0.5, 1)));
  blade.scale.set(1, 0.3, 1);
  ship.add(blade, mirrorX(blade));
  if (tier >= 2 || rng.chance(0.5)) {
    const tail = new THREE.Mesh(shardGeometry(R * 2.2, R * 0.3, 4, 0.3), shine);
    tail.position.set(0, R * 0.3, -L * 0.3);
    pointAlong(tail, v3(0, 1, -1.2));
    ship.add(tail);
  }
  c.engines.push([0, 0, -L / 2 + 0.02, R * 0.32, 'cristal']);
  if (tier >= 2) c.engines.push([R * 0.55, -R * 0.15, -L * 0.36, R * 0.2, 'cristal'], [-R * 0.55, -R * 0.15, -L * 0.36, R * 0.2, 'cristal']);
  c.beaconPos = v3(0, R * 0.95, L * (midT - 0.5));
  c.turretAt = (angle, row) => ({ z: L * (midT - 0.62 + row * 0.35), dist: R * 0.72 });
  // Soutes : grappe de blocs cristallins autour de l'arrière.
  c.cargo = () => {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const block = new THREE.Mesh(new THREE.OctahedronGeometry(R * 0.32, 0), k % 2 ? crystal : shine);
      block.scale.set(1, 1, 2.2);
      block.position.set(Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.75, -L * 0.2);
      ship.add(block);
    }
  };
  // Colonie, transport, Arche : grandes aiguilles de cristal qui longent la coque, chacune avec son cœur.
  c.habitat = () => {
    const count = kind === 'arche' ? 4 : 2;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + (count === 2 ? 0 : Math.PI / 4);
      const len = L * (kind === 'arche' ? 0.75 : 0.6);
      const p = v3(Math.cos(a) * R * 1.25, Math.sin(a) * R * 1.0, -L * 0.36);
      const pillar = new THREE.Mesh(shardGeometry(len, R * 0.36, 6, 0.4), crystal);
      pillar.position.copy(p);
      pointAlong(pillar, v3(-Math.cos(a) * 0.08, -Math.sin(a) * 0.08, 1));
      pillar.renderOrder = 2;
      const heart = new THREE.Mesh(shardGeometry(len * 0.55, R * 0.12, 6, 0.4), shine);
      heart.position.copy(p).add(v3(0, 0, len * 0.12));
      heart.quaternion.copy(pillar.quaternion);
      ship.add(heart, pillar);
    }
  };
}

// Liseurs de Vey : coque dorée élancée, grandes voiles à glyphes, longues antennes.
function buildVoilier(c) {
  const { rng, ship, m, tier, style, warship, kind } = c;
  const L = (c.L = rng.range(1.7, 2.05));
  const R = (c.R = rng.range(0.12, 0.15));
  const seg = rng.pick(style.segments ?? [8, 10]);
  const body = new THREE.Mesh(latheZ([[0, 0.001], [0.001, 0.62], [0.1, 0.86], [0.35, 1], [0.6, 0.9], [0.84, 0.52], [1, 0.001]], L, R, seg), m.hull);
  ship.add(body);
  // Colliers sculptés.
  const collars = rng.int(2, 3);
  for (let i = 0; i < collars; i++) {
    const t = 0.2 + i * 0.22;
    const col = new THREE.Mesh(new THREE.TorusGeometry(R * 1.02, R * 0.09, 6, 32), m.dark);
    col.position.z = L * (t - 0.5);
    const line = new THREE.Mesh(new THREE.TorusGeometry(R * 1.1, R * 0.025, 4, 32), m.glow);
    line.position.z = col.position.z;
    ship.add(col, line);
  }
  // Grandes voiles en éventail autour de la coque.
  const sails = sailSet();
  const sailMat = std({
    map: sails.map, normalMap: sails.normalMap, roughnessMap: sails.orm, metalnessMap: sails.orm, emissiveMap: sails.emissiveMap,
    color: tintFor(c.tone.clone().lerp(new THREE.Color('#e8c060'), 0.35), SAIL_BASE), emissive: c.glow, emissiveIntensity: 1.2,
    metalness: 1, roughness: 1, transparent: true, opacity: 0.9, depthWrite: false,
  });
  const count = kind === 'arche' ? 6 : tier >= 3 ? 4 : 3;
  const phase = count === 4 ? Math.PI / 4 : Math.PI / 2;
  const scaleK = (warship ? 0.72 : 1) * (1 + tier * 0.05);
  for (let i = 0; i < count; i++) {
    const big = i === 0 ? 1 : rng.range(0.7, 0.9);
    const H = L * rng.range(0.42, 0.55) * big * scaleK;
    const a = L * 0.22;
    const b = -L * 0.34;
    const sweep = L * rng.range(0.1, 0.22);
    const shape = new THREE.Shape();
    shape.moveTo(0, a);
    shape.quadraticCurveTo(H * 0.65, a - L * 0.02, H, b - sweep);
    shape.quadraticCurveTo(H * 0.45, b - sweep * 0.2, 0, b);
    shape.closePath();
    const geo = normalizeUV(new THREE.ShapeGeometry(shape, 16));
    geo.rotateX(Math.PI / 2);
    const holder = new THREE.Group();
    holder.rotation.z = phase + (i / count) * Math.PI * 2;
    const sail = new THREE.Mesh(geo, sailMat);
    sail.position.x = R * 0.6;
    sail.renderOrder = 3;
    const spar = beam(v3(R * 0.6, 0, a), v3(R * 0.6 + H, 0, b - sweep), 0.009, m.hull, 5);
    const boom = beam(v3(R * 0.6, 0, b), v3(R * 0.6 + H, 0, b - sweep), 0.006, m.hull, 5);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), m.glow);
    lamp.position.set(R * 0.6 + H, 0, b - sweep);
    holder.add(sail, spar, boom, lamp);
    ship.add(holder);
  }
  // Antennes à l'avant, avec leurs pointes lumineuses.
  const antennas = rng.int(2, 3);
  for (let i = 0; i < antennas; i++) {
    const ang = phase + (i / antennas) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const reach = L * rng.range(0.28, 0.42);
    const end = v3(Math.cos(ang) * R * 1.6, Math.sin(ang) * R * 1.6, L * 0.48 + reach);
    ship.add(beam(v3(0, 0, L * 0.4), end, 0.005, m.hull, 4));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), m.glow);
    tip.position.copy(end);
    ship.add(tip);
  }
  // Métal à glyphes lumineux (lanternes d'habitat).
  const glyphRing = variant(m.hull, null, { emissiveIntensity: 1.6 });
  c.engines.push([0, 0, -L * 0.5, R * 0.55]);
  if (tier >= 3) c.engines.push([R * 0.9, 0, -L * 0.42, R * 0.3], [-R * 0.9, 0, -L * 0.42, R * 0.3]);
  c.beaconPos = v3(0, R * 1.0, L * 0.05);
  c.turretScale = 1.4;
  c.turretAt = (angle, row) => ({ z: L * (-0.1 + row * 0.42), dist: R * 0.92 });
  // Colonie, transport, Arche : lanternes dorées suspendues entre les voiles.
  c.habitat = () => {
    const n = kind === 'arche' ? count : Math.min(2, count);
    for (let i = 0; i < n; i++) {
      const a = phase + ((Math.floor((i * count) / n) + 0.5) / count) * Math.PI * 2;
      habitatPod(c, Math.cos(a) * R * 1.9, Math.sin(a) * R * 1.9, -L * 0.02, R * 0.5, L * 0.28, glyphRing);
    }
  };
}

// Ashkari : colonne centrale, conteneurs de cuivre en rangées, cabine et écope à l'avant.
function buildCaravane(c) {
  const { rng, ship, m, tier, style, warship, kind } = c;
  const L = (c.L = rng.range(1.6, 2.0));
  const R = (c.R = rng.range(0.16, 0.2));
  // Colonne et rails.
  const spine = new THREE.Mesh(slab(R * 0.5, R * 0.5, L * 0.86, 0.15), m.dark);
  ship.add(spine);
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    ship.add(beam(v3(sx * R * 0.27, sy * R * 0.27, -L * 0.44), v3(sx * R * 0.27, sy * R * 0.27, L * 0.38), R * 0.035, m.hull, 4));
  }
  // Conteneurs : couleurs tirées dans une petite palette, quelques places vides.
  const crates = containerSet();
  const cargo = [0, 1, 2].map((i) => {
    const t = i === 2 ? new THREE.Color(warship ? '#6a6e76' : '#c8ccd2') : c.tone.clone().offsetHSL(rng.range(-0.02, 0.03), 0, rng.range(-0.08, 0.08));
    return pbr(crates, { color: tintFor(t, CONTAINER_BASE), uv: 'fit' });
  });
  if (warship) cargo.push(m.dark);
  const rows = Math.min(2 + tier, 6);
  const layout = rng.pick(['croix', 'carre', 'six']);
  const slots = layout === 'six' ? 6 : 4;
  const phase = layout === 'carre' ? Math.PI / 4 : 0;
  const s = layout === 'six' ? R * 0.6 : R * 0.72;
  const dist = layout === 'six' ? R * 0.78 : layout === 'carre' ? R * 0.8 : R * 0.62;
  const z0 = -L * 0.3;
  const z1 = L * 0.22;
  const rowLen = (z1 - z0) / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < slots; k++) {
      if (rng.chance(0.1)) continue;
      const a = phase + (k / slots) * Math.PI * 2;
      const box = new THREE.Mesh(slab(s, s, rowLen * 0.9, 0.08), rng.pick(cargo));
      box.position.set(Math.cos(a) * dist, Math.sin(a) * dist, z0 + rowLen * (r + 0.5));
      box.rotation.z = a;
      ship.add(box);
    }
  }
  // Cabine, écope et son champ lumineux.
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.5, R * 0.62, L * 0.12, 8), m.hull);
  cab.rotation.x = Math.PI / 2;
  cab.position.z = L * 0.32;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.57, R * 0.57, L * 0.018, 8, 1, true), m.windows);
  band.rotation.x = Math.PI / 2;
  band.position.z = L * 0.34;
  ship.add(cab, band);
  const scoopLen = L * rng.range(0.14, 0.2);
  const mouth = R * rng.range(1.1, 1.45);
  const scoopMat = variant(m.hull, '#f0c8a8', { emissiveIntensity: 0 });
  const scoop = new THREE.Mesh(latheZ([[0, 0.45], [0.4, 0.62], [1, 1]], scoopLen, mouth, 16), scoopMat);
  scoop.position.z = L * 0.38 + scoopLen / 2;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(mouth, R * 0.05, 6, 32), m.glow);
  lip.position.z = L * 0.38 + scoopLen;
  const field = new THREE.Mesh(new THREE.CircleGeometry(mouth * 0.97, 32), basic(c.glow, { transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  field.position.z = lip.position.z - 0.01;
  ship.add(scoop, lip, field);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
    ship.add(beam(v3(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, L * 0.34), v3(Math.cos(a) * mouth, Math.sin(a) * mouth, L * 0.38 + scoopLen), 0.01, m.dark, 4));
  }
  // Radiateurs (panneaux) sur bras.
  if (rng.chance(0.65) || tier >= 3) {
    const rad = pbr(radiatorSet(), { uv: 'fit' });
    const w = R * rng.range(1.6, 2.4);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, L * 0.18), rad);
    panel.position.set(R * 0.75 + w / 2, 0, -L * 0.37);
    ship.add(panel, mirrorX(panel), beam(v3(-R * 0.75, 0, -L * 0.37), v3(R * 0.75, 0, -L * 0.37), 0.012, m.dark, 4));
  }
  // Bloc moteur.
  const block = new THREE.Mesh(slab(R * 1.5, R * 1.1, L * 0.12, 0.2), m.hull);
  block.position.z = -L * 0.45;
  ship.add(block);
  const engines = tier >= 3 ? 4 : rng.pick([2, 3]);
  for (let k = 0; k < engines; k++) {
    if (engines === 4) c.engines.push([(k % 2 ? 1 : -1) * R * 0.38, (k < 2 ? 1 : -1) * R * 0.28, -L * 0.51, R * 0.24]);
    else c.engines.push([(k / (engines - 1) - 0.5) * R * 0.9, 0, -L * 0.51, R * 0.26]);
  }
  c.beaconPos = v3(0, R * 0.65, L * 0.32);
  c.turretAt = (angle, row) => ({ z: z0 + (z1 - z0) * row, dist: dist + s * 0.5 });
  c.cargo = () => {}; // les conteneurs sont déjà la silhouette
  // Colonie, transport, Arche : cylindres d'équipage posés sur les conteneurs.
  c.habitat = () => {
    const ys = kind === 'arche' ? [1, -1] : [1];
    for (const sy of ys) habitatPod(c, 0, sy * (dist + s * 0.5 + R * 0.42), -L * 0.04, R * 0.4, L * 0.38);
  };
}

const BUILDERS = {
  forteresse: buildForteresse, predateur: buildPredateur, aiguille: buildAiguille, meduse: buildMeduse,
  grappe: buildGrappe, cristal: buildCristal, voilier: buildVoilier, caravane: buildCaravane,
};

function createStyledShip(seed, accent, registry, kind, style) {
  // Graine décalée : le style n'emprunte pas la suite de tirages du générateur d'origine.
  const rng = createRng((seed ^ 0x5bd1e995) >>> 0);
  const ship = new THREE.Group();
  const warship = WARSHIPS.has(kind);
  const tier = TIER[kind] ?? 1;
  const archetype = BUILDERS[shipArchetype(style)] ? shipArchetype(style) : 'aiguille';
  const look = LOOKS[archetype];
  const glow = new THREE.Color(style.engineGlow ?? accent);
  const accentColor = new THREE.Color(accent);
  const tones = style.hullTones?.length ? style.hullTones : HULL_TONES;
  let tone = new THREE.Color(rng.pick(tones)).offsetHSL(rng.range(-0.012, 0.012), rng.range(-0.04, 0.04), rng.range(-0.035, 0.035));
  if (look.saturate) tone.offsetHSL(0, look.saturate, 0);
  // Version de guerre : la même livrée, assombrie.
  if (warship) tone = tone.lerp(new THREE.Color(look.warTone ?? '#25282e'), look.warMix ?? 0.45);

  // Textures partagées par toute l'espèce, peintes dans sa teinte de référence ; la teinte du vaisseau
  // passe par la couleur du matériau.
  const base = new THREE.Color(tones[0]);
  if (look.saturate) base.offsetHSL(0, look.saturate, 0);
  const set = hullSet(archetype, base, glow);
  const darkTone = tone.clone().lerp(new THREE.Color('#121418'), 0.55);
  const m = {
    hull: pbr(set, { color: tintFor(tone, set.base), emissive: glow, emissiveIntensity: look.emissive, env: look.env }),
    dark: pbr(darkSet(), { color: tintFor(darkTone, DARK_BASE), env: 0.9 }),
    glow: basic(glow),
    accent: pbr(paintSet(), { color: tintFor(accentColor, PAINT_BASE), emissive: accentColor, emissiveIntensity: 0.12 }),
    accentGlow: basic(accentColor),
    windows: basic(glow.clone().lerp(WHITE, 0.45)),
  };
  const c = {
    rng, ship, kind, tier, warship, style, look, glow, accent: accentColor, tone, registry, m,
    flames: [], jets: [], rings: [], turrets: [], lights: [], engines: [], lightSpots: null, beaconPos: null, civilTurrets: 0,
  };
  c.turretAt = (angle, row) => ({ z: c.L * (-0.3 + row * 0.55), dist: c.R * (angle === 0 ? 1.0 : 0.88) });
  BUILDERS[archetype](c);
  const { L, R } = c;

  for (const [x, y, z, r, type] of c.engines) addEngine(c, x, y, z, r, type);
  if (c.warship) {
    const count = WAR_TURRETS[kind] ?? 2;
    mountTurrets(c, kind === 'cuirasse' ? count + rng.int(-1, 1) : count);
  } else {
    mountTurrets(c, c.civilTurrets);
  }

  // Colonie, transport et Arche : habitat de l'espèce et soutes.
  if (kind === 'colonie' || kind === 'transport' || kind === 'arche') {
    c.habitat();
    if (kind === 'transport') (c.cargo ?? (() => cargoRows(c)))();
    if (kind === 'arche' && !c.cargo) cargoRows(c, 1, -0.32, 1.3);
  }

  // Feux rouges des vaisseaux de guerre.
  if (warship) {
    const red = basic(0xff3030);
    const spots = c.lightSpots ?? [[R * 1.05, 0, -L * 0.35], [-R * 1.05, 0, -L * 0.35], [0, -R * 0.9, L * 0.25]];
    if (kind === 'croiseur' || kind === 'cuirasse') spots.push([R * 0.95, 0, L * 0.2], [-R * 0.95, 0, L * 0.2]);
    for (const [x, y, z] of spots) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), red);
      l.position.set(x, y, z);
      ship.add(l);
      c.lights.push(l);
    }
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), basic(accentColor));
  beacon.position.copy(c.beaconPos ?? v3(0, R * 0.9, -L * 0.25));
  ship.add(beacon);

  // Coordonnées de texture à l'échelle, suie près des réacteurs.
  weatherShip(ship, Math.min(-L / 2, ...c.engines.map((e) => e[2])) - 0.03, L, R);

  ship.userData = { flames: c.flames, jets: c.jets, fxSeed: seed % 1000, beacon, length: L, rings: c.rings, turrets: c.turrets, lights: c.lights, kind, sizeScale: shipScale(kind), archetype };
  ship.scale.setScalar((1.6 / L) * shipScale(kind));
  return ship;
}

// Vignettes des vaisseaux pour l'interface, rendues une seule fois.
// style : style d'espèce commun à toutes les vignettes (chaque spec peut aussi porter le sien).
// Un seul moteur de rendu pour toutes les vignettes : en créer un par appel rechargeait toutes les
// textures (une demi-seconde par vaisseau) et faisait perdre des contextes WebGL au navigateur.
let thumbRenderer = null;
export function renderShipThumbnails(specs, width = 120, height = 72, style = null) {
  thumbRenderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  const renderer = thumbRenderer;
  renderer.setPixelRatio(2);
  renderer.setSize(width, height);
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
  camera.position.set(1.75, 1.0, 1.45);
  camera.lookAt(0, 0, 0);
  const urls = specs.map(({ seed, accent, registry, kind, style: own }) => {
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0x8090b0, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(2, 3, 2);
    scene.add(sun);
    const ship = createShip(seed, accent, registry, kind, own ?? style);
    // Même cadrage pour tous : la plus grande dimension (anneaux compris) tient dans la vignette, centrée.
    ship.scale.setScalar(1);
    ship.updateMatrixWorld(true);
    const box = new THREE.Box3();
    ship.traverse((o) => {
      if (o.isMesh && !o.userData.fx) box.expandByObject(o);
    });
    const dims = box.getSize(new THREE.Vector3());
    const extent = Math.max(dims.z, Math.max(dims.x, dims.y) * 1.25, 0.001);
    ship.scale.setScalar(1.6 / extent);
    ship.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-1.6 / extent);
    animateShip(ship, seed * 0.37, 0.5);
    scene.add(ship);
    renderer.clear();
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL();
  });
  return urls;
}
