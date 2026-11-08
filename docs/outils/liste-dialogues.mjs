// Écrit docs/dialogues-especes.md à partir de src/dialogues.js, pour relire les répliques.
// Usage : node docs/outils/liste-dialogues.mjs .
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const { DIALOGUES } = await import(pathToFileURL(`${root}/src/dialogues.js`).href);
const { SPECIES } = await import(pathToFileURL(`${root}/src/config.js`).href);
const SITUATIONS = {
  accueil: 'Accueil (ouverture de la fiche)',
  accepte: 'Échange accepté',
  refus: 'Refus (raison précise affichée dessous)',
  refusFaible: 'Offre trop faible',
  refusHostile: 'Empire hostile',
  contreOffre: 'Contre-offre',
  proposition: "Proposition de l'empire",
  rupture: 'Traité de frontières rompu',
  plusAmical: 'Attitude en hausse',
  plusHostile: 'Attitude en baisse',
  guerre: 'Déclaration de guerre',
  paix: 'Paix acceptée',
  victoire: 'Prend une de vos colonies',
  defaite: 'Perd une flotte',
  pillage: 'Convoi de ravitaillement pillé',
};
let md = '# Répliques des espèces rivales\n\nGénéré par `docs/outils/liste-dialogues.mjs` à partir de `src/dialogues.js` : modifier ce dernier, puis relancer.\n';
for (const [key, lines] of Object.entries(DIALOGUES)) {
  md += `\n## ${SPECIES[key].label} · ${SPECIES[key].empire}\n\n| Situation | Réplique |\n|---|---|\n`;
  for (const [situation, label] of Object.entries(SITUATIONS)) md += `| ${label} | ${lines[situation]} |\n`;
}
writeFileSync(`${root}/docs/dialogues-especes.md`, md);
console.log('docs/dialogues-especes.md écrit');
