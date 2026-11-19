// Tests des modèles de bâtiments (src/buildings/, docs/plan-batiments-especes.md) : chaque bâtiment
// se construit pour chaque style, en chantier et aux niveaux 1 à 4, et son animation tourne.
// Usage : node docs/outils/test-batiments.mjs .
import { pathToFileURL } from 'node:url';

// Node n'a pas de canvas : un faux suffit (les textures ne sont pas regardées ici).
const fakeCtx = new Proxy({}, { get: (_, k) => (k === 'canvas' ? {} : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx, style: {} }) };

const root = process.argv[2];
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const { buildingMesh, BUILDING_TYPES } = await imp('buildings/index.js');
const { SPECIES } = await imp('config.js');

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`);
  if (!ok) fails++;
};
const fx = { puff() {} };
const meshes = (g) => {
  let n = 0;
  g.traverse((o) => (n += o.isMesh || o.isSprite ? 1 : 0));
  return n;
};

const styles = [null, ...Object.keys(SPECIES)];
for (const species of styles) {
  const broken = [];
  for (const type of BUILDING_TYPES) {
    try {
      const ghost = buildingMesh(type, true, 1, species);
      if (!meshes(ghost)) broken.push(`${type} (chantier vide)`);
      for (const level of [1, 2, 3, 4]) {
        const g = buildingMesh(type, false, level, species);
        if (!meshes(g)) broken.push(`${type} niv. ${level} (vide)`);
        for (let t = 0; t < 5; t++) g.userData.tick?.(t * 0.7, 0.7, fx);
      }
    } catch (e) {
      broken.push(`${type} : ${e.message}`);
    }
  }
  check(!broken.length, `${species ?? 'neutre'} : ${BUILDING_TYPES.length} bâtiments${broken.length ? ` — ${broken.join(', ')}` : ''}`);
}

// Styles déjà dessinés : chaque bâtiment doit être redessiné (pas de retour au style neutre).
const { makeKit } = await imp('buildings/kit.js');
for (const [species, file, fn] of [['vaskhar', 'vaskhar.js', 'buildVaskhar'], ['synodes', 'synodes.js', 'buildSynodes'], ['ondesiens', 'ondesiens.js', 'buildOndesiens'], ['orrhaides', 'orrhaides.js', 'buildOrrhaides'], ['keltirr', 'keltirr.js', 'buildKeltirr']]) {
  const build = (await imp(`buildings/${file}`))[fn];
  const missing = BUILDING_TYPES.filter((t) => build(t, makeKit(false)) === undefined);
  check(!missing.length, `${species} : les ${BUILDING_TYPES.length} bâtiments ont leur propre modèle${missing.length ? ` (manque : ${missing.join(', ')})` : ''}`);
}

console.log(fails ? `\n${fails} échec(s)` : '\nTout est bon.');
process.exit(fails ? 1 : 0);
