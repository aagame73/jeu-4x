// Vue d'un système stellaire : l'étoile au centre, ses planètes sur leurs orbites et leurs
// lunes, le tout en mouvement. Entre la carte de l'amas et la surface d'une planète.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { STAR_TYPES, PLANET_TYPES, PLANET_SIZES } from './galaxy.js';
import { visiblePlanets, colonyOn, foundingProblem, selectedShip } from './game.js';
import { RESOURCE_LABELS } from './economy.js';
import { createRng } from './rng.js';
import { canvasTexture, glowTexture } from './textures.js';
import { createSky } from './skybox.js';
import { icon } from './icons.js';
import { knownRival, rivalInfo } from './species.js';
import { createSystemFleets } from './systemFleets.js';
import { besiegedHere, fleetShipHealth, rivalColonyHealth, shipHealth, warReport } from './combat.js';
import { SHIP_KINDS } from './game.js';
import { COMBAT } from './config.js';
import { treatyConflicts } from './diplomacy.js';

// --- Réglages du décor --------------------------------------------------------------
const BODY_RADIUS = { petite: 0.7, moyenne: 0.9, grande: 1.1 };
const GAS_RADIUS = 1.7;
const MOON_RADIUS = { petite: 0.3, moyenne: 0.38, rocheuse: 0.22 };
const BELT_WIDTH = 1.3;
const ORBIT_GAP = 1.1;
const INNER_PERIOD = 55; // secondes pour un tour de la planète la plus proche
const MOON_PERIOD = 14;
const SIZE_LABELS = { petite: 'Petite', moyenne: 'Moyenne', grande: 'Grande' };
const RICHNESS = ['', 'pauvre', 'moyen', 'riche'];
const DEPOSIT_ORDER = ['minerais', 'energie', 'biomasse', 'velarine', 'eau', 'deuterium'];

// Couleur dominante de chaque type (pastilles, liste, atmosphère).
const TYPE_COLORS = {
  tempere: '#5aa6d6',
  oceanique: '#2a8fd0',
  marecageuse: '#6b7a3a',
  desertique: '#d9a560',
  volcanique: '#d0502a',
  toxique: '#c4d040',
  glacee: '#cfe6f6',
  gazeuse: '#d8b48a',
  asteroides: '#8f8a80',
  rocheuse: '#9a968e',
};
const ATMOSPHERES = { tempere: '#7cc8ff', oceanique: '#6ab8ff', marecageuse: '#a8d070', toxique: '#d8f060', gazeuse: '#ffe0b0' };

// --- Bruit procédural (sur la sphère, sans couture) ---------------------------------
function createNoise(seed) {
  const rng = createRng(seed);
  const perm = new Uint8Array(512);
  const p = rng.shuffle(Array.from({ length: 256 }, (_, i) => i));
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const hash = (x, y, z) => perm[perm[perm[x & 255] + (y & 255)] + (z & 255)] / 255;
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const noise = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
    return lerp(
      lerp(lerp(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), lerp(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
      lerp(lerp(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), lerp(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v),
      w,
    );
  };
  return (x, y, z, octaves = 4) => {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise(x * freq + 31.7, y * freq + 17.3, z * freq + 5.1) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  };
}

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a, b, t) => {
  t = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
};
const smooth = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Chaque peintre reçoit (n, m, lat, x, y, z) : deux bruits, la latitude et le point sur la
// sphère ; il renvoie [r, g, b] et, pour la lave, une lueur [r, g, b] (carte émissive).
function painterFor(type, rng) {
  const C = (c) => hex(c);
  switch (type) {
    case 'tempere': {
      const deep = C('#0d3566'), shallow = C('#2f7fb8'), low = C('#4f8a3a'), high = C('#8a7a4a'), snow = C('#eef6ff');
      return (n, m, lat) => {
        const pole = smooth(1.08, 1.25, Math.abs(lat) + (m - 0.5) * 0.25);
        let c = n < 0.5 ? mix(deep, shallow, smooth(0.36, 0.5, n)) : mix(low, high, smooth(0.52, 0.72, n + (m - 0.5) * 0.2));
        return [mix(c, snow, pole)];
      };
    }
    case 'oceanique': {
      const deep = C('#06275a'), mid = C('#1a63a8'), shallow = C('#46b4d8'), land = C('#6a9a4a'), sand = C('#d8c890');
      return (n, m, lat) => {
        if (n > 0.62) return [mix(sand, land, smooth(0.62, 0.66, n))];
        const c = mix(deep, mid, smooth(0.3, 0.5, n + (m - 0.5) * 0.1));
        return [mix(c, shallow, smooth(0.56, 0.62, n))];
      };
    }
    case 'marecageuse': {
      const a = C('#33401f'), b = C('#6b7a3a'), water = C('#1f3f3a'), moss = C('#8a9a50');
      return (n, m) => {
        if (m > 0.6) return [mix(b, water, smooth(0.6, 0.64, m))];
        return [mix(mix(a, b, smooth(0.35, 0.65, n)), moss, smooth(0.62, 0.75, n) * 0.6)];
      };
    }
    case 'desertique': {
      const a = C('#9a5f2e'), b = C('#d9a560'), c2 = C('#f0d49a');
      return (n, m, lat) => {
        const dunes = Math.sin(lat * 38 + n * 14) * 0.5 + 0.5;
        const c = mix(a, b, smooth(0.3, 0.6, n));
        return [mix(c, c2, dunes * 0.3 + smooth(0.6, 0.75, m) * 0.4)];
      };
    }
    case 'volcanique': {
      const a = C('#1a1210'), b = C('#4a3a32'), lava = C('#ff6a1a'), hot = C('#ffd166');
      return (n, m) => {
        const crack = 1 - smooth(0.0, 0.03, Math.abs(m - 0.5));
        const pool = smooth(0.72, 0.78, n);
        const glow = Math.max(crack, pool);
        const base = mix(a, b, smooth(0.3, 0.7, n));
        const lavaC = mix(lava, hot, pool * 0.6);
        return [mix(base, lavaC, glow), mix([0, 0, 0], lavaC, glow)];
      };
    }
    case 'toxique': {
      const a = C('#6a7a18'), b = C('#c4d040'), c2 = C('#eef08a');
      return (n, m, lat) => {
        const band = Math.sin(lat * 6 + n * 8) * 0.5 + 0.5;
        return [mix(mix(a, b, smooth(0.3, 0.7, n)), c2, band * 0.35 + smooth(0.6, 0.8, m) * 0.25)];
      };
    }
    case 'glacee': {
      const a = C('#9cc0de'), b = C('#eef6ff'), crack = C('#4f7fa8');
      return (n, m) => {
        const line = 1 - smooth(0.0, 0.012, Math.abs(m - 0.5));
        return [mix(mix(a, b, smooth(0.35, 0.65, n)), crack, line * 0.8)];
      };
    }
    case 'gazeuse': {
      const palettes = [
        ['#7a4a2a', '#d8b48a', '#f2e2c4', '#b8743e'],
        ['#2a4a7a', '#7fa8d8', '#dfeaff', '#4a6aa8'],
        ['#5a3a6a', '#c8a0c8', '#f0e0f0', '#8a5a8a'],
        ['#6a5a2a', '#d8c88a', '#f6f0d0', '#a8904a'],
      ].map((p) => p.map(C));
      const pal = rng.pick(palettes);
      const freq = rng.range(9, 15);
      const spotLat = rng.range(-0.5, 0.5), spotLon = rng.range(0, Math.PI * 2);
      return (n, m, lat, x, y, z, lon) => {
        const v = Math.sin(lat * freq + (n - 0.5) * 5) * 0.5 + 0.5;
        const w = Math.sin(lat * freq * 2.3 + (m - 0.5) * 3) * 0.5 + 0.5;
        let c = mix(pal[0], pal[1], v);
        c = mix(c, pal[2], smooth(0.6, 1, w) * 0.6);
        const dl = Math.atan2(Math.sin(lon - spotLon), Math.cos(lon - spotLon));
        const d = (dl / 0.35) ** 2 + ((lat - spotLat) / 0.12) ** 2;
        return [mix(c, pal[3], (1 - smooth(0.6, 1, d)) * 0.9)];
      };
    }
    default: {
      // rocheuse
      const a = C('#4a4744'), b = C('#a8a49c');
      return (n, m) => [mix(a, b, smooth(0.25, 0.75, n * 0.8 + m * 0.2))];
    }
  }
}

// Texture équirectangulaire d'une planète (et sa carte émissive pour la lave).
function paintPlanet(type, seed, width) {
  const height = width / 2;
  const rng = createRng(seed);
  const fbm = createNoise(seed);
  const fbm2 = createNoise(seed ^ 0x9e3779b9);
  const paint = painterFor(type, rng);
  const freq = type === 'gazeuse' ? 1.6 : type === 'oceanique' ? 2.4 : 2.8;
  const color = document.createElement('canvas');
  color.width = width;
  color.height = height;
  const ctx = color.getContext('2d');
  const img = ctx.createImageData(width, height);
  let glowImg = null;
  for (let py = 0; py < height; py++) {
    const lat = (0.5 - (py + 0.5) / height) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let px = 0; px < width; px++) {
      const lon = (px / width) * Math.PI * 2;
      const x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon);
      const n = fbm(x * freq, y * freq, z * freq, 5);
      const m = fbm2(x * freq * 1.3, y * freq * 1.3, z * freq * 1.3, 4);
      const [c, g] = paint(n, m, lat, x, y, z, lon);
      const i = (py * width + px) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
      if (g) {
        glowImg ??= ctx.createImageData(width, height);
        glowImg.data[i] = g[0];
        glowImg.data[i + 1] = g[1];
        glowImg.data[i + 2] = g[2];
        glowImg.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // Cratères des corps sans atmosphère.
  if (type === 'rocheuse' || type === 'desertique' || type === 'glacee') {
    const count = type === 'rocheuse' ? 46 : 14;
    for (let k = 0; k < count; k++) {
      const cx = rng.range(0, width), cy = rng.range(height * 0.15, height * 0.85);
      const r = rng.range(width * 0.006, width * (type === 'rocheuse' ? 0.035 : 0.02));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1 / Math.max(0.35, Math.cos((0.5 - cy / height) * Math.PI)), 1);
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
      g.addColorStop(0, 'rgba(0,0,0,0.35)');
      g.addColorStop(0.75, 'rgba(0,0,0,0.18)');
      g.addColorStop(0.9, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  let emissiveMap = null;
  if (glowImg) {
    const glow = document.createElement('canvas');
    glow.width = width;
    glow.height = height;
    glow.getContext('2d').putImageData(glowImg, 0, 0);
    emissiveMap = new THREE.CanvasTexture(glow);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
  }
  return { map, emissiveMap };
}

// Couche de nuages (alpha) pour les mondes tempérés et océaniques.
function paintClouds(seed, width) {
  const fbm = createNoise(seed ^ 0x5bd1e995);
  return canvasTexture(width, width / 2, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let py = 0; py < h; py++) {
      const lat = (0.5 - (py + 0.5) / h) * Math.PI;
      const cl = Math.cos(lat), sl = Math.sin(lat);
      for (let px = 0; px < w; px++) {
        const lon = (px / w) * Math.PI * 2;
        const n = fbm(cl * Math.cos(lon) * 3, sl * 5, cl * Math.sin(lon) * 3, 5);
        const a = smooth(0.5, 0.7, n) * 230;
        const i = (py * w + px) * 4;
        img.data.set([255, 255, 255, a], i);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

// Anneau : bandes concentriques (les UV de RingGeometry sont remappées en radial).
function ringMesh(inner, outer, seed) {
  const rng = createRng(seed);
  const texture = canvasTexture(256, 4, (ctx, w, h) => {
    for (let x = 0; x < w; x++) {
      const t = x / w;
      const edge = smooth(0, 0.08, t) * (1 - smooth(0.9, 1, t));
      const a = edge * (0.25 + 0.6 * Math.abs(Math.sin(t * 40 + rng.range(0, 0.6)))) * (rng.chance(0.08) ? 0.15 : 1);
      const l = 170 + Math.sin(t * 13) * 40;
      ctx.fillStyle = `rgba(${l + 30},${l + 10},${l - 20},${a.toFixed(3)})`;
      ctx.fillRect(x, 0, 1, h);
    }
  });
  const geometry = new THREE.RingGeometry(inner, outer, 128, 1);
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const d = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (d - inner) / (outer - inner), 0.5);
  }
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1, metalness: 0 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function orbitLine(radius, opacity, segments = 160) {
  const points = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: '#5fe3ff', transparent: true, opacity, depthWrite: false }),
  );
}

const rivalBadge = (rival) =>
  rival
    ? `<span class="sv-badge rival" style="--empire:${rival.accent}">Habitée par les ${rival.label} · ${rival.empire}</span>`
    : '<span class="sv-badge rival">Signaux artificiels</span>';

const rivalFlag = (rival) => (rival ? `<em class="tag rival" style="--empire:${rival.accent}">Habitée</em>` : '<em class="tag rival">Signaux</em>');

// Anneau de repère tourné vers la caméra (colonie, espèce rivale, survol, sélection).
const markerGeometry = new THREE.RingGeometry(1, 1.07, 72);
const thinGeometry = new THREE.RingGeometry(1, 1.035, 72);
function markerRing(color, opacity, thin = false) {
  const mesh = new THREE.Mesh(
    thin ? thinGeometry : markerGeometry,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  mesh.renderOrder = 5;
  return mesh;
}

const hitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const textureCache = new Map();

const bodyKind = (planet) => (planet.moonOf != null ? 'lune' : 'planète');
const sizeText = (planet) => (planet.size ? `${SIZE_LABELS[planet.size] ?? planet.size} · ${PLANET_SIZES[planet.size]} hexagones` : 'Non colonisable');
const typeLabel = (planet) => PLANET_TYPES[planet.type]?.label ?? planet.type;

export function createSystemView(root, game, actions) {
  root.innerHTML = `
    <div class="sv-canvas"></div>
    <aside class="panel sv-panel" id="sv-info"></aside>
    <aside class="panel sv-panel" id="sv-planet" hidden></aside>
    <aside class="panel sv-battle" id="sv-battle" hidden></aside>
    <button class="sv-back" data-sv="close">← Retour à l'amas <kbd>Échap</kbd></button>
    <div class="tooltip sv-tooltip"></div>`;
  const host = root.querySelector('.sv-canvas');
  const tooltip = root.querySelector('.sv-tooltip');
  const infoPanel = root.querySelector('#sv-info');
  const planetPanel = root.querySelector('#sv-planet');
  const battlePanel = root.querySelector('#sv-battle');
  const fleets = createSystemFleets(game);

  let renderer = null;
  let labelRenderer;
  let scene;
  let camera;
  let controls;
  let sky = null;
  let state = null;
  const clock = new THREE.Clock();
  const raycaster = new THREE.Raycaster();
  const focusGoal = new THREE.Vector3();
  const focusStep = new THREE.Vector3();
  const hoverRing = markerRing('#ffffff', 0.4, true);
  const selectRing = markerRing('#5fe3ff', 0.9, true);

  root.addEventListener('click', (e) => {
    const button = e.target.closest('[data-sv]');
    if (!button || button.disabled) return;
    const index = Number(button.dataset.index);
    switch (button.dataset.sv) {
      case 'close':
        actions.onCloseSystem?.();
        break;
      case 'select':
        select(state?.bodies.find((b) => b.index === index) ?? null);
        break;
      case 'surface':
        actions.onOpenPlanet?.(state.star.id, index);
        break;
      case 'found':
        actions.onOpenPlanet?.(state.star.id, index, true);
        break;
    }
  });
  root.addEventListener('dblclick', (e) => {
    const item = e.target.closest('[data-sv="select"]');
    if (!item || !state) return;
    const body = state.bodies.find((b) => b.index === Number(item.dataset.index));
    if (body?.planet.size) actions.onOpenPlanet?.(state.star.id, body.index);
  });

  function ensureRenderer() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x02040a, 1);
    host.appendChild(renderer.domElement);
    labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.className = 'sv-labels';
    host.appendChild(labelRenderer.domElement);
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 6000);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = 1.48;
    controls.rotateSpeed = 0.6;
    bindPointer();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!renderer || root.hidden) return;
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    updateViewOffset();
  }

  // Décale le centre de la vue pour que le système tombe entre les panneaux latéraux.
  function updateViewOffset() {
    const w = host.clientWidth, h = host.clientHeight;
    const left = infoPanel.offsetWidth ? infoPanel.offsetWidth + 12 : 0;
    const right = planetPanel.hidden ? 0 : planetPanel.offsetWidth + 12;
    const shift = Math.round((left - right) / 2);
    if (shift) camera.setViewOffset(w, h, -shift, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  // --- Construction de la scène ------------------------------------------------------
  function sceneKey(star) {
    return `${star.id}:${star.level}:${visiblePlanets(star).length}:${game.colonies.length}:${star.planets.map((p) => (p.inhabitedBy ? 1 : 0)).join('')}`;
  }

  function texturesFor(planet, index, star) {
    const key = `${star.id}:${index}`;
    if (!textureCache.has(key)) {
      const seed = (star.id * 7919 + index * 104729 + 13) >>> 0;
      const width = planet.moonOf != null ? 256 : planet.type === 'gazeuse' ? 512 : 384;
      const set = paintPlanet(planet.type, seed, width);
      if (planet.type === 'tempere' || planet.type === 'oceanique') set.clouds = paintClouds(seed, 256);
      textureCache.set(key, set);
    }
    return textureCache.get(key);
  }

  function makeLabel(body) {
    const { planet } = body;
    const el = document.createElement('div');
    const colony = colonyOn(game, state.star.id, body.index);
    const classes = ['sv-label', body.isMoon ? 'moon' : 'planet'];
    let tags = '';
    if (colony) {
      classes.push('colony');
      tags += '<em class="tag colony">Colonie</em>';
    } else if (planet.inhabitedBy) {
      classes.push('rival');
      const rival = knownRival(state.star, planet.inhabitedBy);
      if (rival) el.style.setProperty('--empire', rival.accent);
      tags += `<em class="tag rival">${rival?.label ?? 'Signaux'}</em>`;
    } else if (body.isMoon && planet.size) {
      tags += '<em class="tag habitable">habitable</em>';
    }
    if (planet.ruins && state.star.level >= 3) tags += '<em class="tag ruins" title="Ruines">◆</em>';
    el.className = classes.join(' ');
    el.innerHTML = `<span class="name">${planet.name}</span>${tags}`;
    const label = new CSS2DObject(el);
    label.center.set(0.5, 0);
    label.position.set(0, -(body.radius + (body.isMoon ? 0.12 : 0.3)), 0);
    return label;
  }

  function planetMesh(planet, index, radius, star) {
    const { map, emissiveMap, clouds } = texturesFor(planet, index, star);
    const material = new THREE.MeshStandardMaterial({
      map,
      roughness: planet.type === 'oceanique' ? 0.55 : 0.92,
      metalness: 0,
      emissive: emissiveMap ? '#ffffff' : '#2a3a5a',
      emissiveMap,
      emissiveIntensity: emissiveMap ? 1 : 0,
    });
    const segments = radius > 0.5 ? 48 : 24;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments / 2), material);
    mesh.userData.baseEmissive = material.emissiveIntensity;
    if (clouds) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.025, segments, segments / 2),
        new THREE.MeshStandardMaterial({ map: clouds, transparent: true, depthWrite: false, roughness: 1 }),
      );
      cloud.userData.cloud = true;
      mesh.add(cloud);
    }
    const atmo = ATMOSPHERES[planet.type];
    if (atmo) {
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.09, segments, segments / 2),
        new THREE.MeshBasicMaterial({ color: atmo, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      mesh.add(glow);
    }
    return mesh;
  }

  function asteroidBelt(radius, seed) {
    const rng = createRng(seed);
    const count = Math.round(radius * 9);
    const belt = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: '#8f8a80', roughness: 1, flatShading: true }),
      count,
    );
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = radius + rng.gauss() * BELT_WIDTH * 0.32;
      p.set(Math.cos(a) * r, rng.gauss() * 0.12, Math.sin(a) * r);
      e.set(rng.range(0, 6.3), rng.range(0, 6.3), rng.range(0, 6.3));
      const k = rng.chance(0.08) ? rng.range(0.14, 0.24) : rng.range(0.04, 0.11);
      s.set(k * rng.range(0.7, 1.3), k * rng.range(0.6, 1), k);
      belt.setMatrixAt(i, m.compose(p, q.setFromEuler(e), s));
      belt.setColorAt(i, color.setHSL(0.08, rng.range(0.05, 0.2), rng.range(0.35, 0.6)));
    }
    return belt;
  }

  // Libère la scène précédente (sauf le ciel et les ressources partagées).
  function disposeScene(old) {
    fleets.detach(); // les modèles des vaisseaux sont gardés pour la prochaine fois
    old.remove(sky);
    // Les étiquettes CSS2D d'une scène abandonnée resteraient dans le conteneur.
    labelRenderer.domElement.replaceChildren();
    hoverRing.removeFromParent();
    selectRing.removeFromParent();
    old.traverse((object) => {
      if (object.geometry && object.geometry !== markerGeometry && object.geometry !== thinGeometry) object.geometry.dispose();
      if (object.material && object.material !== hitMaterial && object !== hoverRing && object !== selectRing) object.material.dispose();
    });
  }

  function buildScene() {
    const { star } = state;
    if (scene) disposeScene(scene);
    scene = new THREE.Scene();
    sky ??= createSky();
    scene.add(sky);
    scene.add(new THREE.AmbientLight('#8090b0', 0.12));
    const starType = STAR_TYPES[star.type] ?? STAR_TYPES.jaune;
    const starColor = new THREE.Color(starType.color);
    const light = new THREE.PointLight(starColor.clone().lerp(new THREE.Color('#ffffff'), 0.55), 3.2, 0, 0);
    scene.add(light);

    // L'étoile : un globe lumineux et deux halos additifs.
    const starRadius = 0.6 + starType.size * 0.95;
    const starGroup = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(starRadius, 48, 24),
      new THREE.MeshBasicMaterial({ color: starColor.clone().lerp(new THREE.Color('#ffffff'), 0.6) }),
    );
    core.userData.star = true;
    const glow = glowTexture();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: starColor, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(starRadius * 4);
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: starColor, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    corona.scale.setScalar(starRadius * 10);
    starGroup.add(core, halo, corona);
    scene.add(starGroup);
    state.starView = { core, halo, corona, radius: starRadius };

    // Disposition : de l'étoile vers l'extérieur, chaque corps réserve sa place (lunes, anneau).
    const visible = visiblePlanets(star);
    const visibleSet = new Set(visible);
    const planets = visible.filter((p) => p.moonOf == null);
    const moonsOf = new Map();
    for (const moon of visible) {
      if (moon.moonOf == null || !visibleSet.has(star.planets[moon.moonOf])) continue;
      if (!moonsOf.has(moon.moonOf)) moonsOf.set(moon.moonOf, []);
      moonsOf.get(moon.moonOf).push(moon);
    }

    const bodies = [];
    let edge = starRadius * 1.8 + 1;
    let innerR = null;
    planets.forEach((planet) => {
      const index = star.planets.indexOf(planet);
      const belt = planet.type === 'asteroides';
      const radius = belt ? BELT_WIDTH / 2 : planet.type === 'gazeuse' ? GAS_RADIUS : BODY_RADIUS[planet.size] ?? 0.6;
      const moons = moonsOf.get(index) ?? [];
      const moonRadii = moons.map((m) => (m.size ? MOON_RADIUS[m.size] ?? 0.3 : MOON_RADIUS.rocheuse));
      const moonDist = moons.map((_, k) => radius + 0.65 + k * 0.55 + (planet.ring ? radius * 1.1 : 0));
      let extent = radius;
      if (planet.ring) extent = Math.max(extent, radius * 2.3);
      moons.forEach((_, k) => (extent = Math.max(extent, moonDist[k] + moonRadii[k])));
      const orbitR = edge + extent;
      edge = orbitR + extent + ORBIT_GAP;
      innerR ??= orbitR;
      const rng = createRng(star.id * 131 + index * 17 + 3);

      const anchor = new THREE.Group();
      scene.add(anchor);
      const orbit = orbitLine(orbitR, 0.14);
      scene.add(orbit);
      const body = {
        planet, index, isMoon: false, radius, orbitR, anchor, orbit, belt,
        phase: rng.range(0, Math.PI * 2),
        omega: ((Math.PI * 2) / INNER_PERIOD) * (innerR / orbitR) ** 1.5,
        spin: rng.range(0.15, 0.35) * (planet.type === 'gazeuse' ? 2 : 1),
      };
      if (belt) {
        body.mesh = asteroidBelt(orbitR, star.id * 977 + index);
        scene.add(body.mesh);
        // Zone de survol : un anneau plat invisible le long de la ceinture.
        const hit = new THREE.Mesh(new THREE.RingGeometry(orbitR - BELT_WIDTH * 0.6, orbitR + BELT_WIDTH * 0.6, 96), hitMaterial);
        hit.rotation.x = -Math.PI / 2;
        hit.userData.body = body;
        scene.add(hit);
        body.hit = hit;
        anchor.position.set(0, 0, orbitR); // étiquette posée sur la ceinture
      } else {
        const tilt = new THREE.Group();
        tilt.rotation.z = rng.range(-0.35, 0.35);
        anchor.add(tilt);
        body.mesh = planetMesh(planet, index, radius, star);
        tilt.add(body.mesh);
        if (planet.ring) tilt.add(ringMesh(radius * 1.35, radius * 2.3, star.id * 31 + index));
        const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(radius * 1.25, 0.5), 12, 8), hitMaterial);
        hit.userData.body = body;
        anchor.add(hit);
        body.hit = hit;
      }
      bodies.push(body);

      moons.forEach((moon, k) => {
        const mIndex = star.planets.indexOf(moon);
        const mr = createRng(star.id * 733 + mIndex * 29 + 1);
        const mRadius = moonRadii[k];
        const pivot = new THREE.Group();
        anchor.add(pivot);
        const mOrbit = orbitLine(moonDist[k], 0.1, 64);
        anchor.add(mOrbit);
        const mAnchor = new THREE.Group();
        pivot.add(mAnchor);
        const mBody = {
          planet: moon, index: mIndex, isMoon: true, radius: mRadius, orbitR: moonDist[k], anchor: mAnchor, orbit: mOrbit, parent: body,
          phase: mr.range(0, Math.PI * 2),
          omega: ((Math.PI * 2) / MOON_PERIOD) * ((radius + 0.65) / moonDist[k]) ** 1.5 * (mr.chance(0.15) ? -1 : 1),
          spin: mr.range(0.1, 0.3),
        };
        mBody.mesh = planetMesh(moon, mIndex, mRadius, star);
        mAnchor.add(mBody.mesh);
        const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(mRadius * 1.8, 0.38), 10, 6), hitMaterial);
        hit.userData.body = mBody;
        mAnchor.add(hit);
        mBody.hit = hit;
        bodies.push(mBody);
      });
    });

    for (const body of bodies) {
      body.label = makeLabel(body);
      body.anchor.add(body.label);
      const colony = colonyOn(game, star.id, body.index);
      if (!body.belt && (colony || body.planet.inhabitedBy)) {
        body.marker = markerRing(colony ? '#7cff9e' : knownRival(star, body.planet.inhabitedBy)?.accent ?? '#ff7a8a', 0.75);
        body.marker.scale.setScalar(body.radius * 1.55 + 0.12);
        body.anchor.add(body.marker);
      }
    }
    state.bodies = bodies;
    state.outer = edge;
    hoverRing.visible = false;
    selectRing.visible = false;

    const dist = Math.max(18, edge * 1.85);
    if (!state.keepCamera) {
      camera.position.set(0, dist * 0.58, dist * 0.81);
      controls.target.set(0, 0, 0);
    }
    controls.minDistance = 3;
    controls.maxDistance = Math.max(30, edge * 2.6);
    state.key = sceneKey(star);
    placeBodies(clock.getElapsedTime());
    fleets.attach(scene, star, bodies, edge, state.starView.radius);
  }

  // --- Panneau de bataille ---------------------------------------------------------------
  const bar = (part) => `<i class="sv-hp"><b style="width:${Math.round(part * 100)}%"></b></i>`;
  function renderBattle() {
    if (!state) return;
    const starId = state.star.id;
    const report = warReport(game, starId);
    const besieged = besiegedHere(game, starId);
    const mine = game.ships.filter((s) => s.starId === starId && s.state !== 'travel');
    const active = report.battle || report.fleets.length || (besieged.length && mine.some((s) => SHIP_KINDS[s.kind].warship));
    battlePanel.hidden = !active;
    if (!active) return;
    const colony = game.colonies.find((c) => c.starId === starId);
    const ours = mine.map((s) => `<li>${s.name}${bar(shipHealth(game, s))}</li>`);
    if (colony) {
      const siege = report.siege;
      ours.push(
        siege && siege.defenseLeft === null
          ? `<li>${colony.name} : sans défense${siege.days ? `, tombe dans ${Math.max(0, COMBAT.captureDays - siege.days)} jours` : ''}</li>`
          : `<li>Défense de ${colony.name}${bar(siege?.defenseLeft ?? 1)}</li>`,
      );
    }
    const theirs = report.fleets.flatMap((f) => [
      `<li class="sv-hp-head" style="--empire:${rivalInfo(f.species).accent}">Flotte des ${rivalInfo(f.species).label}</li>`,
      ...f.ships.map((s) => `<li>${SHIP_KINDS[s.kind].label}${bar(fleetShipHealth(game, f, s))}</li>`),
    ]);
    for (const { empire, colony: c } of besieged) {
      const home = c === empire.colonies[0];
      const left = Math.max(0, COMBAT.homeSiegeDays - (c.siegeDays ?? 0));
      const when = left === 0 ? 'peut tomber à tout moment' : `tombe dans ${left} jour${left > 1 ? 's' : ''} au plus tôt`;
      const what = home ? `Monde natal des ${rivalInfo(empire.species).label} (${state.star.planets[c.planetIndex].name}), ${when}` : `Colonie des ${rivalInfo(empire.species).label} (${state.star.planets[c.planetIndex].name})`;
      theirs.push(`<li style="--empire:${rivalInfo(empire.species).accent}">${what}${bar(rivalColonyHealth(game, empire, c))}</li>`);
    }
    const scrolls = [...battlePanel.querySelectorAll('ul')].map((ul) => ul.scrollTop); // gardés d'un rafraîchissement à l'autre
    battlePanel.innerHTML = `
      <h3>${report.battle ? '⚔ Bataille' : 'Flottes en présence'}</h3>
      <div class="sv-sides">
        <section><h4>Vos forces</h4><ul>${ours.join('') || '<li class="muted">Aucune</li>'}</ul></section>
        <section><h4>Ennemis</h4><ul>${theirs.join('') || '<li class="muted">Aucun</li>'}</ul></section>
      </div>
      ${report.battle ? '<p class="muted small">Le temps est ralenti pendant le combat. Espace : pause.</p>' : ''}`;
    battlePanel.querySelectorAll('ul').forEach((ul, i) => (ul.scrollTop = scrolls[i] ?? 0));
  }

  // --- Animation -----------------------------------------------------------------------
  function placeBodies(time) {
    for (const body of state.bodies) {
      const a = body.phase + time * body.omega;
      if (body.belt) {
        body.mesh.rotation.y = -time * body.omega;
        continue;
      }
      body.anchor.position.set(Math.cos(a) * body.orbitR, 0, Math.sin(a) * body.orbitR);
      body.mesh.rotation.y = time * body.spin;
      for (const child of body.mesh.children) if (child.userData.cloud) child.rotation.y = time * 0.04;
    }
  }

  function frame() {
    const time = clock.getElapsedTime();
    const dt = Math.min(time - (state.lastTime ?? time), 0.1);
    state.lastTime = time;
    placeBodies(time);
    // La caméra accompagne le corps sélectionné (retour vers l'étoile sans sélection).
    const sel = state.selected;
    if (sel && !sel.belt) sel.anchor.getWorldPosition(focusGoal);
    else focusGoal.set(0, 0, 0);
    focusStep.subVectors(focusGoal, controls.target).multiplyScalar(Math.min(1, dt * 2.5));
    controls.target.add(focusStep);
    camera.position.add(focusStep);
    controls.update();
    const pulse = 1 + Math.sin(time * 1.6) * 0.035 + Math.sin(time * 4.3) * 0.012;
    const { halo, corona, radius } = state.starView;
    halo.scale.setScalar(radius * 4 * pulse);
    corona.scale.setScalar(radius * 10 * (2 - pulse));
    sky.position.copy(camera.position);
    state.frames = (state.frames ?? 0) + 1;
    if (state.pointer && state.frames % 8 === 0) hoverAt(state.pointer);
    const q = camera.quaternion;
    for (const body of state.bodies) {
      body.marker?.quaternion.copy(q);
      if (body.isMoon) {
        const focus = [body, body.parent].some((b) => b === state.selected || b === state.hovered);
        const near = camera.position.distanceTo(body.parent.anchor.position) < 24;
        body.label.visible = focus || near;
      }
    }
    hoverRing.quaternion.copy(q);
    selectRing.quaternion.copy(q);
    if (selectRing.visible) selectRing.material.opacity = 0.65 + Math.sin(time * 4) * 0.25;
    fleets.update(dt, time);
    state.battleTimer = (state.battleTimer ?? 0) - dt;
    if (state.battleTimer <= 0) {
      state.battleTimer = 0.5; // panneau de bataille rafraîchi deux fois par seconde
      renderBattle();
    }
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  // --- Interaction ---------------------------------------------------------------------
  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const targets = state.bodies.map((b) => b.hit);
    targets.push(state.starView.core);
    // Les petits corps (lunes) passent devant les grands : on garde le plus proche, mais un
    // touché sur une lune l'emporte sur sa planète mère.
    const hits = raycaster.intersectObjects(targets, false);
    if (!hits.length) return null;
    const first = hits[0].object;
    if (first.userData.star) return 'star';
    const moon = hits.find((h) => h.object.userData.body?.isMoon && h.distance - hits[0].distance < 1.5);
    return (moon ?? hits[0]).object.userData.body ?? null;
  }

  function attachRing(ring, body, scale) {
    if (!body || body.belt) {
      ring.visible = false;
      ring.removeFromParent();
      return;
    }
    body.anchor.add(ring);
    ring.scale.setScalar(scale);
    ring.visible = true;
  }

  function setHover(body) {
    if (state.hovered === body) return;
    const old = state.hovered;
    if (old && old !== 'star') {
      if (old.belt) old.mesh.material.emissive?.setHex(0x000000);
      else old.mesh.material.emissiveIntensity = old.mesh.userData.baseEmissive;
      old.label.element.classList.remove('hover');
    }
    state.hovered = body;
    if (body && body !== 'star') {
      if (body.belt) body.mesh.material.emissive.setHex(0x33302a);
      else body.mesh.material.emissiveIntensity = body.mesh.userData.baseEmissive ? 1.6 : 0.55;
      body.label.element.classList.add('hover');
      attachRing(hoverRing, body === state.selected ? null : body, body.radius * 1.35 + 0.1);
    } else {
      attachRing(hoverRing, null);
    }
  }

  function tooltipFor(target) {
    const star = state.star;
    if (target === 'star') {
      return [star.name, STAR_TYPES[star.type]?.label ?? 'Étoile'];
    }
    const { planet } = target;
    const parts = [planet.name, typeLabel(planet), sizeText(planet)];
    if (target.isMoon) parts.push(`Lune de ${star.planets[planet.moonOf].name}`);
    if (colonyOn(game, star.id, target.index)) parts.push('Votre colonie');
    else if (planet.inhabitedBy) {
      const rival = knownRival(star, planet.inhabitedBy);
      parts.push(rival ? `Habitée par les ${rival.label} · ${rival.empire}` : 'Signaux artificiels');
    }
    if (planet.ruins && star.level >= 3) parts.push('◆ Ruines des Veilleurs');
    if (planet.size) parts.push('Double-clic : voir la surface');
    return parts;
  }

  function bindPointer() {
    const el = renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (!state || !down || e.button !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const target = pick(e);
      select(target && target !== 'star' ? target : null);
    });
    el.addEventListener('dblclick', (e) => {
      if (!state) return;
      const target = pick(e);
      if (target && target !== 'star' && target.planet.size) actions.onOpenPlanet?.(state.star.id, target.index);
    });
    el.addEventListener('pointermove', (e) => {
      if (!state) return;
      if (e.buttons) {
        tooltip.style.display = 'none';
        return;
      }
      state.pointer = { clientX: e.clientX, clientY: e.clientY };
      hoverAt(state.pointer);
    });
    el.addEventListener('pointerleave', () => {
      if (!state) return;
      state.pointer = null;
      setHover(null);
      tooltip.style.display = 'none';
    });
  }

  // Survol : aussi réévalué pendant l'animation, les corps passant sous un curseur immobile.
  function hoverAt(e) {
    const target = pick(e);
    setHover(target);
    renderer.domElement.style.cursor = target && target !== 'star' ? 'pointer' : '';
    if (!target) {
      tooltip.style.display = 'none';
      return;
    }
    tooltip.innerHTML = tooltipFor(target).map((p, i) => (i ? `<span>${p}</span>` : `<strong>${p}</strong>`)).join('');
    tooltip.style.display = 'block';
    tooltip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - 270)}px`;
    tooltip.style.top = `${e.clientY + 12}px`;
  }

  function select(body) {
    if (!state) return;
    for (const b of state.bodies) {
      b.orbit.material.opacity = b.isMoon ? 0.1 : 0.14;
      b.label.element.classList.remove('selected');
    }
    state.selected = body;
    attachRing(selectRing, body, (body?.radius ?? 1) * 1.3 + 0.12);
    if (body) {
      body.orbit.material.opacity = 0.45;
      body.label.element.classList.add('selected');
      if (state.hovered === body) attachRing(hoverRing, null);
    }
    renderInfo();
    renderPlanet();
    updateViewOffset();
  }

  // --- Panneaux ------------------------------------------------------------------------
  const orb = (planet) => `<i class="sv-orb t-${planet.type}" style="--c:${TYPE_COLORS[planet.type] ?? '#888'}"></i>`;

  function renderInfo() {
    const { star } = state;
    const type = STAR_TYPES[star.type] ?? STAR_TYPES.jaune;
    const visible = visiblePlanets(star);
    const planets = visible.filter((p) => p.moonOf == null);
    const moons = visible.filter((p) => p.moonOf != null);
    const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
    const starColor = `#${new THREE.Color(type.color).getHexString()}`;
    let status;
    if (star.level >= 3) status = '<p class="sv-status ok">Système analysé</p>';
    else if (star.level === 2) status = '<p class="sv-status warn">Système survolé : analysez-le pour découvrir les lunes et les petites planètes.</p>';
    else status = '<p class="sv-status warn">Système inexploré.</p>';

    const selected = state.selected?.index;
    const row = (p, moon) => {
      const index = star.planets.indexOf(p);
      const colony = colonyOn(game, star.id, index);
      const flags = [
        colony ? '<em class="tag colony">Colonie</em>' : '',
        !colony && p.inhabitedBy ? rivalFlag(knownRival(star, p.inhabitedBy)) : '',
        p.ruins && star.level >= 3 ? '<em class="tag ruins">◆</em>' : '',
        moon && p.size && !colony && !p.inhabitedBy ? '<em class="tag habitable">habitable</em>' : '',
      ].join('');
      return `<li><button class="sv-item${moon ? ' moon' : ''}${index === selected ? ' on' : ''}" data-sv="select" data-index="${index}">
        ${orb(p)}<span class="sv-item-name">${p.name}</span>${flags}</button></li>`;
    };
    const list = planets
      .map((p) => {
        const index = star.planets.indexOf(p);
        return row(p, false) + moons.filter((m) => m.moonOf === index).map((m) => row(m, true)).join('');
      })
      .join('');

    infoPanel.innerHTML = `
      <div class="sv-head">
        <i class="sv-star" style="--c:${starColor}"></i>
        <div class="sv-title">
          <h2 class="sv-name">${star.name}</h2>
          <span class="sv-sub">${type.label}</span>
        </div>
      </div>
      <div class="sv-counts"><span><b>${plural(planets.length, 'planète')}</b></span><span><b>${plural(moons.length, 'lune')}</b></span><small>connues</small></div>
      ${status}
      ${list ? `<ul class="sv-list">${list}</ul><p class="sv-hint">Clic : fiche · double-clic : surface</p>` : '<p class="sv-hint">Aucune planète détectée.</p>'}`;
  }

  function foundable(index) {
    return !foundingProblem(game, selectedShip(game), state.star.id, index);
  }

  function renderPlanet() {
    const body = state.selected;
    if (!body) {
      planetPanel.hidden = true;
      state.planetKey = null;
      return;
    }
    const { star } = state;
    const { planet, index } = body;
    const colony = colonyOn(game, star.id, index);
    const canFound = !!(planet.size && !colony && foundable(index));
    state.planetKey = `${index}:${!!colony}:${canFound}:${star.level}`;

    const badges = [
      colony ? '<span class="sv-badge colony">Votre colonie</span>' : '',
      planet.inhabitedBy ? rivalBadge(knownRival(star, planet.inhabitedBy)) : '',
      planet.ruins && star.level >= 3 ? '<span class="sv-badge ruins">◆ Ruines des Veilleurs</span>' : '',
      body.isMoon && planet.size && !colony && !planet.inhabitedBy ? '<span class="sv-badge habitable">Lune habitable</span>' : '',
    ].join('');

    let deposits;
    if (star.level >= 3) {
      const items = DEPOSIT_ORDER.filter((r) => (planet.deposits?.[r] ?? 0) > 0).map(
        (r) => `<span class="sv-dep res-${r} rich-${planet.deposits[r]}">${icon(r)}<b>${RESOURCE_LABELS[r] ?? r}</b><small>${RICHNESS[planet.deposits[r]] ?? ''}</small></span>`,
      );
      deposits = items.length ? `<div class="sv-deps">${items.join('')}</div>` : '<p class="sv-muted">Aucun gisement notable.</p>';
    } else {
      deposits = '<p class="sv-muted">Inconnus : analysez le système.</p>';
    }

    const moons = star.planets.filter((p) => p.moonOf === index && visiblePlanets(star).includes(p));
    const moonList = moons.length
      ? `<div class="sv-sec"><span>Lunes</span><i></i></div><ul class="sv-list">${moons
          .map((m) => `<li><button class="sv-item moon" data-sv="select" data-index="${star.planets.indexOf(m)}">${orb(m)}<span class="sv-item-name">${m.name}</span>${m.size ? '<em class="tag habitable">habitable</em>' : ''}</button></li>`)
          .join('')}</ul>`
      : '';

    const buttons = [];
    if (planet.size) {
      buttons.push(`<button class="sv-btn" data-sv="surface" data-index="${index}">${colony ? 'Gérer la colonie' : 'Voir la surface'}</button>`);
    }
    if (canFound) {
      for (const empire of treatyConflicts(game, star.id)) buttons.push(`<span class="sv-badge rival">⚠ Fonder ici romprait le traité avec les ${rivalInfo(empire.species).label}</span>`);
    }
    if (canFound) buttons.push(`<button class="sv-btn primary" data-sv="found" data-index="${index}">Fonder une colonie ici</button>`);

    planetPanel.hidden = false;
    planetPanel.innerHTML = `
      <div class="sv-head">
        ${orb(planet).replace('sv-orb', 'sv-orb big')}
        <div class="sv-title">
          <h2 class="sv-name">${planet.name}</h2>
          <span class="sv-sub">${typeLabel(planet)}</span>
        </div>
      </div>
      <div class="sv-rows">
        <div class="sv-row"><span>Taille</span><b>${planet.size ? `${SIZE_LABELS[planet.size] ?? planet.size} <small>${PLANET_SIZES[planet.size]} hexagones</small>` : 'Non colonisable'}</b></div>
        <div class="sv-row"><span>Nature</span><b>${body.isMoon ? `Lune de ${star.planets[planet.moonOf].name}` : body.belt ? 'Ceinture' : `Planète n° ${index + 1}`}</b></div>
      </div>
      ${badges ? `<div class="sv-badges">${badges}</div>` : ''}
      <div class="sv-sec"><span>Gisements</span><i></i></div>
      ${deposits}
      ${moonList}
      ${buttons.length ? `<div class="sv-actions">${buttons.join('')}</div>` : ''}`;
  }

  // --- API -------------------------------------------------------------------------------
  return {
    get isOpen() {
      return !root.hidden;
    },
    open(starId) {
      ensureRenderer();
      const star = game.stars[starId];
      const colonyIndex = game.colonies.find((c) => c.starId === starId)?.planetIndex;
      state = { star, bodies: [], selected: null, hovered: null };
      root.hidden = false;
      resize();
      buildScene();
      const initial = state.bodies.find((b) => b.index === colonyIndex) ?? null;
      select(initial);
      renderer.setAnimationLoop(frame);
    },
    close() {
      root.hidden = true;
      labelRenderer?.domElement.replaceChildren();
      tooltip.style.display = 'none';
      renderer?.setAnimationLoop(null);
      battlePanel.hidden = true;
    },
    // Après un événement : analyse terminée, colonie fondée… on reconstruit si besoin.
    update() {
      if (root.hidden || !state) return;
      if (sceneKey(state.star) !== state.key) {
        const keep = state.selected?.index;
        state.keepCamera = true;
        state.hovered = null;
        buildScene();
        select(state.bodies.find((b) => b.index === keep) ?? null);
      } else {
        renderInfo();
        renderPlanet();
      }
    },
    // Chaque jour : seulement si la possibilité de fonder a changé (vaisseau arrivé…).
    renderLive() {
      if (root.hidden || !state?.selected) return;
      const { planet, index } = state.selected;
      const colony = colonyOn(game, state.star.id, index);
      const key = `${index}:${!!colony}:${!!(planet.size && !colony && foundable(index))}:${state.star.level}`;
      if (key !== state.planetKey) renderPlanet();
    },
  };
}
