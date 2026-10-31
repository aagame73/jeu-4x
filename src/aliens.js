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

function glow(ctx, s, color, amount) {
  ctx.shadowColor = color;
  ctx.shadowBlur = amount * s.px;
}

function noGlow(ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------- Vaskhar : roche, basalte, fissures de magma ----------

function drawVaskhar(ctx, s) {
  const { t, bot, mouth, blink, accent } = s;
  const b = s.breath * 0.018;
  const magma = '#ff8a3a';
  const pulse = 0.6 + 0.3 * Math.sin(t * 1.6) + 0.4 * mouth;
  const rock = lin(ctx, -0.9, -0.3, 0.7, 1.1, [[0, '#7a6656'], [0.45, '#43372f'], [1, '#1c1714']]);

  // Épaulières : grandes plaques anguleuses
  ctx.save();
  ctx.translate(0, b * 0.4);
  const pauldron = [[-1.1, bot], [-1.08, 0.5], [-0.86, 0.2], [-0.5, 0.1], [-0.28, 0.32], [-0.34, bot]];
  ctx.fillStyle = rock;
  ctx.strokeStyle = '#120e0c';
  ctx.lineWidth = 0.02;
  for (const p of [pauldron, mirror(pauldron)]) { poly(ctx, p); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = lin(ctx, 0, 0.2, 0, 1, [[0, '#5a4a3e'], [1, '#221b17']]);
  poly(ctx, [[-0.46, bot], [-0.48, 0.48], [-0.22, 0.3], [0.22, 0.3], [0.48, 0.48], [0.46, bot]]);
  ctx.fill(); ctx.stroke();
  // Arêtes claires des plaques
  ctx.strokeStyle = 'rgba(190,160,130,0.35)';
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(-1.02, 0.5); ctx.lineTo(-0.84, 0.25); ctx.lineTo(-0.52, 0.16);
  ctx.moveTo(0.52, 0.16); ctx.lineTo(0.84, 0.25);
  ctx.moveTo(-0.4, 0.5); ctx.lineTo(-0.2, 0.36); ctx.lineTo(0.2, 0.36);
  ctx.stroke();
  // Fissures du corps
  glow(ctx, s, magma, 0.05);
  ctx.strokeStyle = rgba(magma, clamp01(pulse * 0.8));
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.moveTo(-0.8, 0.35); ctx.lineTo(-0.7, 0.55); ctx.lineTo(-0.76, 0.75); ctx.lineTo(-0.66, 0.95);
  ctx.moveTo(0.72, 0.3); ctx.lineTo(0.64, 0.5); ctx.lineTo(0.74, 0.62);
  ctx.moveTo(-0.1, 0.55); ctx.lineTo(0.02, 0.68); ctx.lineTo(-0.04, 0.85); ctx.lineTo(0.08, 1.0);
  ctx.moveTo(0.02, 0.68); ctx.lineTo(0.2, 0.74);
  ctx.stroke();
  noGlow(ctx);
  ctx.restore();

  // Tête (bouge un peu avec la respiration)
  ctx.save();
  ctx.translate(0, -b);
  // Lueur de la gueule, derrière les mandibules
  glow(ctx, s, magma, 0.08);
  ctx.fillStyle = rgba(magma, 0.1 + 0.9 * mouth);
  ctx.beginPath();
  ctx.ellipse(0, 0.31, 0.13, 0.015 + 0.09 * mouth, 0, 0, Math.PI * 2);
  ctx.fill();
  noGlow(ctx);
  // Mandibules qui s'écartent quand il parle
  const mand = [[-0.22, 0.16], [-0.42, 0.24], [-0.33, 0.44], [-0.05, 0.41]];
  ctx.fillStyle = lin(ctx, 0, 0.15, 0, 0.45, [[0, '#57483d'], [1, '#2a221d']]);
  ctx.strokeStyle = '#120e0c';
  ctx.lineWidth = 0.018;
  for (const side of [1, -1]) {
    ctx.save();
    ctx.translate(-0.22 * side, 0.16);
    ctx.rotate(mouth * 0.32 * side);
    ctx.translate(0.22 * side, -0.16);
    poly(ctx, side > 0 ? mand : mirror(mand));
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // Dôme rocheux
  const head = [[-0.46, 0.3], [-0.58, -0.04], [-0.5, -0.4], [-0.26, -0.6], [0.06, -0.66], [0.36, -0.54], [0.56, -0.24], [0.56, 0.1], [0.44, 0.3], [0.1, 0.24], [-0.14, 0.26]];
  ctx.fillStyle = rad(ctx, -0.18, -0.4, 0.05, 0.85, [[0, '#8a7462'], [0.5, '#4b3e34'], [1, '#1e1815']]);
  poly(ctx, head); ctx.fill(); ctx.stroke();
  // Facettes de la roche
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(-0.26, -0.6); ctx.lineTo(-0.16, -0.32); ctx.lineTo(-0.5, -0.4);
  ctx.moveTo(0.36, -0.54); ctx.lineTo(0.22, -0.3); ctx.lineTo(0.56, -0.24);
  ctx.moveTo(-0.16, -0.32); ctx.lineTo(0.22, -0.3);
  ctx.stroke();
  // Arcade sourcilière
  ctx.fillStyle = '#231c18';
  poly(ctx, [[-0.5, -0.12], [-0.3, -0.24], [0, -0.2], [0.3, -0.24], [0.52, -0.12], [0.3, -0.06], [0, -0.1], [-0.3, -0.06]]);
  ctx.fill();
  // Trois yeux-fentes
  const eyeH = 0.034 * (1 - blink) + 0.004;
  glow(ctx, s, accent, 0.06);
  ctx.fillStyle = '#ffd27a';
  for (const [x, y] of [[-0.26, -0.13], [0, -0.16], [0.26, -0.13]]) {
    ctx.beginPath();
    ctx.ellipse(x, y, 0.075, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fissures de la tête
  glow(ctx, s, magma, 0.05);
  ctx.strokeStyle = rgba(magma, clamp01(pulse));
  ctx.lineWidth = 0.014;
  ctx.beginPath();
  ctx.moveTo(0.06, -0.64); ctx.lineTo(0.1, -0.5); ctx.lineTo(0.02, -0.38); ctx.lineTo(0.08, -0.26);
  ctx.moveTo(0.1, -0.5); ctx.lineTo(0.24, -0.44);
  ctx.moveTo(-0.52, 0.0); ctx.lineTo(-0.38, 0.06); ctx.lineTo(-0.34, 0.2);
  ctx.moveTo(0.54, 0.0); ctx.lineTo(0.42, 0.1);
  ctx.stroke();
  noGlow(ctx);
  ctx.restore();
}

// ---------- Ondésiens : méduse géante, filaments lumineux ----------

function drawOndesiens(ctx, s) {
  const { t, bot, mouth, blink, accent } = s;
  const sc = 1 + s.breath * 0.035 + mouth * 0.05;
  const cy = -0.3;
  const rx = 0.62 * sc, ry = 0.5 * (2 - sc);
  const rimY = cy + 0.18;

  // Tentacules fins (derrière l'ombrelle)
  ctx.lineCap = 'round';
  for (let i = 0; i < 13; i++) {
    const x0 = (i / 12 - 0.5) * rx * 1.7;
    const ph = i * 1.7;
    ctx.strokeStyle = rgba(accent, 0.22 + 0.15 * hash(i));
    ctx.lineWidth = 0.008 + 0.006 * hash(i + 9);
    ctx.beginPath();
    ctx.moveTo(x0, rimY);
    for (let k = 1; k <= 10; k++) {
      const y = rimY + (bot - rimY) * (k / 10);
      const amp = 0.02 + 0.07 * (k / 10);
      ctx.lineTo(x0 * (1 - 0.15 * k / 10) + Math.sin(t * 1.4 + k * 0.6 + ph) * amp, y);
    }
    ctx.stroke();
  }
  // Bras buccaux, plus épais et frangés
  for (let i = 0; i < 4; i++) {
    const x0 = (i - 1.5) * 0.09;
    ctx.strokeStyle = rgba('#b8f0ff', 0.28);
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.moveTo(x0, rimY - 0.02);
    for (let k = 1; k <= 8; k++) {
      const y = rimY + (bot - rimY) * 0.8 * (k / 8);
      ctx.lineTo(x0 * (1 + k * 0.12) + Math.sin(t * 1.1 + k * 0.8 + i * 2) * 0.05 * (k / 8 + 0.3), y);
    }
    ctx.stroke();
  }
  // Points lumineux qui glissent le long des filaments
  glow(ctx, s, accent, 0.04);
  ctx.fillStyle = rgba('#d8fbff', 0.9);
  for (let i = 0; i < 7; i++) {
    const p = (t * 0.25 + hash(i + 3)) % 1;
    const x0 = (hash(i) - 0.5) * rx * 1.5;
    const y = rimY + (bot - rimY) * p;
    const x = x0 + Math.sin(t * 1.4 + p * 6 + i) * (0.02 + 0.07 * p);
    ctx.globalAlpha = Math.sin(p * Math.PI);
    ctx.beginPath(); ctx.arc(x, y, 0.012, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  noGlow(ctx);

  // Ombrelle translucide au bord festonné
  const bell = () => {
    ctx.beginPath();
    ctx.moveTo(-rx, rimY);
    ctx.bezierCurveTo(-rx, cy - ry * 1.25, rx, cy - ry * 1.25, rx, rimY);
    const n = 8;
    for (let k = n; k > 0; k--) {
      const xa = -rx + (2 * rx) * (k / n), xb = -rx + (2 * rx) * ((k - 1) / n);
      const wav = 0.05 + 0.02 * Math.sin(t * 3 + k);
      ctx.quadraticCurveTo((xa + xb) / 2, rimY + wav, xb, rimY);
    }
    ctx.closePath();
  };
  bell();
  ctx.fillStyle = rad(ctx, 0, cy - 0.1, 0.05, rx * 1.1, [[0, rgba('#c8f6ff', 0.55)], [0.5, rgba(accent, 0.3)], [1, rgba('#1a6f9a', 0.18)]]);
  ctx.fill();
  glow(ctx, s, accent, 0.07);
  ctx.strokeStyle = rgba('#bff4ff', 0.75);
  ctx.lineWidth = 0.016;
  ctx.stroke();
  noGlow(ctx);
  // Nervures radiales
  ctx.strokeStyle = rgba('#e0fbff', 0.18);
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  for (let k = 1; k < 8; k++) {
    const x = -rx + 2 * rx * (k / 8);
    ctx.moveTo(x * 0.25, cy - ry * 0.6);
    ctx.quadraticCurveTo(x * 0.85, cy - ry * 0.35, x, rimY);
  }
  ctx.stroke();
  // Organes internes : quatre lobes et noyau qui pulse avec la voix
  const core = 0.45 + 0.15 * Math.sin(t * 1.3) + 0.55 * mouth;
  ctx.fillStyle = rgba('#9feaff', 0.25 + 0.2 * mouth);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + t * 0.15;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 0.13, cy + Math.sin(a) * 0.06, 0.09, 0.05, a, 0, Math.PI * 2);
    ctx.fill();
  }
  glow(ctx, s, accent, 0.12);
  ctx.fillStyle = rad(ctx, 0, cy, 0, 0.16, [[0, rgba('#ffffff', clamp01(core))], [0.4, rgba(accent, clamp01(core * 0.8))], [1, rgba(accent, 0)]]);
  ctx.beginPath(); ctx.arc(0, cy, 0.16, 0, Math.PI * 2); ctx.fill();
  noGlow(ctx);
  // Anneau d'ondes quand elle parle
  if (mouth > 0.02) {
    ctx.strokeStyle = rgba(accent, 0.6 * mouth);
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.ellipse(0, cy, 0.2 + mouth * 0.22, 0.1 + mouth * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Photophores du bord (s'éteignent en « clignant »)
  glow(ctx, s, accent, 0.05);
  for (let k = 0; k < 11; k++) {
    const u = k / 10;
    const a = Math.PI * (1 + u);
    const x = Math.cos(a) * rx * 0.92;
    const y = rimY - 0.04 + Math.sin(a) * 0.14;
    const lum = (0.5 + 0.5 * Math.sin(t * 2.4 - k * 0.7)) * (1 - blink * 0.85);
    ctx.fillStyle = rgba('#e8fdff', 0.25 + 0.75 * lum);
    ctx.beginPath(); ctx.arc(x, y, 0.016 + 0.008 * lum, 0, Math.PI * 2); ctx.fill();
  }
  noGlow(ctx);
  // Reflet
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(-rx * 0.4, cy - ry * 0.55, 0.16, 0.06, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- Kel-Tirr : petit être à plumes, grands yeux, bec ----------

function drawKeltirr(ctx, s) {
  const { t, bot, mouth, blink } = s;
  const bob = Math.sin(t * 2.2) * 0.012 + s.breath * 0.01;
  const tilt = 0.07 * Math.sin(t * 0.8) + 0.03 * Math.sin(t * 2.9);

  // Collerette de plumes (corps)
  const rows = [[0.36, 0.3, 6], [0.5, 0.46, 8], [0.66, 0.6, 10], [0.84, 0.74, 12], [1.02, 0.86, 14]];
  ctx.fillStyle = '#d8c47a';
  ctx.beginPath();
  ctx.moveTo(-0.3, 0.2); ctx.quadraticCurveTo(-0.8, 0.5, -0.9, bot); ctx.lineTo(0.9, bot); ctx.quadraticCurveTo(0.8, 0.5, 0.3, 0.2);
  ctx.fill();
  for (let r = rows.length - 1; r >= 0; r--) {
    const [y, w, n] = rows[r];
    for (let i = 0; i < n; i++) {
      const x = -w + (2 * w) * (i / (n - 1));
      const sway = Math.sin(t * 1.5 + i + r) * 0.01;
      const yy = Math.min(y, bot) + Math.abs(x) * 0.12;
      ctx.fillStyle = (i + r) % 2 ? '#e6d48a' : '#f4e8b0';
      ctx.strokeStyle = 'rgba(120,95,40,0.45)';
      ctx.lineWidth = 0.01;
      ctx.beginPath();
      ctx.moveTo(x - 0.09, yy - 0.12);
      ctx.quadraticCurveTo(x - 0.08 + sway, yy + 0.1, x + sway, yy + 0.16);
      ctx.quadraticCurveTo(x + 0.08 + sway, yy + 0.1, x + 0.09, yy - 0.12);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  }
  if (bot > 1.05) {
    ctx.fillStyle = '#e6d48a';
    ctx.fillRect(-0.9, 1.1, 1.8, bot - 1.1);
  }

  ctx.save();
  ctx.translate(0, -0.12 + bob);
  ctx.rotate(tilt);
  // Huppe : plumes en éventail qui ondulent
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.32 + Math.sin(t * 2 + i) * 0.05;
    const len = 0.42 + (i === 2 ? 0.14 : (i % 2 ? 0.06 : 0));
    ctx.save();
    ctx.translate(0, -0.3);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = lin(ctx, 0, 0, 0, -len, [[0, '#f0dc80'], [0.7, s.accent], [1, '#ff9a3c']]);
    ctx.beginPath();
    ctx.moveTo(-0.025, 0);
    ctx.quadraticCurveTo(-0.07, -len * 0.6, 0, -len);
    ctx.quadraticCurveTo(0.07, -len * 0.6, 0.025, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,100,30,0.5)';
    ctx.lineWidth = 0.008;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len * 0.95); ctx.stroke();
    ctx.restore();
  }
  // Tête ronde
  ctx.fillStyle = rad(ctx, -0.12, -0.15, 0.05, 0.5, [[0, '#fffbe2'], [0.6, '#f2e4a6'], [1, '#c9b46a']]);
  ctx.beginPath(); ctx.arc(0, 0, 0.42, 0, Math.PI * 2); ctx.fill();
  // Touffes des joues
  ctx.fillStyle = '#f7ecbc';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.34, -0.06);
    ctx.lineTo(side * 0.52, 0.02);
    ctx.lineTo(side * 0.4, 0.08);
    ctx.lineTo(side * 0.5, 0.16);
    ctx.lineTo(side * 0.3, 0.2);
    ctx.closePath();
    ctx.fill();
  }
  // Grands yeux
  for (const side of [-1, 1]) {
    const ex = side * 0.17, ey = -0.04;
    ctx.fillStyle = '#4a3a1a';
    ctx.beginPath(); ctx.ellipse(ex, ey, 0.145, 0.165, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rad(ctx, ex, ey + 0.02, 0.02, 0.14, [[0, '#0c1220'], [0.65, '#1e3550'], [0.9, '#d8a030'], [1, '#6a4a10']]);
    ctx.beginPath(); ctx.ellipse(ex, ey, 0.13, 0.15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(ex - 0.045, ey - 0.06, 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + 0.04, ey + 0.05, 0.014, 0, Math.PI * 2); ctx.fill();
    // Paupière
    if (blink > 0.01) {
      ctx.save();
      ctx.beginPath(); ctx.ellipse(ex, ey, 0.15, 0.17, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#ead98e';
      ctx.fillRect(ex - 0.16, ey - 0.18, 0.32, 0.34 * blink);
      ctx.restore();
    }
  }
  // Bec : la mandibule inférieure s'ouvre
  ctx.fillStyle = '#b8601e';
  poly(ctx, [[-0.05, 0.13], [0.05, 0.13], [0, 0.22 + 0.1 * mouth]]);
  ctx.fill();
  if (mouth > 0.03) {
    ctx.fillStyle = '#5a1a10';
    poly(ctx, [[-0.045, 0.14], [0.045, 0.14], [0, 0.14 + 0.07 * mouth]]);
    ctx.fill();
  }
  ctx.fillStyle = lin(ctx, 0, 0.08, 0, 0.24, [[0, '#ffb24a'], [1, '#d97a22']]);
  poly(ctx, [[-0.075, 0.1], [0.075, 0.1], [0, 0.23 - 0.03 * mouth]]);
  ctx.fill();
  ctx.restore();
}

// ---------- Synodes : champignon en réseau, spores ----------

function drawSynodes(ctx, s) {
  const { t, bot, mouth, blink, accent } = s;
  const b = s.breath * 0.015;

  // Mycélium : réseau de filaments et nœuds lumineux
  const nodes = [];
  for (let i = 0; i < 14; i++) nodes.push([(hash(i) - 0.5) * 1.7, 0.6 + hash(i + 40) * 0.42]);
  ctx.lineWidth = 0.01;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i][0] - nodes[j][0], dy = nodes[i][1] - nodes[j][1];
      const d = Math.hypot(dx, dy);
      if (d > 0.5) continue;
      const pulse = Math.max(0, Math.sin(t * 2 - (nodes[i][0] + nodes[j][0]) * 3));
      ctx.strokeStyle = rgba(accent, 0.15 + 0.35 * pulse + 0.3 * mouth);
      ctx.beginPath(); ctx.moveTo(nodes[i][0], nodes[i][1]); ctx.lineTo(nodes[j][0], nodes[j][1]); ctx.stroke();
    }
  }
  // Masse du pied (épaules mycéliennes)
  ctx.fillStyle = lin(ctx, -0.5, 0, 0.5, 0, [[0, '#cbbfe0'], [0.45, '#9a8ab8'], [1, '#3e3258']]);
  ctx.beginPath();
  ctx.moveTo(-0.18, 0.05);
  ctx.bezierCurveTo(-0.24, 0.4, -0.3, 0.55, -0.85, 0.75);
  ctx.lineTo(-0.95, bot);
  ctx.lineTo(0.95, bot);
  ctx.lineTo(0.85, 0.75);
  ctx.bezierCurveTo(0.3, 0.55, 0.24, 0.4, 0.18, 0.05);
  ctx.closePath();
  ctx.fill();
  // Anneau (voile) sur le pied
  ctx.fillStyle = '#c9bce0';
  ctx.beginPath();
  ctx.moveTo(-0.25, 0.4);
  ctx.quadraticCurveTo(0, 0.46, 0.25, 0.4);
  ctx.lineTo(0.32, 0.5);
  for (let k = 0; k <= 8; k++) ctx.lineTo(0.32 - k * 0.08, 0.52 + (k % 2) * 0.025);
  ctx.closePath();
  ctx.fill();
  // Nœuds lumineux
  glow(ctx, s, accent, 0.05);
  for (let i = 0; i < nodes.length; i++) {
    const lum = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 - nodes[i][0] * 3));
    ctx.fillStyle = rgba('#e6d6ff', lum);
    ctx.beginPath(); ctx.arc(nodes[i][0], nodes[i][1], 0.018, 0, Math.PI * 2); ctx.fill();
  }
  // Yeux sur le pied : trois points qui s'éteignent en clignant
  for (const [x, y, r] of [[-0.08, 0.17, 0.03], [0.08, 0.17, 0.03], [0, 0.25, 0.022]]) {
    ctx.fillStyle = rgba('#f4ecff', 0.95 * (1 - blink) + 0.05);
    ctx.beginPath(); ctx.arc(x, y, r * (1 - 0.6 * blink), 0, Math.PI * 2); ctx.fill();
  }
  // Pore vocal
  ctx.fillStyle = rgba(accent, 0.3 + 0.7 * mouth);
  ctx.beginPath(); ctx.ellipse(0, 0.33, 0.035 + 0.03 * mouth, 0.008 + 0.035 * mouth, 0, 0, Math.PI * 2); ctx.fill();
  noGlow(ctx);

  // Chapeau qui oscille
  ctx.save();
  ctx.translate(0, -0.05 - b);
  ctx.rotate(Math.sin(t * 0.6) * 0.03);
  // Dessous : lamelles qui s'illuminent avec la voix
  ctx.fillStyle = '#2c2142';
  ctx.beginPath(); ctx.ellipse(0, 0, 0.8, 0.12, 0, 0, Math.PI * 2); ctx.fill();
  glow(ctx, s, accent, 0.04 + 0.06 * mouth);
  ctx.lineWidth = 0.01;
  for (let k = 0; k < 22; k++) {
    const a = Math.PI * (k / 21);
    const lum = 0.2 + 0.25 * Math.sin(t * 1.5 + k) + mouth * (0.4 + 0.6 * hash(k + s.syl * 7));
    ctx.strokeStyle = rgba(accent, clamp01(lum));
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 0.16, Math.sin(a) * 0.03 + 0.01);
    ctx.lineTo(Math.cos(a) * 0.76, Math.sin(a) * 0.11);
    ctx.stroke();
  }
  noGlow(ctx);
  // Dôme
  ctx.fillStyle = rad(ctx, -0.2, -0.45, 0.05, 0.95, [[0, '#a68ad8'], [0.55, '#5e4590'], [1, '#2a1d48']]);
  ctx.beginPath();
  ctx.moveTo(-0.82, 0.0);
  ctx.bezierCurveTo(-0.84, -0.5, -0.4, -0.78, 0, -0.78);
  ctx.bezierCurveTo(0.4, -0.78, 0.84, -0.5, 0.82, 0.0);
  ctx.quadraticCurveTo(0, -0.08, -0.82, 0.0);
  ctx.fill();
  // Taches pâles luminescentes
  for (let i = 0; i < 9; i++) {
    const x = (hash(i + 70) - 0.5) * 1.2;
    const y = -0.15 - hash(i + 90) * 0.5 * (1 - Math.abs(x) * 0.7);
    const lum = 0.45 + 0.35 * Math.sin(t * 1.2 + i * 1.3);
    ctx.fillStyle = rgba('#e8dcff', lum);
    ctx.beginPath(); ctx.ellipse(x, y, 0.035 + hash(i) * 0.03, 0.025 + hash(i) * 0.015, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Reflet
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 0.025;
  ctx.beginPath(); ctx.arc(0, -0.05, 0.62, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
  ctx.restore();

  // Spores qui flottent (plus nombreuses quand il parle)
  glow(ctx, s, accent, 0.03);
  const n = 16 + Math.round(10 * s.talk);
  for (let i = 0; i < n; i++) {
    const p = (t * (0.06 + 0.04 * hash(i + 5)) + hash(i)) % 1;
    const x = (hash(i + 20) - 0.5) * 1.8 + Math.sin(t * 0.7 + i) * 0.06;
    const y = 0.1 - p * 1.0;
    ctx.fillStyle = rgba('#efe4ff', Math.sin(p * Math.PI) * 0.8);
    ctx.beginPath(); ctx.arc(x, y, 0.008 + 0.008 * hash(i + 33), 0, Math.PI * 2); ctx.fill();
  }
  noGlow(ctx);
}

// ---------- Orrhaïdes : cristal vivant à facettes ----------

function drawOrrhaides(ctx, s) {
  const { t, bot, mouth, blink, accent } = s;
  const fl = Math.sin(t * 0.8) * 0.02;
  const tones = ['#e8f3ff', '#b8d2ea', '#86a8cc', '#5a7ca6', '#3a5880'];

  // Éclats d'épaules
  const shard = (x, y, len, w, a, tone) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a);
    ctx.fillStyle = tones[tone];
    poly(ctx, [[0, -len], [w, -len * 0.75], [w, 0], [0, 0.06]]); ctx.fill();
    ctx.fillStyle = tones[Math.min(4, tone + 2)];
    poly(ctx, [[0, -len], [-w, -len * 0.75], [-w, 0], [0, 0.06]]); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 0.008;
    ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(0, 0.06); ctx.stroke();
    ctx.restore();
  };
  ctx.fillStyle = lin(ctx, 0, 0.3, 0, 1, [[0, '#6a8cb4'], [1, '#2a3e5c']]);
  poly(ctx, [[-0.9, bot], [-0.7, 0.55], [-0.25, 0.32], [0.25, 0.32], [0.7, 0.55], [0.9, bot]]);
  ctx.fill();
  shard(-0.72, 0.95, 0.6, 0.1, -0.5, 1);
  shard(-0.5, 0.85, 0.45, 0.08, -0.25, 0);
  shard(0.74, 0.95, 0.62, 0.1, 0.48, 1);
  shard(0.52, 0.86, 0.44, 0.08, 0.22, 0);
  shard(-0.92, 1.05, 0.4, 0.08, -0.8, 2);
  shard(0.94, 1.05, 0.4, 0.08, 0.8, 2);
  // Cœur de poitrine qui pulse
  const core = 0.5 + 0.25 * Math.sin(t * 1.4) + 0.5 * mouth;
  glow(ctx, s, accent, 0.1);
  ctx.fillStyle = rgba('#ffffff', clamp01(core));
  poly(ctx, [[0, 0.45], [0.07, 0.58], [0, 0.72], [-0.07, 0.58]]);
  ctx.fill();
  noGlow(ctx);

  // Tête : prisme hexagonal à facettes
  ctx.save();
  ctx.translate(0, fl);
  const P = [[0, -0.88], [0.3, -0.52], [0.32, 0.02], [0, 0.3], [-0.32, 0.02], [-0.3, -0.52]];
  const C = [0.04, -0.32];
  const facetTone = [1, 3, 4, 2, 0, 0];
  for (let i = 0; i < 6; i++) {
    const a = P[i], b = P[(i + 1) % 6];
    ctx.fillStyle = tones[facetTone[i]];
    poly(ctx, [a, b, C]);
    ctx.fill();
  }
  // Arêtes des facettes : s'allument quand il parle
  ctx.lineWidth = 0.012;
  for (let i = 0; i < 6; i++) {
    const lum = 0.3 + mouth * hash(i + s.syl * 11);
    if (lum > 0.5) glow(ctx, s, accent, 0.06); else noGlow(ctx);
    ctx.strokeStyle = rgba('#ffffff', clamp01(lum));
    ctx.beginPath();
    ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(P[(i + 1) % 6][0], P[(i + 1) % 6][1]);
    ctx.moveTo(P[i][0], P[i][1]); ctx.lineTo(C[0], C[1]);
    ctx.stroke();
  }
  noGlow(ctx);
  // Reflet qui balaie le cristal
  ctx.save();
  poly(ctx, P); ctx.clip();
  const g = ((t * 0.3) % 2.6) - 1.3;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  poly(ctx, [[g - 0.1, -1], [g + 0.02, -1], [g + 0.32, 0.4], [g + 0.2, 0.4]]);
  ctx.fill();
  ctx.restore();
  // Yeux : deux fentes lumineuses (clignement = extinction brève)
  ctx.fillStyle = '#1a2a46';
  poly(ctx, [[-0.27, -0.33], [0, -0.3], [0.27, -0.33], [0.24, -0.2], [0, -0.22], [-0.24, -0.2]]);
  ctx.fill();
  const eyeLum = (0.75 + 0.25 * Math.sin(t * 2.1)) * (1 - blink * 0.9);
  glow(ctx, s, accent, 0.07);
  ctx.fillStyle = rgba('#e8f6ff', eyeLum);
  poly(ctx, [[-0.22, -0.3], [-0.06, -0.26], [-0.08, -0.22], [-0.2, -0.24]]); ctx.fill();
  poly(ctx, [[0.22, -0.3], [0.06, -0.26], [0.08, -0.22], [0.2, -0.24]]); ctx.fill();
  // Gemme vocale sous les yeux
  ctx.fillStyle = rgba(accent, 0.25 + 0.75 * mouth);
  poly(ctx, [[0, -0.08], [0.05, 0.0], [0, 0.08 + 0.04 * mouth], [-0.05, 0.0]]);
  ctx.fill();
  noGlow(ctx);
  ctx.restore();

  // Petits éclats flottants autour
  for (let i = 0; i < 5; i++) {
    const a = t * 0.4 + i * 1.256;
    const x = Math.cos(a) * 0.62, y = -0.3 + Math.sin(a) * 0.14;
    ctx.fillStyle = rgba('#e8f4ff', Math.sin(a) > 0 ? 0.9 : 0.4);
    const r = 0.03 + 0.01 * Math.sin(a);
    poly(ctx, [[x, y - r * 1.6], [x + r, y], [x, y + r * 1.6], [x - r, y]]);
    ctx.fill();
  }
}

// ---------- Thrennes : reptile guerrier à six membres ----------

function drawThrennes(ctx, s) {
  const { t, bot, mouth, blink, accent } = s;
  const b = s.breath * 0.016;
  const scaleDark = '#2e2a30';

  // Collerette épineuse derrière la tête (s'évase quand il parle)
  ctx.save();
  ctx.translate(0, -0.22 - b);
  const flare = 1 + 0.08 * s.talk + 0.05 * mouth + 0.02 * Math.sin(t * 1.2);
  const fr = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (1.05 + 0.9 * i / 10);
    const L = (i % 2 ? 0.48 : 0.7) * flare;
    fr.push([Math.cos(a) * L, Math.sin(a) * L * 0.9]);
  }
  fr.push([0.3, 0.2], [-0.3, 0.2]);
  ctx.fillStyle = rad(ctx, 0, 0, 0.1, 0.72, [[0, '#3a1416'], [0.7, '#8a2228'], [1, accent]]);
  poly(ctx, fr); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  for (let i = 0; i <= 10; i += 2) { ctx.moveTo(0, 0); ctx.lineTo(fr[i][0], fr[i][1]); }
  ctx.stroke();
  ctx.restore();

  // Épaules blindées (première paire de membres)
  const shoulder = [[-1.05, bot], [-1.0, 0.45], [-0.8, 0.22], [-0.45, 0.2], [-0.3, 0.45], [-0.3, bot]];
  ctx.fillStyle = lin(ctx, -0.9, 0.2, 0.2, 1, [[0, '#4a3e42'], [1, '#18141a']]);
  ctx.strokeStyle = rgba(accent, 0.8);
  ctx.lineWidth = 0.016;
  for (const p of [shoulder, mirror(shoulder)]) { poly(ctx, p); ctx.fill(); ctx.stroke(); }
  // Cou épais et torse
  ctx.fillStyle = lin(ctx, 0, 0.1, 0, 1, [[0, '#3c3438'], [1, '#1c181e']]);
  poly(ctx, [[-0.22, 0.1], [0.22, 0.1], [0.42, 0.5], [0.4, bot], [-0.4, bot], [-0.42, 0.5]]);
  ctx.fill();
  // Écailles du torse
  ctx.strokeStyle = 'rgba(255,120,120,0.12)';
  ctx.lineWidth = 0.01;
  for (let r = 0; r < 4; r++) {
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(i * 0.1 + (r % 2) * 0.05, 0.42 + r * 0.08, 0.05, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }
  // Seconde paire de bras croisés sur la poitrine
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.strokeStyle = '#3a3036';
    ctx.lineWidth = 0.11;
    ctx.beginPath();
    ctx.moveTo(side * 0.48, 0.62);
    ctx.quadraticCurveTo(side * 0.2, 0.86, -side * 0.24, 0.8 + side * 0.02);
    ctx.stroke();
    ctx.strokeStyle = rgba(accent, 0.55);
    ctx.lineWidth = 0.014;
    ctx.beginPath();
    ctx.moveTo(side * 0.36, 0.72); ctx.lineTo(side * 0.24, 0.8);
    ctx.stroke();
    // Griffes
    ctx.fillStyle = '#d8c8b0';
    for (let k = 0; k < 3; k++) {
      const cx = -side * (0.28 + k * 0.035), cy = 0.76 + k * 0.03 + side * 0.02;
      poly(ctx, [[cx, cy], [cx - side * 0.06, cy + 0.015], [cx, cy + 0.03]]);
      ctx.fill();
    }
  }

  // Tête
  ctx.save();
  ctx.translate(0, -b);
  // Intérieur de la gueule
  ctx.fillStyle = '#5a0e14';
  poly(ctx, [[-0.16, 0.1], [0.16, 0.1], [0.12, 0.22 + mouth * 0.1], [-0.12, 0.22 + mouth * 0.1]]);
  ctx.fill();
  // Mâchoire inférieure qui s'abaisse
  ctx.fillStyle = lin(ctx, 0, 0.1, 0, 0.35, [[0, '#3e3438'], [1, '#221c22']]);
  poly(ctx, [[-0.18, 0.1 + mouth * 0.1], [0.18, 0.1 + mouth * 0.1], [0.11, 0.32 + mouth * 0.1], [-0.11, 0.32 + mouth * 0.1]]);
  ctx.fill();
  // Dents inférieures
  if (mouth > 0.05) {
    ctx.fillStyle = '#e8dcc8';
    for (let k = -2; k <= 2; k++) {
      const x = k * 0.05, y = 0.11 + mouth * 0.1;
      poly(ctx, [[x - 0.015, y], [x + 0.015, y], [x, y - 0.04]]);
      ctx.fill();
    }
  }
  // Crâne et museau
  const head = [[-0.38, -0.42], [-0.22, -0.58], [0.22, -0.58], [0.38, -0.42], [0.33, -0.14], [0.2, 0.08], [0.12, 0.2], [-0.12, 0.2], [-0.2, 0.08], [-0.33, -0.14]];
  ctx.fillStyle = rad(ctx, -0.1, -0.35, 0.05, 0.7, [[0, '#5a4c52'], [0.6, scaleDark], [1, '#141016']]);
  poly(ctx, head); ctx.fill();
  ctx.strokeStyle = '#0c0a0e';
  ctx.lineWidth = 0.014;
  ctx.stroke();
  // Écailles du crâne
  ctx.strokeStyle = 'rgba(255,140,140,0.13)';
  ctx.lineWidth = 0.009;
  for (let r = 0; r < 4; r++) {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * 0.11 + (r % 2) * 0.055, -0.52 + r * 0.075, 0.05, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }
  // Crête rouge centrale et cornes
  ctx.fillStyle = accent;
  poly(ctx, [[0, -0.7], [0.04, -0.56], [0.02, -0.2], [-0.02, -0.2], [-0.04, -0.56]]);
  ctx.fill();
  ctx.fillStyle = '#c8b8a0';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.24, -0.56);
    ctx.quadraticCurveTo(side * 0.42, -0.75, side * 0.56, -0.8);
    ctx.quadraticCurveTo(side * 0.42, -0.62, side * 0.36, -0.46);
    ctx.closePath();
    ctx.fill();
  }
  // Narines
  ctx.fillStyle = '#0a0808';
  ctx.beginPath(); ctx.ellipse(-0.05, 0.12, 0.018, 0.01, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0.05, 0.12, 0.018, 0.01, -0.4, 0, Math.PI * 2); ctx.fill();
  // Dents supérieures
  ctx.fillStyle = '#e8dcc8';
  for (let k = -2; k <= 2; k++) {
    const x = k * 0.05 + 0.025 * Math.sign(k + 0.5);
    poly(ctx, [[x - 0.014, 0.19], [x + 0.014, 0.19], [x, 0.19 + 0.02 + 0.03 * clamp01(mouth * 3)]]);
    ctx.fill();
  }
  // Yeux obliques à pupille fendue
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 0.18, -0.25);
    ctx.rotate(side * 0.35);
    glow(ctx, s, accent, 0.05);
    ctx.fillStyle = '#ffb03a';
    ctx.beginPath(); ctx.ellipse(0, 0, 0.09, 0.045, 0, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = '#100808';
    ctx.beginPath(); ctx.ellipse(0, 0, 0.012, 0.04, 0, 0, Math.PI * 2); ctx.fill();
    // Membrane nictitante
    if (blink > 0.01) {
      ctx.fillStyle = '#3a3034';
      ctx.beginPath(); ctx.ellipse(0, 0, 0.095, 0.05 * blink, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------- Liseurs de Vey : capuche et couronne de glyphes ----------

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

function drawLiseurs(ctx, s) {
  const { t, bot, mouth, blink, accent } = s;
  const b = s.breath * 0.014;
  const crownY = -0.82;
  const glyphs = 10;

  const drawCrown = (front) => {
    ctx.lineCap = 'round';
    for (let i = 0; i < glyphs; i++) {
      const a = t * 0.35 + (i / glyphs) * Math.PI * 2;
      const depth = Math.sin(a);
      if ((depth > 0) !== front) continue;
      const x = Math.cos(a) * 0.5, y = crownY + depth * 0.1 - b;
      const speak = mouth * (0.4 + 0.6 * hash(i + s.syl * 13));
      const lum = clamp01((0.35 + 0.25 * Math.sin(t * 1.3 + i)) * (front ? 1 : 0.5) + speak);
      if (front) glow(ctx, s, accent, 0.04 + 0.04 * speak);
      ctx.strokeStyle = rgba(front ? '#ffe7a0' : accent, lum);
      ctx.lineWidth = front ? 0.014 : 0.01;
      glyph(ctx, x, y, front ? 0.09 : 0.07, i + 1);
      noGlow(ctx);
    }
  };
  drawCrown(false);

  // Robe longiligne aux épaules tombantes
  ctx.fillStyle = lin(ctx, -0.6, 0.2, 0.6, 1, [[0, '#ddd0b2'], [0.5, '#b8a888'], [1, '#7a6c56']]);
  ctx.beginPath();
  ctx.moveTo(-0.2, 0.2);
  ctx.quadraticCurveTo(-0.5, 0.42, -0.72, bot);
  ctx.lineTo(0.72, bot);
  ctx.quadraticCurveTo(0.5, 0.42, 0.2, 0.2);
  ctx.closePath();
  ctx.fill();
  // Étole centrale portant une colonne de glyphes
  ctx.fillStyle = '#5c4630';
  poly(ctx, [[-0.08, 0.3], [0.08, 0.3], [0.1, bot], [-0.1, bot]]);
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.8);
  ctx.lineWidth = 0.01;
  ctx.beginPath();
  ctx.moveTo(-0.08, 0.3); ctx.lineTo(-0.1, bot); ctx.moveTo(0.08, 0.3); ctx.lineTo(0.1, bot);
  ctx.stroke();
  ctx.lineWidth = 0.011;
  for (let k = 0; k < 5; k++) {
    const lum = clamp01(0.35 + 0.3 * Math.sin(t * 1.5 - k) + mouth * hash(k + 50 + s.syl * 3));
    if (lum > 0.6) glow(ctx, s, accent, 0.04);
    ctx.strokeStyle = rgba('#ffe7a0', lum);
    glyph(ctx, 0, 0.4 + k * 0.13, 0.07, k + 20);
    noGlow(ctx);
  }

  ctx.save();
  ctx.translate(0, -b);
  // Capuche pointue
  ctx.fillStyle = lin(ctx, -0.4, -0.9, 0.4, 0.4, [[0, '#e8dcc0'], [0.6, '#b4a282'], [1, '#6e604c']]);
  ctx.beginPath();
  ctx.moveTo(0, -0.98);
  ctx.bezierCurveTo(0.22, -0.8, 0.38, -0.45, 0.36, -0.05);
  ctx.quadraticCurveTo(0.34, 0.22, 0.24, 0.34);
  ctx.lineTo(-0.24, 0.34);
  ctx.quadraticCurveTo(-0.34, 0.22, -0.36, -0.05);
  ctx.bezierCurveTo(-0.38, -0.45, -0.22, -0.8, 0, -0.98);
  ctx.closePath();
  ctx.fill();
  // Liseré doré de la capuche
  ctx.strokeStyle = rgba(accent, 0.85);
  ctx.lineWidth = 0.014;
  ctx.beginPath();
  ctx.moveTo(0, -0.8);
  ctx.bezierCurveTo(0.2, -0.62, 0.26, -0.3, 0.24, 0.06);
  ctx.moveTo(0, -0.8);
  ctx.bezierCurveTo(-0.2, -0.62, -0.26, -0.3, -0.24, 0.06);
  ctx.stroke();
  // Visage sombre et allongé dans l'ombre
  ctx.fillStyle = rad(ctx, 0, -0.25, 0.02, 0.32, [[0, '#3a2c20'], [1, '#120c08']]);
  ctx.beginPath();
  ctx.moveTo(0, -0.74);
  ctx.bezierCurveTo(0.2, -0.6, 0.22, -0.2, 0.16, 0.0);
  ctx.quadraticCurveTo(0.08, 0.2, 0, 0.24);
  ctx.quadraticCurveTo(-0.08, 0.2, -0.16, 0.0);
  ctx.bezierCurveTo(-0.22, -0.2, -0.2, -0.6, 0, -0.74);
  ctx.fill();
  // Glyphe frontal
  glow(ctx, s, accent, 0.05);
  ctx.strokeStyle = rgba('#ffe7a0', 0.6 + 0.4 * Math.sin(t * 0.9));
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(0, -0.56); ctx.lineTo(0, -0.42);
  ctx.moveTo(-0.04, -0.5); ctx.lineTo(0.04, -0.5);
  ctx.stroke();
  // Yeux en amande
  ctx.fillStyle = '#ffe28a';
  for (const side of [-1, 1]) {
    const h = 0.028 * (1 - blink) + 0.003;
    ctx.save();
    ctx.translate(side * 0.085, -0.28);
    ctx.rotate(-side * 0.25);
    ctx.beginPath(); ctx.ellipse(0, 0, 0.055, h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Voix : traits lumineux sous le visage
  const v = 0.15 + mouth;
  ctx.strokeStyle = rgba(accent, clamp01(v));
  ctx.lineWidth = 0.01;
  ctx.beginPath();
  for (let k = -2; k <= 2; k++) {
    const hgt = 0.01 + mouth * 0.05 * (0.4 + 0.6 * hash(k + 7 + s.syl * 5));
    ctx.moveTo(k * 0.025, 0.06 - hgt);
    ctx.lineTo(k * 0.025, 0.06 + hgt);
  }
  ctx.stroke();
  noGlow(ctx);
  ctx.restore();

  drawCrown(true);
}

// ---------- Ashkari : nomade masqué, foulards cuivre ----------

function drawAshkari(ctx, s) {
  const { t, bot, mouth, blink, accent } = s;
  const b = s.breath * 0.015;

  // Brumes de géante gazeuse en arrière-plan
  for (let i = 0; i < 3; i++) {
    const y = -0.6 + i * 0.45;
    const x = Math.sin(t * 0.15 + i * 2) * 0.3;
    ctx.fillStyle = rgba(accent, 0.07);
    ctx.beginPath(); ctx.ellipse(x, y, 0.9, 0.06, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Pan de foulard qui flotte
  ctx.fillStyle = '#9a4a2c';
  ctx.beginPath();
  ctx.moveTo(0.22, 0.3);
  for (let k = 0; k <= 8; k++) {
    const u = k / 8;
    ctx.lineTo(0.22 + u * 0.68, 0.28 + u * 0.12 + Math.sin(t * 3 - u * 4) * 0.04 * u);
  }
  for (let k = 8; k >= 0; k--) {
    const u = k / 8;
    ctx.lineTo(0.22 + u * 0.62, 0.4 + u * 0.18 + Math.sin(t * 3 - u * 4 + 0.5) * 0.04 * u);
  }
  ctx.closePath();
  ctx.fill();
  // Manteau
  ctx.fillStyle = lin(ctx, -0.8, 0.3, 0.8, 1, [[0, '#7a5038'], [1, '#3a2418']]);
  poly(ctx, [[-1.0, bot], [-0.95, 0.6], [-0.6, 0.36], [-0.2, 0.3], [0.2, 0.3], [0.6, 0.36], [0.95, 0.6], [1.0, bot]]);
  ctx.fill();
  // Sangles et boucles
  ctx.strokeStyle = '#2a1a12';
  ctx.lineWidth = 0.05;
  ctx.beginPath(); ctx.moveTo(-0.7, 0.45); ctx.lineTo(0.3, bot); ctx.stroke();
  ctx.fillStyle = '#d9a066';
  ctx.fillRect(-0.32, 0.72, 0.08, 0.06);
  // Tube respiratoire
  ctx.strokeStyle = '#4a3a34';
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(-0.16, 0.14); ctx.bezierCurveTo(-0.3, 0.4, -0.5, 0.45, -0.55, 0.7);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(217,160,102,0.6)';
  ctx.lineWidth = 0.008;
  ctx.setLineDash([0.02, 0.025]);
  ctx.stroke();
  ctx.setLineDash([]);
  // Foulard enroulé autour du cou
  ctx.fillStyle = '#b25a34';
  ctx.beginPath();
  ctx.ellipse(0, 0.3, 0.5, 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,20,10,0.5)';
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.ellipse(0, 0.27, 0.42, 0.08, 0, 0.1, Math.PI - 0.1);
  ctx.ellipse(0, 0.33, 0.46, 0.09, 0, 0.1, Math.PI - 0.1);
  ctx.stroke();

  ctx.save();
  ctx.translate(0, -b);
  // Tête emmaillotée de bandes de tissu
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -0.24, 0.36, 0.44, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#9a6a48';
  ctx.fill();
  ctx.clip();
  const bands = ['#c08a60', '#9a6a48', '#b07850', '#8a5a3c'];
  for (let k = 0; k < 9; k++) {
    ctx.fillStyle = bands[k % 4];
    ctx.save();
    ctx.translate(0, -0.7 + k * 0.11);
    ctx.rotate(((k % 2) ? 0.18 : -0.14));
    ctx.fillRect(-0.5, -0.03, 1, 0.08);
    ctx.restore();
  }
  ctx.fillStyle = rad(ctx, -0.12, -0.4, 0.05, 0.5, [[0, 'rgba(255,220,180,0.25)'], [1, 'rgba(0,0,0,0.35)']]);
  ctx.fillRect(-0.5, -0.8, 1, 1.2);
  ctx.restore();
  // Lunettes : monture cuivre, verres ambrés
  for (const side of [-1, 1]) {
    const x = side * 0.15, y = -0.28;
    ctx.fillStyle = '#2a1e18';
    ctx.beginPath(); ctx.arc(x, y, 0.115, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d9a066';
    ctx.lineWidth = 0.025;
    ctx.stroke();
    const lum = (0.65 + 0.2 * Math.sin(t * 1.1 + side)) * (1 - blink * 0.8);
    glow(ctx, s, accent, 0.06);
    ctx.fillStyle = rad(ctx, x, y, 0.01, 0.09, [[0, rgba('#ffe0b0', lum)], [0.6, rgba('#ff9a40', lum * 0.8)], [1, rgba('#6a2a10', lum)]]);
    ctx.beginPath(); ctx.arc(x, y, 0.085, 0, Math.PI * 2); ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(x - 0.03, y - 0.035, 0.025, 0.012, -0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#d9a066';
  ctx.lineWidth = 0.02;
  ctx.beginPath(); ctx.moveTo(-0.04, -0.28); ctx.lineTo(0.04, -0.28); ctx.stroke();
  // Masque respiratoire
  ctx.fillStyle = lin(ctx, 0, -0.12, 0, 0.2, [[0, '#5a4a44'], [1, '#2a2220']]);
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.12);
  ctx.quadraticCurveTo(0, -0.17, 0.2, -0.12);
  ctx.lineTo(0.16, 0.1);
  ctx.quadraticCurveTo(0, 0.2, -0.16, 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d9a066';
  ctx.lineWidth = 0.012;
  ctx.stroke();
  // Grille : respire au repos, s'illumine avec la voix
  const vent = 0.12 + 0.12 * Math.max(0, s.breath) + mouth * 0.88;
  glow(ctx, s, accent, 0.03 + 0.05 * mouth);
  ctx.lineWidth = 0.014;
  for (let k = 0; k < 4; k++) {
    const y = -0.06 + k * 0.045;
    const w = 0.11 - k * 0.012;
    ctx.strokeStyle = rgba('#ffc890', clamp01(vent * (0.6 + 0.4 * hash(k + s.syl * 3))));
    ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.stroke();
  }
  noGlow(ctx);
  // Cartouches filtrantes
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 0.25, 0.04);
    ctx.rotate(side * 0.5);
    ctx.fillStyle = '#6a5048';
    ctx.fillRect(-0.05, -0.07, 0.1, 0.14);
    ctx.fillStyle = '#d9a066';
    ctx.fillRect(-0.055, -0.075, 0.11, 0.025);
    ctx.fillRect(-0.055, 0.05, 0.11, 0.025);
    ctx.restore();
  }
  ctx.restore();
}

// ---------- Colon de l'Arche : humain en casque de pilote ----------

function drawColon(ctx, s) {
  const { t, bot, mouth, blink, accent } = s;
  const b = s.breath * 0.014;

  // Combinaison
  ctx.fillStyle = lin(ctx, -0.8, 0.3, 0.8, 1, [[0, '#d4d8dc'], [0.6, '#8a9096'], [1, '#4a5056']]);
  ctx.beginPath();
  ctx.moveTo(-1.0, bot);
  ctx.quadraticCurveTo(-0.98, 0.42, -0.5, 0.34);
  ctx.lineTo(0.5, 0.34);
  ctx.quadraticCurveTo(0.98, 0.42, 1.0, bot);
  ctx.closePath();
  ctx.fill();
  // Panneaux et bandes
  ctx.fillStyle = '#5a6066';
  poly(ctx, [[-0.86, 0.6], [-0.56, 0.48], [-0.5, bot], [-0.84, bot]]); ctx.fill();
  poly(ctx, [[0.86, 0.6], [0.56, 0.48], [0.5, bot], [0.84, bot]]); ctx.fill();
  ctx.fillStyle = rgba(accent, 0.8);
  ctx.fillRect(-0.82, 0.66, 0.26, 0.03);
  // Plastron et témoin lumineux
  ctx.fillStyle = '#3a4046';
  poly(ctx, [[-0.22, 0.5], [0.22, 0.5], [0.18, 0.76], [-0.18, 0.76]]);
  ctx.fill();
  glow(ctx, s, accent, 0.05);
  ctx.fillStyle = rgba(accent, 0.5 + 0.4 * Math.sin(t * 1.5));
  ctx.beginPath(); ctx.arc(0.1, 0.6, 0.022, 0, Math.PI * 2); ctx.fill();
  noGlow(ctx);
  ctx.fillStyle = '#9aa0a6';
  ctx.fillRect(-0.15, 0.57, 0.14, 0.02);
  ctx.fillRect(-0.15, 0.62, 0.1, 0.02);
  // Anneau de cou
  ctx.fillStyle = lin(ctx, -0.3, 0, 0.3, 0, [[0, '#6a7076'], [0.4, '#c8ccd0'], [1, '#50565c']]);
  ctx.beginPath(); ctx.ellipse(0, 0.32, 0.34, 0.08, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(0, -b);
  // Modules latéraux du casque (dont la lumière de communication)
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#7a8086';
    ctx.beginPath(); ctx.ellipse(side * 0.45, -0.18, 0.07, 0.15, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Coque du casque
  ctx.fillStyle = rad(ctx, -0.16, -0.42, 0.05, 0.6, [[0, '#ffffff'], [0.5, '#d0d4d8'], [1, '#70767c']]);
  ctx.beginPath(); ctx.arc(0, -0.2, 0.47, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(accent, 0.85);
  ctx.fillRect(-0.03, -0.67, 0.06, 0.16);
  // Visière
  const visor = () => {
    ctx.beginPath();
    ctx.moveTo(-0.37, -0.28);
    ctx.quadraticCurveTo(-0.36, -0.46, 0, -0.47);
    ctx.quadraticCurveTo(0.36, -0.46, 0.37, -0.28);
    ctx.quadraticCurveTo(0.36, 0.0, 0, 0.04);
    ctx.quadraticCurveTo(-0.36, 0.0, -0.37, -0.28);
    ctx.closePath();
  };
  visor();
  ctx.fillStyle = lin(ctx, 0, -0.47, 0, 0.04, [[0, '#0e3a24'], [0.6, '#06180f'], [1, '#0a2a1a']]);
  ctx.fill();
  ctx.strokeStyle = '#3a4046';
  ctx.lineWidth = 0.025;
  ctx.stroke();
  ctx.save();
  visor(); ctx.clip();
  // Visage devinable derrière la visière
  ctx.fillStyle = 'rgba(160,220,180,0.12)';
  ctx.beginPath(); ctx.ellipse(0, -0.2, 0.2, 0.26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba('#d8ffe4', 0.7 * (1 - blink));
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(side * 0.08, -0.24, 0.028, 0.014 * (1 - blink) + 0.002, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Affichage tête haute
  ctx.strokeStyle = rgba(accent, 0.35);
  ctx.lineWidth = 0.008;
  ctx.beginPath();
  ctx.arc(0.2, -0.3, 0.05, 0, Math.PI * 2);
  ctx.moveTo(-0.3, -0.36); ctx.lineTo(-0.18, -0.36);
  ctx.moveTo(-0.3, -0.33); ctx.lineTo(-0.22, -0.33);
  ctx.stroke();
  // Égaliseur vocal
  glow(ctx, s, accent, 0.04);
  ctx.fillStyle = rgba(accent, 0.85);
  for (let k = -3; k <= 3; k++) {
    const hgt = 0.008 + mouth * 0.07 * (0.3 + 0.7 * hash(k + 10 + s.syl * 7)) * (1 - Math.abs(k) * 0.1);
    ctx.fillRect(k * 0.035 - 0.012, -0.07 - hgt, 0.024, hgt * 2);
  }
  noGlow(ctx);
  // Reflets verts
  ctx.strokeStyle = rgba(accent, 0.55);
  ctx.lineWidth = 0.02;
  ctx.beginPath(); ctx.arc(0.05, -0.05, 0.36, Math.PI * 1.15, Math.PI * 1.4); ctx.stroke();
  ctx.fillStyle = 'rgba(220,255,230,0.25)';
  ctx.beginPath(); ctx.ellipse(0.2, -0.38, 0.08, 0.025, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Lumière de communication (clignote quand il parle)
  const com = 0.25 + 0.75 * mouth;
  glow(ctx, s, accent, 0.06 * com);
  ctx.fillStyle = rgba(accent, com);
  ctx.beginPath(); ctx.arc(0.45, -0.2, 0.025, 0, Math.PI * 2); ctx.fill();
  noGlow(ctx);
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
  const s = { t: Math.random() * 100, breath: 0, blink: 0, mouth: 0, talk: 0, syl: 0, px: 1, bot: 1.05, accent: ACCENTS[key] };
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
        if (Math.random() < 0.14) { voiceTarget = 0.05; sylTimer = 0.15 + Math.random() * 0.25; }
        else { voiceTarget = 0.3 + Math.random() * 0.7; sylTimer = 0.07 + Math.random() * 0.13; }
      }
    } else {
      voiceTarget = 0;
    }
    s.mouth += (voiceTarget - s.mouth) * Math.min(1, dt * (speaking ? 18 : 6));
    if (s.mouth < 0.001) s.mouth = 0;
    s.talk += ((speaking ? 1 : 0) - s.talk) * Math.min(1, dt * 3);
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
    s.px = unit;
    s.bot = H / 2 / unit + 0.05;
    ctx.setTransform(unit, 0, 0, unit, W / 2, H / 2);
    // Légère lueur de la couleur de l'espèce derrière le buste
    const halo = 0.16 + 0.04 * s.breath + 0.12 * s.mouth;
    ctx.fillStyle = rad(ctx, 0, -0.2, 0.05, 1.0, [[0, rgba(s.accent, halo)], [1, rgba(s.accent, 0)]]);
    ctx.fillRect(-W / unit, -H / unit, (2 * W) / unit, (2 * H) / unit);
    ctx.save();
    ctx.lineJoin = 'round';
    DRAWERS[key](ctx, s);
    ctx.restore();
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
    },
    destroy,
  };
}
