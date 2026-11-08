# Plan : combat (première version)

État : **plan validé le 08/11/2026** (décisions au § 3). Étape 1 (guerre et paix) codée et testée, en attente de validation.

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

## 4. Étapes testables (à préciser après tes réponses)

1. **Guerre et paix** : déclaration, rupture des traités, arrêt du commerce, négociation de la paix. *Test* : Node.
2. **Résolution d'un combat** : forces, aléatoire, pertes, usure. *Test* : Node, des milliers de combats simulés, avec un tableau des chances de victoire selon les forces.
3. **Flottes rivales** : construction, cibles, déplacements. *Test* : Node, simulation de guerres sur 2 000 jours.
4. **Sièges et colonies** : défense, capture ou destruction. *Test* : Node.
5. **Pillage des convois**. *Test* : Node.
6. **Affichage** : flottes, combats animés, état de guerre dans l'interface. *Test* : navigateur.
7. **Annonces et répliques** : déclaration, paix, défaite, victoire d'un combat, par espèce. *Test* : relecture.

Puis relecteur, commit après chaque étape validée, et publication à ta demande.
