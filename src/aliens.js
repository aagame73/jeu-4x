// Portraits animés des espèces, dessinés en Canvas 2D (aucune image externe).
// Usage : const p = createAlienPortrait(canvas, 'vaskhar'); p.setSpeaking(true); p.destroy();
// Repère de dessin : unité = moitié du plus petit côté du canevas, origine au centre,
// y vers le bas ; la tête est vers y ≈ -0.2, le buste descend jusqu'au bas (s.bot).

const ACCENTS = {
  vaskhar: '#ffb347',
  ondesiens: '#5fd3ff',
  keltirr: '#fff07a',
  synodes: '#c6a0ff',
  orrhaides: '#cfe8ff',
  thrennes: '#ff6f6f',
  liseurs: '#ffd166',
  ashkari: '#e0a070',
  'sans-espece': '#7cff9e',
};

const FPS_MAX = 40;

// ---------- Outils ----------

// Pseudo-hasard stable (même entrée → même valeur dans [0, 1[).
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function rgba(hex, a) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function rad(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// Symétrique horizontal d'une liste de points.
const mirror = (pts) => pts.map(([x, y]) => [-x, y]);

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------- Calques, textures et halos partagés par tous les portraits ----------
// Ce qui ne bouge pas (roche, fonds) est pré-rendu une fois par taille dans des canevas hors écran ;
// les lueurs utilisent des textures de halo partagées en mode « lighter » plutôt que shadowBlur.

// Générateur pseudo-aléatoire à graine (mulberry32), pour des textures stables.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Contour fermé en Path2D ; round > 0 arrondit les angles.
function shape(pts, round = 0) {
  // Toujours dans le sens des arcs (horaire à l'écran) : les unions de formes ne se trouent pas.
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (area < 0) pts = pts.slice().reverse();
  const p = new Path2D();
  const n = pts.length;
  if (!round) {
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n; i++) p.lineTo(pts[i][0], pts[i][1]);
  } else {
    const a = pts[n - 1], b = pts[0];
    p.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    for (let i = 0; i < n; i++) {
      const c = pts[i], d = pts[(i + 1) % n];
      p.arcTo(c[0], c[1], (c[0] + d[0]) / 2, (c[1] + d[1]) / 2, round);
    }
  }
  p.closePath();
  return p;
}

function union(...paths) {
  const p = new Path2D();
  for (const q of paths) p.addPath(q);
  return p;
}

function strokePts(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

// Textures fixes (64 px) partagées par tous les portraits.
const FIXED = new Map();
function fixedTex(id, paint) {
  let c = FIXED.get(id);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    paint(c.getContext('2d'), 64);
    FIXED.set(id, c);
  }
  return c;
}

// Halo à cœur blanc (étincelles, photophores).
function glowTex(color) {
  return fixedTex('g' + color, (g, n) => {
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.14, rgba(color, 0.95));
    gr.addColorStop(0.4, rgba(color, 0.28));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n);
  });
}

// Halo doux sans cœur (lumières diffuses, fumée).
function softTex(color) {
  return fixedTex('s' + color, (g, n) => {
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    gr.addColorStop(0, rgba(color, 1));
    gr.addColorStop(0.45, rgba(color, 0.35));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n);
  });
}

// Scintillement en étoile à quatre branches.
function starTex() {
  return fixedTex('star', (g, n) => {
    const h = n / 2;
    g.globalCompositeOperation = 'lighter';
    for (const rot of [0, Math.PI / 2]) {
      g.save();
      g.translate(h, h);
      g.rotate(rot);
      const gr = g.createLinearGradient(-h, 0, h, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.5, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(-h, 0); g.lineTo(0, -n * 0.04); g.lineTo(h, 0); g.lineTo(0, n * 0.04);
      g.fill();
      g.restore();
    }
    const gr = g.createRadialGradient(h, h, 0, h, h, h * 0.35);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n);
  });
}

// Bulle : anneau translucide et petit reflet.
function bubbleTex() {
  return fixedTex('bubble', (g, n) => {
    const h = n / 2;
    const gr = g.createRadialGradient(h, h, 0, h, h, h);
    gr.addColorStop(0, 'rgba(170,235,255,0.03)');
    gr.addColorStop(0.72, 'rgba(170,235,255,0.12)');
    gr.addColorStop(0.9, 'rgba(225,250,255,0.75)');
    gr.addColorStop(1, 'rgba(225,250,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.ellipse(n * 0.36, n * 0.32, n * 0.11, n * 0.06, -0.6, 0, Math.PI * 2);
    g.fill();
  });
}

function sprite(ctx, tex, x, y, r, a) {
  ctx.globalAlpha = clamp01(a);
  ctx.drawImage(tex, x - r, y - r, 2 * r, 2 * r);
}

// Calque pré-rendu propre au portrait (refait si la taille change) : x0, y0, w, h en unités.
function layer(s, id, x0, y0, w, h, paint) {
  let c = s.cache.get(id);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * s.px));
    c.height = Math.max(1, Math.ceil(h * s.px));
    const g = c.getContext('2d');
    g.setTransform(s.px, 0, 0, s.px, -x0 * s.px, -y0 * s.px);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    paint(g);
    s.cache.set(id, c);
  }
  return c;
}

function blit(ctx, s, id, x0, y0, w, h, paint) {
  ctx.drawImage(layer(s, id, x0, y0, w, h, paint), x0, y0, w, h);
}

// Grain de matière : petites taches claires et sombres dans la forme.
function speckle(g, shp, rnd, n, box, light, dark, size) {
  const [x0, y0, x1, y1] = box;
  g.save();
  g.clip(shp);
  for (let i = 0; i < n; i++) {
    g.globalAlpha = 0.05 + rnd() * 0.16;
    g.fillStyle = rnd() < 0.5 ? light : dark;
    g.beginPath();
    g.arc(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), size * (0.3 + rnd()), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// Réseau de fissures ramifiées (marche aléatoire), calculé une seule fois.
function crackNet(seed, roots) {
  const rnd = seeded(seed);
  const out = [];
  const grow = (x, y, a, len, w, depth) => {
    const pts = [[x, y]];
    const steps = Math.max(2, Math.round(len / 0.035));
    for (let i = 0; i < steps; i++) {
      a += (rnd() - 0.5) * 0.9;
      x += Math.cos(a) * 0.035;
      y += Math.sin(a) * 0.035;
      pts.push([x, y]);
      if (depth < 2 && rnd() < 0.17) grow(x, y, a + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.5), len * 0.45, w * 0.6, depth + 1);
    }
    out.push({ pts, w, ph: rnd() * 6.28, y: pts[0][1] });
  };
  for (const [x, y, a, len, w] of roots) grow(x, y, a, len, w ?? 1, 0);
  return out;
}

// ---------- Vaskhar : roche, basalte, magma ----------

const VK_HEAD = [[-0.34, 0.2], [-0.5, 0.06], [-0.6, -0.16], [-0.56, -0.42], [-0.38, -0.6], [-0.1, -0.69], [0.14, -0.68], [0.4, -0.58], [0.57, -0.4], [0.62, -0.14], [0.52, 0.06], [0.36, 0.2], [0.16, 0.17], [0, 0.12], [-0.16, 0.17]];
const VK_HORN = [[-0.5, -0.34], [-0.72, -0.48], [-0.86, -0.66], [-0.74, -0.65], [-0.7, -0.82], [-0.56, -0.64], [-0.34, -0.54]];
const VK_BROW = [[-0.58, -0.1], [-0.4, -0.27], [-0.14, -0.26], [0, -0.32], [0.14, -0.26], [0.4, -0.27], [0.6, -0.1], [0.42, -0.15], [0.2, -0.18], [0, -0.17], [-0.2, -0.18], [-0.42, -0.15]];
const VK_CREST = [[-0.07, -0.69], [0.17, -0.67], [0.1, -0.4], [0.02, -0.3], [-0.05, -0.42]];
const VK_EYES = [[-0.27, -0.09, 0.07], [0, -0.13, 0.058], [0.27, -0.09, 0.07]];
const VK_MAND = [[-0.52, -0.02], [-0.38, -0.05], [-0.24, 0.1], [-0.12, 0.28], [-0.03, 0.5], [-0.13, 0.46], [-0.28, 0.37], [-0.45, 0.22], [-0.56, 0.08]];
const VK_STERNUM = [[-0.5, 1.3], [-0.53, 0.52], [-0.3, 0.32], [0.3, 0.32], [0.53, 0.52], [0.5, 1.3]];
const VK_PAUL_LOW = [[-1.22, 1.3], [-1.17, 0.8], [-0.99, 0.6], [-0.66, 0.56], [-0.43, 0.68], [-0.41, 1.3]];
const VK_PAUL_UP = [[-1.13, 0.76], [-1.07, 0.44], [-0.91, 0.24], [-0.67, 0.12], [-0.44, 0.12], [-0.29, 0.27], [-0.35, 0.5], [-0.6, 0.66], [-0.92, 0.72]];
const VK_HEAD_CRACKS = crackNet(11, [[0.07, -0.66, Math.PI / 2 + 0.25, 0.36], [-0.57, -0.02, 0.25, 0.24, 0.8], [0.59, -0.06, Math.PI - 0.3, 0.22, 0.8], [-0.32, -0.57, 1.1, 0.18, 0.7]]);
const VK_BODY_CRACKS = crackNet(29, [[-0.86, 0.3, 1.4, 0.5], [0.76, 0.27, 1.8, 0.42], [-0.05, 0.42, 1.5, 0.75, 1.2], [0.3, 0.62, 1.3, 0.4, 0.8], [-0.72, 0.68, 1.7, 0.45], [0.98, 0.72, 2.0, 0.4]]);

// Plaque de roche pré-rendue : dégradé, grain, biseau éclairé, ombre portée, contre-jour et lueur du magma.
const VK_L = { key: 'rgba(255,226,190,0.42)', rim: 'rgba(140,175,255,0.3)', shadow: 'rgba(8,4,3,0.65)', ao: 'rgba(28,16,10,0.55)' };

function rockPlate(g, s, shp, box, rnd, accent) {
  const [x0, y0, x1, y1] = box;
  g.fillStyle = lin(g, x0, y0, x1, y1, [[0, '#8e7967'], [0.45, '#4b3e35'], [1, '#1b1512']]);
  g.fill(shp);
  // Strates : couches fines et inclinées de la roche
  g.save();
  g.clip(shp);
  const ang = (rnd() - 0.5) * 0.6, len = (x1 - x0) + (y1 - y0);
  for (let k = -len; k < len; k += 0.022 + rnd() * 0.02) {
    g.strokeStyle = rnd() < 0.5 ? `rgba(220,196,165,${0.03 + rnd() * 0.05})` : `rgba(8,4,2,${0.08 + rnd() * 0.12})`;
    g.lineWidth = 0.004 + rnd() * 0.008;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + k;
    g.beginPath();
    g.moveTo(cx - len, cy - Math.tan(ang) * len);
    g.quadraticCurveTo(cx, cy + (rnd() - 0.5) * 0.04, cx + len, cy + Math.tan(ang) * len);
    g.stroke();
  }
  g.restore();
  speckle(g, shp, rnd, 260, box, '#d8c2a8', '#0c0806', 0.014);
  speckle(g, shp, rnd, 26, box, '#a08670', '#140e0b', 0.07);
  modelVol(g, shp, box, 0.25, 0.15, '#2a1810');
  light3(g, s, shp, VK_L, 0.55);
  // Lueur du magma par en dessous, contre-jour de l'accent
  band(g, s, shp, 0, -0.07, 'rgba(255,100,25,0.32)', 0.04);
  band(g, s, shp, -0.035, 0.01, rgba(accent, 0.45), 0.016);
  // Éclats cristallins (micas) qui accrochent la lumière
  g.save();
  g.clip(shp);
  for (let i = 0; i < 30; i++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    g.fillStyle = `rgba(255,240,215,${0.35 + rnd() * 0.5})`;
    g.beginPath(); g.arc(x, y, 0.002 + rnd() * 0.003, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  g.strokeStyle = 'rgba(8,5,4,0.95)';
  g.lineWidth = 0.012;
  g.stroke(shp);
}

// Arête taillée : trait sombre doublé d'un trait clair (effet de ciselure).
function chisel(g, pts) {
  g.strokeStyle = 'rgba(10,6,4,0.55)';
  g.lineWidth = 0.012;
  strokePts(g, pts);
  g.strokeStyle = 'rgba(220,195,165,0.18)';
  g.lineWidth = 0.008;
  strokePts(g, pts.map(([x, y]) => [x - 0.008, y - 0.008]));
}

// Rainures sombres des fissures (pré-rendu).
function crackGrooves(g, cracks) {
  g.strokeStyle = 'rgba(70,50,36,0.35)';
  for (const c of cracks) { g.lineWidth = 0.04 * c.w; strokePts(g, c.pts); }
  g.strokeStyle = 'rgba(6,3,2,0.9)';
  for (const c of cracks) { g.lineWidth = 0.022 * c.w; strokePts(g, c.pts); }
}

// Magma qui pulse le long des fissures : trois passes additives (halo, braise, cœur blanc).
function crackGlow(ctx, s, cracks, power) {
  ctx.globalCompositeOperation = 'lighter';
  const passes = s.small
    ? [[0.05, '#ff5a10', 0.25], [0.014, '#ffd27a', 0.9]]
    : [[0.18, '#ff4a08', 0.05], [0.065, '#ff4a08', 0.16], [0.028, '#ff8a26', 0.42], [0.01, '#fff0b8', 0.85]];
  for (const [w, col, a] of passes) {
    for (const c of cracks) {
      const wave = 0.55 + 0.45 * Math.sin(s.t * 1.7 - c.y * 4 + c.ph);
      ctx.lineWidth = w * (0.5 + 0.5 * c.w);
      ctx.strokeStyle = rgba(col, clamp01(a * power * wave));
      strokePts(ctx, c.pts);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function bgVaskhar(ctx, s) {
  const { t, hw, hh } = s;
  blit(ctx, s, 'vk-bg', -hw, -hh, 2 * hw, 2 * hh, (g) => {
    g.fillStyle = rad(g, 0, 1.0, 0.05, 1.7, [[0, '#6a2008'], [0.3, '#2c0d05'], [0.65, '#130608'], [1, '#06040a']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    // Orgues de basalte à l'horizon, éclairées par en dessous
    const rnd = seeded(5);
    g.filter = blurF(s, 0.02);
    for (const side of [-1, 1]) {
      let x = side * 0.42;
      for (let i = 0; i < 6; i++) {
        const w = 0.1 + rnd() * 0.07;
        const top = -0.35 + rnd() * 0.5 + i * 0.05;
        const xa = x, xb = x + side * w;
        const l = Math.min(xa, xb), r = Math.max(xa, xb);
        g.fillStyle = lin(g, 0, top, 0, 1.1, [[0, '#24120c'], [0.5, '#170a07'], [1, '#3a1206']]);
        g.fillRect(l, top, r - l, 1.5);
        g.fillStyle = 'rgba(255,140,60,0.16)';
        g.fillRect(l, top, r - l, 0.012);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 0.008;
        g.beginPath(); g.moveTo(l, top); g.lineTo(l, 1.2); g.stroke();
        x = xb + side * 0.005;
      }
    }
    g.filter = 'none';
    bokehDiscs(g, seeded(6), 14, [-hw, -0.3, hw, hh], ['#ff7a20', '#ffb040'], 0.02, 0.06, 0.1, 0.35);
    // Brume chaude au sol
    g.fillStyle = lin(g, 0, 0.3, 0, 1.1, [[0, 'rgba(255,90,20,0)'], [1, 'rgba(255,90,20,0.28)']]);
    g.fillRect(-hw, 0.3, 2 * hw, hh);
  });
  // Lueur de coulée qui respire
  ctx.globalCompositeOperation = 'lighter';
  sprite(ctx, softTex('#ff5010'), 0, 1.1, 1.2, 0.18 + 0.08 * Math.sin(t * 0.9) + 0.12 * s.mouth);
  // Fumée qui monte
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.03 + i / 3) % 1;
    sprite(ctx, softTex('#3a2a26'), (hash(i + 4) - 0.5) * 1.4 + Math.sin(t * 0.2 + i) * 0.1, 0.9 - p * 2, 0.5, 0.22 * Math.sin(p * Math.PI));
  }
  ctx.globalAlpha = 1;
  emberField(ctx, s, 0, 0.6);
}

// Braises montantes ; depth > 0 : plus grosses et plus floues (premier plan).
function emberField(ctx, s, seed, depth) {
  const { t } = s;
  const n = Math.round((s.small ? 9 : 22) * (depth > 0.8 ? 0.35 : 1) + s.talk * 6);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const k = i + seed * 100;
    const sp = 0.08 + 0.1 * hash(k + 1);
    const p = (t * sp + hash(k)) % 1;
    const x = (hash(k + 2) - 0.5) * 2 + Math.sin(t * (0.8 + hash(k + 3)) + k) * 0.07 + p * 0.15;
    const y = 1.1 - p * 2.3;
    const fl = 0.6 + 0.4 * Math.sin(t * 9 + k * 3);
    const r = (0.012 + 0.022 * hash(k + 5)) * (1 + depth * 1.6);
    sprite(ctx, glowTex(hash(k + 6) < 0.3 ? '#ffd27a' : '#ff7a20'), x, y, r * 2.2, Math.sin(p * Math.PI) * fl * (depth > 0.8 ? 0.55 : 0.9));
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawVaskhar(ctx, s) {
  const { t, mouth, accent } = s;
  const b = s.breath * 0.016;
  const heat = 0.85 + 0.2 * Math.sin(t * 1.6) + 0.5 * mouth + 0.15 * s.talk;
  const rnd = seeded(3);

  // Buste : carapace en plaques
  const sternum = shape(VK_STERNUM, 0.04);
  const pLow = shape(VK_PAUL_LOW, 0.05), pUp = shape(VK_PAUL_UP, 0.06);
  const m = new DOMMatrix([-1, 0, 0, 1, 0, 0]);
  const pLowR = new Path2D(); pLowR.addPath(pLow, m);
  const pUpR = new Path2D(); pUpR.addPath(pUp, m);
  const bodyAll = union(sternum, pLow, pUp, pLowR, pUpR);
  ctx.save();
  ctx.translate(0, b * 0.4);
  blit(ctx, s, 'vk-body', -1.3, 0.05, 2.6, 1.3, (g) => {
    rockPlate(g, s, sternum, [-0.5, 0.3, 0.5, 1.3], rnd, accent);
    // Segments ventraux
    g.save();
    g.clip(sternum);
    for (let k = 0; k < 4; k++) {
      const y = 0.56 + k * 0.18;
      const seg = new Path2D();
      seg.moveTo(-0.6, y); seg.quadraticCurveTo(0, y + 0.07, 0.6, y);
      g.strokeStyle = 'rgba(8,5,3,0.85)'; g.lineWidth = 0.02; g.stroke(seg);
      g.translate(0, 0.014);
      g.strokeStyle = 'rgba(230,200,170,0.2)'; g.lineWidth = 0.01; g.stroke(seg);
      g.translate(0, -0.014);
    }
    g.restore();
    for (const [lo, up, flip] of [[pLow, pUp, 1], [pLowR, pUpR, -1]]) {
      rockPlate(g, s, lo, flip > 0 ? [-1.2, 0.56, -0.4, 1.3] : [0.4, 0.56, 1.2, 1.3], rnd, accent);
      // Ombre de la plaque haute sur la basse
      g.save(); g.clip(lo); g.filter = `blur(${(0.03 * s.px).toFixed(1)}px)`;
      g.translate(0, 0.05); g.fillStyle = 'rgba(0,0,0,0.55)'; g.fill(up); g.restore();
      rockPlate(g, s, up, flip > 0 ? [-1.1, 0.12, -0.3, 0.75] : [0.3, 0.12, 1.1, 0.75], rnd, accent);
      g.save(); g.scale(flip, 1);
      chisel(g, [[-1.0, 0.42], [-0.78, 0.3], [-0.5, 0.26]]);
      chisel(g, [[-0.78, 0.3], [-0.72, 0.56]]);
      chisel(g, [[-1.05, 0.95], [-0.8, 0.82], [-0.55, 0.86]]);
      g.restore();
    }
    g.save(); g.clip(bodyAll); crackGrooves(g, VK_BODY_CRACKS); g.restore();
    // Ombre de la tête sur le haut du buste
    g.save(); g.clip(bodyAll); g.filter = `blur(${(0.06 * s.px).toFixed(1)}px)`;
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.beginPath(); g.ellipse(0, 0.32, 0.55, 0.14, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  });
  ctx.save(); ctx.clip(bodyAll); crackGlow(ctx, s, VK_BODY_CRACKS, heat * 0.85); ctx.restore();
  ctx.restore();

  // Tête : suit un peu le regard, hoche sur les syllabes
  ctx.save();
  ctx.translate(s.hx * 0.025, -b - s.nod * 0.03);
  ctx.rotate(s.tilt);
  const head = shape(VK_HEAD, 0.05);
  // Gueule : cavité sombre et incandescente, visible entre les mandibules
  ctx.fillStyle = rad(ctx, 0, 0.3, 0.02, 0.2, [[0, '#2a0a02'], [1, 'rgba(10,4,2,0.95)']]);
  ctx.beginPath(); ctx.ellipse(0, 0.28, 0.17, 0.12 + 0.05 * mouth, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  sprite(ctx, softTex('#ff6a10'), 0, 0.3, 0.2 + 0.12 * mouth, 0.3 + 0.7 * mouth);
  sprite(ctx, glowTex('#ffb040'), 0, 0.3, 0.06 + 0.08 * mouth, 0.25 + 0.75 * mouth);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  blit(ctx, s, 'vk-head', -0.8, -0.95, 1.6, 1.25, (g) => {
    const r2 = seeded(17);
    // Cornes de roche brisées, derrière le dôme
    const horn = shape(VK_HORN, 0.02);
    const hornR = new Path2D(); hornR.addPath(horn, new DOMMatrix([-1, 0, 0, 1, 0.04, 0.04]));
    rockPlate(g, s, horn, [-0.86, -0.82, -0.3, -0.34], r2, accent);
    rockPlate(g, s, hornR, [0.3, -0.78, 0.9, -0.3], r2, accent);
    rockPlate(g, s, head, [-0.6, -0.7, 0.6, 0.32], r2, accent);
    // Modelé sphérique : lumière haut-gauche, ombre bas-droite
    g.save(); g.clip(head);
    g.fillStyle = rad(g, -0.22, -0.45, 0.02, 0.95, [[0, 'rgba(255,235,210,0.24)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.35)']]);
    g.fill(head);
    g.restore();
    const crest = shape(VK_CREST, 0.03);
    rockPlate(g, s, crest, [-0.1, -0.7, 0.2, -0.3], r2, accent);
    chisel(g, [[-0.33, -0.61], [-0.22, -0.38], [-0.52, -0.42]]);
    chisel(g, [[0.39, -0.56], [0.26, -0.36], [0.55, -0.34]]);
    // Pommettes saillantes
    chisel(g, [[-0.58, -0.06], [-0.4, 0.0], [-0.2, 0.06], [-0.12, 0.15]]);
    chisel(g, [[0.6, -0.06], [0.42, 0.0], [0.22, 0.06], [0.14, 0.15]]);
    chisel(g, [[-0.08, -0.02], [0, 0.1], [0.08, -0.02]]);
    g.save(); g.clip(head); crackGrooves(g, VK_HEAD_CRACKS); g.restore();
    // Orbites creuses
    for (const [x, y, r] of VK_EYES) {
      g.fillStyle = rad(g, x, y, r * 0.5, r * 1.9, [[0, 'rgba(10,4,2,0.95)'], [0.6, 'rgba(10,4,2,0.6)'], [1, 'rgba(10,4,2,0)']]);
      g.beginPath(); g.ellipse(x, y, r * 1.9, r * 1.2, 0, 0, Math.PI * 2); g.fill();
    }
    // Arcade sourcilière en surplomb, ombre portée dessous
    const brow = shape(VK_BROW, 0.02);
    g.save(); g.clip(head); g.filter = `blur(${(0.025 * s.px).toFixed(1)}px)`;
    g.translate(0, 0.045); g.fillStyle = 'rgba(0,0,0,0.75)'; g.fill(brow); g.restore();
    rockPlate(g, s, brow, [-0.6, -0.32, 0.6, -0.1], r2, accent);
  });
  ctx.save(); ctx.clip(head); crackGlow(ctx, s, VK_HEAD_CRACKS, heat); ctx.restore();
  for (const [x, y, r] of VK_EYES) {
    ctx.globalCompositeOperation = 'lighter';
    sprite(ctx, softTex('#ff7a20'), x, y, r * 2.3, (0.3 + 0.2 * s.mouth) * (1 - 0.6 * s.blink));
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    wetEye(ctx, s, x, y, {
      id: 'vk-iris' + r, rx: r, ry: r * 0.58, top: 0.8, irisR: r * 0.62, look: 0.4, lookY: 0.3,
      sclera: [[0, '#ffb040'], [0.6, '#c04a0a'], [1, '#3a0c02']], lid: '#4b3e35', rim: '#9ab8ff', lashW: 0.012,
      paintIris: irisPainter(r * 0.62, ['#fffbe0', '#ffd36a', '#ff7a14', '#5a1004'], 'slit', 3),
    });
  }
  // Mandibules (pré-rendues), écartées par la voix + petits tics
  const twitch = Math.max(0, Math.sin(t * 0.9) - 0.94) * 4;
  const mand = shape(VK_MAND, 0.03);
  for (const side of [1, -1]) {
    ctx.save();
    ctx.translate(-0.44 * side, 0.02);
    ctx.rotate((mouth * 0.26 + twitch * 0.1 + 0.015 * s.breath) * side);
    ctx.translate(0.44 * side, -0.02);
    ctx.scale(side, 1);
    blit(ctx, s, 'vk-mand', -0.62, -0.1, 0.62, 0.64, (g) => {
      // Dents de basalte sur le bord intérieur, chauffées par la gueule
      for (let i = 0; i < 4; i++) {
        const u = 0.25 + i * 0.17;
        const x = -0.24 + (-0.07 + 0.24) * u, y = 0.1 + 0.36 * u;
        g.fillStyle = lin(g, x, y, x + 0.06, y, [[0, '#6a5446'], [1, '#ffb070']]);
        poly(g, [[x - 0.01, y - 0.03], [x + 0.065, y + 0.005], [x - 0.005, y + 0.035]]);
        g.fill();
      }
      rockPlate(g, s, mand, [-0.56, -0.05, -0.03, 0.5], seeded(8), accent);
      g.save(); g.clip(mand);
      g.fillStyle = lin(g, -0.3, 0, -0.05, 0, [[0, 'rgba(255,90,20,0)'], [1, 'rgba(255,110,30,0.35)']]);
      g.fill(mand);
      g.restore();
      chisel(g, [[-0.48, 0.06], [-0.3, 0.16], [-0.12, 0.4]]);
    });
    ctx.restore();
  }
  // Étincelles crachées à chaque syllabe
  if (s.talk > 0.05 && !s.small) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.25 + 0.5 * hash(s.syl * 7 + i));
      const d = s.sylAge * (0.6 + 0.6 * hash(s.syl * 3 + i));
      const life = 1 - s.sylAge / 0.45;
      if (life <= 0) break;
      sprite(ctx, glowTex('#ffc060'), Math.cos(a) * d * 0.8, 0.36 + Math.sin(a) * d * 0.5 + d * d * 0.8, 0.03, life * mouth * 1.5);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();

  // Braises au premier plan
  if (!s.small) emberField(ctx, s, 7, 1);
}

// ---------- Ondésiens : méduse géante, gélatine et filaments ----------

function bgOndesiens(ctx, s) {
  const { t, hw, hh } = s;
  blit(ctx, s, 'od-bg', -hw, -hh, 2 * hw, 2 * hh, (g) => {
    g.fillStyle = lin(g, 0, -hh, 0, hh, [[0, '#0b4062'], [0.4, '#06213a'], [1, '#020814']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    g.fillStyle = rad(g, 0, -1.2, 0.05, 1.3, [[0, 'rgba(120,220,255,0.35)'], [1, 'rgba(120,220,255,0)']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    // Plancton lointain figé
    const rnd = seeded(21);
    g.filter = blurF(s, 0.01);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(170,235,255,${0.08 + rnd() * 0.25})`;
      g.beginPath(); g.arc((rnd() - 0.5) * 2, (rnd() - 0.5) * 2, 0.003 + rnd() * 0.005, 0, Math.PI * 2); g.fill();
    }
    g.filter = 'none';
    bokehDiscs(g, rnd, 16, [-hw, -hh, hw, hh], ['#7fe8ff', '#bff4ff'], 0.02, 0.07, 0.08, 0.3);
  });
  // Rayons de lumière venus de la surface
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const x = -0.6 + i * 0.4 + Math.sin(t * 0.21 + i * 1.7) * 0.15;
    const sk = 0.25 + 0.1 * Math.sin(t * 0.17 + i);
    const a = 0.05 + 0.03 * Math.sin(t * 0.5 + i * 2);
    ctx.fillStyle = lin(ctx, 0, -1.1, 0, 0.9, [[0, rgba('#9fe6ff', a)], [1, rgba('#9fe6ff', 0)]]);
    ctx.beginPath();
    ctx.moveTo(x - 0.05, -1.1); ctx.lineTo(x + 0.07, -1.1);
    ctx.lineTo(x + 0.25 + sk, 0.9); ctx.lineTo(x - 0.05 + sk, 0.9);
    ctx.closePath(); ctx.fill();
  }
  // Plancton vivant qui dérive
  const n = s.small ? 10 : 24;
  for (let i = 0; i < n; i++) {
    const x = ((hash(i + 50) * 2.4 + t * 0.012 * (1 + hash(i))) % 2.4) - 1.2;
    const y = (hash(i + 60) - 0.5) * 2 + Math.sin(t * 0.4 + i) * 0.04;
    sprite(ctx, glowTex('#7fe8ff'), x, y, 0.012 + 0.012 * hash(i + 3), 0.3 + 0.4 * Math.sin(t * 1.5 + i * 2.1));
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  bubbles(ctx, s, 0);
}

function bubbles(ctx, s, front) {
  const { t } = s;
  const n = s.small ? 4 : front ? 4 : 9;
  for (let i = 0; i < n; i++) {
    const k = i + front * 30;
    const sp = 0.06 + 0.07 * hash(k + 1);
    const p = (t * sp + hash(k)) % 1;
    const r = (0.012 + 0.03 * hash(k + 2)) * (front ? 1.8 : 1);
    const x = (hash(k + 3) - 0.5) * 1.9 + Math.sin(t * 2 + k) * 0.015;
    sprite(ctx, bubbleTex(), x, 1.1 - p * 2.3, r, Math.min(1, Math.sin(p * Math.PI) * 2) * (front ? 0.6 : 0.85));
  }
  ctx.globalAlpha = 1;
}

// Chair de l'ombrelle pré-rendue à sa taille de repos : cellules de mésoglée, fibres,
// diffusion de la lumière dans l'épaisseur (sous-surface) et film irisé près du bord.
function odGel(g, s, accent) {
  const rnd = seeded(47);
  const bell = new Path2D();
  bell.ellipse(0, -0.25, 0.64, 0.56, 0, Math.PI, 0);
  bell.lineTo(0.64, -0.08);
  bell.lineTo(-0.64, -0.08);
  bell.closePath();
  g.save();
  g.clip(bell);
  g.fillStyle = rad(g, 0, -0.05, 0.05, 0.6, [[0, rgba(accent, 0.22)], [0.6, rgba(accent, 0.08)], [1, rgba(accent, 0)]]);
  g.fillRect(-0.7, -0.9, 1.4, 0.85);
  for (let i = 0; i < 140; i++) {
    const x = (rnd() - 0.5) * 1.25, y = -0.82 + rnd() * 0.74, r = 0.012 + rnd() * 0.03;
    const gr = g.createRadialGradient(x, y, r * 0.4, x, y, r);
    gr.addColorStop(0, 'rgba(190,240,255,0)');
    gr.addColorStop(0.85, `rgba(190,240,255,${0.05 + rnd() * 0.08})`);
    gr.addColorStop(1, 'rgba(190,240,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.lineWidth = 0.003;
  for (let i = 0; i < 70; i++) {
    const a = Math.PI * (1 + rnd());
    g.strokeStyle = `rgba(220,250,255,${0.04 + rnd() * 0.06})`;
    g.beginPath(); g.moveTo(0, -0.4); g.lineTo(Math.cos(a) * 0.62, -0.25 + Math.sin(a) * 0.55); g.stroke();
  }
  // Film irisé (interférences) le long du bord
  const cols = ['#ff7ad0', '#ffd27a', '#7affc8', '#7ac8ff', '#c87aff'];
  g.lineWidth = 0.012;
  for (let k = 0; k < cols.length; k++) {
    g.strokeStyle = rgba(cols[k], 0.16);
    g.beginPath(); g.ellipse(0, -0.25, 0.6 - k * 0.012, 0.52 - k * 0.012, 0, Math.PI * (1.05 + k * 0.06), Math.PI * (1.45 + k * 0.08)); g.stroke();
  }
  g.restore();
}

function drawOndesiens(ctx, s) {
  const { t, bot, mouth, accent } = s;
  const pump = 0.5 + 0.5 * Math.sin(s.ph * 1.5);
  const bob = Math.sin(t * 0.7) * 0.025 - pump * 0.015;
  const cx = s.hx * 0.03, cy = -0.27 + bob;
  const rx = 0.63 * (1 - 0.045 * pump - 0.05 * mouth);
  const ry = 0.54 * (1 + 0.04 * pump + 0.04 * mouth);
  const rimY = cy + 0.17;
  ctx.save();
  ctx.translate(cx, 0);
  ctx.rotate(s.tilt * 0.6);

  // Longs filaments urticants, effilés, ondulant vers le bas
  ctx.globalCompositeOperation = 'lighter';
  const nT = s.small ? 10 : 16, seg = s.small ? 6 : 9;
  for (let i = 0; i < nT; i++) {
    const x0 = (i / (nT - 1) - 0.5) * rx * 1.85;
    const ph = hash(i + 7) * 6;
    let px = x0, py = rimY;
    for (let k = 1; k <= seg; k++) {
      const u = k / seg;
      const x = x0 * (1 - 0.25 * u) + Math.sin(t * 1.3 - u * 4 + ph) * (0.015 + 0.1 * u);
      const y = rimY + (bot + 0.1 - rimY) * u;
      ctx.lineWidth = 0.013 * (1 - u) + 0.002;
      ctx.strokeStyle = rgba(accent, (0.32 + 0.2 * s.talk) * (1 - 0.6 * u));
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      ctx.lineWidth *= 0.3;
      ctx.strokeStyle = rgba('#e6fcff', 0.3 * (1 - u));
      ctx.stroke();
      if (!s.small && k % 2 === 0) sprite(ctx, glowTex('#d8fbff'), x, y, 0.01, 0.45 * (1 - u));
      px = x; py = y;
    }
    // Influx lumineux qui descend le filament
    if (i % 2 === 0) {
      const p = (s.ph * 0.22 + hash(i)) % 1;
      const x = x0 * (1 - 0.25 * p) + Math.sin(t * 1.3 - p * 4 + ph) * (0.015 + 0.1 * p);
      sprite(ctx, glowTex(accent), x, rimY + (bot + 0.1 - rimY) * p, 0.035, Math.sin(p * Math.PI));
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // Bras buccaux : rubans frangés translucides
  for (let i = 0; i < 4; i++) {
    const x0 = (i - 1.5) * 0.11;
    const L = [], R = [];
    const n = 12;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const y = rimY - 0.06 + (bot - rimY) * 0.85 * u;
      const x = x0 * (1 + u * 0.9) + Math.sin(t * 1.1 - u * 3 + i * 2) * 0.06 * (u + 0.2);
      const w = 0.045 * (1 - u * 0.6);
      const fr = Math.sin(u * 22 + t * 3 + i) * 0.012;
      L.push([x - w - fr, y]);
      R.push([x + w + fr, y]);
    }
    ctx.fillStyle = lin(ctx, 0, rimY, 0, bot, [[0, rgba('#ffc8ec', 0.3)], [0.4, rgba(accent, 0.16)], [1, rgba(accent, 0.02)]]);
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (const p of L) ctx.lineTo(p[0], p[1]);
    for (let k = R.length - 1; k >= 0; k--) ctx.lineTo(R[k][0], R[k][1]);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba('#bff4ff', 0.3);
    ctx.lineWidth = 0.006;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(accent, 0.25 + 0.4 * mouth);
    ctx.lineWidth = 0.008;
    strokePts(ctx, L.map((p, k) => [(p[0] + R[k][0]) / 2, p[1]]));
    if (!s.small) {
      ctx.strokeStyle = rgba('#e6fcff', 0.25);
      ctx.lineWidth = 0.003;
      ctx.beginPath();
      for (let k = 1; k < L.length; k++) {
        const w = Math.sin(t * 6 + k + i) * 0.006;
        ctx.moveTo(L[k][0], L[k][1]); ctx.lineTo(L[k][0] - 0.018, L[k][1] + 0.008 + w);
        ctx.moveTo(R[k][0], R[k][1]); ctx.lineTo(R[k][0] + 0.018, R[k][1] + 0.008 - w);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Ombrelle
  const bell = new Path2D();
  bell.moveTo(-rx, rimY);
  bell.bezierCurveTo(-rx * 1.02, cy - ry * 1.3, rx * 1.02, cy - ry * 1.3, rx, rimY);
  const lobes = 10;
  for (let k = lobes; k > 0; k--) {
    const xa = -rx + 2 * rx * (k / lobes), xb = -rx + 2 * rx * ((k - 1) / lobes);
    const wav = 0.045 + 0.02 * Math.sin(t * 3 + k) + 0.02 * pump;
    bell.quadraticCurveTo((xa + xb) / 2, rimY + wav, xb, rimY);
  }
  bell.closePath();
  const top = cy - ry * 0.98;

  // Cavité interne (sous-ombrelle), plus sombre
  ctx.fillStyle = rad(ctx, 0, rimY, 0.05, rx * 0.9, [[0, 'rgba(2,20,40,0.55)'], [1, 'rgba(2,20,40,0)']]);
  ctx.beginPath(); ctx.ellipse(0, rimY - 0.02, rx * 0.8, 0.2, 0, Math.PI, 0); ctx.fill();

  // Gélatine : très transparente au centre, plus dense sur les bords (effet de Fresnel)
  ctx.fillStyle = rad(ctx, 0, cy + 0.02, 0.02, rx * 1.08, [[0, rgba(accent, 0.07)], [0.55, rgba(accent, 0.13)], [0.82, rgba('#9fe8ff', 0.3)], [1, rgba('#e6fcff', 0.6)]]);
  ctx.fill(bell);

  ctx.save();
  ctx.clip(bell);
  ctx.globalCompositeOperation = 'lighter';
  // Chair translucide (calque) étirée selon la pulsation
  ctx.save();
  ctx.translate(0, cy);
  ctx.scale(rx / 0.63, ry / 0.54);
  ctx.translate(0, 0.27);
  blit(ctx, s, 'od-gel', -0.7, -0.9, 1.4, 0.85, (g) => odGel(g, s, accent));
  ctx.restore();
  // Estomac (manubrium) suspendu sous le noyau, vu en profondeur
  const stY = cy - 0.15;
  ctx.fillStyle = lin(ctx, -0.05, 0, 0.05, 0, [[0, rgba('#ff9ad8', 0.05)], [0.5, rgba('#ffc8ec', 0.28)], [1, rgba('#ff9ad8', 0.05)]]);
  ctx.beginPath();
  ctx.moveTo(-0.06, stY);
  ctx.quadraticCurveTo(-0.09 - 0.02 * pump, (stY + rimY) / 2, -0.04, rimY + 0.06);
  ctx.lineTo(0.04, rimY + 0.06);
  ctx.quadraticCurveTo(0.09 + 0.02 * pump, (stY + rimY) / 2, 0.06, stY);
  ctx.closePath();
  ctx.fill();
  // Canaux radiaux et influx qui courent vers le bord
  const nucY = cy - 0.2;
  ctx.lineWidth = 0.006;
  for (let k = 0; k < 9; k++) {
    const u = k / 8 - 0.5;
    const ex = u * rx * 2 * 0.95, ey = rimY + 0.01;
    const qx = u * rx * 1.6, qy = cy - ry * 0.4 + Math.abs(u) * 0.2;
    ctx.strokeStyle = rgba('#bff4ff', 0.16);
    ctx.beginPath(); ctx.moveTo(0, nucY); ctx.quadraticCurveTo(qx, qy, ex, ey); ctx.stroke();
    const p = (s.ph * 0.45 + hash(k + 11)) % 1;
    const bx = (1 - p) * (1 - p) * 0 + 2 * (1 - p) * p * qx + p * p * ex;
    const by = (1 - p) * (1 - p) * nucY + 2 * (1 - p) * p * qy + p * p * ey;
    sprite(ctx, glowTex(accent), bx, by, 0.028, 0.8 * Math.sin(p * Math.PI) * (0.5 + 0.5 * s.talk + 0.3));
  }
  // Gonades : quatre lobes roses en croix autour du noyau
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + t * 0.12 + Math.PI / 4;
    const x = Math.cos(a) * 0.13, y = nucY + 0.02 + Math.sin(a) * 0.055;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.strokeStyle = rgba('#ff8acb', 0.42 + 0.15 * Math.sin(t * 1.2 + k) + 0.2 * mouth);
    ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.07, 0.034, 0, 0.3, Math.PI * 2 - 0.3); ctx.stroke();
    ctx.strokeStyle = rgba('#ffe0f2', 0.45);
    ctx.lineWidth = 0.008;
    ctx.stroke();
    ctx.restore();
  }
  // Noyau qui pulse avec la voix
  const core = 0.45 + 0.15 * Math.sin(t * 1.3) + 0.6 * mouth;
  sprite(ctx, softTex('#ff7ac0'), 0, nucY + 0.02, 0.26, 0.25 + 0.2 * mouth);
  sprite(ctx, softTex(accent), 0, nucY, 0.3, core * 0.6);
  sprite(ctx, glowTex('#d8fbff'), 0, nucY, 0.09 + 0.05 * mouth, core);
  // Ondes de parole qui partent du noyau
  if (s.talk > 0.02) {
    for (let i = 0; i < 3; i++) {
      const p = (s.t * 0.9 + i / 3) % 1;
      ctx.strokeStyle = rgba(accent, 0.45 * (1 - p) * s.talk * (0.4 + mouth));
      ctx.lineWidth = 0.012 * (1 - p) + 0.003;
      ctx.beginPath(); ctx.ellipse(0, nucY + 0.05, 0.12 + p * 0.55, 0.06 + p * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.restore();

  // Ocelles
  for (const side of [-1, 1]) {
    const r = s.small ? 0.085 : 0.075, x = side * 0.22, y = cy + 0.02;
    ctx.globalCompositeOperation = 'lighter';
    sprite(ctx, softTex(accent), x, y, r * 2.4, 0.3 + 0.25 * mouth);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    wetEye(ctx, s, x, y, {
      id: 'od-iris', rx: r, ry: r * 0.95, round: true, top: 0.95, irisR: r * 0.72, look: 0.32, lookY: 0.28,
      sclera: [[0, '#e6fcff'], [0.7, '#5ab8e0'], [1, '#0a3a60']], lid: '#3a98c8', rim: '#ffc8ec', lashW: 0.008,
      lash: 'rgba(10,60,100,0.8)',
      paintIris: irisPainter(r * 0.72, ['#f0ffff', '#5fd3ff', '#0c5a90', '#021a30'], 'round', 9),
    });
  }

  // Double membrane : contour intérieur, liseré lumineux, reflets spéculaires
  ctx.save();
  ctx.translate(0, rimY);
  ctx.scale(0.9, 0.9);
  ctx.translate(0, -rimY);
  ctx.strokeStyle = rgba('#c8f6ff', 0.14);
  ctx.lineWidth = 0.01;
  ctx.stroke(bell);
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba('#bff4ff', 0.55);
  ctx.lineWidth = 0.012;
  ctx.stroke(bell);
  ctx.strokeStyle = rgba(accent, 0.25);
  ctx.lineWidth = 0.04;
  ctx.stroke(bell);
  // Bord irisé
  const iri = ctx.createLinearGradient(-rx, top, rx, rimY);
  ['#ff7ad0', '#ffd27a', '#7affc8', '#7ac8ff', '#c87aff', '#ff7ad0'].forEach((c, k, a) => iri.addColorStop(k / (a.length - 1), rgba(c, 0.35)));
  ctx.strokeStyle = iri;
  ctx.lineWidth = 0.014;
  ctx.stroke(bell);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.clip(bell);
  ctx.fillStyle = rad(ctx, -rx * 0.38, top + 0.14, 0, 0.32, [[0, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(-1, -1.2, 2, 1.5);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.ellipse(-rx * 0.45, top + 0.12, 0.07, 0.022, -0.65, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.012;
  ctx.beginPath(); ctx.ellipse(0, cy - 0.02, rx * 0.86, ry * 0.86, 0, Math.PI * 1.08, Math.PI * 1.3); ctx.stroke();

  // Bord : franges courtes et photophores en vague
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 0.005;
  ctx.strokeStyle = rgba('#bff4ff', 0.35);
  ctx.beginPath();
  for (let k = 0; k <= 30; k++) {
    const x = -rx + 2 * rx * (k / 30);
    const y = rimY + 0.03;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(t * 2 + k) * 0.015, y + 0.06 + 0.02 * hash(k));
  }
  ctx.stroke();
  for (let k = 0; k < 12; k++) {
    const x = -rx * 0.95 + 2 * rx * 0.95 * (k / 11);
    const lum = (0.5 + 0.5 * Math.sin(t * 2.4 - k * 0.7 + mouth * 3)) * (1 - s.blink * 0.8);
    sprite(ctx, glowTex(accent), x, rimY + 0.035, 0.03 + 0.02 * lum, 0.3 + 0.7 * lum);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  if (!s.small) bubbles(ctx, s, 1);
}

// ---------- Orrhaïdes : cristal vivant à facettes ----------

const OR_N = 8;
// Sommets 3D de la tête (bipyramide octogonale irrégulière), une arête face au joueur.
const OR_VERTS = (() => {
  const v = { top: [0.03, -0.94, 0], bot: [0, 0.2, 0], up: [], low: [] };
  for (let k = 0; k < OR_N; k++) {
    const a = Math.PI / 2 + (k * Math.PI * 2) / OR_N;
    const ru = 0.3 * (1 + 0.1 * (hash(k + 1) - 0.5)), rl = 0.34 * (1 + 0.08 * (hash(k + 9) - 0.5));
    v.up.push([Math.cos(a) * ru, -0.52 + 0.03 * (hash(k + 3) - 0.5), Math.sin(a) * ru]);
    v.low.push([Math.cos(a) * rl, -0.02, Math.sin(a) * rl]);
  }
  return v;
})();
const OR_FACETS = (() => {
  const f = [];
  const { top, bot, up, low } = OR_VERTS;
  for (let k = 0; k < OR_N; k++) {
    const j = (k + 1) % OR_N;
    f.push({ v: [top, up[k], up[j]], part: 0 });
    f.push({ v: [up[k], low[k], low[j], up[j]], part: 1, k });
    f.push({ v: [low[k], bot, low[j]], part: 2 });
  }
  return f;
})();

function rotY([x, y, z], c, sn) {
  return [x * c + z * sn, y, -x * sn + z * c];
}
const proj = ([x, y, z]) => [x, y - z * 0.1];
function norm3([x, y, z]) {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Teinte d'une facette selon sa normale : lumière fixe haut-gauche + lumière qui balaie + reflet spéculaire.
function crystalTone(n, L, extra) {
  const key = Math.max(0, dot3(n, [-0.45, -0.6, 0.66]));
  const sw = Math.max(0, dot3(n, L));
  const r = 2 * dot3(n, L) * n[2] - L[2];
  const spec = Math.pow(Math.max(0, r), 18);
  const b = clamp01(0.05 + 0.42 * key + 0.55 * sw * sw + extra);
  return { b, spec };
}
// Palette de glace : indigo profond → bleu de cristal → blanc bleuté, plus le reflet.
const ICE = [[14, 16, 52], [52, 70, 150], [96, 168, 228], [232, 246, 255]];
function toneColor(b, spec, d = 0) {
  const v = clamp01(b + d) * (ICE.length - 1);
  const i = Math.min(ICE.length - 2, Math.floor(v)), f = v - i;
  const c = [0, 1, 2].map((k) => ICE[i][k] + (ICE[i + 1][k] - ICE[i][k]) * f + spec * 90);
  return `rgb(${c.map((q) => Math.min(255, Math.round(q))).join(',')})`;
}

// Éclat 2D à quatre facettes, éclairé comme la tête.
function shard2D(ctx, s, x, y, len, w, ang, L, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalAlpha = alpha;
  const c = Math.cos(ang), sn = Math.sin(ang);
  const faces = [
    [[[0, -len], [-w, -len * 0.68], [0, -len * 0.6]], [-0.6, -0.55, 0.58]],
    [[[0, -len], [w, -len * 0.68], [0, -len * 0.6]], [0.6, -0.55, 0.58]],
    [[[-w, -len * 0.68], [-w * 0.8, 0], [0, 0.04], [0, -len * 0.6]], [-0.72, 0.05, 0.69]],
    [[[w, -len * 0.68], [w * 0.8, 0], [0, 0.04], [0, -len * 0.6]], [0.72, 0.05, 0.69]],
  ];
  for (const [pts, n0] of faces) {
    const n = [n0[0] * c - n0[1] * sn, n0[0] * sn + n0[1] * c, n0[2]];
    const { b, spec } = crystalTone(n, L, 0);
    ctx.fillStyle = lin(ctx, 0, -len, 0, 0, [[0, toneColor(b, spec, 0.1)], [1, toneColor(b, spec, -0.15)]]);
    poly(ctx, pts);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(230,245,255,0.45)';
  ctx.lineWidth = 0.006;
  ctx.beginPath();
  ctx.moveTo(0, -len); ctx.lineTo(0, 0.04);
  ctx.moveTo(-w, -len * 0.68); ctx.lineTo(0, -len * 0.6); ctx.lineTo(w, -len * 0.68);
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// Inclusions du cristal (calque) : fêlures internes, voiles laiteux, bulles prisonnières.
function orInclusions(g, s, seed, box) {
  const rnd = seeded(seed);
  const [x0, y0, x1, y1] = box;
  for (let i = 0; i < 5; i++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    gloss(g, s, x, y, 0.05 + rnd() * 0.08, 0.015 + rnd() * 0.02, rnd() * 3, 0.12 + rnd() * 0.1, 0.02);
  }
  for (let i = 0; i < 6; i++) {
    let x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), a = rnd() * Math.PI * 2;
    const pts = [[x, y]];
    for (let k = 0; k < 6; k++) { a += (rnd() - 0.5) * 1.2; x += Math.cos(a) * 0.03; y += Math.sin(a) * 0.03; pts.push([x, y]); }
    g.strokeStyle = 'rgba(200,230,255,0.12)'; g.lineWidth = 0.014; strokePts(g, pts);
    g.strokeStyle = 'rgba(245,252,255,0.55)'; g.lineWidth = 0.003; strokePts(g, pts);
  }
  for (let i = 0; i < 14; i++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), r = 0.003 + rnd() * 0.006;
    g.strokeStyle = 'rgba(230,245,255,0.45)'; g.lineWidth = 0.002;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2); g.fill();
  }
}

function bgOrrhaides(ctx, s) {
  const { t, hw, hh } = s;
  blit(ctx, s, 'or-bg', -hw, -hh, 2 * hw, 2 * hh, (g) => {
    g.fillStyle = rad(g, 0, -0.25, 0.05, 1.5, [[0, '#24315a'], [0.45, '#10163a'], [1, '#05060f']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    // Nébuleuse pâle aux reflets de prisme
    g.globalCompositeOperation = 'lighter';
    g.filter = `blur(${(0.12 * s.px).toFixed(1)}px)`;
    for (const [x, y, r, c] of [[-0.6, -0.5, 0.45, 'rgba(160,110,255,0.22)'], [0.65, -0.15, 0.4, 'rgba(90,220,255,0.18)'], [0.1, 0.8, 0.6, 'rgba(255,190,240,0.12)']]) {
      g.fillStyle = c;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.filter = 'none';
    const rnd = seeded(77);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(220,235,255,${0.15 + rnd() * 0.5})`;
      g.beginPath(); g.arc((rnd() - 0.5) * 2, (rnd() - 0.5) * 2, 0.002 + rnd() * 0.005, 0, Math.PI * 2); g.fill();
    }
    bokehDiscs(g, rnd, 14, [-hw, -hh, hw, hh], ['#cfe8ff', '#ffd6f4', '#b8a0ff'], 0.02, 0.07, 0.08, 0.3);
  });
  // Faisceaux de lumière décomposée qui balaient lentement
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 2; i++) {
    const off = Math.sin(t * 0.12 + i * 2.5) * 0.8;
    ctx.save();
    ctx.rotate(-0.6 + i * 0.25);
    const gr = ctx.createLinearGradient(off - 0.12, 0, off + 0.12, 0);
    const spectrum = ['rgba(255,80,120,0)', 'rgba(255,120,90,0.06)', 'rgba(255,230,120,0.07)', 'rgba(120,255,170,0.06)', 'rgba(110,190,255,0.07)', 'rgba(180,120,255,0.06)', 'rgba(180,120,255,0)'];
    spectrum.forEach((c, k) => gr.addColorStop(k / (spectrum.length - 1), c));
    ctx.fillStyle = gr;
    ctx.fillRect(off - 0.12, -2, 0.24, 4);
    ctx.restore();
  }
  // Poussière de lumière
  const n = s.small ? 10 : 26;
  for (let i = 0; i < n; i++) {
    const p = (t * (0.025 + 0.03 * hash(i + 2)) + hash(i)) % 1;
    const x = (hash(i + 40) - 0.5) * 2 + Math.sin(t * 0.5 + i) * 0.05;
    const y = 1 - p * 2;
    const tw = Math.pow(0.5 + 0.5 * Math.sin(t * (1.5 + hash(i + 7) * 2) + i * 3), 3);
    const cols = ['#cfe8ff', '#ffd6f4', '#d6fff0', '#fff4c8'];
    sprite(ctx, glowTex(cols[i % 4]), x, y, 0.01 + 0.018 * tw, Math.sin(p * Math.PI) * (0.25 + 0.75 * tw));
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawOrrhaides(ctx, s) {
  const { t, bot, mouth, accent } = s;
  const fl = Math.sin(t * 0.8) * 0.02;
  // Lumière qui tourne autour du cristal (reflets qui balaient)
  const la = t * 0.45;
  const L = norm3([Math.cos(la) * 0.85, -0.35 + 0.15 * Math.sin(la * 0.7), 0.45 + 0.35 * Math.sin(la)]);
  const sing = 0.5 * mouth + 0.2 * s.talk;

  // Éclats flottants : ceux de derrière d'abord
  const orbit = (front) => {
    for (let i = 0; i < 6; i++) {
      const a = s.ph * 0.35 + (i * Math.PI * 2) / 6;
      const depth = Math.sin(a);
      if ((depth > 0) !== front) continue;
      // Anneau incliné : passe au-dessus de la tête derrière, sous le visage devant
      const x = Math.cos(a) * 0.76, y = -0.25 + depth * 0.42 + Math.sin(t * 1.3 + i) * 0.03 + fl;
      const sc = 0.8 + 0.25 * depth;
      shard2D(ctx, s, x, y, 0.13 * sc, 0.035 * sc, a * 0.5 + i, L, front ? 1 : 0.55);
      if (front && !s.small) {
        ctx.globalCompositeOperation = 'lighter';
        sprite(ctx, glowTex(accent), x, y - 0.06 * sc, 0.06, 0.25 + sing);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
    }
  };
  orbit(false);

  // Buste : bouclier de cristal facetté
  const B = { top: [0, 0.36], ls: [-0.7, 0.6], rs: [0.7, 0.6], lb: [-0.95, 1.25], rb: [0.95, 1.25], m: [0, 0.8], ml: [-0.32, 1.25], mr: [0.32, 1.25] };
  const torso = [
    [[B.top, B.ls, B.m], [-0.4, -0.6, 0.7]],
    [[B.top, B.m, B.rs], [0.4, -0.6, 0.7]],
    [[B.ls, B.lb, B.ml, B.m], [-0.7, 0.1, 0.7]],
    [[B.m, B.ml, B.mr], [0, 0.25, 0.97]],
    [[B.rs, B.m, B.mr, B.rb], [0.7, 0.1, 0.7]],
  ];
  for (const [pts, n] of torso) {
    const { b, spec } = crystalTone(norm3(n), L, -0.1);
    ctx.fillStyle = lin(ctx, 0, 0.3, 0, 1.2, [[0, toneColor(b, spec, 0.06)], [1, toneColor(b, spec, -0.25)]]);
    poly(ctx, pts);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,240,255,0.35)';
    ctx.lineWidth = 0.007;
    ctx.stroke();
  }
  // Veines de lumière dans la masse du buste
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(accent, 0.12 + 0.2 * sing);
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  ctx.moveTo(-0.62, 0.66); ctx.lineTo(-0.3, 0.9); ctx.lineTo(-0.2, 1.2);
  ctx.moveTo(0.62, 0.66); ctx.lineTo(0.34, 0.86); ctx.lineTo(0.42, 1.2);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.beginPath();
  for (const [pts] of torso) { ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.closePath(); }
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  blit(ctx, s, 'or-incl-torso', -0.95, 0.36, 1.9, 0.9, (g) => orInclusions(g, s, 61, [-0.8, 0.45, 0.8, 1.2]));
  // Caustiques : la lumière réfractée par la tête se décompose sur le buste
  if (!s.small) {
    const cols = ['#ff7a9a', '#ffd27a', '#8affb0', '#7ac0ff', '#c08aff'];
    for (let i = 0; i < 10; i++) {
      const a = t * (0.25 + 0.1 * hash(i)) + i * 1.7;
      const x = Math.sin(a) * 0.5 + s.hx * 0.1, y = 0.62 + Math.sin(a * 1.3 + i) * 0.14;
      sprite(ctx, glowTex(cols[i % 5]), x, y, 0.035 + 0.02 * hash(i + 4), 0.18 + 0.2 * Math.sin(t * 2 + i) + 0.3 * sing);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Grappes d'éclats sur les épaules
  for (const side of [-1, 1]) {
    shard2D(ctx, s, side * 0.96, 1.08, 0.44, 0.085, side * 0.9, L);
    shard2D(ctx, s, side * 0.78, 0.98, 0.66, 0.11, side * 0.55, L);
    shard2D(ctx, s, side * 0.58, 0.92, 0.42, 0.075, side * 0.28, L);
  }
  // Cœur de poitrine qui pulse et chante
  const core = 0.5 + 0.2 * Math.sin(t * 1.4) + sing;
  ctx.globalCompositeOperation = 'lighter';
  sprite(ctx, softTex(accent), 0, 0.6, 0.32, core * 0.55);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = lin(ctx, -0.07, 0.46, 0.07, 0.74, [[0, '#ffffff'], [0.5, rgba(accent, 0.9)], [1, '#6a8cc8']]);
  poly(ctx, [[0, 0.45], [0.075, 0.59], [0, 0.75], [-0.075, 0.59]]);
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  sprite(ctx, glowTex('#ffffff'), 0, 0.59, 0.07 + 0.05 * mouth, clamp01(core));
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // Col d'éclats sur lequel repose la tête
  shard2D(ctx, s, 0, 0.5, 0.36, 0.075, 0, L);
  for (const [x, len, a] of [[-0.3, 0.3, -0.75], [0.3, 0.3, 0.75], [-0.17, 0.36, -0.4], [0.17, 0.36, 0.4]]) {
    shard2D(ctx, s, x, 0.46, len + 0.03, 0.06, a, L);
  }

  // Tête : bipyramide en 3D légère, tourne un peu vers ce qu'elle regarde
  ctx.save();
  ctx.translate(0, fl - s.nod * 0.02);
  ctx.rotate(s.tilt * 0.8);
  const yaw = s.hx * 0.32 + 0.06 * Math.sin(t * 0.37);
  const cY = Math.cos(yaw), sY = Math.sin(yaw);
  const R = (p) => rotY(p, cY, sY);
  // Éclats de couronne, derrière
  shard2D(ctx, s, -0.24 + yaw * 0.1, -0.5, 0.36, 0.06, -0.55, L);
  shard2D(ctx, s, 0.27 + yaw * 0.1, -0.48, 0.3, 0.05, 0.5, L);
  // Lumière intérieure (vue à travers les facettes)
  ctx.globalCompositeOperation = 'lighter';
  sprite(ctx, softTex(accent), 0, -0.32, 0.5, 0.5 + 0.4 * sing);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const front = [], back = [];
  const sil = new Path2D();
  for (let i = 0; i < OR_FACETS.length; i++) {
    const f = OR_FACETS[i];
    const v = f.v.map(R);
    let cx = 0, cy = 0, cz = 0;
    for (const p of v) { cx += p[0]; cy += p[1]; cz += p[2]; }
    cx /= v.length; cy /= v.length; cz /= v.length;
    const e1 = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
    const e2 = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
    let n = norm3([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
    if (dot3(n, [cx, cy + 0.36, cz]) < 0) n = n.map((q) => -q);
    const item = { f, i, pts: v.map(proj), n };
    (n[2] > 0 ? front : back).push(item);
  }
  // Arêtes arrière devinées par réfraction
  ctx.strokeStyle = 'rgba(200,230,255,0.16)';
  ctx.lineWidth = 0.006;
  for (const it of back) { poly(ctx, it.pts); ctx.stroke(); }
  // Facettes avant, translucides
  for (const it of front) {
    const lit = mouth * hash(it.i + s.syl * 13) * 0.35;
    const { b, spec } = crystalTone(it.n, L, lit);
    it.spec = spec;
    const ys = it.pts.map((p) => p[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = lin(ctx, 0, y0, 0, y1, [[0, toneColor(b, spec, 0.12)], [1, toneColor(b, spec, -0.14)]]);
    poly(ctx, it.pts);
    ctx.fill();
    const sp = new Path2D();
    sp.moveTo(it.pts[0][0], it.pts[0][1]);
    for (let k = 1; k < it.pts.length; k++) sp.lineTo(it.pts[k][0], it.pts[k][1]);
    sp.closePath();
    sil.addPath(sp);
  }
  ctx.globalAlpha = 1;
  // Dispersion : bande irisée qui glisse à l'intérieur du cristal
  ctx.save();
  ctx.clip(sil);
  ctx.globalCompositeOperation = 'lighter';
  ctx.save();
  ctx.translate(-yaw * 0.12, 0);
  blit(ctx, s, 'or-incl-head', -0.4, -0.95, 0.8, 1.2, (g) => orInclusions(g, s, 83, [-0.25, -0.8, 0.25, 0.1]));
  ctx.restore();
  const pulse = 0.12 + 0.05 * Math.sin(t * 1.4) + 0.3 * sing + 0.2 * mouth * hash(s.syl);
  sprite(ctx, softTex(accent), 0, -0.4, 0.42, pulse);
  sprite(ctx, glowTex('#ffffff'), 0, -0.42, 0.09, pulse * 0.4);
  const g0 = ((t * 0.18) % 1) * 2.4 - 1.2;
  const gr = ctx.createLinearGradient(g0 - 0.3, -0.9, g0 + 0.3, 0.3);
  ['rgba(255,90,140,0)', 'rgba(255,120,120,0.16)', 'rgba(255,230,140,0.18)', 'rgba(130,255,190,0.16)', 'rgba(120,180,255,0.18)', 'rgba(200,130,255,0.15)', 'rgba(200,130,255,0)'].forEach((c, k, a) => gr.addColorStop(k / (a.length - 1), c));
  ctx.fillStyle = gr;
  ctx.fillRect(-0.6, -1, 1.2, 1.4);
  // Reflet blanc qui balaie
  const sw = ((t * 0.3) % 2.6) - 1.3;
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  poly(ctx, [[sw - 0.08, -1], [sw + 0.02, -1], [sw + 0.3, 0.4], [sw + 0.2, 0.4]]);
  ctx.fill();
  ctx.restore();
  // Arêtes vives, qui s'allument sur les syllabes ; franges chromatiques (dispersion)
  ctx.globalCompositeOperation = 'lighter';
  if (!s.small) {
    ctx.lineWidth = 0.006;
    for (const [dx, col] of [[-0.006, 'rgba(255,90,120,0.22)'], [0.006, 'rgba(90,160,255,0.26)']]) {
      ctx.strokeStyle = col;
      ctx.save();
      ctx.translate(dx, 0);
      for (const it of front) { poly(ctx, it.pts); ctx.stroke(); }
      ctx.restore();
    }
  }
  for (const it of front) {
    const lum = 0.22 + 0.4 * it.spec + mouth * hash(it.i + s.syl * 11) * 0.8;
    ctx.strokeStyle = rgba('#e8f6ff', clamp01(lum));
    ctx.lineWidth = 0.008;
    poly(ctx, it.pts);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';

  const { up, low } = OR_VERTS;
  const at = (k, y) => {
    const u = R(up[k % OR_N]), l = R(low[k % OR_N]);
    const f = (y - u[1]) / (l[1] - u[1]);
    return [u[0] + (l[0] - u[0]) * f, y, u[2] + (l[2] - u[2]) * f];
  };
  // Yeux : losanges lumineux posés sur les deux facettes de face
  const open = 1 - s.blink;
  for (const k of [OR_N - 1, 0]) {
    const a = at(k, -0.295), bb = at(k + 1, -0.295);
    const c = [(a[0] + bb[0]) / 2, -0.295, (a[2] + bb[2]) / 2];
    if (c[2] < 0.03) continue;
    const tx = (bb[0] - a[0]) * 0.34, tz = (bb[2] - a[2]) * 0.34;
    const h = (s.small ? 0.036 : 0.024) * open + 0.003;
    const P = (u, v) => proj([c[0] + tx * u, c[1] + h * v, c[2] + tz * u]);
    // Orbite taillée : fente sombre un peu plus large que l'œil
    const H = (u, v) => proj([c[0] + tx * u * 1.2, c[1] + 0.042 * v, c[2] + tz * u * 1.2]);
    ctx.fillStyle = 'rgba(6,10,36,0.8)';
    poly(ctx, [H(-1, 0), H(-0.2, -1), H(1, 0), H(0.2, 1)]);
    ctx.fill();
    const pc = proj(c);
    ctx.globalCompositeOperation = 'lighter';
    sprite(ctx, softTex(accent), pc[0], pc[1], 0.17, (0.55 + 0.4 * sing) * (0.3 + 0.7 * open));
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const ga = P(-1, 0), gb = P(1, 0);
    ctx.fillStyle = lin(ctx, ga[0], ga[1], gb[0], gb[1], [[0, '#5fa8ff'], [0.5, '#ffffff'], [1, '#5fa8ff']]);
    poly(ctx, [P(-1, 0), P(-0.2, -1), P(1, 0), P(0.2, 1)]);
    ctx.fill();
    // Étincelle-pupille qui suit le regard
    const pp = P(s.gx * 0.55, s.gy * 0.4);
    ctx.globalCompositeOperation = 'lighter';
    sprite(ctx, glowTex('#ffffff'), pp[0], pp[1], 0.035 + 0.01 * mouth, 0.9 * open);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  // Gemme vocale sous les yeux
  const gv = proj(R([0, -0.1, 0.3]));
  ctx.globalCompositeOperation = 'lighter';
  sprite(ctx, glowTex(accent), gv[0], gv[1], 0.05 + 0.07 * mouth, 0.25 + 0.75 * mouth);
  // Scintillements : sur les facettes qui renvoient la lumière, et un éclat au hasard de temps en temps
  if (!s.small) {
    for (const it of front) {
      if (it.spec > 0.35) sprite(ctx, starTex(), it.pts[0][0], it.pts[0][1], 0.1 * it.spec, it.spec);
    }
  }
  const gt = t * 0.6, gi = Math.floor(gt), gf = gt - gi;
  const gp = front[Math.floor(hash(gi) * front.length)];
  if (gp) sprite(ctx, starTex(), gp.pts[1][0], gp.pts[1][1], 0.12, Math.pow(Math.sin(gf * Math.PI), 4));
  // Anneaux de chant
  if (s.talk > 0.02) {
    for (let i = 0; i < 3; i++) {
      const p = (s.t * 0.7 + i / 3) % 1;
      ctx.strokeStyle = rgba(accent, 0.4 * (1 - p) * s.talk * (0.5 + mouth));
      ctx.lineWidth = 0.01 * (1 - p) + 0.003;
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const x = Math.cos(a) * (0.4 + p * 0.6), y = -0.32 + Math.sin(a) * (0.4 + p * 0.6) * 0.95;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  orbit(true);
}

// ---------- Rendu peint : outils communs aux portraits réalistes ----------
// Volumes modelés par la lumière : lumière principale en haut à gauche, contre-jour coloré à droite,
// occlusion dans les creux, matières (grain, plumes, écailles, tissu), yeux humides.

const blurF = (s, u) => `blur(${Math.max(0.5, u * s.px).toFixed(1)}px)`;

// Canevas de travail partagé (calques pré-rendus) : permet des bandes de lumière et des ombres
// intérieures exactes, même sur des formes faites de plusieurs contours qui se chevauchent.
let SCRATCH = null;
function scratch(g) {
  if (!SCRATCH) SCRATCH = document.createElement('canvas');
  const c = SCRATCH;
  if (c.width !== g.canvas.width || c.height !== g.canvas.height) { c.width = g.canvas.width; c.height = g.canvas.height; }
  const t = c.getContext('2d');
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = 'source-over';
  t.clearRect(0, 0, c.width, c.height);
  t.setTransform(g.getTransform());
  return t;
}
function blitScratch(g, s, shp, blur) {
  g.save();
  g.clip(shp);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (blur) g.filter = blurF(s, blur);
  g.drawImage(SCRATCH, 0, 0);
  g.restore();
}

// Bande de lumière (ou d'ombre) le long du bord opposé au décalage (dx, dy).
function band(g, s, shp, dx, dy, color, blur) {
  const t = scratch(g);
  t.fillStyle = color;
  t.fill(shp);
  t.globalCompositeOperation = 'destination-out';
  t.fillStyle = '#000';
  t.translate(dx, dy);
  t.fill(shp);
  blitScratch(g, s, shp, blur);
}

// Ombre intérieure le long du bord (occlusion ambiante aux contours).
function innerShade(g, s, shp, color, w) {
  const t = scratch(g);
  t.save();
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.fillStyle = color;
  t.fillRect(0, 0, t.canvas.width, t.canvas.height);
  t.restore();
  t.globalCompositeOperation = 'destination-out';
  t.fillStyle = '#000';
  t.fill(shp);
  blitScratch(g, s, shp, w);
}

// Ombre portée floue d'une forme (caster) sur une autre (onto).
function castShadow(g, s, onto, caster, dx, dy, blur, color) {
  g.save();
  g.clip(onto);
  g.filter = blurF(s, blur);
  g.translate(dx, dy);
  g.fillStyle = color;
  g.fill(caster);
  g.restore();
}

// Reflet spéculaire doux (matière humide ou lustrée).
function gloss(g, s, x, y, rx, ry, rot, a, blur = 0.01) {
  g.save();
  g.filter = blurF(s, blur);
  g.fillStyle = `rgba(255,255,255,${a})`;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// Modelé global : assombrit la forme loin de la lumière (mode « multiply »).
function modelVol(g, shp, box, lx, ly, dark) {
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0, h = y1 - y0;
  g.save();
  g.clip(shp);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = rad(g, x0 + w * lx, y0 + h * ly, 0, Math.hypot(w, h) * 0.85, [[0, '#ffffff'], [0.45, '#e2dad2'], [1, dark]]);
  g.fill(shp);
  g.restore();
}

// Éclairage de cinéma : ombre propre (bas-droite), occlusion des bords, lumière principale, contre-jour.
function light3(g, s, shp, L, d = 1) {
  band(g, s, shp, -0.07 * d, -0.09 * d, L.shadow, 0.08 * d);
  innerShade(g, s, shp, L.ao, 0.03 * d + 0.006);
  band(g, s, shp, 0.03 * d, 0.04 * d, L.key, 0.03 * d);
  band(g, s, shp, -0.016 * d - 0.006, 0.006, L.rim, 0.01);
}

// Disques de bokeh (lumières hors champ, floues).
function bokehDiscs(g, rnd, n, box, cols, r0, r1, a0, a1) {
  const [x0, y0, x1, y1] = box;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    const r = r0 + rnd() * (r1 - r0), a = a0 + rnd() * (a1 - a0);
    const c = cols[Math.floor(rnd() * cols.length)];
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(c, a * 0.5));
    gr.addColorStop(0.8, rgba(c, a * 0.65));
    gr.addColorStop(0.92, rgba(c, a * 0.8));
    gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// Poussières lumineuses qui dérivent ; dir < 0 : montent, dir > 0 : tombent.
function motes(ctx, s, seed, n, cols, speed, size, dir, alpha = 1) {
  const { t } = s;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const k = i + seed * 50;
    const p = (t * speed * (0.6 + hash(k + 1)) + hash(k)) % 1;
    const x = (hash(k + 2) - 0.5) * 2.2 + Math.sin(t * (0.3 + hash(k + 3) * 0.5) + k) * 0.08;
    const y = dir < 0 ? 1.1 - p * 2.2 : -1.1 + p * 2.2;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(k + 4) * 2) + k);
    sprite(ctx, glowTex(cols[i % cols.length]), x, y, size * (0.6 + hash(k + 5)), Math.sin(p * Math.PI) * (0.3 + 0.6 * tw) * alpha);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function mixHex(a, b, f) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((A >> sh) & 255) * (1 - f) + ((B >> sh) & 255) * f);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// Trait lissé passant par les milieux des segments.
function strokeSmooth(g, pts) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  }
  const l = pts[pts.length - 1];
  g.lineTo(l[0], l[1]);
  g.stroke();
}

function quadPts(a, c, b, n) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n, v = 1 - u;
    out.push([v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]);
  }
  return out;
}

// Contour fermé d'un ruban qui suit une ligne (membres, sangles), largeur de w0 à w1.
function ribbon(pts, w0, w1) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const w = w0 + (w1 - w0) * (i / (pts.length - 1));
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  return L.concat(R.reverse());
}

// Plis de tissu : creux sombre flou doublé d'une crête claire.
function folds(g, s, shp, lines, w, dark, light) {
  g.save();
  g.clip(shp);
  g.filter = blurF(s, w * 0.7);
  for (const pts of lines) {
    g.strokeStyle = dark;
    g.lineWidth = w;
    strokeSmooth(g, pts);
    g.strokeStyle = light;
    g.lineWidth = w * 0.55;
    strokeSmooth(g, pts.map(([x, y]) => [x - w * 0.9, y - w * 0.2]));
  }
  g.restore();
}

// Trame tissée fine.
function weave(g, shp, box, step, color) {
  const [x0, y0, x1, y1] = box;
  g.save();
  g.clip(shp);
  g.strokeStyle = color;
  g.lineWidth = step * 0.35;
  g.beginPath();
  for (let x = x0 - (y1 - y0); x < x1; x += step) { g.moveTo(x, y0); g.lineTo(x + (y1 - y0), y1); }
  for (let x = x0; x < x1 + (y1 - y0); x += step * 1.3) { g.moveTo(x, y0); g.lineTo(x - (y1 - y0), y1); }
  g.stroke();
  g.restore();
}

// Écailles granuleuses, chacune modelée (lumière haut-gauche, bord sombre), posées de bas en haut.
function scaleField(g, s, shp, box, size, base, light, dark, rnd) {
  const [x0, y0, x1, y1] = box;
  g.save();
  g.clip(shp);
  let row = 0;
  for (let y = y1 + size; y > y0 - size; y -= size * 0.62, row++) {
    for (let x = x0 - size + (row % 2) * size * 0.5; x < x1 + size; x += size) {
      const cx = x + (rnd() - 0.5) * size * 0.2, cy = y + (rnd() - 0.5) * size * 0.2;
      const r = size * (0.5 + rnd() * 0.12);
      g.fillStyle = rad(g, cx - r * 0.35, cy - r * 0.45, r * 0.05, r * 1.15, [[0, light], [0.5, base], [1, dark]]);
      g.beginPath();
      g.ellipse(cx, cy, r, r * 0.88, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

// Tuyau annelé (respirateurs, combinaisons).
function corrugated(g, pts, r, dark, light) {
  for (let i = pts.length - 1; i >= 0; i--) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    g.save();
    g.translate(pts[i][0], pts[i][1]);
    g.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]));
    g.fillStyle = lin(g, 0, -r, 0, r, [[0, light], [0.45, dark], [1, '#050302']]);
    g.beginPath();
    g.ellipse(0, 0, r * 0.45, r, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}

function brass(g, x0, y0, x1, y1) {
  return lin(g, x0, y0, x1, y1, [[0, '#fff0c0'], [0.25, '#d8a060'], [0.5, '#7a4a20'], [0.72, '#e8b070'], [1, '#4a2a10']]);
}

function rivet(g, x, y, r, light = '#fff4d0', mid = '#c89050', dark = '#3a2008') {
  g.fillStyle = rad(g, x - r * 0.35, y - r * 0.35, 0, r * 1.25, [[0, light], [0.4, mid], [1, dark]]);
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

// Iris fibreux pré-rendu (calque), avec pupille ronde, large, petite ou fendue.
function irisPainter(R, cols, pupil, seed) {
  return (g) => {
    const rnd = seeded(seed);
    g.fillStyle = rad(g, 0, 0, 0, R, [[0, cols[0]], [0.3, cols[1]], [0.78, cols[2]], [0.93, cols[3]], [1, rgba(cols[3], 0)]]);
    g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 120; i++) {
      const a = rnd() * Math.PI * 2, r0 = R * (0.22 + rnd() * 0.15), r1 = R * (0.6 + rnd() * 0.32);
      const b = a + (rnd() - 0.5) * 0.2;
      g.strokeStyle = rnd() < 0.55 ? `rgba(255,245,220,${0.06 + rnd() * 0.16})` : `rgba(0,0,0,${0.08 + rnd() * 0.18})`;
      g.lineWidth = R * (0.02 + rnd() * 0.03);
      g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(b) * r1, Math.sin(b) * r1); g.stroke();
    }
    g.strokeStyle = rgba(cols[0], 0.3);
    g.lineWidth = R * 0.07;
    g.beginPath(); g.arc(0, 0, R * 0.44, 0, Math.PI * 2); g.stroke();
    if (pupil === 'slit') {
      g.fillStyle = rad(g, 0, 0, 0, R * 0.9, [[0, '#020103'], [1, '#100406']]);
      g.beginPath(); g.ellipse(0, 0, R * 0.13, R * 0.84, 0, 0, Math.PI * 2); g.fill();
    } else {
      const pr = R * (pupil === 'wide' ? 0.56 : pupil === 'small' ? 0.24 : 0.36);
      g.fillStyle = rad(g, 0, 0, pr * 0.75, pr * 1.12, [[0, '#020103'], [1, 'rgba(2,1,3,0)']]);
      g.beginPath(); g.arc(0, 0, pr * 1.12, 0, Math.PI * 2); g.fill();
    }
  };
}

// Contour d'œil : paupière basse puis haute ; k = 1 ouvert, -1 fermé ; round : œil rond (oiseau).
function eyeCurves(rx, ry, round) {
  return { cx: round ? rx : rx * 0.42, cl: round ? 1.33 : 1.25 };
}
function eyePath(rx, ry, k, round) {
  const { cx, cl } = eyeCurves(rx, ry, round);
  const p = new Path2D();
  p.moveTo(-rx, 0);
  p.bezierCurveTo(-cx, ry * cl, cx, ry * cl, rx, 0);
  p.bezierCurveTo(cx, -ry * cl * k, -cx, -ry * cl * k, -rx, 0);
  p.closePath();
  return p;
}

// Œil humide : globe, iris fibreux qui suit le regard, ombre de la paupière, occlusion des coins,
// reflet de la lumière principale et reflet coloré du contre-jour, paupière qui cligne.
function wetEye(ctx, s, x, y, o) {
  const open = clamp01(1 - s.blink);
  const { rx, ry } = o;
  const top = o.top ?? 1;
  const k = -1 + (top + 1) * open;
  const m = Math.min(rx, ry * 1.6);
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (open < 0.995) {
    ctx.fillStyle = o.lid;
    ctx.fill(eyePath(rx, ry, top, o.round));
  }
  if (k > -0.97) {
    ctx.save();
    ctx.clip(eyePath(rx, ry, k, o.round));
    ctx.fillStyle = rad(ctx, -rx * 0.15, -ry * 0.1, 0, rx * 1.15, o.sclera);
    ctx.fillRect(-rx, -ry * 1.5, 2 * rx, ry * 3);
    const R = o.irisR;
    const ir = layer(s, o.id, -R, -R, 2 * R, 2 * R, o.paintIris);
    ctx.drawImage(ir, s.gx * rx * (o.look ?? 0.3) - R, s.gy * ry * (o.lookY ?? 0.25) - R, 2 * R, 2 * R);
    ctx.fillStyle = lin(ctx, 0, -ry * 1.2, 0, ry * 0.6, [[0, 'rgba(0,0,0,0.72)'], [0.5, 'rgba(0,0,0,0.18)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(-rx, -ry * 1.5, 2 * rx, ry * 3);
    ctx.fillStyle = rad(ctx, 0, 0, rx * 0.55, rx * 1.05, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.5)']]);
    ctx.fillRect(-rx, -ry * 1.5, 2 * rx, ry * 3);
    // Reflets humides
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.ellipse(-rx * 0.3, -ry * 0.32, m * 0.5, m * 0.36, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.ellipse(-rx * 0.3, -ry * 0.36, m * 0.2, m * 0.14, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-rx * 0.06, -ry * 0.46, m * 0.06, 0, Math.PI * 2); ctx.fill();
    if (o.rim) {
      ctx.fillStyle = rgba(o.rim, 0.6);
      ctx.beginPath(); ctx.ellipse(rx * 0.4, ry * 0.36, m * 0.16, m * 0.07, -0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // Bord de paupière haute (cils), liseré humide de la paupière basse
  const { cx, cl } = eyeCurves(rx, ry, o.round);
  ctx.beginPath();
  ctx.moveTo(rx, 0);
  ctx.bezierCurveTo(cx, -ry * cl * k, -cx, -ry * cl * k, -rx, 0);
  ctx.strokeStyle = o.lash ?? 'rgba(14,7,4,0.9)';
  ctx.lineWidth = o.lashW ?? m * 0.22;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-rx * 0.85, ry * 0.2);
  ctx.bezierCurveTo(-cx * 0.85, ry * cl * 0.95, cx * 0.85, ry * cl * 0.95, rx * 0.85, ry * 0.2);
  ctx.strokeStyle = 'rgba(255,240,230,0.28)';
  ctx.lineWidth = m * 0.07;
  ctx.stroke();
  ctx.restore();
}

// ---------- Kel-Tirr : petit oiseau vif, plumage crème, grands yeux humides ----------

const KT_L = { key: 'rgba(255,244,214,0.6)', rim: 'rgba(170,225,255,0.6)', shadow: 'rgba(70,42,12,0.5)', ao: 'rgba(80,50,15,0.45)' };

function ktBody() {
  const p = new Path2D();
  p.moveTo(-0.3, 0.1);
  p.bezierCurveTo(-0.66, 0.2, -0.98, 0.5, -1.04, 1.4);
  p.lineTo(1.04, 1.4);
  p.bezierCurveTo(0.98, 0.5, 0.66, 0.2, 0.3, 0.1);
  p.closePath();
  return p;
}

function ktWing(side) {
  const p = new Path2D();
  p.moveTo(-0.48, 0.3);
  p.bezierCurveTo(-0.86, 0.34, -1.08, 0.8, -1.02, 1.4);
  p.lineTo(-0.58, 1.4);
  p.bezierCurveTo(-0.64, 0.95, -0.6, 0.58, -0.48, 0.3);
  p.closePath();
  if (side < 0) return p;
  const q = new Path2D();
  q.addPath(p, new DOMMatrix([-1, 0, 0, 1, 0, 0]));
  return q;
}

// Plume : ombre portée, vexille dégradée (base sombre → pointe claire), barbes et rachis.
function feather(g, x, y, len, w, ang, cols, rnd) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const p = new Path2D();
  p.moveTo(0, -len * 0.1);
  p.bezierCurveTo(-w * 1.1, len * 0.15, -w * 0.9, len * 0.8, 0, len);
  p.bezierCurveTo(w * 0.9, len * 0.8, w * 1.1, len * 0.15, 0, -len * 0.1);
  g.save();
  g.translate(len * 0.02, len * 0.07);
  g.fillStyle = 'rgba(70,45,15,0.22)';
  g.fill(p);
  g.restore();
  g.fillStyle = lin(g, 0, 0, 0, len, [[0, cols[0]], [0.62, cols[1]], [1, cols[2]]]);
  g.fill(p);
  g.lineWidth = len * 0.014;
  for (let k = 0; k < 6; k++) {
    const u = 0.2 + k * 0.13;
    g.strokeStyle = `rgba(90,60,20,${0.1 + rnd() * 0.12})`;
    g.beginPath();
    g.moveTo(0, len * u); g.lineTo(-w * 0.85, len * (u + 0.13));
    g.moveTo(0, len * u); g.lineTo(w * 0.85, len * (u + 0.13));
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,250,232,0.35)';
  g.lineWidth = len * 0.016;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len * 0.88); g.stroke();
  g.restore();
}

function bgKeltirr(ctx, s) {
  const { t, hw, hh } = s;
  blit(ctx, s, 'kt-bg', -hw, -hh, 2 * hw, 2 * hh, (g) => {
    g.fillStyle = lin(g, -0.6, -hh, 0.4, hh, [[0, '#d8e0a0'], [0.25, '#5e7c3c'], [0.6, '#24401f'], [1, '#0e1c10']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    const rnd = seeded(41);
    // Feuillage lointain très flou (profondeur de champ)
    g.filter = blurF(s, 0.07);
    for (let i = 0; i < 28; i++) {
      const c = ['#2e5a26', '#4a7a30', '#1c3a1a', '#7a9a40'][Math.floor(rnd() * 4)];
      g.fillStyle = rgba(c, 0.5 + rnd() * 0.45);
      g.beginPath();
      g.ellipse((rnd() - 0.5) * 2.4, (rnd() - 0.5) * 2.2, 0.15 + rnd() * 0.3, 0.1 + rnd() * 0.2, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // Troncs plus proches, moins flous
    g.filter = blurF(s, 0.03);
    for (const [x, w] of [[-0.92, 0.18], [0.8, 0.24], [-0.56, 0.07], [0.52, 0.06]]) {
      g.fillStyle = lin(g, x - w / 2, 0, x + w / 2, 0, [[0, '#4a3a20'], [0.35, '#2a1e10'], [1, '#0e0a06']]);
      g.fillRect(x - w / 2, -hh, w, 2 * hh);
    }
    g.filter = 'none';
    // Taches de soleil à travers les feuilles
    bokehDiscs(g, rnd, 30, [-hw, -hh, hw, 0.5], ['#fff2b0', '#ffe080', '#d8f0a0'], 0.03, 0.1, 0.12, 0.42);
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = rad(g, -0.75, -0.95, 0, 1.4, [[0, 'rgba(255,240,180,0.5)'], [1, 'rgba(255,240,180,0)']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    g.globalCompositeOperation = 'source-over';
  });
  // Rayons de soleil qui ondulent, pollen
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const x = -0.9 + i * 0.45 + Math.sin(t * 0.13 + i * 2) * 0.1;
    const a = 0.05 + 0.03 * Math.sin(t * 0.4 + i * 1.7);
    ctx.save();
    ctx.rotate(-0.45);
    ctx.fillStyle = lin(ctx, 0, -1.4, 0, 1.2, [[0, rgba('#fff0b0', a)], [1, rgba('#fff0b0', 0)]]);
    ctx.fillRect(x, -1.6, 0.1 + 0.05 * i, 3);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  motes(ctx, s, 3, s.small ? 5 : 16, ['#fff4c0', '#ffffff'], 0.02, 0.012, -1);
}

function drawKeltirr(ctx, s) {
  const { t, mouth } = s;
  const b = s.breath * 0.014;
  const hop = Math.pow(Math.max(0, Math.sin(t * 0.9)), 14) * 0.025;

  // Buste : plumage en rangs, ailes repliées
  ctx.save();
  ctx.translate(0, b * 0.5);
  blit(ctx, s, 'kt-body', -1.12, 0.0, 2.24, 1.42, (g) => {
    const rnd = seeded(12);
    const body = ktBody();
    g.fillStyle = lin(g, 0, 0.1, 0, 1.3, [[0, '#f2e4b0'], [1, '#c8aa66']]);
    g.fill(body);
    g.save();
    g.clip(body);
    for (let y = 1.42, row = 0; y > 0.12; y -= 0.062, row++) {
      const hwid = 0.3 + 0.78 * Math.min(1, Math.pow(Math.max(0, y - 0.1) / 1.05, 0.65));
      const n = Math.ceil((2 * hwid) / 0.078) + 2;
      for (let i = 0; i < n; i++) {
        const x = -hwid - 0.04 + (row % 2) * 0.039 + i * 0.078 + (rnd() - 0.5) * 0.02;
        const breast = Math.abs(x) < 0.5;
        feather(g, x, y - 0.1, 0.15 + rnd() * 0.04, 0.05, -x * 0.35 + (rnd() - 0.5) * 0.15,
          breast ? ['#c8a860', '#f8eecc', '#fffaf0'] : ['#a8884a', '#ecdcaa', '#fff4dc'], rnd);
      }
    }
    g.restore();
    modelVol(g, body, [-1.04, 0.1, 1.04, 1.4], 0.32, 0.08, '#6a4a1e');
    light3(g, s, body, KT_L);
    // Ombre de la tête sur la gorge
    g.save(); g.clip(body); g.filter = blurF(s, 0.07);
    g.fillStyle = 'rgba(60,36,10,0.6)';
    g.beginPath(); g.ellipse(0.04, 0.2, 0.5, 0.17, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    for (const side of [-1, 1]) {
      const wing = ktWing(side);
      castShadow(g, s, body, wing, side * 0.035 + 0.02, 0.035, 0.04, 'rgba(60,36,10,0.5)');
      g.fillStyle = lin(g, side * 0.5, 0.3, side * 1.0, 1.3, [[0, '#d8bc78'], [1, '#8a6630']]);
      g.fill(wing);
      g.save();
      g.clip(wing);
      g.scale(-side, 1);
      // Rémiges (longues plumes à pointe sombre) puis couvertures arrondies
      for (let i = 0; i < 6; i++) {
        feather(g, 0.62 + i * 0.075, 0.86 + i * 0.015, 0.5, 0.065, 0.12 - i * 0.03, ['#6a4a20', '#b08e54', '#3a2810'], rnd);
      }
      for (let y = 0.95, row = 0; y > 0.26; y -= 0.055, row++) {
        for (let x = 0.42 + (row % 2) * 0.035; x < 1.12; x += 0.07) {
          feather(g, x, y - 0.06, 0.11, 0.042, 0.25, ['#8a6a30', '#dcc082', '#f6e8c0'], rnd);
        }
      }
      g.restore();
      modelVol(g, wing, side < 0 ? [-1.08, 0.3, -0.48, 1.4] : [0.48, 0.3, 1.08, 1.4], side < 0 ? 0.3 : 0.1, 0.1, '#5a3c14');
      light3(g, s, wing, KT_L, 0.7);
    }
  });
  ctx.restore();

  // Tête : vive, penchée comme un oiseau
  ctx.save();
  ctx.translate(s.hx * 0.035, -b - s.nod * 0.02 - hop);
  ctx.rotate(s.tilt * 1.6 + 0.05 * Math.sin(t * 0.8) + 0.02 * Math.sin(t * 2.7));
  // Huppe : plumes qui ondulent, s'ouvrent quand il parle
  for (const i of [0, 6, 1, 5, 2, 4, 3]) {
    const u = i / 6 - 0.5;
    const a = u * (1.1 + 0.25 * s.talk) + Math.sin(t * 2 + i * 0.9) * 0.05;
    const sc = 0.62 + 0.42 * (1 - Math.abs(u) * 1.5);
    ctx.save();
    ctx.translate(u * 0.14, -0.5);
    ctx.rotate(a);
    ctx.scale(sc, sc);
    blit(ctx, s, 'kt-crest', -0.1, -0.66, 0.2, 0.7, (g) => {
      const p = new Path2D();
      p.moveTo(-0.02, 0.02);
      p.bezierCurveTo(-0.085, -0.25, -0.06, -0.5, 0, -0.64);
      p.bezierCurveTo(0.06, -0.5, 0.085, -0.25, 0.02, 0.02);
      p.closePath();
      g.fillStyle = lin(g, 0, 0, 0, -0.64, [[0, '#f0dc90'], [0.5, '#fff07a'], [0.85, '#ffa040'], [1, '#e86a1a']]);
      g.fill(p);
      g.save(); g.clip(p);
      g.lineWidth = 0.006;
      for (let k = 0; k < 22; k++) {
        const y = -0.04 - k * 0.027;
        g.strokeStyle = k % 2 ? 'rgba(150,90,20,0.25)' : 'rgba(255,255,230,0.3)';
        g.beginPath(); g.moveTo(0, y); g.lineTo(-0.09, y - 0.05); g.moveTo(0, y); g.lineTo(0.09, y - 0.05); g.stroke();
      }
      g.restore();
      g.strokeStyle = 'rgba(255,250,230,0.6)';
      g.lineWidth = 0.008;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(0.005, -0.3, 0, -0.62); g.stroke();
      light3(g, s, p, KT_L, 0.3);
    });
    ctx.restore();
  }
  blit(ctx, s, 'kt-head', -0.66, -0.66, 1.32, 0.98, (g) => {
    const rnd = seeded(31);
    const skull = new Path2D();
    skull.arc(0, -0.17, 0.41, 0, Math.PI * 2);
    const tuft = [[-0.26, -0.16], [-0.55, -0.05], [-0.44, 0.0], [-0.6, 0.09], [-0.42, 0.12], [-0.52, 0.22], [-0.2, 0.18]];
    const head = union(skull, shape(tuft, 0.03), shape(mirror(tuft), 0.03));
    const box = [-0.62, -0.6, 0.62, 0.26];
    g.fillStyle = rad(g, -0.15, -0.36, 0.02, 0.62, [[0, '#fffbee'], [0.5, '#f0dea4'], [1, '#b8964c']]);
    g.fill(head);
    // Duvet : petites barbes orientées (disque facial rayonnant autour des yeux)
    g.save();
    g.clip(head);
    for (let i = 0; i < 1500; i++) {
      const x = (rnd() - 0.5) * 1.24, y = -0.6 + rnd() * 0.86;
      const dl = Math.hypot(x + 0.165, y + 0.18), dr = Math.hypot(x - 0.165, y + 0.18);
      let a;
      if (Math.min(dl, dr) < 0.27) a = Math.atan2(y + 0.18, x - (dl < dr ? -0.165 : 0.165));
      else a = Math.atan2(y + 0.8, x);
      const len = 0.022 + rnd() * 0.03;
      g.strokeStyle = rnd() < 0.55 ? `rgba(255,252,236,${0.22 + rnd() * 0.35})` : `rgba(140,105,45,${0.1 + rnd() * 0.2})`;
      g.lineWidth = 0.005 + rnd() * 0.004;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    // Disques faciaux : plus clairs, cerclés d'une collerette ocre
    for (const side of [-1, 1]) {
      const ex = side * 0.165;
      g.fillStyle = rad(g, ex, -0.18, 0.05, 0.26, [[0, 'rgba(255,250,235,0.35)'], [1, 'rgba(255,250,235,0)']]);
      g.fillRect(ex - 0.3, -0.5, 0.6, 0.6);
      g.save();
      g.filter = blurF(s, 0.012);
      g.strokeStyle = 'rgba(150,108,40,0.45)';
      g.lineWidth = 0.022;
      g.beginPath();
      if (side < 0) g.arc(ex, -0.18, 0.25, Math.PI * 0.45, Math.PI * 1.35);
      else g.arc(ex, -0.18, 0.25, -Math.PI * 0.35, Math.PI * 0.55);
      g.stroke();
      g.restore();
    }
    g.restore();
    modelVol(g, head, box, 0.3, 0.18, '#7a5624');
    light3(g, s, head, KT_L);
    // Peau sombre autour des yeux, ombre du bec
    g.save();
    g.filter = blurF(s, 0.012);
    for (const side of [-1, 1]) {
      g.fillStyle = 'rgba(40,26,10,0.92)';
      g.beginPath(); g.ellipse(side * 0.165, -0.178, 0.137, 0.143, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(80,50,15,0.4)';
    g.beginPath(); g.ellipse(0.02, 0.08, 0.08, 0.05, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    for (const side of [-1, 1]) {
      g.strokeStyle = 'rgba(255,240,200,0.25)';
      g.lineWidth = 0.008;
      g.beginPath(); g.arc(side * 0.165, -0.178, 0.14, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
    }
  });
  // Yeux
  for (const side of [-1, 1]) {
    wetEye(ctx, s, side * 0.165, -0.178, {
      id: 'kt-iris', rx: 0.122, ry: 0.128, round: true, top: 0.9, irisR: 0.112, look: 0.14, lookY: 0.12,
      sclera: [[0, '#4a3a20'], [1, '#140c04']], lid: '#e2cc8e', rim: '#bfe8ff', lashW: 0.012,
      paintIris: irisPainter(0.112, ['#5a7e9e', '#1a2c44', '#c08a2c', '#2a1806'], 'wide', 5),
    });
  }
  // Bec : intérieur, mandibule inférieure qui s'ouvre, bec supérieur corné
  ctx.fillStyle = rad(ctx, 0, 0.06, 0, 0.08, [[0, '#8a2018'], [1, '#2a0606']]);
  ctx.beginPath(); ctx.ellipse(0, 0.05 + mouth * 0.02, 0.062, 0.012 + mouth * 0.045, 0, 0, Math.PI * 2); ctx.fill();
  if (mouth > 0.05) {
    ctx.fillStyle = rad(ctx, -0.01, 0.07 + mouth * 0.03, 0, 0.04, [[0, '#f0a0a0'], [1, '#a04848']]);
    ctx.beginPath(); ctx.ellipse(0, 0.075 + mouth * 0.035, 0.03, 0.01 + mouth * 0.012, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.save();
  ctx.translate(0, mouth * 0.06);
  blit(ctx, s, 'kt-mand', -0.08, -0.0, 0.16, 0.15, (g) => {
    const p = new Path2D();
    p.moveTo(-0.066, 0.02);
    p.bezierCurveTo(-0.06, 0.08, -0.03, 0.115, 0, 0.128);
    p.bezierCurveTo(0.03, 0.115, 0.06, 0.08, 0.066, 0.02);
    p.quadraticCurveTo(0, 0.04, -0.066, 0.02);
    p.closePath();
    g.fillStyle = lin(g, -0.05, 0.02, 0.05, 0.13, [[0, '#ffc060'], [1, '#a84a14']]);
    g.fill(p);
    light3(g, s, p, KT_L, 0.3);
    gloss(g, s, -0.025, 0.06, 0.012, 0.025, 0.3, 0.5, 0.004);
  });
  ctx.restore();
  blit(ctx, s, 'kt-beak', -0.1, -0.1, 0.2, 0.24, (g) => {
    const rnd = seeded(7);
    const up = new Path2D();
    up.moveTo(-0.076, -0.06);
    up.bezierCurveTo(-0.08, 0.0, -0.04, 0.07, 0, 0.122);
    up.bezierCurveTo(0.04, 0.07, 0.08, 0.0, 0.076, -0.06);
    up.quadraticCurveTo(0, -0.09, -0.076, -0.06);
    up.closePath();
    g.fillStyle = lin(g, -0.06, -0.08, 0.05, 0.12, [[0, '#ffd27a'], [0.45, '#f09030'], [1, '#8a3a10']]);
    g.fill(up);
    speckle(g, up, rnd, 50, [-0.08, -0.09, 0.08, 0.12], '#fff0c0', '#5a2008', 0.005);
    // Cire pâle à la base
    g.save(); g.clip(up);
    g.fillStyle = lin(g, 0, -0.09, 0, -0.02, [[0, 'rgba(255,236,180,0.7)'], [1, 'rgba(255,236,180,0)']]);
    g.fillRect(-0.1, -0.1, 0.2, 0.1);
    g.restore();
    light3(g, s, up, KT_L, 0.35);
    g.strokeStyle = 'rgba(255,240,200,0.55)';
    g.lineWidth = 0.007;
    g.beginPath(); g.moveTo(-0.006, -0.065); g.quadraticCurveTo(-0.01, 0.04, -0.002, 0.11); g.stroke();
    gloss(g, s, -0.03, -0.01, 0.016, 0.034, 0.25, 0.75, 0.005);
    g.fillStyle = 'rgba(60,20,5,0.85)';
    for (const side of [-1, 1]) {
      g.beginPath(); g.ellipse(side * 0.032, -0.045, 0.01, 0.005, side * 0.5, 0, Math.PI * 2); g.fill();
    }
  });
  ctx.restore();

  if (!s.small) motes(ctx, s, 9, 4, ['#fff8d8'], 0.012, 0.05, -1, 0.35);
}

// ---------- Synodes : champignon pensant, chapeau velouté, lamelles lumineuses ----------

const SY_L = { key: 'rgba(205,215,255,0.38)', rim: 'rgba(198,160,255,0.9)', shadow: 'rgba(14,4,30,0.6)', ao: 'rgba(10,2,22,0.5)' };

// Réseau de mycélium au sol (nœuds et liens), fixe.
const SY_NET = (() => {
  const rnd = seeded(73);
  const nodes = [];
  for (let i = 0; i < 18; i++) nodes.push([(rnd() - 0.5) * 2.0, 0.72 + rnd() * 0.36]);
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]) < 0.48) links.push([i, j, rnd() * 6]);
    }
  }
  return { nodes, links };
})();

// Taches pâles du chapeau : position, taille.
const SY_SPOTS = (() => {
  const rnd = seeded(52);
  const out = [];
  for (let i = 0; i < 15; i++) {
    const x = (rnd() - 0.5) * 1.35;
    const top = -0.82 * Math.pow(Math.max(0, 1 - Math.pow(x / 0.86, 2)), 0.55);
    const y = top * (0.22 + rnd() * 0.62) - 0.04;
    out.push([x, y, (0.03 + rnd() * 0.045) * (1 - Math.abs(x) * 0.45), rnd()]);
  }
  return out;
})();

function syStem() {
  const p = new Path2D();
  p.moveTo(-0.17, -0.06);
  p.bezierCurveTo(-0.2, 0.3, -0.24, 0.55, -0.42, 0.78);
  p.bezierCurveTo(-0.6, 0.95, -0.95, 0.98, -1.12, 1.05);
  p.lineTo(-1.12, 1.45); p.lineTo(1.12, 1.45); p.lineTo(1.12, 1.05);
  p.bezierCurveTo(0.95, 0.98, 0.6, 0.95, 0.42, 0.78);
  p.bezierCurveTo(0.24, 0.55, 0.2, 0.3, 0.17, -0.06);
  p.closePath();
  return p;
}

function syDome() {
  const p = new Path2D();
  p.moveTo(-0.84, -0.02);
  p.bezierCurveTo(-0.86, -0.52, -0.42, -0.84, 0, -0.84);
  p.bezierCurveTo(0.42, -0.84, 0.86, -0.52, 0.84, -0.02);
  p.quadraticCurveTo(0, -0.1, -0.84, -0.02);
  p.closePath();
  return p;
}

const SY_EYES = [[-0.085, 0.16, 0.036, 'sy-iris'], [0.085, 0.16, 0.036, 'sy-iris'], [0, 0.252, 0.028, 'sy-iris2']];

function bgSynodes(ctx, s) {
  const { t, hw, hh } = s;
  blit(ctx, s, 'sy-bg', -hw, -hh, 2 * hw, 2 * hh, (g) => {
    g.fillStyle = lin(g, 0, -hh, 0, hh, [[0, '#1e1438'], [0.55, '#0d0a1c'], [1, '#161022']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    const rnd = seeded(61);
    // Brume basse
    g.filter = blurF(s, 0.1);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `rgba(140,110,200,${0.08 + rnd() * 0.08})`;
      g.beginPath(); g.ellipse((rnd() - 0.5) * 2.2, 0.1 + rnd() * 0.6, 0.5 + rnd() * 0.4, 0.08 + rnd() * 0.08, 0, 0, Math.PI * 2); g.fill();
    }
    // Champignons lointains, flous selon leur distance
    for (const [blur, n, sc] of [[0.045, 6, 0.6], [0.022, 4, 1]]) {
      g.filter = blurF(s, blur);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side * (0.5 + rnd() * 0.5), base = 0.5 + rnd() * 0.3, h = (0.25 + rnd() * 0.35) * sc, r = (0.08 + rnd() * 0.1) * sc;
        g.fillStyle = sc < 1 ? '#3a2e60' : '#54427e';
        g.fillRect(x - 0.015 * sc, base - h, 0.03 * sc, h);
        g.beginPath(); g.ellipse(x, base - h, r, r * 0.6, 0, Math.PI, 0); g.fill();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = sc < 1 ? 'rgba(198,160,255,0.5)' : 'rgba(140,240,220,0.6)';
        for (let k = 0; k < 3; k++) {
          g.beginPath(); g.arc(x + (rnd() - 0.5) * r, base - h - rnd() * r * 0.4, 0.012 * sc, 0, Math.PI * 2); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
      }
    }
    g.filter = 'none';
    bokehDiscs(g, rnd, 22, [-hw, -hh, hw, hh * 0.6], ['#c6a0ff', '#8ef0e0', '#e0d0ff'], 0.02, 0.07, 0.1, 0.35);
    g.fillStyle = lin(g, 0, 0.6, 0, hh, [[0, 'rgba(20,14,30,0)'], [1, 'rgba(20,14,30,0.9)']]);
    g.fillRect(-hw, 0.6, 2 * hw, hh);
  });
  // Brume qui passe lentement
  for (let i = 0; i < 2; i++) {
    const x = ((t * 0.02 + i * 0.5) % 1) * 3 - 1.5;
    sprite(ctx, softTex('#6a50a0'), x, 0.3 + i * 0.25, 0.8, 0.12);
  }
  ctx.globalAlpha = 1;
}

function drawSynodes(ctx, s) {
  const { t, mouth, accent } = s;
  const b = s.breath * 0.012;

  // Pied, voile (anneau), mycélium au sol
  ctx.save();
  ctx.translate(0, b * 0.3);
  const stem = syStem();
  blit(ctx, s, 'sy-stem', -1.14, -0.12, 2.28, 1.6, (g) => {
    const rnd = seeded(19);
    const box = [-1.12, -0.06, 1.12, 1.45];
    g.fillStyle = lin(g, -0.6, 0, 0.6, 0, [[0, '#dcd0ec'], [0.4, '#b0a0c8'], [1, '#4a3c66']]);
    g.fill(stem);
    // Fibres qui suivent l'évasement du pied
    g.save();
    g.clip(stem);
    for (let i = 0; i < 170; i++) {
      const u = rnd() * 2 - 1;
      g.strokeStyle = rnd() < 0.5 ? `rgba(240,232,255,${0.06 + rnd() * 0.12})` : `rgba(40,25,70,${0.08 + rnd() * 0.14})`;
      g.lineWidth = 0.004 + rnd() * 0.006;
      g.beginPath();
      g.moveTo(u * 0.17, -0.06);
      g.bezierCurveTo(u * 0.21, 0.4, u * 0.3, 0.75, u * 1.1, 1.1 + rnd() * 0.3);
      g.stroke();
    }
    g.restore();
    speckle(g, stem, rnd, 260, box, '#f4ecff', '#1a1030', 0.008);
    modelVol(g, stem, box, 0.32, 0.12, '#3a2a58');
    light3(g, s, stem, SY_L);
    // Ombre du chapeau
    g.save(); g.clip(stem);
    g.fillStyle = lin(g, 0, -0.06, 0, 0.3, [[0, 'rgba(10,0,25,0.8)'], [1, 'rgba(10,0,25,0)']]);
    g.fillRect(-0.4, -0.1, 0.8, 0.45);
    g.restore();
    // Creux des yeux et du pore vocal
    for (const [x, y, r] of SY_EYES) {
      g.fillStyle = rad(g, x, y, r * 0.9, r * 1.9, [[0, 'rgba(20,8,35,0.85)'], [1, 'rgba(20,8,35,0)']]);
      g.beginPath(); g.arc(x, y, r * 1.9, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(240,230,255,0.3)';
      g.lineWidth = 0.006;
      g.beginPath(); g.arc(x, y, r * 1.2, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    }
    g.fillStyle = rad(g, 0, 0.345, 0.02, 0.09, [[0, 'rgba(20,8,35,0.8)'], [1, 'rgba(20,8,35,0)']]);
    g.beginPath(); g.ellipse(0, 0.345, 0.09, 0.05, 0, 0, Math.PI * 2); g.fill();
    // Voile déchiré autour du pied
    const ringPts = [[-0.215, 0.42], [0, 0.445], [0.215, 0.42]];
    for (let k = 0; k <= 10; k++) ringPts.push([0.34 - k * 0.068, 0.56 + (k % 2) * 0.035 + rnd() * 0.02]);
    const ring = shape(ringPts, 0.01);
    castShadow(g, s, stem, ring, 0.01, 0.05, 0.03, 'rgba(10,0,25,0.6)');
    g.fillStyle = lin(g, 0, 0.42, 0, 0.6, [[0, '#ece2fa'], [1, '#9a88bc']]);
    g.fill(ring);
    g.save(); g.clip(ring);
    for (let k = 0; k < 40; k++) {
      const x = -0.34 + rnd() * 0.68;
      g.strokeStyle = `rgba(60,40,90,${0.1 + rnd() * 0.15})`;
      g.lineWidth = 0.004;
      g.beginPath(); g.moveTo(x * 0.65, 0.43); g.lineTo(x, 0.6); g.stroke();
    }
    g.restore();
    light3(g, s, ring, SY_L, 0.4);
    // Mycélium : filaments pâles sur l'humus
    g.save();
    g.clip(stem);
    g.fillStyle = lin(g, 0, 0.85, 0, 1.45, [[0, 'rgba(30,20,40,0)'], [1, 'rgba(30,20,40,0.85)']]);
    g.fillRect(-1.2, 0.85, 2.4, 0.6);
    g.restore();
    g.lineWidth = 0.006;
    for (const [i, j] of SY_NET.links) {
      const [a, c] = [SY_NET.nodes[i], SY_NET.nodes[j]];
      g.strokeStyle = 'rgba(225,210,255,0.28)';
      g.beginPath(); g.moveTo(a[0], a[1]);
      g.quadraticCurveTo((a[0] + c[0]) / 2 + 0.04, (a[1] + c[1]) / 2 + 0.03, c[0], c[1]);
      g.stroke();
    }
    for (const [x, y] of SY_NET.nodes) rivet(g, x, y, 0.014, '#f4ecff', '#a890d0', '#2a1a40');
  });
  // Lueur des lamelles sur le haut du pied, influx dans le mycélium
  ctx.save();
  ctx.clip(stem);
  ctx.globalCompositeOperation = 'lighter';
  sprite(ctx, softTex(accent), 0, 0.0, 0.42, 0.18 + 0.35 * mouth);
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  for (const [i, j, ph] of SY_NET.links) {
    const p = (t * 0.35 + ph) % 1;
    const a = SY_NET.nodes[i], c = SY_NET.nodes[j];
    const mx = (a[0] + c[0]) / 2 + 0.04, my = (a[1] + c[1]) / 2 + 0.03;
    const x = (1 - p) * (1 - p) * a[0] + 2 * (1 - p) * p * mx + p * p * c[0];
    const y = (1 - p) * (1 - p) * a[1] + 2 * (1 - p) * p * my + p * p * c[1];
    sprite(ctx, glowTex(accent), x, y, 0.03, Math.sin(p * Math.PI) * (0.35 + 0.5 * s.talk));
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Trois yeux luisants sur le pied
  for (const [x, y, r, id] of SY_EYES) {
    wetEye(ctx, s, x, y, {
      id, rx: r, ry: r * 0.92, round: true, top: 0.85, irisR: r * 0.8, look: 0.3,
      sclera: [[0, '#3a2858'], [1, '#0e0618']], lid: '#b0a0cc', rim: '#c6a0ff', lashW: 0.006,
      paintIris: irisPainter(r * 0.8, ['#ffffff', '#e0c8ff', '#7a50c0', '#1a0a30'], 'small', 23),
    });
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, r] of SY_EYES) sprite(ctx, softTex(accent), x, y, r * 2.6, 0.22 * (1 - s.blink));
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // Pore vocal : lèvres de chair qui s'entrouvrent, lueur intérieure
  const pw = 0.042 + 0.022 * mouth, ph = 0.005 + 0.028 * mouth;
  ctx.fillStyle = '#12061e';
  ctx.beginPath(); ctx.ellipse(0, 0.345, pw, ph, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  sprite(ctx, softTex(accent), 0, 0.345, 0.06 + 0.05 * mouth, 0.15 + 0.8 * mouth);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(235,222,250,0.55)';
  ctx.lineWidth = 0.007;
  ctx.beginPath(); ctx.ellipse(0, 0.345 + 0.004, pw + 0.004, ph + 0.006, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  ctx.strokeStyle = 'rgba(30,12,50,0.7)';
  ctx.beginPath(); ctx.ellipse(0, 0.345 - 0.003, pw + 0.004, ph + 0.004, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.restore();

  // Chapeau qui oscille
  ctx.save();
  ctx.translate(0, -0.06 - b);
  ctx.rotate(Math.sin(t * 0.6) * 0.03 + s.hx * 0.03);
  ctx.translate(0, 0.06);
  blit(ctx, s, 'sy-cap', -0.94, -0.9, 1.88, 1.04, (g) => {
    const rnd = seeded(37);
    // Dessous : lamelles
    const under = new Path2D();
    under.ellipse(0, -0.03, 0.8, 0.125, 0, 0, Math.PI * 2);
    g.fillStyle = '#20162e';
    g.fill(under);
    g.save(); g.clip(under);
    for (let k = 0; k < 90; k++) {
      const a = Math.PI * (k / 89);
      g.strokeStyle = k % 2 ? 'rgba(130,100,180,0.55)' : 'rgba(10,4,20,0.7)';
      g.lineWidth = 0.007;
      g.beginPath();
      g.moveTo(Math.cos(a) * 0.14, -0.03 + Math.sin(a) * 0.02);
      g.lineTo(Math.cos(a) * 0.8, -0.03 + Math.sin(a) * 0.125);
      g.stroke();
    }
    g.fillStyle = rad(g, 0, -0.03, 0.05, 0.4, [[0, 'rgba(5,0,10,0.8)'], [1, 'rgba(5,0,10,0)']]);
    g.fill(under);
    g.restore();
    // Dôme velouté
    const dome = syDome();
    const box = [-0.86, -0.84, 0.86, 0.0];
    g.fillStyle = rad(g, -0.25, -0.55, 0.02, 1.0, [[0, '#c8b2f2'], [0.35, '#8a6cc0'], [0.75, '#4a3478'], [1, '#22163c']]);
    g.fill(dome);
    g.save(); g.clip(dome);
    for (let k = 0; k < 110; k++) {
      const ex = -0.86 + rnd() * 1.72;
      g.strokeStyle = rnd() < 0.5 ? `rgba(230,215,255,${0.05 + rnd() * 0.08})` : `rgba(20,8,40,${0.06 + rnd() * 0.1})`;
      g.lineWidth = 0.004 + rnd() * 0.004;
      g.beginPath(); g.moveTo(0, -0.84); g.quadraticCurveTo(ex * 0.7, -0.7, ex, -0.04); g.stroke();
    }
    g.restore();
    speckle(g, dome, rnd, 500, box, '#efe4ff', '#140828', 0.007);
    // Taches pâles en relief
    for (const [x, y, r, h] of SY_SPOTS) {
      const pts = [];
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, rr = r * (0.75 + 0.5 * hash(h * 50 + k));
        pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7]);
      }
      const sp = shape(pts, r * 0.3);
      castShadow(g, s, dome, sp, 0.008, 0.014, 0.01, 'rgba(15,5,30,0.55)');
      g.fillStyle = rad(g, x - r * 0.3, y - r * 0.3, 0, r * 1.3, [[0, '#eee4fa'], [0.55, '#bcaad8'], [1, '#7a68a0']]);
      g.fill(sp);
    }
    modelVol(g, dome, box, 0.3, 0.2, '#2a1a48');
    light3(g, s, dome, SY_L);
    // Bord translucide éclairé par derrière
    band(g, s, dome, 0, -0.035, rgba(accent, 0.4), 0.02);
    // Lustre humide
    gloss(g, s, -0.32, -0.6, 0.24, 0.08, -0.5, 0.25, 0.04);
    gloss(g, s, -0.36, -0.62, 0.1, 0.025, -0.55, 0.55, 0.008);
  });
  // Lamelles qui s'illuminent avec la voix, taches qui palpitent
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 7; k++) {
    const u = k / 6 - 0.5;
    const lum = 0.22 + 0.1 * Math.sin(t * 1.5 + k) + mouth * (0.3 + 0.6 * hash(k + s.syl * 7));
    sprite(ctx, softTex(accent), u * 1.3, 0.02 + (0.25 - u * u) * 0.25, 0.22, lum);
  }
  if (!s.small) {
    for (const [x, y, r, h] of SY_SPOTS) sprite(ctx, softTex('#e8dcff'), x, y, r * 2.2, 0.12 + 0.12 * Math.sin(t * 1.2 + h * 9));
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // Spores qui montent (plus nombreuses quand il parle)
  motes(ctx, s, 5, (s.small ? 6 : 14) + Math.round(10 * s.talk), ['#efe4ff', '#c6a0ff'], 0.05, 0.016, -1);
}

// ---------- Thrennes : reptile guerrier, écailles, collerette, gravures de victoire ----------

const TH_L = { key: 'rgba(255,190,140,0.5)', rim: 'rgba(255,111,111,0.9)', shadow: 'rgba(8,2,4,0.65)', ao: 'rgba(0,0,0,0.55)' };
const TH_HEAD = [[-0.38, -0.42], [-0.22, -0.58], [0.22, -0.58], [0.38, -0.42], [0.33, -0.14], [0.2, 0.08], [0.12, 0.2], [-0.12, 0.2], [-0.2, 0.08], [-0.33, -0.14]];
const TH_BROW = [[-0.39, -0.37], [-0.3, -0.43], [-0.04, -0.31], [-0.05, -0.25], [-0.14, -0.26], [-0.32, -0.31]];
const TH_PLATE = [[-1.14, 1.42], [-1.12, 0.66], [-1.0, 0.4], [-0.8, 0.27], [-0.56, 0.26], [-0.38, 0.4], [-0.32, 1.42]];

function thTooth(g, x, y, len, w, dir) {
  g.fillStyle = lin(g, x, y, x, y + len * dir, [[0, '#d8c8a8'], [0.5, '#fffaf0'], [1, '#e8dcc0']]);
  g.beginPath();
  g.moveTo(x - w, y);
  g.quadraticCurveTo(x - w * 0.3, y + len * 0.6 * dir, x + w * 0.2, y + len * dir);
  g.quadraticCurveTo(x + w * 0.5, y + len * 0.4 * dir, x + w, y);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(40,20,10,0.5)';
  g.lineWidth = 0.003;
  g.stroke();
}

function bgThrennes(ctx, s) {
  const { t, hw, hh } = s;
  blit(ctx, s, 'th-bg', -hw, -hh, 2 * hw, 2 * hh, (g) => {
    g.fillStyle = lin(g, 0, -hh, 0, hh, [[0, '#14060a'], [0.5, '#2a0c0e'], [0.82, '#4a180c'], [1, '#1a0806']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    g.fillStyle = rad(g, 0, 1.05, 0.05, 1.3, [[0, 'rgba(255,90,30,0.45)'], [1, 'rgba(255,90,30,0)']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    const rnd = seeded(83);
    // Pics rocheux lointains
    g.filter = blurF(s, 0.05);
    g.fillStyle = '#12060a';
    g.beginPath(); g.moveTo(-hw, 0.6);
    for (let x = -hw; x <= hw; x += 0.12) g.lineTo(x, 0.25 + rnd() * 0.25);
    g.lineTo(hw, hh); g.lineTo(-hw, hh); g.closePath(); g.fill();
    // Bannières rituelles, plus proches
    g.filter = blurF(s, 0.025);
    for (const side of [-1, 1]) {
      const x = side * 0.8;
      g.fillStyle = '#1a0a0a';
      g.fillRect(x - 0.01, -hh, 0.02, 2 * hh);
      g.fillStyle = lin(g, x - 0.12, 0, x + 0.12, 0, [[0, '#2a0808'], [0.5, '#6a1416'], [1, '#2a0808']]);
      g.beginPath(); g.moveTo(x - 0.12, -1.0); g.lineTo(x + 0.12, -1.0);
      for (let k = 0; k <= 4; k++) g.lineTo(x + 0.12 - k * 0.06, 0.45 + (k % 2) * 0.08);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,140,120,0.45)';
      g.lineWidth = 0.012;
      g.beginPath(); g.arc(x, -0.3, 0.06, 0, Math.PI * 2);
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.moveTo(x + Math.cos(a) * 0.06, -0.3 + Math.sin(a) * 0.06); g.lineTo(x + Math.cos(a) * 0.1, -0.3 + Math.sin(a) * 0.1); }
      g.stroke();
    }
    g.filter = 'none';
    bokehDiscs(g, rnd, 16, [-hw, 0.1, hw, hh], ['#ff8a30', '#ffb050', '#ff5030'], 0.03, 0.08, 0.15, 0.45);
  });
  // Braseros qui vacillent, cendres qui tombent, braises qui montent
  ctx.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) {
    const f = 0.35 + 0.15 * Math.sin(t * 7 + side) + 0.1 * Math.sin(t * 13 + side * 2);
    sprite(ctx, softTex('#ff7020'), side * 0.62, 0.6, 0.35, f);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  motes(ctx, s, 11, s.small ? 4 : 12, ['#ff9040', '#ffd080'], 0.05, 0.01, -1, 0.8);
}

function drawThrennes(ctx, s) {
  const { t, mouth } = s;
  const b = s.breath * 0.016;

  // Collerette épineuse : membrane rétro-éclairée, s'évase quand il parle
  ctx.save();
  ctx.translate(s.hx * 0.02, -0.22 - b);
  const flare = 1 + 0.08 * s.talk + 0.05 * mouth + 0.02 * Math.sin(t * 1.2);
  ctx.scale(flare, 0.95 + 0.05 * flare);
  blit(ctx, s, 'th-frill', -0.86, -0.8, 1.72, 1.06, (g) => {
    const rnd = seeded(45);
    const tip = (i) => { const a = Math.PI * (1.03 + 0.94 * i / 6); return [Math.cos(a) * 0.78, Math.sin(a) * 0.72]; };
    const val = (i) => { const a = Math.PI * (1.03 + 0.94 * (i + 0.5) / 6); return [Math.cos(a) * 0.5, Math.sin(a) * 0.46]; };
    const fr = new Path2D();
    fr.moveTo(-0.3, 0.24);
    fr.lineTo(...tip(0));
    for (let i = 0; i < 6; i++) fr.quadraticCurveTo(...val(i), ...tip(i + 1));
    fr.lineTo(0.3, 0.24);
    fr.closePath();
    g.fillStyle = rad(g, 0, 0, 0.1, 0.8, [[0, '#1a0606'], [0.45, '#5a1014'], [0.8, '#b8262c'], [1, '#ff8a7a']]);
    g.fill(fr);
    // Veines
    g.save(); g.clip(fr);
    g.lineWidth = 0.006;
    for (let i = 0; i < 6; i++) {
      for (let k = 0; k < 3; k++) {
        const [vx, vy] = val(i);
        const a0 = Math.atan2(vy, vx) + (k - 1) * 0.12;
        g.strokeStyle = 'rgba(60,0,6,0.45)';
        g.beginPath(); g.moveTo(0, 0);
        g.quadraticCurveTo(Math.cos(a0) * 0.3 + (rnd() - 0.5) * 0.06, Math.sin(a0) * 0.3, Math.cos(a0) * 0.62, Math.sin(a0) * 0.58);
        g.stroke();
      }
    }
    g.restore();
    speckle(g, fr, rnd, 200, [-0.8, -0.75, 0.8, 0.25], '#ff9a8a', '#200004', 0.01);
    innerShade(g, s, fr, 'rgba(255,130,110,0.4)', 0.03);
    // Épines osseuses
    for (let i = 0; i <= 6; i++) {
      const [x, y] = tip(i);
      const spine = shape(ribbon([[x * 0.1, y * 0.1], [x * 0.55, y * 0.55], [x, y]], 0.028, 0.003), 0.004);
      g.fillStyle = lin(g, 0, 0, x, y, [[0, '#2a2224'], [0.7, '#6a5a54'], [1, '#d8c8b0']]);
      g.fill(spine);
      light3(g, s, spine, TH_L, 0.15);
    }
  });
  ctx.restore();

  // Buste : cou écailleux, épaules blindées gravées, seconde paire de bras croisés
  ctx.save();
  ctx.translate(0, b * 0.4);
  blit(ctx, s, 'th-body', -1.28, -0.02, 2.56, 1.46, (g) => {
    const rnd = seeded(57);
    const neck = shape([[-0.24, 0.02], [0.24, 0.02], [0.46, 0.5], [0.44, 1.44], [-0.44, 1.44], [-0.46, 0.5]], 0.06);
    const nbox = [-0.46, 0.0, 0.46, 1.44];
    g.fillStyle = '#2e2828';
    g.fill(neck);
    scaleField(g, s, neck, nbox, 0.04, '#3a3232', '#7a6a62', '#120e0e', rnd);
    speckle(g, neck, rnd, 50, nbox, '#6a5a50', '#000000', 0.06);
    // Plaques ventrales de la gorge
    g.save(); g.clip(neck);
    for (let y = 0.62; y > 0.06; y -= 0.065) {
      const w = 0.15 + (y - 0.06) * 0.08;
      const pl = shape([[-w, y], [w, y], [w * 0.95, y + 0.07], [-w * 0.95, y + 0.07]], 0.025);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fill(pl);
      g.save(); g.translate(0, -0.008);
      g.fillStyle = lin(g, 0, y, 0, y + 0.07, [[0, '#9a8670'], [0.5, '#6a5a4a'], [1, '#2a221c']]);
      g.fill(pl);
      g.restore();
    }
    g.restore();
    modelVol(g, neck, nbox, 0.35, 0.1, '#2a1414');
    light3(g, s, neck, TH_L, 0.8);
    g.save(); g.clip(neck); g.filter = blurF(s, 0.06);
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.beginPath(); g.ellipse(0, 0.2, 0.36, 0.14, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    // Épaulières naturelles, gravées des victoires
    const neckAll = neck;
    for (const side of [-1, 1]) {
      const pts = side < 0 ? TH_PLATE : mirror(TH_PLATE);
      const pl = shape(pts, 0.1);
      const box = side < 0 ? [-1.1, 0.18, -0.3, 1.44] : [0.3, 0.18, 1.1, 1.44];
      castShadow(g, s, neckAll, pl, side * -0.04, 0.03, 0.04, 'rgba(0,0,0,0.7)');
      g.fillStyle = rad(g, side * 0.8, 0.3, 0.02, 1.0, [[0, '#6a5a58'], [0.4, '#3a3036'], [1, '#100c0e']]);
      g.fill(pl);
      speckle(g, pl, rnd, 260, box, '#a8968c', '#060404', 0.01);
      speckle(g, pl, rnd, 30, box, '#7a6a64', '#0a0606', 0.05);
      g.save(); g.clip(pl);
      // Rangées de traits de victoire, taillés et teintés de rouge
      for (let row = 0; row < 5; row++) {
        const y0 = 0.45 + row * 0.14;
        for (let grp = 0; grp < 2; grp++) {
          const cx = side * (0.86 - grp * 0.24 - row * 0.02);
          for (let k = 0; k < 5; k++) {
            const x = cx + side * (k < 4 ? (k - 1.5) * 0.028 : 0);
            const p = k < 4 ? [[x, y0], [x + side * 0.006, y0 + 0.08]] : [[cx - 0.06, y0 + 0.07], [cx + 0.06, y0 + 0.01]];
            g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 0.011; strokePts(g, p);
            g.strokeStyle = 'rgba(255,111,111,0.45)'; g.lineWidth = 0.005; strokePts(g, p);
            g.strokeStyle = 'rgba(255,220,200,0.18)'; g.lineWidth = 0.004; strokePts(g, p.map(([a, c]) => [a + 0.006, c + 0.006]));
          }
        }
      }
      g.restore();
      modelVol(g, pl, box, side < 0 ? 0.3 : 0.1, 0.05, '#1a0c0c');
      light3(g, s, pl, TH_L);
      gloss(g, s, side * 0.78, 0.36, 0.16, 0.035, side * -0.3, 0.18, 0.03);
      // Ostéodermes en bordure
      for (let k = 0; k < 6; k++) {
        const u = k / 5;
        const x = side * (0.98 - u * 0.5), y = 0.38 - Math.sin(u * Math.PI) * 0.12 + u * 0.05;
        rivet(g, x, y, 0.028, '#b8a090', '#4a3c3a', '#0a0606');
      }
    }
    // Seconds bras croisés sur la poitrine
    const torso = union(neck, shape(TH_PLATE, 0.06), shape(mirror(TH_PLATE), 0.06));
    for (const side of [-1, 1]) {
      const c = quadPts([side * 0.52, 0.6], [side * 0.2, 0.84], [-side * 0.27, 0.74 + side * 0.02], 14);
      const arm = shape(ribbon(c, 0.075, 0.05), 0.02);
      castShadow(g, s, torso, arm, 0.02, 0.05, 0.035, 'rgba(0,0,0,0.75)');
      g.fillStyle = '#2e2626';
      g.fill(arm);
      scaleField(g, s, arm, [-0.6, 0.5, 0.6, 0.95], 0.026, '#3e3434', '#806e64', '#100c0c', rnd);
      light3(g, s, arm, TH_L, 0.55);
      // Brassard rituel
      const [bx, by] = c[9];
      g.save();
      g.translate(bx, by);
      g.rotate(Math.atan2(c[10][1] - c[8][1], c[10][0] - c[8][0]));
      g.fillStyle = lin(g, 0, -0.08, 0, 0.08, [[0, '#ffb0a0'], [0.4, '#c0303a'], [1, '#3a080c']]);
      g.fillRect(-0.02, -0.075, 0.04, 0.15);
      g.restore();
      // Griffes
      const [hx, hy] = c[c.length - 1];
      for (let k = 0; k < 3; k++) {
        const cx = hx - side * k * 0.03, cy = hy - 0.03 + k * 0.035;
        const claw = new Path2D();
        claw.moveTo(cx, cy - 0.012);
        claw.quadraticCurveTo(cx - side * 0.05, cy - 0.01, cx - side * 0.075, cy + 0.03);
        claw.quadraticCurveTo(cx - side * 0.035, cy + 0.008, cx, cy + 0.014);
        claw.closePath();
        g.fillStyle = lin(g, cx, cy, cx - side * 0.07, cy + 0.03, [[0, '#6a5a48'], [0.5, '#e8dcc4'], [1, '#fffaf0']]);
        g.fill(claw);
        gloss(g, s, cx - side * 0.035, cy - 0.002, 0.012, 0.004, side * 0.3, 0.6, 0.002);
      }
    }
  });
  ctx.restore();

  // Tête
  ctx.save();
  ctx.translate(s.hx * 0.03, -b - s.nod * 0.03);
  ctx.rotate(s.tilt);
  // Gueule : intérieur, langue fourchue
  ctx.fillStyle = rad(ctx, 0, 0.16, 0.02, 0.2, [[0, '#7a1418'], [1, '#1a0204']]);
  poly(ctx, [[-0.17, 0.1], [0.17, 0.1], [0.12, 0.24 + mouth * 0.1], [-0.12, 0.24 + mouth * 0.1]]);
  ctx.fill();
  const flick = Math.max(0, Math.sin(t * 1.3) - 0.85) * 6 + mouth * 0.6;
  if (flick > 0.02) {
    ctx.fillStyle = lin(ctx, 0, 0.12, 0, 0.3, [[0, '#c04050'], [1, '#6a1020']]);
    ctx.beginPath();
    ctx.moveTo(-0.025, 0.14);
    ctx.lineTo(-0.02, 0.18 + flick * 0.08); ctx.lineTo(-0.035, 0.22 + flick * 0.1);
    ctx.lineTo(0, 0.19 + flick * 0.08);
    ctx.lineTo(0.035, 0.22 + flick * 0.1); ctx.lineTo(0.02, 0.18 + flick * 0.08);
    ctx.lineTo(0.025, 0.14);
    ctx.closePath();
    ctx.fill();
  }
  // Mâchoire inférieure qui s'abaisse
  ctx.save();
  ctx.translate(0, mouth * 0.1);
  blit(ctx, s, 'th-jaw', -0.24, 0.04, 0.48, 0.34, (g) => {
    const rnd = seeded(66);
    const jaw = shape([[-0.21, 0.07], [0.21, 0.07], [0.14, 0.34], [-0.14, 0.34]], 0.04);
    for (let x = -0.15; x <= 0.151; x += 0.05) thTooth(g, x, 0.09, 0.045, 0.013, -1);
    g.fillStyle = '#2a2224';
    g.fill(jaw);
    scaleField(g, s, jaw, [-0.22, 0.06, 0.22, 0.36], 0.035, '#3a3234', '#7a6a62', '#100c0e', rnd);
    modelVol(g, jaw, [-0.21, 0.07, 0.21, 0.34], 0.35, 0.1, '#1a0c0c');
    light3(g, s, jaw, TH_L, 0.5);
  });
  ctx.restore();
  blit(ctx, s, 'th-head', -0.62, -0.92, 1.24, 1.2, (g) => {
    const rnd = seeded(91);
    // Cornes annelées, derrière le crâne
    for (const side of [-1, 1]) {
      const horn = new Path2D();
      horn.moveTo(side * 0.2, -0.5);
      horn.quadraticCurveTo(side * 0.4, -0.76, side * 0.58, -0.86);
      horn.quadraticCurveTo(side * 0.46, -0.64, side * 0.38, -0.4);
      horn.closePath();
      g.fillStyle = lin(g, side * 0.3, -0.5, side * 0.58, -0.86, [[0, '#4a3e30'], [0.4, '#a89878'], [1, '#f2e8d0']]);
      g.fill(horn);
      g.save(); g.clip(horn);
      for (let k = 0; k < 8; k++) {
        const u = k / 8;
        const x = side * (0.29 + u * 0.24), y = -0.47 - u * 0.33;
        g.strokeStyle = 'rgba(40,30,20,0.55)'; g.lineWidth = 0.008;
        g.beginPath(); g.ellipse(x, y, 0.06, 0.02, side * -0.9, 0, Math.PI); g.stroke();
      }
      g.restore();
      light3(g, s, horn, TH_L, 0.8);
      gloss(g, s, side * 0.36, -0.62, 0.02, 0.08, side * -0.7, 0.35, 0.01);
    }
    const head = shape(TH_HEAD, 0.05);
    const box = [-0.38, -0.58, 0.38, 0.2];
    g.fillStyle = '#2e2828';
    g.fill(head);
    scaleField(g, s, head, box, 0.03, '#3a3236', '#7a6c66', '#141012', rnd);
    speckle(g, head, rnd, 40, box, '#6a5a50', '#000000', 0.05);
    modelVol(g, head, box, 0.3, 0.15, '#2a1a1a');
    light3(g, s, head, TH_L);
    // Orbites profondes
    for (const side of [-1, 1]) {
      g.fillStyle = rad(g, side * 0.18, -0.245, 0.04, 0.15, [[0, 'rgba(0,0,0,0.9)'], [1, 'rgba(0,0,0,0)']]);
      g.beginPath(); g.ellipse(side * 0.18, -0.245, 0.15, 0.1, 0, 0, Math.PI * 2); g.fill();
    }
    // Arcades sourcilières en surplomb, ombre portée dessous
    for (const side of [-1, 1]) {
      const brow = shape(side < 0 ? TH_BROW : mirror(TH_BROW), 0.02);
      castShadow(g, s, head, brow, 0.01, 0.04, 0.025, 'rgba(0,0,0,0.75)');
      g.fillStyle = '#3a3236';
      g.fill(brow);
      scaleField(g, s, brow, side < 0 ? [-0.4, -0.44, -0.03, -0.24] : [0.03, -0.44, 0.4, -0.24], 0.05, '#4a4044', '#8a7a72', '#141012', rnd);
      light3(g, s, brow, TH_L, 0.4);
    }
    // Crête médiane : écailles dorsales rouges
    for (let k = 0; k < 6; k++) {
      const y = -0.62 + k * 0.075, w = 0.045 - k * 0.004;
      const sc = shape([[0, y - 0.07], [w, y], [0, y + 0.035], [-w, y]], 0.01);
      g.fillStyle = lin(g, -w, y - 0.07, w, y + 0.03, [[0, '#ffb0a0'], [0.4, '#d03a40'], [1, '#3a0a10']]);
      g.fill(sc);
      light3(g, s, sc, TH_L, 0.2);
    }
    // Scarifications rituelles sur les tempes
    g.lineWidth = 0.006;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const p = [[side * (0.25 + k * 0.03), -0.5 + k * 0.02], [side * (0.31 + k * 0.025), -0.36 + k * 0.03]];
        g.strokeStyle = 'rgba(0,0,0,0.8)'; strokePts(g, p);
        g.strokeStyle = 'rgba(255,111,111,0.5)'; g.lineWidth = 0.003; strokePts(g, p); g.lineWidth = 0.006;
      }
    }
    // Narines
    for (const side of [-1, 1]) {
      g.fillStyle = rad(g, side * 0.05, 0.12, 0, 0.03, [[0, 'rgba(0,0,0,0.95)'], [1, 'rgba(0,0,0,0)']]);
      g.beginPath(); g.ellipse(side * 0.05, 0.12, 0.03, 0.016, -side * 0.4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,200,170,0.25)'; g.lineWidth = 0.004;
      g.beginPath(); g.ellipse(side * 0.05, 0.115, 0.022, 0.01, -side * 0.4, Math.PI, Math.PI * 2); g.stroke();
    }
    // Dents supérieures, débordant de la lèvre
    for (const x of [-0.105, -0.06, -0.02, 0.02, 0.06, 0.105]) thTooth(g, x, 0.185, Math.abs(x) > 0.08 ? 0.06 : 0.035, 0.012, 1);
  });
  // Yeux obliques à pupille fendue, membrane qui cligne
  for (const side of [-1, 1]) {
    wetEye(ctx, s, side * 0.18, -0.245, {
      id: 'th-iris', rx: 0.088, ry: 0.044, rot: -side * 0.3, top: 0.75, irisR: 0.085, look: 0.25, lookY: 0.1,
      sclera: [[0, '#ffd070'], [1, '#a04a10']], lid: '#3a3032', rim: '#ff8a8a', lashW: 0.01,
      paintIris: irisPainter(0.085, ['#fff2b0', '#ffb43a', '#c0581a', '#3a0c04'], 'slit', 13),
    });
  }
  ctx.restore();
}

// ---------- Liseurs de Vey : visage long sous la capuche, couronne de glyphes ----------

const LI_L = { key: 'rgba(255,222,150,0.5)', rim: 'rgba(140,200,255,0.85)', shadow: 'rgba(10,8,20,0.6)', ao: 'rgba(5,4,10,0.5)' };

// Glyphe procédural : trois traits dans une petite case.
function glyph(ctx, x, y, size, seed) {
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const h1 = hash(seed * 3.1 + k), h2 = hash(seed * 5.7 + k + 1);
    const mode = Math.floor(hash(seed + k * 9.3) * 3);
    if (mode === 0) { ctx.moveTo(x + (h1 - 0.5) * size, y - size / 2); ctx.lineTo(x + (h2 - 0.5) * size, y + size / 2); }
    else if (mode === 1) { ctx.moveTo(x - size / 2, y + (h1 - 0.5) * size); ctx.lineTo(x + size / 2, y + (h2 - 0.5) * size); }
    else { ctx.moveTo(x + size * 0.25 * h1, y); ctx.arc(x, y, size * (0.2 + 0.25 * h1), 0, Math.PI * (0.8 + h2)); }
  }
  ctx.stroke();
}

function liFace() {
  const p = new Path2D();
  p.moveTo(0, -0.72);
  p.bezierCurveTo(0.2, -0.6, 0.23, -0.22, 0.17, 0.0);
  p.quadraticCurveTo(0.09, 0.2, 0, 0.24);
  p.quadraticCurveTo(-0.09, 0.2, -0.17, 0.0);
  p.bezierCurveTo(-0.23, -0.22, -0.2, -0.6, 0, -0.72);
  p.closePath();
  return p;
}

function bgLiseurs(ctx, s) {
  const { t, hw, hh } = s;
  blit(ctx, s, 'li-bg', -hw, -hh, 2 * hw, 2 * hh, (g) => {
    g.fillStyle = lin(g, 0, -hh, 0, hh, [[0, '#0c1628'], [0.6, '#08101e'], [1, '#141c28']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    const rnd = seeded(29);
    // Arche brisée et piliers gravés, flous
    for (const [blur, x, w, col] of [[0.05, 0.45, 0.12, '#1e2838'], [0.03, 0.75, 0.24, '#2c3848']]) {
      g.filter = blurF(s, blur);
      for (const side of [-1, 1]) {
        const cx = side * x;
        g.fillStyle = lin(g, cx - w / 2, 0, cx + w / 2, 0, [[0, col], [0.4, '#4a5a70'], [1, '#0c121c']]);
        g.fillRect(cx - w / 2, -hh, w, 2 * hh);
        g.strokeStyle = 'rgba(255,209,102,0.35)';
        g.lineWidth = 0.008;
        for (let k = 0; k < 8; k++) glyph(g, cx, -0.8 + k * 0.2, w * 0.4, k + (side > 0 ? 40 : 60));
      }
    }
    g.filter = blurF(s, 0.05);
    g.strokeStyle = '#1e2838';
    g.lineWidth = 0.1;
    g.beginPath(); g.arc(0, -0.2, 0.55, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
    g.filter = 'none';
    // Halo doré derrière la tête
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = rad(g, 0, -0.4, 0, 0.9, [[0, 'rgba(255,200,110,0.22)'], [1, 'rgba(255,200,110,0)']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    g.globalCompositeOperation = 'source-over';
    bokehDiscs(g, rnd, 22, [-hw, -hh, hw, hh], ['#a8d8ff', '#ffffff', '#ffd166'], 0.015, 0.06, 0.1, 0.35);
    g.fillStyle = lin(g, 0, 0.6, 0, hh, [[0, 'rgba(160,200,255,0)'], [1, 'rgba(160,200,255,0.18)']]);
    g.fillRect(-hw, 0.6, 2 * hw, hh);
  });
  motes(ctx, s, 13, s.small ? 4 : 10, ['#ffe7a0'], 0.015, 0.012, -1);
  motes(ctx, s, 17, s.small ? 3 : 10, ['#dceeff'], 0.04, 0.01, 1, 0.7);
  ctx.globalAlpha = 1;
}

function drawLiseurs(ctx, s) {
  const { t, mouth, accent } = s;
  const b = s.breath * 0.014;
  const crownY = -0.84;
  const drawCrown = (front) => {
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const a = t * 0.35 + (i / 10) * Math.PI * 2;
      const depth = Math.sin(a);
      if ((depth > 0) !== front) continue;
      const x = Math.cos(a) * 0.5 + s.hx * 0.02, y = crownY + depth * 0.1 - b;
      const speak = mouth * (0.4 + 0.6 * hash(i + s.syl * 13));
      const lum = clamp01((0.4 + 0.25 * Math.sin(t * 1.3 + i)) * (front ? 1 : 0.45) + speak);
      ctx.globalCompositeOperation = 'lighter';
      sprite(ctx, softTex(accent), x, y, front ? 0.12 : 0.08, lum * 0.45);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = rgba(front ? '#ffe7a0' : accent, lum);
      ctx.lineWidth = front ? 0.013 : 0.009;
      glyph(ctx, x, y, front ? 0.09 : 0.065, i + 1);
      ctx.globalCompositeOperation = 'source-over';
    }
  };
  drawCrown(false);

  // Robe à plis lourds, étole brodée
  ctx.save();
  ctx.translate(0, b * 0.4);
  blit(ctx, s, 'li-robe', -0.95, 0.05, 1.9, 1.42, (g) => {
    const rnd = seeded(14);
    const robe = new Path2D();
    robe.moveTo(-0.2, 0.18);
    robe.quadraticCurveTo(-0.52, 0.4, -0.78, 1.46);
    robe.lineTo(0.78, 1.46);
    robe.quadraticCurveTo(0.52, 0.4, 0.2, 0.18);
    robe.closePath();
    const box = [-0.78, 0.18, 0.78, 1.46];
    g.fillStyle = lin(g, -0.6, 0.2, 0.6, 1.2, [[0, '#e6dac0'], [0.5, '#b4a284'], [1, '#5a4c3a']]);
    g.fill(robe);
    weave(g, robe, box, 0.012, 'rgba(60,45,30,0.08)');
    folds(g, s, robe, [
      quadPts([-0.3, 0.3], [-0.4, 0.8], [-0.5, 1.46], 10), quadPts([0.32, 0.3], [0.4, 0.8], [0.52, 1.46], 10),
      quadPts([-0.18, 0.5], [-0.22, 0.9], [-0.27, 1.46], 8), quadPts([0.2, 0.5], [0.24, 0.9], [0.29, 1.46], 8),
      quadPts([-0.5, 0.62], [-0.6, 1.0], [-0.66, 1.46], 8), quadPts([0.52, 0.62], [0.6, 1.0], [0.67, 1.46], 8),
    ], 0.035, 'rgba(40,28,16,0.5)', 'rgba(255,245,220,0.32)');
    speckle(g, robe, rnd, 200, box, '#fff8e8', '#2a2010', 0.008);
    modelVol(g, robe, box, 0.3, 0.05, '#4a3a28');
    light3(g, s, robe, LI_L);
    const stole = shape([[-0.085, 0.28], [0.085, 0.28], [0.11, 1.46], [-0.11, 1.46]], 0.01);
    castShadow(g, s, robe, stole, 0.02, 0.02, 0.025, 'rgba(20,12,4,0.6)');
    g.fillStyle = lin(g, -0.1, 0, 0.1, 0, [[0, '#7a5232'], [0.35, '#4a2e18'], [1, '#22140a']]);
    g.fill(stole);
    speckle(g, stole, rnd, 120, [-0.11, 0.28, 0.11, 1.46], '#a8784a', '#100804', 0.006);
    g.strokeStyle = 'rgba(200,160,80,0.55)';
    g.lineWidth = 0.009;
    for (let k = 0; k < 5; k++) glyph(g, 0, 0.42 + k * 0.17, 0.075, k + 20);
    for (const side of [-1, 1]) {
      g.strokeStyle = brass(g, side * 0.1, 0.3, side * 0.1, 1.4);
      g.lineWidth = 0.012;
      g.beginPath(); g.moveTo(side * 0.08, 0.28); g.lineTo(side * 0.105, 1.46); g.stroke();
      g.fillStyle = 'rgba(255,230,160,0.7)';
      for (let y = 0.33; y < 1.4; y += 0.05) { g.beginPath(); g.arc(side * (0.08 + (y - 0.28) * 0.022), y, 0.004, 0, Math.PI * 2); g.fill(); }
    }
    light3(g, s, stole, LI_L, 0.5);
    g.save(); g.clip(robe); g.filter = blurF(s, 0.06);
    g.fillStyle = 'rgba(10,6,2,0.6)';
    g.beginPath(); g.ellipse(0, 0.3, 0.32, 0.1, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  });
  // Glyphes de l'étole qui s'allument avec la voix
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 0.011;
  for (let k = 0; k < 5; k++) {
    const lum = clamp01(0.2 + 0.25 * Math.sin(t * 1.5 - k) + mouth * hash(k + 50 + s.syl * 3));
    sprite(ctx, softTex(accent), 0, 0.42 + k * 0.17, 0.08, lum * 0.5);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = rgba('#ffe7a0', lum);
    glyph(ctx, 0, 0.42 + k * 0.17, 0.075, k + 20);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // Capuche et visage
  ctx.save();
  ctx.translate(s.hx * 0.02, -b - s.nod * 0.015);
  ctx.rotate(s.tilt * 0.7);
  const face = liFace();
  blit(ctx, s, 'li-hood', -0.46, -1.04, 0.92, 1.56, (g) => {
    const rnd = seeded(33);
    const hood = new Path2D();
    hood.moveTo(0, -0.98);
    hood.bezierCurveTo(0.22, -0.8, 0.38, -0.45, 0.36, -0.05);
    hood.quadraticCurveTo(0.36, 0.26, 0.3, 0.4);
    hood.quadraticCurveTo(0, 0.5, -0.3, 0.4);
    hood.quadraticCurveTo(-0.36, 0.26, -0.36, -0.05);
    hood.bezierCurveTo(-0.38, -0.45, -0.22, -0.8, 0, -0.98);
    hood.closePath();
    const box = [-0.38, -0.98, 0.38, 0.48];
    g.fillStyle = lin(g, -0.4, -0.9, 0.4, 0.4, [[0, '#ece0c6'], [0.55, '#b2a080'], [1, '#5e5040']]);
    g.fill(hood);
    weave(g, hood, box, 0.011, 'rgba(60,45,30,0.08)');
    folds(g, s, hood, [
      quadPts([0, -0.92], [0.24, -0.6], [0.31, -0.05], 10), quadPts([0, -0.92], [-0.24, -0.6], [-0.31, -0.05], 10),
      quadPts([0.3, 0.0], [0.28, 0.2], [0.2, 0.36], 6), quadPts([-0.3, 0.0], [-0.28, 0.2], [-0.2, 0.36], 6),
    ], 0.03, 'rgba(40,28,16,0.5)', 'rgba(255,245,220,0.35)');
    speckle(g, hood, rnd, 160, box, '#fff8e8', '#2a2010', 0.007);
    modelVol(g, hood, box, 0.3, 0.15, '#4a3a28');
    light3(g, s, hood, LI_L);
    // Ouverture : ombre profonde, bord roulé et passepoil doré
    const open = new Path2D();
    open.addPath(face, new DOMMatrix().translate(0, -0.24).scale(1.2, 1.12).translate(0, 0.24));
    g.save(); g.clip(open);
    g.fillStyle = rad(g, 0, -0.2, 0.05, 0.45, [[0, '#1a120c'], [1, '#040302']]);
    g.fillRect(-0.4, -1, 0.8, 1.4);
    g.restore();
    g.save(); g.filter = blurF(s, 0.01);
    g.strokeStyle = 'rgba(30,20,10,0.6)'; g.lineWidth = 0.06; g.stroke(open);
    g.restore();
    g.strokeStyle = lin(g, -0.3, -0.7, 0.3, 0.3, [[0, '#f0e4cc'], [0.6, '#a8967a'], [1, '#4a3e30']]);
    g.lineWidth = 0.04; g.stroke(open);
    g.strokeStyle = brass(g, -0.25, -0.8, 0.25, 0.3);
    g.lineWidth = 0.012;
    const pip = new Path2D();
    pip.addPath(face, new DOMMatrix().translate(0, -0.24).scale(1.33, 1.2).translate(0, 0.24));
    g.stroke(pip);
  });
  blit(ctx, s, 'li-face', -0.25, -0.75, 0.5, 1.02, (g) => {
    const rnd = seeded(71);
    const box = [-0.23, -0.72, 0.23, 0.24];
    g.fillStyle = rad(g, -0.06, -0.4, 0.02, 0.62, [[0, '#d8d0dc'], [0.4, '#a49cb2'], [1, '#4a4258']]);
    g.fill(face);
    speckle(g, face, rnd, 500, box, '#f4eef8', '#2a2236', 0.004);
    g.save(); g.clip(face);
    g.filter = blurF(s, 0.012);
    // Pommettes hautes : lumière dessus, creux dessous
    for (const side of [-1, 1]) {
      g.strokeStyle = 'rgba(255,240,230,0.35)'; g.lineWidth = 0.018;
      g.beginPath(); g.moveTo(side * 0.16, -0.16); g.quadraticCurveTo(side * 0.12, -0.1, side * 0.06, -0.08); g.stroke();
      g.strokeStyle = 'rgba(30,20,40,0.45)'; g.lineWidth = 0.025;
      g.beginPath(); g.moveTo(side * 0.16, -0.08); g.quadraticCurveTo(side * 0.12, -0.02, side * 0.07, 0.0); g.stroke();
      // Orbites
      g.fillStyle = 'rgba(25,18,35,0.6)';
      g.beginPath(); g.ellipse(side * 0.085, -0.28, 0.085, 0.05, -side * 0.25, 0, Math.PI * 2); g.fill();
      // Arcade
      g.strokeStyle = 'rgba(255,240,230,0.3)'; g.lineWidth = 0.014;
      g.beginPath(); g.moveTo(side * 0.03, -0.34); g.quadraticCurveTo(side * 0.09, -0.36, side * 0.15, -0.31); g.stroke();
    }
    // Nez long : arête claire, flanc d'ombre, narines
    g.strokeStyle = 'rgba(255,245,240,0.4)'; g.lineWidth = 0.012;
    g.beginPath(); g.moveTo(-0.008, -0.3); g.lineTo(-0.008, -0.06); g.stroke();
    g.strokeStyle = 'rgba(25,18,35,0.5)'; g.lineWidth = 0.018;
    g.beginPath(); g.moveTo(0.022, -0.28); g.lineTo(0.026, -0.06); g.stroke();
    g.fillStyle = 'rgba(20,12,25,0.7)';
    for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 0.018, -0.035, 0.012, 0.006, 0, 0, Math.PI * 2); g.fill(); }
    // Menton
    g.fillStyle = 'rgba(255,240,230,0.2)';
    g.beginPath(); g.ellipse(-0.01, 0.17, 0.04, 0.025, 0, 0, Math.PI * 2); g.fill();
    g.filter = 'none';
    g.restore();
    modelVol(g, face, box, 0.35, 0.2, '#2a2238');
    light3(g, s, face, LI_L, 0.55);
    // Lèvre supérieure fine
    const lip = new Path2D();
    lip.moveTo(-0.042, 0.062);
    lip.quadraticCurveTo(-0.02, 0.044, 0, 0.05);
    lip.quadraticCurveTo(0.02, 0.044, 0.042, 0.062);
    lip.quadraticCurveTo(0, 0.068, -0.042, 0.062);
    lip.closePath();
    g.fillStyle = lin(g, 0, 0.045, 0, 0.066, [[0, '#8a7088'], [1, '#4a3448']]);
    g.fill(lip);
    // Ombre de la capuche sur le visage
    g.save(); g.clip(face);
    g.fillStyle = lin(g, 0, -0.72, 0, -0.36, [[0, 'rgba(8,5,10,0.85)'], [1, 'rgba(8,5,10,0)']]);
    g.fillRect(-0.3, -0.75, 0.6, 0.45);
    g.restore();
    innerShade(g, s, face, 'rgba(8,5,10,0.65)', 0.05);
    // Glyphe frontal tatoué
    g.strokeStyle = 'rgba(160,120,50,0.6)';
    g.lineWidth = 0.008;
    g.beginPath(); g.arc(0, -0.5, 0.026, 0, Math.PI * 2); g.moveTo(0, -0.57); g.lineTo(0, -0.43); g.moveTo(-0.045, -0.44); g.lineTo(-0.02, -0.455); g.moveTo(0.045, -0.44); g.lineTo(0.02, -0.455); g.stroke();
  });
  // Glyphe frontal qui luit
  ctx.globalCompositeOperation = 'lighter';
  const fg = 0.35 + 0.25 * Math.sin(t * 0.9) + 0.4 * mouth;
  sprite(ctx, softTex(accent), 0, -0.49, 0.1, fg * 0.5);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = rgba('#ffe7a0', clamp01(fg));
  ctx.lineWidth = 0.008;
  ctx.beginPath(); ctx.arc(0, -0.5, 0.026, 0, Math.PI * 2); ctx.moveTo(0, -0.57); ctx.lineTo(0, -0.43); ctx.moveTo(-0.045, -0.44); ctx.lineTo(-0.02, -0.455); ctx.moveTo(0.045, -0.44); ctx.lineTo(0.02, -0.455); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  // Yeux dorés en amande
  for (const side of [-1, 1]) {
    wetEye(ctx, s, side * 0.085, -0.28, {
      id: 'li-iris', rx: 0.058, ry: 0.026, rot: -side * 0.22, top: 0.8, irisR: 0.03, look: 0.38, lookY: 0.2,
      sclera: [[0, '#e8e4ec'], [1, '#6a6078']], lid: '#8a8298', rim: '#8cc8ff', lashW: 0.007,
      paintIris: irisPainter(0.03, ['#fff6d0', '#ffd166', '#b07818', '#2a1804'], 'round', 19),
    });
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) sprite(ctx, softTex(accent), side * 0.085, -0.28, 0.06, 0.18 * (1 - s.blink));
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Bouche : fente qui s'ouvre, lèvre inférieure qui descend
  ctx.fillStyle = '#140808';
  ctx.beginPath(); ctx.ellipse(0, 0.064 + mouth * 0.008, 0.036, 0.002 + mouth * 0.017, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(0, 0.066 + mouth * 0.02);
  ctx.fillStyle = lin(ctx, 0, 0, 0, 0.022, [[0, '#a08aa0'], [1, '#4a3a4c']]);
  ctx.beginPath();
  ctx.moveTo(-0.038, 0); ctx.quadraticCurveTo(0, 0.03, 0.038, 0); ctx.quadraticCurveTo(0, 0.008, -0.038, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.ellipse(-0.008, 0.012, 0.012, 0.003, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();

  drawCrown(true);
}

// ---------- Ashkari : nomade emmailloté, lunettes de laiton, masque respiratoire ----------

const AS_L = { key: 'rgba(255,205,150,0.55)', rim: 'rgba(120,210,255,0.85)', shadow: 'rgba(20,8,4,0.6)', ao: 'rgba(15,6,2,0.5)' };
const AS_BANDS = ['#c08a60', '#9a6a48', '#b07850', '#8a5a3c', '#a87048'];

function asMask() {
  const p = new Path2D();
  p.moveTo(-0.2, -0.12);
  p.quadraticCurveTo(0, -0.17, 0.2, -0.12);
  p.lineTo(0.16, 0.1);
  p.quadraticCurveTo(0, 0.2, -0.16, 0.1);
  p.closePath();
  return p;
}

function bgAshkari(ctx, s) {
  const { t, hw, hh } = s;
  blit(ctx, s, 'as-bg', -hw, -hh, 2 * hw, 2 * hh, (g) => {
    g.fillStyle = lin(g, 0, -hh, 0, hh, [[0, '#04060c'], [1, '#0c0c16']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    const rnd = seeded(95);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(220,230,255,${0.2 + rnd() * 0.5})`;
      g.beginPath(); g.arc((rnd() - 0.5) * 2 * hw, (rnd() - 0.5) * 2 * hh, 0.002 + rnd() * 0.004, 0, Math.PI * 2); g.fill();
    }
    // Géante gazeuse, floue (profondeur de champ)
    const [cx, cy, r] = [0.95, -0.25, 0.78];
    const planet = new Path2D();
    planet.arc(cx, cy, r, 0, Math.PI * 2);
    g.save();
    g.clip(planet);
    g.filter = blurF(s, 0.025);
    const cols = ['#e0a070', '#c07848', '#f0c890', '#a05a38', '#d89868', '#8a4a30', '#f4d4a8'];
    for (let i = 0; i < 30; i++) {
      const y = cy - r + i * (2 * r / 30);
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      g.beginPath();
      g.moveTo(cx - r, y);
      g.bezierCurveTo(cx - 0.3, y - 0.04 + rnd() * 0.08, cx + 0.3, y - 0.04 + rnd() * 0.08, cx + r, y);
      g.lineTo(cx + r, y + 2 * r / 30 + 0.03); g.lineTo(cx - r, y + 2 * r / 30 + 0.03);
      g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(255,230,190,0.5)';
    g.beginPath(); g.ellipse(cx - r * 0.45, cy + r * 0.25, 0.1, 0.045, 0.1, 0, Math.PI * 2); g.fill();
    g.filter = 'none';
    g.fillStyle = rad(g, cx - 0.5, cy - 0.8, 0, r * 1.7, [[0, 'rgba(0,0,0,0)'], [0.5, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0.9)']]);
    g.fill(planet);
    g.restore();
    g.save();
    g.filter = blurF(s, 0.03);
    g.strokeStyle = 'rgba(255,190,130,0.55)';
    g.lineWidth = 0.04;
    g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.55, Math.PI * 1.6); g.stroke();
    g.strokeStyle = 'rgba(240,215,175,0.35)';
    g.lineWidth = 0.02;
    g.beginPath(); g.ellipse(cx, cy, r * 1.6, r * 0.24, -0.3, Math.PI * 0.02, Math.PI * 0.98); g.stroke();
    g.restore();
    bokehDiscs(g, rnd, 10, [-hw, -hh, hw, 0], ['#ffd0a0', '#a0d0ff'], 0.02, 0.06, 0.1, 0.3);
  });
  // Brume de la géante, caravane lointaine qui passe
  sprite(ctx, softTex('#e0a070'), 0.75 + Math.sin(t * 0.05) * 0.15, -0.2, 0.9, 0.1);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  const p = (t * 0.025) % 1;
  for (let k = 0; k < 3; k++) {
    sprite(ctx, glowTex('#ffd8a0'), -1.3 + p * 2.6 - k * 0.05, -0.55 + p * 0.12 + k * 0.01, 0.015, Math.sin(p * Math.PI) * 0.8);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawAshkari(ctx, s) {
  const { t, mouth, accent } = s;
  const b = s.breath * 0.015;

  // Pan de foulard qui flotte (derrière le manteau)
  const L = [], R = [];
  for (let k = 0; k <= 10; k++) {
    const u = k / 10;
    L.push([0.22 + u * 0.7, 0.28 + u * 0.12 + Math.sin(t * 3 - u * 4) * 0.045 * u]);
    R.push([0.22 + u * 0.64, 0.42 + u * 0.18 + Math.sin(t * 3 - u * 4 + 0.5) * 0.045 * u]);
  }
  for (let k = 0; k < 10; k++) {
    const f = 0.5 + 0.5 * Math.cos(t * 3 - (k / 10) * 4);
    ctx.fillStyle = mixHex('#5a2210', '#d8784a', f * 0.85);
    poly(ctx, [L[k], L[k + 1], R[k + 1], R[k]]);
    ctx.fill();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.004;
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,200,150,0.3)';
  ctx.lineWidth = 0.005;
  strokePts(ctx, L);

  // Manteau de cuir, sangle, tube annelé, foulard enroulé
  ctx.save();
  ctx.translate(0, b * 0.4);
  blit(ctx, s, 'as-coat', -1.15, 0.12, 2.3, 1.34, (g) => {
    const rnd = seeded(18);
    const coat = shape([[-1.06, 1.46], [-1.0, 0.62], [-0.62, 0.36], [-0.2, 0.3], [0.2, 0.3], [0.62, 0.36], [1.0, 0.62], [1.06, 1.46]], 0.12);
    const box = [-1.06, 0.3, 1.06, 1.46];
    g.fillStyle = lin(g, -0.8, 0.3, 0.8, 1.3, [[0, '#8a5a3e'], [0.5, '#5a3824'], [1, '#2a180e']]);
    g.fill(coat);
    speckle(g, coat, rnd, 500, box, '#c89878', '#140804', 0.008);
    g.save(); g.clip(coat);
    for (let i = 0; i < 50; i++) {
      const x = (rnd() - 0.5) * 2, y = 0.35 + rnd() * 1.1, a = rnd() * 3;
      g.strokeStyle = `rgba(230,190,150,${0.06 + rnd() * 0.1})`;
      g.lineWidth = 0.004;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 0.05, y + Math.sin(a) * 0.05); g.stroke();
    }
    g.restore();
    folds(g, s, coat, [quadPts([-0.7, 0.5], [-0.6, 0.9], [-0.7, 1.46], 8), quadPts([0.7, 0.5], [0.62, 0.9], [0.72, 1.46], 8)], 0.04, 'rgba(20,8,2,0.5)', 'rgba(230,180,140,0.2)');
    for (const side of [-1, 1]) {
      const seam = quadPts([side * 0.6, 0.4], [side * 0.52, 0.85], [side * 0.58, 1.46], 10);
      g.strokeStyle = 'rgba(15,6,2,0.7)'; g.lineWidth = 0.01; strokeSmooth(g, seam);
      g.setLineDash([0.012, 0.012]);
      g.strokeStyle = 'rgba(230,190,140,0.45)'; g.lineWidth = 0.004;
      strokeSmooth(g, seam.map(([x, y]) => [x - side * 0.014, y]));
      g.setLineDash([]);
    }
    modelVol(g, coat, box, 0.3, 0.05, '#2a1408');
    light3(g, s, coat, AS_L);
    // Revers
    for (const side of [-1, 1]) {
      const lap = shape(side < 0 ? [[-0.2, 0.32], [-0.44, 0.38], [-0.32, 0.92], [-0.1, 0.62]] : [[0.2, 0.32], [0.44, 0.38], [0.32, 0.92], [0.1, 0.62]], 0.02);
      castShadow(g, s, coat, lap, side * 0.02 + 0.01, 0.03, 0.03, 'rgba(10,4,0,0.6)');
      g.fillStyle = lin(g, side * 0.4, 0.35, side * 0.15, 0.9, [[0, '#9a6a4a'], [1, '#4a2c18']]);
      g.fill(lap);
      speckle(g, lap, rnd, 80, [-0.45, 0.3, 0.45, 0.95], '#c89878', '#140804', 0.007);
      light3(g, s, lap, AS_L, 0.4);
    }
    // Sangle en travers et boucle de laiton
    const strapC = quadPts([-0.8, 0.46], [-0.2, 0.8], [0.36, 1.48], 14);
    const strap = shape(ribbon(strapC, 0.036, 0.036), 0.01);
    castShadow(g, s, coat, strap, 0.015, 0.03, 0.025, 'rgba(10,4,0,0.6)');
    g.fillStyle = '#3a2416';
    g.fill(strap);
    speckle(g, strap, rnd, 100, [-0.8, 0.4, 0.4, 1.48], '#8a6040', '#0a0402', 0.006);
    g.setLineDash([0.01, 0.01]);
    g.strokeStyle = 'rgba(220,180,130,0.45)'; g.lineWidth = 0.004;
    for (const o of [-0.025, 0.025]) strokeSmooth(g, strapC.map(([x, y], i) => [x + o * 0.6, y - o * 0.8]));
    g.setLineDash([]);
    light3(g, s, strap, AS_L, 0.35);
    const [bx, by] = strapC[6];
    g.save(); g.translate(bx, by); g.rotate(0.8);
    g.fillStyle = brass(g, -0.05, -0.05, 0.05, 0.05);
    g.fillRect(-0.05, -0.055, 0.1, 0.11);
    g.fillStyle = '#2a160c';
    g.fillRect(-0.03, -0.035, 0.06, 0.07);
    g.fillStyle = brass(g, -0.03, 0, 0.03, 0);
    g.fillRect(-0.006, -0.035, 0.012, 0.07);
    g.restore();
    gloss(g, s, bx - 0.02, by - 0.03, 0.02, 0.008, 0.8, 0.6, 0.004);
    // Médaillon de caravane
    const md = new Path2D(); md.arc(0.5, 0.66, 0.065, 0, Math.PI * 2);
    castShadow(g, s, coat, md, 0.012, 0.02, 0.015, 'rgba(10,4,0,0.6)');
    g.fillStyle = brass(g, 0.44, 0.6, 0.56, 0.72);
    g.fill(md);
    g.strokeStyle = 'rgba(60,30,10,0.7)'; g.lineWidth = 0.006;
    g.beginPath(); g.arc(0.5, 0.66, 0.045, 0, Math.PI * 2); g.moveTo(0.46, 0.68); g.lineTo(0.5, 0.62); g.lineTo(0.54, 0.68); g.stroke();
    gloss(g, s, 0.48, 0.63, 0.02, 0.01, -0.5, 0.6, 0.005);
    // Foulard enroulé : trois rouleaux de tissu
    for (let k = 2; k >= 0; k--) {
      const roll = new Path2D();
      roll.ellipse(0, 0.27 + k * 0.06, 0.46 - k * 0.015, 0.1, 0, 0, Math.PI * 2);
      g.save(); g.filter = blurF(s, 0.02); g.fillStyle = 'rgba(20,6,2,0.5)';
      g.translate(0, 0.025); g.fill(roll); g.restore();
      g.fillStyle = lin(g, 0, 0.16 + k * 0.055, 0, 0.34 + k * 0.055, [[0, '#e08854'], [0.5, '#b25a34'], [1, '#5a2410']]);
      g.fill(roll);
      weave(g, roll, [-0.52, 0.14, 0.52, 0.46], 0.01, 'rgba(60,20,8,0.12)');
      g.save(); g.clip(roll); g.filter = blurF(s, 0.01);
      for (let i = 0; i < 7; i++) {
        const x = -0.4 + i * 0.13 + rnd() * 0.04;
        g.strokeStyle = 'rgba(50,15,5,0.4)'; g.lineWidth = 0.015;
        g.beginPath(); g.moveTo(x, 0.18 + k * 0.055); g.lineTo(x + 0.05, 0.33 + k * 0.055); g.stroke();
      }
      g.restore();
      if (k === 1) {
        g.save(); g.clip(roll);
        g.strokeStyle = 'rgba(255,220,160,0.4)'; g.lineWidth = 0.008;
        g.beginPath();
        for (let x = -0.45; x < 0.45; x += 0.05) { g.moveTo(x, 0.31); g.lineTo(x + 0.025, 0.29); g.lineTo(x + 0.05, 0.31); }
        g.stroke();
        g.restore();
      }
      light3(g, s, roll, AS_L, 0.45);
    }
    g.save(); g.filter = blurF(s, 0.04); g.fillStyle = 'rgba(15,5,0,0.7)';
    g.beginPath(); g.ellipse(0, 0.25, 0.3, 0.07, 0, 0, Math.PI * 2); g.fill(); g.restore();
    // Tube respiratoire annelé
    const tube = [];
    for (let k = 0; k <= 24; k++) {
      const u = k / 24, v = 1 - u;
      const P = [[-0.17, 0.14], [-0.3, 0.4], [-0.5, 0.45], [-0.56, 0.74]];
      tube.push([0, 1].map((d) => v * v * v * P[0][d] + 3 * v * v * u * P[1][d] + 3 * v * u * u * P[2][d] + u * u * u * P[3][d]));
    }
    corrugated(g, tube, 0.03, '#3a2e2a', '#a08a7c');
    rivet(g, -0.56, 0.75, 0.035);
  });
  ctx.restore();

  // Tête emmaillotée
  ctx.save();
  ctx.translate(s.hx * 0.025, -b - s.nod * 0.02);
  ctx.rotate(s.tilt);
  blit(ctx, s, 'as-head', -0.42, -0.72, 0.84, 0.98, (g) => {
    const rnd = seeded(27);
    const head = new Path2D();
    head.ellipse(0, -0.24, 0.36, 0.44, 0, 0, Math.PI * 2);
    const box = [-0.36, -0.68, 0.36, 0.2];
    g.fillStyle = '#6a4430';
    g.fill(head);
    g.save(); g.clip(head);
    for (let i = 9; i >= 0; i--) {
      const yc = -0.67 + i * 0.105, tilt = i % 2 ? 0.12 : -0.1, bow = (yc + 0.24) * 0.22;
      const band = new Path2D();
      const edge = (y0, dir) => {
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const x = -0.45 + (k / 8) * 0.9;
          pts.push([x, y0 + tilt * x + bow * (1 - (x / 0.45) ** 2)]);
        }
        return dir > 0 ? pts : pts.reverse();
      };
      const top = edge(yc - 0.065, 1), bot = edge(yc + 0.065, -1);
      band.moveTo(top[0][0], top[0][1]);
      for (const p of top.concat(bot)) band.lineTo(p[0], p[1]);
      band.closePath();
      g.save(); g.filter = blurF(s, 0.015); g.translate(0, 0.025);
      g.fillStyle = 'rgba(20,8,2,0.55)'; g.fill(band); g.restore();
      const c = AS_BANDS[i % AS_BANDS.length];
      g.fillStyle = lin(g, 0, yc - 0.07, 0, yc + 0.07, [[0, mixHex(c, '#fff0dc', 0.35)], [0.35, c], [1, mixHex(c, '#1a0a04', 0.6)]]);
      g.fill(band);
      weave(g, band, [-0.45, yc - 0.1, 0.45, yc + 0.1], 0.009, 'rgba(40,20,8,0.13)');
      g.strokeStyle = 'rgba(255,230,200,0.35)';
      g.lineWidth = 0.003;
      for (let k = 0; k < 5; k++) {
        const x = -0.3 + rnd() * 0.6, y = yc + 0.06 + tilt * x + bow * (1 - (x / 0.45) ** 2);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 0.03, y + 0.015 + rnd() * 0.01); g.stroke();
      }
    }
    g.restore();
    modelVol(g, head, box, 0.3, 0.15, '#3a1c0c');
    light3(g, s, head, AS_L);
    // Sangle de cuir des lunettes
    const strap = shape([[-0.37, -0.32], [0.37, -0.32], [0.37, -0.24], [-0.37, -0.24]], 0.01);
    g.save(); g.clip(head);
    g.fillStyle = 'rgba(15,6,2,0.5)'; g.fillRect(-0.4, -0.25, 0.8, 0.02);
    g.fillStyle = lin(g, 0, -0.32, 0, -0.24, [[0, '#6a4630'], [1, '#2a160c']]);
    g.fill(strap);
    g.setLineDash([0.01, 0.008]);
    g.strokeStyle = 'rgba(220,180,130,0.4)'; g.lineWidth = 0.003;
    g.beginPath(); g.moveTo(-0.4, -0.31); g.lineTo(0.4, -0.31); g.moveTo(-0.4, -0.25); g.lineTo(0.4, -0.25); g.stroke();
    g.setLineDash([]);
    g.restore();
    // Fond des oculaires
    for (const side of [-1, 1]) {
      g.fillStyle = rad(g, side * 0.15, -0.28, 0.02, 0.095, [[0, '#3a1a0c'], [1, '#080302']]);
      g.beginPath(); g.arc(side * 0.15, -0.28, 0.092, 0, Math.PI * 2); g.fill();
    }
  });
  // Yeux derrière les verres ambrés
  for (const side of [-1, 1]) {
    wetEye(ctx, s, side * 0.15, -0.28, {
      id: 'as-iris', rx: 0.056, ry: 0.03, top: 0.8, irisR: 0.026, look: 0.35, lookY: 0.2,
      sclera: [[0, '#e8d8c8'], [1, '#7a5a48']], lid: '#6a4a38', rim: '#a0d8ff', lashW: 0.006,
      paintIris: irisPainter(0.026, ['#fff0d0', '#ffb070', '#8a4010', '#200a04'], 'round', 31),
    });
  }
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 0.15, -0.28);
    blit(ctx, s, 'as-lens', -0.095, -0.095, 0.19, 0.19, (g) => {
      const lens = new Path2D();
      lens.arc(0, 0, 0.09, 0, Math.PI * 2);
      g.fillStyle = rad(g, -0.02, -0.02, 0, 0.09, [[0, 'rgba(255,170,70,0.28)'], [0.75, 'rgba(160,70,20,0.45)'], [1, 'rgba(60,20,6,0.85)']]);
      g.fill(lens);
      g.save(); g.clip(lens);
      g.filter = blurF(s, 0.008);
      g.strokeStyle = 'rgba(255,200,140,0.35)'; g.lineWidth = 0.02;
      g.beginPath(); g.arc(0.05, 0.2, 0.2, Math.PI * 1.2, Math.PI * 1.65); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.ellipse(-0.035, -0.04, 0.035, 0.016, -0.6, 0, Math.PI * 2); g.fill();
      g.restore();
      innerShade(g, s, lens, 'rgba(140,210,255,0.25)', 0.012);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.ellipse(-0.04, -0.045, 0.012, 0.006, -0.6, 0, Math.PI * 2); g.fill();
    });
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) {
    const lum = (0.35 + 0.15 * Math.sin(t * 1.1 + side)) * (1 - s.blink * 0.8);
    sprite(ctx, softTex('#ff9a40'), side * 0.15, -0.28, 0.12, lum);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  blit(ctx, s, 'as-gog', -0.3, -0.42, 0.6, 0.28, (g) => {
    for (const side of [-1, 1]) {
      const x = side * 0.15, y = -0.28;
      const rim = new Path2D();
      rim.arc(x, y, 0.123, 0, Math.PI * 2);
      rim.arc(x, y, 0.088, 0, Math.PI * 2, true);
      g.save(); g.filter = blurF(s, 0.012); g.fillStyle = 'rgba(10,4,0,0.6)';
      g.translate(0.01, 0.015); g.fill(rim); g.restore();
      g.fillStyle = brass(g, x - 0.12, y - 0.12, x + 0.12, y + 0.12);
      g.fill(rim);
      light3(g, s, rim, AS_L, 0.25);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.2;
        rivet(g, x + Math.cos(a) * 0.106, y + Math.sin(a) * 0.106, 0.008);
      }
      gloss(g, s, x - 0.07, y - 0.07, 0.03, 0.01, -0.8, 0.7, 0.004);
    }
    const bridge = shape([[-0.04, -0.3], [0.04, -0.3], [0.04, -0.27], [-0.04, -0.27]], 0.005);
    g.fillStyle = brass(g, 0, -0.3, 0, -0.27);
    g.fill(bridge);
  });
  // Masque respiratoire et cartouches
  blit(ctx, s, 'as-mask', -0.36, -0.2, 0.72, 0.38, (g) => {
    const rnd = seeded(39);
    for (const side of [-1, 1]) {
      g.save();
      g.translate(side * 0.25, 0.04);
      g.rotate(side * 0.5);
      g.save(); g.filter = blurF(s, 0.012); g.fillStyle = 'rgba(10,4,0,0.6)'; g.fillRect(-0.045, -0.06, 0.11, 0.15); g.restore();
      g.fillStyle = lin(g, -0.055, 0, 0.055, 0, [[0, '#1a1412'], [0.3, '#8a7a70'], [0.55, '#4a3c36'], [1, '#120e0c']]);
      g.fillRect(-0.055, -0.075, 0.11, 0.15);
      for (const yy of [-0.08, 0.05]) {
        g.fillStyle = lin(g, -0.06, 0, 0.06, 0, [[0, '#4a2a10'], [0.3, '#f0c080'], [0.6, '#a06830'], [1, '#3a2008']]);
        g.fillRect(-0.06, yy, 0.12, 0.028);
      }
      g.fillStyle = 'rgba(0,0,0,0.6)';
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(-0.03 + k * 0.02, 0.0, 0.006, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    const mask = asMask();
    g.fillStyle = lin(g, 0, -0.14, 0, 0.18, [[0, '#6a5a52'], [0.5, '#3a2e2a'], [1, '#161210']]);
    g.fill(mask);
    speckle(g, mask, rnd, 120, [-0.2, -0.17, 0.2, 0.18], '#a8968a', '#060404', 0.006);
    light3(g, s, mask, AS_L, 0.5);
    g.strokeStyle = brass(g, -0.2, -0.15, 0.2, 0.18);
    g.lineWidth = 0.014;
    g.stroke(mask);
    for (const [x, y] of [[-0.17, -0.1], [0.17, -0.1], [-0.15, 0.06], [0.15, 0.06], [0, -0.135], [0, 0.155]]) rivet(g, x, y, 0.009);
    // Fentes de la grille
    for (let k = 0; k < 4; k++) {
      const y = -0.06 + k * 0.045, w = 0.11 - k * 0.012;
      const slot = shape([[-w, y - 0.011], [w, y - 0.011], [w, y + 0.011], [-w, y + 0.011]], 0.01);
      g.fillStyle = '#0a0604';
      g.fill(slot);
      g.strokeStyle = 'rgba(255,220,180,0.25)'; g.lineWidth = 0.004;
      g.beginPath(); g.moveTo(-w, y + 0.013); g.lineTo(w, y + 0.013); g.stroke();
    }
    gloss(g, s, -0.09, -0.09, 0.05, 0.012, -0.1, 0.35, 0.008);
  });
  // Grille : respire au repos, s'illumine avec la voix
  const vent = 0.15 + 0.12 * Math.max(0, s.breath) + mouth * 0.85;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 0.012;
  for (let k = 0; k < 4; k++) {
    const y = -0.06 + k * 0.045, w = 0.1 - k * 0.012;
    const a = clamp01(vent * (0.6 + 0.4 * hash(k + s.syl * 3)));
    ctx.strokeStyle = rgba('#ffc890', a);
    ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.stroke();
  }
  sprite(ctx, softTex(accent), 0, 0.0, 0.18, vent * 0.4);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Buée expirée par les cartouches
  if (!s.small) {
    const ex = (s.t * 1.25 / (Math.PI * 2)) % 1;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const p = (ex + k * 0.5) % 1;
        sprite(ctx, softTex('#e8e0d8'), side * (0.32 + p * 0.1), 0.12 - p * 0.15, 0.05 + p * 0.1, 0.12 * Math.sin(p * Math.PI));
      }
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------- Colons de l'Arche : humain casqué, visage derrière la visière ----------

const CO_L = { key: 'rgba(235,242,255,0.6)', rim: 'rgba(124,255,158,0.8)', shadow: 'rgba(5,10,15,0.55)', ao: 'rgba(0,5,10,0.5)' };

function coVisor() {
  const p = new Path2D();
  p.moveTo(-0.37, -0.28);
  p.quadraticCurveTo(-0.36, -0.46, 0, -0.47);
  p.quadraticCurveTo(0.36, -0.46, 0.37, -0.28);
  p.quadraticCurveTo(0.36, 0.0, 0, 0.04);
  p.quadraticCurveTo(-0.36, 0.0, -0.37, -0.28);
  p.closePath();
  return p;
}

function bgColon(ctx, s) {
  const { t, hw, hh } = s;
  blit(ctx, s, 'co-bg', -hw, -hh, 2 * hw, 2 * hh, (g) => {
    g.fillStyle = lin(g, 0, -hh, 0, hh, [[0, '#0e1418'], [1, '#05080a']]);
    g.fillRect(-hw, -hh, 2 * hw, 2 * hh);
    const rnd = seeded(101);
    // Hublot : étoiles et monde à coloniser, flous
    const win = shape([[-1.0, -1.0], [-0.15, -1.0], [-0.15, -0.35], [-1.0, -0.35]], 0.12);
    g.save(); g.clip(win);
    g.fillStyle = '#020408';
    g.fillRect(-1.1, -1.1, 1.0, 0.8);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(230,240,255,${0.3 + rnd() * 0.6})`;
      g.beginPath(); g.arc(-1 + rnd() * 0.85, -1 + rnd() * 0.65, 0.002 + rnd() * 0.004, 0, Math.PI * 2); g.fill();
    }
    g.filter = blurF(s, 0.02);
    g.fillStyle = rad(g, -0.75, -0.2, 0.05, 0.5, [[0, '#3a8a7a'], [0.7, '#1a4a5a'], [1, '#0a1a2a']]);
    g.beginPath(); g.arc(-0.65, -0.05, 0.45, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(140,220,255,0.5)'; g.lineWidth = 0.025;
    g.beginPath(); g.arc(-0.65, -0.05, 0.45, Math.PI * 1.15, Math.PI * 1.8); g.stroke();
    g.restore();
    // Cadre du hublot et membrures de la coque, flous
    g.save();
    g.filter = blurF(s, 0.02);
    g.strokeStyle = '#3a4248'; g.lineWidth = 0.05; g.stroke(win);
    g.strokeStyle = 'rgba(200,220,230,0.25)'; g.lineWidth = 0.01; g.stroke(win);
    for (const x of [0.25, 0.7]) {
      g.fillStyle = lin(g, x - 0.06, 0, x + 0.06, 0, [[0, '#0a0e10'], [0.4, '#2a3238'], [1, '#080a0c']]);
      g.fillRect(x - 0.06, -hh, 0.12, 2 * hh);
    }
    // Consoles lumineuses
    g.filter = blurF(s, 0.03);
    for (let i = 0; i < 14; i++) {
      const c = ['#7cff9e', '#ffb040', '#60c0ff'][Math.floor(rnd() * 3)];
      g.fillStyle = rgba(c, 0.25 + rnd() * 0.3);
      g.fillRect(0.3 + rnd() * 0.7, 0.1 + rnd() * 0.5, 0.04 + rnd() * 0.08, 0.02 + rnd() * 0.03);
    }
    g.restore();
    bokehDiscs(g, rnd, 14, [-hw, 0.0, hw, hh], ['#7cff9e', '#ffb040', '#60c0ff'], 0.02, 0.06, 0.15, 0.4);
  });
  // Voyants qui clignotent
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const on = Math.sin(t * (1 + hash(i) * 3) + i * 2) > 0.3 ? 1 : 0.25;
    sprite(ctx, glowTex(['#7cff9e', '#ffb040', '#60c0ff'][i % 3]), 0.4 + hash(i + 3) * 0.55, 0.15 + hash(i + 7) * 0.4, 0.03, 0.6 * on);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  motes(ctx, s, 21, s.small ? 3 : 8, ['#dfe8f0'], 0.01, 0.01, 1, 0.5);
}

function drawColon(ctx, s) {
  const { t, mouth, accent } = s;
  const b = s.breath * 0.014;

  // Combinaison
  ctx.save();
  ctx.translate(0, b * 0.4);
  blit(ctx, s, 'co-suit', -1.15, 0.1, 2.3, 1.38, (g) => {
    const rnd = seeded(77);
    const suit = new Path2D();
    suit.moveTo(-1.06, 1.48);
    suit.quadraticCurveTo(-1.0, 0.44, -0.5, 0.34);
    suit.lineTo(0.5, 0.34);
    suit.quadraticCurveTo(1.0, 0.44, 1.06, 1.48);
    suit.closePath();
    const box = [-1.06, 0.34, 1.06, 1.48];
    g.fillStyle = lin(g, -0.8, 0.3, 0.8, 1.3, [[0, '#eef2f4'], [0.5, '#b8bec4'], [1, '#5a6066']]);
    g.fill(suit);
    weave(g, suit, box, 0.01, 'rgba(40,50,60,0.06)');
    folds(g, s, suit, [
      quadPts([-0.85, 0.6], [-0.65, 0.85], [-0.72, 1.3], 8), quadPts([0.85, 0.6], [0.66, 0.85], [0.74, 1.3], 8),
      quadPts([-0.45, 0.85], [-0.3, 1.0], [-0.36, 1.46], 8), quadPts([0.45, 0.85], [0.3, 1.0], [0.38, 1.46], 8),
    ], 0.035, 'rgba(30,40,50,0.4)', 'rgba(255,255,255,0.4)');
    speckle(g, suit, rnd, 200, box, '#ffffff', '#30383e', 0.006);
    modelVol(g, suit, box, 0.3, 0.05, '#3a4248');
    light3(g, s, suit, CO_L);
    // Panneaux renforcés des épaules
    for (const side of [-1, 1]) {
      const pts = [[-0.88, 0.62], [-0.58, 0.46], [-0.52, 1.48], [-0.86, 1.48]];
      const pan = shape(side < 0 ? pts : mirror(pts), 0.04);
      castShadow(g, s, suit, pan, side * -0.01 + 0.01, 0.025, 0.025, 'rgba(10,20,30,0.45)');
      g.fillStyle = lin(g, side * 0.9, 0.5, side * 0.5, 1.4, [[0, '#7a8288'], [1, '#3a4046']]);
      g.fill(pan);
      speckle(g, pan, rnd, 80, side < 0 ? [-0.9, 0.45, -0.5, 1.48] : [0.5, 0.45, 0.9, 1.48], '#c8d0d6', '#1a2024', 0.006);
      light3(g, s, pan, CO_L, 0.4);
      g.setLineDash([0.01, 0.01]);
      g.strokeStyle = 'rgba(220,230,235,0.35)'; g.lineWidth = 0.003;
      g.stroke(pan);
      g.setLineDash([]);
    }
    const stripe = shape([[-0.84, 0.66], [-0.58, 0.56], [-0.575, 0.6], [-0.835, 0.7]], 0.005);
    g.fillStyle = rgba(accent, 0.85);
    g.fill(stripe);
    // Écusson de mission brodé
    const patch = new Path2D(); patch.arc(0.62, 0.7, 0.08, 0, Math.PI * 2);
    castShadow(g, s, suit, patch, 0.01, 0.015, 0.01, 'rgba(10,20,30,0.5)');
    g.fillStyle = rad(g, 0.6, 0.68, 0, 0.09, [[0, '#24384a'], [1, '#0e1a26']]);
    g.fill(patch);
    g.strokeStyle = '#c8d0d8'; g.lineWidth = 0.008; g.stroke(patch);
    g.strokeStyle = rgba(accent, 0.9); g.lineWidth = 0.01;
    g.beginPath(); g.moveTo(0.58, 0.74); g.lineTo(0.62, 0.64); g.lineTo(0.66, 0.74); g.lineTo(0.62, 0.715); g.closePath(); g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(0.665, 0.655, 0.008, 0, Math.PI * 2); g.fill();
    // Boîtier de commande sur la poitrine
    const box2 = shape([[-0.24, 0.5], [0.24, 0.5], [0.2, 0.8], [-0.2, 0.8]], 0.025);
    castShadow(g, s, suit, box2, 0.015, 0.03, 0.03, 'rgba(10,20,30,0.55)');
    g.fillStyle = lin(g, 0, 0.5, 0, 0.8, [[0, '#5a6066'], [1, '#22282c']]);
    g.fill(box2);
    light3(g, s, box2, CO_L, 0.4);
    for (let k = 0; k < 3; k++) {
      const x = -0.16 + k * 0.06;
      g.fillStyle = lin(g, x, 0.6, x, 0.64, [[0, '#c8ccd0'], [1, '#4a5056']]);
      g.fillRect(x, 0.6, 0.04, 0.03);
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, 0.63, 0.04, 0.006);
    }
    g.fillStyle = '#0a1410';
    g.fillRect(-0.16, 0.67, 0.2, 0.07);
    g.strokeStyle = rgba(accent, 0.45); g.lineWidth = 0.004;
    g.beginPath(); g.moveTo(-0.15, 0.71); for (let x = -0.15; x < 0.03; x += 0.015) g.lineTo(x, 0.705 + Math.sin(x * 90) * 0.012); g.stroke();
    rivet(g, 0.12, 0.6, 0.025, '#ffffff', '#9aa0a6', '#2a3036');
    // Tuyaux
    for (const side of [-1, 1]) corrugated(g, quadPts([side * 0.2, 0.78], [side * 0.32, 1.0], [side * 0.48, 1.08], 14), 0.026, '#3a4046', '#b8c0c6');
    // Anneau de cou métallique
    const ring = new Path2D(); ring.ellipse(0, 0.31, 0.37, 0.09, 0, 0, Math.PI * 2);
    g.save(); g.filter = blurF(s, 0.02); g.fillStyle = 'rgba(10,20,30,0.5)'; g.translate(0, 0.03); g.fill(ring); g.restore();
    g.fillStyle = lin(g, -0.37, 0, 0.37, 0, [[0, '#4a5056'], [0.3, '#eef2f4'], [0.6, '#8a9096'], [1, '#2a3036']]);
    g.fill(ring);
    g.fillStyle = 'rgba(26,32,36,0.8)';
    g.beginPath(); g.ellipse(0, 0.29, 0.3, 0.06, 0, 0, Math.PI * 2); g.fill();
    gloss(g, s, -0.15, 0.29, 0.08, 0.012, -0.1, 0.6, 0.005);
  });
  ctx.globalCompositeOperation = 'lighter';
  sprite(ctx, glowTex(accent), 0.12, 0.6, 0.04, 0.5 + 0.4 * Math.sin(t * 1.5));
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // Tête casquée (un peu agrandie)
  ctx.save();
  ctx.translate(s.hx * 0.025, -b - s.nod * 0.02);
  ctx.rotate(s.tilt);
  ctx.translate(0, -0.2);
  ctx.scale(1.08, 1.08);
  ctx.translate(0, 0.2);
  const visor = coVisor();
  // Visage derrière la visière
  blit(ctx, s, 'co-face', -0.4, -0.5, 0.8, 0.56, (g) => {
    const rnd = seeded(88);
    g.save();
    g.clip(visor);
    g.fillStyle = rad(g, -0.1, -0.4, 0.02, 0.5, [[0, '#4a5258'], [1, '#14181c']]);
    g.fillRect(-0.4, -0.5, 0.8, 0.56);
    weave(g, visor, [-0.4, -0.5, 0.4, 0.06], 0.008, 'rgba(0,0,0,0.25)');
    const face = new Path2D();
    face.moveTo(0, -0.45);
    face.bezierCurveTo(0.15, -0.45, 0.2, -0.36, 0.195, -0.24);
    face.bezierCurveTo(0.19, -0.12, 0.15, -0.02, 0.075, 0.02);
    face.quadraticCurveTo(0, 0.05, -0.075, 0.02);
    face.bezierCurveTo(-0.15, -0.02, -0.19, -0.12, -0.195, -0.24);
    face.bezierCurveTo(-0.2, -0.36, -0.15, -0.45, 0, -0.45);
    face.closePath();
    const box = [-0.2, -0.45, 0.2, 0.05];
    g.fillStyle = rad(g, -0.06, -0.3, 0.02, 0.34, [[0, '#f2c8a8'], [0.5, '#c88a68'], [1, '#6a3e2c']]);
    g.fill(face);
    speckle(g, face, rnd, 400, box, '#ffe0c8', '#5a2a18', 0.003);
    g.save(); g.clip(face);
    g.filter = blurF(s, 0.01);
    for (const side of [-1, 1]) {
      g.fillStyle = 'rgba(90,40,30,0.45)';
      g.beginPath(); g.ellipse(side * 0.075, -0.24, 0.055, 0.035, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(50,28,18,0.85)'; g.lineWidth = 0.014;
      g.beginPath(); g.moveTo(side * 0.125, -0.282); g.quadraticCurveTo(side * 0.08, -0.305, side * 0.032, -0.29); g.stroke();
      g.fillStyle = 'rgba(210,90,80,0.18)';
      g.beginPath(); g.ellipse(side * 0.115, -0.15, 0.04, 0.03, 0, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(255,230,210,0.45)'; g.lineWidth = 0.01;
    g.beginPath(); g.moveTo(-0.01, -0.27); g.lineTo(-0.008, -0.16); g.stroke();
    g.strokeStyle = 'rgba(80,35,20,0.45)'; g.lineWidth = 0.016;
    g.beginPath(); g.moveTo(0.02, -0.26); g.quadraticCurveTo(0.03, -0.18, 0.03, -0.14); g.stroke();
    g.fillStyle = 'rgba(60,20,12,0.7)';
    for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 0.022, -0.125, 0.012, 0.006, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(255,230,210,0.5)';
    g.beginPath(); g.ellipse(-0.004, -0.145, 0.012, 0.009, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(90,40,25,0.3)'; g.lineWidth = 0.01;
    for (const side of [-1, 1]) { g.beginPath(); g.moveTo(side * 0.04, -0.12); g.quadraticCurveTo(side * 0.06, -0.08, side * 0.055, -0.05); g.stroke(); }
    g.fillStyle = 'rgba(255,230,210,0.25)';
    g.beginPath(); g.ellipse(-0.01, 0.0, 0.035, 0.015, 0, 0, Math.PI * 2); g.fill();
    g.filter = 'none';
    g.restore();
    modelVol(g, face, box, 0.35, 0.2, '#5a3020');
    light3(g, s, face, CO_L, 0.5);
    // Lèvre supérieure
    g.fillStyle = lin(g, 0, -0.07, 0, -0.045, [[0, '#b46e62'], [1, '#7a3a34']]);
    g.beginPath();
    g.moveTo(-0.045, -0.045);
    g.quadraticCurveTo(-0.02, -0.068, 0, -0.06);
    g.quadraticCurveTo(0.02, -0.068, 0.045, -0.045);
    g.quadraticCurveTo(0, -0.042, -0.045, -0.045);
    g.fill();
    // Cagoule de communication autour du visage
    const hood = new Path2D();
    hood.rect(-0.45, -0.55, 0.9, 0.65);
    hood.ellipse(0, -0.19, 0.17, 0.255, 0, 0, Math.PI * 2, true);
    g.save(); g.filter = blurF(s, 0.012); g.fillStyle = 'rgba(10,5,2,0.6)'; g.translate(0.005, 0.012); g.fill(hood); g.restore();
    g.fillStyle = rad(g, -0.1, -0.42, 0.02, 0.5, [[0, '#4a5258'], [0.6, '#262c30'], [1, '#101418']]);
    g.fill(hood);
    weave(g, hood, [-0.45, -0.55, 0.45, 0.1], 0.008, 'rgba(0,0,0,0.3)');
    g.restore();
  });
  // Yeux et bouche
  for (const side of [-1, 1]) {
    wetEye(ctx, s, side * 0.075, -0.243, {
      id: 'co-iris', rx: 0.04, ry: 0.02, top: 0.85, irisR: 0.019, look: 0.4, lookY: 0.2,
      sclera: [[0, '#f6f0ea'], [1, '#a89890']], lid: '#c08a6c', rim: '#7cff9e', lashW: 0.006,
      paintIris: irisPainter(0.019, ['#d8c890', '#7a8a50', '#3a4a2a', '#101408'], 'round', 41),
    });
  }
  ctx.fillStyle = '#2a0c0a';
  ctx.beginPath(); ctx.ellipse(0, -0.045 + mouth * 0.008, 0.036, 0.003 + mouth * 0.018, 0, 0, Math.PI * 2); ctx.fill();
  if (mouth > 0.1) {
    ctx.fillStyle = 'rgba(240,235,225,0.75)';
    ctx.fillRect(-0.02, -0.046, 0.04, 0.006 * mouth);
  }
  ctx.save();
  ctx.translate(0, mouth * 0.018);
  ctx.fillStyle = lin(ctx, 0, -0.045, 0, -0.02, [[0, '#b8726a'], [1, '#7a3c34']]);
  ctx.beginPath();
  ctx.moveTo(-0.042, -0.045); ctx.quadraticCurveTo(0, -0.012, 0.042, -0.045); ctx.quadraticCurveTo(0, -0.037, -0.042, -0.045);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,230,0.35)';
  ctx.beginPath(); ctx.ellipse(-0.008, -0.03, 0.012, 0.004, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Verre de la visière : teinte, reflets, affichage tête haute
  blit(ctx, s, 'co-visor', -0.4, -0.5, 0.8, 0.56, (g) => {
    g.save();
    g.clip(visor);
    g.fillStyle = 'rgba(20,70,45,0.16)';
    g.fillRect(-0.4, -0.5, 0.8, 0.56);
    g.fillStyle = lin(g, 0, -0.47, 0, -0.2, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
    g.fillRect(-0.4, -0.5, 0.8, 0.4);
    g.filter = blurF(s, 0.012);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.035;
    g.beginPath(); g.arc(0.05, -0.02, 0.38, Math.PI * 1.12, Math.PI * 1.38); g.stroke();
    g.fillStyle = 'rgba(200,230,255,0.12)';
    g.beginPath(); g.ellipse(0.22, -0.34, 0.08, 0.04, 0.3, 0, Math.PI * 2); g.fill();
    g.filter = 'none';
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath(); g.ellipse(-0.2, -0.38, 0.03, 0.008, -0.5, 0, Math.PI * 2); g.fill();
    for (const [x, y, c] of [[0.25, -0.12, '#ffb040'], [0.28, -0.1, '#7cff9e'], [0.22, -0.08, '#60c0ff']]) {
      g.fillStyle = rgba(c, 0.6);
      g.beginPath(); g.arc(x, y, 0.006, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = rgba(accent, 0.3); g.lineWidth = 0.005;
    g.beginPath();
    g.arc(0.24, -0.3, 0.04, 0, Math.PI * 2);
    g.moveTo(-0.32, -0.34); g.lineTo(-0.22, -0.34);
    g.moveTo(-0.32, -0.315); g.lineTo(-0.25, -0.315);
    g.stroke();
    g.restore();
    innerShade(g, s, visor, 'rgba(160,255,200,0.2)', 0.02);
  });
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(accent, 0.55);
  for (let k = -3; k <= 3; k++) {
    const hgt = 0.004 + mouth * 0.035 * (0.3 + 0.7 * hash(k + 10 + s.syl * 7)) * (1 - Math.abs(k) * 0.1);
    ctx.fillRect(-0.27 + k * 0.016 - 0.005, -0.12 - hgt, 0.01, hgt * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
  // Coque du casque, percée pour la visière
  blit(ctx, s, 'co-shell', -0.56, -0.7, 1.12, 0.98, (g) => {
    const rnd = seeded(64);
    const shell = new Path2D();
    shell.arc(0, -0.2, 0.47, 0, Math.PI * 2);
    const box = [-0.47, -0.67, 0.47, 0.27];
    for (const side of [-1, 1]) {
      const mod = new Path2D(); mod.ellipse(side * 0.46, -0.18, 0.075, 0.15, 0, 0, Math.PI * 2);
      g.fillStyle = lin(g, side * 0.4, -0.3, side * 0.52, -0.05, [[0, '#a8b0b6'], [1, '#3a4248']]);
      g.fill(mod);
      light3(g, s, mod, CO_L, 0.3);
      g.strokeStyle = 'rgba(20,30,40,0.6)'; g.lineWidth = 0.006;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(side * 0.43, -0.24 + k * 0.035); g.lineTo(side * 0.49, -0.24 + k * 0.035); g.stroke(); }
    }
    g.fillStyle = rad(g, -0.18, -0.45, 0.02, 0.64, [[0, '#ffffff'], [0.45, '#dadee2'], [1, '#6a7076']]);
    g.fill(shell);
    speckle(g, shell, rnd, 160, box, '#ffffff', '#5a6066', 0.006);
    g.save(); g.clip(shell);
    for (let i = 0; i < 25; i++) {
      const x = (rnd() - 0.5) * 0.8, y = -0.6 + rnd() * 0.8, a = rnd() * 3;
      g.strokeStyle = `rgba(80,90,100,${0.1 + rnd() * 0.15})`; g.lineWidth = 0.003;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 0.04, y + Math.sin(a) * 0.04); g.stroke();
    }
    g.strokeStyle = 'rgba(40,50,60,0.5)'; g.lineWidth = 0.008;
    g.beginPath(); g.arc(0, -0.2, 0.42, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.004;
    g.beginPath(); g.arc(0, -0.195, 0.425, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    g.fillStyle = rgba(accent, 0.8);
    g.fillRect(-0.03, -0.67, 0.06, 0.16);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 6; i++) g.fillRect(-0.03 + rnd() * 0.05, -0.66 + rnd() * 0.14, 0.006, 0.006);
    g.restore();
    modelVol(g, shell, box, 0.3, 0.15, '#3a4248');
    light3(g, s, shell, CO_L);
    gloss(g, s, -0.2, -0.5, 0.13, 0.05, -0.6, 0.55, 0.025);
    gloss(g, s, -0.22, -0.52, 0.05, 0.015, -0.6, 0.9, 0.006);
    // Ouverture de la visière et joint
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fill(visor);
    g.restore();
    g.save(); g.filter = blurF(s, 0.012);
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 0.05; g.stroke(visor);
    g.restore();
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fill(visor);
    g.restore();
    g.strokeStyle = '#2a3036'; g.lineWidth = 0.026; g.stroke(visor);
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 0.006;
    g.save(); g.translate(-0.004, -0.006); g.stroke(visor); g.restore();
  });
  // Lumière de communication (clignote quand il parle)
  const com = 0.25 + 0.75 * mouth;
  ctx.globalCompositeOperation = 'lighter';
  sprite(ctx, glowTex(accent), 0.5, -0.2, 0.06 + 0.04 * com, com);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

const DRAWERS = {
  vaskhar: drawVaskhar,
  ondesiens: drawOndesiens,
  keltirr: drawKeltirr,
  synodes: drawSynodes,
  orrhaides: drawOrrhaides,
  thrennes: drawThrennes,
  liseurs: drawLiseurs,
  ashkari: drawAshkari,
  'sans-espece': drawColon,
};

// Fonds d'ambiance propres à l'espèce (sinon simple halo de la couleur d'accent).
const BACKDROPS = {
  vaskhar: bgVaskhar,
  ondesiens: bgOndesiens,
  orrhaides: bgOrrhaides,
  keltirr: bgKeltirr,
  synodes: bgSynodes,
  thrennes: bgThrennes,
  liseurs: bgLiseurs,
  ashkari: bgAshkari,
  'sans-espece': bgColon,
};

const resolveKey = (key) => (DRAWERS[key] ? key : 'sans-espece');

// ---------- Portrait animé ----------

export function createAlienPortrait(canvas, speciesKey) {
  const ctx = canvas.getContext('2d');
  let key = resolveKey(speciesKey);
  let speaking = false;
  let alive = true;
  let raf = 0;
  let last = performance.now();
  let wasConnected = false;
  let detached = 0;

  // État animé partagé avec les fonctions de dessin
  // gx, gy : regard (-1..1) ; hx : la tête qui suit le regard, plus lentement ; tilt, nod : micro-gestes ;
  // ph : phase qui accélère quand il parle ; sylAge : temps depuis la dernière syllabe ; cache : calques pré-rendus.
  const s = {
    t: Math.random() * 100, breath: 0, blink: 0, mouth: 0, talk: 0, syl: 0, sylAge: 0, px: 1, bot: 1.05, hw: 1, hh: 1,
    small: false, accent: ACCENTS[key], gx: 0, gy: 0, hx: 0, tilt: 0, nod: 0, ph: Math.random() * 10, cache: new Map(),
  };
  let gazeX = 0, gazeY = 0, gazeTimer = 1;
  let voiceTarget = 0;
  let sylTimer = 0;
  let nextBlink = 1 + Math.random() * 3;
  let blinkPhase = -1;

  function update(dt) {
    s.t += dt;
    s.breath = Math.sin(s.t * 1.25);
    // Clignement : fermeture/ouverture rapide à intervalles irréguliers
    if (blinkPhase >= 0) {
      blinkPhase += dt / 0.16;
      if (blinkPhase >= 1) { blinkPhase = -1; s.blink = 0; nextBlink = 2 + Math.random() * 4; }
      else s.blink = Math.sin(blinkPhase * Math.PI);
    } else {
      nextBlink -= dt;
      if (nextBlink <= 0) blinkPhase = 0;
    }
    // Voix : syllabes irrégulières avec de courtes pauses
    if (speaking) {
      sylTimer -= dt;
      if (sylTimer <= 0) {
        s.syl++;
        s.sylAge = 0;
        if (Math.random() < 0.14) { voiceTarget = 0.05; sylTimer = 0.15 + Math.random() * 0.25; }
        else { voiceTarget = 0.3 + Math.random() * 0.7; sylTimer = 0.07 + Math.random() * 0.13; }
      }
    } else {
      voiceTarget = 0;
    }
    s.mouth += (voiceTarget - s.mouth) * Math.min(1, dt * (speaking ? 18 : 6));
    if (s.mouth < 0.001) s.mouth = 0;
    s.talk += ((speaking ? 1 : 0) - s.talk) * Math.min(1, dt * 3);
    s.sylAge += dt;
    s.ph += dt * (1 + 1.2 * s.talk);
    // Regard : saccades douces, revient souvent vers le joueur (surtout en parlant)
    gazeTimer -= dt;
    if (gazeTimer <= 0) {
      if (Math.random() < (speaking ? 0.6 : 0.35)) { gazeX = 0; gazeY = 0; }
      else { gazeX = (Math.random() * 2 - 1) * 0.9; gazeY = (Math.random() * 2 - 1) * 0.55; }
      gazeTimer = 0.6 + Math.random() * 2.2;
    }
    const k = Math.min(1, dt * 16);
    s.gx += (gazeX - s.gx) * k;
    s.gy += (gazeY - s.gy) * k;
    s.hx += (s.gx - s.hx) * Math.min(1, dt * 1.8);
    s.tilt = 0.025 * Math.sin(s.t * 0.53) + 0.015 * Math.sin(s.t * 1.37 + 1) + s.hx * 0.02;
    s.nod += (s.mouth * 0.6 + s.talk * 0.2 - s.nod) * Math.min(1, dt * 8);
  }

  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const unit = Math.min(W, H) / 2;
    if (unit !== s.px) s.cache.clear();
    s.px = unit;
    s.small = unit < 64;
    s.hw = W / 2 / unit;
    s.hh = H / 2 / unit;
    s.bot = s.hh + 0.05;
    ctx.setTransform(unit, 0, 0, unit, W / 2, H / 2);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
    if (BACKDROPS[key]) {
      BACKDROPS[key](ctx, s);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else {
      // Légère lueur de la couleur de l'espèce derrière le buste
      const halo = 0.16 + 0.04 * s.breath + 0.12 * s.mouth;
      ctx.fillStyle = rad(ctx, 0, -0.2, 0.05, 1.0, [[0, rgba(s.accent, halo)], [1, rgba(s.accent, 0)]]);
      ctx.fillRect(-W / unit, -H / unit, (2 * W) / unit, (2 * H) / unit);
    }
    ctx.save();
    ctx.lineJoin = 'round';
    DRAWERS[key](ctx, s);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // Vignette : assombrit le bord du cercle pour donner de la profondeur
    if (BACKDROPS[key]) {
      ctx.fillStyle = rad(ctx, 0, 0, 0.6, 1.02, [[0, 'rgba(2,4,10,0)'], [0.8, 'rgba(2,4,10,0.35)'], [1, 'rgba(2,4,10,0.8)']]);
      ctx.fillRect(-s.hw, -s.hh, 2 * s.hw, 2 * s.hh);
    }
  }

  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const elapsed = (now - last) / 1000;
    if (elapsed < 1 / FPS_MAX) return;
    last = now;
    // Arrêt automatique quand le canevas a quitté la page
    if (!canvas.isConnected) {
      detached += elapsed;
      if (wasConnected || detached > 10) destroy();
      return;
    }
    wasConnected = true;
    update(Math.min(0.1, elapsed));
    draw();
  }

  function destroy() {
    alive = false;
    cancelAnimationFrame(raf);
  }

  raf = requestAnimationFrame(frame);

  return {
    setSpeaking(v) {
      const was = speaking;
      speaking = !!v;
      if (speaking && !was) sylTimer = 0;
    },
    setSpecies(k) {
      key = resolveKey(k);
      s.accent = ACCENTS[key];
      s.cache.clear();
    },
    destroy,
  };
}
