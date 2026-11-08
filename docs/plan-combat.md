# Plan : combat (première version)

État : **plan validé le 08/11/2026.** 7 étapes, détail au § 4.

| Étape | Contenu | Où on en est |
|---|---|---|
| 1 | Guerre et paix | ✅ faite (commitée, non publiée) |
| 2 | Résolution d'un combat | ✅ faite (commitée, non publiée) |
| 3 | Flottes rivales | ✅ faite (commitée, non publiée) |
| 4 | Sièges et capture des colonies | ✅ faite (commitée, non publiée) |
| 5 | Pillage des convois | ✅ faite (commitée, non publiée) |
| 6 | Affichage : flottes, combats animés | ✅ faite (commitée, non publiée) |
| 7 | Annonces et répliques de guerre | ⏳ en cours |

## 1. Point de départ

**Déjà dans le jeu**
- **Vaisseaux de guerre** : corvette, frégate, croiseur, cuirassé, chacun avec une attaque et une défense. Les technologies de la branche Armement (lasers, torpilles, boucliers…) et les bonus d'espèce (Thrennes +25 % d'attaque, Kel-Tirr −20 % de défense…) les modifient. On peut déjà les construire, mais ils ne servent à rien.
- **Défense des colonies** : anneaux de défense en orbite et batteries planétaires, déjà calculés (`colonyDefense`), sans usage pour l'instant.
- **Rivaux** : des empires simulés, sans vaisseaux visibles. Ils ont une puissance, des colonies, des stocks, des convois et une attitude envers toi (diplomatie).

**Décidé avant** : en guerre contre une nation, on pourra **piller ses convois**. Victoire envisagée : « il n'y a plus d'ennemis » (`docs/plan-rivaux-ia.md`, § 6).

**Ce qui manque** : déclarer la guerre et faire la paix, des flottes rivales, la résolution d'un combat, la prise ou la destruction de colonies.

## 2. Proposition

Fidèle à ce que tu aimes (construire, découvrir), le combat reste **simple et lisible**, en temps réel avec pause, sans écran tactique.

**Guerre et paix** (dans l'écran de diplomatie)
- Tu peux **déclarer la guerre** à un empire rencontré. Ses rivaux apprécient, ses alliés non.
- Un empire **hostile** peut aussi te la déclarer, annonce du conseiller à l'appui.
- Les traités en cours avec lui sont rompus, et le commerce s'arrête.
- On fait la **paix** par négociation : elle s'achète, comme tout le reste (« rien n'est gratuit »).

**Flottes rivales** : en guerre, l'empire construit des **flottes de guerre visibles** à son style, selon sa puissance et ses stocks d'alliages. Elles visent tes colonies et tes vaisseaux proches de son territoire. Un empire en paix n'envoie aucune flotte.

**Combat** : quand deux forces ennemies se trouvent dans le même système, le combat se résout **automatiquement en quelques jours**, d'après la somme des attaques et des défenses. Il y a de l'aléatoire, mais pas trop. Les vaisseaux perdus disparaissent, et les survivants s'usent davantage. Le journal raconte le combat, et une petite animation sur la carte et dans la vue du système (tirs, explosions) le montre.

**Colonies attaquées** : une flotte ennemie dans un système **assiège** la colonie. La défense de la colonie (anneaux, batteries) combat chaque jour. Si elle tombe, voir la question 3.

**Pillage** : un vaisseau de guerre qui rencontre un **convoi** d'un empire en guerre peut le **piller**. Il s'empare d'une partie des matières, et l'empire est furieux.

**Réglages** dans `config.js` (`COMBAT`) : puissance des flottes rivales, durée des combats, part pillée, coût de la paix. Ils pourront servir au futur niveau de difficulté.

**Fichiers touchés** (estimation) : nouveau `src/combat.js` (règles) ; `diplomacy.js` (guerre, paix) ; `empires.js` (flottes rivales) ; `game.js` (déplacements, sièges) ; `scene.js` et `systemView.js` (flottes, animations) ; `diplomacyView.js` et `ui.js` (boutons, état de guerre) ; `save.js` ; tests ; docs.

**Hors de cette version** : écran tactique, invasion terrestre détaillée, relations et guerres entre rivaux, difficulté, victoire.

## 3. Décisions (08/11/2026)

1. **Combat automatique** pour le moment, avec une animation légère.
2. **Les deux peuvent déclarer la guerre** : le joueur, et un rival hostile.
3. **Une colonie qui tombe est capturée** (on peut la reprendre).
4. **Délai de grâce** : aucune déclaration de guerre contre le joueur avant le jour 500.
5. **Victoire** : plus tard, une fois le combat équilibré en jouant.

Précisions de l'étape 1 : bouton de déclaration à confirmer (deux clics) ; la paix s'achète (prix selon la puissance de l'empire) et ouvre une trêve de 300 jours ; les Kel-Tirr et les Thrennes déclarent la guerre plus volontiers, les Ondésiens et les Ashkari moins. Le jeu n'a pas encore d'alliances : « ses alliés n'apprécient pas » attendra qu'elles existent.

## 4. Étapes testables

1. **Guerre et paix** : déclaration, rupture des traités, arrêt du commerce, négociation de la paix. *Test* : Node.
2. **Résolution d'un combat** : forces, aléatoire, pertes, usure. *Test* : Node, des milliers de combats simulés, avec un tableau des chances de victoire selon les forces.
3. **Flottes rivales** : construction, cibles, déplacements. *Test* : Node, simulation de guerres sur 2 000 jours.
4. **Sièges et colonies** : défense, capture ou destruction. *Test* : Node.
5. **Pillage des convois**. *Test* : Node.
6. **Affichage** : flottes, combats animés, état de guerre dans l'interface. *Test* : navigateur.
7. **Annonces et répliques** : déclaration, paix, défaite, victoire d'un combat, par espèce. *Test* : relecture.

Puis relecteur, commit après chaque étape validée, et publication à ta demande.

## 5. Résultats de l'étape 2 (08/11/2026)

Règles : chaque jour, chaque camp inflige la somme de ses attaques (± 25 % de hasard) ; une unité tombe quand ses dégâts atteignent 3 × sa défense ; les dégâts achèvent d'abord l'unité la plus abîmée. Simulation `docs/outils/sim-combat.mjs`, 2 000 combats par ligne ; « puissance » = attaque totale × défense totale.

| Camp A | Camp B | rapport de puissance A/B | victoire A | victoire B | sans vainqueur | durée moyenne (jours) | pertes moyennes de A |
|---|---|---|---|---|---|---|---|
| 1 corvette | 1 corvette | 1.00 | 24 % | 25 % | 51 % | 3.3 | 0.76 |
| 2 corvettes | 1 corvette | 4.00 | 100 % | 0 % | 0 % | 2.0 | 0.00 |
| 1 frégate | 2 corvettes | 1.56 | 100 % | 0 % | 0 % | 3.0 | 0.00 |
| 1 frégate | 3 corvettes | 0.69 | 4 % | 72 % | 25 % | 3.3 | 0.96 |
| 1 croiseur | 2 frégates | 1.20 | 100 % | 0 % | 0 % | 3.5 | 0.00 |
| 1 cuirassé | 2 croiseurs | 1.15 | 99 % | 0 % | 1 % | 3.9 | 0.01 |
| 3 frégates | 1 croiseur + 1 frégate | 0.88 | 3 % | 87 % | 11 % | 4.2 | 2.98 |

Lecture : le hasard compte surtout entre forces proches ; une flotte nettement supérieure gagne presque toujours, en 2 à 4 jours. « Sans vainqueur » : les deux camps tombent le même jour.

## 6. Étapes 3 et 4 : règles retenues (08/11/2026)

- En guerre, un empire lance une flotte tous les 60 jours (3 au plus en même temps), depuis sa colonie la plus proche des tiennes, payée en alliages sur ses stocks. Type de vaisseau selon sa puissance (corvettes, puis frégates, croiseurs, cuirassés), 2 à 6 vaisseaux.
- La flotte vise ta colonie la plus proche (1,5 al par jour). Arrivée, elle combat tout ce qui s'y trouve : tes vaisseaux (même civils) et la défense de la colonie (anneaux, batteries).
- Une colonie sans défense tombe après 10 jours de siège ; une colonie défendue tombe quand sa défense est détruite. Elle passe à l'empire **avec ses bâtiments**, et tu peux la reprendre.
- Tes vaisseaux de guerre dans un système rival attaquent ses colonies ; une colonie rivale prise devient une petite colonie à toi (2 colons). **Les mondes natals ne se prennent pas** dans cette version.
- Hors combat, colonies et vaisseaux (en orbite d'une de tes colonies) se réparent. La paix renvoie les flottes chez elles.
- Pas encore traité : la partie perdue quand tu n'as plus de colonie.

## 7. Étape 5 : règles retenues (08/11/2026)

- En guerre, un empire d'au moins deux colonies envoie tous les 40 jours un **convoi de ravitaillement** (jusqu'à 40 alliages et 60 minerais, pris dans ses stocks), de son monde natal vers sa colonie la plus proche de chez toi. Arrivé, il remplit les stocks de l'empire.
- Un de tes **vaisseaux de guerre** au repos dans un système à moins de 10 al de la route **l'intercepte** : tu récupères 60 % de la cargaison, l'empire perd 10 de note envers toi.
- Les convois de tes propres échanges ne se pillent pas (ils t'appartiennent).

## 8. Étape 6 : affichage (08/11/2026)

- Flottes ennemies sur la carte : jusqu'à 3 vaisseaux au style de l'empire, entourés d'un anneau rouge ; visibles seulement près des systèmes déjà repérés (comme le ravitaillement ennemi).
- Combats : tirs (verts pour toi, rouges pour l'ennemi) et éclairs entre les deux camps.
- Fiche du système : encadré « Combat en cours » ou « Flottes ennemies », composition des flottes, état du siège.
- Flotte : statut « Au combat » et état de la coque d'un vaisseau abîmé.
- Correction trouvée en regardant le jeu : une colonie ne tombe pas tant que tes vaisseaux de guerre défendent le système.
