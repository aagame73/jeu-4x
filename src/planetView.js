// Vue de la surface d'une planète : un plateau d'hexagones en 3D, avec terrains, gisements
// et bâtiments, plus les panneaux de la colonie et de la case sélectionnée.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TERRAINS, HEX_DIRECTIONS, hexKey } from './surface.js';
import { BUILDINGS, RESOURCE_LABELS, SHIPYARD, depositName, buildableTypes, lockedTypes, colonyReport, previewBuilding, canAfford } from './economy.js';
import { PLANET_TYPES, PLANET_SIZES } from './galaxy.js';
import { getSurface, colonyOn, shipyardProblem } from './game.js';
import { createRng } from './rng.js';
import { canvasTexture, glowTexture } from './textures.js';
import { createSurfaceFx } from './surfaceFx.js';
import { icon } from './icons.js';
import { TECHS } from './research.js';
// Règles arrivées plus tard (niveaux, défense, tailles) : lues via l'espace de noms pour
// tolérer leur absence (un import nommé manquant casserait le module).
import * as ECO from './economy.js';
import * as GAME from './game.js';

// Niveaux des bâtiments.
const MAX_LEVEL = 4;
const LEVEL_TECHS = ['automatisation', 'robotique', 'nanofabrication']; // niveau 2, 3, 4
const levelOf = (building) => building?.level ?? 1;
const maxLevelNow = () => ECO.maxLevel?.() ?? 1;
const isUpgradable = (type) => !!BUILDINGS[type] && BUILDINGS[type].upgradable !== false && BUILDINGS[type].buildable !== false;
const LEVEL_COLORS = ['#7cff9e', '#5fe3ff', '#c9a7ff', '#ffd166'];

const HEX = 1;
const SQRT3 = Math.sqrt(3);
const hexToWorld = (q, r) => new THREE.Vector3(HEX * SQRT3 * (q + r / 2), 0, HEX * 1.5 * r);

const SKY_TINTS = {
  tempere: '#3a6ea5',
  oceanique: '#2f7fb8',
  marecageuse: '#4f6b3a',
  desertique: '#b5844a',
  volcanique: '#8a3a22',
  toxique: '#7f8f2a',
  glacee: '#9fc3df',
};

const DEPOSIT_STYLE = {
  minerais: { color: '#c79a5b', emissive: 0x000000 },
  energie: { color: '#ffd166', emissive: 0x6a4a00 },
  biomasse: { color: '#6fd27a', emissive: 0x0a3010 },
  velarine: { color: '#c77dff', emissive: 0x5a1a90 },
  eau: { color: '#4aa8ff', emissive: 0x0a2a55, transparent: true, opacity: 0.75 },
  deuterium: { color: '#5fe3ff', emissive: 0x1a8aa8, transparent: true, opacity: 0.8 },
};

// Ressources affichées dans les pastilles et tuiles de production (ordre d'affichage).
const RESOURCES = ['minerais', 'energie', 'biomasse', 'velarine', 'alliages', 'deuterium', 'eau', 'artefacts', 'recherche'];
// Petit cadenas des bâtiments qui attendent une technologie.
const LOCK_ICON = '<svg class="lock-svg" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.5" fill="currentColor"/><path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const resLabel = (res) => RESOURCE_LABELS[res] ?? res;

const RICHNESS = ['', 'pauvre', 'moyen', 'riche'];

const fmt = (x, signed = true) => {
  const s = Math.abs(x) < 0.05 ? '0' : x.toFixed(1).replace('.', ',').replace(',0', '');
  return signed && x >= 0.05 ? `+${s}` : s;
};

function noiseTexture() {
  const texture = canvasTexture(128, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const v = 200 + Math.random() * 55;
      img.data.set([v, v, v, 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// --- Arrière-plan : horizon planétaire ----------------------------------------------
// Décor HTML/CSS posé derrière le rendu 3D (transparent) : ciel, étoiles, nébuleuse,
// parfois une lune, et en bas la courbure lumineuse de la planète. Les couleurs viennent
// des variables CSS de [data-planet-type] (styles/planete.css) ; la graine place les détails.
const STAR_COLORS = ['#ffffff', '#ffffff', 'rgba(255,255,255,0.6)', '#cfe0ff', 'rgba(207,224,255,0.55)', '#ffe9c4'];

// Détails propres à chaque type : dans le ciel, puis sur la planète elle-même.
const SKY_EXTRAS = {
  glacee: { sky: '<div class="sky-aurora"><i></i><i></i></div>' },
  desertique: { sky: '<div class="sky-suns"><i></i><i></i></div>', noMoon: true },
  toxique: { sky: '<div class="sky-haze"></div>' },
  marecageuse: { sky: '<div class="sky-haze"></div>' },
  volcanique: { horizon: '<div class="sky-lava"><i></i><i></i><i></i></div>' },
};

function skyMarkup(planet, seed) {
  const rng = createRng(seed);
  const stars = [];
  for (let i = 0; i < 110; i++) {
    const spread = rng.chance(0.12) ? 0.8 : rng.chance(0.35) ? 0.3 : 0;
    stars.push(`${rng.range(0, 100).toFixed(1)}vw ${rng.range(0, 68).toFixed(1)}vh 0 ${spread}px ${rng.pick(STAR_COLORS)}`);
  }
  const extra = SKY_EXTRAS[planet.type] ?? {};
  let moon = '';
  if (!extra.noMoon && rng.chance(0.65)) {
    const size = Math.round(rng.range(26, 50));
    moon = `<div class="sky-moon" style="left:${rng.range(62, 90).toFixed(1)}%;top:${rng.range(10, 24).toFixed(1)}%;width:${size}px;height:${size}px"></div>`;
  }
  return `
    <div class="sky-nebula${rng.chance(0.5) ? ' flip' : ''}"></div>
    <div class="sky-stars" style="box-shadow:${stars.join(',')}"></div>
    ${extra.sky ?? ''}${moon}
    <div class="sky-glow"></div>
    <div class="sky-horizon">
      <div class="sky-bands"><i></i><i></i><i></i></div>
      ${extra.horizon ?? ''}
      <div class="sky-rim"></div>
    </div>`;
}

// Petites icônes des commandes spatiales (absentes de icons.js).
const yardSvg = (body) => `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const YARD_ICONS = {
  sonde: yardSvg('<circle cx="12" cy="13" r="4"/><path d="M12 9V3M9 4h6M5 17l3-2M19 17l-3-2"/>'),
  dock: yardSvg('<path d="M3 8h18v8H3z"/><path d="M7 8V5M17 8V5M7 16v3M17 16v3M10 12h4"/>'),
  defense: yardSvg('<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  colonie: yardSvg('<path d="M12 2c3 3 4 7 3 12H9C8 9 9 5 12 2z"/><path d="M9 14l-3 4h3M15 14l3 4h-3"/><circle cx="12" cy="8" r="1.5"/>'),
  moteurs: yardSvg('<path d="M4 12h9M4 8h6M4 16h6"/><path d="M13 6l7 6-7 6z"/>'),
  ecope: yardSvg('<path d="M4 5h16l-6 8v4l-4 3v-7z"/><path d="M8 9h8"/>'),
  blindage: yardSvg('<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M12 7v10M8 10h8"/>'),
};
const yardIcon = (key) => icon(key) || YARD_ICONS[key] || YARD_ICONS.sonde;
const YARD_CATEGORIES = [
  ['civil', 'Vaisseaux civils'],
  ['guerre', 'Vaisseaux de guerre'],
  ['orbital', 'Structures orbitales'],
];
const TOOL_ICON = yardSvg('<path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7 3 15l3 3 8-8"/>');
const WARN_ICON = yardSvg('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>');

const hexGeometries = new Map();
function hexGeometry(height) {
  if (!hexGeometries.has(height)) hexGeometries.set(height, new THREE.CylinderGeometry(HEX * 0.96, HEX * 0.96, height, 6));
  return hexGeometries.get(height);
}

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, flatShading: true, ...extra });
}

// --- Décors de terrain (animés par surfaceFx) ---------------------------------------
function addDecor(group, tile, top, fx) {
  const rng = createRng(tile.index * 7919 + 17);
  const spot = (radius = 0.55) => {
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * radius;
    return [Math.cos(a) * d, Math.sin(a) * d];
  };
  const add = (mesh, x, z, y = top) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  switch (tile.terrain) {
    case 'foret':
      fx.addForest(group, rng, top, () => spot());
      break;
    case 'plaine':
      for (let i = rng.int(0, 3); i > 0; i--) {
        const [x, z] = spot(0.7);
        add(new THREE.Mesh(new THREE.DodecahedronGeometry(rng.range(0.04, 0.08)), std('#7d7a70')), x, z, top + 0.02);
      }
      break;
    case 'marais':
      for (let i = rng.int(2, 3); i > 0; i--) {
        const [x, z] = spot();
        const pool = add(new THREE.Mesh(new THREE.CircleGeometry(rng.range(0.12, 0.22), 10), fx.water), x, z, top + 0.005);
        pool.rotation.x = -Math.PI / 2;
      }
      for (let i = rng.int(3, 6); i > 0; i--) {
        const [x, z] = spot(0.7);
        const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.18, 4), std('#8a9a50'));
        reed.geometry.translate(0, 0.09, 0); // pivot au pied, pour se balancer
        fx.addSwayer(add(reed, x, z, top), 0.12);
      }
      break;
    case 'desert':
      for (let i = rng.int(1, 2); i > 0; i--) {
        const [x, z] = spot(0.4);
        const dune = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), std('#e0c07a')), x, z, top - 0.01);
        dune.scale.set(1, 0.25, 0.6);
        dune.rotation.y = rng.range(0, Math.PI);
      }
      break;
    case 'glace':
      for (let i = rng.int(2, 4); i > 0; i--) {
        const [x, z] = spot();
        const h = rng.range(0.15, 0.35);
        add(new THREE.Mesh(new THREE.ConeGeometry(rng.range(0.05, 0.09), h, 5), fx.sparkle), x, z, top + h / 2);
      }
      break;
    case 'volcanique': {
      const [x, z] = spot(0.3);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.28, 0.22, 7), std('#2e2420')), x, z, top + 0.11);
      const lava = add(new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), new THREE.MeshBasicMaterial({ color: '#ff6a1a' })), x, z, top + 0.225);
      lava.rotation.x = -Math.PI / 2;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff5a10', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.position.set(x, top + 0.3, z);
      glow.scale.setScalar(0.6);
      group.add(glow);
      fx.addVolcano(group, x, z, top, glow);
      break;
    }
    case 'toxique':
      for (let i = rng.int(3, 5); i > 0; i--) {
        const [x, z] = spot();
        const bubble = add(new THREE.Mesh(new THREE.SphereGeometry(rng.range(0.04, 0.08), 8, 6), std('#d4f04a', { emissive: 0x3a4a00, roughness: 0.3, transparent: true, opacity: 0.85 })), x, z, top + 0.04);
        fx.addBubble(bubble, top);
      }
      break;
    case 'ruines':
      for (let i = rng.int(3, 5); i > 0; i--) {
        const [x, z] = spot(0.6);
        const h = rng.range(0.15, 0.55);
        const pillar = add(new THREE.Mesh(new THREE.BoxGeometry(0.09, h, 0.09), std('#a8a090')), x, z, top + h / 2);
        if (rng.chance(0.3)) {
          pillar.rotation.z = Math.PI / 2;
          pillar.position.y = top + 0.05;
        }
      }
      {
        const glyph = add(new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 6), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.7, side: THREE.DoubleSide })), 0, 0, top + 0.01);
        glyph.rotation.x = -Math.PI / 2;
        fx.addGlyph(glyph);
      }
      break;
  }
}

// Cascades : l'océan au bord du plateau se déverse le long de la roche.
function addWaterfalls(group, tile, surface, top, fx) {
  HEX_DIRECTIONS.forEach(([dq, dr]) => {
    if (surface.byKey.has(hexKey(tile.q + dq, tile.r + dr))) return;
    const v = hexToWorld(dq, dr);
    const height = top + 0.8;
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(HEX * 0.98, height), fx.fall);
    sheet.position.set(v.x / 2, top - height / 2, v.z / 2);
    sheet.rotation.y = Math.atan2(v.x, v.z);
    group.add(sheet);
    const mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#cfe8ff', transparent: true, opacity: 0.35, depthWrite: false }));
    mist.position.set(v.x * 0.62, -0.75, v.z * 0.62);
    mist.scale.set(1.4, 0.5, 1);
    group.add(mist);
  });
}

function depositMarker(deposit, top) {
  const res = deposit.resource;
  const style = DEPOSIT_STYLE[res] ?? DEPOSIT_STYLE.minerais;
  const group = new THREE.Group();
  const { color, emissive, ...extra } = style;
  const mat = std(color, { emissive, roughness: res === 'eau' ? 0.1 : 0.35, metalness: res === 'minerais' ? 0.6 : 0.2, ...extra });
  if (res === 'deuterium') mat.emissiveIntensity = 1.2;
  const n = deposit.richness ?? 1;
  for (let i = 0; i < n; i++) {
    let geometry;
    if (res === 'minerais') geometry = new THREE.DodecahedronGeometry(0.09);
    else if (res === 'biomasse') geometry = new THREE.SphereGeometry(0.08, 8, 6);
    else if (res === 'deuterium') geometry = new THREE.SphereGeometry(0.075, 12, 8); // bulle de gaz
    else if (res === 'eau') geometry = new THREE.IcosahedronGeometry(0.075); // cristal de glace / goutte
    else geometry = new THREE.OctahedronGeometry(0.09);
    const m = new THREE.Mesh(geometry, mat);
    m.position.set((i - (n - 1) / 2) * 0.17, 0.09, 0);
    if (res === 'velarine' || res === 'energie') m.scale.y = 1.8;
    if (res === 'eau') {
      m.scale.set(0.8, 1.5, 0.8); // goutte étirée
      m.rotation.y = i * 0.7;
    }
    if (res === 'deuterium') m.position.y = 0.1 + (i % 2) * 0.07; // bulles qui flottent à des hauteurs différentes
    m.castShadow = true;
    group.add(m);
  }
  group.scale.setScalar(1.5);
  group.position.set(0.3, top, 0.38);
  return group;
}

// --- Bâtiments -----------------------------------------------------------------------
const ghostMaterial = new THREE.MeshBasicMaterial({ color: '#7cd8ff', wireframe: true, transparent: true, opacity: 0.55 });

function buildingMesh(type, ghost, level = 1) {
  const g = new THREE.Group();
  const m = (color, extra) => (ghost ? ghostMaterial : std(color, extra));
  const add = (geometry, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  const light = (color) => m(color, { emissive: color, emissiveIntensity: 0.8 });
  let tick = null; // animation propre au bâtiment, une fois construit
  // Appelle `fn` à intervalles réguliers (fumée, vapeur).
  const every = (period, fn) => {
    let wait = Math.random() * period;
    return (time, dt, fx) => {
      wait -= dt;
      if (wait <= 0) {
        wait = period * (0.7 + Math.random() * 0.6);
        fn(fx);
      }
    };
  };
  switch (type) {
    case 'centre':
      add(new THREE.CylinderGeometry(0.55, 0.62, 0.12, 6), m('#9aa3ad'), 0, 0.06);
      add(new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m('#e8ecf0', { metalness: 0.4, roughness: 0.35 }), 0, 0.12);
      add(new THREE.TorusGeometry(0.42, 0.03, 6, 24), light('#7cff9e'), 0, 0.14).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4), m('#555'), 0.15, 0.6, 0);
      {
        const beacon = add(new THREE.SphereGeometry(0.035, 6, 4), light('#ff5050'), 0.15, 0.86, 0);
        tick = (time) => (beacon.visible = Math.sin(time * 3) > 0);
      }
      break;
    case 'foyer':
      for (const [x, z, r] of [[-0.2, 0.1, 0.22], [0.22, 0.12, 0.18], [0, -0.22, 0.2]]) {
        add(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m('#dfe3e8', { metalness: 0.3, roughness: 0.4 }), x, 0, z);
        add(new THREE.BoxGeometry(0.08, 0.08, 0.02), light('#ffe08a'), x, 0.07, z + r - 0.01);
      }
      break;
    case 'puits':
      add(new THREE.BoxGeometry(0.4, 0.1, 0.4), m('#5b5f66'), 0, 0.05);
      add(new THREE.CylinderGeometry(0.05, 0.16, 0.8, 4, 1, true), m('#c9a24a', { metalness: 0.5 }), 0, 0.5).rotation.y = Math.PI / 4;
      add(new THREE.ConeGeometry(0.08, 0.15, 4), m('#c9a24a'), 0, 0.97);
      {
        const lamp = add(new THREE.SphereGeometry(0.03, 6, 4), light('#ffb347'), 0, 1.06);
        tick = (time) => (lamp.visible = Math.sin(time * 5) > -0.3);
      }
      break;
    case 'fonderie':
      add(new THREE.BoxGeometry(0.55, 0.28, 0.35), m('#6a5a4e'), -0.05, 0.14);
      add(new THREE.BoxGeometry(0.25, 0.2, 0.25), m('#7b6a5c'), 0.25, 0.1, 0.2);
      add(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 8), m('#3c3330'), 0.2, 0.35, -0.12);
      add(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 8), light('#ff6a1a'), 0.2, 0.71, -0.12);
      {
        // Coulée d'alliage : une rigole incandescente et des lingots qui refroidissent.
        add(new THREE.BoxGeometry(0.34, 0.04, 0.09), m('#3c3330'), -0.12, 0.02, 0.27);
        const pour = add(new THREE.BoxGeometry(0.3, 0.012, 0.05), light('#ff8a3a'), -0.12, 0.045, 0.27);
        for (const x of [-0.24, -0.12, 0]) add(new THREE.BoxGeometry(0.07, 0.035, 0.05), m('#9fb4c8', { metalness: 0.8, roughness: 0.25 }), x, 0.018, 0.38);
        const smoke = every(0.9, (fx) => fx.puff(g, 0.2, 0.75, -0.12, '#6a6460'));
        tick = (time, dt, fx) => {
          pour.material.emissiveIntensity = 0.7 + Math.sin(time * 6) * 0.25 + Math.sin(time * 13) * 0.1;
          smoke(time, dt, fx);
        };
      }
      break;
    case 'pompe': {
      // Plateforme sur pilotis, tour de pompage et réservoir sphérique de deutérium.
      add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 6), m('#6b737c', { metalness: 0.5 }), 0, 0.12);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 5), m('#3e444b'), Math.cos(a) * 0.34, 0.04, Math.sin(a) * 0.34);
      }
      add(new THREE.CylinderGeometry(0.05, 0.07, 0.62, 6), m('#9aa3ad', { metalness: 0.5 }), -0.16, 0.45, -0.08);
      add(new THREE.BoxGeometry(0.28, 0.03, 0.03), m('#5b5f66'), -0.02, 0.7, -0.08);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5), m('#5b5f66'), 0.1, 0.28, 0.12).rotation.z = 0.3;
      const tank = add(new THREE.SphereGeometry(0.17, 14, 10), m('#5fe3ff', { emissive: '#1a8aa8', emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.25 }), 0.14, 0.34, 0.08);
      add(new THREE.TorusGeometry(0.17, 0.015, 4, 20), m('#c9ced4'), 0.14, 0.34, 0.08).rotation.x = Math.PI / 2;
      const beacon = add(new THREE.SphereGeometry(0.03, 6, 4), light('#5fe3ff'), -0.16, 0.8, -0.08);
      const vent = every(1.6, (fx) => fx.puff(g, 0.14, 0.52, 0.08, '#9ff0ff'));
      tick = (time, dt, fx) => {
        beacon.visible = Math.sin(time * 2.5) > -0.2;
        tank.material.emissiveIntensity = 0.45 + Math.sin(time * 1.5) * 0.2;
        vent(time, dt, fx);
      };
      break;
    }
    case 'captage': {
      // Bassin circulaire, tuyaux et réservoir d'eau.
      add(new THREE.TorusGeometry(0.3, 0.05, 6, 20), m('#a7b0b8'), -0.08, 0.05, 0.05).rotation.x = Math.PI / 2;
      const pool = add(
        new THREE.CircleGeometry(0.28, 20),
        ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#4aa8ff', emissive: '#0a2a55', transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.2 }),
        -0.08,
        0.07,
        0.05,
      );
      pool.rotation.x = -Math.PI / 2;
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 10), m('#4aa8ff', { metalness: 0.4, roughness: 0.3 }), 0.3, 0.21, -0.22);
      add(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m('#c9ced4', { metalness: 0.5 }), 0.3, 0.42, -0.22);
      const pipe = add(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 5), m('#7d8794', { metalness: 0.6 }), 0.12, 0.08, -0.1);
      pipe.rotation.z = Math.PI / 2;
      pipe.rotation.y = 0.6;
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 5), m('#7d8794', { metalness: 0.6 }), 0.3, 0.52, -0.22);
      const level = add(new THREE.BoxGeometry(0.02, 0.2, 0.02), light('#9fe0ff'), 0.3 + 0.13, 0.21, -0.22);
      tick = (time) => {
        pool.rotation.z = time * 0.4; // l'eau tourbillonne lentement
        level.scale.y = 0.6 + 0.4 * (0.5 + Math.sin(time * 0.8) * 0.5);
      };
      break;
    }
    case 'fouille': {
      // Échafaudages, bâches, petite grue et lueur dorée de l'artefact mis au jour.
      for (const [x, z] of [[-0.3, -0.25], [-0.3, 0.2], [0.05, -0.25], [0.05, 0.2]]) add(new THREE.BoxGeometry(0.025, 0.4, 0.025), m('#a8865a'), x, 0.2, z);
      for (const y of [0.18, 0.38]) {
        add(new THREE.BoxGeometry(0.38, 0.02, 0.02), m('#a8865a'), -0.125, y, -0.25);
        add(new THREE.BoxGeometry(0.38, 0.02, 0.02), m('#a8865a'), -0.125, y, 0.2);
      }
      add(new THREE.BoxGeometry(0.4, 0.015, 0.5), m('#8a7a5a'), -0.125, 0.39, -0.025);
      const tarp = add(new THREE.PlaneGeometry(0.42, 0.3), m('#d9792b', { side: THREE.DoubleSide }), -0.125, 0.3, 0.21);
      tarp.rotation.x = 0.25;
      add(new THREE.PlaneGeometry(0.3, 0.26), m('#3f7fb0', { side: THREE.DoubleSide }), 0.06, 0.25, -0.03).rotation.y = Math.PI / 2;
      // Fosse avec l'artefact.
      add(new THREE.CylinderGeometry(0.12, 0.1, 0.02, 8), m('#4a3a2a'), 0.28, 0.01, 0.22);
      const relic = add(new THREE.OctahedronGeometry(0.05), light('#ffd166'), 0.28, 0.06, 0.22);
      // Grue : mât fixe, flèche qui pivote.
      add(new THREE.CylinderGeometry(0.02, 0.025, 0.6, 5), m('#e0b030'), 0.3, 0.3, -0.2);
      const boom = new THREE.Group();
      boom.position.set(0.3, 0.6, -0.2);
      g.add(boom);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.025), m('#e0b030'));
      arm.position.x = -0.15;
      arm.castShadow = true;
      boom.add(arm);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 3), m('#333'));
      cable.position.set(-0.36, -0.125, 0);
      boom.add(cable);
      let glow = null;
      if (!ghost) {
        glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd166', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.position.set(0.28, 0.1, 0.22);
        glow.scale.setScalar(0.45);
        g.add(glow);
      }
      tick = (time) => {
        boom.rotation.y = Math.sin(time * 0.35) * 1.1;
        relic.rotation.y = time * 1.5;
        const pulse = 0.5 + Math.sin(time * 2.2) * 0.5;
        relic.material.emissiveIntensity = 0.5 + pulse * 0.8;
        if (glow) glow.material.opacity = 0.3 + pulse * 0.45;
      };
      break;
    }
    case 'centrale': {
      const profile = [0.32, 0.24, 0.2, 0.22, 0.26].map((r, i) => new THREE.Vector2(r, i * 0.15));
      add(new THREE.LatheGeometry(profile, 14), m('#b9bec4', { side: THREE.DoubleSide }), -0.1, 0);
      add(new THREE.BoxGeometry(0.2, 0.18, 0.2), m('#7d8794'), 0.3, 0.09, 0.15);
      {
        const ring = add(new THREE.TorusGeometry(0.25, 0.02, 4, 16), light('#ffd166'), -0.1, 0.6);
        ring.rotation.x = Math.PI / 2;
        const steam = every(1.4, (fx) => fx.puff(g, -0.1, 0.65, 0, '#e8eef4'));
        tick = (time, dt, fx) => {
          ring.material.emissiveIntensity = 0.6 + Math.sin(time * 4) * 0.4;
          steam(time, dt, fx);
        };
      }
      break;
    }
    case 'solaire':
      for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) {
        add(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 4), m('#666'), x, 0.06, z);
        const panel = add(new THREE.BoxGeometry(0.36, 0.02, 0.3), m('#1d3f7a', { metalness: 0.6, roughness: 0.2, emissive: 0x0a1a3a }), x, 0.14, z);
        panel.rotation.x = -0.45;
      }
      break;
    case 'serre':
      add(new THREE.CylinderGeometry(0.48, 0.5, 0.06, 12), m('#8a9098'), 0, 0.03);
      add(new THREE.SphereGeometry(0.34, 12, 6), m('#5fbf6a', { emissive: 0x103a14 }), 0, 0.02).scale.y = 0.5;
      add(new THREE.SphereGeometry(0.46, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1 }), 0, 0.05);
      break;
    case 'ferme':
      add(new THREE.TorusGeometry(0.4, 0.06, 6, 20), m('#d0d4d8'), 0, 0.08).rotation.x = Math.PI / 2;
      {
        const nets = new THREE.Group();
        g.add(nets);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const net = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.1), m('#4fae5a', { emissive: 0x0a3010 }));
          net.position.set(Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2);
          net.rotation.y = -a;
          nets.add(net);
        }
        tick = (time) => (nets.rotation.y = time * 0.3);
      }
      add(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m('#e8ecf0'), 0, 0.08);
      break;
    case 'laboratoire': {
      // Bloc de laboratoire, coupole d'observation vitrée, antenne parabolique qui balaie le ciel.
      add(new THREE.BoxGeometry(0.5, 0.06, 0.42), m('#6b737c'), 0, 0.03);
      add(new THREE.BoxGeometry(0.42, 0.22, 0.34), m('#dfe3e8', { metalness: 0.3, roughness: 0.45 }), -0.04, 0.17);
      // Bandeau de fenêtres et anneau lumineux qui pulsent en cyan.
      const windows = add(new THREE.BoxGeometry(0.43, 0.035, 0.345), light('#7ff0ff'), -0.04, 0.2);
      add(new THREE.CylinderGeometry(0.13, 0.14, 0.05, 12), m('#9aa3ad', { metalness: 0.4 }), -0.1, 0.305, 0);
      add(
        new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#9fe8ff', emissive: '#0b3a48', transparent: true, opacity: 0.6, roughness: 0.05, metalness: 0.2 }),
        -0.1,
        0.33,
        0,
      );
      const scope = add(new THREE.CylinderGeometry(0.018, 0.026, 0.16, 6), m('#3e444b'), -0.1, 0.38, 0);
      scope.rotation.z = 0.6;
      const ring = add(new THREE.TorusGeometry(0.135, 0.012, 4, 20), light('#5fe3ff'), -0.1, 0.33, 0);
      ring.rotation.x = Math.PI / 2;
      // Mât et parabole : la tête pivote lentement sur son axe.
      add(new THREE.CylinderGeometry(0.02, 0.028, 0.32, 5), m('#7d8794', { metalness: 0.6 }), 0.2, 0.44, 0.08);
      const head = new THREE.Group();
      head.position.set(0.2, 0.6, 0.08);
      g.add(head);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 6, 0, Math.PI * 2, 0, Math.PI / 3.2), m('#e8ecf0', { metalness: 0.5, roughness: 0.3, side: THREE.DoubleSide }));
      dish.rotation.x = -Math.PI / 2 - 0.5; // creux tourné vers le ciel, un peu incliné
      dish.position.set(0, 0.05, 0.1);
      dish.castShadow = true;
      head.add(dish);
      const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 3), m('#555'));
      feed.rotation.x = 0.5;
      feed.position.set(0, 0.06, -0.02);
      head.add(feed);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), light('#7ff0ff'));
      tip.position.set(0, 0.12, -0.05);
      head.add(tip);
      let glow = null;
      if (!ghost) {
        glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#5fe3ff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.position.set(-0.1, 0.4, 0);
        glow.scale.setScalar(0.5);
        g.add(glow);
      }
      tick = (time) => {
        head.rotation.y = time * 0.45 + Math.sin(time * 0.9) * 0.4;
        const pulse = 0.5 + Math.sin(time * 2) * 0.5;
        ring.material.emissiveIntensity = 0.4 + pulse * 0.9;
        windows.material.emissiveIntensity = 0.5 + pulse * 0.4;
        tip.visible = Math.sin(time * 4) > -0.4;
        if (glow) glow.material.opacity = 0.2 + pulse * 0.4;
      };
      break;
    }
    case 'siphon':
      add(new THREE.CylinderGeometry(0.25, 0.32, 0.12, 8), m('#4a4458'), 0, 0.06);
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), m('#6a6478', { metalness: 0.6 }), 0, 0.4);
      {
        const crystal = add(new THREE.OctahedronGeometry(0.12), light('#c77dff'), 0, 0.8);
        crystal.scale.y = 1.6;
        tick = (time) => {
          crystal.rotation.y = time;
          crystal.position.y = 0.8 + Math.sin(time * 2) * 0.04;
        };
      }
      break;
    case 'batterie': {
      // Batterie planétaire : socle hexagonal, tourelle qui pivote lentement, double canon, feu rouge.
      add(new THREE.CylinderGeometry(0.4, 0.46, 0.1, 6), m('#5b5f66', { metalness: 0.4 }), 0, 0.05);
      add(new THREE.CylinderGeometry(0.26, 0.32, 0.12, 8), m('#7d8794', { metalness: 0.5 }), 0, 0.16);
      add(new THREE.TorusGeometry(0.3, 0.018, 4, 18), light('#ff4a4a'), 0, 0.11).rotation.x = Math.PI / 2;
      const head = new THREE.Group();
      head.position.set(0, 0.22, 0);
      g.add(head);
      const part = (geometry, material, x, y, z) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        head.add(mesh);
        return mesh;
      };
      part(new THREE.BoxGeometry(0.3, 0.16, 0.34), m('#9aa3ad', { metalness: 0.55, roughness: 0.4 }), 0, 0.08, 0);
      part(new THREE.BoxGeometry(0.22, 0.05, 0.2), m('#6b737c', { metalness: 0.5 }), 0, 0.18, -0.04);
      // Canons : un pivot d'élévation porte les deux tubes.
      const cradle = new THREE.Group();
      cradle.position.set(0, 0.1, 0.14);
      head.add(cradle);
      for (const x of [-0.06, 0.06]) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.42, 6), m('#3e444b', { metalness: 0.7, roughness: 0.3 }));
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(x, 0, 0.2);
        barrel.castShadow = true;
        cradle.add(barrel);
        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 6), light('#ff5050'));
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(x, 0, 0.41);
        cradle.add(muzzle);
      }
      const eye = part(new THREE.SphereGeometry(0.035, 8, 6), light('#ff3030'), 0.1, 0.13, 0.17);
      let glow = null;
      if (!ghost) {
        glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff3a3a', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.position.set(0, 0.38, 0);
        glow.scale.setScalar(0.5);
        g.add(glow);
      }
      const phase = Math.random() * 10;
      tick = (time) => {
        const t = time + phase;
        head.rotation.y = t * 0.25 + Math.sin(t * 0.5) * 0.6;
        cradle.rotation.x = -0.25 - Math.sin(t * 0.7) * 0.2;
        const pulse = 0.5 + Math.sin(t * 3) * 0.5;
        eye.material.emissiveIntensity = 0.4 + pulse;
        if (glow) glow.material.opacity = 0.2 + pulse * 0.35;
      };
      break;
    }
  }
  // Niveau : le bâtiment grandit un peu, et une petite borne porte 1 à 4 barres lumineuses.
  if (!ghost && isUpgradable(type)) {
    g.scale.setScalar(1 + 0.07 * (level - 1));
    const color = LEVEL_COLORS[Math.min(level, MAX_LEVEL) - 1];
    const barMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4 });
    const post = new THREE.Group();
    post.position.set(-0.5, 0, -0.42);
    post.scale.setScalar(1 / g.scale.x); // la borne garde la même taille quel que soit le niveau
    g.add(post);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06 + level * 0.06, 0.035), std('#3e444b'));
    pole.position.y = (0.06 + level * 0.06) / 2;
    post.add(pole);
    for (let i = 0; i < level; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.06), barMat);
      bar.position.set(0.05, 0.05 + i * 0.06, 0);
      post.add(bar);
    }
    const base = tick;
    tick = (time, dt, fx) => {
      base?.(time, dt, fx);
      barMat.emissiveIntensity = 0.7 + Math.sin(time * 2.2) * 0.3;
    };
  }
  if (!ghost) g.userData.tick = tick;
  return g;
}

// --- La vue --------------------------------------------------------------------------
export function createPlanetView(root, game, actions) {
  root.innerHTML = `
    <div class="pv-sky"></div>
    <div class="planet-canvas"></div>
    <aside class="panel planet-panel" id="pv-colony"><div id="pv-colony-live"></div><div id="pv-yard"></div></aside>
    <aside class="panel planet-panel tile-panel" id="pv-tile"></aside>
    <button class="back" data-pv="close">← Retour à l'amas <kbd>Échap</kbd></button>
    <div class="tooltip pv-tooltip"></div>`;
  const host = root.querySelector('.planet-canvas');
  const sky = root.querySelector('.pv-sky');
  const tooltip = root.querySelector('.pv-tooltip');
  const $ = (id) => root.querySelector(`#${id}`);

  let renderer = null;
  let scene;
  let camera;
  let controls;
  let board = null;
  let state = null;
  const clock = new THREE.Clock();
  const noise = noiseTexture();
  const raycaster = new THREE.Raycaster();

  function ensureRenderer() {
    if (renderer) return;
    // Fond transparent : le décor CSS (.pv-sky) se voit derrière le plateau.
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = 1.2;
    bindPointer();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!renderer || root.hidden) return;
    renderer.setSize(host.clientWidth, host.clientHeight);
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
  }

  function buildScene() {
    if (board) scene.remove(board);
    scene.clear();
    const { star, planet, surface } = state;
    const tint = SKY_TINTS[planet.type] ?? '#3a6ea5';
    root.dataset.planetType = SKY_TINTS[planet.type] ? planet.type : 'tempere';
    sky.innerHTML = skyMarkup(planet, star.id * 7919 + state.planetIndex * 131 + 7);
    scene.background = null;
    // Brouillard discret, couleur du bas du ciel : il ne touche que le lointain (anneaux, dock).
    const dist = surface.radius * 4.2 + 6;
    scene.fog = new THREE.Fog(new THREE.Color(tint).multiplyScalar(0.22), dist * 1.3, dist * 4);
    scene.add(new THREE.HemisphereLight(new THREE.Color(tint).lerp(new THREE.Color('#ffffff'), 0.5), '#2a2018', 1.1));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.6);
    sun.position.set(8, 14, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const extent = (surface.radius + 2) * 2;
    Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 50 });
    scene.add(sun);

    board = new THREE.Group();
    scene.add(board);
    const slabRadius = surface.radius * SQRT3 * HEX + 0.2; // les cases du bord débordent : les cascades tombent dans le vide
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(slabRadius, slabRadius * 0.92, 0.8, 6), std('#1c1916'));
    slab.position.y = -0.4;
    slab.rotation.y = Math.PI / 6;
    slab.receiveShadow = true;
    board.add(slab);

    state.fx = createSurfaceFx();
    state.tileViews = surface.tiles.map((tile) => {
      const terrain = TERRAINS[tile.terrain];
      const height = terrain.height;
      const color = new THREE.Color(terrain.color).offsetHSL(0, 0, ((tile.index * 37) % 11) / 220 - 0.025);
      const mesh = new THREE.Mesh(hexGeometry(height), std(color, { map: noise }));
      const pos = hexToWorld(tile.q, tile.r);
      mesh.position.set(pos.x, height / 2, pos.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.userData.tile = tile;
      board.add(mesh);

      const decor = new THREE.Group();
      decor.position.copy(pos);
      board.add(decor);
      if (tile.terrain === 'ocean') {
        const water = new THREE.Mesh(hexGeometry(0.04), state.fx.water);
        water.position.y = height + 0.04;
        decor.add(water);
        addWaterfalls(decor, tile, surface, height + 0.06, state.fx);
      }
      addDecor(decor, tile, height, state.fx);
      if (tile.deposit && star.level >= 3) decor.add(depositMarker(tile.deposit, height + (tile.terrain === 'ocean' ? 0.06 : 0)));
      return { tile, mesh, decor, top: height + (tile.terrain === 'ocean' ? 0.06 : 0), buildingKey: '', building: null };
    });

    const outline = hexGeometry(0.02).clone();
    state.selection = new THREE.LineSegments(new THREE.EdgesGeometry(outline), new THREE.LineBasicMaterial({ color: '#ffffff' }));
    state.selection.visible = false;
    board.add(state.selection);

    camera.position.set(0, dist * 0.8, dist * 0.75);
    controls.target.set(0, 0, 0);
    controls.minDistance = 3;
    controls.maxDistance = dist * 1.8;
    state.orbitKey = null;
    state.orbit = null;
    syncBuildings();
    syncOrbitals();
  }

  function syncOrbitals() {
    const { colony, surface } = state;
    const key = colony ? `${colony.orbital.dock}:${colony.orbital.defense}:${!!colony.orbital.ecope}` : '';
    if (key === state.orbitKey) return;
    state.orbitKey = key;
    if (state.orbit) scene.remove(state.orbit);
    state.orbit = new THREE.Group();
    scene.add(state.orbit);
    if (!colony) return;
    const R = surface.radius;
    if (colony.orbital.dock) {
      const dock = new THREE.Group();
      dock.add(new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.14, 8, 32), std('#c9ced4', { metalness: 0.6, roughness: 0.35 })));
      dock.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 10), std('#8e9aa8', { metalness: 0.5 })));
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.12), std('#5b5f66'));
        arm.position.x = 0.7;
        const holder = new THREE.Group();
        holder.add(arm);
        holder.rotation.z = (i / 4) * Math.PI * 2;
        dock.add(holder);
      }
      const lights = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.03, 4, 32), new THREE.MeshBasicMaterial({ color: '#7cff9e' }));
      lights.position.z = 0.15;
      dock.add(lights);
      dock.position.set(R * 1.5, 2.6, -R * 0.8);
      dock.rotation.x = Math.PI / 2.4;
      dock.userData.spin = 0.25;
      state.orbit.add(dock);
    }
    if (colony.orbital.ecope) {
      // Écope gazeuse : un entonnoir qui tourne au-dessus du plateau en traînant du gaz cyan.
      // Le groupe tourne autour de son axe z local, redressé à la verticale.
      const carousel = new THREE.Group();
      carousel.position.set(0, 4.2, 0);
      carousel.rotation.x = -Math.PI / 2;
      carousel.userData.spin = 0.18;
      const upright = new THREE.Group();
      upright.rotation.x = Math.PI / 2; // repère local y vers le haut
      carousel.add(upright);
      const radius = R * 1.25 + 1;
      const scoop = new THREE.Group();
      const profile = [[0.08, -0.9], [0.14, -0.5], [0.3, -0.1], [0.75, 0.45], [0.82, 0.5]].map(([r, y]) => new THREE.Vector2(r, y));
      scoop.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 16), std('#b9c4cf', { metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide })));
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: '#5fe3ff' }));
      lip.position.y = 0.48;
      lip.rotation.x = Math.PI / 2;
      scoop.add(lip);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 8), std('#5b6470', { metalness: 0.5 }));
      core.position.y = -1.1;
      scoop.add(core);
      const tank = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), std('#5fe3ff', { emissive: '#1a8aa8', emissiveIntensity: 0.8, roughness: 0.25 }));
      tank.position.y = -1.45;
      scoop.add(tank);
      // Embouchure tournée vers l'avant du mouvement (tangente au cercle).
      scoop.position.set(radius, 0, 0);
      scoop.rotation.x = -Math.PI / 2;
      upright.add(scoop);
      // Traînée : des halos cyan de plus en plus pâles le long de l'arc parcouru.
      for (let i = 1; i <= 14; i++) {
        const a = -i * 0.07;
        const puff = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: glowTexture(), color: '#5fe3ff', transparent: true, opacity: 0.55 * (1 - i / 15), depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        puff.position.set(Math.cos(a) * radius, Math.sin(i * 1.7) * 0.08, -Math.sin(a) * radius);
        puff.scale.setScalar(0.9 + i * 0.12);
        upright.add(puff);
      }
      state.orbit.add(carousel);
    }
    for (let i = 0; i < colony.orbital.defense; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 1.9 + i * 0.6, 0.05, 6, 90), new THREE.MeshBasicMaterial({ color: '#ff8a8a', transparent: true, opacity: 0.55 }));
      ring.position.y = 3.5 + i * 0.5;
      ring.rotation.x = Math.PI / 2 + 0.25 * (i - 1);
      ring.userData.spin = 0.1 * (i % 2 ? -1 : 1);
      state.orbit.add(ring);
      for (let k = 0; k < 3; k++) {
        const sat = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), std('#e0e4ea', { emissive: '#ff5050', emissiveIntensity: 0.4 }));
        const a = (k / 3) * Math.PI * 2;
        sat.position.set(Math.cos(a) * (R * 1.9 + i * 0.6), Math.sin(a) * (R * 1.9 + i * 0.6), 0);
        ring.add(sat);
      }
    }
  }

  function syncBuildings() {
    for (const view of state.tileViews) {
      const b = view.tile.building;
      const key = b ? `${b.type}:${b.done}:${levelOf(b)}` : '';
      if (key === view.buildingKey) continue;
      if (view.building) view.decor.remove(view.building);
      view.building = null;
      view.buildingKey = key;
      if (!b) continue;
      view.building = buildingMesh(b.type, !b.done, levelOf(b));
      view.building.position.y = view.top;
      view.decor.add(view.building);
    }
  }

  // --- Interaction -----------------------------------------------------------------
  function tileAt(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(state.tileViews.map((v) => v.mesh))[0];
    return hit ? hit.object.userData.tile : null;
  }

  function setHovered(tile) {
    if (state.hovered === tile) return;
    if (state.hovered) state.tileViews[state.hovered.index].mesh.material.emissive.setHex(0x000000);
    state.hovered = tile;
    if (tile) state.tileViews[tile.index].mesh.material.emissive.setHex(0x2a2a2a);
  }

  function bindPointer() {
    let down = null;
    const el = renderer.domElement;
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (!down || e.button !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      selectTile(tileAt(e));
    });
    el.addEventListener('pointermove', (e) => {
      const tile = tileAt(e);
      setHovered(tile);
      el.style.cursor = tile ? 'pointer' : '';
      if (!tile) {
        tooltip.style.display = 'none';
        return;
      }
      const parts = [TERRAINS[tile.terrain].label];
      if (tile.deposit && state.star.level >= 3) parts.push(`G${depositName(tile.deposit.resource).slice(1)}`);
      if (tile.building) {
        const lvl = isUpgradable(tile.building.type) && tile.building.done ? ` · niv. ${levelOf(tile.building)}` : '';
        parts.push((BUILDINGS[tile.building.type]?.label ?? tile.building.type) + (tile.building.done ? lvl : ' (en construction)'));
      }
      tooltip.innerHTML = parts.map((p, i) => (i ? `<span>${p}</span>` : `<strong>${p}</strong>`)).join('');
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.clientX + 14}px`;
      tooltip.style.top = `${e.clientY + 12}px`;
    });
    el.addEventListener('pointerleave', () => {
      setHovered(null);
      tooltip.style.display = 'none';
    });
  }

  function selectTile(tile) {
    state.selected = tile;
    state.selection.visible = !!tile;
    if (tile) {
      const view = state.tileViews[tile.index];
      state.selection.position.set(view.mesh.position.x, view.top + 0.01, view.mesh.position.z);
    }
    renderTilePanel();
  }

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-pv]');
    if (!el) return;
    el.blur();
    const action = el.dataset.pv;
    if (action === 'close') actions.onClosePlanet();
    else if (action === 'build') actions.onBuild(state.colony, state.surface, state.selected, el.dataset.type);
    else if (action === 'demolish') actions.onDemolish(state.colony, state.surface, state.selected);
    else if (action === 'upgrade') actions.onUpgrade?.(state.colony, state.surface, state.selected);
    else if (action === 'found') actions.onFoundColony(state.founding, state.star.id, state.planetIndex, state.selected.index);
    else if (action === 'shipyard') actions.onShipyard(state.colony, el.dataset.key);
  });

  // --- Panneaux --------------------------------------------------------------------
  // Pastilles « icône + nombre » ; le détail en texte reste dans l'infobulle.
  const chip = (name, value, title, cls = '') => `<span class="chip ${cls}" title="${title}">${icon(name)}${value}</span>`;

  const costChips = (cost, days) =>
    Object.entries(cost)
      .map(([res, n]) => chip(res, n, `Coût : ${n} ${resLabel(res).toLowerCase()}`, `res-${res}`))
      .join('') + chip('jours', `${days} j`, `Durée : ${days} jours`);

  function gainChips(gains, perDay = true) {
    const parts = [];
    for (const res of RESOURCES) {
      const v = gains[res] ?? 0;
      if (Math.abs(v) >= 0.05) parts.push(chip(res, fmt(v), `${fmt(v)} ${resLabel(res).toLowerCase()}${perDay ? ' par jour' : ''}`, `res-${res} ${v > 0 ? 'up' : 'down'}`));
    }
    if (gains.housing) parts.push(chip('places', `+${gains.housing}`, `+${gains.housing} places de population`, 'up'));
    if (gains.workers) parts.push(chip('colon', gains.workers, `Demande ${gains.workers} colon`));
    return parts.join('');
  }

  // Défense apportée par une batterie planétaire (5 par niveau, cf. economy.js).
  const defenseChip = (type, levels) =>
    type === 'batterie' ? chip('defense', `+${5 * levels}`, `+${5 * levels} de défense de la colonie`, 'up res-defense') : '';

  const richnessDots = (n) => `<span class="dots">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

  // Titre de rubrique suivi d'un filet qui s'estompe.
  const section = (title) => `<div class="pv-sec"><span>${title}</span><i></i></div>`;

  // Jauge horizontale : icône, libellé, barre, « valeur / maximum ».
  function gauge(iconHtml, label, value, max, ratio, cls = '', title = '') {
    const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
    return `<div class="pv-gauge ${cls}"${title ? ` title="${title}"` : ''}><span class="pv-gi">${iconHtml}</span><span class="pv-gl">${label}</span><span class="pv-bar"><i style="width:${pct}%"></i></span><span class="pv-gv">${value}<small> / ${max}</small></span></div>`;
  }

  // Chantier en cours : anneau de progression autour de l'icône, jours restants à droite.
  function jobCard(iconHtml, label, done, daysLeft) {
    const C = 2 * Math.PI * 19;
    const pct = Math.round(Math.max(0, Math.min(1, done)) * 100);
    const days = Math.ceil(daysLeft);
    return `
      <div class="pv-job">
        <div class="pv-ring"><svg viewBox="0 0 46 46" aria-hidden="true"><circle cx="23" cy="23" r="19" class="track"/><circle cx="23" cy="23" r="19" class="fill" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}" transform="rotate(-90 23 23)"/></svg>${iconHtml}</div>
        <div class="pv-job-text"><b>${label}</b><span>${pct} % construit</span></div>
        <div class="pv-job-days"><b>${days} j</b><span>restant${days > 1 ? 's' : ''}</span></div>
      </div>`;
  }

  // Tuile de production : grosse icône et valeur par jour.
  function prodTile(res, value, label) {
    value ??= 0;
    const cls = value < -0.05 ? ' down' : '';
    return `<div class="pv-prod res-${res}${cls}" title="${fmt(value)} ${resLabel(res).toLowerCase()} par jour">${icon(res)}<div><b>${fmt(value)}</b><span>${label}</span></div></div>`;
  }

  function renderColonyPanel() {
    const { star, planet, colony, surface } = state;
    const type = PLANET_TYPES[planet.type];
    let html = `
      <div class="pv-head">
        <span class="pv-orb"></span>
        <div class="pv-title"><h2 class="pv-name">${planet.name}</h2><div class="pv-sub">${type.label} · ${planet.size}, ${PLANET_SIZES[planet.size]} hexagones · système ${star.name}</div></div>
      </div>`;
    if (!colony && state.founding !== null) {
      html += '<p class="founding">Choisissez la case où poser la colonie : une case de terre, sans gisement de minerais ni de Vélarine. Le centre colonial y sera installé.</p>';
    } else if (!colony) {
      html += '<p class="muted">Planète non colonisée. Une Arche ou un vaisseau colonie peut y fonder une colonie.</p>';
      if (star.level < 3) html += '<p class="muted small">Analysez le système pour voir ses gisements.</p>';
    } else {
      const r = colonyReport(colony, surface);
      const working = Math.min(colony.population, r.workers);
      const free = r.energyProd - r.energyUse;
      html += section('Colonie');
      html += gauge(icon('colon'), 'Population', colony.population, r.housing, r.housing ? colony.population / r.housing : 0, 'pop', 'Population / logements');
      html += gauge(TOOL_ICON, 'Colons au travail', working, r.workers, r.workers ? working / r.workers : 0, `work${r.staffing < 1 ? ' warn' : ''}`, 'Colons au travail / colons demandés');
      html += gauge(icon('energie'), 'Énergie', r.energyUse, fmt(r.energyProd, false), r.energyProd > 0 ? r.energyUse / r.energyProd : r.energyUse ? 1 : 0, `nrj${r.power < 1 ? ' warn' : ''}`, 'Énergie utilisée / produite');
      html += `<div class="pv-note">${fmt(r.energyProd, false)} produite${r.energyProd >= 1.5 ? 's' : ''}, ${r.energyUse} utilisée${r.energyUse > 1 ? 's' : ''} : ${
        free >= -0.05 ? `<span class="ok">${fmt(free, false)} libre${free >= 1.5 ? 's' : ''}</span>` : `<span class="bad">manque ${fmt(-free, false)}</span>`
      }</div>`;

      html += section('Production par jour');
      // Minerais et biomasse toujours ; les autres seulement quand ils bougent.
      let prods = prodTile('minerais', r.perDay.minerais, 'Minerais') + prodTile('biomasse', r.perDay.biomasse, 'Biomasse (après repas)');
      for (const res of ['alliages', 'eau', 'deuterium', 'velarine', 'recherche']) {
        const v = r.perDay[res] ?? 0;
        if (Math.abs(v) >= 0.05) prods += prodTile(res, v, res === 'eau' ? 'Eau (après boisson)' : res === 'recherche' ? 'Recherche' : resLabel(res));
      }
      html += `<div class="pv-prods">${prods}</div>`;

      const alerts = [];
      if (r.staffing < 1) alerts.push('Pas assez de colons : les bâtiments tournent au ralenti. Construisez des foyers.');
      if (r.power < 1) alerts.push("Pas assez d'énergie : les bâtiments qui en consomment ralentissent.");
      if (colony.famine) alerts.push('Famine : la biomasse est épuisée.');
      if (colony.thirst) alerts.push("Pénurie d'eau : la population ne grandit plus.");
      html += alerts.map((a) => `<p class="alert pv-alert">${WARN_ICON}<span>${a}</span></p>`).join('');

      html += section('Chantier');
      if (colony.construction) {
        const c = colony.construction;
        const def = BUILDINGS[c.type];
        if (c.upgrade) {
          const total = ECO.upgradeDays?.(c.type, (c.toLevel ?? 2) - 1) ?? def.days;
          html += jobCard(icon(c.type), `Amélioration : ${def.label} → niv. ${c.toLevel ?? '?'}`, 1 - c.daysLeft / total, c.daysLeft).replace('% construit', '% amélioré');
        } else {
          html += jobCard(icon(c.type), def.label, 1 - c.daysLeft / def.days, c.daysLeft);
        }
      } else {
        html += '<p class="muted small pv-empty">Aucun chantier. Cliquez sur une case pour construire.</p>';
      }
      if (colony.shipyard) {
        const order = SHIPYARD[colony.shipyard.key];
        html += section('Chantier spatial');
        html += jobCard(yardIcon(colony.shipyard.key), order.label, 1 - colony.shipyard.daysLeft / (colony.shipyard.total ?? order.days), colony.shipyard.daysLeft);
      }
      const orbit = [];
      const defense = GAME.colonyDefense?.(game, colony);
      if (defense !== undefined) {
        const value = Math.round(defense * 10) / 10;
        orbit.push(
          `<span class="chip pv-defense${value > 0 ? '' : ' none'}" title="Défense de la colonie : anneaux de défense et batteries planétaires">${icon('defense') || YARD_ICONS.defense}Défense ${String(value).replace('.', ',')}</span>`,
        );
      }
      if (colony.orbital.dock) orbit.push(`<span class="chip">${YARD_ICONS.dock}Dock spatial</span>`);
      if (colony.orbital.ecope) orbit.push(`<span class="chip">${YARD_ICONS.ecope}Écope gazeuse</span>`);
      if (colony.orbital.defense) orbit.push(`<span class="chip">${YARD_ICONS.defense}${colony.orbital.defense} anneau${colony.orbital.defense > 1 ? 'x' : ''} de défense</span>`);
      if (orbit.length) html += `<div class="pv-orbit"><span class="muted small">${orbit.length > 1 || defense === undefined ? 'Défense et orbite' : 'Défense'}</span>${orbit.join('')}</div>`;
    }
    $('pv-colony-live').innerHTML = html;
  }

  // Commandes du chantier spatial. Les boutons ne sont recréés qu'après un événement ;
  // chaque jour, refreshButtons met seulement à jour leur état.
  function renderYard() {
    const { colony } = state;
    if (!colony) {
      $('pv-yard').innerHTML = '';
      return;
    }
    let html = section('Commandes spatiales');
    if (!state.surface.tiles.some((t) => t.building?.type === 'spatioport' && t.building.done)) {
      $('pv-yard').innerHTML = `${html}<p class="muted small">Construisez un spatioport (sur une plaine ou un désert) pour lancer des sondes, un dock spatial et des défenses.</p>`;
      return;
    }
    // Liste compacte : la description passe dans l'infobulle ; le motif de refus
    // (`.reason`, juste après le bouton) est rempli chaque jour par refreshButtons.
    const groups = new Map(YARD_CATEGORIES.map(([cat]) => [cat, []]));
    for (const [key, order] of Object.entries(SHIPYARD)) {
      const cat = order.category ?? (order.kind === 'orbital' ? 'orbital' : 'civil');
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push([key, order]);
    }
    const labels = Object.fromEntries(YARD_CATEGORIES);
    for (const [cat, orders] of groups) {
      if (!orders.length) continue;
      html += `<div class="yard-cat">${labels[cat] ?? cat}</div>`;
      for (const [key, order] of orders) {
        const kind = GAME.SHIP_KINDS?.[key];
        const size = kind?.size ?? order.size;
        const sizeLabel = size ? GAME.SIZE_LABELS?.[size] ?? size : '';
        const war = cat === 'guerre' || kind?.warship;
        const cost = Object.entries(order.cost ?? {})
          .map(([res, n]) => `${n} ${resLabel(res).toLowerCase()}`)
          .join(', ');
        const details = [`${order.label}${sizeLabel ? ` (taille : ${sizeLabel.toLowerCase()})` : ''}`, order.desc, `Coût : ${cost}. Durée : ${GAME.shipyardDays(key)} jours.`];
        if (war && kind) details.push(`Attaque ${kind.attack ?? 0}, défense ${kind.defense ?? 0} (avant bonus de recherche).`);
        const stats = war && kind
          ? `<span class="yard-stat atk" title="Attaque de base">${icon('attaque')}${kind.attack ?? 0}</span><span class="yard-stat def" title="Défense de base">${icon('defense')}${kind.defense ?? 0}</span>`
          : '';
        html += `
          <div class="yard-option" title="${details.join('\n').replace(/"/g, '&quot;')}">
            <span class="yard-icon">${yardIcon(key)}</span>
            <b class="yard-name">${order.label}</b>
            ${sizeLabel ? `<span class="yard-size size-${size}">${sizeLabel}</span>` : ''}
            ${stats}
            <span class="yard-days">${GAME.shipyardDays(key)} j</span>
            <button class="primary" data-pv="shipyard" data-key="${key}">Lancer</button><span class="reason"></span>
          </div>`;
      }
    }
    $('pv-yard').innerHTML = html;
    refreshButtons();
  }

  function refreshButtons() {
    if (!state?.colony) return;
    for (const button of root.querySelectorAll('[data-pv="shipyard"]')) {
      const problem = shipyardProblem(game, state.colony, button.dataset.key);
      button.disabled = !!problem;
      button.nextElementSibling.textContent = problem ?? '';
    }
    for (const card of root.querySelectorAll('[data-pv="build"]')) {
      const def = BUILDINGS[card.dataset.type];
      const problem = state.colony.construction ? 'Chantier en cours' : !canAfford(game.resources, def.cost) ? 'Ressources insuffisantes' : '';
      card.disabled = !!problem;
      card.querySelector('.reason').textContent = problem;
    }
    const upgrade = root.querySelector('[data-pv="upgrade"]');
    if (upgrade && state.selected) {
      const problem = ECO.upgradeProblem ? ECO.upgradeProblem(game, state.colony, state.surface, state.selected) : 'Bientôt disponible';
      upgrade.disabled = !!problem;
      upgrade.parentElement.querySelector('.reason').textContent = problem ?? '';
    }
  }

  // Niveau d'un bâtiment construit : crans, puis carte d'amélioration ou recherche manquante.
  function levelBlock(tile) {
    const { colony, surface } = state;
    const b = tile.building;
    const level = levelOf(b);
    const max = maxLevelNow();
    const notches = Array.from({ length: MAX_LEVEL }, (_, i) => `<i class="${i < level ? 'on' : i < max ? 'open' : ''}"></i>`).join('');
    let html = `<div class="pv-level lvl-${Math.min(level, MAX_LEVEL)}" title="Niveau ${level} sur ${max} possible${max > 1 ? 's' : ''} (4 au plus avec la recherche)">${icon('niveau')}<span>Niv. <b>${level}</b> / ${max}</span><span class="pv-notches">${notches}</span></div>`;
    const c = colony.construction;
    if (c?.upgrade && c.tileIndex === tile.index) {
      html += `<p class="muted small pv-upnote">Amélioration en cours vers le niveau ${c.toLevel ?? level + 1} : ${Math.ceil(c.daysLeft)} j restant${Math.ceil(c.daysLeft) > 1 ? 's' : ''}.</p>`;
    } else if (level >= MAX_LEVEL) {
      html += '<p class="muted small pv-upnote">Niveau maximal atteint.</p>';
    } else if (level >= max) {
      const tech = TECHS[LEVEL_TECHS[level - 1]]?.label ?? LEVEL_TECHS[level - 1];
      html += `<div class="pv-uplock">${LOCK_ICON}<span>Niveau ${level + 1} : <b>Recherche : ${tech}</b></span></div>`;
    } else {
      const gains = ECO.previewUpgrade?.(colony, surface, tile) ?? {};
      const cost = ECO.upgradeCost?.(b.type, level) ?? {};
      const days = ECO.upgradeDays?.(b.type, level) ?? '?';
      const gainHtml = gainChips(gains);
      const defHtml = defenseChip(b.type, 1);
      html += `
        <div class="pv-upgrade">
          <div class="pv-up-title">${icon('niveau')}<b>Améliorer au niveau ${level + 1}</b></div>
          ${gainHtml || defHtml ? `<div class="chips">${gainHtml}${gainHtml ? '<span class="muted small">/ jour</span>' : ''}${defHtml}</div>` : ''}
          <div class="chips cost">${costChips(cost, days)}</div>
          <button class="primary" data-pv="upgrade">Améliorer</button>
          <span class="reason"></span>
        </div>`;
    }
    return html;
  }

  function renderTilePanel() {
    const { selected: tile, colony, surface, star } = state;
    if (!tile) {
      $('pv-tile').innerHTML = "<p class=\"muted\">Cliquez sur une case pour voir son terrain et ce qu'on peut y construire.</p>";
      return;
    }
    const terrain = TERRAINS[tile.terrain];
    let html = `<div class="tile-head"><i class="swatch" style="background:${terrain.color}"></i><h2>${terrain.label}</h2></div>`;
    if (tile.deposit && star.level >= 3) {
      const d = tile.deposit;
      const exploited = tile.building && BUILDINGS[tile.building.type].deposit;
      html += `<div class="deposit-line res-${d.resource}" title="G${depositName(d.resource).slice(1)} ${RICHNESS[d.richness]}">${icon(d.resource)}<span>G${depositName(d.resource).slice(1)}</span>${richnessDots(d.richness)}${exploited ? `<span class="muted small">${Math.round(tile.yield * 100)} %</span>` : ''}</div>`;
    }
    if (!colony && state.founding !== null) {
      const ok = tile.terrain !== 'ocean' && !['minerais', 'velarine'].includes(tile.deposit?.resource);
      html += ok
        ? `<button class="primary found-btn" data-pv="found">${icon('centre')}Poser la colonie ici</button>`
        : '<p class="muted small">Choisissez une case de terre sans gisement de minerais ni de Vélarine.</p>';
    } else if (tile.building) {
      const def = BUILDINGS[tile.building.type];
      html += `<div class="building-line" title="${def.desc}"><span class="big-icon">${icon(tile.building.type)}</span><div><b>${def.label}</b>${tile.building.done ? '' : '<div class="muted small">en construction</div>'}</div></div>`;
      if (tile.building.done && colony) {
        const out = colonyReport(colony, surface).perTile.get(tile.index) || {};
        const gains = Object.fromEntries(RESOURCES.map((res) => [res, out[res] || 0]));
        gains.energie -= def.energy || 0;
        const chips = gainChips(gains);
        const housing = (def.housing ? gainChips({ housing: def.housing * levelOf(tile.building) }) : '') + defenseChip(tile.building.type, levelOf(tile.building));
        if (chips || housing) html += `<div class="chips">${chips}${chips ? '<span class="muted small">/ jour</span>' : ''}${housing}</div>`;
      }
      if (tile.building.type === 'fouille' && tile.building.done) {
        // Fouille : artefacts restant à trouver et avancement vers le prochain.
        const left = tile.building.left ?? 0;
        const dig = Math.max(0, Math.min(1, tile.building.dig ?? 0));
        html += left > 0
          ? `<div class="pv-dig res-artefacts" title="Artefacts restant à mettre au jour">${icon('artefacts')}<span>${left} artefact${left > 1 ? 's' : ''} à trouver</span><span class="pv-bar"><i style="width:${Math.round(dig * 100)}%"></i></span><b>${Math.round(dig * 100)} %</b></div>`
          : '<p class="muted small">Le site est épuisé : plus aucun artefact à trouver.</p>';
      }
      if (tile.building.done && colony && isUpgradable(tile.building.type)) html += levelBlock(tile);
      if (def.buildable !== false && colony) html += `<button class="icon-btn" data-pv="demolish" title="Démolir (rembourse la moitié du coût)">${icon('demolir')}Démolir</button>`;
    } else if (!colony) {
      html += '<p class="muted small">Pas de colonie sur cette planète.</p>';
    } else {
      const types = buildableTypes(tile, surface);
      const locked = lockedTypes(tile, surface);
      if (!types.length && !locked.length) html += '<p class="muted small">Rien à construire ici.</p>';
      html += '<div class="build-grid">';
      for (const type of types) {
        const def = BUILDINGS[type];
        html += `
          <button class="build-card" data-pv="build" data-type="${type}" title="${def.label} : ${def.desc}">
            <span class="big-icon">${icon(type)}</span>
            <span class="card-name">${def.label}</span>
            <span class="chips">${gainChips(previewBuilding(colony, surface, tile, type))}${defenseChip(type, 1)}</span>
            <span class="chips cost">${costChips(def.cost, def.days)}</span>
            <span class="reason"></span>
          </button>`;
      }
      // Bâtiments possibles ici mais qui attendent une technologie : cartes atténuées, sans action.
      for (const { type, tech } of locked) {
        const def = BUILDINGS[type];
        if (!def) continue;
        const techName = TECHS[tech]?.label ?? tech;
        html += `
          <button class="build-card locked" disabled title="${def.label} : ${def.desc} Recherche nécessaire : ${techName}.">
            <span class="big-icon">${icon(type)}${LOCK_ICON}</span>
            <span class="card-name">${def.label}</span>
            <span class="lock-reason">Recherche : ${techName}</span>
          </button>`;
      }
      html += '</div>';
    }
    $('pv-tile').innerHTML = html;
    refreshButtons();
  }

  // --- Boucle ----------------------------------------------------------------------
  function frame() {
    const time = clock.getElapsedTime();
    controls.update();
    const dt = Math.min(time - (state.lastTime ?? time), 0.1);
    state.lastTime = time;
    const days = Math.max(0, game.time - (state.lastGameTime ?? game.time));
    state.lastGameTime = game.time;
    state.fx.update(time, dt, days);
    for (const view of state.tileViews) view.building?.userData.tick?.(time, dt, state.fx);
    for (const object of state.orbit?.children ?? []) object.rotation.z += (object.userData.spin ?? 0) * dt;
    if (state.colony?.construction && !state.colony.construction.upgrade) {
      const c = state.colony.construction;
      const view = state.tileViews[c.tileIndex];
      if (view?.building && BUILDINGS[c.type]) view.building.scale.y = 0.2 + 0.8 * (1 - c.daysLeft / BUILDINGS[c.type].days);
    }
    if (state.selection.visible) state.selection.material.color.setHSL(0.35, 0.8, 0.6 + Math.sin(time * 4) * 0.2);
    renderer.render(scene, camera);
  }

  return {
    get isOpen() {
      return !root.hidden;
    },
    open(starId, planetIndex, foundingShipId = null) {
      ensureRenderer();
      const star = game.stars[starId];
      state = {
        star,
        planet: star.planets[planetIndex],
        surface: getSurface(game, starId, planetIndex),
        planetIndex,
        colony: colonyOn(game, starId, planetIndex),
        founding: foundingShipId,
        selected: null,
        hovered: null,
      };
      root.hidden = false;
      resize();
      buildScene();
      renderColonyPanel();
      renderYard();
      renderTilePanel();
      renderer.setAnimationLoop(frame);
    },
    close() {
      root.hidden = true;
      tooltip.style.display = 'none';
      renderer?.setAnimationLoop(null);
    },
    // Après un événement (construction lancée ou terminée…).
    update() {
      if (root.hidden) return;
      syncBuildings();
      syncOrbitals();
      renderColonyPanel();
      renderYard();
      renderTilePanel();
    },
    // Chaque nouveau jour : seulement le panneau de la colonie (le chantier avance).
    renderLive() {
      if (root.hidden) return;
      syncBuildings(); // un niveau gagné se voit tout de suite (clé type:fini:niveau)
      renderColonyPanel();
      // L'avancement d'une fouille sélectionnée change chaque jour.
      const c = state.colony?.construction;
      if (state.selected?.building?.type === 'fouille' || (c?.upgrade && c.tileIndex === state.selected?.index)) renderTilePanel();
      else refreshButtons();
    },
  };
}
