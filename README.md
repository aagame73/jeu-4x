# L'Arche des Veilleurs

Jeu de stratégie spatiale (4X) en solo contre l'ordinateur, dans le navigateur : explorer un amas d'étoiles en 3D, fonder des colonies, bâtir, chercher, négocier ou combattre. Le temps s'écoule en continu, en jours ; on peut le mettre en pause à tout moment. Une partie dure de 5 à 10 heures.

## Jouer en ligne

👉 **https://aagame73.github.io/jeu-4x/**

Il suffit d'un navigateur récent (Chrome, Edge, Firefox ou Safari de 2023 ou plus récent) avec WebGL. Les parties sont sauvegardées dans le navigateur : une sauvegarde automatique tous les 5 jours, trois emplacements manuels (touche Échap) et un export dans un fichier.

## Premiers pas

Un **tutoriel** guide les débuts : le conseiller de votre espèce annonce chaque objectif, et un halo montre où cliquer. On peut le désactiver sur l'écran du choix de l'espèce, le passer ou le masquer, et le relancer depuis l'aide (bouton **?** ou touche **H**). Les étapes :

1. **Choisir son espèce** : chacune a une force et une faiblesse. Choisir aussi la difficulté, la taille de la carte et le nombre d'adversaires.
2. **Analyser le système** : l'Arche, le vaisseau colonie, arrive avec des moteurs de saut cassés. Cliquez sur son étoile, puis sur **Analyser avec l'Arche**.
3. **Fonder la colonie** : à la fin de l'analyse, choisissez une planète (**Fonder une colonie ici**), puis la case où poser le centre de la colonie.
4. **Construire** : cliquez sur une case de la surface pour voir ce qu'on peut y bâtir. Commencez par un **laboratoire** pour faire avancer la recherche.
5. **Rechercher** (touche **R**) : *Moteurs de saut* et *Mécanique orbitale* débloquent le **spatioport**, à construire sur une plaine ou un désert.
6. **Lancer une sonde** : dans la colonie (**Gérer la colonie**), le panneau du chantier spatial propose la sonde. Une fois construite, elle apparaît dans le panneau **Flotte**, en haut à gauche. Sélectionnez-la, cliquez sur une étoile de la carte, puis sur **Envoyer**.
7. **Explorer et s'étendre** : les sondes découvrent les systèmes et les empires rivaux. Le dock spatial permet ensuite de construire des vaisseaux colonie, des vaisseaux de guerre et des défenses.

Le conseiller de votre espèce, en bas à gauche, commente les événements de la partie.

**Victoire** : occuper 80 % des systèmes colonisables, ou qu'il ne reste plus aucun rival. **Défaite** : plus aucune colonie, ni de vaisseau pour en fonder une.

## Commandes

| Touche ou geste | Action |
|---|---|
| Espace | Pause / reprise |
| + / − | Vitesse du temps (×1, ×2, ×4) |
| R | Recherche |
| D | Diplomatie |
| H | Aide (commandes, premiers pas, relancer le tutoriel) |
| F | Plein écran |
| Échap | Menu (sauvegarder, charger) ou retour |
| 1 à 9 | Choisir un vaisseau |
| Clic | Sélectionner |
| Double-clic | Centrer la vue (sur une étoile : voir son système) |
| Glisser | Faire pivoter la vue |
| Clic droit + glisser | Déplacer la vue |
| Molette | Zoom |

## Lancer le jeu sur son ordinateur (développement)

Il faut [Node.js](https://nodejs.org/) 20.19 ou plus récent (24 conseillé).

```bash
npm install      # une seule fois : installe Three.js et Vite
npm run dev      # lance le jeu sur http://localhost:5173
```

- `npm run build` construit la version publiable dans `dist/`, et `npm run preview` permet de la tester.
- `http://localhost:5173/?graine=42` rejoue toujours le même amas ; `?espece=vaskhar` saute le choix de l'espèce.
- Tests : `node docs/outils/test-<nom>.mjs .` (par exemple `test-combat`).

Chaque envoi sur la branche `main` republie automatiquement le site sur GitHub Pages.

## Technique

JavaScript sans framework, rendu 3D avec [Three.js](https://threejs.org/), construction avec [Vite](https://vite.dev/). Le code est dans `src/` : génération de l'amas (`galaxy.js`), règles et temps réel (`game.js`), rendu 3D (`scene.js`, `systemView.js`, `planetView.js`), vaisseaux procéduraux (`ships.js` et `src/ships/`), économie, recherche, rivaux, diplomatie, combat et victoire. Les images peintes sont dans `public/`.
