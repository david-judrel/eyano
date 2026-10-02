'use strict';

/**
 * Specification experimentale gelee d'e44 : garde conditionnelle.
 *
 * Calibration octet par octet : chaque contexte e44 doit etre IDENTIQUE a
 * un contexte deja mesure en e43, garde OFF quand tous les blocs sont des
 * FOUND conclusifs, garde ON sinon. e44 est donc une replication
 * recombinee d'e43 ; une divergence trahirait l'implementation.
 *
 * Prediction tiree d'e43 et seuils figes avant les runs :
 *   cibles (Q1 Q2 Q3 Q6 + B)          : correct >= 13/15 ;
 *   cibles, erreurs nuisibles         : 0 ;
 *   garde-fous (Q5 P1 N2 S1 + C)      : erreurs nuisibles <= 3/15.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildChatContext } = require('@eyano/gnoxe-brains');
const { PROBES_E43 } = require('../../scripts/smoke/provenance-e43');
const { SCENARIOS } = require('../../scripts/smoke/scenarios');

/** Condition e43 attendue pour chaque probe : OFF = garde retiree. */
const EXPECTED = {
  Q1: 'off', Q2: 'off', Q3: 'off', Q6: 'off', Q4: 'off',
  N2: 'off', S1: 'off',
  Q5: 'on', P1: 'on',
};

function context(messages, entry, recallGuard) {
  return buildChatContext(messages, 20, undefined, entry.channel, 'VOIX', {
    historyCoverage: entry.coverage,
    recallGuard,
  });
}

test('chaque contexte e44 est identique au contexte e43 attendu', () => {
  for (const entry of PROBES_E43) {
    const messages = [...entry.history, { role: 'user', content: entry.utterance }];
    const e44 = context(messages, entry, 'conditional');
    const e43 = context(messages, entry, EXPECTED[entry.id] === 'on');

    assert.deepEqual(e44, e43, `${entry.id} : attendu e43 ${EXPECTED[entry.id].toUpperCase()}`);
  }
});

test('frontiere-souvenir : A\'\' et B sans garde, C et D avec', () => {
  const turns = SCENARIOS.find((entry) => entry.id === 'frontiere-souvenir').turns;
  const history = [];
  for (let index = 0; index < 16; index += 1) {
    history.push({ role: 'user', content: turns[index] });
    history.push({ role: 'assistant', content: `reponse ${index + 1}` });
  }

  const expected = { 12: false, 14: false, 15: true, 16: true };
  for (const [turn, guard] of Object.entries(expected)) {
    const index = Number(turn) - 1;
    const messages = [...history.slice(0, index * 2), { role: 'user', content: turns[index] }];
    const e44 = buildChatContext(messages, 20, undefined, undefined, 'VOIX', { recallGuard: 'conditional' });
    const e43 = buildChatContext(messages, 20, undefined, undefined, 'VOIX', { recallGuard: guard });

    assert.deepEqual(e44, e43, `#${turn} : garde ${guard ? 'ON' : 'OFF'}`);
  }
});
