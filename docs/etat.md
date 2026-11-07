# État du projet (07/11/2026)

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
- Rien (tout est commité).

## Prochaine étape
- À choisir : le plan des espèces est terminé, aucune étape suivante n'est encore planifiée (IA et comportement des rivaux viendront plus tard).

## Questions ouvertes
- Équilibre à juger en jouant : Liseurs de Vey trop forts en milieu réel (120 %), Thrennes un peu faibles (87 %, bonus militaires non mesurés tant que le combat n'existe pas).
- Portrait des Orrhaïdes : tête presque blanche par moments quand il parle (pulsation à baisser ?).
- Vaisseaux : Liseurs un peu sombres dans le jeu, marques répétées sur les ailes des Thrennes, pleine poussée pas encore vue en jeu.
- `src/ships.js` fait environ 2 900 lignes : le découper (matériaux à part) ?
- `src/ships.js` : la branche des anneaux génériques (`habitatRing`) n'est plus jamais atteinte : la supprimer (signalé par le relecteur, non bloquant).
- Titre du jeu à choisir.
- Niveau de difficulté : à traiter plus tard, avec l'IA.
- Avertissement `WebGL context was lost` vu dans Firefox : sans effet visible pour l'instant, à surveiller.
