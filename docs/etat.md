# État du projet (07/11/2026, fin de session)

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
- Diplomatie et échanges (`docs/plan-diplomatie.md`) : étapes 1 à 5 faites, relues et publiées le 08/11/2026. Écran touche D : empires rencontrés, attitudes, négociation (matières, technologies, cartes, traité de frontières, pacte de ruines).

## Prochaine étape
- Étape 6 : convois visibles sur la carte (matières livrées à la fin du trajet). Puis étape 7 : propositions des rivaux et dialogues écrits à la main par espèce (environ 80 phrases, à relire ensemble).
- Ensuite : combat, dont le **pillage des convois** d'une nation en guerre.

## Questions ouvertes
- Équilibre à juger en jouant : Liseurs de Vey trop forts en milieu réel (120 %), Thrennes un peu faibles (87 %, bonus militaires non mesurés tant que le combat n'existe pas).
- Vaisseaux : marques répétées sur les ailes des Thrennes, pleine poussée pas encore vue en jeu.
- Smartphone (simulé le 07/11) : interface à adapter, chantier à part. Tablette plus facile. Écran trop petit, bandeau et panneaux superposés, boutons trop petits.
- `src/ships.js` fait environ 2 900 lignes : le découper (matériaux à part) ?
- Titre du jeu à choisir.
- Prix des échanges (ex. 800 minerais pour un traité) : première estimation, à juger en jouant. Écran de diplomatie pas encore vérifié dans Firefox.
- Publié sur https://aagame73.github.io/jeu-4x/ : chaque `git push` sur `main` republie le site.
- Premier contact : le conseiller lit son annonce sous la cinématique ; la cinématique continue si l'onglet est masqué, et elle est perdue si la page se ferme pendant qu'elle joue.
- Victoire (idée, non codée, `docs/plan-rivaux-ia.md` § 6) : 80 % des systèmes occupés, ou plus d'ennemis. Un système partagé compte pour le joueur ; un rival ne gagne pas ainsi pour l'instant.
- Voix des espèces, décidé le 07/11/2026, à faire plus tard : voix alien générée par le jeu (Web Audio, sans fichier, unique par espèce), avec volume et bouton pour couper. Plan à écrire avant de coder.
- Niveau de difficulté : à traiter plus tard, avec l'IA.
- Avertissement `WebGL context was lost` vu dans Firefox : sans effet visible pour l'instant, à surveiller.
