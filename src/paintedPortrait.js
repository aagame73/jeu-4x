// Portraits peints des espèces (images de Gemini, public/portraits/<espèce>.jpg, préparées par
// docs/outils/portraits.py), avec une animation légère : respiration lente, lueur à la couleur de
// l'espèce qui pulse avec les syllabes quand le conseiller parle, particules propres à chaque espèce.
// Même interface que les portraits dessinés (aliens.js) : setSpeaking, setSpecies, destroy.

// Espèces dont le portrait peint existe ; les autres gardent le portrait dessiné.
export const PAINTED = new Set(['vaskhar', 'ondesiens', 'keltirr', 'synodes', 'orrhaides', 'thrennes', 'liseurs', 'ashkari', 'sans-espece']);

// Particules : couleur, nombre, vitesse verticale (négative = elles montent), taille, scintillement.
const PARTICLES = {
  vaskhar: { color: '255,140,50', count: 14, vy: -0.16, size: 0.012, twinkle: 0.5 }, // braises
  thrennes: { color: '255,90,60', count: 12, vy: -0.13, size: 0.011, twinkle: 0.5 }, // braises des braseros
  ondesiens: { color: '150,235,255', count: 18, vy: -0.04, size: 0.008, twinkle: 0.8 }, // plancton
  synodes: { color: '210,180,255', count: 16, vy: -0.05, size: 0.009, twinkle: 0.7 }, // spores
  orrhaides: { color: '230,245,255', count: 12, vy: -0.02, size: 0.01, twinkle: 1.6 }, // éclats
  liseurs: { color: '255,215,120', count: 12, vy: -0.03, size: 0.009, twinkle: 1.2 }, // poussière de glyphes
  keltirr: { color: '255,245,170', count: 14, vy: 0.03, size: 0.008, twinkle: 0.6 }, // pollen
  ashkari: { color: '255,200,140', count: 12, vy: -0.02, size: 0.008, twinkle: 0.4 }, // poussière
  'sans-espece': { color: '140,255,190', count: 10, vy: -0.025, size: 0.007, twinkle: 1.0 }, // voyants du poste de pilotage
};

const FPS_MAX = 30;
const images = new Map(); // une image par espèce, partagée par tous les portraits
function imageFor(key) {
  if (!images.has(key)) {
    const img = new Image();
    img.src = `${import.meta.env?.BASE_URL ?? '/'}portraits/${key}.jpg`;
    images.set(key, img);
  }
  return images.get(key);
}

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

export function createPaintedPortrait(canvas, speciesKey, accent) {
  const ctx = canvas.getContext('2d');
  let key = speciesKey;
  let glow = hexToRgb(accent);
  let img = imageFor(key);
  let speaking = false;
  let alive = true;
  let raf = 0;
  let last = performance.now();
  let wasConnected = false;
  let detached = 0;
  let t = Math.random() * 100;
  let voice = 0; // intensité de la voix (syllabes)
  let voiceTarget = 0;
  let sylTimer = 0;
  let talk = 0; // 0 au repos, 1 en train de parler (lissé)
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Particules en coordonnées normalisées (-1..1 sur le plus petit côté).
  let parts = [];
  function seedParticles() {
    const p = PARTICLES[key];
    parts = p ? Array.from({ length: p.count }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, ph: Math.random() * 10, s: 0.6 + Math.random() * 0.8 })) : [];
  }
  seedParticles();

  function update(dt) {
    t += dt;
    if (speaking) {
      sylTimer -= dt;
      if (sylTimer <= 0) {
        // syllabes irrégulières avec de courtes pauses, comme pour les portraits dessinés
        if (Math.random() < 0.14) { voiceTarget = 0.1; sylTimer = 0.15 + Math.random() * 0.25; }
        else { voiceTarget = 0.4 + Math.random() * 0.6; sylTimer = 0.07 + Math.random() * 0.13; }
      }
    } else voiceTarget = 0;
    voice += (voiceTarget - voice) * Math.min(1, dt * (speaking ? 16 : 5));
    talk += ((speaking ? 1 : 0) - talk) * Math.min(1, dt * 3);
    const p = PARTICLES[key];
    if (p) {
      for (const q of parts) {
        q.y += p.vy * q.s * dt * (1 + talk * 0.8);
        q.x += Math.sin(t * 0.7 + q.ph) * 0.02 * dt;
        if (q.y < -1.05) { q.y = 1.05; q.x = Math.random() * 2 - 1; }
        if (q.y > 1.05) { q.y = -1.05; q.x = Math.random() * 2 - 1; }
      }
    }
  }

  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!img.complete || !img.naturalWidth) return;
    const S = Math.min(W, H);
    const cx = W / 2, cy = H / 2;
    // Respiration : zoom très léger et petit balancement ; un peu plus marqué quand il parle.
    const breath = reduced ? 0 : Math.sin(t * 1.25);
    const zoom = 1.04 + 0.012 * breath + 0.015 * voice;
    const size = S * zoom;
    ctx.drawImage(img, cx - size / 2, cy - size / 2 - S * 0.004 * breath, size, size);
    // Lueur de la voix, à la couleur de l'espèce, au centre (là où sont le visage et le cœur lumineux).
    const halo = 0.06 + 0.04 * talk + 0.22 * voice;
    if (halo > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, cy - S * 0.08, 0, cx, cy - S * 0.08, S * 0.55);
      g.addColorStop(0, `rgba(${glow},${halo})`);
      g.addColorStop(1, `rgba(${glow},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    // Particules (pas sur les très petits portraits, où elles feraient du bruit).
    const p = PARTICLES[key];
    if (p && S >= 120 && !reduced) {
      ctx.globalCompositeOperation = 'lighter';
      for (const q of parts) {
        const a = 0.35 + 0.35 * Math.sin(t * p.twinkle * 3 + q.ph);
        const r = Math.max(1, p.size * S * q.s);
        ctx.fillStyle = `rgba(${p.color},${Math.max(0, a)})`;
        ctx.beginPath();
        ctx.arc(cx + (q.x * S) / 2, cy + (q.y * S) / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // Vignette : bord du cercle assombri, pour la profondeur.
    const v = ctx.createRadialGradient(cx, cy, S * 0.3, cx, cy, S * 0.51);
    v.addColorStop(0, 'rgba(2,4,10,0)');
    v.addColorStop(0.75, 'rgba(2,4,10,0.25)');
    v.addColorStop(1, 'rgba(2,4,10,0.75)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
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
    setSpecies(k, newAccent) {
      key = k;
      img = imageFor(key);
      if (newAccent) glow = hexToRgb(newAccent);
      seedParticles();
    },
    destroy,
  };
}
