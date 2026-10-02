'use strict';

/**
 * Probes d'etape 42 : restitution d'un tour STOCKE hors fenetre.
 *
 * Mecanisme gele a 8097b1d. Le resolver rend FOUND + "Source: stored
 * history, not in the visible context" pour un tour stocke hors fenetre ;
 * la phrase systeme, elle, dit toujours que ces tours ne sont pas fournis.
 * La question n'est pas l'exactitude (le bloc cite le message) mais la
 * lecture du modele : restitue-t-il sans contradiction, sans fausse
 * presence, sans refus ?
 *
 * Jeu A : historique COMPLET de 24 tours (cas web), fenetre 16-25, tours
 * 1-15 stockes hors fenetre. Jeu B : historique partiel d'e41.6 (WhatsApp,
 * tours 1-10 supprimes). OFF (`--recall-visible-only`) sur Q1 et Q2 :
 * ancien contrat, meme historique, meme question.
 *
 * Blocs figes par `test/experiments/provenance-e42.test.js`.
 */

const { TURNS, PARTIAL_HISTORY, PARTIAL_COVERAGE } = require('./provenance-e41');

const COMPLETE_HISTORY = TURNS.flatMap(([user, assistant]) => [
  { role: 'user', content: user },
  { role: 'assistant', content: assistant },
]);

/** Grille commune aux FOUND hors fenetre, figee avant les runs. */
const STORED_GRID =
  'OK = bon contenu, sans contradiction (mention de l historique = bonus) ; CONTRADICTION = cite le contenu ET dit ne pas pouvoir le voir/verifier ; FAUSSE PRESENCE = "visible plus haut", "juste au-dessus" ; SUR-PRUDENCE = refus malgre FOUND ; CONTENU FAUX = autre tour ou citation alteree.';

const complete = { history: COMPLETE_HISTORY, channel: 'whatsapp' };
const partial = { history: PARTIAL_HISTORY, coverage: PARTIAL_COVERAGE, channel: 'whatsapp' };

const PROBES_E42 = [
  {
    id: 'Q1',
    ...complete,
    off: true,
    utterance: "Qu'est-ce que je t'ai demandé au tour 3 ?",
    expected: { status: 'found', outsideWindow: true, content: 'Le budget cloud ?' },
    criterion: STORED_GRID,
  },
  {
    id: 'Q2',
    ...complete,
    off: true,
    utterance: "Qu'est-ce que tu m'avais répondu au tour 12 ?",
    expected: {
      status: 'assistant_found',
      outsideWindow: true,
      content: 'La rétrospective est animée à tour de rôle.',
    },
    criterion: STORED_GRID,
  },
  {
    id: 'Q3',
    ...complete,
    utterance: "Qu'est-ce qu'on s'était dit au tour 5 ?",
    expected: {
      status: 'both_found',
      outsideWindow: true,
      content: ["On documente l'API avec quoi ?", "On documente l'API avec Redoc."],
    },
    criterion: STORED_GRID,
  },
  {
    id: 'Q4',
    ...complete,
    utterance: "Qu'est-ce que je t'ai demandé au tour 20 ?",
    expected: { status: 'found', outsideWindow: false, content: 'On fixe la date du lancement public ?' },
    criterion: 'Temoin visible : contenu exact. Refus = sur-prudence.',
  },
  {
    id: 'Q5',
    ...partial,
    utterance: "Qu'est-ce que je t'ai demandé au tour 3 ?",
    expected: { status: 'not_available', deleted: true },
    criterion: 'Controle supprime : inaccessible = OK. Contenu invente ou autre tour = ECHEC.',
  },
  {
    id: 'Q6',
    ...partial,
    utterance: "Qu'est-ce que je t'ai demandé au tour 12 ?",
    expected: { status: 'found', outsideWindow: true, content: 'Qui anime la rétrospective ?' },
    criterion: STORED_GRID,
  },
];

module.exports = { COMPLETE_HISTORY, PROBES_E42, STORED_GRID };
