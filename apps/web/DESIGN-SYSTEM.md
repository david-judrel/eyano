# EYANO — Design System

La fondation visuelle officielle d'EYANO. Toute interface se compose à partir
de ce qui est décrit ici : on n'invente ni couleur, ni taille, ni arrondi, ni
style de bouton, de carte ou de fenêtre.

- **Valeurs** : `src/styles/tokens.css` (seule source), exposées par
  `tailwind.config.ts` sous des noms sémantiques.
- **Composants** : `src/components/ui` (primitives), `layout`, `chat`, `ai`.
- **Garde-fous** : `npm run test -w apps/web` vérifie le contraste WCAG des
  jetons (`scripts/contrast-check.mjs`) et l'absence de valeurs hors système
  dans le code (`scripts/design-lint.mjs`).
- **Vitrine** : `/design-system` (hors production) montre chaque primitive
  dans chaque état, en clair et en sombre.

---

## 1. Principes

1. **Le vert est un signal.** `#39FF14` dit « EYANO agit » : l'action
   principale, le focus clavier, une activité de l'IA en cours. Il n'est
   jamais une couleur de texte courant, de bordure décorative ni de halo.
2. **Le calme d'abord.** Des neutres profonds, trois niveaux de surface, peu
   de bordures. L'interface s'efface devant la conversation.
3. **La hiérarchie par l'espace et la typographie.** On sépare avec de
   l'espace, on hiérarchise avec la taille et la graisse — pas avec des
   cadres, des ombres ou des couleurs.
4. **Toujours lisible.** Chaque texte atteint WCAG AA dans les deux thèmes.
   La discrétion s'obtient avec une couleur plus douce, jamais avec de
   l'opacité.
5. **Une seule grammaire pour l'intelligence.** Recherche, image, outil,
   mission : la même ligne d'activité, quatre états. Une nouvelle capacité
   n'invente pas un nouveau composant.
6. **Le mouvement informe.** Il annonce une apparition, un changement d'état,
   un flux en cours. Jamais pour décorer ; désactivé si l'utilisateur le
   demande.
7. **Une échelle fermée.** Neuf niveaux de texte, une échelle d'espacement,
   quatre arrondis, trois ombres, quatre tailles d'icône. Une valeur qui n'y
   est pas n'existe pas.

---

## 2. Couleurs

Les composants n'utilisent **que** ces noms. Les deux thèmes fournissent les
mêmes jetons avec des valeurs différentes (`:root` = clair, `.dark` = sombre).

### Surfaces

| Jeton (classe) | Rôle |
|---|---|
| `bg-background` | Fond de l'application |
| `bg-background-subtle` | Fond légèrement décalé (zones secondaires, barre latérale) |
| `bg-surface` | Surface posée sur le fond : bulle de l'utilisateur, code, champ |
| `bg-surface-raised` | Surface en relief : carte, compositeur |
| `bg-surface-overlay` | Ce qui flotte : menu, popover, fenêtre, info-bulle |
| `bg-surface-inverse` / `text-foreground-inverse` | Contraste inversé (info-bulle) |
| `bg-hover` · `bg-pressed` · `bg-selected` | Calques d'interaction, posés sur n'importe quelle surface |
| `bg-scrim` | Voile derrière une fenêtre ou un tiroir |

### Texte

| Jeton | Rôle | Contraste minimal |
|---|---|---|
| `text-foreground` | Texte principal, titres | ≥ 16:1 |
| `text-foreground-secondary` | Texte d'accompagnement, libellés | ≥ 8.9:1 |
| `text-foreground-muted` | Métadonnées, aides, horodatages | ≥ 5:1 |
| `text-foreground-disabled` | Élément désactivé (seul cas sous AA, autorisé par WCAG) | — |

### Bordures

| Jeton | Rôle |
|---|---|
| `border-border-subtle` | Séparateurs, contours très discrets |
| `border-border` | Contour par défaut (champ, carte) |
| `border-border-strong` | Contour au survol, élément à distinguer |

### Marque

| Jeton | Rôle |
|---|---|
| `bg-brand` (+ `-hover`, `-active`) | Remplissage de l'action principale |
| `text-brand-foreground` | Texte posé sur le vert |
| `text-brand-text` | Vert lisible sur le fond du thème (sombre : `#39FF14`, clair : vert foncé) |
| `bg-brand-subtle` | Fond teinté : activité en cours, élément actif |
| `outline-focus` (`--ey-focus`) | Anneau de focus clavier |

### États

`success`, `warning`, `error`, `info` — chacun en deux jetons : la couleur
(texte, icône) et `-subtle` (fond teinté). Exemple : `bg-error-subtle text-error`.
`success` est le vert EYANO : une réussite est une action d'EYANO aboutie.

---

## 3. Typographie

Inter (texte) et JetBrains Mono (code, données), chargées par `next/font`
(`--font-sans`, `--font-mono`). Graisses autorisées : 400, 500, 600.

| Classe | Taille / interligne | Graisse | Usage |
|---|---|---|---|
| `text-display` | 36 / 44 | 600 | Écran d'accueil, très rare |
| `text-heading-xl` | 28 / 36 | 600 | Titre de page |
| `text-heading-lg` | 22 / 30 | 600 | Titre de section |
| `text-heading-md` | 18 / 26 | 600 | Titre de carte, de fenêtre |
| `text-heading-sm` | 15 / 22 | 600 | Petit titre, groupe |
| `text-body-lg` | 16 / 26 | 400 | Lecture longue |
| `text-body-md` | 15 / 24 | 400 | **Texte par défaut**, messages du chat |
| `text-body-sm` | 13 / 20 | 400 | Texte compact, listes |
| `text-label` | 13 / 18 | 500 | Boutons, champs, menus |
| `text-caption` | 12 / 16 | 400 | Métadonnées, horodatages, badges |
| `text-code` + `font-mono` | 13 / 20 | 400 | Code, commandes, journaux, sorties d'agents |

Pas de taille sous 12 px. La graisse vient avec la taille : on n'ajoute
`font-medium` / `font-semibold` que pour distinguer un élément dans un texte.

---

## 4. Espacement

Base 4 px, échelle restreinte (classes Tailwind correspondantes) :

| Pas | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| px | 2 | 4 | 6 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80 | 96 |

Repères : `gap-1.5` icône + texte · `gap-2` éléments d'un contrôle · `gap-3`
éléments d'une liste · `gap-6` blocs · `p-4` intérieur de carte · `px-4`
gouttière mobile, `px-6` desktop · `py-6` entre messages.
Valeurs interdites (lint) : `2.5`, `3.5`, `7`, `9`, `11`, `14`, `28`, `36` et
toute valeur entre crochets.

## 5. Arrondis

| Classe | Valeur | Rôle |
|---|---|---|
| `rounded-sm` | 6 px | Badge, code en ligne, case à cocher |
| `rounded-md` | 10 px | Bouton, champ, élément de menu |
| `rounded-lg` | 14 px | Carte, menu, popover, bulle de message, image |
| `rounded-xl` | 20 px | Fenêtre, tiroir, compositeur |
| `rounded-full` | — | Avatar, pastille, interrupteur |

Un conteneur arrondi contient des éléments d'un niveau inférieur.

## 6. Élévation

| Classe | Rôle |
|---|---|
| (aucune) | Par défaut : la profondeur vient des surfaces |
| `shadow-subtle` | Élément posé (compositeur au repos) |
| `shadow-raised` | Carte au survol, élément flottant léger |
| `shadow-overlay` | Menu, popover, fenêtre, toast |

Pas de halo, pas de lueur colorée. Le survol change le fond (`bg-hover`), la
bordure (`border-border-strong`) ou la couleur du texte — pas l'ombre.

## 7. Mouvement

| Jeton | Valeur | Usage |
|---|---|---|
| `duration-fast` | 120 ms | Survol, appui, petit changement d'état |
| `duration-normal` | 200 ms | Apparition d'un menu, d'un message |
| `duration-slow` | 320 ms | Tiroir, fenêtre, déplacement |
| `ease-standard` | (0.2, 0, 0, 1) | Par défaut |
| `ease-emphasized` | (0.16, 1, 0.3, 1) | Entrée d'un élément |

Animations nommées : `fade-in`, `fade-out`, `scale-in` (overlay), `slide-up`
(message), `slide-in-left/right` (tiroir), `pulse-subtle` (activité en cours),
`shimmer` (squelette). `prefers-reduced-motion` les neutralise toutes.

## 8. Couches (z-index)

`z-raised` 10 (élément au-dessus de ses voisins) · `z-sticky` 20 (barre
supérieure) · `z-overlay` 40 (voile + tiroir) · `z-dropdown` 50 (menu,
popover) · `z-modal` 60 (fenêtre) · `z-toast` 70 · `z-tooltip` 80.

## 9. Responsive

Points de rupture Tailwind, une seule charnière structurante : **`lg`**.

| Nom | Largeur | Comportement |
|---|---|---|
| mobile | < 640 | Barre latérale en tiroir, barre supérieure visible, compositeur pleine largeur, gouttière `px-4`, fenêtres en feuille basse |
| tablette | 640–1023 | Idem mobile, contenus centrés, fenêtres centrées |
| desktop | ≥ 1024 (`lg`) | Barre latérale fixe (`w-sidebar`), barre supérieure masquée dans le chat |
| large | ≥ 1280 (`xl`) | Idem desktop ; le contenu reste plafonné à `max-w-content` (800 px) |

Admin : navigation en tiroir sous `lg` ; sous `sm`, les tableaux deviennent
des listes en cartes (aucun défilement horizontal) ; statistiques en 2 puis
4 colonnes.

### Tactile : la variante `touch:`

`touch:` cible les écrans pilotés au doigt (`@media (pointer: coarse)`),
indépendamment de la largeur. Elle est intégrée aux primitives :

| Élément | Souris | Doigt |
|---|---|---|
| `Button` sm / md | 32 / 40 px | 40 / 44 px |
| `IconButton` sm / md | 32 / 40 px | 40 / 44 px |
| Élément de menu, ligne de conversation | 36 px | 44 px |
| Champs (`Input`, `Textarea`, compositeur) | 15 px | **16 px** (iOS ne zoome pas) |

Le zoom de la page reste autorisé (pas de `user-scalable=no`). Les zones
sûres (`safe-top`, `safe-bottom`) protègent la barre supérieure, le tiroir
et les fenêtres en feuille basse de l'encoche et de la barre d'accueil.

## 10. Icônes

Lucide uniquement. Tailles : `icon-xs` 14 · `icon-sm` 16 (défaut, dans un
bouton) · `icon-md` 20 (navigation, état vide) · `icon-lg` 24 (rare).
Une icône seule dans un bouton → `IconButton` avec `label` obligatoire.

---

## 11. Composants

### Primitives (`components/ui`)

| Composant | Notes |
|---|---|
| `Button` | Variantes `primary` (vert, une par vue), `secondary`, `outline`, `ghost`, `destructive` ; tailles `sm` 32 / `md` 40 / `lg` 48 ; `loading` |
| `IconButton` | `label` **obligatoire** (nom accessible + info-bulle), mêmes variantes, tailles `sm` / `md` / `lg` |
| `Input`, `Textarea`, `Select`, `Checkbox`, `Switch` | Branchés sur `Field` |
| `Field` | `label`, `description`, `error`, `required` ; relie les `aria-*` |
| `Badge` | `neutral`, `brand`, `success`, `warning`, `error`, `info` |
| `Avatar`, `Separator`, `Skeleton`, `Spinner`, `Progress` | |
| `Tooltip`, `Popover`, `DropdownMenu`, `Dialog`, `Sheet`, `Tabs` | Radix : focus piégé, Échap, clic extérieur, clavier |
| `Card` | Surface `raised`, bordure, `rounded-lg`, `p-4` |
| `Alert` | Message en ligne, ton d'état |
| `Toast` | `role="status"`, ton d'état, empilé en bas |

### Layout (`components/layout`)

`AppShell`, `Sidebar`, `TopBar`, `PageHeader`, `Container`.

### Chat (`components/chat`)

`UserMessage`, `AssistantMessage`, `MessageActions`, `Attachments`,
`ImageResult`, `StreamingCursor`, `MessageError`, `EmptyChat`, `Composer`.

### IA (`components/ai`)

`ActivityStep` (la grammaire unique), `SourceList`, `ProgressNote`.

---

## 12. Langage du chat

| Type | Comment on le reconnaît |
|---|---|
| Utilisateur | Aligné à droite, bulle `bg-surface`, `rounded-lg`, largeur max 85 % |
| EYANO | Aligné à gauche, **sans bulle** : texte sur le fond, pleine largeur de colonne |
| Activité | Ligne `ActivityStep` au-dessus de la réponse |
| Erreur | Ligne avec icône `error`, texte `foreground-secondary`, action « Réessayer » |
| Pièce jointe / image | Vignette `rounded-lg` bordée, dans le message qui la porte |
| Source | `SourceList` : liens `text-caption`, sous la réponse |

Le vert n'apparaît que pendant une activité réelle (curseur de flux, activité
en cours) et sur le bouton d'envoi.

## 13. Langage de l'IA

```
[icône]  Libellé                     ← ActivityStep
         détail / progression
```

États : `idle` (gris), `running` (icône verte qui pulse), `success` (coche
verte), `error` (icône `error`). Recherche, Kepler, outils, missions
utilisent **tous** `ActivityStep` ; seuls l'icône et le libellé changent.

## 14. Accessibilité

- Focus clavier unique et visible partout (`:focus-visible`, jeton `focus`).
- Toute action a un nom accessible ; un `IconButton` sans `label` ne compile pas.
- Overlays Radix : focus piégé, retour du focus, Échap, clic extérieur.
- Zones tactiles ≥ 32 px (40 px sur mobile pour les actions principales).
- État désactivé : `foreground-disabled` + `cursor-not-allowed`, jamais seulement une opacité.
- `prefers-reduced-motion` respecté globalement.
- Contraste AA de chaque paire de jetons vérifié automatiquement.

## 15. Garde-fou

`scripts/design-lint.mjs` refuse : couleur en dur (`#…`, `rgb()`), couleur
Tailwind brute (`red-500`…), `white`/`black`, couleur ou taille entre
crochets, opacité de couleur (`text-foreground/30`), taille ou graisse hors
échelle, ombre hors système, halo, `z-index` numérique, arrondi hors échelle,
espacement hors échelle, anciens alias. Exceptions motivées dans `EXEMPT`.

## 16. Exemple

```tsx
<Card>
  <h2 className="text-heading-md">Clés du fournisseur</h2>
  <p className="mt-1 text-body-sm text-foreground-muted">Mises à jour en temps réel.</p>
  <div className="mt-4 flex gap-2">
    <Button variant="primary">Réinitialiser</Button>
    <IconButton label="Actualiser" icon={RefreshCw} variant="ghost" />
  </div>
</Card>
```
