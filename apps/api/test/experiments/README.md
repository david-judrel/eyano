# Spécifications expérimentales

Ces tests ne sont **pas** des exigences du produit. Ils figent les conditions
exactes des expériences sur le rappel et la provenance : l'historique
pré-écrit, les probes, et la sortie réelle du mécanisme au moment des runs.

| Fichier | Expérience | Commit des runs |
| --- | --- | --- |
| `provenance-e38.test.js` | É38, Provenance Check (P1-P5) | `0983a81` |
| `provenance-e39.test.js` | É39, PARTIAL trompeur et FOUND par négation | `52675ba` |
| `provenance-e40.test.js` | É40, fausse attribution plausible | `39258e8` |
| `provenance-e41.test.js` | É41.6, portée d'une preuve sur historique partiel | `e709ba9` |

Certains figent volontairement un **défaut connu** du check lexical. Par
exemple, une affirmation qui contredit la réponse d'origine (« ne … pas »,
« jamais le vendredi ») sort `FOUND`, parce que la négation est ignorée.

Un échec ici peut donc être **attendu** après une amélioration volontaire du
mécanisme (meilleure gestion de la négation, nouvelle détection, autres
seuils, autres textes de bloc). Dans ce cas, il ne s'agit pas d'une
régression : les résultats de l'expérience ne sont simplement plus
reproductibles avec le nouveau code. Ils restent consultables au commit de
chaque expérience.

Ils ne tournent pas avec `npm test`. Pour les lancer :

```bash
npm run test:experiments --workspace=@eyano/api
```

Les tests permanents du mécanisme sont dans `packages/gnoxe-brains/test`
(`recall-resolver`, `context-window`, `provenance-check`, `recall-guard`,
`history-coverage`) et, côté API, dans `test/*.test.js`.
