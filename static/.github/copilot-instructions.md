# GitHub Copilot – Instructions pour ce dépôt

## Contexte du projet

- Projet : **WhistAppMB**
- Objectif : application web de scoring pour le jeu de cartes Whist (13 cartes) pour 4, 5 ou 6 joueurs.
- Frontend : **SvelteKit + TypeScript**.
- PWA : support offline, service worker et manifest dans `/static`.
- Déploiement : cible navigateur (tablette + téléphone), style “casino vert + or”.

## Règles importantes pour l’IA

- **Ne pas modifier la logique métier du Whist** (calcul des plis, annonces, emballages, dames, cumul des scores) sans explication détaillée dans les commentaires.
- **Préserver la structure des routes SvelteKit** :
  - `/src/routes/home` : écran d’accueil / choix compétition / table.
  - `/src/routes/annonces` : encodage des donnes.
  - `/src/routes/admin` : partie administrative.
- Éviter les refactorings massifs qui touchent plusieurs fichiers à la fois ; privilégier des améliorations localisées et bien commentées.
- Garder le code lisible, avec des noms de variables explicites en anglais ou en français cohérent (pas d’abréviations obscures).

## Style de code souhaité

- Utiliser **Svelte + TypeScript** de manière idiomatique (réactivité avec `$:`, stores, etc.).
- Préférer du code simple et lisible à des patterns trop abstraits.
- Respecter le style actuel de l’UI : fond vert foncé, accents dorés, ambiance “casino”.
- Quand c’est pertinent, proposer des composants réutilisables dans `src/lib`.

## 🎨 Palette de couleurs — Thème "Casino Premium"

L’interface utilise un style visuel “casino premium” inspiré des tables de jeu élégantes.
Copilot doit respecter cette identité graphique dans toutes ses suggestions UI/CSS.

### Couleurs principales
- **Vert profond (fond principal)** : `#04140A` ou `rgb(4,20,10)`
- **Vert secondaire** (dégradés, ombres) : `#0B3A18` / `#020506`
- **Or premium (accents, bordures, highlights)** : `#F9C824` ou `rgb(250,191,36)`
- **Blanc doux pour les textes** : `rgba(255,255,255,0.85)`

### Style et ambiance
- Ambiance **casino luxueux** avec contrastes vert + or.
- Dégradés subtils, ombres douces, coins arrondis élégants.
- Jamais de couleurs flashy ou hors palette (pas de rose, violet, bleu électrique).
- Les tableaux doivent évoquer une **table de jeu** : tons verts, séparateurs or.

### Ce que Copilot doit respecter
- Utiliser cette palette dans les nouveaux composants.
- Garder la cohérence graphique dans les popups, boutons, formulaires.
- Préférer des designs sobres, premium, inspirés du monde du jeu de cartes.



## 🎨 Branding UI Premium — Directives complètes

### Layout général
- Utiliser un **dégradé radial vert sombre** comme fond global :
  ```css
  background: radial-gradient(
    circle at 50% 0%,
    #0b3a18 0%,
    #04140a 45%,
    #020506 100%
  );

  
## Ce que Copilot peut faire

- Aider à écrire ou compléter des composants Svelte (pages, modales, tableaux de scores).
- Proposer des améliorations de performance ou de lisibilité pour le code TypeScript.
- Aider à gérer les appels à l’API backend (fetch, gestion des erreurs, retries, offline).
- Suggérer du CSS/animations légères compatibles avec le design existant.
- Aider à écrire des tests (Vitest, tests de pages Svelte) pour la logique critique.

## Ce que Copilot doit éviter

- Ne pas introduire de dépendances lourdes sans justification.
- Ne pas supprimer des validations métier (ex. contrôle du nombre de joueurs, cohérence des scores).
- Ne pas modifier le comportement PWA (service worker, manifest) sans commentaire clair.
- Ne pas produire du texte d’interface en anglais si le reste est en français (préférer le français).

