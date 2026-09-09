# Mia Insights

Site public de démonstration : ce que devient l'analyse de données quand une page
entière se demande en français au lieu de se développer.

**Toutes les données de ce site sont fictives.** Elles ne décrivent aucun assureur
réel, ni portefeuille, ni clients, ni salariés, ni résultats. Aucun nom de personne
n'y figure. Les valeurs sont produites par un générateur pseudo-aléatoire à graine
fixe, pour que le site montre la même chose à chaque ouverture.

## Le site

| Page | Ce qu'elle contient |
|---|---|
| `index.html` | l'accueil : le point de bascule, les quatre paliers de question, un premier graphique |
| `le-principe.html` | ce que change un agent qui écrit du code et l'exécute, et les quatre conditions à réunir |
| `les-analyses.html` | six exemples métier : tarification, provisionnement, sinistres, attrition, fraude, enquête interne |
| `la-methode.html` | formuler, vérifier, les quatre erreurs silencieuses, un atelier d'une demi-journée |
| `demo/` | l'application : on écrit une phrase, une page complète apparaît dans la navigation |
| `apropos.html` | ce que le site est, comment il est fait |

## Comment ça tourne

Aucune dépendance, aucun chargement externe, aucun serveur. Le site s'ouvre en
`file://` comme sur GitHub Pages.

| Fichier | Rôle |
|---|---|
| `assets/site.css` | la feuille de style du site |
| `assets/nav.js` | la barre de navigation, une seule liste à modifier pour ajouter une page |
| `assets/viz.js` | la bibliothèque de graphiques, écrite à la main en SVG |
| `assets/viz.css` | les couleurs et le cadre des graphiques |
| `demo/data.js` | le jeu de données fictif, à graine fixe |
| `demo/app.js` | l'application : état, vues, recettes d'analyse, panneau de conversation |
| `demo/app.css` | le châssis de l'application, barre latérale et panneau |

## Deux règles à garder si vous reprenez ce code

1. **Une seule échelle de valeurs par graphique**, jamais deux axes. Barres de
   vingt-quatre pixels au plus à bout arrondi du côté de la valeur, deux pixels de
   surface entre deux marques qui se touchent, étiquettes directes sur les seuls
   extrêmes, et jamais la couleur d'une série portée par du texte.
2. **La longueur de ligne se règle par la largeur de la colonne**, jamais par un
   `max-width` posé sur un paragraphe, un titre ou une liste. Sinon le texte devient
   plus étroit que le graphique d'à côté et les bords droits ne s'alignent plus.
