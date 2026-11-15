// Vaisseaux au style d'une espèce : les 8 archétypes et leur assemblage (createStyledShip).
import * as THREE from 'three';
import { createRng } from '../rng.js';
import { glowTexture } from '../textures.js';
import { HULL_TONES, wingGeometry, WARSHIPS, shipScale, turret, WHITE, latheZ, shardGeometry, spikeGeometry, normalizeUV, slab, beam, pointAlong, mirrorX, v3, edgedWing, around, addEngine, mountTurrets, habitatPod, cargoRows } from './parts.js';
import { spaceEnv, std, basic, windows, tintFor, pbr, variant, weatherShip } from './materials.js';
import { hullSet, DARK_BASE, PAINT_BASE, CONTAINER_BASE, SAIL_BASE, darkSet, paintSet, containerSet, sailSet, radiatorSet } from './patterns.js';

// ===========================================================================
// Vaisseaux au style d'une espèce (paramètre `style` = SPECIES[...].shipStyle).
// Chaque style a sa silhouette (archétype), ses matériaux et ses détails ; la graine
// rend chaque vaisseau unique à l'intérieur de ce style.
// ===========================================================================

const TIER = { sonde: 0, corvette: 1, colonie: 2, fregate: 2, transport: 3, croiseur: 3, cuirasse: 4, arche: 5 };
const WAR_TURRETS = { corvette: 1, fregate: 2, croiseur: 4, cuirasse: 7 };

// Archétype déduit des paramètres du style (ou donné directement par style.archetype).
function shipArchetype(style) {
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
    iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessMinimum: 250, iridescenceThicknessMaximum: 900, transparent: true, opacity: 0.6, flatShading: true,
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

export function createStyledShip(seed, accent, registry, kind, style) {
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
