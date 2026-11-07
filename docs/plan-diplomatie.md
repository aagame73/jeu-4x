# Plan : diplomatie et échanges (première version)

État : **plan validé le 07/11/2026.** Étapes 1 à 3 faites. Étape 4 codée et testée, en attente de validation.

## 1. Point de départ

**Dans le jeu aujourd'hui** (`docs/plan-rivaux-ia.md`) : les rivaux s'étendent en secret et s'identifient à l'analyse de leur système, avec une cinématique de premier contact. Ils sont simulés : ils n'ont ni stocks, ni bâtiments, ni technologies.

**Conséquence de « tout s'échange »** : le commerce n'est plus une étape séparée. Diplomatie et commerce se font ensemble, puis vient le combat. Il faut aussi donner aux rivaux de quoi échanger, en restant simulés.

## 2. Décisions (07/11/2026)

1. **Accords** : échange de cartes, traité de frontières et pacte de ruines, plus **échange de matières** et **échange de technologies**. La négociation des planètes inutilisées, d'abord demandée, est retirée (§ 4, décision 1).
2. **Rien n'est gratuit** : chaque accord est un échange, avec une contrepartie.
3. **Contact** : un rival non découvert ne peut pas te contacter. Un rival rencontré le peut. **Commercer avec une espèce fait chuter ta note auprès de ses rivaux.**
4. **Rupture d'un traité** : seulement par une colonie fondée trop près, avec un avertissement.
5. **Dialogues** : écrits à la main, par espèce.

## 3. Proposition

**Écran Diplomatie** : bouton dans le bandeau et touche D, jeu en pause comme pour la recherche. Il liste uniquement les empires rencontrés. Fiche d'un empire : portrait animé, attitude et ses raisons, rivaux de cette espèce, accords en cours, bouton « Négocier ».

**Note et attitude** : une note de -100 à 100 par empire, traduite en attitude (Hostile, Méfiant, Neutre, Amical, Allié). Hostile n'entraîne aucune attaque tant que le combat n'existe pas.

| Cause | Effet sur la note |
|---|---|
| Départ, selon le style | Ondésiens et Ashkari plus ouverts ; Thrennes et Kel-Tirr plus fermés |
| Échange conclu avec cet empire | Hausse |
| **Échange conclu avec un de ses rivaux** | **Baisse, selon la valeur de l'échange** |
| Colonies du joueur proches | Baisse lente |
| Traité respecté dans la durée | Hausse lente |
| Traité rompu | Forte baisse, durable |
| Fouilles de ruines, selon l'espèce | Ondésiens et Orrhaïdes mécontents ; Synodes et Liseurs intéressés |
| Temps | Retour lent vers la valeur de départ |

**Négociation** : un écran à deux colonnes, « Tu donnes » et « Tu reçois ». Tu composes l'offre, l'empire accepte ou refuse et dit pourquoi, dans le ton de son espèce. Il peut proposer une contre-offre simple.

| Ce qui s'échange | Détail |
|---|---|
| **Matières** | Minerais, alliages, biomasse, eau, deutérium, Vélarine, artefacts. Pas l'énergie, qui ne se transporte pas (concept). |
| **Technologies** | Seulement si l'acheteur a déjà les prérequis. |
| **Cartes** | L'empire révèle ses colonies actuelles. Le joueur peut vendre les siennes. |
| **Traité de frontières** | Aucune colonie de l'un près des colonies de l'autre, pour une durée fixée. |
| **Pacte de ruines** | L'empire laisse les ruines de ta zone. |

**Acceptation** : chaque élément a une valeur (`config.js`). L'empire accepte si ce qu'il reçoit vaut assez par rapport à ce qu'il donne. Sa note envers toi et son style modifient ce seuil, et une matière qu'il a en abondance vaut moins pour lui.

**Rivaux simulés, mais capables d'échanger.**
- **Stocks** : chaque empire a un stock par matière, qui monte avec ses colonies selon son style et baisse quand il vend. Il ne peut pas donner ce qu'il n'a pas.
- **Technologies** : sa liste est déduite de sa puissance et de son style, sans simuler toute la recherche. Une technologie vendue à un empire augmente sa puissance, donc sa portée.
- **Limite** : les échanges de technologies ne doivent pas remplacer la recherche. Prix élevés, délai entre deux échanges, et le palier 4 ne se vend pas (proposition).

**Initiative des rivaux** : un empire rencontré peut proposer un échange ou formuler une demande, en ton propre à son espèce. Le conseiller l'annonce, sans mettre le jeu en pause ; on ouvre la proposition ou on l'ignore, et elle expire. Jamais avant le premier contact.

**Dialogues écrits à la main** : pour chaque espèce, accueil, acceptation, refus, contre-offre, proposition, rupture et changement d'attitude, en plusieurs variantes. Environ 8 × 10 = 80 phrases, à relire ensemble.

**Sauvegarde** : nouveaux champs dans chaque empire (`relation`, `stocks`, `treaties`, dates, propositions en cours), validés au chargement. Une ancienne sauvegarde démarre avec la note de départ, des stocks calculés et aucun accord.

**Fichiers touchés** : nouveaux `src/diplomacy.js` (notes, valeurs, accords, convois), `src/diplomacyView.js`, `src/styles/diplomatie.css` ; `scene.js` (convois sur la carte) ; `config.js` (réglages, rivalités, dialogues) ; `empires.js` (stocks, technologies, traités dans le choix des planètes) ; `game.js` ; `research.js` (technologies reçues) ; `save.js` ; `ui.js`, `main.js`, `advisor.js` ; docs.

**Hors de cette version** : combat, guerre, attaque de convois, relations qui changent entre rivaux, routes logistiques, difficulté, voix, victoire.

## 4. Décisions complémentaires (07/11/2026)

1. **Planètes** : pas de concession (option B). Le joueur continue à coloniser librement les planètes libres d'un système rival ; un rival n'entre toujours pas dans un système où le joueur a une colonie.
2. **Rivalités** : table fixe dans `config.js`, affichée sur la fiche. Vaskhar ↔ Ondésiens, Kel-Tirr ↔ Orrhaïdes, Synodes ↔ Thrennes, Liseurs ↔ Vaskhar, Ashkari ↔ Kel-Tirr.
3. **Livraison par convois** :
   - seules les **matières** voyagent ; technologies, cartes et traités prennent effet tout de suite ;
   - ce que tu donnes quitte ton stock à la signature ; ce que tu reçois n'arrive qu'à la fin du trajet ;
   - le trajet relie la colonie la plus proche de chaque camp, et sa durée dépend de la distance ;
   - le convoi est un vaisseau **visible sur la carte**, au style de l'empire ; on ne peut ni l'attaquer ni le perdre tant que le combat n'existe pas ;
   - les convois en route sont enregistrés dans la sauvegarde.
4. **Propositions des rivaux** : environ une tous les 100 jours par empire rencontré, réglable dans `config.js`.

## 5. Étapes testables

1. **Notes et attitudes** : valeurs, causes, rivalités, sauvegarde. *Test* : Node, évolution sur 2 000 jours, ancienne sauvegarde et sauvegarde invalide.
2. **Stocks et technologies des rivaux** : *Test* : Node, simulation sur 5 000 jours, stocks jamais négatifs, technologies cohérentes avec la puissance.
3. **Valeurs et acceptation** : matières, technologies, cartes, puis note des rivaux. *Test* : Node, une offre rentable est acceptée, une offre sans contrepartie est toujours refusée, les rivaux de l'empire perdent de la note.
4. **Traités et pacte de ruines** : effet sur l'expansion, avertissement et rupture. *Test* : Node, un empire sous traité ne fonde jamais dans la zone.
5. **Écran et négociation** : bouton, touche D, fiches, offres. *Test* : navigateur.
6. **Convois** : départ, trajet, arrivée, sauvegarde, affichage sur la carte. *Test* : Node (une matière n'arrive qu'à la fin du trajet, un rechargement ne perd rien) et navigateur.
7. **Initiative et dialogues** : propositions, expiration, jamais sans premier contact, textes par espèce. *Test* : Node, navigateur et relecture des textes.

Puis relecteur et commit après validation de chaque étape. Publication sur le site seulement à ta demande.

## 6. Résultats de l'étape 2 (07/11/2026)

Simulation `docs/outils/sim-diplomatie.mjs` : 7 rivaux, 4 graines, sans joueur, valeurs moyennes.

| Espèce | Jour | Colonies | Minerais | Alliages | Vélarine | Technologies |
|---|---|---|---|---|---|---|
| Vaskhar | 200 | 5 | 424 | 144 | 8 | 1 |
| Vaskhar | 2000 | 21 | 3150 | 1260 | 105 | 10 |
| Vaskhar | 5000 | 35 | 5250 | 2100 | 175 | 24 |
| Synodes | 200 | 3 | 203 | 98 | 5 | 2 |
| Synodes | 2000 | 14 | 2100 | 840 | 70 | 24 |
| Synodes | 5000 | 24 | 3600 | 1440 | 120 | 41 |
| Thrennes | 2000 | 17 | 2550 | 1020 | 85 | 12 |
| Ashkari | 2000 | 17 | 2550 | 1020 | 85 | 20 |

**Réglé à l'étape 3** : le plafond de Vélarine passe de 5 à 1 par colonie et son gain de 0,01 à 0,002 par jour. Ce tableau montre les valeurs d'avant ce réglage.
