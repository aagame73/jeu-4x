// Vue de la surface d'une planète : un plateau d'hexagones en 3D, avec terrains, gisements
// et bâtiments, plus les panneaux de la colonie et de la case sélectionnée.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TERRAINS, HEX_DIRECTIONS, hexKey } from './surface.js';
import { BUILDINGS, RESOURCE_LABELS, SHIPYARD, depositName, buildableTypes, colonyReport, previewBuilding, canAfford } from './economy.js';
import { PLANET_TYPES, PLANET_SIZES } from './galaxy.js';
import { getSurface, colonyOn, shipyardProblem } from './game.js';
import { createRng } from './rng.js';
import { canvasTexture, glowTexture } from './textures.js';
import { createSurfaceFx } from './surfaceFx.js';
import { icon } from './icons.js';

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
};

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

function skyTexture(tint) {
  return canvasTexture(4, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#02040a');
    g.addColorStop(0.55, '#070b16');
    g.addColorStop(1, new THREE.Color(tint).multiplyScalar(0.45).getStyle());
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

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
  const style = DEPOSIT_STYLE[deposit.resource];
  const group = new THREE.Group();
  const mat = std(style.color, { emissive: style.emissive, roughness: 0.35, metalness: deposit.resource === 'minerais' ? 0.6 : 0.2 });
  for (let i = 0; i < deposit.richness; i++) {
    const geometry =
      deposit.resource === 'minerais' ? new THREE.DodecahedronGeometry(0.09) : deposit.resource === 'biomasse' ? new THREE.SphereGeometry(0.08, 8, 6) : new THREE.OctahedronGeometry(0.09);
    const m = new THREE.Mesh(geometry, mat);
    m.position.set((i - (deposit.richness - 1) / 2) * 0.17, 0.09, 0);
    if (deposit.resource === 'velarine' || deposit.resource === 'energie') m.scale.y = 1.8;
    m.castShadow = true;
    group.add(m);
  }
  group.scale.setScalar(1.5);
  group.position.set(0.3, top, 0.38);
  return group;
}

// --- Bâtiments -----------------------------------------------------------------------
const ghostMaterial = new THREE.MeshBasicMaterial({ color: '#7cd8ff', wireframe: true, transparent: true, opacity: 0.55 });

function buildingMesh(type, ghost) {
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
      tick = every(0.9, (fx) => fx.puff(g, 0.2, 0.75, -0.12, '#6a6460'));
      break;
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
  }
  if (!ghost) g.userData.tick = tick;
  return g;
}

// --- La vue --------------------------------------------------------------------------
export function createPlanetView(root, game, actions) {
  root.innerHTML = `
    <div class="planet-canvas"></div>
    <aside class="panel planet-panel" id="pv-colony"><div id="pv-colony-live"></div><div id="pv-yard"></div></aside>
    <aside class="panel planet-panel tile-panel" id="pv-tile"></aside>
    <button class="back" data-pv="close">← Retour à l'amas <kbd>Échap</kbd></button>
    <div class="tooltip pv-tooltip"></div>`;
  const host = root.querySelector('.planet-canvas');
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
    renderer = new THREE.WebGLRenderer({ antialias: true });
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
    scene.background = skyTexture(tint);
    scene.fog = new THREE.Fog(new THREE.Color(tint).multiplyScalar(0.25), 18, 60);
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

    const dist = surface.radius * 4.2 + 6;
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
    const key = colony ? `${colony.orbital.dock}:${colony.orbital.defense}` : '';
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
      const key = b ? `${b.type}:${b.done}` : '';
      if (key === view.buildingKey) continue;
      if (view.building) view.decor.remove(view.building);
      view.building = null;
      view.buildingKey = key;
      if (!b) continue;
      view.building = buildingMesh(b.type, !b.done);
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
      if (tile.building) parts.push(BUILDINGS[tile.building.type].label + (tile.building.done ? '' : ' (en construction)'));
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
    else if (action === 'found') actions.onFoundColony(state.founding, state.star.id, state.planetIndex, state.selected.index);
    else if (action === 'shipyard') actions.onShipyard(state.colony, el.dataset.key);
  });

  // --- Panneaux --------------------------------------------------------------------
  // Pastilles « icône + nombre » ; le détail en texte reste dans l'infobulle.
  const chip = (name, value, title, cls = '') => `<span class="chip ${cls}" title="${title}">${icon(name)}${value}</span>`;

  const costChips = (cost, days) =>
    Object.entries(cost)
      .map(([res, n]) => chip(res, n, `Coût : ${n} ${RESOURCE_LABELS[res].toLowerCase()}`, `res-${res}`))
      .join('') + chip('jours', `${days} j`, `Durée : ${days} jours`);

  function gainChips(gains, perDay = true) {
    const parts = [];
    for (const res of ['minerais', 'energie', 'biomasse', 'velarine']) {
      const v = gains[res];
      if (Math.abs(v) >= 0.05) parts.push(chip(res, fmt(v), `${fmt(v)} ${RESOURCE_LABELS[res].toLowerCase()}${perDay ? ' par jour' : ''}`, `res-${res} ${v > 0 ? 'up' : 'down'}`));
    }
    if (gains.housing) parts.push(chip('places', `+${gains.housing}`, `+${gains.housing} places de population`, 'up'));
    if (gains.workers) parts.push(chip('colon', gains.workers, `Demande ${gains.workers} colon`));
    return parts.join('');
  }

  const richnessDots = (n) => `<span class="dots">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

  function renderColonyPanel() {
    const { star, planet, colony, surface } = state;
    const type = PLANET_TYPES[planet.type];
    let html = `<h2>${planet.name}</h2><div class="muted small">${type.label} · ${planet.size}, ${PLANET_SIZES[planet.size]} hexagones · système ${star.name}</div>`;
    if (!colony && state.founding !== null) {
      html += '<p class="founding">Choisissez la case où poser la colonie : une case de terre, sans gisement de minerais ni de Vélarine. Le centre colonial y sera installé.</p>';
    } else if (!colony) {
      html += '<p class="muted">Planète non colonisée. Une Arche ou un vaisseau colonie peut y fonder une colonie.</p>';
      if (star.level < 3) html += '<p class="muted small">Analysez le système pour voir ses gisements.</p>';
    } else {
      const r = colonyReport(colony, surface);
      const warn = (cond) => (cond ? ' warn' : '');
      html += `
        <h3>Colonie</h3>
        <div class="stat-row"><span>Population</span><b>${colony.population} / ${r.housing}</b></div>
        <div class="stat-row${warn(r.staffing < 1)}"><span>Colons au travail</span><b>${Math.min(colony.population, r.workers)} / ${r.workers}</b></div>
        <div class="stat-row${warn(r.power < 1)}"><span>Énergie</span><b>${fmt(r.energyProd, false)} produite / ${r.energyUse} utilisée</b></div>
        <h3>Production par jour</h3>
        <div class="stat-row"><span>Minerais</span><b>${fmt(r.perDay.minerais)}</b></div>
        <div class="stat-row${warn(r.perDay.biomasse < 0)}"><span>Biomasse (après repas)</span><b>${fmt(r.perDay.biomasse)}</b></div>
        ${r.perDay.velarine ? `<div class="stat-row"><span>Vélarine</span><b>${fmt(r.perDay.velarine)}</b></div>` : ''}`;
      if (r.staffing < 1) html += '<p class="alert small">Pas assez de colons : les bâtiments tournent au ralenti. Construisez des foyers.</p>';
      if (r.power < 1) html += "<p class=\"alert small\">Pas assez d'énergie : les bâtiments qui en consomment ralentissent.</p>";
      if (colony.famine) html += '<p class="alert small">Famine : la biomasse est épuisée.</p>';
      if (colony.construction) {
        const def = BUILDINGS[colony.construction.type];
        const done = 1 - colony.construction.daysLeft / def.days;
        html += `<h3>Chantier</h3><div class="small">${def.label} · encore ${Math.ceil(colony.construction.daysLeft)} j</div><div class="progress"><i style="width:${Math.round(done * 100)}%"></i></div>`;
      } else {
        html += '<p class="muted small">Aucun chantier. Cliquez sur une case pour construire.</p>';
      }
      if (colony.shipyard) {
        const order = SHIPYARD[colony.shipyard.key];
        const done = 1 - colony.shipyard.daysLeft / order.days;
        html += `<h3>Chantier spatial</h3><div class="small">${order.label} · encore ${Math.ceil(colony.shipyard.daysLeft)} j</div><div class="progress"><i style="width:${Math.round(done * 100)}%"></i></div>`;
      }
      const orbit = [];
      if (colony.orbital.dock) orbit.push('dock spatial');
      if (colony.orbital.defense) orbit.push(`${colony.orbital.defense} anneau${colony.orbital.defense > 1 ? 'x' : ''} de défense`);
      if (orbit.length) html += `<div class="muted small">En orbite : ${orbit.join(', ')}.</div>`;
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
    let html = '<h3>Commandes spatiales</h3>';
    if (!state.surface.tiles.some((t) => t.building?.type === 'spatioport' && t.building.done)) {
      $('pv-yard').innerHTML = `${html}<p class="muted small">Construisez un spatioport (sur une plaine ou un désert) pour lancer des sondes, un dock spatial et des défenses.</p>`;
      return;
    }
    for (const [key, order] of Object.entries(SHIPYARD)) {
      html += `
        <div class="yard-option">
          <div class="build-head"><b>${order.label}</b><span class="chips">${costChips(order.cost, order.days)}</span></div>
          <div class="muted small">${order.desc}</div>
          <div class="yard-row"><button class="primary" data-pv="shipyard" data-key="${key}">Lancer</button><span class="muted small reason"></span></div>
        </div>`;
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
        const chips = gainChips({ minerais: out.minerais || 0, energie: (out.energie || 0) - (def.energy || 0), biomasse: out.biomasse || 0, velarine: out.velarine || 0 });
        const housing = def.housing ? gainChips({ housing: def.housing }) : '';
        if (chips || housing) html += `<div class="chips">${chips}${chips ? '<span class="muted small">/ jour</span>' : ''}${housing}</div>`;
      }
      if (def.buildable !== false && colony) html += `<button class="icon-btn" data-pv="demolish" title="Démolir (rembourse la moitié du coût)">${icon('demolir')}Démolir</button>`;
    } else if (!colony) {
      html += '<p class="muted small">Pas de colonie sur cette planète.</p>';
    } else {
      const types = buildableTypes(tile, surface);
      if (!types.length) html += '<p class="muted small">Rien à construire ici.</p>';
      html += '<div class="build-grid">';
      for (const type of types) {
        const def = BUILDINGS[type];
        html += `
          <button class="build-card" data-pv="build" data-type="${type}" title="${def.label} : ${def.desc}">
            <span class="big-icon">${icon(type)}</span>
            <span class="card-name">${def.label}</span>
            <span class="chips">${gainChips(previewBuilding(colony, surface, tile, type))}</span>
            <span class="chips cost">${costChips(def.cost, def.days)}</span>
            <span class="reason"></span>
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
    if (state.colony?.construction) {
      const c = state.colony.construction;
      const view = state.tileViews[c.tileIndex];
      if (view.building) view.building.scale.y = 0.2 + 0.8 * (1 - c.daysLeft / BUILDINGS[c.type].days);
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
      renderColonyPanel();
      refreshButtons();
    },
  };
}
