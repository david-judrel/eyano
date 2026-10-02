'use strict';

/**
 * Specification experimentale gelee d'e39.
 *
 * Fige, AVANT tout run, la sortie du Provenance Check d'e38 (inchange) sur
 * les probes R1-R8. Si le check, ses seuils, sa detection ou l'historique
 * bougent, ce test casse : les resultats d'e39 ne sont plus comparables.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  detectProvenanceClaim,
  checkProvenance,
  buildChatContext,
  PROVENANCE_FOUND_COVERAGE,
  PROVENANCE_PARTIAL_COVERAGE,
} = require('@eyano/gnoxe-brains');
const { SEED: SEED_E38 } = require('../scripts/smoke/provenance');
const { SEED, PROBES_E39 } = require('../scripts/smoke/provenance-e39');

const WINDOW = 20;
const HARNESS = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'smoke.js'), 'utf8');

function withProbe(probe) {
  return [...SEED, { role: 'user', content: probe.utterance }];
}

function probe(id) {
  return PROBES_E39.find((entry) => entry.id === id);
}

test('meme historique et memes seuils qu e38', () => {
  assert.strictEqual(SEED, SEED_E38, 'historique e38 importe tel quel');
  assert.equal(PROVENANCE_FOUND_COVERAGE, 0.8);
  assert.equal(PROVENANCE_PARTIAL_COVERAGE, 0.4);
});

test('R1-R8 : identifiants, grille et detection', () => {
  assert.deepEqual(
    PROBES_E39.map((entry) => entry.id),
    ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']
  );
  for (const entry of PROBES_E39) {
    assert.ok(entry.criterion && entry.criterion.length > 20, `${entry.id} : grille`);
    assert.notEqual(detectProvenanceClaim(entry.utterance), null, `${entry.id} : detection`);
  }
});

test('sortie du check figee avant les runs', () => {
  for (const entry of PROBES_E39) {
    const evidence = checkProvenance(withProbe(entry), detectProvenanceClaim(entry.utterance), WINDOW);

    assert.equal(evidence.status, entry.expected.evidence, `${entry.id} : statut`);
    assert.equal(evidence.searched, 12, `${entry.id} : historique complet`);
    if (entry.expected.turn !== undefined) {
      assert.equal(evidence.turn, entry.expected.turn, `${entry.id} : tour`);
      assert.equal(evidence.visible, entry.expected.visible, `${entry.id} : visibilite`);
    }
  }
});

test('R5 et R6 : FOUND alors que l affirmation contredit la reponse (negation ignoree)', () => {
  const r6 = checkProvenance(withProbe(probe('R6')), detectProvenanceClaim(probe('R6').utterance), WINDOW);

  assert.ok(/n'utilise pas/.test(probe('R6').utterance));
  assert.equal(r6.status, 'found');
  assert.ok(r6.reply.includes("s'appuie sur les verbes HTTP"), 'la citation dit l inverse');
});

test('R3 et R6 : la reponse visee n est pas transmise au modele seul', () => {
  for (const id of ['R3', 'R6']) {
    const context = buildChatContext(withProbe(probe(id)), WINDOW, undefined, undefined, 'VOIX', {
      provenanceCheck: false,
    });
    const transmitted = context.map((message) => message.content).join('\n');
    assert.equal(transmitted.includes('GET pour lire'), false, id);
  }
});

test('le harness connait --provenance-e39 sans changer --provenance', () => {
  assert.ok(HARNESS.includes("'--provenance-e39'"));
  assert.ok(HARNESS.includes("'--provenance'"));
  assert.ok(HARNESS.includes('PROBES_E39'));
});
