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

  ship.userData = { flames, beacon, length, rings, turrets, lights, kind, sizeScale: shipScale(kind) };
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
  voilier: { pattern: 'glyphes', metalness: 0.85, roughness: 0.3, env: 1.1, emissive: 1.3, ring: [8, 48], warTone: '#5a3e1c', warMix: 0.4 },
  caravane: { pattern: 'cargo', metalness: 0.6, roughness: 0.45, env: 0.9, emissive: 1, ring: [8, 40], warTone: '#3c3430' },
};

// --- Environnement de reflets (partagé) : ciel sombre, soleil chaud, bande galactique ---

let spaceEnvTexture = null;
function spaceEnv() {
  if (spaceEnvTexture) return spaceEnvTexture;
  spaceEnvTexture = canvasTexture(512, 256, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#46587a');
    sky.addColorStop(0.42, '#1a2234');
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
    const sun = ctx.createRadialGradient(w * 0.32, h * 0.28, 0, w * 0.32, h * 0.28, 70);
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

function speciesTextures(rng, pattern, tone, accent, glow, registry, size = 256) {
  const W = size;
  const H = size;
  const base = makeCanvas(W, H);
  const emit = makeCanvas(W, H);
  const ctx = base.getContext('2d');
  const ex = emit.getContext('2d');
  ctx.fillStyle = css(tone);
  ctx.fillRect(0, 0, W, H);
  ex.fillStyle = '#000';
  ex.fillRect(0, 0, W, H);
  const mottle = (n, a, max) => {
    for (let i = 0; i < n; i++) {
      const s = rng.range(-a, a);
      ctx.fillStyle = s > 0 ? `rgba(255,255,255,${s})` : `rgba(0,0,0,${-s})`;
      ctx.fillRect(rng.int(0, W), rng.int(0, H), rng.int(2, max), rng.int(2, max));
    }
  };
  const glowCss = css(glow);
  const accentCss = css(accent);

  if (pattern === 'plaques') {
    // Lourdes plaques rivetées, coulures de rouille, fentes éclairées.
    const rows = rng.int(5, 7);
    const cols = rng.int(3, 5);
    const ph = H / rows;
    const pw = W / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * pw * 0.5;
      for (let k = -1; k < cols; k++) {
        const x = k * pw + off;
        const y = r * ph;
        ctx.fillStyle = shade(tone, rng.range(-0.09, 0.07));
        ctx.fillRect(x + 2, y + 2, pw - 4, ph - 4);
        ctx.fillStyle = 'rgba(255,225,190,0.2)';
        ctx.fillRect(x + 2, y + 2, pw - 4, 2);
        ctx.fillRect(x + 2, y + 2, 2, ph - 4);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x + 2, y + ph - 4, pw - 4, 3);
        ctx.fillRect(x + pw - 4, y + 2, 3, ph - 4);
        for (let i = x + 7; i < x + pw - 5; i += 9) {
          ctx.fillRect(i, y + 6, 2, 2);
          ctx.fillRect(i, y + ph - 9, 2, 2);
        }
      }
    }
    for (let i = 0; i < 18; i++) {
      const x = rng.int(0, W);
      const y = rng.int(0, H);
      const h = rng.int(20, 90);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgba(140,55,18,0.55)');
      g.addColorStop(1, 'rgba(140,55,18,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, rng.int(2, 7), h);
    }
    mottle(160, 0.1, 5);
    ex.fillStyle = glowCss;
    ctx.fillStyle = shade(glow, 0.1);
    for (let i = 0; i < 7; i++) {
      const x = rng.int(0, W - 20);
      const y = rng.int(0, H - 4);
      const w = rng.int(6, 16);
      ex.fillRect(x, y, w, 3);
      ctx.fillRect(x, y, w, 3);
    }
  } else if (pattern === 'gravures') {
    // Coque anthracite taillée en éclats, marques de victoires gravées en rouge.
    mottle(220, 0.07, 6);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      const x = rng.int(0, W);
      const y = rng.int(0, H);
      const a = rng.pick([-0.5, 0.5, 0]) + rng.range(-0.1, 0.1);
      const len = rng.int(40, 140);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.moveTo(x, y + 2);
      ctx.lineTo(x + Math.cos(a) * len, y + 2 + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.strokeStyle = accentCss;
    ex.strokeStyle = glowCss;
    ctx.lineWidth = ex.lineWidth = 2;
    for (let g = 0; g < 7; g++) {
      const x = rng.int(4, W - 30);
      const y = rng.int(4, H - 20);
      const marks = rng.int(2, 5);
      for (const c of [ctx, ex]) {
        c.beginPath();
        for (let i = 0; i < marks; i++) {
          c.moveTo(x + i * 5, y);
          c.lineTo(x + i * 5, y + 14);
        }
        if (marks >= 4) {
          c.moveTo(x - 2, y + 12);
          c.lineTo(x + marks * 5, y + 2);
        }
        c.stroke();
      }
    }
    // Chevrons rouges.
    const cy = rng.int(40, 200);
    ctx.fillStyle = accentCss;
    ex.fillStyle = rgba(glow, 0.55);
    for (const c of [ctx, ex]) {
      for (let x = 0; x < W; x += 32) {
        c.beginPath();
        c.moveTo(x, cy);
        c.lineTo(x + 16, cy + 10);
        c.lineTo(x + 32, cy);
        c.lineTo(x + 32, cy + 5);
        c.lineTo(x + 16, cy + 15);
        c.lineTo(x, cy + 5);
        c.closePath();
        c.fill();
      }
    }
  } else if (pattern === 'liseres') {
    // Coque claire et nette, fins liserés jaunes et flèches.
    mottle(80, 0.04, 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo((i * W) / 6, 0);
      ctx.lineTo((i * W) / 6, H);
      ctx.stroke();
    }
    for (let j = 1; j < 8; j++) {
      ctx.beginPath();
      ctx.moveTo(0, (j * H) / 8);
      ctx.lineTo(W, (j * H) / 8);
      ctx.stroke();
    }
    const stripes = rng.int(1, 2);
    for (let s = 0; s < stripes; s++) {
      const y = rng.int(50, 190);
      ctx.fillStyle = accentCss;
      ctx.fillRect(0, y, W, 5);
      ctx.fillRect(0, y + 9, W, 2);
      ex.fillStyle = rgba(glow, 0.5);
      ex.fillRect(0, y + 1, W, 3);
      ctx.fillStyle = shade(accent, -0.2);
      for (let x = rng.int(0, 30); x < W; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, y + 14);
        ctx.lineTo(x + 8, y + 19);
        ctx.lineTo(x, y + 24);
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(40,40,46,0.75)';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(registry, rng.int(8, 120), rng.int(30, 45));
  } else if (pattern === 'meduse') {
    // Chair translucide : cellules douces et veines luminescentes.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, shade(tone, -0.08));
    g.addColorStop(0.5, shade(tone, 0.12));
    g.addColorStop(1, shade(tone, -0.08));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 46; i++) {
      const x = rng.int(0, W);
      const y = rng.int(0, H);
      const r = rng.int(8, 28);
      const c = ctx.createRadialGradient(x, y, 0, x, y, r);
      c.addColorStop(0, 'rgba(255,255,255,0.22)');
      c.addColorStop(0.7, 'rgba(255,255,255,0.04)');
      c.addColorStop(1, 'rgba(0,30,40,0.22)');
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ex.strokeStyle = rgba(glow, 0.8);
    ctx.strokeStyle = rgba(glow.clone().lerp(WHITE, 0.4), 0.5);
    ex.lineWidth = ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const x = rng.int(0, W);
      const pts = [rng.int(0, W), rng.int(0, W), rng.int(0, W)];
      for (const c of [ctx, ex]) {
        c.beginPath();
        c.moveTo(x, 0);
        c.bezierCurveTo(pts[0], H * 0.33, pts[1], H * 0.66, pts[2], H);
        c.stroke();
      }
    }
    ex.fillStyle = glowCss;
    for (let i = 0; i < 50; i++) ex.fillRect(rng.int(0, W), rng.int(0, H), 2, 2);
  } else if (pattern === 'mycelium') {
    // Peau fongique tachetée et réseau de veines lumineuses qui se ramifient.
    for (let i = 0; i < 60; i++) {
      const x = rng.int(0, W);
      const y = rng.int(0, H);
      ctx.fillStyle = rng.chance(0.5) ? 'rgba(0,0,0,0.16)' : 'rgba(255,240,255,0.1)';
      ctx.beginPath();
      ctx.arc(x, y, rng.int(3, 14), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(235,215,255,0.4)';
    ex.strokeStyle = rgba(glow, 0.95);
    const walk = (x, y, a, steps, width) => {
      ctx.lineWidth = width + 1;
      ex.lineWidth = width;
      for (const c of [ctx, ex]) c.beginPath(), c.moveTo(x, y);
      for (let s = 0; s < steps; s++) {
        x += Math.cos(a) * 6;
        y += Math.sin(a) * 6;
        a += rng.range(-0.55, 0.55);
        ctx.lineTo(x, y);
        ex.lineTo(x, y);
        if (width > 0.8 && rng.chance(0.08)) {
          ctx.stroke();
          ex.stroke();
          walk(x, y, a + rng.pick([-1, 1]) * 0.9, Math.floor(steps * 0.5), width * 0.6);
          ctx.lineWidth = width + 1;
          ex.lineWidth = width;
          for (const c of [ctx, ex]) c.beginPath(), c.moveTo(x, y);
        }
      }
      ctx.stroke();
      ex.stroke();
    };
    for (let i = 0; i < 9; i++) walk(rng.int(0, W), rng.int(0, H), rng.range(0, Math.PI * 2), 28, 2);
    ex.fillStyle = glowCss;
    for (let i = 0; i < 30; i++) {
      ex.beginPath();
      ex.arc(rng.int(0, W), rng.int(0, H), rng.range(1, 2.5), 0, Math.PI * 2);
      ex.fill();
    }
  } else if (pattern === 'facettes') {
    // Cristal : facettes qui accrochent la lumière, fêlures lumineuses.
    for (let i = 0; i < 70; i++) {
      const x = rng.int(0, W);
      const y = rng.int(0, H);
      const s = rng.int(20, 60);
      ctx.fillStyle = rng.chance(0.5) ? `rgba(255,255,255,${rng.range(0.05, 0.22)})` : `rgba(60,90,140,${rng.range(0.04, 0.14)})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + rng.range(-s, s), y + rng.range(0, s));
      ctx.lineTo(x + rng.range(-s, s), y + rng.range(-s, 0));
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ex.strokeStyle = glowCss;
    ctx.lineWidth = ex.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {
      let x = rng.int(0, W);
      let y = rng.int(0, H);
      for (const c of [ctx, ex]) c.beginPath();
      ctx.moveTo(x, y);
      ex.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += rng.range(-30, 30);
        y += rng.range(-30, 30);
        ctx.lineTo(x, y);
        ex.lineTo(x, y);
      }
      ctx.stroke();
      ex.stroke();
    }
  } else if (pattern === 'glyphes') {
    // Or brossé, bandeaux de glyphes gravés qui luisent.
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = rng.chance(0.5) ? 'rgba(255,245,210,0.07)' : 'rgba(60,40,10,0.08)';
      ctx.fillRect(0, rng.int(0, H), W, 1);
    }
    mottle(60, 0.05, 10);
    const bands = rng.int(2, 3);
    ctx.lineWidth = 1.6;
    ex.lineWidth = 1.6;
    for (let b = 0; b < bands; b++) {
      const y = 22 + b * (H / bands) + rng.int(0, 20);
      ctx.fillStyle = 'rgba(70,45,10,0.45)';
      ctx.fillRect(0, y - 4, W, 2);
      ctx.fillRect(0, y + 22, W, 2);
      ctx.strokeStyle = 'rgba(80,50,10,0.75)';
      ex.strokeStyle = glowCss;
      for (let x = 4; x < W - 16; x += 20) glyph(rng, [ctx, ex], x, y, 15);
    }
  } else {
    // 'cargo' : cuivre ondulé, cadre, bandes de danger et numéro au pochoir.
    for (let x = 0; x < W; x += 8) {
      ctx.fillStyle = 'rgba(255,230,200,0.14)';
      ctx.fillRect(x, 0, 2, H);
      ctx.fillStyle = 'rgba(40,15,0,0.25)';
      ctx.fillRect(x + 4, 0, 3, H);
    }
    mottle(140, 0.08, 6);
    ctx.strokeStyle = 'rgba(30,15,5,0.7)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    const hy = rng.int(150, 210);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hy, W, 22);
    ctx.clip();
    for (let x = -30; x < W; x += 22) {
      ctx.fillStyle = accentCss;
      ctx.beginPath();
      ctx.moveTo(x, hy + 22);
      ctx.lineTo(x + 11, hy + 22);
      ctx.lineTo(x + 33, hy);
      ctx.lineTo(x + 22, hy);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(25,12,4,0.65)';
    ctx.font = 'bold 54px monospace';
    ctx.fillText(String(rng.int(10, 99)), rng.int(20, 120), rng.int(80, 130));
    ctx.font = 'bold 16px monospace';
    ctx.fillText(registry, 18, 36);
    ex.fillStyle = glowCss;
    ex.fillRect(W - 24, 12, 8, 4);
  }
  return { map: toTexture(base), emissiveMap: toTexture(emit) };
}

// Voile des Liseurs : membrane dorée, nervures et colonnes de glyphes.
function sailTextures(rng, tone, glow) {
  const W = 256;
  const H = 256;
  const base = makeCanvas(W, H);
  const emit = makeCanvas(W, H);
  const ctx = base.getContext('2d');
  const ex = emit.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, shade(tone, 0.05));
  g.addColorStop(1, shade(tone, 0.2));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ex.fillStyle = '#000';
  ex.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(90,60,15,0.7)';
  ex.strokeStyle = rgba(glow, 0.35);
  ctx.lineWidth = ex.lineWidth = 2;
  const ribs = rng.int(5, 8);
  for (let i = 0; i <= ribs; i++) {
    const y = (i / ribs) * H;
    for (const c of [ctx, ex]) {
      c.beginPath();
      c.moveTo(0, y);
      c.quadraticCurveTo(W * 0.5, y + 10, W, y - 30);
      c.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(110,70,10,0.8)';
  ex.strokeStyle = css(glow);
  ctx.lineWidth = ex.lineWidth = 1.8;
  const cols = rng.int(2, 3);
  for (let k = 0; k < cols; k++) {
    const x = 30 + k * 60 + rng.int(0, 20);
    for (let y = 16; y < H - 20; y += 22) glyph(rng, [ctx, ex], x, y, 14);
  }
  return { map: toTexture(base), emissiveMap: toTexture(emit) };
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

// Anneau d'habitat en rotation, avec sa bande de hublots éclairés et ses rayons.
function habitatRing(c, r, tube, z, spokes = 4) {
  const { m, look } = c;
  const [radial, tubular] = look.ring ?? [8, 40];
  const ring = new THREE.Group();
  const torus = new THREE.Mesh(new THREE.TorusGeometry(r, tube, radial, tubular), m.hull);
  if (radial <= 4) torus.rotation.z = Math.PI / tubular;
  const windows = new THREE.Mesh(new THREE.TorusGeometry(r + tube * 0.9, tube * 0.14, 4, Math.max(tubular, 24)), m.windows);
  ring.add(torus, windows);
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2;
    ring.add(beam(v3(0, 0, 0), v3(Math.cos(a) * r, Math.sin(a) * r, 0), tube * 0.22, m.dark, 5));
  }
  ring.position.z = z;
  c.ship.add(ring);
  c.rings.push(ring);
  return ring;
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
  const { rng, ship, m, tier, style, warship } = c;
  const L = (c.L = rng.range(1.45, 1.8));
  const R = (c.R = rng.range(0.25, 0.3));
  const seg = rng.pick(style.segments ?? [5, 6]);
  const body = new THREE.Mesh(latheZ([[0, 0.001], [0.001, 0.82], [0.08, 0.96], [0.5, 1], [0.78, 0.95], [0.92, 0.72], [1, 0.42], [1.001, 0.001]], L, R, seg), m.hull);
  body.scale.y = 0.8;
  body.rotation.z = Math.PI / seg;
  ship.add(body);

  // Plaques de blindage qui se chevauchent sur les flancs et le dos.
  const rust = std({ map: m.hull.map, color: '#e0905a', metalness: 0.5, roughness: 0.65 });
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
  const blade = std({ color: c.tone.clone().multiplyScalar(0.7), metalness: 0.85, roughness: 0.25 });
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
  c.habitat = () => {
    const rings = kind === 'arche' ? 2 : 1;
    for (let i = 0; i < rings; i++) habitatRing(c, R * (2.7 - i * 0.4), R * 0.32, L * (0.34 - i * 0.12), 3);
  };
}

// Ondésiens : bulbe translucide lobé, cœur lumineux, anneaux flottants, filaments qui traînent.
function buildMeduse(c) {
  const { rng, ship, m, tier, style, warship, kind } = c;
  const L = (c.L = rng.range(1.35, 1.6));
  const R = (c.R = rng.range(0.3, 0.36));
  const seg = Math.max(24, rng.pick(style.segments ?? [12, 16]) * 2);
  const membrane = new THREE.MeshPhysicalMaterial({
    map: m.hull.map, emissiveMap: m.hull.emissiveMap, emissive: c.glow, emissiveIntensity: 0.9,
    color: c.tone.clone().lerp(WHITE, 0.2), metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08,
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
    const gill = std({ map: m.hull.map, emissiveMap: m.hull.emissiveMap, emissive: c.glow, emissiveIntensity: 1, color: c.tone.clone().lerp(WHITE, 0.3), transparent: true, opacity: 0.7, roughness: 0.6, metalness: 0, depthWrite: false });
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
  // Anneau de spores (colonie, Arche), ou petit anneau tiré au hasard.
  const ringed = kind === 'colonie' || kind === 'arche' || kind === 'transport';
  c.habitat = () => {
    const count = kind === 'arche' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const s = spheres[Math.max(0, mid - i)];
      const g = habitatRing(c, s.r + R * (1.3 + i * 0.4), R * 0.12, s.z, 3);
      const pods = 8;
      for (let k = 0; k < pods; k++) {
        const a = (k / pods) * Math.PI * 2 + 0.2;
        const pod = new THREE.Mesh(new THREE.SphereGeometry(R * 0.2, 12, 10), k % 2 ? dome : m.hull);
        pod.position.set(Math.cos(a) * (s.r + R * (1.3 + i * 0.4)), Math.sin(a) * (s.r + R * (1.3 + i * 0.4)), 0);
        g.add(pod);
      }
    }
  };
  if (!ringed && rng.chance(0.3)) habitatRing(c, spheres[mid].r + R * 0.7, R * 0.06, spheres[mid].z, 3);
}

// Orrhaïdes : bipyramide de cristal à facettes, cœur lumineux, éclats qui rayonnent.
function buildCristal(c) {
  const { rng, ship, m, tier, style, warship, kind } = c;
  const L = (c.L = rng.range(1.6, 2.0));
  const R = (c.R = rng.range(0.21, 0.26));
  const seg = rng.pick(style.segments ?? [5, 6]);
  const crystal = new THREE.MeshPhysicalMaterial({
    map: m.hull.map, emissiveMap: m.hull.emissiveMap, emissive: c.glow, emissiveIntensity: 0.9,
    color: c.tone, metalness: 0.05, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04,
    iridescence: 0.9, iridescenceIOR: 1.5, transparent: true, opacity: 0.8, flatShading: true,
    envMap: spaceEnv(), envMapIntensity: 1.8, side: THREE.DoubleSide,
  });
  m.crystal = crystal;
  const shine = std({ color: c.glow.clone().lerp(WHITE, 0.5), emissive: c.glow, emissiveIntensity: 1.6, metalness: 0, roughness: 0.2, flatShading: true });
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
  // Colonie et Arche : couronnes d'éclats en rotation.
  c.habitat = () => {
    const crowns = kind === 'arche' ? 2 : 1;
    for (let i = 0; i < crowns; i++) {
      const g = new THREE.Group();
      const count = kind === 'arche' ? 10 - i * 3 : 7;
      const rr = R * (2.1 - i * 0.5);
      g.add(new THREE.Mesh(new THREE.TorusGeometry(rr, R * 0.03, 4, 40), shine));
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2;
        const s = new THREE.Mesh(shardGeometry(R * 0.9, R * 0.22, 5, 0.5), k % 2 ? crystal : shine);
        s.position.set(Math.cos(a) * rr, Math.sin(a) * rr, -R * 0.45);
        s.renderOrder = 2;
        g.add(s);
      }
      g.position.z = L * (midT - 0.5 - i * 0.22);
      ship.add(g);
      c.rings.push(g);
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
  const sailTex = sailTextures(rng, c.tone.clone().lerp(new THREE.Color('#e8c060'), 0.35), c.glow);
  const sailMat = std({ map: sailTex.map, emissiveMap: sailTex.emissiveMap, emissive: c.glow, emissiveIntensity: 1.2, metalness: 0.4, roughness: 0.45, transparent: true, opacity: 0.82, depthWrite: false });
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
  // Anneau de glyphes à l'avant (ou habitat pour la colonie et l'Arche).
  const glyphRing = std({ map: m.hull.map, emissiveMap: m.hull.emissiveMap, emissive: c.glow, emissiveIntensity: 1.6, color: c.tone, metalness: 0.85, roughness: 0.3 });
  const ringed = kind === 'colonie' || kind === 'arche' || kind === 'transport';
  if (!ringed && rng.chance(0.6)) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(R * 2.1, R * 0.12, 6, 48), glyphRing));
    g.position.z = L * 0.34;
    ship.add(g);
    c.rings.push(g);
  }
  c.engines.push([0, 0, -L * 0.5, R * 0.55]);
  if (tier >= 3) c.engines.push([R * 0.9, 0, -L * 0.42, R * 0.3], [-R * 0.9, 0, -L * 0.42, R * 0.3]);
  c.beaconPos = v3(0, R * 1.0, L * 0.05);
  c.turretScale = 1.4;
  c.turretAt = (angle, row) => ({ z: L * (-0.1 + row * 0.42), dist: R * 0.92 });
  c.habitat = () => {
    const rings = kind === 'arche' ? 2 : 1;
    for (let i = 0; i < rings; i++) {
      const g = habitatRing(c, R * (2.6 - i * 0.5), R * 0.3, L * (0.36 - i * 0.12), 3);
      g.children[0].material = glyphRing;
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
  const cargoTex = [0, 1, 2].map(() => speciesTextures(rng, 'cargo', c.tone.clone().offsetHSL(rng.range(-0.02, 0.03), 0, rng.range(-0.08, 0.08)), c.accent, c.glow, c.registry, 128));
  const cargo = cargoTex.map((t, i) => std({ map: t.map, metalness: 0.55, roughness: 0.5, color: i === 2 ? (warship ? '#7a7f88' : '#e0e6ee') : '#ffffff' }));
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
  const scoopMat = std({ map: m.hull.map, color: '#d08850', metalness: 0.8, roughness: 0.3 });
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
    const fins = canvasTexture(64, 128, (ctx, w, h) => {
      ctx.fillStyle = '#2a2420';
      ctx.fillRect(0, 0, w, h);
      for (let y = 4; y < h; y += 8) {
        ctx.fillStyle = '#b07040';
        ctx.fillRect(2, y, w - 4, 3);
      }
    });
    const rad = std({ map: fins, metalness: 0.6, roughness: 0.4 });
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
  c.habitat = () => {
    const rings = kind === 'arche' ? 2 : 1;
    for (let i = 0; i < rings; i++) habitatRing(c, R * (3 - i * 0.5), R * 0.32, L * (0.05 - i * 0.24), 4);
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

  const tex = speciesTextures(rng, look.pattern, tone, accentColor, glow, registry);
  const m = {
    hull: std({ map: tex.map, emissiveMap: tex.emissiveMap, emissive: glow, emissiveIntensity: look.emissive, metalness: Math.min(0.95, look.metalness + (warship ? 0.1 : 0)), roughness: look.roughness, envMapIntensity: look.env }),
    dark: std({ color: tone.clone().lerp(new THREE.Color('#121418'), 0.72), metalness: 0.8, roughness: 0.38, envMapIntensity: 0.9 }),
    glow: basic(glow),
    accent: std({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.45, metalness: 0.35, roughness: 0.4 }),
    accentGlow: basic(accentColor),
    windows: basic(glow.clone().lerp(WHITE, 0.45)),
  };
  const c = {
    rng, ship, kind, tier, warship, style, look, glow, accent: accentColor, tone, registry, m,
    flames: [], rings: [], turrets: [], lights: [], engines: [], lightSpots: null, beaconPos: null, civilTurrets: 0,
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

  // Colonie, transport et Arche : habitat de l'espèce (ou anneaux génériques) et soutes.
  if (kind === 'colonie' || kind === 'transport' || kind === 'arche') {
    if (c.habitat) c.habitat();
    else {
      const count = kind === 'colonie' ? 1 : 2;
      for (let i = 0; i < count; i++) habitatRing(c, R * (kind === 'arche' ? 3.4 - i * 0.7 : 3 - i * 0.5), R * 0.4, L * (i === 0 ? -0.05 : 0.22));
    }
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

  ship.userData = { flames: c.flames, beacon, length: L, rings: c.rings, turrets: c.turrets, lights: c.lights, kind, sizeScale: shipScale(kind), archetype };
  ship.scale.setScalar((1.6 / L) * shipScale(kind));
  return ship;
}

// Vignettes des vaisseaux pour l'interface, rendues une seule fois.
// style : style d'espèce commun à toutes les vignettes (chaque spec peut aussi porter le sien).
export function renderShipThumbnails(specs, width = 120, height = 72, style = null) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
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
      if (o.isMesh) box.expandByObject(o);
    });
    const dims = box.getSize(new THREE.Vector3());
    const extent = Math.max(dims.z, Math.max(dims.x, dims.y) * 1.25, 0.001);
    ship.scale.setScalar(1.6 / extent);
    ship.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-1.6 / extent);
    for (const flame of ship.userData.flames) flame.scale.setScalar(0.5);
    scene.add(ship);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL();
  });
  renderer.dispose();
  renderer.forceContextLoss();
  return urls;
}
