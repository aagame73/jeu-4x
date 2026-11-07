// Premier contact : cinématique plein écran calculée en direct (aucun fichier vidéo). Le jeu est
// en pause pendant qu'elle couvre l'écran ; un clic ou une touche la passe. Le conseiller
// annonce aussi le contact par le journal.
import { createAlienPortrait } from './aliens.js';
import { rivalInfo } from './species.js';

const DURATION_MS = 9000;
const SPEAK_FROM_MS = 1800;
const SPEAK_UNTIL_MS = 7600;
const FADE_MS = 700;
const STAR_COUNT = 420;

// Étoiles qui filent depuis le centre, à la couleur de l'empire ; elles ralentissent à l'arrivée.
function startWarp(canvas, color) {
  const ctx = canvas.getContext('2d');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stars = Array.from({ length: STAR_COUNT }, () => ({ a: Math.random() * Math.PI * 2, d: Math.random(), s: 0.4 + Math.random() }));
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
    const speed = calm ? 0 : 0.06 + 1.5 * Math.exp(-t * 1.1);
    const reach = Math.hypot(w, h) / 2;
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, reach * 0.8);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.28 + 0.06 * Math.sin(t * 2);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = 'round';
    for (const star of stars) {
      star.d += speed * star.s * dt;
      if (star.d > 1) star.d -= 1;
      const r0 = star.d * star.d * reach;
      const r1 = r0 * (1 + speed * 0.5) + 1;
      ctx.globalAlpha = Math.min(1, star.d * 2);
      ctx.strokeStyle = star.s > 1 ? color : '#ffffff';
      ctx.lineWidth = 0.6 + star.d * 1.6;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(star.a) * r0, h / 2 + Math.sin(star.a) * r0);
      ctx.lineTo(w / 2 + Math.cos(star.a) * r1, h / 2 + Math.sin(star.a) * r1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

// onEnd : appelé quand toutes les cinématiques en attente sont finies.
export function createContactView(game, onEnd) {
  let current = null;
  let resumeTo = null; // état de la pause à rétablir

  function finish() {
    if (!current || current.closing) return;
    current.closing = true;
    current.timers.forEach(clearTimeout);
    current.el.classList.remove('visible');
    setTimeout(() => {
      const { el, portrait, stopWarp } = current;
      stopWarp();
      portrait.destroy();
      el.remove();
      window.removeEventListener('keydown', onKey, true);
      current = null;
      if (game.contacts.length) showNext();
      else {
        game.paused = resumeTo;
        resumeTo = null;
        onEnd();
      }
    }, FADE_MS);
  }

  // La cinématique garde le clavier : aucun raccourci du jeu ne passe dessous.
  function onKey(e) {
    // Les commandes du navigateur et du système restent libres (F5, F12, Alt+Tab, Ctrl+R…).
    if (e.ctrlKey || e.altKey || e.metaKey || /^(F\d+|Alt|Control|Shift|Meta|Tab)$/.test(e.key)) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (!e.repeat) finish();
  }

  function showNext() {
    if (current) return;
    const species = game.contacts.shift();
    if (!species) return;
    if (resumeTo === null) resumeTo = game.paused;
    game.paused = true;
    const rival = rivalInfo(species);
    const el = document.createElement('div');
    el.className = 'contact';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `Premier contact : ${rival.empire}`);
    el.style.setProperty('--empire', rival.accent);
    el.innerHTML = `
      <canvas class="contact-warp"></canvas>
      <div class="contact-band top"></div>
      <div class="contact-stage">
        <canvas class="contact-portrait"></canvas>
        <div class="contact-text">
          <span class="contact-kicker">Premier contact</span>
          <strong>${rival.empire}</strong>
          <span class="contact-species">${rival.label}</span>
          <p>${rival.lore}</p>
        </div>
      </div>
      <div class="contact-band bottom"><span>Cliquez ou appuyez sur une touche pour passer</span></div>`;
    document.body.append(el);
    const portrait = createAlienPortrait(el.querySelector('.contact-portrait'), species);
    const stopWarp = startWarp(el.querySelector('.contact-warp'), rival.accent);
    el.addEventListener('click', finish);
    window.addEventListener('keydown', onKey, true);
    current = {
      el,
      portrait,
      stopWarp,
      closing: false,
      timers: [
        setTimeout(() => portrait.setSpeaking(true), SPEAK_FROM_MS),
        setTimeout(() => portrait.setSpeaking(false), SPEAK_UNTIL_MS),
        setTimeout(finish, DURATION_MS),
      ],
    };
    requestAnimationFrame(() => el.classList.add('visible'));
  }

  return { update: showNext };
}
