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

export function createShip(seed, accent, registry = '', kind = 'sonde') {
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
  let style = rng.pick(['ailes', 'ailerons', 'anneau', 'panneaux']);
  if (warship && style === 'anneau') style = 'ailerons';
  if (warship && style === 'panneaux') style = 'ailes';
  if (style === 'ailes') {
    const wing = new THREE.Mesh(
      wingGeometry(rng.range(0.4, 0.9), rng.range(0.4, 0.8), rng.range(0.1, 0.3), rng.range(-0.1, 0.4), 0.035),
      rng.chance(0.5) ? hull : paint,
    );
    wing.position.set(radius * 0.6, rng.range(-0.05, 0.05), rng.range(-0.3, 0.1) * length);
    wing.rotation.z = rng.range(-0.25, 0.25);
    ship.add(wing, mirrored(wing));
  } else if (style === 'ailerons') {
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
  } else if (style === 'anneau') {
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

// Vignettes des vaisseaux pour l'interface, rendues une seule fois.
export function renderShipThumbnails(specs, width = 120, height = 72) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2);
  renderer.setSize(width, height);
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
  camera.position.set(1.75, 1.0, 1.45);
  camera.lookAt(0, 0, 0);
  const urls = specs.map(({ seed, accent, registry, kind }) => {
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0x8090b0, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(2, 3, 2);
    scene.add(sun);
    const ship = createShip(seed, accent, registry, kind);
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
