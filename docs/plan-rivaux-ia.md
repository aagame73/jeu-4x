# Plan : comportement des rivaux (première version de l'IA)

État : **plan validé le 07/11/2026.** Étapes 1 et 2 codées et testées (résultats au § 5), non commitées. Étapes 3 et 4 à venir.

## 1. Point de départ

**Dans le jeu aujourd'hui** (voir `docs/plan-especes.md`, § 12) : de 3 à 7 rivaux, chacun avec une espèce, un nom d'empire, une couleur et un monde natal. Ils sont immobiles. Leur seul effet est de rendre leur planète non colonisable. Ils ne sont pas enregistrés : on les recalcule depuis la graine, l'espèce du joueur et leur nombre.

**Ce que le concept prévoit** : des rivaux qui « partent à la conquête du même amas », rencontrés au fil de l'exploration, chacun avec sa façon de jouer. On peut commercer, négocier ou entrer en guerre avec eux. La Vélarine et les ruines sont disputées.

**Ce qui manque** : le combat, la diplomatie et le commerce n'existent pas. Les vaisseaux ont des valeurs d'attaque et de défense, mais rien ne les utilise.

**Écart à noter** : le concept dit « 3 à 5 adversaires » et décrit 6 espèces, dont les Humains. Le jeu a maintenant 3 à 7 adversaires et 8 espèces. Les Thrennes, les Liseurs et les Ashkari n'ont donc pas encore de style d'IA (proposition au § 2).

## 2. Proposition : des rivaux qui s'étendent, sans combat

Objectif : l'amas change pendant que le joueur l'explore. C'est testable seul, et cela prépare le combat et la diplomatie sans les exiger.

**Empire simulé.** Chaque rival a un état simple : ses colonies, un niveau de puissance et de technologie, une réserve de points d'expansion. Il ne construit pas sur des hexagones et ne gère ni énergie ni recherche détaillée. Avec le temps, il gagne des points selon son style, et fonde une colonie quand il en a assez, sur une planète de portée qu'il préfère.

**Styles.** Valeurs dans `config.js` :

| Espèce | Style | Effet dans cette version |
|---|---|---|
| Vaskhar | Expansion | Rapide, vers les planètes riches en gisements |
| Ondésiens | Commerce | Moyen, océaniques et glacées |
| Kel-Tirr | Agressif | Rapide, prend les systèmes libres près des autres |
| Synodes | Technologie | Lent, puissance qui monte plus vite |
| Orrhaïdes | Technologie puis expansion | Lent, puis rapide ; attirés par les ruines |
| Thrennes (proposé) | Agressif | Moyen, se rapproche des voisins |
| Liseurs de Vey (proposé) | Savoir | Lent, priorité aux ruines |
| Ashkari (proposé) | Commerce | Moyen, longues distances, attirés par le deutérium |

**Règles communes.**
- Un rival respecte son milieu : pas de planète hostile au début.
- Il ne prend jamais une planète déjà occupée par le joueur ou un autre empire.
- Une planète prise par un rival devient non colonisable pour le joueur (règle déjà en place).
- **Colonies cachées** : aucune colonie rivale n'est visible au départ. Le joueur découvre celles d'un système quand l'un de ses vaisseaux s'y trouve (à l'arrivée, ou sur place au moment de la fondation). Une colonie fondée après son passage reste inconnue jusqu'à la visite suivante. Si le joueur vise sans le savoir une planète prise, il l'apprend en arrivant.
- L'identité reste révélée à l'analyse du système (règle déjà en place).
- Le rythme vise une partie de 5 à 10 heures. À surveiller : sans joueur, avec 7 rivaux, l'amas est presque plein vers le jour 20 000 (relecture du 07/11 : 88 % des planètes), soit environ 5 h 30 à x1 sans pause.

**Sauvegarde.** Nouveau champ `empires` (colonies, puissance, points, colonies déjà découvertes). Une ancienne sauvegarde sans ce champ repart de zéro : chaque rival n'a que son monde natal, quelle que soit la date de la partie. Si une planète qu'un rival voudrait est déjà colonisée par le joueur, la règle ci-dessus s'applique.

**Fichiers touchés.** Nouveau `src/empires.js` (règles des rivaux) ; `config.js` (styles, rythme) ; `game.js` (appel chaque jour, colonies dans `foundingProblem`) ; `save.js` ; `scene.js`, `systemView.js`, `ui.js` (colonies rivales, territoire) ; `advisor.js` (annonces) ; docs.

**Difficulté** : pas dans cette version, mais tout le rythme des rivaux passe par des réglages de `config.js`, pour pouvoir y brancher un niveau de difficulté plus tard.

**Hors de cette version** : combat, guerre, diplomatie, commerce, vaisseaux rivaux visibles, difficulté, voix.

## 3. Décisions (07/11/2026)

1. **Simulation** : empire simulé. Un niveau de difficulté viendra plus tard.
2. **Vaisseaux et colonies rivales** : pas de vaisseaux visibles ; colonies invisibles au départ, découvertes au gré des voyages.
3. **Premier contact** : petite animation (si ce n'est pas trop compliqué) et annonce du conseiller. Proposition : le portrait animé du rival apparaît quelques secondes en surimpression, à sa couleur, avec son nom d'empire, sans mettre le jeu en pause ni demander de clic. On réutilise `createAlienPortrait`, donc c'est peu de travail.
4. **Ruines** : les rivaux peuvent prendre les planètes à ruines.
5. **Ordre de la suite** : diplomatie, puis commerce, puis combat.

### 3.1 Confirmé

- **Fil rouge** : pour qu'il reste toujours réalisable, les rivaux ne prennent jamais les dernières planètes à ruines encore libres. Proposition : ils en laissent toujours au moins 3 (réglage dans `config.js`), jusqu'à ce que le combat permette de les reprendre.
- **Systèmes du joueur** : pas de colonie rivale dans un système où le joueur a une colonie, tant que le combat et la diplomatie n'existent pas (proposition), sinon le joueur subirait sans pouvoir réagir.

## 4. Étapes testables

1. **Empires et sauvegarde** : `empires.js`, état initial, enregistrement. *Test* : Node, aller-retour de sauvegarde et ancienne sauvegarde.
2. **Expansion** : points, choix de la planète, règles communes. *Test* : Node, simulation de 1 000 jours sur plusieurs graines et de 3 à 7 rivaux. Tableau dans ce plan : colonies par style, part de l'amas occupée, planètes restantes près du joueur, planètes à ruines restées libres.
3. **Découverte et affichage** : colonies révélées par les vaisseaux, carte et fiches, rien de visible avant. *Test* : Node (rien n'est connu sans visite) et navigateur.
4. **Premier contact** : animation et annonce du conseiller, une seule fois par rival, conservé à la sauvegarde. *Test* : navigateur.

Puis relecteur, et commit après validation de chaque étape.

## 5. Résultats des étapes 1 et 2 (07/11/2026)

Tests : `docs/outils/test-rivaux.mjs`. Simulation : `docs/outils/sim-rivaux.mjs`, 6 graines × 2 espèces de joueur, sans joueur actif. Les rivaux ne construisent rien : seul leur nombre de colonies change.

La découverte par les vaisseaux est déjà en place, car sans elle le joueur aurait pu fonder sur une planète prise. Il reste, à l'étape 3, à l'afficher correctement sur la carte.

| Rivaux | Jour | Colonies par empire | Part de l'amas occupée | Planètes libres à moins de 40 al du joueur | Planètes à ruines libres (minimum) |
|---|---|---|---|---|---|
| 3 | 500 | 6,9 | 5 % | 126 | 8,3 (7) |
| 3 | 2000 | 17,6 | 11 % | 125,1 | 4,7 (3) |
| 3 | 5000 | 30,4 | 20 % | 119,9 | 4,2 (3) |
| 4 | 500 | 7 | 6 % | 125,7 | 8 (7) |
| 4 | 2000 | 17,1 | 15 % | 123,4 | 4,3 (3) |
| 4 | 5000 | 29,5 | 26 % | 115 | 3,8 (3) |
| 7 | 500 | 7,1 | 11 % | 124,8 | 7,2 (6) |
| 7 | 2000 | 17,1 | 26 % | 113,8 | 3,5 (3) |
| 7 | 5000 | 29,4 | 45 % | 90,3 | 3 (3) |

Colonies par espèce avec 4 rivaux (jour 500 / 2000 / 5000) : Vaskhar et Kel-Tirr 8 à 9 / 21 / 35 ; Ondésiens, Thrennes et Ashkari 8 / 17 / 29 ; Orrhaïdes 6 / 18 / 33 ; Synodes et Liseurs 6 / 14 / 24.

**Durée d'une partie** : pas de durée fixée en jours (l'utilisateur n'a pas de repère de temps) ; le rythme actuel est gardé pour l'instant et se règle dans `RIVAL_AI` (`config.js`).

## 6. Conditions de victoire (idée de l'utilisateur, 07/11/2026, non codée)

Le joueur gagne s'il **occupe 80 % des systèmes** ou s'il **n'y a plus d'ennemis**. La seconde condition demande le combat. Le concept prévoit aussi une victoire par le fil rouge (Éveil de l'Héritage).

Part des systèmes colonisables touchés par les rivaux, simulation sans joueur, 6 graines :

| Rivaux | Jour | Au moins un rival | Plus grand empire |
|---|---|---|---|
| 3 | 5 000 | 37 % | 17 % |
| 3 | 20 000 | 69 % | 35 % |
| 3 | 50 000 | 86 % | 47 % |
| 4 | 5 000 | 45 % | 17 % |
| 4 | 20 000 | 78 % | 34 % |
| 4 | 50 000 | 95 % | 48 % |

Décidé (recommandations acceptées) : un système où le joueur a une colonie compte pour lui, même partagé avec un rival. Un rival ne peut pas gagner ainsi tant qu'il n'existe ni diplomatie ni combat.
