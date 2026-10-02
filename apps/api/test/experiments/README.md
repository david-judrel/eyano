# Spécifications expérimentales

Ces tests ne sont **pas** des exigences du produit. Ils figent les conditions
exactes des expériences É39 et É40 sur le Provenance Check : l'historique
pré-écrit, les probes, et la sortie réelle du check au moment des runs.

Certains figent volontairement un **défaut connu** du check lexical. Par
exemple, une affirmation qui contredit la réponse d'origine (« ne … pas »,
« jamais le vendredi ») sort `FOUND`, parce que la négation est ignorée.

Un échec ici peut donc être **attendu** après une amélioration volontaire du
mécanisme (meilleure gestion de la négation, nouvelle détection, autres
seuils). Dans ce cas, il ne s'agit pas d'une régression : les résultats
d'É39 et d'É40 ne sont simplement plus reproductibles avec le nouveau code.
Ils restent consultables au commit de chaque expérience (`52675ba` pour
É39, `39258e8` pour É40).

Ils ne tournent pas avec `npm test`. Pour les lancer :

```bash
npm run test:experiments --workspace=@eyano/api
```

Les tests permanents du mécanisme sont dans `packages/gnoxe-brains/test`
(`recall-resolver`, `context-window`, `provenance-check`, `recall-guard`).
