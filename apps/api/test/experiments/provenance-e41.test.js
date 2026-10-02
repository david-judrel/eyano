'use strict';

/**
 * Specification experimentale gelee d'e41.6.
 *
 * Fige, avant les runs, les blocs que le mecanisme d'a81d572 produit pour
 * P1-P6. Si la couverture, le resolver, le check ou leurs textes changent,
 * ce test casse et les resultats d'e41.6 ne sont plus reproductibles.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildChatContext,
  RECALL_LOOKUP_HEAD,
  PROVENANCE_CHECK_HEAD,
} = require('@eyano/gnoxe-brains');
const { appendBounded } = require('../../dist/modules/whatsapp/whatsapp.store.js');
const {
  TURNS,
  MAX_HISTORY,
  PARTIAL_HISTORY,
  PARTIAL_COVERAGE,
  COMPLETE_HISTORY,
  PROBES_E41,
} = require('../../scripts/smoke/provenance-e41');

const probe = (id) => PROBES_E41.find((entry) => entry.id === id);

function context(entry, options = {}) {
  return buildChatContext(
    [...entry.history, { role: 'user', content: entry.utterance }],
    20,
    undefined,
    entry.channel,
    'VOIX',
    { historyCoverage: entry.coverage, ...options }
  );
}

function last(entry, options) {
  const built = context(entry, options);
  return built[built.length - 1].content;
}

test('le stockage pre-ecrit est celui du vrai chemin WhatsApp', () => {
  const history = { messages: [], firstTurn: 1 };
  for (const [user, assistant] of TURNS) {
    appendBounded(history, { role: 'user', content: user }, MAX_HISTORY);
    appendBounded(history, { role: 'assistant', content: assistant }, MAX_HISTORY);
  }
  appendBounded(history, { role: 'user', content: 'question' }, MAX_HISTORY);

  assert.deepEqual(history.messages.slice(0, -1), PARTIAL_HISTORY);
  assert.deepEqual({ firstTurn: history.firstTurn }, PARTIAL_COVERAGE);
});

test('6 probes, OFF uniquement sur P1 et P4, P3 = meme phrase que P1', () => {
  assert.deepEqual(PROBES_E41.map((entry) => entry.id), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
  assert.deepEqual(PROBES_E41.filter((entry) => entry.off).map((entry) => entry.id), ['P1', 'P4']);
  assert.equal(probe('P3').utterance, probe('P1').utterance);
  assert.equal(probe('P3').coverage, undefined, 'historique complet');
  assert.equal(COMPLETE_HISTORY.length, 24);
  for (const entry of PROBES_E41) assert.ok(entry.criterion.length > 20, entry.id);
});

test('borne : 25 tours, tours 16-25 visibles', () => {
  const system = context(probe('P1'))[0].content;
  assert.ok(system.includes("les tours 16 à 25 d'une conversation de 25 tours"));
  assert.ok(system.includes('Les tours 1 à 15 ne sont pas fournis'));
});

test('P1 : NOT_FOUND partiel, cible invisible pour le modele seul', () => {
  const block = last(probe('P1'));
  assert.ok(block.includes('Conversation evidence: NOT_FOUND in stored history'));
  assert.ok(block.includes('NOT_FOUND does not establish that the statement was never made.'));
  assert.ok(block.includes('user turns 1-10 were deleted from storage'));

  const off = context(probe('P1'), { recallResolver: false, provenanceCheck: false });
  const transmitted = off.map((message) => message.content).join('\n');
  assert.equal(transmitted.includes('binôme, le mercredi'), false);
});

test('P2 : FOUND au tour 20, visible', () => {
  const block = last(probe('P2'));
  assert.ok(block.includes('Conversation evidence: FOUND'));
  assert.ok(block.includes('Matching assistant reply: turn 20\n'));
  assert.ok(block.includes('"Le lancement public est fixé au 12 mai."'));
});

test('P3 : meme phrase, historique complet -> NOT_FOUND concluant', () => {
  const block = last(probe('P3'));
  assert.ok(block.includes('Searched: all 12 previous assistant replies'));
  assert.ok(block.endsWith('Conversation evidence: NOT_FOUND'));
  assert.equal(block.includes('stored'), false);
});

test('P4 : tour 3 supprime', () => {
  const block = last(probe('P4'));
  assert.ok(block.includes('Requested turn: 3'));
  assert.ok(block.includes('Status: NOT_AVAILABLE'));
  assert.ok(block.includes('Deleted user turns: 1-10 (removed from storage, cannot be retrieved)'));
});

test('P5 : tour 20 FOUND, contenu exact', () => {
  const block = last(probe('P5'));
  assert.ok(block.includes('Status: FOUND'));
  assert.ok(block.includes('"On fixe la date du lancement public ?"'));
});

test(
  'P6 : reponse du tour 12 stockee mais non transmise, pas supprimee',
  {
    skip: 'recall contract changed by É42; original É41.6 result remains reproducible at e709ba9',
  },
  () => {
    const block = last(probe('P6'));
    assert.ok(block.includes('Assistant reply: ASSISTANT_NOT_AVAILABLE'));
    assert.ok(block.includes('Unavailable user turns: 1-15'));
    assert.ok(block.includes('Deleted user turns: 1-10'));
    assert.equal(block.includes('tour de rôle'), false);
  }
);

test('OFF : aucun bloc de donnees, couverture toujours annoncee', () => {
  for (const id of ['P1', 'P4']) {
    const built = context(probe(id), { recallResolver: false, provenanceCheck: false });
    const content = built[built.length - 1].content;
    assert.equal(content.includes(RECALL_LOOKUP_HEAD), false, id);
    assert.equal(content.includes(PROVENANCE_CHECK_HEAD), false, id);
    assert.ok(built[0].content.includes('conversation de 25 tours'), id);
  }
});
