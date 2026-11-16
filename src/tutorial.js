// Tutoriel guidé par le conseiller (docs/plan-tutoriel.md) : une suite d'objectifs, du premier
// scan de l'Arche jusqu'à l'envoi de la première sonde. Chaque objectif est réussi dès que sa
// condition est remplie dans la partie, quelle que soit la façon d'y arriver ; le joueur reste libre.
// À chaque nouvel objectif, le conseiller le lit (journal, voix de l'espèce) et le jeu se met en pause.
// État enregistré avec la partie : game.tutorial = { on, step }.
import { TUTORIAL } from './dialogues.js';
import { getSurface, currentDay } from './game.js';

const hasTech = (game, key) => game.research.done.includes(key);
const anyBuilding = (game, type, done = false) =>
  game.colonies.some((c) => getSurface(game, c.starId, c.planetIndex).tiles.some((t) => t.building?.type === type && (!done || t.building.done)));
const probes = (game) => game.ships.filter((s) => s.kind === 'sonde');

// key : clé des textes (dialogues.js) ; title : objectif court (encart) ; how : marche à suivre,
// la même pour toutes les espèces ; done(game) : objectif atteint ; target : élément à mettre en avant.
export const TUTORIAL_STEPS = [
  {
    key: 'analyser',
    title: "Analyser le système de l'Arche",
    how: "Cliquez sur l'étoile de l'Arche, puis sur « Analyser avec l'Arche » dans le panneau de droite.",
    done: (game) => game.stars[game.homeId].level >= 3 || game.ships.some((s) => s.state === 'analyse'),
    target: 'analyse',
  },
  {
    key: 'temps',
    title: "Laisser passer le temps",
    how: 'Le jeu est en pause : appuyez sur Espace (ou ▶ en haut à droite). + et − changent la vitesse. Attendez la fin de l\'analyse.',
    done: (game) => game.stars[game.homeId].level >= 3,
    target: 'temps',
  },
  {
    key: 'colonie',
    title: 'Fonder la colonie',
    how: "Dans le panneau du système, choisissez une planète : « Fonder une colonie ici », puis cliquez sur la case où poser le centre.",
    done: (game) => game.colonies.length > 0,
    target: 'fonder',
  },
  {
    key: 'laboratoire',
    title: 'Construire un laboratoire',
    how: 'Sur la surface de la colonie, cliquez sur une case (plaine, désert ou forêt), puis sur « Laboratoire ».',
    done: (game) => anyBuilding(game, 'laboratoire'),
    target: 'surface',
  },
  {
    key: 'metallurgie',
    title: 'Rechercher la Métallurgie',
    how: 'Ouvrez la recherche (touche R ou bouton « Recherche » en haut), branche Industrie : lancez « Métallurgie ».',
    done: (game) => game.research.current === 'metallurgie' || hasTech(game, 'metallurgie'),
    target: 'recherche',
  },
  {
    key: 'orbitale',
    title: 'Rechercher la Mécanique orbitale',
    how: 'Une fois la Métallurgie acquise, lancez « Mécanique orbitale » (touche R) : elle débloque le spatioport.',
    done: (game) => hasTech(game, 'mecanique-orbitale'),
    target: 'recherche',
  },
  {
    key: 'spatioport',
    title: 'Construire un spatioport',
    how: 'Sur la surface de la colonie (« Gérer la colonie »), cliquez sur une plaine ou un désert, puis sur « Spatioport ».',
    done: (game) => anyBuilding(game, 'spatioport'),
    target: 'surface',
  },
  {
    key: 'saut',
    title: 'Rechercher les Moteurs de saut',
    how: 'Pendant le chantier, lancez « Moteurs de saut » (touche R, branche Propulsion) : ils permettent les sondes.',
    done: (game) => hasTech(game, 'moteurs-saut') && anyBuilding(game, 'spatioport', true),
    target: 'recherche',
  },
  {
    key: 'sonde',
    title: 'Construire une sonde',
    how: 'Dans la colonie (« Gérer la colonie »), le panneau « Chantier spatial » propose la sonde : cliquez sur « Sonde ».',
    done: (game) => probes(game).length > 0,
    target: 'chantier',
  },
  {
    key: 'envoyer',
    title: 'Envoyer la sonde',
    how: "Sélectionnez la sonde dans le panneau « Flotte » (en haut à gauche, ou touche 1), cliquez sur une étoile de la carte, puis sur « Envoyer ».",
    done: (game) => probes(game).some((s) => s.state === 'travel' || s.starId !== game.stars[game.homeId].id),
    target: 'flotte',
  },
];
// Message de fin, une fois tous les objectifs atteints.
const FINAL_HOW = "Le tutoriel est terminé. Le bouton « ? » (ou la touche H) rappelle les commandes à tout moment.";

export function initTutorial(game, on = true) {
  game.tutorial ??= { on, step: 0 };
}

export const tutorialActive = (game) => !!game.tutorial?.on && game.tutorial.step < TUTORIAL_STEPS.length;
export const currentStep = (game) => (tutorialActive(game) ? TUTORIAL_STEPS[game.tutorial.step] : null);

function say(game, key, how) {
  const voice = TUTORIAL[game.species]?.[key] ?? TUTORIAL['sans-espece'][key];
  game.log.push({ day: currentDay(game), text: `${voice} ${how}`, kind: 'tuto' });
}

// Annonce l'objectif en cours (début de partie, ou tutoriel relancé).
export function announceStep(game) {
  const step = currentStep(game);
  if (step) say(game, step.key, step.how);
}

// À appeler après chaque changement de la partie. Avance d'autant d'objectifs que nécessaire ;
// renvoie true si l'objectif a changé (le conseiller l'a annoncé et le jeu est en pause).
export function updateTutorial(game) {
  if (!tutorialActive(game) || game.ended) return false;
  const before = game.tutorial.step;
  while (game.tutorial.step < TUTORIAL_STEPS.length && TUTORIAL_STEPS[game.tutorial.step].done(game)) game.tutorial.step++;
  if (game.tutorial.step === before) return false;
  if (game.tutorial.step >= TUTORIAL_STEPS.length) say(game, 'fin', FINAL_HOW);
  else announceStep(game);
  game.paused = true; // le temps de lire le nouvel objectif
  return true;
}

// Bouton « Passer » : objectif suivant, sans condition.
export function skipStep(game) {
  if (!tutorialActive(game)) return;
  game.tutorial.step++;
  if (game.tutorial.step >= TUTORIAL_STEPS.length) say(game, 'fin', FINAL_HOW);
  else announceStep(game);
  updateTutorial(game); // l'objectif suivant est peut-être déjà atteint
}

export function hideTutorial(game) {
  if (game.tutorial) game.tutorial.on = false;
}

// Relance depuis l'aide : reprend au premier objectif non atteint.
export function restartTutorial(game) {
  game.tutorial = { on: true, step: 0 };
  while (game.tutorial.step < TUTORIAL_STEPS.length && TUTORIAL_STEPS[game.tutorial.step].done(game)) game.tutorial.step++;
  if (game.tutorial.step >= TUTORIAL_STEPS.length) say(game, 'fin', FINAL_HOW);
  else announceStep(game);
}
