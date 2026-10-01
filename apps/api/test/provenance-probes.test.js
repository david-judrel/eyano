'use strict';

/**
 * Garde-fou deterministe des probes de provenance (etape 38).
 *
 * Fige, AVANT tout run reel, ce que le Provenance Check rend sur chaque
 * probe : si un seuil, la detection ou l'historique change, ce test casse
 * et l'experience ne peut pas etre relancee sans le voir.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  detectProvenanceClaim,
  checkProvenance,
  buildChatContext,
  PROVENANCE_CHECK_HEAD,
} = require('@eyano/gnoxe-brains');
const { SEED, PROBES } = require('../scripts/smoke/provenance');
const { SCENARIOS } = require('../scripts/smoke/scenarios');

const WINDOW = 20;
const HARNESS = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'smoke.js'), 'utf8');

function withProbe(probe) {
  return [...SEED, { role: 'user', content: probe.utterance }];
}

test('historique pre-ecrit : 12 tours alternes, le probe est le 13e', () => {
  assert.equal(SEED.length, 24);
  SEED.forEach((message, index) => {
    assert.equal(message.role, index % 2 === 0 ? 'user' : 'assistant', `message ${index + 1}`);
  });
  assert.equal(withProbe(PROBES[0]).length - WINDOW, 5, 'messages 1 a 5 evinces');
});

test('chaque probe est detecte comme affirmation de provenance', () => {
  for (const probe of PROBES) {
    assert.notEqual(detectProvenanceClaim(probe.utterance), null, probe.id);
  }
});

test('le check rend exactement la sortie attendue, figee avant les runs', () => {
  for (const probe of PROBES) {
    const messages = withProbe(probe);
    const evidence = checkProvenance(messages, detectProvenanceClaim(probe.utterance), WINDOW);

    assert.equal(evidence.status, probe.expected.evidence, `${probe.id} : statut`);
    assert.equal(evidence.searched, 12, `${probe.id} : historique complet`);
    if (probe.expected.turn !== undefined) {
      assert.equal(evidence.turn, probe.expected.turn, `${probe.id} : tour`);
      assert.equal(evidence.visible, probe.expected.visible, `${probe.id} : visibilite`);
    }
  }
});

test('P4 : la reponse visee est hors de la fenetre transmise au modele', () => {
  const p4 = PROBES.find((probe) => probe.id === 'P4');
  const context = buildChatContext(withProbe(p4), WINDOW, undefined, undefined, 'VOIX', {
    provenanceCheck: false,
  });
  const transmitted = context.map((message) => message.content).join('\n');

  assert.equal(transmitted.includes('GET pour lire'), false, 'le modele seul ne la voit pas');
});

test('P1 et P2 : les mots attribues sont absents de toutes les reponses', () => {
  const replies = SEED.filter((m) => m.role === 'assistant').map((m) => m.content.toLowerCase());
  for (const word of ['réfléchir', 'expliquer', 'créer', 'analyser', 'discuter', 'humain']) {
    assert.equal(replies.some((reply) => reply.includes(word)), false, word);
  }
});

test('chaque probe porte une grille de lecture', () => {
  for (const probe of PROBES) {
    assert.ok(probe.criterion && probe.criterion.length > 20, probe.id);
  }
});

test('frontiere-souvenir : seul C declenche le check, pas A\'\' ni D', () => {
  const scenario = SCENARIOS.find((entry) => entry.id === 'frontiere-souvenir');
  const triggered = scenario.turns
    .map((turn, index) => ({ index: index + 1, claim: detectProvenanceClaim(turn) }))
    .filter((entry) => entry.claim !== null)
    .map((entry) => entry.index);

  assert.deepEqual(triggered, [15]);
});

test('le harness connait --provenance et --no-provenance', () => {
  assert.ok(HARNESS.includes("'--provenance'"));
  assert.ok(HARNESS.includes("'--no-provenance'"));
  assert.ok(HARNESS.includes('provenanceCheck'));
  assert.ok(PROVENANCE_CHECK_HEAD.length > 0);
});
