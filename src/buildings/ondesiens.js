// Style des Ondésiens : êtres des océans. Dômes de verre bleu-vert translucides, bulles,
// piliers ondulés comme des algues, reflets d'eau ; des bulles montent. Chaque bâtiment garde
// son élément de fonction (foreuse, antenne, cheminée…).
import * as THREE from 'three';

const GLASS = '#7fe0e0';
const SHELL = '#d8f4f0';
const DEEP = '#1f6f86';
const GLOW = '#8ff7ff';

export function buildOndesiens(type, kit) {
  const { g, ghost, add, m, light, every, glow, part, group, ghostMaterial } = kit;
  const glass = (color = GLASS, opacity = 0.45) =>
    ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.08, metalness: 0.2, emissive: DEEP, emissiveIntensity: 0.25 });
  const shell = (extra = {}) => m(SHELL, { roughness: 0.35, metalness: 0.15, ...extra });
  const glowing = [];
  // Dôme de verre posé sur un anneau de nacre.
  const dome = (x, z, r, y = 0, tall = 1) => {
    add(new THREE.TorusGeometry(r, 0.025, 6, 20), shell(), x, y + 0.02, z).rotation.x = Math.PI / 2;
    const d = add(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass(), x, y + 0.02, z);
    d.scale.y = tall;
    return d;
  };
  // Pilier ondulé (comme une algue) : petits segments décalés.
  const kelp = (x, z, h, r = 0.03, color = '#3fb8a0') => {
    const grp = group(x, 0, z);
    const n = 5;
    for (let k = 0; k < n; k++) {
      const seg = part(grp, new THREE.CylinderGeometry(r * (1 - k * 0.12), r * (1 - (k - 1) * 0.12), h / n, 6), m(color, { roughness: 0.5, emissive: '#0a3a30', emissiveIntensity: 0.4 }), Math.sin(k * 1.3) * 0.02, (k + 0.5) * (h / n), 0);
      seg.rotation.z = Math.sin(k * 1.3) * 0.15;
    }
    return grp;
  };
  const pearl = (x, y, z, r = 0.035, color = GLOW) => {
    const p = add(new THREE.SphereGeometry(r, 10, 8), light(color, 0.9), x, y, z);
    glowing.push(p);
    return p;
  };
  const ripple = (time) => {
    const p = 0.6 + Math.sin(time * 1.8) * 0.3;
    for (const o of glowing) o.material.emissiveIntensity = p;
  };
  const bubbles = (x, y, z, period = 1.2) => every(period, (fx) => fx.puff(g, x, y, z, '#bff6ff'));
  const sway = (groups) => (time) => groups.forEach((grp, i) => (grp.rotation.z = Math.sin(time * 1.2 + i) * 0.08));

  switch (type) {
    case 'centre': {
      // Grand dôme double au-dessus d'un bassin, perle-balise sur une flèche de nacre.
      add(new THREE.CylinderGeometry(0.58, 0.62, 0.06, 20), shell(), 0, 0.03);
      add(new THREE.CircleGeometry(0.5, 24), m('#3aa8c8', { emissive: '#0a3a55', emissiveIntensity: 0.4, roughness: 0.1 }), 0, 0.065, 0).rotation.x = -Math.PI / 2;
      dome(0, 0, 0.42, 0.06, 0.8);
      dome(0, 0, 0.22, 0.06, 1.3);
      add(new THREE.CylinderGeometry(0.012, 0.025, 0.55, 6), shell(), 0, 0.55, 0);
      const beacon = pearl(0, 0.85, 0, 0.04, '#7cff9e');
      const weeds = [kelp(0.42, 0.3, 0.3), kelp(-0.45, 0.2, 0.25), kelp(0.1, -0.48, 0.28)];
      const halo = glow(GLOW, 0, 0.3, 0, 0.8, 0.3);
      const up = bubbles(0, 0.45, 0, 1.4);
      const s = sway(weeds);
      return (time, dt, fx) => {
        ripple(time);
        s(time);
        beacon.visible = Math.sin(time * 3) > -0.2;
        if (halo) halo.material.opacity = 0.2 + Math.sin(time * 1.8) * 0.1;
        up(time, dt, fx);
      };
    }
    case 'foyer': {
      // Grappe de bulles d'habitation reliées par des tubes, lumières dorées.
      for (const [x, z, r] of [[-0.2, 0.1, 0.2], [0.22, 0.12, 0.17], [0, -0.22, 0.19]]) {
        const b = add(new THREE.SphereGeometry(r, 14, 10), glass('#9fe8ff', 0.5), x, r * 0.85, z);
        b.scale.y = 0.85;
        pearl(x, r * 0.5, z, 0.04, '#ffe08a');
      }
      const tube = add(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), shell(), 0.01, 0.12, 0.11);
      tube.rotation.z = Math.PI / 2;
      return ripple;
    }
    case 'puits': {
      // Foreuse dans un puits d'eau : tour de nacre spiralée, bulles qui remontent du forage.
      add(new THREE.CylinderGeometry(0.22, 0.24, 0.06, 16), shell(), 0, 0.03);
      add(new THREE.CircleGeometry(0.18, 16), m('#3aa8c8', { emissive: '#0a3a55', emissiveIntensity: 0.5 }), 0, 0.065, 0).rotation.x = -Math.PI / 2;
      add(new THREE.CylinderGeometry(0.04, 0.12, 0.85, 6, 1, true), shell({ side: THREE.DoubleSide }), 0, 0.5).rotation.y = Math.PI / 6;
      for (let k = 0; k < 4; k++) add(new THREE.TorusGeometry(0.11 - k * 0.018, 0.012, 4, 14), light(GLOW, 0.7), 0, 0.2 + k * 0.18, 0).rotation.x = Math.PI / 2;
      const lamp = pearl(0, 0.98, 0, 0.035, '#ffb347');
      const up = bubbles(0, 0.1, 0, 0.9);
      return (time, dt, fx) => {
        ripple(time);
        lamp.visible = Math.sin(time * 5) > -0.3;
        up(time, dt, fx);
      };
    }
    case 'fonderie': {
      // Forge sous cloche de verre (le métal fond sous l'eau chaude), cheminée de nacre, coulée.
      add(new THREE.CylinderGeometry(0.3, 0.32, 0.06, 16), shell(), -0.05, 0.03, -0.05);
      const core = pearl(-0.05, 0.16, -0.05, 0.1, '#ff8a3a');
      dome(-0.05, -0.05, 0.28, 0.04, 1.1);
      add(new THREE.CylinderGeometry(0.04, 0.07, 0.62, 10), shell(), 0.25, 0.31, -0.18);
      add(new THREE.TorusGeometry(0.05, 0.012, 4, 12), light(GLOW), 0.25, 0.62, -0.18).rotation.x = Math.PI / 2;
      add(new THREE.BoxGeometry(0.34, 0.04, 0.09), shell(), -0.12, 0.02, 0.27);
      const pour = add(new THREE.BoxGeometry(0.3, 0.012, 0.05), light('#ff8a3a'), -0.12, 0.045, 0.27);
      for (const x of [-0.24, -0.12, 0]) add(new THREE.BoxGeometry(0.07, 0.035, 0.05), m('#9fb4c8', { metalness: 0.8, roughness: 0.25 }), x, 0.018, 0.38);
      const steam = every(0.9, (fx) => fx.puff(g, 0.25, 0.65, -0.18, '#cfefff'));
      return (time, dt, fx) => {
        ripple(time);
        core.material.emissiveIntensity = 1 + Math.sin(time * 4) * 0.4;
        pour.material.emissiveIntensity = 0.7 + Math.sin(time * 6) * 0.25;
        steam(time, dt, fx);
      };
    }
    case 'pompe': {
      // Plateforme flottante sur pilotis ondulés, réservoir de deutérium sous coquille de verre.
      add(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16), shell(), 0, 0.12);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        kelp(Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0.12, 0.02, '#2f9a88');
      }
      kelp(-0.16, -0.08, 0.75, 0.04);
      const tank = add(new THREE.SphereGeometry(0.17, 14, 10), m('#5fe3ff', { emissive: '#1a8aa8', emissiveIntensity: 0.5, roughness: 0.2 }), 0.14, 0.32, 0.08);
      add(new THREE.SphereGeometry(0.21, 14, 10), glass(), 0.14, 0.32, 0.08);
      const beacon = pearl(-0.16, 0.82, -0.08, 0.03, '#5fe3ff');
      const up = bubbles(0.14, 0.5, 0.08, 1.5);
      return (time, dt, fx) => {
        ripple(time);
        beacon.visible = Math.sin(time * 2.5) > -0.2;
        tank.material.emissiveIntensity = 0.45 + Math.sin(time * 1.5) * 0.2;
        up(time, dt, fx);
      };
    }
    case 'captage': {
      // Bassin en coquillage, réservoir en bulle, eau qui tourbillonne.
      const rim = add(new THREE.TorusGeometry(0.3, 0.06, 8, 20), shell(), -0.08, 0.05, 0.05);
      rim.rotation.x = Math.PI / 2;
      rim.scale.z = 0.7;
      const pool = add(new THREE.CircleGeometry(0.28, 20), ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#4aa8ff', emissive: '#0a2a55', transparent: true, opacity: 0.85, roughness: 0.1 }), -0.08, 0.07, 0.05);
      pool.rotation.x = -Math.PI / 2;
      add(new THREE.SphereGeometry(0.16, 14, 10), glass('#4aa8ff', 0.6), 0.3, 0.22, -0.22);
      kelp(0.3, -0.22, 0.12, 0.05, '#d8f4f0');
      return (time) => {
        ripple(time);
        pool.rotation.z = time * 0.4;
      };
    }
    case 'fouille': {
      // Fouille sous une cloche de plongée : bulle de verre, relique dorée, treuil qui tourne.
      add(new THREE.CylinderGeometry(0.2, 0.16, 0.03, 12), m('#2a4a50'), 0.05, 0.015, 0.05);
      const relic = add(new THREE.OctahedronGeometry(0.05), light('#ffd166'), 0.05, 0.08, 0.05);
      dome(0.05, 0.05, 0.26, 0, 1);
      add(new THREE.CylinderGeometry(0.02, 0.025, 0.6, 6), shell(), 0.32, 0.3, -0.25);
      const winch = group(0.32, 0.6, -0.25);
      part(winch, new THREE.TorusGeometry(0.07, 0.015, 4, 12), shell(), 0, 0, 0);
      part(winch, new THREE.CylinderGeometry(0.004, 0.004, 0.42, 3), m('#334'), -0.12, -0.2, 0.1).rotation.z = 0.6;
      const weeds = [kelp(-0.32, -0.2, 0.22), kelp(-0.35, 0.25, 0.18)];
      const halo = glow('#ffd166', 0.05, 0.12, 0.05, 0.45, 0.6);
      const s = sway(weeds);
      return (time) => {
        ripple(time);
        s(time);
        winch.rotation.y = Math.sin(time * 0.35) * 1.1;
        relic.rotation.y = time * 1.5;
        const p = 0.5 + Math.sin(time * 2.2) * 0.5;
        relic.material.emissiveIntensity = 0.5 + p * 0.8;
        if (halo) halo.material.opacity = 0.3 + p * 0.45;
      };
    }
    case 'centrale': {
      // Centrale thermique des fonds : colonne de verre où monte un courant chaud, anneau doré.
      add(new THREE.CylinderGeometry(0.3, 0.34, 0.08, 16), shell(), -0.1, 0.04);
      add(new THREE.CylinderGeometry(0.16, 0.22, 0.62, 14, 1, true), glass(), -0.1, 0.39);
      const core = add(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 10), light('#ffd166', 0.9), -0.1, 0.37);
      const ring = add(new THREE.TorusGeometry(0.2, 0.02, 4, 18), light('#ffd166'), -0.1, 0.7);
      ring.rotation.x = Math.PI / 2;
      kelp(0.3, 0.15, 0.25);
      const up = bubbles(-0.1, 0.72, 0, 1.1);
      return (time, dt, fx) => {
        ripple(time);
        core.material.emissiveIntensity = 0.6 + Math.sin(time * 3) * 0.3;
        ring.material.emissiveIntensity = 0.6 + Math.sin(time * 4) * 0.4;
        up(time, dt, fx);
      };
    }
    case 'solaire': {
      // Feuilles de verre bleu (comme des nageoires) qui captent la lumière.
      for (const [x, z, i] of [[-0.22, -0.2, 0], [0.22, -0.2, 1], [-0.22, 0.2, 2], [0.22, 0.2, 3]]) {
        kelp(x, z, 0.14, 0.02, '#2f9a88');
        const fin = add(new THREE.SphereGeometry(0.19, 12, 6), m('#1d5f9a', { metalness: 0.5, roughness: 0.15, emissive: '#0a2a4a', emissiveIntensity: 0.6 }), x, 0.16, z);
        fin.scale.set(1, 0.08, 0.8);
        fin.rotation.x = -0.45;
        fin.rotation.y = i * 0.4;
      }
      return ripple;
    }
    case 'serre': {
      // Jardin d'algues sous un grand dôme de verre ; les algues ondulent.
      add(new THREE.CylinderGeometry(0.48, 0.5, 0.05, 16), shell(), 0, 0.025);
      const weeds = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        weeds.push(kelp(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.2 + (i % 3) * 0.06, 0.025, i % 2 ? '#5fbf6a' : '#3fb8a0'));
      }
      dome(0, 0, 0.46, 0.04, 0.9);
      const s = sway(weeds);
      return (time) => {
        ripple(time);
        s(time);
      };
    }
    case 'ferme': {
      // Élevage marin : anneau de nacre, filets qui tournent, bulles d'oxygène.
      add(new THREE.TorusGeometry(0.4, 0.06, 8, 24), shell(), 0, 0.08).rotation.x = Math.PI / 2;
      const nets = group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const net = part(nets, new THREE.BoxGeometry(0.22, 0.03, 0.1), m('#4fae9a', { emissive: '#0a3028' }), Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2);
        net.rotation.y = -a;
      }
      add(new THREE.SphereGeometry(0.12, 12, 8), glass(), 0, 0.08);
      const up = bubbles(0, 0.2, 0, 1.6);
      return (time, dt, fx) => {
        ripple(time);
        nets.rotation.y = time * 0.3;
        up(time, dt, fx);
      };
    }
    case 'laboratoire': {
      // Laboratoire-bulle : coque de verre à anneau lumineux, antenne en forme de méduse qui balaie le ciel.
      add(new THREE.CylinderGeometry(0.3, 0.32, 0.06, 16), shell(), -0.05, 0.03);
      add(new THREE.SphereGeometry(0.26, 16, 10), glass('#9fe8ff', 0.5), -0.05, 0.22).scale.y = 0.75;
      const ring = add(new THREE.TorusGeometry(0.27, 0.014, 4, 24), light('#5fe3ff'), -0.05, 0.22);
      ring.rotation.x = Math.PI / 2;
      pearl(-0.05, 0.2, 0, 0.06, '#7ff0ff');
      kelp(0.24, 0.14, 0.42, 0.025, '#d8f4f0');
      const head = group(0.24, 0.6, 0.14);
      const bell = part(head, new THREE.SphereGeometry(0.12, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), glass('#c6f6ff', 0.6), 0, 0.05, 0.05);
      bell.rotation.x = -0.5;
      for (let k = 0; k < 4; k++) part(head, new THREE.CylinderGeometry(0.004, 0.004, 0.14, 3), light(GLOW, 0.8), Math.cos(k * 1.6) * 0.05, -0.04, 0.05 + Math.sin(k * 1.6) * 0.05);
      const halo = glow('#5fe3ff', -0.05, 0.3, 0, 0.5, 0.4);
      return (time) => {
        ripple(time);
        head.rotation.y = time * 0.45 + Math.sin(time * 0.9) * 0.4;
        bell.scale.y = 1 + Math.sin(time * 2.5) * 0.12;
        ring.material.emissiveIntensity = 0.5 + Math.sin(time * 2) * 0.4;
        if (halo) halo.material.opacity = 0.2 + (0.5 + Math.sin(time * 2) * 0.5) * 0.35;
      };
    }
    case 'siphon': {
      // Colonne d'eau qui tient en suspension le cristal de Vélarine, dans un tube de verre.
      add(new THREE.CylinderGeometry(0.26, 0.3, 0.08, 16), shell(), 0, 0.04);
      add(new THREE.CylinderGeometry(0.12, 0.12, 0.85, 14, 1, true), glass(), 0, 0.5);
      add(new THREE.TorusGeometry(0.12, 0.015, 4, 16), shell(), 0, 0.92).rotation.x = Math.PI / 2;
      const crystal = add(new THREE.OctahedronGeometry(0.1), light('#c77dff'), 0, 0.6);
      crystal.scale.y = 1.6;
      const up = bubbles(0, 0.2, 0, 0.8);
      return (time, dt, fx) => {
        ripple(time);
        crystal.rotation.y = time;
        crystal.position.y = 0.6 + Math.sin(time * 2) * 0.05;
        up(time, dt, fx);
      };
    }
    case 'spatioport': {
      // Bassin de lancement circulaire balisé de perles, tour-algue, sonde en goutte de verre.
      add(new THREE.CylinderGeometry(0.5, 0.54, 0.06, 6), shell(), 0, 0.03);
      add(new THREE.CircleGeometry(0.3, 24), m('#3aa8c8', { emissive: '#0a3a55', emissiveIntensity: 0.5, roughness: 0.1 }), 0.08, 0.065, 0).rotation.x = -Math.PI / 2;
      const beacons = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        beacons.push(add(new THREE.SphereGeometry(0.025, 8, 6), light('#ffb347'), Math.cos(a) * 0.44, 0.08, Math.sin(a) * 0.44));
      }
      const rx = 0.08;
      const drop = add(new THREE.SphereGeometry(0.06, 14, 10), glass('#9fe8ff', 0.75), rx, 0.25, 0);
      drop.scale.y = 2.2;
      add(new THREE.ConeGeometry(0.045, 0.1, 12), shell(), rx, 0.45, 0);
      pearl(rx, 0.22, 0, 0.03, GLOW);
      const tower = kelp(-0.15, 0, 0.62, 0.04, '#d8f4f0');
      const towerLight = add(new THREE.SphereGeometry(0.025, 6, 4), light('#ff4040'), -0.15, 0.66, 0);
      add(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass(), 0.02, 0.06, 0.3);
      const up = bubbles(rx, 0.1, 0, 2);
      const s = sway([tower]);
      return (time, dt, fx) => {
        ripple(time);
        s(time);
        const step = Math.floor(time * 6) % beacons.length;
        beacons.forEach((b, i) => (b.material.emissiveIntensity = i === step ? 2.2 : 0.35));
        towerLight.material.emissiveIntensity = Math.sin(time * 3) > 0.2 ? 1.8 : 0.2;
        up(time, dt, fx);
      };
    }
    case 'batterie': {
      // Tourelle-coquillage qui pivote, deux canons à jet d'eau sous pression.
      add(new THREE.CylinderGeometry(0.4, 0.46, 0.08, 16), shell(), 0, 0.04);
      add(new THREE.TorusGeometry(0.3, 0.018, 4, 18), light('#ff4a4a'), 0, 0.09).rotation.x = Math.PI / 2;
      const head = group(0, 0.08, 0);
      const conch = part(head, new THREE.SphereGeometry(0.2, 14, 10), shell(), 0, 0.16, 0);
      conch.scale.set(1, 0.8, 1.2);
      part(head, new THREE.SphereGeometry(0.21, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass(), 0, 0.18, 0);
      const cradle = group(0, 0.16, 0.18, head);
      for (const x of [-0.06, 0.06]) {
        const barrel = part(cradle, new THREE.CylinderGeometry(0.022, 0.03, 0.36, 8), shell({ metalness: 0.4 }), x, 0, 0.16);
        barrel.rotation.x = Math.PI / 2;
        const muzzle = part(cradle, new THREE.SphereGeometry(0.03, 8, 6), light(GLOW), x, 0, 0.34);
        glowing.push(muzzle);
      }
      const halo = glow('#ff3a3a', 0, 0.36, 0, 0.5, 0.4);
      const phase = Math.random() * 10;
      return (time) => {
        ripple(time);
        const t = time + phase;
        head.rotation.y = t * 0.25 + Math.sin(t * 0.5) * 0.6;
        cradle.rotation.x = -0.25 - Math.sin(t * 0.7) * 0.2;
        if (halo) halo.material.opacity = 0.2 + (0.5 + Math.sin(t * 3) * 0.5) * 0.3;
      };
    }
    default:
      return undefined; // pas redessiné : style neutre
  }
}
