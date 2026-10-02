'use strict';

/**
 * Etape 41 : historique partiel declare par l'appelant.
 *
 * Scenario de reference (e41.0) : conversation reelle de 25 tours, canal qui
 * ne garde que 30 messages. Stocke : la reponse du tour 10, puis les tours
 * 11 a 25 (firstTurn = 11). Fenetre de 20 : tours 16 a 25 visibles.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildChatContext,
  resolveRecallTurn,
  buildRecallLookup,
  checkProvenance,
  buildProvenanceCheck,
  describeVisibleTurns,
  normalizeCoverage,
  provenanceStems,
  RECALL_LOOKUP_HEAD,
  PROVENANCE_CHECK_HEAD,
} = require('../dist/index.js');

const VOICE = 'VOIX_NEUTRE';
const WORDS = [
  'pommier', 'tracteur', 'violon', 'glacier', 'boussole', 'lanterne', 'corbeau', 'sablier',
  'tambour', 'volcan', 'harpon', 'citadelle', 'perroquet', 'toboggan', 'marmite', 'escargot',
  'girafe', 'hamac', 'igloo', 'jongleur', 'kayak', 'lavande', 'mandoline', 'nenuphar',
];

/** 24 tours passes ; la reponse du tour t contient le mot WORDS[t-1]. */
function realPast() {
  const messages = [];
  WORDS.forEach((word, index) => {
    messages.push({ role: 'user', content: `question du tour ${index + 1}` });
    messages.push({ role: 'assistant', content: `Retiens bien ceci : ${word} orange.` });
  });
  return messages;
}

/** Ce que le canal transmet : les 30 derniers messages, question comprise. */
function stored(question) {
  return [...realPast(), { role: 'user', content: question }].slice(-30);
}

const PARTIAL = { firstTurn: 11 };

function lastContent(question, coverage = PARTIAL) {
  const context = buildChatContext(stored(question), 20, undefined, undefined, VOICE, {
    historyCoverage: coverage,
  });
  return { system: context[0].content, last: context[context.length - 1].content };
}

// ------------------------------------------------------------ couverture

test('couverture : valeurs incoherentes -> numerotation inconnue', () => {
  assert.deepEqual(normalizeCoverage(undefined), { firstTurn: 1 });
  assert.deepEqual(normalizeCoverage({ firstTurn: 11 }), { firstTurn: 11 });
  for (const bad of [0, -3, 2.5, Number.NaN]) {
    assert.deepEqual(normalizeCoverage({ firstTurn: bad }), { firstTurn: null }, String(bad));
  }
});

test('fenetre en tours reels', () => {
  assert.deepEqual(describeVisibleTurns(stored('x'), 20, 11), {
    turnCount: 25,
    first: 16,
    last: 25,
    partialTurn: 15,
  });
});

// ---------------------------------------------------------- borne system

test('borne : conversation de 25 tours, pas de 15', () => {
  const { system } = lastContent('bonjour');
  assert.ok(system.includes("les tours 16 à 25 d'une conversation de 25 tours"), system);
  assert.ok(system.includes('Les tours 1 à 15 ne sont pas fournis, sauf ta réponse au tour 15'));
  assert.equal(system.includes('15 tours'), false);
});

test('borne : historique partiel annonce meme s il tient dans la fenetre', () => {
  const short = stored('bonjour').slice(-9);
  const context = buildChatContext(short, 20, undefined, undefined, VOICE, {
    historyCoverage: { firstTurn: 21 },
  });
  assert.ok(context[0].content.includes('### Historique visible'));
  assert.ok(context[0].content.includes('Les tours 1 à 20 ne sont pas fournis'));
});

test('borne : numerotation inconnue -> aucun numero annonce', () => {
  const { system } = lastContent('bonjour', { firstTurn: null });
  assert.ok(system.includes('des échanges plus anciens ont été supprimés'));
  assert.equal(/tours? \d/.test(system.split('### Historique visible')[1]), false);
});

// --------------------------------------------------------------- resolver

test('resolver : un tour supprime est NOT_AVAILABLE, marque supprime', () => {
  const result = resolveRecallTurn(stored('x'), 3, 20, 'user', PARTIAL);
  assert.equal(result.status, 'not_available');
  assert.equal(result.reason, 'deleted');

  const block = buildRecallLookup(
    stored("Qu'est-ce que je t'ai demandé au tour 3 ?"),
    stored("Qu'est-ce que je t'ai demandé au tour 3 ?"),
    20,
    PARTIAL
  );
  assert.ok(block.includes('Conversation user turns: 25'));
  assert.ok(block.includes('Visible user turns: 16-25'));
  assert.ok(block.includes('Deleted user turns: 1-10 (removed from storage, cannot be retrieved)'));
});

test('resolver : le tour 12 reel rend le tour 12, jamais le 22', () => {
  const result = resolveRecallTurn(stored('x'), 12, 40, 'user', PARTIAL);
  assert.equal(result.status, 'found');
  assert.equal(result.message, 'question du tour 12');
});

test('resolver : le tour 20 visible est FOUND', () => {
  const result = resolveRecallTurn(stored('x'), 20, 20, 'user', PARTIAL);
  assert.equal(result.status, 'found');
  assert.equal(result.message, 'question du tour 20');
});

test('resolver : la reponse orpheline appartient au dernier tour supprime', () => {
  const result = resolveRecallTurn(stored('x'), 10, 30, 'assistant', PARTIAL);
  assert.equal(result.reason, 'deleted');
  assert.equal(result.user.status, 'not_available');
  assert.equal(result.assistant.status, 'found');
  assert.ok(result.assistant.content.includes('volcan'), 'reponse du tour 10');
});

test('resolver : numerotation inconnue -> aucun contenu, aucun compte', () => {
  const question = "Qu'est-ce que je t'ai demandé au tour 12 ?";
  const block = buildRecallLookup(stored(question), stored(question), 20, { firstTurn: null });
  assert.ok(block.includes('Status: NOT_AVAILABLE'));
  assert.ok(block.includes('Turn numbering: unknown (earlier messages were deleted from storage)'));
  assert.equal(block.includes('question du tour'), false);
  assert.equal(block.includes('Conversation user turns'), false);
});

// ---------------------------------------------------------- provenance

test('provenance : supprime -> NOT_FOUND dans le stockage, jamais "all"', () => {
  const question = "Tu m'avais dit que je devais retenir tracteur orange, c'est bien ça ?";
  const block = buildProvenanceCheck(stored(question).slice(-20), stored(question), 20, PARTIAL);

  assert.ok(block.startsWith(PROVENANCE_CHECK_HEAD));
  assert.equal(block.includes('Searched: all'), false);
  assert.ok(block.includes('Searched: the 15 stored assistant replies'));
  assert.ok(block.includes('user turns 1-10 were deleted from storage and could not be searched'));
  assert.ok(block.includes('Conversation evidence: NOT_FOUND in stored history'));
  assert.ok(block.includes('NOT_FOUND does not establish that the statement was never made.'));
});

test('provenance : stocke hors fenetre -> tour reel', () => {
  const question = "Tu m'avais dit que je devais retenir citadelle orange, c'est bien ça ?";
  const evidence = checkProvenance(stored(question), 'je devais retenir citadelle orange', 20, PARTIAL);
  assert.equal(evidence.turn, 12);
  assert.equal(evidence.visible, false);
});

test('provenance : la reponse orpheline est au dernier tour supprime, jamais au tour 0', () => {
  const evidence = checkProvenance(stored('x'), 'retenir volcan orange', 30, PARTIAL);
  assert.equal(evidence.turn, 10);

  const complete = [{ role: 'assistant', content: 'Retiens bien ceci : volcan orange.' }, { role: 'user', content: 'x' }];
  const orphan = checkProvenance(complete, 'retenir volcan orange', 20);
  assert.equal(orphan.turn, undefined, 'historique complet sans question : tour inconnu');
  assert.ok(!buildProvenanceCheck(
    [...complete.slice(0, 1), { role: 'user', content: "tu m'as dit que je devais retenir volcan orange ?" }],
    [...complete.slice(0, 1), { role: 'user', content: "tu m'as dit que je devais retenir volcan orange ?" }],
    20
  ).includes('turn 0'));
});

test('provenance : numerotation inconnue -> partiel, tour inconnu', () => {
  const question = "Tu m'avais dit que je devais retenir citadelle orange, c'est bien ça ?";
  const block = buildProvenanceCheck(stored(question).slice(-20), stored(question), 20, { firstTurn: null });
  assert.ok(block.includes('earlier messages were deleted from storage and could not be searched'));
  assert.ok(block.includes('turn unknown'));
});

test('provenance : identifiants numeriques gardes entiers', () => {
  assert.deepEqual(provenanceStems('decision2 decision10 decision20'), ['decision2', 'decision10', 'decision20']);
  const messages = [
    { role: 'user', content: 'a' },
    { role: 'assistant', content: 'la decision10 est validee' },
    { role: 'user', content: 'b' },
    { role: 'assistant', content: 'la decision2 est validee' },
  ];
  assert.equal(checkProvenance(messages, 'la decision2 est validee', 20).turn, 2);
});

// --------------------------------------------------------------- temoin

test('sans couverture : sortie identique a l historique complet declare', () => {
  const question = "Tu m'avais dit que je devais retenir tracteur orange, c'est bien ça ?";
  const full = [...realPast(), { role: 'user', content: question }];
  const implicit = buildChatContext(full, 20, undefined, undefined, VOICE);
  const explicit = buildChatContext(full, 20, undefined, undefined, VOICE, {
    historyCoverage: { firstTurn: 1 },
  });
  assert.deepEqual(explicit, implicit);
  assert.ok(implicit[implicit.length - 1].content.includes('Searched: all'));
  assert.ok(implicit[implicit.length - 1].content.includes(RECALL_LOOKUP_HEAD) === false);
});
