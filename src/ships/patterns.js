// Motifs peints propres à chaque espèce et jeux de textures (coque, sombre, peinture, soutes, voiles…).
import * as THREE from 'three';
import { shade, rgba, glyph, gray, painter, wrap, rivet, panels, blobs, streaks, scratches, windows, stencil, engraved, veins, finish, cachedSet } from './materials.js';

// --- Motifs propres à chaque espèce ---

// Vaskhar : blindage lourd riveté, grain de roche, coulures de rouille, fentes éclairées.
function paintForteresse(P) {
  const S = P.S;
  blobs(P, 30, '20,12,6', 0.25, 20, 70, 0.15);
  panels(P, { rows: 4, cols: 2, stagger: 0.5, seam: 5, lift: 0.1, shade: 0.09, roughVar: 0.1, rivetR: 2.6, rivetStep: 14, jitter: 0.25 });
  // Plaques de renfort boulonnées par-dessus.
  for (let i = 0; i < 5; i++) {
    const w = P.rng.range(50, 110);
    const h = P.rng.range(30, 60);
    const x = P.rng.range(0, S);
    const y = P.rng.range(0, S);
    wrap(P, x, y, w, h, (X, Y) => {
      P.h.fillStyle = gray(0.72);
      P.h.fillRect(X, Y, w, h);
      P.c.fillStyle = 'rgba(0,0,0,0.12)';
      P.c.fillRect(X, Y, w, h);
      P.c.fillStyle = 'rgba(0,0,0,0.5)';
      P.c.fillRect(X, Y + h, w, 2);
      P.c.fillRect(X + w, Y, 2, h + 2);
    });
    for (const [rx, ry] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]]) rivet(P, x + rx, y + ry, 3);
  }
  streaks(P, 26, '125,52,18', 0.5, [30, 130], [2, 6]);
  streaks(P, 10, '20,14,10', 0.35, [20, 80], [2, 4]);
  scratches(P, 40, 40, 0.25);
  for (let i = 0; i < 5; i++) {
    const x = P.rng.range(20, S - 80);
    const y = P.rng.range(20, S - 20);
    windows(P, x, y, P.rng.int(2, 4), 12, 4, 6, 0.8);
  }
  stencil(P, `VK-${P.rng.int(10, 99)}`, P.rng.range(30, 300), P.rng.range(60, 460), 16, '25,15,8', 0.55);
  stencil(P, `${P.rng.int(100, 999)}`, P.rng.range(30, 300), P.rng.range(60, 460), 11, '25,15,8', 0.45);
}

// Thrennes : acier sombre poli, lames superposées, gravures rouges.
function paintPredateur(P) {
  const S = P.S;
  for (let i = 0; i < 500; i++) {
    const y = P.rng.range(0, S);
    P.c.fillStyle = P.rng.chance(0.5) ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
    P.c.fillRect(0, y, S, 1);
    P.r.fillStyle = P.rng.chance(0.5) ? gray(1, 0.06) : gray(0, 0.06);
    P.r.fillRect(0, y, S, 1);
  }
  // Rangées de lames en écailles obliques : chaque lame recouvre la suivante.
  const rows = 4;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const n = 5;
    const w = S / n;
    const skew = rh * 0.35;
    for (let k = n; k >= 0; k--) {
      const x0 = k * w + (r % 2) * w * 0.5;
      const y0 = r * rh;
      wrap(P, x0, y0 - skew, w * 1.25, rh + skew * 2, (X, Y) => {
        Y += skew;
        const poly = (ctx) => {
          ctx.beginPath();
          ctx.moveTo(X, Y + skew);
          ctx.lineTo(X + w * 1.15, Y);
          ctx.lineTo(X + w * 1.15, Y + rh - 3);
          ctx.lineTo(X, Y + rh + skew - 3);
          ctx.closePath();
        };
        const hg = P.h.createLinearGradient(X, 0, X + w * 1.15, 0);
        hg.addColorStop(0, gray(0.38));
        hg.addColorStop(1, gray(0.68));
        P.h.fillStyle = hg;
        poly(P.h);
        P.h.fill();
        const s = P.rng.range(-0.05, 0.05);
        P.c.fillStyle = s > 0 ? `rgba(255,255,255,${s})` : `rgba(0,0,0,${-s})`;
        poly(P.c);
        P.c.fill();
        // Fil de la lame : arête claire, ombre portée sur la suivante.
        P.c.strokeStyle = 'rgba(255,235,235,0.22)';
        P.c.lineWidth = 1.2;
        P.c.beginPath();
        P.c.moveTo(X + w * 1.15, Y);
        P.c.lineTo(X + w * 1.15, Y + rh - 3);
        P.c.stroke();
        P.c.strokeStyle = 'rgba(0,0,0,0.55)';
        P.c.lineWidth = 3;
        P.c.beginPath();
        P.c.moveTo(X, Y + rh + skew - 2);
        P.c.lineTo(X + w * 1.15, Y + rh - 2);
        P.c.stroke();
        P.r.fillStyle = gray(P.rng.range(0.18, 0.34));
        poly(P.r);
        P.r.fill();
      });
    }
  }
  scratches(P, 30, 50, 0.18);
  // Marques de victoires gravées, qui rougeoient.
  for (let g = 0; g < 3; g++) {
    const x = P.rng.range(10, S - 40);
    const y = P.rng.range(10, S - 30);
    const marks = P.rng.int(3, 6);
    for (const [ctx, style, lw] of [[P.h, gray(0.2), 2.5], [P.c, 'rgba(90,10,10,0.9)', 2], [P.e, gray(1, 0.9), 1.5]]) {
      ctx.strokeStyle = style;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let i = 0; i < marks; i++) {
        ctx.moveTo(x + i * 5, y);
        ctx.lineTo(x + i * 5 - 2, y + 16);
      }
      if (marks >= 5) {
        ctx.moveTo(x - 3, y + 13);
        ctx.lineTo(x + marks * 5, y + 3);
      }
      ctx.stroke();
    }
  }
  stencil(P, `Ʌ${P.rng.int(10, 99)}`, P.rng.range(40, 380), P.rng.range(60, 470), 14, '120,20,20', 0.6);
  for (let i = 0; i < 3; i++) windows(P, P.rng.range(20, S - 60), P.rng.range(20, S - 20), 3, 8, 3, 5, 0.6);
}

// Kel-Tirr : tuiles de céramique lisse, joints fins, liserés et inscriptions.
function paintAiguille(P, stripe) {
  const S = P.S;
  const n = 16;
  const t = S / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = i * t + (j % 2) * t * 0.5;
      const y = j * t;
      const s = P.rng.range(-0.035, 0.035) - (P.rng.chance(0.05) ? 0.08 : 0);
      wrap(P, x, y, t, t, (X, Y) => {
        P.c.fillStyle = s > 0 ? `rgba(255,255,255,${s})` : `rgba(40,35,30,${-s})`;
        P.c.fillRect(X, Y, t, t);
        const hg = P.h.createRadialGradient(X + t / 2, Y + t / 2, 0, X + t / 2, Y + t / 2, t * 0.7);
        hg.addColorStop(0, gray(0.56));
        hg.addColorStop(1, gray(0.5));
        P.h.fillStyle = hg;
        P.h.fillRect(X, Y, t, t);
        P.h.fillStyle = gray(0.36);
        P.h.fillRect(X, Y, t, 1.2);
        P.h.fillRect(X, Y, 1.2, t);
        P.c.fillStyle = 'rgba(60,55,45,0.28)';
        P.c.fillRect(X, Y, t, 1);
        P.c.fillRect(X, Y, 1, t);
        P.r.fillStyle = gray(P.rng.range(0.4, 0.55));
        P.r.fillRect(X + 1, Y + 1, t - 1, t - 1);
      });
    }
  }
  // Grandes trappes de service.
  for (let i = 0; i < 3; i++) {
    const x = Math.round(P.rng.range(0, S) / t) * t;
    const y = Math.round(P.rng.range(0, S) / t) * t;
    const w = t * P.rng.int(2, 4);
    const h = t * P.rng.int(2, 3);
    wrap(P, x, y, w, h, (X, Y) => {
      P.h.strokeStyle = gray(0.3);
      P.h.lineWidth = 2;
      P.h.strokeRect(X + 1, Y + 1, w - 2, h - 2);
      P.c.strokeStyle = 'rgba(50,45,40,0.5)';
      P.c.lineWidth = 1.2;
      P.c.strokeRect(X + 1, Y + 1, w - 2, h - 2);
    });
  }
  // Liserés peints et flèches.
  const sc = `${Math.round(stripe.r * 255)},${Math.round(stripe.g * 255)},${Math.round(stripe.b * 255)}`;
  const y0 = Math.round(P.rng.range(0.25, 0.7) * S);
  P.c.fillStyle = `rgba(${sc},0.95)`;
  P.c.fillRect(0, y0, S, 6);
  P.c.fillRect(0, y0 + 10, S, 2);
  P.r.fillStyle = gray(0.3);
  P.r.fillRect(0, y0, S, 12);
  P.e.fillStyle = gray(1, 0.18);
  P.e.fillRect(0, y0 + 1, S, 4);
  for (let x = 16; x < S; x += 64) {
    P.c.beginPath();
    P.c.moveTo(x, y0 + 18);
    P.c.lineTo(x + 10, y0 + 24);
    P.c.lineTo(x, y0 + 30);
    P.c.fill();
  }
  stencil(P, `KT ${P.rng.int(100, 999)}`, P.rng.range(20, 300), y0 - 12, 15, '40,40,48', 0.7);
  stencil(P, 'NE PAS MARCHER', P.rng.range(20, 300), P.rng.range(40, 480), 9, '60,58,60', 0.5, 'sans-serif');
  windows(P, P.rng.range(30, 200), P.rng.range(60, 200), 6, 9, 6, 7, 0.85);
  blobs(P, 12, '70,60,50', 0.08, 30, 90, 0.08);
  streaks(P, 8, '80,70,60', 0.12, [40, 120], [3, 8]);
}

// Ondésiens : membrane nervurée, cellules et veines luminescentes.
function paintMeduse(P) {
  const S = P.S;
  const ribs = 12;
  for (let i = 0; i < ribs; i++) {
    const x = (i / ribs) * S;
    const amp = P.rng.range(4, 10);
    const ph = P.rng.range(0, Math.PI * 2);
    for (const [ctx, style, w] of [[P.h, gray(0.62, 0.6), 12], [P.h, gray(0.78), 4], [P.c, 'rgba(255,255,255,0.12)', 6], [P.c, 'rgba(0,30,40,0.25)', 1], [P.r, gray(0, 0.15), 6]]) {
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      for (const dx of [-S, 0, S]) {
        ctx.beginPath();
        for (let y = 0; y <= S; y += 8) {
          const X = x + dx + Math.sin((y / S) * Math.PI * 4 + ph) * amp;
          y ? ctx.lineTo(X, y) : ctx.moveTo(X, y);
        }
        ctx.stroke();
      }
    }
  }
  for (let i = 0; i < 160; i++) {
    const x = P.rng.range(0, S);
    const y = P.rng.range(0, S);
    const r = P.rng.range(6, 20);
    wrap(P, x - r, y - r, r * 2, r * 2, (X, Y) => {
      X += r;
      Y += r;
      const g = P.h.createRadialGradient(X, Y, 0, X, Y, r);
      g.addColorStop(0, gray(0.58, 0.8));
      g.addColorStop(0.8, gray(0.5, 0.3));
      g.addColorStop(1, gray(0.42, 0.6));
      P.h.fillStyle = g;
      P.h.beginPath();
      P.h.arc(X, Y, r, 0, Math.PI * 2);
      P.h.fill();
      const c = P.c.createRadialGradient(X, Y, 0, X, Y, r);
      c.addColorStop(0, 'rgba(255,255,255,0.14)');
      c.addColorStop(1, 'rgba(0,25,35,0.16)');
      P.c.fillStyle = c;
      P.c.beginPath();
      P.c.arc(X, Y, r, 0, Math.PI * 2);
      P.c.fill();
    });
  }
  for (let i = 0; i < 7; i++) {
    veins(P, [[P.e, gray(1, 0.85), 1], [P.c, 'rgba(220,255,255,0.35)', 1.5], [P.h, gray(0.66), 2]], P.rng.range(0, S), P.rng.range(0, S), P.rng.range(0, Math.PI * 2), 40, 1.8);
  }
  for (let i = 0; i < 60; i++) {
    const x = P.rng.range(0, S);
    const y = P.rng.range(0, S);
    P.e.fillStyle = gray(1, P.rng.range(0.4, 1));
    P.e.beginPath();
    P.e.arc(x, y, P.rng.range(0.8, 2), 0, Math.PI * 2);
    P.e.fill();
  }
}

// Synodes : chitine organique — plaques bombées irrégulières qui se chevauchent, pores, filaments lumineux.
function paintGrappe(P) {
  const S = P.S;
  const plates = [];
  for (let i = 0; i < 260; i++) plates.push([P.rng.range(0, S), P.rng.range(0, S), P.rng.range(10, 30), P.rng.range(0.6, 1), P.rng.range(-0.6, 0.6)]);
  plates.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r, sy, rot] of plates) {
    const s = P.rng.range(-0.07, 0.07);
    const rough = P.rng.range(0.16, 0.34);
    wrap(P, x - r, y - r, r * 2, r * 2, (X, Y) => {
      const cx = X + r;
      const cy = Y + r;
      const shape = (ctx) => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * sy, rot, 0, Math.PI * 2);
      };
      const hg = P.h.createRadialGradient(cx, cy - r * 0.2, 0, cx, cy, r);
      hg.addColorStop(0, gray(0.72));
      hg.addColorStop(0.75, gray(0.6));
      hg.addColorStop(1, gray(0.42));
      P.h.fillStyle = hg;
      shape(P.h);
      P.h.fill();
      const cg = P.c.createRadialGradient(cx, cy - r * 0.25, 0, cx, cy, r);
      cg.addColorStop(0, s > 0 ? `rgba(255,240,255,${0.1 + s})` : 'rgba(255,240,255,0.06)');
      cg.addColorStop(0.8, s < 0 ? `rgba(0,0,0,${-s})` : 'rgba(0,0,0,0)');
      cg.addColorStop(1, 'rgba(25,5,35,0.35)');
      P.c.fillStyle = cg;
      shape(P.c);
      P.c.fill();
      P.r.fillStyle = gray(rough);
      shape(P.r);
      P.r.fill();
    });
  }
  blobs(P, 40, '25,5,35', 0.3, 4, 14, 0.2);
  for (let i = 0; i < 400; i++) {
    const x = P.rng.range(0, S);
    const y = P.rng.range(0, S);
    const r = P.rng.range(0.6, 1.6);
    P.h.fillStyle = gray(0.28);
    P.c.fillStyle = 'rgba(20,5,25,0.55)';
    for (const ctx of [P.h, P.c]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i < 6; i++) {
    veins(P, [[P.e, gray(1, 0.9), 1], [P.c, 'rgba(230,200,255,0.4)', 1.4], [P.h, gray(0.62), 1.6]], P.rng.range(0, S), P.rng.range(0, S), P.rng.range(0, Math.PI * 2), 30, 1.6);
  }
}

// Orrhaïdes : facettes de cristal inclinées, fêlures lumineuses.
function paintCristal(P) {
  const S = P.S;
  const n = 7;
  const cell = S / n;
  const jit = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) jit.push([P.rng.range(-0.35, 0.35), P.rng.range(-0.35, 0.35)]);
  const pt = (i, j) => {
    const [jx, jy] = jit[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
    return [(i + jx) * cell, (j + jy) * cell];
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + 1, j + 1);
      const d = pt(i, j + 1);
      const tris = (i + j) % 2 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      for (const tri of tris) {
        const ang = P.rng.range(0, Math.PI * 2);
        const tilt = P.rng.range(0.05, 0.22);
        const s = P.rng.range(-0.12, 0.16);
        const rough = P.rng.range(0.02, 0.14);
        for (const [dx, dy] of [[0, 0], [-S, 0], [0, -S], [-S, -S]]) {
          const path = (ctx) => {
            ctx.beginPath();
            tri.forEach(([x, y], k) => (k ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
            ctx.closePath();
          };
          const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3 + dx;
          const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3 + dy;
          const g = P.h.createLinearGradient(cx - Math.cos(ang) * cell, cy - Math.sin(ang) * cell, cx + Math.cos(ang) * cell, cy + Math.sin(ang) * cell);
          g.addColorStop(0, gray(0.5 - tilt));
          g.addColorStop(1, gray(0.5 + tilt));
          P.h.fillStyle = g;
          path(P.h);
          P.h.fill();
          P.c.fillStyle = s > 0 ? `rgba(255,255,255,${s})` : `rgba(40,70,120,${-s})`;
          path(P.c);
          P.c.fill();
          P.c.strokeStyle = 'rgba(255,255,255,0.35)';
          P.c.lineWidth = 1;
          P.c.stroke();
          P.r.fillStyle = gray(rough);
          path(P.r);
          P.r.fill();
        }
      }
    }
  }
  for (let i = 0; i < 10; i++) {
    let x = P.rng.range(0, S);
    let y = P.rng.range(0, S);
    const pts = [[x, y]];
    for (let k = 0; k < 6; k++) {
      x += P.rng.range(-30, 30);
      y += P.rng.range(-30, 30);
      pts.push([x, y]);
    }
    for (const [ctx, style, w] of [[P.c, 'rgba(255,255,255,0.7)', 1], [P.e, gray(1, 0.9), 1.2], [P.h, gray(0.3), 1.5]]) {
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    }
  }
  blobs(P, 14, '200,230,255', 0.18, 10, 40);
}

// Liseurs : or brossé, plaques fines, bandeaux de glyphes gravés qui luisent.
function paintVoilier(P) {
  const S = P.S;
  for (let i = 0; i < 700; i++) {
    const y = P.rng.range(0, S);
    const a = P.rng.range(0.02, 0.07);
    P.c.fillStyle = P.rng.chance(0.5) ? `rgba(255,245,210,${a})` : `rgba(60,40,10,${a})`;
    P.c.fillRect(0, y, S, 1);
    P.r.fillStyle = P.rng.chance(0.5) ? gray(1, 0.08) : gray(0, 0.08);
    P.r.fillRect(0, y, S, 1);
  }
  panels(P, { rows: 2, cols: 3, stagger: 0.5, seam: 2, lift: 0.03, shade: 0.04, roughVar: 0.05 });
  const bands = 2;
  for (let b = 0; b < bands; b++) {
    const y = b * (S / bands) + P.rng.range(30, 120);
    P.h.fillStyle = gray(0.42);
    P.h.fillRect(0, y - 8, S, 36);
    P.c.fillStyle = 'rgba(60,35,5,0.3)';
    P.c.fillRect(0, y - 8, S, 36);
    P.c.fillStyle = 'rgba(255,230,160,0.25)';
    P.c.fillRect(0, y + 28, S, 1.5);
    P.r.fillStyle = gray(0.45, 0.6);
    P.r.fillRect(0, y - 8, S, 36);
    for (let x = 6; x < S - 20; x += 24) engraved(P, x, y, 18, 0.95);
  }
  blobs(P, 14, '40,25,5', 0.18, 20, 60, 0.12);
  scratches(P, 18, 30, 0.2);
  windows(P, P.rng.range(40, 300), P.rng.range(20, 60), 5, 6, 10, 8, 0.8);
}

// Ashkari : cuivre ondulé, patine vert-de-gris, joints rivetés, pochoirs et bandes de danger.
function paintCaravane(P) {
  const S = P.S;
  const period = 16;
  for (let x = 0; x < S; x++) {
    const s = Math.sin((x / period) * Math.PI * 2);
    P.h.fillStyle = gray(0.5 + s * 0.16);
    P.h.fillRect(x, 0, 1, S);
    P.c.fillStyle = s > 0 ? `rgba(255,220,180,${s * 0.1})` : `rgba(30,10,0,${-s * 0.14})`;
    P.c.fillRect(x, 0, 1, S);
  }
  for (let y = 0; y < S; y += 128) {
    P.h.fillStyle = gray(0.62);
    P.h.fillRect(0, y, S, 14);
    P.c.fillStyle = 'rgba(40,20,5,0.35)';
    P.c.fillRect(0, y, S, 14);
    P.c.fillStyle = 'rgba(0,0,0,0.5)';
    P.c.fillRect(0, y + 14, S, 2);
    for (let x = 8; x < S; x += 16) rivet(P, x, y + 7, 2.4);
  }
  streaks(P, 30, '30,60,50', 0.35, [30, 110], [2, 6]);
  blobs(P, 30, '20,10,0', 0.3, 15, 50, 0.2);
  scratches(P, 30, 35, 0.3);
  // Bande de danger.
  const hy = Math.round(P.rng.range(0.55, 0.8) * S);
  P.c.save();
  P.c.beginPath();
  P.c.rect(0, hy, S, 20);
  P.c.clip();
  for (let x = -40; x < S + 40; x += 32) {
    P.c.fillStyle = 'rgba(214,160,40,0.9)';
    P.c.beginPath();
    P.c.moveTo(x, hy + 20);
    P.c.lineTo(x + 16, hy + 20);
    P.c.lineTo(x + 36, hy);
    P.c.lineTo(x + 20, hy);
    P.c.fill();
  }
  P.c.restore();
  P.m.fillStyle = gray(0.2);
  P.m.fillRect(0, hy, S, 20);
  P.r.fillStyle = gray(0.55);
  P.r.fillRect(0, hy, S, 20);
  stencil(P, `${P.rng.int(10, 99)}`, P.rng.range(40, 300), P.rng.range(200, 300), 54, '25,12,4', 0.55);
  stencil(P, `ASK-${P.rng.int(100, 999)}`, P.rng.range(30, 300), P.rng.range(40, 100), 15, '25,12,4', 0.6);
  for (let i = 0; i < 3; i++) windows(P, P.rng.range(20, S - 80), P.rng.range(330, 480), 4, 8, 6, 6, 0.75);
}

// Voile tissée des Liseurs : trame, nervures, colonnes de glyphes (UV 0..1 sur toute la voile).
function paintSail(P) {
  const S = P.S;
  const g = P.c.createLinearGradient(0, 0, S, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0.12)');
  P.c.fillStyle = g;
  P.c.fillRect(0, 0, S, S);
  const t = 4;
  for (let y = 0; y < S; y += t) {
    for (let x = 0; x < S; x += t) {
      const over = ((x + y) / t) % 2;
      P.h.fillStyle = gray(over ? 0.6 : 0.42);
      if (over) P.h.fillRect(x, y + 0.5, t, t - 1);
      else P.h.fillRect(x + 0.5, y, t - 1, t);
      P.c.fillStyle = over ? 'rgba(255,240,200,0.06)' : 'rgba(60,40,10,0.08)';
      P.c.fillRect(x, y, t, t);
    }
  }
  const ribs = P.rng.int(5, 7);
  for (let i = 0; i <= ribs; i++) {
    const y = (i / ribs) * S;
    for (const [ctx, style, w] of [[P.h, gray(0.75), 6], [P.c, 'rgba(90,60,15,0.6)', 3], [P.e, gray(1, 0.25), 2], [P.m, gray(0.8), 4], [P.r, gray(0.35), 4]]) {
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(S * 0.5, y + 12, S, y - 36);
      ctx.stroke();
    }
  }
  const cols = 3;
  for (let k = 0; k < cols; k++) {
    const x = 50 + k * 70 + P.rng.range(0, 30);
    for (let y = 20; y < S - 30; y += 28) {
      P.c.strokeStyle = 'rgba(110,70,10,0.85)';
      P.c.lineWidth = 2.2;
      P.e.strokeStyle = gray(1);
      P.e.lineWidth = 2;
      glyph(P.rng, [P.c, P.e], x, y, 18);
    }
  }
  blobs(P, 10, '50,30,5', 0.15, 30, 80, 0.1);
}

// Coque sombre commune : mécanique, grilles d'aération, tuyaux, boulons (neutre, teintée par la couleur).
function paintDark(P) {
  const S = P.S;
  panels(P, { rows: 4, cols: 4, stagger: 0.25, seam: 2, lift: 0.04, shade: 0.07, roughVar: 0.1, rivetR: 1.4, rivetStep: 8, jitter: 0.3 });
  for (let v = 0; v < 4; v++) {
    const x = P.rng.range(0, S - 50);
    const y = P.rng.range(0, S - 30);
    const w = P.rng.range(24, 50);
    for (let k = 0; k < 6; k++) {
      P.h.fillStyle = gray(0.28);
      P.h.fillRect(x, y + k * 5, w, 2.5);
      P.c.fillStyle = 'rgba(0,0,0,0.6)';
      P.c.fillRect(x, y + k * 5, w, 2.5);
    }
  }
  for (let p = 0; p < 3; p++) {
    const y = P.rng.range(0, S);
    const g = P.h.createLinearGradient(0, y, 0, y + 8);
    g.addColorStop(0, gray(0.5));
    g.addColorStop(0.5, gray(0.8));
    g.addColorStop(1, gray(0.5));
    P.h.fillStyle = g;
    P.h.fillRect(0, y, S, 8);
    P.c.fillStyle = 'rgba(255,255,255,0.08)';
    P.c.fillRect(0, y + 2, S, 2);
  }
  blobs(P, 16, '0,0,0', 0.3, 10, 40, 0.15);
  scratches(P, 20, 20, 0.2);
}

// Peinture écaillée (pièces de couleur vive) : métal nu dans les éclats.
function paintChipped(P) {
  panels(P, { rows: 2, cols: 2, seam: 2, lift: 0.03, shade: 0.04 });
  for (let i = 0; i < 70; i++) {
    const x = P.rng.range(0, P.S);
    const y = P.rng.range(0, P.S);
    const r = P.rng.range(1, 4);
    P.c.fillStyle = 'rgba(120,120,125,0.9)';
    P.c.beginPath();
    P.c.ellipse(x, y, r * 1.6, r, P.rng.range(0, 3), 0, Math.PI * 2);
    P.c.fill();
    P.m.fillStyle = gray(0.9);
    P.m.fill();
    P.h.fillStyle = gray(0.4);
    P.h.fill();
  }
  blobs(P, 10, '0,0,0', 0.25, 10, 30, 0.1);
}

// Conteneur (UV ajustées à chaque face) : cadre, tôle ondulée, pochoir.
function paintContainer(P) {
  const S = P.S;
  for (let x = 0; x < S; x++) {
    const s = Math.sin((x / 10) * Math.PI * 2);
    P.h.fillStyle = gray(0.5 + s * 0.12);
    P.h.fillRect(x, 0, 1, S);
    P.c.fillStyle = s > 0 ? `rgba(255,230,200,${s * 0.08})` : `rgba(20,8,0,${-s * 0.12})`;
    P.c.fillRect(x, 0, 1, S);
  }
  const f = 14;
  P.h.fillStyle = gray(0.75);
  for (const [x, y, w, h] of [[0, 0, S, f], [0, S - f, S, f], [0, 0, f, S], [S - f, 0, f, S]]) P.h.fillRect(x, y, w, h);
  P.c.fillStyle = 'rgba(30,18,8,0.55)';
  for (const [x, y, w, h] of [[0, 0, S, f], [0, S - f, S, f], [0, 0, f, S], [S - f, 0, f, S]]) P.c.fillRect(x, y, w, h);
  P.c.strokeStyle = 'rgba(0,0,0,0.6)';
  P.c.lineWidth = 2;
  P.c.strokeRect(f, f, S - f * 2, S - f * 2);
  for (const [x, y] of [[f / 2, f / 2], [S - f / 2, f / 2], [f / 2, S - f / 2], [S - f / 2, S - f / 2]]) rivet(P, x, y, 3);
  stencil(P, `${P.rng.int(10, 99)}`, 40, 150, 70, '20,10,4', 0.5);
  stencil(P, `ASK ${P.rng.int(1000, 9999)}`, 30, 60, 18, '20,10,4', 0.6);
  streaks(P, 12, '35,70,60', 0.3, [20, 80], [2, 5]);
  blobs(P, 14, '20,10,0', 0.3, 10, 40, 0.2);
  scratches(P, 14, 25, 0.25);
}

// Radiateur : ailettes de cuivre.
function paintRadiator(P) {
  const S = P.S;
  for (let y = 0; y < S; y += 8) {
    const g = P.h.createLinearGradient(0, y, 0, y + 8);
    g.addColorStop(0, gray(0.3));
    g.addColorStop(0.4, gray(0.8));
    g.addColorStop(1, gray(0.3));
    P.h.fillStyle = g;
    P.h.fillRect(0, y, S, 8);
    P.c.fillStyle = 'rgba(255,200,150,0.18)';
    P.c.fillRect(0, y + 2, S, 2);
    P.c.fillStyle = 'rgba(0,0,0,0.45)';
    P.c.fillRect(0, y + 6, S, 2);
  }
  blobs(P, 10, '10,5,0', 0.3, 10, 40, 0.15);
}

// Réglages par archétype : teinte de base peinte, rugosité, métal, finition.
const SURFACES = {
  forteresse: { paint: paintForteresse, rough: 0.74, metal: 0.4, finish: { grain: 0.2, speck: 0.08, roughGrain: 0.2, heightGrain: 0.12, normal: 3 }, normalScale: 1.1 },
  predateur: { paint: paintPredateur, rough: 0.3, metal: 0.9, finish: { grain: 0.07, roughGrain: 0.1, heightGrain: 0.03, normal: 3 }, normalScale: 1 },
  aiguille: { paint: paintAiguille, rough: 0.5, metal: 0.03, finish: { grain: 0.05, speck: 0.03, roughGrain: 0.08, heightGrain: 0.02, normal: 2.5 }, normalScale: 0.8 },
  meduse: { paint: paintMeduse, rough: 0.22, metal: 0, finish: { grain: 0.1, roughGrain: 0.1, heightGrain: 0.04, normal: 2.5, blur: 1.2 }, normalScale: 1 },
  grappe: { paint: paintGrappe, rough: 0.28, metal: 0.12, finish: { grain: 0.12, roughGrain: 0.1, heightGrain: 0.04, normal: 3 }, normalScale: 1 },
  cristal: { paint: paintCristal, rough: 0.06, metal: 0.1, finish: { grain: 0.06, speck: 0.02, roughGrain: 0.04, heightGrain: 0.01, normal: 4, blur: 0.4 }, normalScale: 1 },
  voilier: { paint: paintVoilier, rough: 0.38, metal: 0.45, finish: { grain: 0.08, roughGrain: 0.1, heightGrain: 0.02, normal: 3 }, normalScale: 1 },
  caravane: { paint: paintCaravane, rough: 0.38, metal: 0.85, finish: { grain: 0.12, roughGrain: 0.14, heightGrain: 0.05, normal: 3, patina: { color: new THREE.Color('#4f9a86'), threshold: 0.6, soft: 0.08, amount: 0.7 } }, normalScale: 1 },
};

export function hullSet(archetype, base, stripe) {
  return cachedSet(`coque|${archetype}|${base.getHexString()}`, () => {
    const s = SURFACES[archetype];
    const P = painter(512, 1000 + Object.keys(SURFACES).indexOf(archetype) * 77, base, s.rough, s.metal);
    s.paint(P, stripe);
    const set = finish(P, { ...s.finish, normalScale: s.normalScale });
    set.base = base.clone();
    return set;
  });
}

export const DARK_BASE = new THREE.Color('#6a6e76');
export const PAINT_BASE = new THREE.Color('#d0d0d0');
export const CONTAINER_BASE = new THREE.Color('#b07850');
export const SAIL_BASE = new THREE.Color('#d9b870');
const RADIATOR_BASE = new THREE.Color('#8a5a38');
export function darkSet() {
  return cachedSet('sombre', () => Object.assign(finish(paintThen(painter(256, 31, DARK_BASE, 0.45, 0.85), paintDark), { grain: 0.1, roughGrain: 0.12, heightGrain: 0.03, normal: 2.5, noEmit: true }), { base: DARK_BASE }));
}
export function paintSet() {
  return cachedSet('peinture', () => Object.assign(finish(paintThen(painter(256, 32, PAINT_BASE, 0.42, 0.2), paintChipped), { grain: 0.06, roughGrain: 0.1, normal: 2, noEmit: true }), { base: PAINT_BASE }));
}
export function containerSet() {
  return cachedSet('conteneur', () => Object.assign(finish(paintThen(painter(256, 33, CONTAINER_BASE, 0.4, 0.8), paintContainer), { grain: 0.12, roughGrain: 0.14, normal: 2.5, noEmit: true, patina: { color: new THREE.Color('#4f9a86'), threshold: 0.6, soft: 0.08, amount: 0.6 } }), { base: CONTAINER_BASE }));
}
export function sailSet() {
  return cachedSet('voile', () => Object.assign(finish(paintThen(painter(512, 34, SAIL_BASE, 0.7, 0.25), paintSail), { grain: 0.06, roughGrain: 0.08, normal: 2, blur: 0.4 }), { base: SAIL_BASE }));
}
export function radiatorSet() {
  return cachedSet('radiateur', () => Object.assign(finish(paintThen(painter(128, 35, RADIATOR_BASE, 0.4, 0.8), paintRadiator), { grain: 0.1, normal: 2.5, noEmit: true }), { base: RADIATOR_BASE }));
}
function paintThen(P, fn) {
  fn(P);
  return P;
}
