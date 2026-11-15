// Matériaux réalistes : reflets, peintre de textures PBR procédurales, coordonnées de texture, usure.
import * as THREE from 'three';
import { createRng } from '../rng.js';
import { canvasTexture } from '../textures.js';

// --- Environnement de reflets (partagé) : ciel sombre, soleil chaud, bande galactique ---

let spaceEnvTexture = null;
export function spaceEnv() {
  if (spaceEnvTexture) return spaceEnvTexture;
  spaceEnvTexture = canvasTexture(512, 256, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#6a7ea6');
    sky.addColorStop(0.42, '#2a3550');
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
    const sun = ctx.createRadialGradient(w * 0.32, h * 0.28, 0, w * 0.32, h * 0.28, 95);
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

export function std(options) {
  return new THREE.MeshStandardMaterial({ envMap: spaceEnv(), side: THREE.DoubleSide, ...options });
}
export function basic(color, options = {}) {
  return new THREE.MeshBasicMaterial({ color, ...options });
}

// --- Textures procédurales : couleur + carte d'émission (glyphes, veines, hublots) ---

const css = (color) => `#${color.getHexString()}`;
export function shade(color, l) {
  return css(color.clone().offsetHSL(0, 0, l));
}
export function rgba(color, a) {
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
export function glyph(rng, contexts, x, y, s) {
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

// --- Matériaux réalistes : jeux de textures PBR procédurales (couleur, relief, rugosité/métal, émission) ---
// Chaque jeu est dessiné une seule fois par espèce (archétype + teinte de référence) et partagé par tous
// ses vaisseaux : la teinte propre à chaque vaisseau passe par material.color (rapport à la teinte peinte).
// Les CanvasTexture fonctionnent dans tous les contextes WebGL (amas, vignettes) : chaque renderer les
// téléverse de son côté.

const TILE = 0.5; // taille, en unités du modèle, d'une répétition de texture
const SETS = new Map();
const NS = 256;
let NOISE = null;

function smooth01(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

// Bruit fractal raccordable (se répète sans couture), calculé une fois.
function noiseField() {
  if (NOISE) return NOISE;
  const rng = createRng(90210);
  NOISE = new Float32Array(NS * NS);
  let amp = 0.5;
  let total = 0;
  for (const g of [4, 8, 16, 32, 64, 128]) {
    const lat = new Float32Array(g * g).map(() => rng.next());
    for (let y = 0; y < NS; y++) {
      const fy = (y / NS) * g;
      const y0 = Math.floor(fy);
      const ty = smooth01(fy - y0);
      const y1 = (y0 + 1) % g;
      for (let x = 0; x < NS; x++) {
        const fx = (x / NS) * g;
        const x0 = Math.floor(fx);
        const tx = smooth01(fx - x0);
        const x1 = (x0 + 1) % g;
        const a = lat[y0 * g + x0] + (lat[y0 * g + x1] - lat[y0 * g + x0]) * tx;
        const b = lat[y1 * g + x0] + (lat[y1 * g + x1] - lat[y1 * g + x0]) * tx;
        NOISE[y * NS + x] += amp * (a + (b - a) * ty);
      }
    }
    total += amp;
    amp *= 0.55;
  }
  for (let i = 0; i < NOISE.length; i++) NOISE[i] /= total;
  return NOISE;
}

export const gray = (v, a = 1) => {
  const k = Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgba(${k},${k},${k},${a})`;
};

// Peintre : cinq calques de même taille. c = couleur, h = relief (gris moyen = 0), r = rugosité,
// m = métal, e = émission (blanc, teinté par material.emissive).
export function painter(size, seed, base, rough, metal) {
  const P = { S: size, rng: createRng(seed), cv: {} };
  for (const k of ['c', 'h', 'r', 'm', 'e']) {
    P.cv[k] = makeCanvas(size, size);
    P[k] = P.cv[k].getContext('2d', { willReadFrequently: true }); // canvas en mémoire : lecture des pixels rapide
  }
  P.c.fillStyle = css(base);
  P.h.fillStyle = gray(0.5);
  P.r.fillStyle = gray(rough);
  P.m.fillStyle = gray(metal);
  P.e.fillStyle = '#000';
  for (const k of ['c', 'h', 'r', 'm', 'e']) P[k].fillRect(0, 0, size, size);
  return P;
}

// Dessine un motif et ses copies décalées quand il déborde, pour que la texture se raccorde.
export function wrap(P, x, y, w, h, fn) {
  const S = P.S;
  const xs = [0];
  const ys = [0];
  if (x < 0) xs.push(S);
  if (x + w > S) xs.push(-S);
  if (y < 0) ys.push(S);
  if (y + h > S) ys.push(-S);
  for (const dx of xs) for (const dy of ys) fn(x + dx, y + dy);
}

export function rivet(P, x, y, r) {
  wrap(P, x - r * 2, y - r * 2, r * 4, r * 4, (X, Y) => {
    X += r * 2;
    Y += r * 2;
    const hg = P.h.createRadialGradient(X - r * 0.2, Y - r * 0.2, 0, X, Y, r * 1.3);
    hg.addColorStop(0, gray(0.85));
    hg.addColorStop(0.7, gray(0.62));
    hg.addColorStop(1, gray(0.5, 0));
    P.h.fillStyle = hg;
    P.h.fillRect(X - r * 1.5, Y - r * 1.5, r * 3, r * 3);
    P.c.fillStyle = 'rgba(0,0,0,0.35)';
    P.c.beginPath();
    P.c.arc(X + r * 0.25, Y + r * 0.3, r * 1.1, 0, Math.PI * 2);
    P.c.fill();
    P.c.fillStyle = 'rgba(255,240,220,0.22)';
    P.c.beginPath();
    P.c.arc(X - r * 0.15, Y - r * 0.2, r * 0.75, 0, Math.PI * 2);
    P.c.fill();
    P.r.fillStyle = gray(0, 0.25);
    P.r.beginPath();
    P.r.arc(X, Y, r, 0, Math.PI * 2);
    P.r.fill();
  });
}

// Grille de plaques : joints creusés, arêtes, nuances et rivets.
export function panels(P, o) {
  const { rows, cols, stagger = 0, seam = 2, lift = 0.06, shade: sv = 0.06, roughVar = 0.08, rivetR = 0, rivetStep = 12, jitter = 0 } = o;
  const S = P.S;
  const ph = S / rows;
  const pw = S / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * pw * stagger;
    let x = off;
    const widths = [];
    // Plaques de largeurs inégales si `jitter` : la somme reste S pour garder le raccord.
    let left = S;
    for (let k = 0; k < cols; k++) {
      const w = k === cols - 1 ? left : Math.max(pw * 0.4, pw * (1 + P.rng.range(-jitter, jitter)));
      widths.push(Math.min(w, left));
      left -= widths[k];
    }
    for (const w of widths) {
      const y = r * ph;
      const s = P.rng.range(-sv, sv);
      const rv = P.rng.range(-roughVar, roughVar);
      const hl = lift * P.rng.range(0.6, 1.2);
      wrap(P, x, y, w, ph, (X, Y) => {
        P.c.fillStyle = s > 0 ? `rgba(255,255,255,${s})` : `rgba(0,0,0,${-s})`;
        P.c.fillRect(X, Y, w, ph);
        P.r.fillStyle = rv > 0 ? gray(1, rv) : gray(0, -rv);
        P.r.fillRect(X, Y, w, ph);
        P.h.fillStyle = gray(0.5 + hl);
        P.h.fillRect(X + seam, Y + seam, w - seam * 2, ph - seam * 2);
        // Joint : creux sombre, lèvre claire en haut à gauche.
        P.h.fillStyle = gray(0.3);
        P.h.fillRect(X, Y, w, seam * 0.7);
        P.h.fillRect(X, Y, seam * 0.7, ph);
        P.c.fillStyle = 'rgba(0,0,0,0.45)';
        P.c.fillRect(X, Y, w, Math.max(1, seam * 0.6));
        P.c.fillRect(X, Y, Math.max(1, seam * 0.6), ph);
        P.c.fillStyle = 'rgba(255,255,255,0.08)';
        P.c.fillRect(X, Y + seam * 0.6, w, 1);
        P.c.fillRect(X + seam * 0.6, Y, 1, ph);
        P.r.fillStyle = gray(1, 0.3);
        P.r.fillRect(X, Y, w, seam);
      });
      if (rivetR) {
        const n = Math.max(1, Math.floor((w - rivetStep) / rivetStep));
        for (let i = 0; i <= n; i++) {
          const rx = x + rivetStep * 0.5 + (i * (w - rivetStep)) / n;
          rivet(P, rx, y + rivetStep * 0.45, rivetR);
          rivet(P, rx, y + ph - rivetStep * 0.45, rivetR);
        }
      }
      x += w;
    }
  }
}

export function blobs(P, n, color, alpha, rmin, rmax, roughAdd = 0, metalAdd = 0) {
  for (let i = 0; i < n; i++) {
    const r = P.rng.range(rmin, rmax);
    const x0 = P.rng.range(0, P.S);
    const y0 = P.rng.range(0, P.S);
    const sy = P.rng.range(0.5, 1.6);
    const a = alpha * P.rng.range(0.4, 1);
    wrap(P, x0 - r, y0 - r * sy, r * 2, r * 2 * sy, (X, Y) => {
      const cx = X + r;
      const cy = Y + r * sy;
      for (const [ctx, col, k] of [[P.c, color, a], [P.r, roughAdd > 0 ? '255,255,255' : '0,0,0', Math.abs(roughAdd) * a], [P.m, metalAdd > 0 ? '255,255,255' : '0,0,0', Math.abs(metalAdd) * a]]) {
        if (!k) continue;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(${col},${k})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, sy);
        ctx.translate(-cx, -cy);
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
      }
    });
  }
}

// Coulures verticales (rouille, suie).
export function streaks(P, n, color, alpha, len, width = [1, 5]) {
  for (let i = 0; i < n; i++) {
    const x = P.rng.range(0, P.S);
    const y = P.rng.range(0, P.S);
    const h = P.rng.range(len[0], len[1]);
    const w = P.rng.range(width[0], width[1]);
    wrap(P, x, y, w, h, (X, Y) => {
      const g = P.c.createLinearGradient(0, Y, 0, Y + h);
      g.addColorStop(0, `rgba(${color},${alpha})`);
      g.addColorStop(1, `rgba(${color},0)`);
      P.c.fillStyle = g;
      P.c.fillRect(X, Y, w, h);
      P.r.fillStyle = gray(1, 0.15);
      P.r.fillRect(X, Y, w, h * 0.6);
    });
  }
}

// Rayures : métal mis à nu (plus brillant, plus métallique).
export function scratches(P, n, len, alpha = 0.3) {
  for (let i = 0; i < n; i++) {
    const x = P.rng.range(0, P.S);
    const y = P.rng.range(0, P.S);
    const a = P.rng.range(0, Math.PI * 2);
    const l = P.rng.range(len * 0.3, len);
    const dx = Math.cos(a) * l;
    const dy = Math.sin(a) * l;
    wrap(P, Math.min(x, x + dx), Math.min(y, y + dy), Math.abs(dx), Math.abs(dy), (X, Y) => {
      const sx = X + (dx < 0 ? -dx : 0);
      const sy = Y + (dy < 0 ? -dy : 0);
      for (const [ctx, style, w] of [[P.c, `rgba(255,250,240,${alpha})`, 1], [P.r, gray(0, 0.5), 1.4], [P.m, gray(1, 0.6), 1.4], [P.h, gray(0.38, 0.6), 1]]) {
        ctx.strokeStyle = style;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + dx, sy + dy);
        ctx.stroke();
      }
    });
  }
}

// Hublots : verre sombre en retrait, la plupart allumés.
export function windows(P, x, y, count, w, h, gap, lit = 0.75) {
  for (let i = 0; i < count; i++) {
    const X = x + i * (w + gap);
    P.h.fillStyle = gray(0.28);
    P.h.fillRect(X - 1, y - 1, w + 2, h + 2);
    P.c.fillStyle = 'rgba(30,30,34,1)';
    P.c.fillRect(X - 1.5, y - 1.5, w + 3, h + 3);
    P.c.fillStyle = '#0b0f16';
    P.c.fillRect(X, y, w, h);
    P.r.fillStyle = gray(0.08);
    P.r.fillRect(X, y, w, h);
    P.m.fillStyle = gray(0);
    P.m.fillRect(X, y, w, h);
    if (P.rng.chance(lit)) {
      P.e.fillStyle = gray(P.rng.range(0.65, 1));
      P.e.fillRect(X, y, w, h);
      P.c.fillStyle = 'rgba(255,240,200,0.5)';
      P.c.fillRect(X, y, w, h);
    }
  }
}

export function stencil(P, text, x, y, px, color, alpha = 0.7, font = 'monospace') {
  P.c.font = `bold ${px}px ${font}`;
  P.c.fillStyle = `rgba(${color},${alpha})`;
  P.c.fillText(text, x, y);
  P.r.font = P.c.font;
  P.r.fillStyle = gray(0, 0.15);
  P.r.fillText(text, x, y);
}

// Glyphe gravé : creux dans le relief, trait sombre, lueur dans l'émission.
export function engraved(P, x, y, s, glowAlpha = 1) {
  P.h.strokeStyle = gray(0.25);
  P.h.lineWidth = 2.2;
  P.c.strokeStyle = 'rgba(40,24,6,0.7)';
  P.c.lineWidth = 1.8;
  P.e.strokeStyle = gray(1, glowAlpha);
  P.e.lineWidth = 1.4;
  glyph(P.rng, [P.h, P.c, P.e], x, y, s);
}

// Réseau de veines qui se ramifient (sur les calques donnés).
export function veins(P, layers, x, y, a, steps, width, step = 6) {
  const pts = [[x, y]];
  for (let s = 0; s < steps; s++) {
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    a += P.rng.range(-0.5, 0.5);
    pts.push([x, y]);
    if (width > 0.8 && P.rng.chance(0.07)) veins(P, layers, x, y, a + P.rng.pick([-1, 1]) * 0.9, Math.floor(steps * 0.5), width * 0.6, step);
  }
  for (const [ctx, style, wk] of layers) {
    ctx.strokeStyle = style;
    ctx.lineWidth = width * wk;
    ctx.lineCap = 'round';
    for (const [dx, dy] of [[0, 0], [P.S, 0], [-P.S, 0], [0, P.S], [0, -P.S]]) {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px + dx, py + dy) : ctx.moveTo(px + dx, py + dy)));
      ctx.stroke();
    }
  }
}

// Termine un jeu : grain de bruit, carte normale tirée du relief, rugosité (G) + métal (B) réunis.
export function finish(P, o = {}) {
  const { grain = 0.1, speck = 0.04, roughGrain = 0.12, heightGrain = 0.06, normal = 1.5, patina = null, blur = 0.8, noEmit = false } = o;
  const S = P.S;
  const N = noiseField();
  const get = (k) => P[k].getImageData(0, 0, S, S);
  const C = get('c');
  const R = get('r');
  const M = get('m');
  // Relief adouci avant le calcul des normales (la carte doit rester raccordable : on recopie autour).
  const hb = makeCanvas(S, S);
  const hx = hb.getContext('2d', { willReadFrequently: true });
  hx.filter = `blur(${blur}px)`;
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) hx.drawImage(P.cv.h, dx, dy);
  const H = hx.getImageData(0, 0, S, S);
  const c = C.data;
  const r = R.data;
  const m = M.data;
  const h = H.data;
  const pat = patina ? [patina.color.r * 255, patina.color.g * 255, patina.color.b * 255] : null;
  for (let y = 0; y < S; y++) {
    const iy1 = Math.floor((y * NS) / S / 2) % NS;
    const iy2 = (Math.floor((y * NS * 2) / S) + 97) % NS;
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const n1 = N[iy1 * NS + (Math.floor((x * NS) / S / 2) % NS)];
      const n2 = N[iy2 * NS + ((Math.floor((x * NS * 2) / S) + 41) % NS)];
      const hash = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
      let k = 1 + (n1 * 0.6 + n2 * 0.4 - 0.5) * grain * 2 + (hash - 0.5) * speck;
      if (pat) {
        // Patine (vert-de-gris) dans les creux du bruit : mate et non métallique.
        const p = smooth01((n1 * 0.7 + n2 * 0.3 - patina.threshold) / patina.soft) * patina.amount;
        if (p > 0) {
          for (let ch = 0; ch < 3; ch++) c[i + ch] = c[i + ch] * (1 - p) + pat[ch] * (0.75 + n2 * 0.5) * p;
          r[i] = r[i] * (1 - p) + 225 * p;
          m[i] = m[i] * (1 - p) + 20 * p;
        }
      }
      c[i] = Math.min(255, c[i] * k);
      c[i + 1] = Math.min(255, c[i + 1] * k);
      c[i + 2] = Math.min(255, c[i + 2] * k);
      r[i] = Math.min(255, Math.max(0, r[i] + (n2 - 0.5) * roughGrain * 255 + (hash - 0.5) * 12));
      h[i] = Math.min(255, Math.max(0, h[i] + (n2 - 0.5) * heightGrain * 255 + (hash - 0.5) * heightGrain * 40));
    }
  }
  P.c.putImageData(C, 0, 0);
  // Normale : (gauche - droite, bas - haut, 1) — l'axe V de la texture monte (canvas inversé).
  const nc = makeCanvas(S, S);
  const nx = nc.getContext('2d');
  const NI = nx.createImageData(S, S);
  const orm = makeCanvas(S, S);
  const ox = orm.getContext('2d');
  const OI = ox.createImageData(S, S);
  const hv = (x, y) => h[(((y + S) % S) * S + ((x + S) % S)) * 4];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const dx = ((hv(x - 1, y) - hv(x + 1, y)) / 255) * normal;
      const dy = ((hv(x, y + 1) - hv(x, y - 1)) / 255) * normal;
      const l = Math.hypot(dx, dy, 1);
      NI.data[i] = (dx / l) * 127.5 + 127.5;
      NI.data[i + 1] = (dy / l) * 127.5 + 127.5;
      NI.data[i + 2] = (1 / l) * 127.5 + 127.5;
      NI.data[i + 3] = 255;
      OI.data[i] = 255;
      OI.data[i + 1] = Math.max(10, r[i]);
      OI.data[i + 2] = m[i];
      OI.data[i + 3] = 255;
    }
  }
  nx.putImageData(NI, 0, 0);
  ox.putImageData(OI, 0, 0);
  const linear = (canvas) => {
    const t = toTexture(canvas);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  };
  return {
    map: toTexture(P.cv.c),
    normalMap: linear(nc),
    orm: linear(orm),
    emissiveMap: noEmit ? null : toTexture(P.cv.e),
    normal: o.normalScale ?? 1,
  };
}

export function cachedSet(key, make) {
  if (!SETS.has(key)) SETS.set(key, make());
  return SETS.get(key);
}


// Couleur à donner au matériau pour que la texture (peinte en `base`) prenne la teinte `target`.
export function tintFor(target, base) {
  const c = new THREE.Color(target);
  c.r = Math.min(3, c.r / Math.max(0.02, base.r));
  c.g = Math.min(3, c.g / Math.max(0.02, base.g));
  c.b = Math.min(3, c.b / Math.max(0.02, base.b));
  return c;
}

// Matériau PBR texturé. uv : 'tile' (répétition à l'échelle du modèle) ou 'fit' (une texture par face).
export function pbr(set, o = {}) {
  const mat = new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap, normalScale: new THREE.Vector2(set.normal, set.normal),
    roughnessMap: set.orm, metalnessMap: set.orm, roughness: o.roughness ?? 1, metalness: o.metalness ?? 1,
    emissiveMap: set.emissiveMap, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1,
    color: o.color ?? 0xffffff, envMap: spaceEnv(), envMapIntensity: o.env ?? 1, vertexColors: true, side: THREE.DoubleSide,
  });
  mat.userData = { uv: o.uv ?? 'tile', weather: true };
  return mat;
}

// Variante d'un matériau texturé : même textures, autre teinte ou réglages.
export function variant(mat, multiply, o = {}) {
  const v = mat.clone();
  if (multiply) v.color.multiply(new THREE.Color(multiply));
  Object.assign(v, o);
  return v;
}

// --- Coordonnées de texture à l'échelle (une répétition = TILE unités), selon la forme ---

function scaleUV(geometry, su, sv) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}

// Projection sur la face dominante (formes à facettes : blocs, ailes, polyèdres).
function boxProjectUV(geometry, fit) {
  const pos = geometry.attributes.position;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nor = geometry.attributes.normal;
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const size = new THREE.Vector3().subVectors(max, min);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let a;
    let b;
    let flip;
    if (ax >= ay && ax >= az) (a = 2), (b = 1), (flip = nor.getX(i) > 0);
    else if (ay >= az) (a = 0), (b = 2), (flip = nor.getY(i) < 0);
    else (a = 0), (b = 1), (flip = nor.getZ(i) < 0);
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const mn = [min.x, min.y, min.z];
    const sz = [size.x || 1, size.y || 1, size.z || 1];
    // Face opposée : U inversé, pour que les inscriptions ne soient pas en miroir.
    const u = fit ? (p[a] - mn[a]) / sz[a] : p[a] / TILE;
    uv[i * 2] = flip ? (fit ? 1 - u : -u) : u;
    uv[i * 2 + 1] = fit ? (p[b] - mn[b]) / sz[b] : p[b] / TILE;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

const UV_DONE = new WeakSet();
function prepareUV(geometry, mode) {
  if (UV_DONE.has(geometry) || !geometry.attributes.uv) return;
  UV_DONE.add(geometry);
  const p = geometry.parameters ?? {};
  const around = (r) => Math.max(1, Math.round((2 * Math.PI * r) / TILE));
  if (mode === 'fit') return boxProjectUV(geometry, true);
  switch (geometry.type) {
    case 'LatheGeometry': {
      // Abscisse curviligne du profil : la texture ne s'étire plus sur les coques longues.
      const pts = p.points;
      const n = pts.length;
      const acc = [0];
      for (let j = 1; j < n; j++) acc.push(acc[j - 1] + pts[j].distanceTo(pts[j - 1]));
      const rmax = Math.max(...pts.map((q) => q.x));
      const uv = geometry.attributes.uv;
      const su = around(rmax);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, acc[i % n] / TILE);
      uv.needsUpdate = true;
      return;
    }
    case 'CapsuleGeometry':
      return scaleUV(geometry, around(p.radius), (p.length + p.radius * 2) / TILE);
    case 'SphereGeometry':
      return scaleUV(geometry, around((p.radius * p.phiLength) / (2 * Math.PI)), Math.max(0.25, (p.radius * p.thetaLength) / TILE));
    case 'TorusGeometry':
      return scaleUV(geometry, around(p.radius), Math.max(0.2, (2 * Math.PI * p.tube) / TILE));
    case 'CylinderGeometry':
    case 'ConeGeometry':
      return scaleUV(geometry, around(Math.max(p.radiusTop ?? 0, p.radiusBottom ?? p.radius ?? 0)), p.height / TILE);
    case 'TubeGeometry':
      return;
    default:
      return boxProjectUV(geometry, false);
  }
}

// Couleurs de sommet : suie près des réacteurs, ventre un peu plus sombre (occlusion grossière).
export function weatherShip(ship, rearZ, L, R) {
  ship.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(ship.matrixWorld).invert();
  const local = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const seen = new Set();
  const span = L * 0.3;
  ship.traverse((o) => {
    if (!o.isMesh || !o.material.userData?.weather) return;
    prepareUV(o.geometry, o.material.userData.uv);
    if (seen.has(o.geometry)) o.geometry = o.geometry.clone();
    seen.add(o.geometry);
    local.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(local);
      const soot = 0.32 + 0.68 * smooth01((v.z - rearZ) / span);
      const belly = 1 - 0.12 * smooth01(-v.y / (R * 1.5));
      const k = soot * belly;
      col[i * 3] = k;
      col[i * 3 + 1] = k * (0.97 + 0.03 * soot);
      col[i * 3 + 2] = k * (0.92 + 0.08 * soot);
    }
    o.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  });
}
