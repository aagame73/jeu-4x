// Voix des espèces (docs/plan-voix.md) : un babillage extraterrestre synthétisé en direct (Web Audio,
// aucun fichier son), un timbre par espèce (réglages VOICES dans config.js). Une seule voix à la fois.
// Branché sur setSpeaking des portraits (aliens.js) : start(espèce, propriétaire) / stop(propriétaire).
// Réglages (volume, coupure) gardés dans le navigateur.
import { VOICES } from './config.js';

const STORE = 'arche:son';
let ctx = null;
let master = null;
let meter = null; // mesure du niveau (outil de développement : level())
let settings = { volume: 0.6, muted: false };
try {
  settings = { ...settings, ...JSON.parse(localStorage.getItem(STORE) || '{}') };
} catch {
  // navigation privée ou stockage bloqué : réglages par défaut
}
const listeners = new Set();
let current = null; // { owner, timer, nodes }

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(settings));
  } catch {
    // ignoré
  }
  listeners.forEach((fn) => fn(settings));
}

// Contexte audio créé à la première interaction (règle des navigateurs).
function audio() {
  if (!ctx) {
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    meter = ctx.createAnalyser();
    meter.fftSize = 2048;
    comp.connect(meter);
    applyVolume();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
function applyVolume() {
  if (master) master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume * 0.5, ctx.currentTime, 0.05);
}
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

export const soundSettings = () => ({ ...settings });
export function setVolume(v) {
  settings.volume = Math.max(0, Math.min(1, v));
  if (settings.volume > 0) settings.muted = false;
  applyVolume();
  save();
}
export function setMuted(muted) {
  settings.muted = !!muted;
  applyVolume();
  if (muted) stop();
  save();
}
export const toggleMuted = () => setMuted(!settings.muted);
export function onSoundChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// --- Briques de synthèse ---------------------------------------------------------------
const rand = (a, b) => a + Math.random() * (b - a);

// Enveloppe : attaque, maintien, relâche, sur un gain.
function envelope(gain, t, dur, peak, attack = 0.015, release = 0.08) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.setValueAtTime(peak, t + Math.max(attack, dur - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function osc(type, freq, t, dur) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}
function noise(t, dur) {
  const length = Math.ceil(ctx.sampleRate * (dur + 0.05));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.start(t);
  return src;
}
function filter(type, freq, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}
function shaper(amount) {
  const ws = ctx.createWaveShaper();
  const n = 256;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  ws.curve = curve;
  return ws;
}
// Voyelles : fréquences de formants (a, e, i, o, u), pour les voix « parlées ».
const VOWELS = [[800, 1200], [500, 1800], [300, 2300], [500, 900], [320, 800]];

// --- Recettes : une syllabe, selon l'espèce. Chaque recette renvoie sa durée. ---------------
const RECIPES = {
  // Grondement de roche : dent de scie très grave, filtre bas, saturation, crépitements.
  growl(t, v, out) {
    const dur = rand(...v.syllable);
    const f = rand(...v.pitch);
    const o = osc('sawtooth', f, t, dur);
    o.frequency.exponentialRampToValueAtTime(f * rand(0.7, 1.1), t + dur);
    const lp = filter('lowpass', rand(300, 600), 4);
    const g = ctx.createGain();
    envelope(g, t, dur, 0.5, 0.03, 0.12);
    o.connect(shaper(3)).connect(lp).connect(g).connect(out);
    const n = noise(t, dur);
    const bp = filter('bandpass', 2400, 0.8);
    const gn = ctx.createGain();
    envelope(gn, t, dur * 0.6, 0.12, 0.005, 0.05);
    n.connect(bp).connect(gn).connect(out);
    return dur;
  },
  // Chant de baleine : sinusoïde qui glisse d'une note à l'autre, filtre qui ondule, petit « bloup ».
  whale(t, v, out) {
    const dur = rand(...v.syllable);
    const f = rand(...v.pitch);
    const o = osc('sine', f, t, dur);
    o.frequency.exponentialRampToValueAtTime(f * rand(0.6, 1.6), t + dur * 0.8);
    const vib = osc('sine', rand(4, 7), t, dur);
    const vg = ctx.createGain();
    vg.gain.value = f * 0.03;
    vib.connect(vg).connect(o.frequency);
    const o2 = osc('triangle', f * 2.01, t, dur);
    const g = ctx.createGain();
    envelope(g, t, dur, 0.4, 0.08, 0.2);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(out);
    if (Math.random() < 0.4) {
      const tb = t + dur * rand(0.3, 0.9);
      const b = osc('sine', rand(500, 900), tb, 0.08);
      b.frequency.exponentialRampToValueAtTime(rand(1200, 1800), tb + 0.07);
      const gb = ctx.createGain();
      envelope(gb, tb, 0.08, 0.15, 0.005, 0.04);
      b.connect(gb).connect(out);
    }
    return dur;
  },
  // Gazouillis : notes aiguës et rapides, sauts de hauteur, parfois un trille.
  chirp(t, v, out) {
    const n = Math.random() < 0.3 ? 4 : 1 + Math.floor(Math.random() * 2);
    let at = t;
    for (let k = 0; k < n; k++) {
      const dur = rand(...v.syllable) / (n > 2 ? 2.5 : 1);
      const f = rand(...v.pitch);
      const o = osc('triangle', f, at, dur);
      o.frequency.exponentialRampToValueAtTime(f * rand(1.2, 1.8), at + dur * 0.7);
      const g = ctx.createGain();
      envelope(g, at, dur, 0.3, 0.005, dur * 0.5);
      o.connect(g).connect(out);
      at += dur + 0.015;
    }
    return at - t;
  },
  // Chœur chuchoté : plusieurs voix désaccordées sur une voyelle, et du souffle.
  choir(t, v, out) {
    const dur = rand(...v.syllable);
    const f = rand(...v.pitch);
    const [f1, f2] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    const g = ctx.createGain();
    envelope(g, t, dur, 0.28, 0.1, 0.2);
    const bp1 = filter('bandpass', f1, 2);
    const bp2 = filter('bandpass', f2, 3);
    bp1.connect(g);
    bp2.connect(g);
    for (const detune of [-12, 0, 7, 12.3]) {
      const o = osc('sawtooth', f, t, dur);
      o.detune.value = detune * 10 + rand(-8, 8);
      const og = ctx.createGain();
      og.gain.value = 0.18;
      o.connect(og);
      og.connect(bp1);
      og.connect(bp2);
    }
    const n = noise(t, dur);
    const nb = filter('bandpass', f2, 2);
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    n.connect(nb).connect(ng).connect(g);
    g.connect(out);
    return dur;
  },
  // Carillon de cristal : cloches en modulation de fréquence, longue résonance.
  chime(t, v, out) {
    const dur = rand(...v.syllable);
    const f = rand(...v.pitch);
    const carrier = osc('sine', f, t, dur * 2.5);
    const mod = osc('sine', f * 2.76, t, dur * 2.5);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 2, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur * 2);
    mod.connect(mg).connect(carrier.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 2.5);
    carrier.connect(g).connect(out);
    return dur;
  },
  // Claquements rauques : salves courtes d'onde carrée grave, saturées, avec un claquement.
  click(t, v, out) {
    const n = 1 + Math.floor(Math.random() * 3);
    let at = t;
    for (let k = 0; k < n; k++) {
      const dur = rand(...v.syllable) / n;
      const f = rand(...v.pitch);
      const o = osc('square', f, at, dur);
      o.frequency.exponentialRampToValueAtTime(f * 0.7, at + dur);
      const lp = filter('lowpass', 900, 3);
      const g = ctx.createGain();
      envelope(g, at, dur, 0.35, 0.004, dur * 0.4);
      o.connect(shaper(5)).connect(lp).connect(g).connect(out);
      const c = noise(at, 0.02);
      const cg = ctx.createGain();
      envelope(cg, at, 0.02, 0.3, 0.001, 0.015);
      c.connect(filter('highpass', 1500)).connect(cg).connect(out);
      at += dur + 0.03;
    }
    return at - t;
  },
  // Murmure psalmodié : une note tenue, des voyelles qui changent lentement.
  chant(t, v, out) {
    const dur = rand(...v.syllable);
    const f = rand(...v.pitch);
    const o = osc('triangle', f, t, dur);
    const o2 = osc('sawtooth', f, t, dur);
    const [f1, f2] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    const bp1 = filter('bandpass', f1, 2.5);
    const bp2 = filter('bandpass', f2, 3.5);
    const g = ctx.createGain();
    envelope(g, t, dur, 0.4, 0.12, 0.25);
    const mix = ctx.createGain();
    mix.gain.value = 0.6;
    o.connect(mix);
    o2.connect(mix);
    mix.connect(bp1).connect(g);
    mix.connect(bp2).connect(g);
    g.connect(out);
    return dur;
  },
  // Voix nasale à travers un masque : bourdonnement filtré et souffle.
  nasal(t, v, out) {
    const dur = rand(...v.syllable);
    const f = rand(...v.pitch);
    const o = osc('sawtooth', f, t, dur);
    o.frequency.linearRampToValueAtTime(f * rand(0.85, 1.15), t + dur);
    const [f1] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    const nasal = filter('bandpass', 1100 + f1 * 0.3, 4);
    const notch = filter('notch', 2200, 2);
    const g = ctx.createGain();
    envelope(g, t, dur, 0.5, 0.02, 0.1);
    o.connect(nasal).connect(notch).connect(g);
    const n = noise(t, dur);
    const ng = ctx.createGain();
    ng.gain.value = 0.25;
    n.connect(filter('bandpass', 3000, 1.5)).connect(ng).connect(g);
    g.connect(out);
    return dur;
  },
  // Voix radio : carré en bande étroite (talkie-walkie), grésillement.
  radio(t, v, out) {
    const dur = rand(...v.syllable);
    const f = rand(...v.pitch);
    const o = osc('square', f, t, dur);
    o.frequency.setValueAtTime(f * rand(0.9, 1.2), t + dur * 0.5);
    const [f1, f2] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    const g = ctx.createGain();
    envelope(g, t, dur, 0.3, 0.01, 0.05);
    const band = filter('bandpass', (f1 + f2) / 2, 3);
    o.connect(band).connect(filter('highpass', 400)).connect(g);
    const n = noise(t, dur);
    const ng = ctx.createGain();
    ng.gain.value = 0.08;
    n.connect(filter('bandpass', 2500, 0.7)).connect(ng).connect(g);
    g.connect(out);
    return dur;
  },
};

// --- Parole : une suite de syllabes jusqu'à l'arrêt -------------------------------------------
export function start(species, owner) {
  if (settings.muted || settings.volume <= 0) return;
  const c = audio();
  if (!c || c.state !== 'running') return;
  stop();
  const voice = VOICES[species] ?? VOICES['sans-espece'];
  const recipe = RECIPES[voice.recipe];
  if (!recipe) return;
  const out = ctx.createGain();
  out.gain.value = voice.gain ?? 1;
  out.connect(master);
  const me = { owner, out, timer: null };
  current = me;
  let at = ctx.currentTime + 0.03;
  const step = () => {
    if (current !== me) return;
    // Programme les syllabes jusqu'à 0,4 s d'avance.
    while (at < ctx.currentTime + 0.4) {
      const dur = recipe(at, voice, out);
      at += dur + (Math.random() < voice.pause ? rand(0.18, 0.4) : rand(...voice.gap));
    }
    me.timer = setTimeout(step, 120);
  };
  step();
}

// owner : n'arrête que la voix de ce portrait (une autre a pu prendre la parole entre-temps).
export function stop(owner) {
  if (!current || (owner !== undefined && current.owner !== owner)) return;
  const { out, timer } = current;
  clearTimeout(timer);
  current = null;
  if (ctx) {
    out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.06);
    setTimeout(() => out.disconnect(), 500);
  }
}

// Niveau actuel (valeur efficace et crête, 0 à 1) : pour vérifier qu'une voix sonne sans saturer.
export function level() {
  if (!meter) return { rms: 0, peak: 0 };
  const data = new Float32Array(meter.fftSize);
  meter.getFloatTimeDomainData(data);
  let sum = 0;
  let peak = 0;
  for (const x of data) {
    sum += x * x;
    peak = Math.max(peak, Math.abs(x));
  }
  return { rms: Math.sqrt(sum / data.length), peak };
}

// Démonstration : chaque espèce parle 2,5 s, l'une après l'autre (dans la console du jeu).
export async function demo(species = Object.keys(VOICES)) {
  audio();
  for (const key of species) {
    console.log('Voix :', key);
    start(key, 'demo');
    await new Promise((r) => setTimeout(r, 2500));
    stop('demo');
    await new Promise((r) => setTimeout(r, 500));
  }
}
