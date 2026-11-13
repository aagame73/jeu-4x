// Animations de fin de partie, dessinées en direct en Canvas (docs/plan-victoire.md, § 5).
// Étape 4 : un fond commun (poussière d'étoiles à la couleur de l'espèce, qui monte en cas de
// victoire et retombe en cas de défaite). Les scènes propres à chaque espèce viennent à l'étape 5.
import { SPECIES } from './config.js';

const COUNT = 260;

// Démarre l'animation ; renvoie la fonction qui l'arrête.
export function startEndingFx(canvas, speciesKey, result) {
  const ctx = canvas.getContext('2d');
  const color = SPECIES[speciesKey]?.accent ?? '#9fd8ff';
  const won = result === 'victoire';
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motes = Array.from({ length: COUNT }, () => ({ x: Math.random(), y: Math.random(), s: 0.3 + Math.random(), p: Math.random() * 6.28 }));
  const start = performance.now();
  let last = start;
  let raf = 0;
  function frame(now) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - start) / 1000;
    ctx.fillStyle = won ? '#03040c' : '#020205';
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, h * (won ? 0.45 : 0.7), 0, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'transparent');
    ctx.globalAlpha = won ? 0.22 + 0.05 * Math.sin(t * 1.5) : Math.max(0.04, 0.2 * Math.exp(-t * 0.25));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    for (const m of motes) {
      if (!calm) m.y += (won ? -0.05 : 0.025) * m.s * dt;
      if (m.y < 0) m.y += 1;
      if (m.y > 1) m.y -= 1;
      ctx.globalAlpha = (won ? 0.5 : 0.25) + 0.3 * Math.sin(t * 2 + m.p);
      ctx.fillStyle = m.s > 1 ? color : '#ffffff';
      ctx.fillRect(m.x * w, m.y * h, 1 + m.s, 1 + m.s);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
