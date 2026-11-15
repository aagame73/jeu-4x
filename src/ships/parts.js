// Pièces communes aux vaisseaux : tailles par type, ailes, tourelles, géométries, réacteurs, soutes.
import * as THREE from 'three';
import { glowTexture } from '../textures.js';
import { makeJet } from './jets.js';

export const HULL_TONES = ['#b8bec9', '#9aa3ad', '#c9b79c', '#8e9aa8', '#d6d2c8', '#7d8794', '#a89a8a'];

// Aile en trapèze, à plat dans le plan XZ, partant de l'axe vers +X.
export function wingGeometry(span, rootChord, tipChord, sweep, thickness) {
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


// Taille de chaque type (voir SHIP_KINDS dans game.js) et échelle correspondante.
const SHIP_SIZES = {
  arche: 'gigantesque', sonde: 'petit', corvette: 'petit', fregate: 'moyen', colonie: 'moyen',
  croiseur: 'grand', transport: 'grand', cuirasse: 'gigantesque',
};
const SIZE_SCALE = { petit: 1, moyen: 1.3, grand: 1.7, gigantesque: 2.2 };
export const WARSHIPS = new Set(['corvette', 'fregate', 'croiseur', 'cuirasse']);

// Échelle du modèle selon son type (l'Arche garde son échelle d'origine).
export function shipScale(kind) {
  if (kind === 'arche') return 1.5;
  return SIZE_SCALE[SHIP_SIZES[kind]] ?? 1;
}

// Tourelle d'arme : socle, dôme et canons ; elle pivote autour de son axe Y.
export function turret(size, barrels, hull, dark) {
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
export function turretSlots(count) {
  const TOP = 0;
  const BOTTOM = Math.PI;
  if (count === 1) return [[TOP, 0.6]];
  if (count === 2) return [[TOP, 0.75], [TOP, 0.3]];
  if (count === 4) return [[TOP, 0.8], [TOP, 0.4], [BOTTOM, 0.7], [BOTTOM, 0.25]];
  const slots = [[TOP, 0.85], [TOP, 0.55], [TOP, 0.25], [BOTTOM, 0.7], [BOTTOM, 0.35]];
  const sides = [[Math.PI / 2, 0.5], [-Math.PI / 2, 0.5], [Math.PI / 2, 0.15], [-Math.PI / 2, 0.15]];
  return slots.concat(sides).slice(0, count);
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
export const WHITE = new THREE.Color('#ffffff');
// Rang de complexité : plus il est haut, plus le vaisseau porte de modules.

// --- Géométries ---

// Corps tourné autour de l'axe Z : profil [[t (0 arrière → 1 avant), r], ...], centré sur l'origine.
export function latheZ(profile, length, radius, segments) {
  const pts = profile.map(([t, r]) => new THREE.Vector2(Math.max(0.001, r * radius), t * length));
  const geometry = new THREE.LatheGeometry(pts, segments);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, -length / 2);
  return geometry;
}

// Pointe ou éclat partant de l'origine vers +Z (bipyramide à facettes).
export function shardGeometry(length, radius, segments = 5, mid = 0.35) {
  const geometry = latheZ([[0, 0.001], [mid, 1], [1, 0.001]], length, radius, segments);
  geometry.translate(0, 0, length / 2);
  return geometry;
}

// Cône partant de l'origine vers +Z.
export function spikeGeometry(length, radius, segments = 4) {
  const geometry = new THREE.ConeGeometry(radius, length, segments);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, length / 2);
  return geometry;
}

// Remet les coordonnées de texture entre 0 et `repeat` (formes extrudées ou planes).
export function normalizeUV(geometry, repeat = 1) {
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
export function slab(w, h, d, bevel = 0.22) {
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
export function beam(a, b, radius, material, segments = 6) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), segments), material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
  return mesh;
}

export function pointAlong(mesh, dir) {
  mesh.quaternion.setFromUnitVectors(Z_AXIS, dir.clone().normalize());
  return mesh;
}

// Vrai symétrique par rapport au plan YZ (rotations comprises), pour les pièces paires.
export function mirrorX(mesh) {
  const copy = mesh.clone();
  const q = mesh.quaternion;
  copy.position.x *= -1;
  copy.quaternion.set(q.x, -q.y, -q.z, q.w);
  copy.scale.x *= -1;
  return copy;
}

export function v3(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

// Aile à liseré : l'aile, plus une copie fine et un peu plus grande d'une autre couleur dessous.
export function edgedWing(geometry, material, edgeMaterial) {
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
export function around(ship, count, phase, make) {
  for (let i = 0; i < count; i++) {
    const holder = new THREE.Group();
    holder.rotation.z = phase + (i / count) * Math.PI * 2;
    holder.add(make(i));
    ship.add(holder);
  }
}

// --- Pièces communes (réacteurs, tourelles, anneaux, soutes) ---

export function addEngine(c, x, y, z, r, type = 'tuyere') {
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

export function mountTurrets(c, count) {
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
export function habitatPod(c, x, y, z, r, len, material = c.m.hull) {
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
export function cargoRows(c, rows = 2, z0 = -0.38, radiusK = 1.35) {
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
