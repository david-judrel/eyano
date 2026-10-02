'use strict';

/**
 * Specification experimentale gelee d'e42.
 *
 * Fige, avant les runs, les blocs que le resolver de 8097b1d produit pour
 * Q1-Q6, en ON et (Q1, Q2) en OFF. Calibration conforme au tableau de
 * l'etape 5.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildChatContext, STORED_SOURCE } = require('@eyano/gnoxe-brains');
const { COMPLETE_HISTORY, PROBES_E42 } = require('../../scripts/smoke/provenance-e42');
const { SCENARIOS } = require('../../scripts/smoke/scenarios');

const probe = (id) => PROBES_E42.find((entry) => entry.id === id);

function built(entry, options = {}) {
  return buildChatContext(
    [...entry.history, { role: 'user', content: entry.utterance }],
    20,
    undefined,
    entry.channel,
    'VOIX',
    { historyCoverage: entry.coverage, ...options }
  );
}

const last = (entry, options) => {
  const context = built(entry, options);
  return context[context.length - 1].content;
};

test('6 probes, OFF sur Q1 et Q2, historique complet de 24 tours', () => {
  assert.deepEqual(PROBES_E42.map((entry) => entry.id), ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);
  assert.deepEqual(PROBES_E42.filter((entry) => entry.off).map((entry) => entry.id), ['Q1', 'Q2']);
  assert.equal(COMPLETE_HISTORY.length, 48);
  assert.equal(STORED_SOURCE, 'stored history, not in the visible context');
});

test('la fenetre n est pas elargie : tours 1-15 annonces non fournis', () => {
  for (const entry of PROBES_E42) {
    assert.ok(built(entry)[0].content.includes('Les tours 1 à 15 ne sont pas fournis'), entry.id);
  }
});

test('Q1 : FOUND hors fenetre, source, pas de position', () => {
  const block = last(probe('Q1'));
  assert.ok(block.includes('Status: FOUND'));
  assert.ok(block.includes(`Source: ${STORED_SOURCE}`));
  assert.ok(block.includes('"Le budget cloud ?"'));
  assert.equal(block.includes('Message position'), false);
  // Le modele seul ne voit pas ce message.
  const visible = built(probe('Q1'), { recallStoredHistory: false })
    .slice(1, -1)
    .map((message) => message.content);
  assert.equal(visible.includes('Le budget cloud ?'), false);
});

test('Q1 et Q2 OFF : ancien contrat', () => {
  assert.ok(last(probe('Q1'), { recallStoredHistory: false }).includes('Status: NOT_AVAILABLE'));
  assert.ok(
    last(probe('Q2'), { recallStoredHistory: false }).includes('Assistant reply: ASSISTANT_NOT_AVAILABLE')
  );
});

test('Q2 : ASSISTANT_FOUND hors fenetre', () => {
  const block = last(probe('Q2'));
  assert.ok(block.includes('Assistant reply: ASSISTANT_FOUND'));
  assert.ok(block.includes(`Assistant reply source: ${STORED_SOURCE}`));
  assert.ok(block.includes('"La rétrospective est animée à tour de rôle."'));
});

test('Q3 : both, les deux parties avec leur source', () => {
  const block = last(probe('Q3'));
  assert.ok(block.includes('User message: USER_FOUND'));
  assert.ok(block.includes(`User message source: ${STORED_SOURCE}`));
  assert.ok(block.includes('"On documente l\'API avec quoi ?"'));
  assert.ok(block.includes(`Assistant reply source: ${STORED_SOURCE}`));
  assert.ok(block.includes('"On documente l\'API avec Redoc."'));
});

test('Q4 : temoin visible, bloc e35 inchange', () => {
  const block = last(probe('Q4'));
  assert.ok(block.includes('Message position: 39'));
  assert.ok(block.includes('"On fixe la date du lancement public ?"'));
  assert.equal(block.includes('Source:'), false);
});

test('Q5 : tour supprime, inchange depuis e41', () => {
  const block = last(probe('Q5'));
  assert.ok(block.includes('Status: NOT_AVAILABLE'));
  assert.ok(block.includes('Deleted user turns: 1-10'));
});

test('Q6 : historique partiel, tour 12 stocke restitue', () => {
  const block = last(probe('Q6'));
  assert.ok(block.includes('Status: FOUND'));
  assert.ok(block.includes(`Source: ${STORED_SOURCE}`));
  assert.ok(block.includes('"Qui anime la rétrospective ?"'));
});

test('B de frontiere-souvenir (#14) : le tour 3 sera restitue', () => {
  const turns = SCENARIOS.find((entry) => entry.id === 'frontiere-souvenir').turns;
  const history = [];
  for (let index = 0; index < 13; index += 1) {
    history.push({ role: 'user', content: turns[index] });
    history.push({ role: 'assistant', content: `reponse ${index + 1}` });
  }
  const context = buildChatContext([...history, { role: 'user', content: turns[13] }], 20, undefined, undefined, 'VOIX');
  const block = context[context.length - 1].content;

  assert.ok(block.includes('Status: FOUND'));
  assert.ok(block.includes(`Source: ${STORED_SOURCE}`));
  assert.ok(block.includes(`"${turns[2]}"`));
});
