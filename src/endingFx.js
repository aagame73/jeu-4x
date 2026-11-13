// Animations de fin de partie, dessinées en direct en Canvas, sans fichier (docs/plan-victoire.md, § 5).
// Une scène par espèce, en version victoire (lumière, élan) ou défaite (sombre, ralentie). La scène se
// déroule sur environ DURATION secondes puis reste vivante en boucle douce derrière le bilan.
import { SPECIES } from './config.js';

const DURATION = 12;
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

// Fond commun : nuit, lueur à la couleur de l'espèce (qui monte en victoire, s'éteint en défaite),
// poussière d'étoiles.
function backdrop(ctx, w, h, t, color, won, stars) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = won ? '#03040c' : '#020205';
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h * (won ? 0.42 : 0.75), 0, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'transparent');
  ctx.globalAlpha = won ? 0.12 + 0.12 * ease(t / 6) + 0.03 * Math.sin(t * 1.5) : Math.max(0.03, 0.18 * Math.exp(-t * 0.2));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  for (const s of stars) {
    ctx.globalAlpha = (won ? 0.5 : 0.3) * (0.5 + 0.5 * Math.sin(t * 1.3 + s.p));
    ctx.fillRect(s.x * w, s.y * h, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

// Petit nuage de particules (braises, poussière, éclats) : vitesse, gravité, durée de vie.
function particles() {
  const list = [];
  return {
    add(p) {
      list.push({ life: 1, age: 0, g: 0, size: 2, ...p });
    },
    draw(ctx, dt) {
      for (const p of [...list]) {
        p.age += dt;
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = 1 - p.age / p.life;
        if (k <= 0) {
          list.splice(list.indexOf(p), 1);
          continue;
        }
        ctx.globalAlpha = k * (p.alpha ?? 1);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Les scènes. Chacune reçoit { ctx, w, h, t, dt, won, color, s } ; s garde son état entre deux images.

// Vaskhar : une cité creusée dans le basalte. Victoire : ses fenêtres s'allument, des braises montent.
// Défaite : la roche se fissure et s'effondre, la poussière retombe.
function vaskhar({ ctx, w, h, t, dt, won, s }) {
  if (!s.ready) {
    s.ready = true;
    s.ridge = Array.from({ length: 24 }, (_, i) => ({ x: i / 23, y: rand(0.62, 0.8) }));
    s.windows = Array.from({ length: 70 }, () => ({ x: rand(0.03, 0.97), y: rand(0.8, 0.97), on: rand(0, DURATION * 0.7) }));
    s.cracks = Array.from({ length: 7 }, () => ({ x: rand(0.1, 0.9), start: rand(0, 6), path: Array.from({ length: 6 }, () => rand(-0.03, 0.03)) }));
    s.fx = particles();
    s.next = 0;
  }
  const fall = won ? 0 : ease((t - 4) / 7) * h * 0.25;
  ctx.fillStyle = '#17110e';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (const p of s.ridge) ctx.lineTo(p.x * w, p.y * h + fall * (0.5 + Math.sin(p.x * 9) * 0.5));
  ctx.lineTo(w, h);
  ctx.fill();
  for (const win of s.windows) {
    const lit = won ? t > win.on : t < win.on * 0.6;
    if (!lit) continue;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + win.on);
    ctx.fillStyle = '#ff9a3c';
    ctx.fillRect(win.x * w, win.y * h + fall * 0.6, 4, 6);
  }
  ctx.globalAlpha = 1;
  if (!won) {
    ctx.strokeStyle = '#ff5a2a';
    ctx.lineWidth = 1.5;
    for (const c of s.cracks) {
      const k = ease((t - c.start) / 3);
      if (k <= 0) continue;
      ctx.globalAlpha = 0.7 * (1 - ease((t - c.start - 5) / 4));
      ctx.beginPath();
      let x = c.x * w;
      ctx.moveTo(x, h * 0.7);
      c.path.forEach((dx, i) => {
        if (i / c.path.length > k) return;
        x += dx * w;
        ctx.lineTo(x, h * (0.7 + (i + 1) * 0.05));
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  s.next -= dt;
  if (s.next <= 0) {
    s.next = won ? 0.03 : 0.08;
    if (won) {
      const chip = Math.random() < 0.25; // éclat de roche, plus lourd, qui retombe
      s.fx.add({ x: rand(0, w), y: h * rand(0.75, 0.95), vx: rand(-10, 10), vy: chip ? rand(-140, -90) : rand(-90, -40), g: chip ? 70 : 0, life: rand(2, 4), color: chip ? '#8a7666' : Math.random() < 0.5 ? '#ffb347' : '#ff6a2a', size: chip ? rand(3, 5) : rand(1.5, 3) });
    }
    else if (t > 3) s.fx.add({ x: rand(0, w), y: h * rand(0.55, 0.7), vx: rand(-8, 8), vy: rand(0, 20), g: 60, life: rand(2, 4), color: '#6b5a4e', size: rand(2, 5) });
  }
  s.fx.draw(ctx, dt);
}

// Ondésiens : des méduses. Victoire : elles montent en spirale, leurs filaments s'allument un à un.
// Défaite : les filaments s'éteignent, les méduses coulent vers le fond.
function ondesiens({ ctx, w, h, t, won, color, s }) {
  if (!s.ready) {
    s.ready = true;
    s.jelly = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * TAU, r: rand(0.15, 0.38), size: rand(18, 38), y: rand(0.2, 0.9), light: rand(0.5, DURATION * 0.6) }));
  }
  for (const j of s.jelly) {
    const a = j.a + t * (won ? 0.25 : 0.05);
    const x = w / 2 + Math.cos(a) * j.r * w;
    const y = won ? ((j.y - t * 0.035) % 1.2 + 1.2) % 1.2 * h - 0.1 * h : Math.min(h + 60, j.y * h + ease(t / DURATION) * h * 0.5);
    const lit = won ? ease((t - j.light) / 1.5) : 1 - ease((t - j.light * 0.5) / 2);
    const pulse = 1 + 0.08 * Math.sin(t * 2.4 + j.a * 3);
    ctx.globalAlpha = 0.25 + 0.55 * lit;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      const x0 = x + (k - 2) * j.size * 0.25;
      ctx.moveTo(x0, y);
      for (let d = 1; d <= 10; d++) ctx.lineTo(x0 + Math.sin(t * 2 + d * 0.6 + k) * 4, y + d * j.size * 0.22);
      ctx.stroke();
    }
    const bell = ctx.createRadialGradient(x, y - j.size * 0.2, 1, x, y, j.size * pulse);
    bell.addColorStop(0, `rgba(255,255,255,${0.2 + 0.6 * lit})`);
    bell.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.4 + 0.6 * lit;
    ctx.fillStyle = bell;
    ctx.beginPath();
    ctx.ellipse(x, y, j.size * pulse, j.size * 0.7 * pulse, 0, Math.PI, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Kel-Tirr : un essaim de plumes. Victoire : il tourbillonne puis dessine une étoile.
// Défaite : l'essaim se disperse au vent, quelques plumes tombent.
function keltirr({ ctx, w, h, t, won, color, s }) {
  if (!s.ready) {
    s.ready = true;
    s.birds = Array.from({ length: 180 }, (_, i) => {
      // Point d'arrivée sur le contour d'une étoile à cinq branches.
      const k = i / 180;
      const branch = Math.floor(k * 10);
      const f = k * 10 - branch;
      const r1 = branch % 2 ? 0.12 : 0.3;
      const r2 = branch % 2 ? 0.3 : 0.12;
      const a1 = (branch / 10) * TAU - Math.PI / 2;
      const a2 = ((branch + 1) / 10) * TAU - Math.PI / 2;
      return {
        a: rand(0, TAU), r: rand(0.1, 0.4), v: rand(0.6, 1.4), rot: rand(0, TAU),
        sx: Math.cos(a1) * r1 * (1 - f) + Math.cos(a2) * r2 * f,
        sy: Math.sin(a1) * r1 * (1 - f) + Math.sin(a2) * r2 * f,
        drop: Math.random() < 0.15,
      };
    });
  }
  const m = Math.min(w, h);
  for (const b of s.birds) {
    const a = b.a + t * b.v * (won ? 1.2 : 0.6);
    let x = w / 2 + Math.cos(a) * b.r * m;
    let y = h / 2 + Math.sin(a) * b.r * m * 0.6;
    if (won) {
      const k = ease((t - 4) / 5);
      x += (w / 2 + b.sx * m - x) * k;
      y += (h / 2 + b.sy * m - y) * k;
    } else {
      const k = ease((t - 2) / 8);
      x += (b.drop ? 0 : 1.6 * w) * k * b.v;
      y += (b.drop ? h * 0.6 : -0.2 * h) * k;
    }
    const a2 = b.rot + t * (b.drop && !won ? 2 : 4);
    ctx.setTransform(Math.cos(a2), Math.sin(a2), -Math.sin(a2), Math.cos(a2), x, y);
    ctx.globalAlpha = won ? 0.85 : 0.6 * (1 - ease((t - 8) / 4)) + 0.2;
    ctx.fillStyle = b.v > 1 ? color : '#fff6d8';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 1.6, 0, 0, TAU);
    ctx.fill();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}

// Synodes : un réseau de filaments. Victoire : il s'étend, chaque nœud s'allume depuis le centre.
// Défaite : le réseau se coupe, les nœuds s'éteignent un à un.
function synodes({ ctx, w, h, t, won, color, s }) {
  if (!s.ready) {
    s.ready = true;
    s.nodes = Array.from({ length: 70 }, () => ({ x: rand(0.04, 0.96), y: rand(0.06, 0.94) }));
    for (const n of s.nodes) n.d = Math.hypot(n.x - 0.5, (n.y - 0.5) * 0.7);
    s.edges = [];
    s.nodes.forEach((n, i) => {
      const near = s.nodes.map((m, j) => [Math.hypot(m.x - n.x, m.y - n.y), j]).sort((a, b) => a[0] - b[0]).slice(1, 4);
      for (const [, j] of near) if (j > i) s.edges.push({ a: n, b: s.nodes[j], cut: rand(1, DURATION - 2) });
    });
  }
  const front = won ? ease(t / 9) * 0.75 : 1;
  ctx.lineWidth = 1;
  for (const e of s.edges) {
    const on = won ? Math.max(e.a.d, e.b.d) < front : t < e.cut;
    ctx.globalAlpha = on ? 0.55 : won ? 0.07 : 0.1 * (1 - ease((t - e.cut) / 2));
    ctx.strokeStyle = on ? color : '#4a4a5a';
    ctx.beginPath();
    ctx.moveTo(e.a.x * w, e.a.y * h);
    ctx.lineTo(e.b.x * w, e.b.y * h);
    ctx.stroke();
    // Impulsion qui court le long d'un filament allumé.
    if (on && won) {
      const k = (t * 0.6 + e.cut) % 1;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(e.a.x * w + (e.b.x - e.a.x) * w * k - 1, e.a.y * h + (e.b.y - e.a.y) * h * k - 1, 2.5, 2.5);
    }
  }
  for (const n of s.nodes) {
    const on = won ? n.d < front : t < DURATION * (1 - n.d);
    const r = on ? 4 + Math.sin(t * 3 + n.x * 20) : 2;
    ctx.globalAlpha = on ? 0.95 : 0.25;
    ctx.fillStyle = on ? color : '#3a3a48';
    ctx.beginPath();
    ctx.arc(n.x * w, n.y * h, r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Orrhaïdes : des cristaux. Victoire : ils poussent et chantent (un anneau de lumière à chaque note).
// Défaite : ils se fêlent et perdent leur éclat.
function orrhaides({ ctx, w, h, t, dt, won, color, s }) {
  if (!s.ready) {
    s.ready = true;
    s.crystals = Array.from({ length: 13 }, () => ({ x: rand(0.03, 0.97), hgt: rand(0.12, 0.38), wid: rand(14, 34), tilt: rand(-0.25, 0.25), note: rand(0, 3), crack: rand(2, 8) }));
    s.rings = [];
    s.fx = particles();
  }
  for (const c of s.crystals) {
    const grow = won ? ease((t - c.note * 0.5) / 4) : 1;
    const top = h - c.hgt * h * grow;
    const x = c.x * w;
    const tipX = x + Math.sin(c.tilt) * c.hgt * h * grow;
    const shine = won ? 0.75 + 0.25 * Math.sin(t * 2 + c.note) : Math.max(0.15, 0.8 - ease((t - c.crack) / 3) * 0.65);
    const g = ctx.createLinearGradient(x, h, tipX, top);
    g.addColorStop(0, 'rgba(40,50,70,0.9)');
    g.addColorStop(1, won ? color : '#8a95a8');
    ctx.globalAlpha = shine;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - c.wid / 2, h);
    ctx.lineTo(tipX - c.wid / 3, top + c.wid * 0.6);
    ctx.lineTo(tipX, top);
    ctx.lineTo(tipX + c.wid / 3, top + c.wid * 0.6);
    ctx.lineTo(x + c.wid / 2, h);
    ctx.fill();
    if (won && grow > 0.95 && (t + c.note * 2) % 3 < dt) s.rings.push({ x: tipX, y: top, age: 0 });
    if (!won && t > c.crack) {
      const k = ease((t - c.crack) / 2);
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#1a1e28';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tipX, top + 4);
      ctx.lineTo(tipX - 6, top + (h - top) * 0.3 * k);
      ctx.lineTo(tipX + 4, top + (h - top) * 0.6 * k);
      ctx.stroke();
      if (dt > 0 && Math.random() < 0.03) s.fx.add({ x: tipX, y: top + 10, vx: rand(-20, 20), vy: rand(-10, 10), g: 120, life: 2, color: '#b8c4d8', size: rand(2, 4) });
    }
  }
  for (const r of [...s.rings]) {
    r.age += dt;
    if (r.age > 2.5) s.rings.splice(s.rings.indexOf(r), 1);
    ctx.globalAlpha = 0.6 * (1 - r.age / 2.5);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 6 + r.age * 90, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  s.fx.draw(ctx, dt);
}

// Thrennes : une coque de guerre. Victoire : elle se grave de traits rouges, un par victoire.
// Défaite : les gravures s'effacent, la coque se brise en deux.
function thrennes({ ctx, w, h, t, dt, won, s }) {
  if (!s.ready) {
    s.ready = true;
    s.marks = Array.from({ length: 28 }, (_, i) => ({ x: 0.14 + (i % 14) * 0.052 + (i % 5 === 4 ? 0.01 : 0), row: Math.floor(i / 14), at: 0.8 + i * 0.32 }));
    s.fx = particles();
  }
  const split = won ? 0 : ease((t - 7) / 4);
  const top = h * 0.68;
  // Tant que la coque est entière, une seule passe ; brisée, chaque moitié est dessinée à part.
  for (const half of split > 0 ? [0, 1] : [null]) {
    ctx.save();
    if (half !== null) {
      const dir = half ? 1 : -1;
      ctx.translate(dir * split * w * 0.05, split * h * 0.06);
      ctx.rotate(dir * split * 0.05);
      ctx.beginPath();
      if (half === 0) ctx.rect(0, top, w * 0.52, h - top);
      else ctx.rect(w * 0.52, top, w * 0.48, h - top);
      ctx.clip();
    }
    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, '#3e3438');
    g.addColorStop(1, '#17131a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * 0.04, h);
    ctx.lineTo(w * 0.1, top);
    ctx.lineTo(w * 0.9, top);
    ctx.lineTo(w * 0.96, h);
    ctx.fill();
    for (const m of s.marks) {
      const cut = won ? ease((t - m.at) / 0.25) : 1 - ease((t - m.at * 0.3) / 2);
      if (cut <= 0) continue;
      const x = m.x * w;
      const y = top + h * (0.05 + m.row * 0.12);
      ctx.strokeStyle = '#ff4030';
      // Lueur : un trait large et transparent sous le trait fin (moins coûteux qu'un flou).
      for (const [width, alpha] of [[9, 0.18], [3, 1]]) {
        ctx.globalAlpha = cut * alpha;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (m.x * 100 % 3) - 1.5, y + h * 0.08 * cut);
        ctx.stroke();
      }
      if (won && Math.abs(t - m.at) < dt * 1.5) for (let k = 0; k < 8; k++) s.fx.add({ x, y, vx: rand(-60, 60), vy: rand(-80, -10), g: 160, life: 0.8, color: '#ffb070', size: 2 });
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  s.fx.draw(ctx, dt);
}

// Liseurs de Vey : les glyphes des Veilleurs. Victoire : ils s'assemblent en une grande figure.
// Défaite : ils se défont et retombent en poussière.
function liseurs({ ctx, w, h, t, won, color, s }) {
  if (!s.ready) {
    s.ready = true;
    s.glyphs = Array.from({ length: 84 }, (_, i) => {
      const ring = i < 12 ? 0 : i < 36 ? 1 : 2;
      const inRing = ring === 0 ? i : ring === 1 ? i - 12 : i - 36;
      const count = [12, 24, 48][ring];
      return {
        x: rand(0, 1), y: rand(0, 1),
        a: (inRing / count) * TAU, r: [0.1, 0.2, 0.32][ring],
        strokes: Array.from({ length: 3 }, () => [rand(-6, 6), rand(-6, 6), rand(-6, 6), rand(-6, 6)]),
        fall: rand(0.2, 1),
      };
    });
  }
  const m = Math.min(w, h);
  const k = won ? ease((t - 1) / 7) : 1;
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = won ? '#ffd27a' : color;
  for (const g of s.glyphs) {
    const a = g.a + t * 0.08 * (g.r > 0.25 ? -1 : 1);
    const fx = w / 2 + Math.cos(a) * g.r * m;
    const fy = h / 2 + Math.sin(a) * g.r * m;
    let x = won ? g.x * w + (fx - g.x * w) * k : fx;
    let y = won ? g.y * h + (fy - g.y * h) * k : fy;
    let alpha = won ? 0.4 + 0.6 * k : 1;
    if (!won) {
      const d = ease((t - 2 * g.fall) / 6);
      y += d * h * 0.7 * g.fall;
      x += Math.sin(t + g.a) * 10 * d;
      alpha = 1 - d;
    }
    ctx.globalAlpha = alpha * (0.7 + 0.3 * Math.sin(t * 2 + g.a * 5));
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of g.strokes) {
      ctx.moveTo(x + x1, y + y1);
      ctx.lineTo(x + x2, y + y2);
    }
    ctx.stroke();
  }
  if (won && k > 0.9) {
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 2);
    ctx.beginPath();
    for (const r of [0.1, 0.2, 0.32]) ctx.arc(w / 2, h / 2, r * m, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Ashkari : une caravane de voiles devant une géante gazeuse. Victoire : au lever du soleil.
// Défaite : les voiles se déchirent, la caravane dérive dans la nuit.
function ashkari({ ctx, w, h, t, won, color, s }) {
  if (!s.ready) {
    s.ready = true;
    s.ships = Array.from({ length: 9 }, (_, i) => ({ x: -0.1 - i * 0.07, y: 0.25 + (i % 3) * 0.08 + rand(-0.02, 0.02), size: rand(10, 18), tear: rand(2, 7) }));
  }
  // Soleil qui se lève derrière la géante (victoire), ou nuit.
  const sunY = won ? h * (0.95 - 0.4 * ease(t / 9)) : h * 1.3;
  const sun = ctx.createRadialGradient(w * 0.7, sunY, 0, w * 0.7, sunY, h * 0.6);
  sun.addColorStop(0, 'rgba(255,220,140,0.9)');
  sun.addColorStop(1, 'transparent');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  // Géante gazeuse, à bandes.
  const R = Math.max(w, h) * 0.45;
  const cx = w * 0.62;
  const cy = h + R * 0.35;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 2 ? (won ? '#b88a52' : '#3b2c20') : won ? '#d8b078' : '#4a382a';
    ctx.fillRect(cx - R, cy - R + (i / 14) * 2 * R + Math.sin(t * 0.3 + i) * 3, 2 * R, (2 * R) / 14 + 1);
  }
  ctx.restore();
  for (const sh of s.ships) {
    const x = (((sh.x + t * (won ? 0.06 : 0.015)) % 1.3) + 1.3) % 1.3 * w - 0.15 * w;
    const y = sh.y * h + (won ? Math.sin(t + sh.x * 9) * 4 : ease((t - sh.tear) / 6) * h * 0.2);
    const torn = won ? 0 : ease((t - sh.tear) / 2);
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(x - sh.size, y + sh.size * 0.9, sh.size * 2, 3);
    ctx.globalAlpha = won ? 0.95 : 0.8 - torn * 0.5;
    ctx.fillStyle = won ? '#f2e2b8' : '#9a8a70';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      const off = side * torn * 8;
      ctx.moveTo(x + off, y + torn * side * 4);
      ctx.lineTo(x + side * sh.size + off, y + sh.size * 0.9);
      ctx.lineTo(x + off, y + sh.size * 0.9);
      ctx.fill();
    }
    // Lanterne de bord : elle s'éteint dans la défaite.
    ctx.globalAlpha = won ? 0.9 : Math.max(0, 1 - torn * 1.5);
    ctx.fillStyle = color;
    ctx.fillRect(x - 1, y + sh.size * 0.9 - 4, 3, 3);
    ctx.globalAlpha = 1;
  }
}

// Colons de l'Arche : l'Arche. Victoire : réparée, elle saute vers les étoiles.
// Défaite : elle dérive, ses lumières s'éteignent.
function arche({ ctx, w, h, t, dt, won, color, s }) {
  if (!s.ready) {
    s.ready = true;
    s.lights = Array.from({ length: 16 }, (_, i) => ({ x: -0.8 + (i / 15) * 1.5, y: i % 2 ? -0.12 : 0.12, off: rand(1, 9) }));
    s.streaks = Array.from({ length: 140 }, () => ({ a: rand(0, TAU), d: rand(0, 1), s: rand(0.5, 1.5) }));
  }
  const jump = won ? ease((t - 6) / 2.5) : 0;
  // Traînées de saut.
  if (won && t > 5) {
    const speed = ease((t - 5) / 3);
    ctx.strokeStyle = color;
    for (const st of s.streaks) {
      st.d = (st.d + speed * st.s * 0.6 * dt) % 1;
      const r0 = st.d * st.d * Math.hypot(w, h) * 0.6;
      ctx.globalAlpha = Math.min(1, st.d * 2) * speed;
      ctx.beginPath();
      ctx.moveTo(w * 0.6 + Math.cos(st.a) * r0, h * 0.62 + Math.sin(st.a) * r0);
      ctx.lineTo(w * 0.6 + Math.cos(st.a) * r0 * (1 + speed * 0.3), h * 0.62 + Math.sin(st.a) * r0 * (1 + speed * 0.3));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const size = Math.min(w, h) * 0.22 * (1 - jump * 0.97);
  ctx.save();
  ctx.translate(w * 0.6 + (won ? 0 : t * 6), h * 0.62 + (won ? 0 : t * 3));
  ctx.rotate(won ? -0.08 : -0.08 + t * 0.03);
  ctx.globalAlpha = 1 - (won ? ease((t - 8) / 1) : 0);
  ctx.fillStyle = '#3a4050';
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(size * 0.5, -size * 0.18);
  ctx.lineTo(-size * 0.9, -size * 0.2);
  ctx.lineTo(-size, 0);
  ctx.lineTo(-size * 0.9, size * 0.2);
  ctx.lineTo(size * 0.5, size * 0.18);
  ctx.closePath();
  ctx.fill();
  // Moteurs : ils montent en puissance, ou crachotent.
  const sputter = dt > 0 && Math.random() < 0.3 ? 0.2 : 1; // les moteurs crachotent
  const thrust = won ? 0.4 + 0.6 * ease((t - 2) / 4) : Math.max(0, 0.6 - t * 0.06) * sputter;
  const flame = ctx.createRadialGradient(-size, 0, 0, -size, 0, size * 0.5 * (0.3 + thrust));
  flame.addColorStop(0, '#ffffff');
  flame.addColorStop(0.4, color);
  flame.addColorStop(1, 'transparent');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.arc(-size, 0, size * 0.5 * (0.3 + thrust), 0, TAU);
  ctx.fill();
  for (const l of s.lights) {
    const on = won || t < l.off;
    ctx.globalAlpha = on ? 0.6 + 0.4 * Math.sin(t * 4 + l.off) : 0.08;
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(l.x * size, l.y * size, 3, 3);
  }
  ctx.restore();
  // Éclair du saut.
  if (won && t > 8 && t < 9.5) {
    ctx.globalAlpha = 1 - (t - 8) / 1.5;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalAlpha = 1;
}

export const ENDING_SCENES = { vaskhar, ondesiens, keltirr, synodes, orrhaides, thrennes, liseurs, ashkari, 'sans-espece': arche };

// Démarre l'animation de fin de cette espèce ; renvoie la fonction qui l'arrête.
export function startEndingFx(canvas, speciesKey, result) {
  const ctx = canvas.getContext('2d');
  const color = SPECIES[speciesKey]?.accent ?? '#9fd8ff';
  const won = result === 'victoire';
  const scene = ENDING_SCENES[speciesKey] ?? arche;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stars = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), r: rand(0.6, 1.8), p: rand(0, TAU) }));
  const fit = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  // Mouvement réduit demandé : la scène est jouée d'un coup jusqu'à son état final, puis figée
  // (redessinée seulement si la fenêtre change de taille).
  if (calm) {
    const still = () => {
      fit();
      const state = {};
      for (let t = 0; t <= DURATION; t += 0.1) {
        backdrop(ctx, canvas.width, canvas.height, t, color, won, stars);
        scene({ ctx, w: canvas.width, h: canvas.height, t, dt: 0.1, won, color, s: state });
      }
    };
    still();
    window.addEventListener('resize', still);
    return () => window.removeEventListener('resize', still);
  }
  const state = {};
  const start = performance.now();
  let last = start;
  let raf = 0;
  function frame(now) {
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) fit();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - start) / 1000;
    backdrop(ctx, canvas.width, canvas.height, t, color, won, stars);
    scene({ ctx, w: canvas.width, h: canvas.height, t, dt, won, color, s: state });
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
