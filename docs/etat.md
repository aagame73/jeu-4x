# État du projet (14/11/2026)

## Fait
- Prototype jouable : amas 3D, sondes, Arche, colonies sur hexagones, économie, recherche (46 technologies), sauvegardes, temps réel avec pause.
- Espèces (plan `docs/plan-especes.md`), étapes 1 à 5 :
  - 8 espèces jouables + profil neutre « Colons de l'Arche », écran de choix, conseiller animé à la place du journal ;
  - bonus et malus, planètes favorables / hostiles, équilibre simulé sur 200 jours (§ 11.5 à 11.7) ;
  - vaisseaux au style de chaque espèce, textures procédurales, propulsion animée pour tous (§ 11.8) ;
  - portraits peints et animés des 9 profils ;
  - de 3 à 7 adversaires au choix (4 par défaut) ; espèce, nom d'empire et couleur des rivaux, révélés à l'analyse (§ 12). Pas d'IA.
- Outils : hook de fin de réponse qui lance `npm run build` (`.claude/settings.json`), agent `relecteur` (`.claude/agents/relecteur.md`), serveur lancé au démarrage de Windows.

## En cours
- Rien. **Combat** publié le 08/11/2026. **Vue du système en guerre** (`docs/plan-systeme-guerre.md`) faite le 13/11/2026 : vaisseaux visibles, tirs, explosions, panneau de bataille, ouverture automatique, temps ralenti. Publiée le 14/11/2026.
- **Victoire et fin de partie** (`docs/plan-victoire.md`) faite le 14/11/2026, 5 étapes : 80 % des systèmes colonisables ou plus aucun rival ; mondes natals prenables (30 jours de siège), empire éliminé ; compteur d'objectifs ; écran de fin avec bilan ; animation et réplique de fin par espèce. Animations vérifiées dans Chrome. Publiée le 14/11/2026.

## Prochaine étape (décisions du 08/11/2026)
- **Équilibrage** : une fois le jeu terminé, par simulations (flottes, prix de la paix, pillage, espèces, rivaux, échanges).
- À relire ensemble quand tu veux : les 120 répliques (`docs/dialogues-especes.md`).

## Questions ouvertes
- Équilibre à juger en jouant : Liseurs de Vey trop forts en milieu réel (120 %), Thrennes un peu faibles (87 %, bonus militaires non mesurés tant que le combat n'existe pas).
- Vaisseaux : marques répétées sur les ailes des Thrennes, pleine poussée pas encore vue en jeu.
- Smartphone (simulé le 07/11) : interface à adapter, chantier à part. Tablette plus facile. Écran trop petit, bandeau et panneaux superposés, boutons trop petits.
- `src/ships.js` fait environ 2 900 lignes : le découper (matériaux à part) ?
- Titre du jeu à choisir.
- Mémoire graphique : les modèles 3D des vaisseaux et convois retirés de la carte ne sont pas libérés (dispose) ; à faire si la mémoire grimpe en longue partie.
- Mises à jour : Three.js 0.170 → 0.187 (plan à faire), Vite 6 → 8, Node 24 pour la publication GitHub.
- Prix des échanges (ex. 800 minerais pour un traité) : première estimation, à juger en jouant. Écran de diplomatie pas encore vérifié dans Firefox.
- Publié sur https://aagame73.github.io/jeu-4x/ : chaque `git push` sur `main` republie le site.
- Premier contact : le conseiller lit son annonce sous la cinématique ; la cinématique continue si l'onglet est masqué, et elle est perdue si la page se ferme pendant qu'elle joue.
- Victoire (idée, non codée, `docs/plan-rivaux-ia.md` § 6) : 80 % des systèmes occupés, ou plus d'ennemis. Un système partagé compte pour le joueur ; un rival ne gagne pas ainsi pour l'instant.
- Voix des espèces, décidé le 07/11/2026, à faire plus tard : voix alien générée par le jeu (Web Audio, sans fichier, unique par espèce), avec volume et bouton pour couper. Plan à écrire avant de coder.
- Niveau de difficulté : à traiter plus tard, avec l'IA.
- Fluidité : dans le Chrome piloté pour les tests, 11 à 15 images/s, avec l'ancien code comme avec le nouveau (mesuré le 13/11) : limite de la fenêtre de test, pas une régression. À juger sur ton navigateur.
- Avertissement `WebGL context was lost` vu dans Firefox : sans effet visible pour l'instant, à surveiller.
