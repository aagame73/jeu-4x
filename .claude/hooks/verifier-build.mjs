// Hook « Stop » : lance `npm run build` à la fin de chaque réponse de Claude.
// Si le build échoue, le code de sortie 2 empêche Claude de s'arrêter et lui transmet l'erreur à corriger.
// Garde-fou : après MAX_ESSAIS échecs d'affilée dans la même session, on laisse Claude s'arrêter
// et on prévient l'utilisateur, pour ne jamais boucler indéfiniment.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_ESSAIS = 3;

let entree = {};
try {
  entree = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {}
const session = String(entree.session_id ?? 'inconnue').replace(/[^\w-]/g, '');
const compteur = join(tmpdir(), `verifier-build-${session}.txt`);
const lire = () => {
  try {
    return Number(readFileSync(compteur, 'utf8')) || 0;
  } catch {
    return 0;
  }
};

const r = spawnSync('npm run build', {
  cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  shell: true,
  encoding: 'utf8',
  timeout: 150_000, // un build bloqué ne doit pas bloquer Claude non plus
});

if (r.status === 0) {
  rmSync(compteur, { force: true });
  process.exit(0);
}

const essais = lire() + 1;
const sortie = `${r.error ? `${r.error.message}\n` : ''}${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');

if (essais > MAX_ESSAIS) {
  // Abandon : Claude peut s'arrêter, l'utilisateur est prévenu.
  rmSync(compteur, { force: true });
  console.log(JSON.stringify({ systemMessage: `⚠ Le build échoue toujours après ${MAX_ESSAIS} tentatives de correction : arrêt sans réussite, à vérifier.` }));
  process.exit(0);
}

writeFileSync(compteur, String(essais));
process.stderr.write(
  `Le build (npm run build) a échoué (tentative ${essais}/${MAX_ESSAIS}). Corrige l'erreur avant de t'arrêter ; ` +
    `si tu n'y arrives pas, explique le problème à l'utilisateur.\n${sortie}\n`,
);
process.exit(2);
