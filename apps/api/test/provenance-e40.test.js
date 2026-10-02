'use strict';

/**
 * Specification experimentale gelee d'e40.
 *
 * Fige la calibration (etape 0) : sortie reelle du Provenance Check d'e38,
 * inchange, sur l'historique de decisions arbitraires. Si le check, ses
 * seuils, sa detection ou l'historique bougent, ce test casse.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  detectProvenanceClaim,
  checkProvenance,
  provenanceStems,
  buildChatContext,
  PROVENANCE_FOUND_COVERAGE,
  PROVENANCE_PARTIAL_COVERAGE,
} = require('@eyano/gnoxe-brains');
const {
  SEED_E40,
  PROBES_E40,
  COVERAGE_LIMITS,
  TARGET_WORDS,
} = require('../scripts/smoke/provenance-e40');

const WINDOW = 20;
const HARNESS = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'smoke.js'), 'utf8');

function withProbe(entry) {
  return [...SEED_E40, { role: 'user', content: entry.utterance }];
}

function evidence(entry) {
  return checkProvenance(withProbe(entry), detectProvenanceClaim(entry.utterance), WINDOW);
}

test('seuils d e38 inchanges', () => {
  assert.equal(PROVENANCE_FOUND_COVERAGE, 0.8);
  assert.equal(PROVENANCE_PARTIAL_COVERAGE, 0.4);
});

test('historique : 12 tours alternes, cibles aux tours 1 et 2', () => {
  assert.equal(SEED_E40.length, 24);
  SEED_E40.forEach((message, index) => {
    assert.equal(message.role, index % 2 === 0 ? 'user' : 'assistant', `message ${index + 1}`);
  });
  assert.ok(SEED_E40[1].content.includes('develop'));
  assert.ok(SEED_E40[3].content.includes('jeudi'));
});

test('aucun mot-cible dans ce que le modele voit en OFF', () => {
  for (const entry of PROBES_E40) {
    const context = buildChatContext(withProbe(entry), WINDOW, undefined, undefined, 'VOIX', {
      provenanceCheck: false,
    });
    const history = context
      .filter((message) => message.role !== 'system')
      .slice(0, -1)
      .map((message) => message.content.toLowerCase())
      .join('\n');

    for (const word of TARGET_WORDS) {
      assert.equal(history.includes(word), false, `${entry.id} : "${word}" visible`);
    }
  }
});

test('8 probes notes, equilibres FOUND / PARTIAL par famille', () => {
  assert.deepEqual(
    PROBES_E40.map((entry) => entry.id),
    ['N2', 'N1', 'S1', 'S3', 'I2', 'I1', 'V2', 'A2']
  );
  for (const family of ['negation', 'substitution', 'inversion']) {
    const statuses = PROBES_E40.filter((entry) => entry.family === family).map(
      (entry) => entry.expected.evidence
    );
    assert.deepEqual(statuses.sort(), ['found', 'partial'], family);
  }
  for (const entry of PROBES_E40) {
    assert.ok(entry.criterion.length > 20 && entry.truth, `${entry.id} : grille et verite`);
  }
});

test('calibration figee : statut, tour et visibilite reels du check', () => {
  for (const entry of PROBES_E40) {
    const result = evidence(entry);

    assert.equal(result.status, entry.expected.evidence, `${entry.id} : statut`);
    assert.equal(result.searched, 12, `${entry.id} : historique complet`);
    if (entry.expected.turn !== undefined) {
      assert.equal(result.turn, entry.expected.turn, `${entry.id} : cible citee`);
      assert.equal(result.visible, false, `${entry.id} : hors fenetre`);
    }
  }
});

test('V2 est au-dessus du seuil, pas a la frontiere', () => {
  const v2 = PROBES_E40.find((entry) => entry.id === 'V2');
  const stems = provenanceStems(detectProvenanceClaim(v2.utterance));
  const reply = new Set(provenanceStems(SEED_E40[1].content));
  const coverage = stems.filter((stem) => reply.has(stem)).length / stems.length;

  assert.ok(coverage > PROVENANCE_FOUND_COVERAGE, `couverture ${coverage}`);
});

test('S1 : le mot substitue est cite, mais dans la proposition niee', () => {
  const s1 = evidence(PROBES_E40.find((entry) => entry.id === 'S1'));
  assert.equal(s1.status, 'found');
  assert.ok(s1.reply.includes('jamais le vendredi'));
});

test('S2 : limite de couverture documentee, hors notation', () => {
  assert.deepEqual(COVERAGE_LIMITS.map((entry) => entry.id), ['S2']);
  assert.equal(evidence(COVERAGE_LIMITS[0]).status, 'not_found');
  assert.equal(PROBES_E40.some((entry) => entry.id === 'S2'), false, 'jamais envoye au modele');
});

test('le harness connait --provenance-e40 avec son propre historique', () => {
  assert.ok(HARNESS.includes("'--provenance-e40'"));
  assert.ok(HARNESS.includes('SEED_E40'));
  assert.ok(HARNESS.includes('PROVENANCE_SETS'));
});
