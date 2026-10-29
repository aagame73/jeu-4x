// Générateur procédural de vaisseaux : chaque graine donne une coque, des ailes,
// des capteurs et une livrée différents. Les vaisseaux pointent vers +Z.
import * as THREE from 'three';
import { createRng } from './rng.js';
import { canvasTexture, glowTexture } from './textures.js';

const HULL_TONES = ['#b8bec9', '#9aa3ad', '#c9b79c', '#8e9aa8', '#d6d2c8', '#7d8794', '#a89a8a'];
export const SHIP_ACCENTS = ['#7cff9e', '#ffb347', '#5fd3ff', '#ff6fae', '#c6a0ff', '#fff07a'];
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
function fuselage(rng, length, radius) {
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
  const geometry = new THREE.LatheGeometry(points, rng.pick([5, 6, 8, 12]));
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

export function createShip(seed, accent, registry = '', kind = 'sonde') {
  const rng = createRng(seed);
  const ship = new THREE.Group();
  const accentColor = new THREE.Color(accent);

  const hull = new THREE.MeshStandardMaterial({ map: hullTexture(rng, rng.pick(HULL_TONES), accent, registry), metalness: 0.55, roughness: 0.45, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c3038, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide });
  const paint = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide });

  const length = rng.range(1.2, 2);
  const radius = rng.range(0.14, 0.26);
  const body = new THREE.Mesh(fuselage(rng, length, radius), hull);
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
  const style = rng.pick(['ailes', 'ailerons', 'anneau', 'panneaux']);
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
  const engineCount = rng.pick([1, 1, 2, 3]);
  const flames = [];
  for (let i = 0; i < engineCount; i++) {
    const offset = engineCount === 1 ? 0 : radius * 0.7;
    const angle = (i / engineCount) * Math.PI * 2;
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.45, radius * 0.6, 0.18, 8, 1, true), dark);
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

  // Vaisseaux colonie et Arche : anneaux d'habitat en rotation et conteneurs de cargaison.
  const rings = [];
  if (kind !== 'sonde') {
    const ringCount = kind === 'arche' ? 2 : 1;
    for (let i = 0; i < ringCount; i++) {
      const ring = new THREE.Group();
      const r = radius * (kind === 'arche' ? 3.6 - i * 0.8 : 3);
      ring.add(new THREE.Mesh(new THREE.TorusGeometry(r, radius * 0.45, 8, 28), hull));
      for (let k = 0; k < 4; k++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(r, 0.03, 0.04), dark);
        spoke.position.x = r / 2;
        const holder = new THREE.Group();
        holder.add(spoke);
        holder.rotation.z = (k / 4) * Math.PI * 2;
        ring.add(holder);
      }
      ring.position.z = length * (i === 0 ? -0.05 : 0.22);
      ship.add(ring);
      rings.push(ring);
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

  ship.userData = { flames, beacon, length, rings };
  // Taille commune pour tous les vaisseaux, quelle que soit leur longueur ; l'Arche est bien plus grande.
  ship.scale.setScalar((1.6 / length) * (kind === 'arche' ? 1.5 : kind === 'colonie' ? 1.25 : 1));
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
    ship.scale.setScalar(1.6 / ship.userData.length); // même cadrage pour tous dans la vignette
    for (const flame of ship.userData.flames) flame.scale.setScalar(0.5);
    scene.add(ship);
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL();
  });
  renderer.dispose();
  renderer.forceContextLoss();
  return urls;
}
