// Fond du ciel : une Voie lactée procédurale (bande lumineuse, bulbe, nuages de poussière)
// peinte sur une grande sphère, plus des milliers d'étoiles lointaines concentrées dans la bande.
import * as THREE from 'three';

const SKY_RADIUS = 2500;

// Bruit de valeur 3D, échantillonné sur la sphère pour éviter toute couture.
function createNoise3(seed) {
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
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
  return (x, y, z, octaves = 5) => {
    let sum = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
      sum += noise(x * freq, y * freq, z * freq) * amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum;
  };
}

// Texture équirectangulaire : la bande galactique suit l'équateur de la sphère.
function paintMilkyWay(width, height) {
  const fbm = createNoise3(1337);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  const coreLon = Math.PI * 0.35; // direction du bulbe central

  for (let py = 0; py < height; py++) {
    const lat = (0.5 - py / height) * Math.PI;
    const cosLat = Math.cos(lat);
    for (let px = 0; px < width; px++) {
      const lon = (px / width) * Math.PI * 2;
      const x = cosLat * Math.cos(lon), y = Math.sin(lat), z = cosLat * Math.sin(lon);

      // Ondulation de la bande et épaisseur variable.
      const warp = (fbm(x * 1.5, y * 1.5, z * 1.5, 3) - 0.5) * 0.16;
      const toCore = Math.acos(Math.max(-1, Math.min(1, Math.cos(lon - coreLon))));
      const coreBoost = Math.exp(-(toCore * toCore) / 0.35);
      const width0 = 0.11 + coreBoost * 0.1;
      const band = Math.exp(-((lat + warp) ** 2) / (2 * width0 * width0));
      const halo = Math.exp(-((lat + warp) ** 2) / 0.5) * 0.25;

      const cloud = fbm(x * 4, y * 4, z * 4);
      const fine = fbm(x * 14 + 5, y * 14, z * 14, 4);
      let light = (band * (0.45 + cloud * 0.9) + halo * cloud) * (0.55 + coreBoost * 0.9);
      light *= 0.75 + fine * 0.5;

      // Couloirs de poussière sombre le long du plan galactique.
      const dustBand = Math.exp(-((lat + warp * 0.6 - 0.01) ** 2) / (2 * 0.035 * 0.035));
      const dust = Math.max(0, fbm(x * 7 + 11, y * 7, z * 7) - 0.38) * 2.6;
      light *= 1 - Math.min(0.85, dustBand * dust * (0.6 + coreBoost * 0.5));

      // Couleur : bulbe chaud, disque bleuté, quelques nuances de nébuleuses.
      const tint = fbm(x * 2.5 + 3, y * 2.5, z * 2.5, 3);
      const r = light * (0.62 + coreBoost * 0.45 + tint * 0.15);
      const g = light * (0.6 + coreBoost * 0.28);
      const b = light * (0.82 - coreBoost * 0.2 + (1 - tint) * 0.12);

      const i = (py * width + px) * 4;
      img.data[i] = Math.min(255, 6 + r * 210);
      img.data[i + 1] = Math.min(255, 7 + g * 210);
      img.data[i + 2] = Math.min(255, 14 + b * 225);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Étoiles lointaines : un tiers partout, le reste resserré autour de la bande.
function createStarfield(count, size, brightness) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [new THREE.Color(0xffd2a1), new THREE.Color(0xfff4e8), new THREE.Color(0xcad8ff), new THREE.Color(0xa9c1ff)];
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const lon = Math.random() * Math.PI * 2;
    const lat = Math.random() < 0.3 ? Math.asin(Math.random() * 2 - 1) : (Math.random() + Math.random() + Math.random() - 1.5) * 0.16;
    const r = SKY_RADIUS * 0.9;
    positions.set([r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon)], i * 3);
    c.copy(palette[Math.floor(Math.random() * palette.length)]).multiplyScalar(brightness * (0.4 + Math.random() * 0.6));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false }),
  );
}

export function createSky() {
  const sky = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 64, 32),
    new THREE.MeshBasicMaterial({ map: paintMilkyWay(2048, 1024), side: THREE.BackSide, depthWrite: false }),
  );
  sky.add(sphere, createStarfield(16000, 1, 0.75), createStarfield(1200, 2, 1));
  // La bande traverse le ciel en biais par rapport au plan de l'amas.
  sky.rotation.set(0.9, 0.3, 0.35);
  sky.renderOrder = -10;
  return sky;
}

export { SKY_RADIUS };
