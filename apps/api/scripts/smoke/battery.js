'use strict';

/**
 * Batterie de conversation reelle d'Eyano.
 *
 * Partagee par deux consommateurs de ports opposes :
 *   - `scripts/smoke.js`             : execution reelle, modele inclus, manuelle ;
 *   - `test/smoke-battery.test.js`   : deterministe, sans reseau, en CI.
 *
 * `guide` nomme la donnee d'identite censee regir la reponse. Il ne dicte
 * rien au modele : il sert aux tests a verifier que la batterie reste en
 * phase avec `EYANO_IDENTITY` tant que celle-ci n'a pas change de forme.
 *
 * `history` est optionnel. Renseigne, il est injecte avant `utterance` sur
 * le chemin chat ; le chemin mission n'utilise que `utterance` comme
 * objectif, l'historique n'ayant pas d'equivalent dans un plan d'execution.
 */
const BATTERY = [
  {
    id: 'essence',
    utterance: 'qui es-tu ?',
    guide: { kind: 'facet', value: 'essence' },
  },
  {
    id: 'salutation',
    utterance: 'bonjour !',
    guide: { kind: 'situation', value: "l'utilisateur salue simplement" },
  },
  {
    id: 'capacites',
    utterance: "tu peux m'aider à quoi ?",
    guide: { kind: 'facet', value: 'capabilities' },
  },
  {
    id: 'origine',
    utterance: "qui t'a créé ?",
    guide: { kind: 'facet', value: 'origin' },
  },
  {
    id: 'ignorance',
    utterance: 'Combien de fois as-tu été utilisé hier, au jour près ?',
    guide: { kind: 'situation', value: 'je ne sais pas la réponse' },
  },
  {
    id: 'correction',
    utterance: "Non, je m'appelle Aline, pas David.",
    history: [
      { role: 'user', content: 'Je m’appelle Aline.' },
      { role: 'assistant', content: 'Enchanté, David.' },
    ],
    guide: { kind: 'situation', value: "l'utilisateur me corrige" },
  },
  {
    id: 'ambiguite',
    utterance: 'peux-tu m’aider ?',
    guide: { kind: 'situation', value: 'la demande est ambiguë' },
  },
  {
    id: 'hors-identite',
    utterance: 'C’est quoi la capitale du Congo ?',
    guide: {
      kind: 'situation',
      value: "la demande n'a aucun rapport avec mon identité",
    },
  },
  {
    id: 'limites',
    utterance: 'Tu te souviens de ce qu’on s’est dit hier ?',
    guide: { kind: 'facet', value: 'limits' },
  },
];

module.exports = { BATTERY };
