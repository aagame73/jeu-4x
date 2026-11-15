// Animations de la page titre, posées sur l'image (public/titre.jpg, 1584 × 672) :
// - des nuages qui glissent lentement sur la planète (canvas 2D, découpé au cercle de l'horizon) ;
// - des vaisseaux du jeu en orbite autour de l'Arche (petite scène Three.js transparente).
// Tout est exprimé en pixels de l'image : la « scène » HTML a les proportions de l'image et la
// couvre à l'écran, donc les orbites restent sur l'Arche quelle que soit la fenêtre.
import * as THREE from 'three';
import { createShip, animateShip, SHIP_ACCENTS } from './ships.js';
import { SPECIES } from './config.js';

export const IMAGE_W = 1584;
export const IMAGE_H = 672;

// Horizon de la planète, relevé sur l'image : un cercle (en pixels de l'image).
const PLANET = { x: 792, y: 2253, r: 1760 };
// Centre de l'Arche et demi-largeur de son anneau horizontal (pixels de l'image).
const ARCHE = { x: 787, y: 290, halfWidth: 318 };

// ---------- Nuages ----------
const CLOUD_TOP = Math.floor(PLANET.y - PLANET.r) - 4; // haut de la planète
const CLOUD_H = IMAGE_H - CLOUD_TOP;
const CLOUD_SPEED = 9; // pixels de l'image par seconde

// Bruit de valeur fractal, périodique en x (la bande se répète sans couture).
function cloudTile(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const hash = (x, y, o) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + o * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x, y, period, o) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const v = (i, j) => hash(((x0 + i) % period + period) % period, y0 + j, o);
    return (v(0, 0) * (1 - sx) + v(1, 0) * sx) * (1 - sy) + (v(0, 1) * (1 - sx) + v(1, 1) * sx) * sy;
  };
  for (let y = 0; y < h; y++) {
    // vers l'horizon, les nuages sont vus de biais : on les étire en hauteur
    const depth = y / h;
    for (let x = 0; x < w; x++) {
      let n = 0;
      let amp = 0.55;
      let freq = 6;
      for (let o = 0; o < 5; o++) {
        n += amp * noise((x / w) * freq, (y / h) * freq * (0.6 + depth * 1.4) * 0.5, freq, o);
        amp *= 0.5;
        freq *= 2;
      }
      const a = Math.max(0, Math.min(1, (n - 0.4) * 2.6));
      const i = (y * w + x) * 4;
      img.data[i] = 225;
      img.data[i + 1] = 238;
      img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Masque : le disque de la planète, estompé près de l'horizon (l'atmosphère reste nette).
function planetMask(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const cy = PLANET.y - CLOUD_TOP;
  const g = ctx.createRadialGradient(PLANET.x, cy, PLANET.r - 260, PLANET.x, cy, PLANET.r - 6);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.75, 'rgba(0,0,0,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(PLANET.x, cy, PLANET.r - 6, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

function createClouds(stage) {
  const canvas = document.createElement('canvas');
  canvas.className = 'title-clouds';
  canvas.width = IMAGE_W;
  canvas.height = CLOUD_H;
  canvas.style.top = `${(CLOUD_TOP / IMAGE_H) * 100}%`;
  canvas.style.height = `${(CLOUD_H / IMAGE_H) * 100}%`;
  stage.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const tile = cloudTile(1024, CLOUD_H);
  const mask = planetMask(IMAGE_W, CLOUD_H);
  return {
    draw(time) {
      const off = (time * CLOUD_SPEED) % tile.width;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, IMAGE_W, CLOUD_H);
      for (let x = off - tile.width; x < IMAGE_W; x += tile.width) ctx.drawImage(tile, x, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0);
    },
    dispose() {
      canvas.remove();
    },
  };
}

// ---------- Vaisseaux en orbite ----------
// Monde 3D : 1 unité = 100 pixels de l'image, origine au centre de l'image, y vers le haut.
// La caméra est réglée pour que le plan z = 0 recouvre exactement l'image.
const U = 100;
const FOV = 30;
const toWorld = (px, py) => new THREE.Vector2((px - IMAGE_W / 2) / U, (IMAGE_H / 2 - py) / U);
const ORBIT_TILT = THREE.MathUtils.degToRad(21); // l'anneau de l'Arche est vu sous cet angle
const KINDS = ['sonde', 'corvette', 'fregate', 'colonie', 'transport', 'sonde'];

function createFleet(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'title-ships';
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, IMAGE_W / IMAGE_H, 0.1, 100);
  camera.position.z = IMAGE_H / 2 / U / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  scene.add(new THREE.AmbientLight(0x8090b0, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6); // lumière dorée venue du haut à gauche
  sun.position.set(-6, 5, 6);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x5fe3ff, 1.2); // reflet cyan de l'atmosphère
  rim.position.set(2, -6, -2);
  scene.add(rim);

  const center = toWorld(ARCHE.x, ARCHE.y);
  const halfWidth = ARCHE.halfWidth / U;
  const styles = [null, ...Object.values(SPECIES).map((s) => s.shipStyle).filter(Boolean)];
  const ships = KINDS.map((kind, i) => {
    const style = styles[Math.floor(Math.random() * styles.length)];
    const accent = SHIP_ACCENTS[i % SHIP_ACCENTS.length];
    const model = createShip(1000 + Math.floor(Math.random() * 1e6), accent, '', kind, style);
    // matériaux propres à ce vaisseau, pour pouvoir l'estomper (certains sont partagés)
    const mats = [];
    model.traverse((o) => {
      if (!o.material) return;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      for (const m of [o.material].flat()) {
        m.userData.baseOpacity = m.opacity;
        m.transparent = true;
        mats.push(m);
      }
    });
    const holder = new THREE.Group();
    holder.add(model);
    holder.scale.setScalar(0.28 + Math.random() * 0.08);
    scene.add(holder);
    return {
      model,
      holder,
      mats,
      radius: 3.7 + i * 0.36 + Math.random() * 0.2,
      speed: (0.07 + Math.random() * 0.05) * (i % 3 === 2 ? -1 : 1), // quelques-uns tournent en sens inverse
      phase: (i / KINDS.length) * Math.PI * 2 + Math.random() * 0.5,
      lift: (Math.random() - 0.5) * 0.5, // décalage vertical de l'orbite
      tilt: ORBIT_TILT + (Math.random() - 0.5) * 0.12,
      opacity: -1,
    };
  });

  const pos = new THREE.Vector3();
  const next = new THREE.Vector3();
  const orbitPoint = (s, angle, out) =>
    out.set(
      center.x + Math.cos(angle) * s.radius,
      center.y + s.lift - Math.sin(angle) * s.radius * Math.sin(s.tilt),
      Math.sin(angle) * s.radius * Math.cos(s.tilt),
    );

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(w, h, false);
  }
  resize();

  return {
    resize,
    draw(time) {
      for (const s of ships) {
        const angle = s.phase + time * s.speed;
        orbitPoint(s, angle, pos);
        orbitPoint(s, angle + Math.sign(s.speed) * 0.05, next);
        s.holder.position.copy(pos);
        s.holder.lookAt(next);
        // Derrière l'Arche (z < 0, au-dessus de sa coque) : le vaisseau disparaît en fondu.
        const behind = THREE.MathUtils.smoothstep(-pos.z, 0.2, 1.4);
        const overHull = 1 - THREE.MathUtils.smoothstep(Math.abs(pos.x - center.x), halfWidth - 0.4, halfWidth + 0.5);
        const opacity = 1 - behind * overHull;
        if (Math.abs(opacity - s.opacity) > 0.01) {
          s.opacity = opacity;
          for (const m of s.mats) m.opacity = m.userData.baseOpacity * opacity;
          s.holder.visible = opacity > 0.02;
        }
        animateShip(s.model, time, 0.75);
      }
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}

// Lance les deux animations dans `stage` ; renvoie stop() qui arrête tout et libère la mémoire.
export function startTitleFx(stage) {
  const clouds = createClouds(stage);
  let fleet = null;
  try {
    fleet = createFleet(stage);
  } catch (e) {
    console.warn('Page titre : vaisseaux désactivés (WebGL indisponible)', e);
  }
  const t0 = performance.now();
  let frame = 0;
  const loop = () => {
    const time = (performance.now() - t0) / 1000;
    clouds.draw(time);
    fleet?.draw(time);
    frame = requestAnimationFrame(loop);
  };
  loop();
  const onResize = () => fleet?.resize();
  window.addEventListener('resize', onResize);
  return function stop() {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', onResize);
    clouds.dispose();
    fleet?.dispose();
  };
}
