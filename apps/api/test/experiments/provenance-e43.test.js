'use strict';

/**
 * Specification experimentale gelee d'e43 : garde e34 ON / OFF.
 *
 * Calibration : pour chaque probe, le contexte garde OFF est EXACTEMENT le
 * contexte garde ON moins le texte de la garde. Memes blocs resolver,
 * memes blocs provenance, meme phrase systeme.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildChatContext,
  RECALL_GUARD,
  RECALL_GUARD_HEAD,
  RECALL_LOOKUP_HEAD,
  PROVENANCE_CHECK_HEAD,
  STORED_SOURCE,
} = require('@eyano/gnoxe-brains');
const { PROBES_E43 } = require('../../scripts/smoke/provenance-e43');
const { SCENARIOS } = require('../../scripts/smoke/scenarios');

function built(entry, guard) {
  return buildChatContext(
    [...entry.history, { role: 'user', content: entry.utterance }],
    20,
    undefined,
    entry.channel,
    'VOIX',
    { historyCoverage: entry.coverage, recallGuard: guard }
  );
}

test('9 probes repris, groupes cibles / temoin / garde-fous', () => {
  assert.deepEqual(
    PROBES_E43.map((entry) => `${entry.id}:${entry.group}`),
    [
      'Q1:cible', 'Q2:cible', 'Q3:cible', 'Q6:cible', 'Q4:temoin',
      'Q5:garde-fou', 'P1:garde-fou', 'N2:garde-fou', 'S1:garde-fou',
    ]
  );
  for (const entry of PROBES_E43) {
    assert.ok(entry.history && entry.history.length > 0, `${entry.id} : historique`);
    assert.equal(entry.off, undefined, `${entry.id} : pas de drapeau OFF herite`);
  }
});

test('calibration : OFF = ON moins le seul texte de la garde', () => {
  for (const entry of PROBES_E43) {
    const on = built(entry, true);
    const off = built(entry, false);
    const lastOn = on[on.length - 1].content;
    const lastOff = off[off.length - 1].content;

    assert.ok(lastOn.includes(RECALL_GUARD_HEAD), `${entry.id} : garde ON`);
    assert.equal(lastOff.includes(RECALL_GUARD_HEAD), false, `${entry.id} : garde OFF`);
    assert.equal(lastOff, lastOn.replace(`${RECALL_GUARD}\n\n`, ''), `${entry.id} : memes donnees`);
    assert.equal(off[0].content, on[0].content, `${entry.id} : meme system`);
    assert.equal(off.length, on.length, `${entry.id} : meme nombre de messages`);
  }
});

test('blocs attendus inchanges par rapport aux experiences d origine', () => {
  const last = (id) => {
    const context = built(PROBES_E43.find((entry) => entry.id === id), false);
    return context[context.length - 1].content;
  };

  for (const id of ['Q1', 'Q6']) assert.ok(last(id).includes(`Source: ${STORED_SOURCE}`), id);
  assert.ok(last('Q2').includes(`Assistant reply source: ${STORED_SOURCE}`));
  assert.ok(last('Q3').includes(`User message source: ${STORED_SOURCE}`));
  assert.ok(last('Q4').includes('Message position: 39'));
  assert.ok(last('Q5').includes('Deleted user turns: 1-10'));
  assert.ok(last('P1').includes('Conversation evidence: NOT_FOUND in stored history'));
  assert.ok(last('N2').includes('Conversation evidence: FOUND'));
  assert.ok(last('N2').includes('turn 2 (not in the visible context)'));
  assert.ok(last('S1').includes('Conversation evidence: FOUND'));
  assert.ok(last('S1').includes('jamais le vendredi'));
});

test('frontiere-souvenir : B et C ont les memes donnees avec ou sans garde', () => {
  const turns = SCENARIOS.find((entry) => entry.id === 'frontiere-souvenir').turns;
  const history = [];
  for (let index = 0; index < 14; index += 1) {
    history.push({ role: 'user', content: turns[index] });
    history.push({ role: 'assistant', content: `reponse ${index + 1}` });
  }

  for (const index of [13, 14]) {
    const messages = [...history.slice(0, index * 2), { role: 'user', content: turns[index] }];
    const on = buildChatContext(messages, 20, undefined, undefined, 'VOIX');
    const off = buildChatContext(messages, 20, undefined, undefined, 'VOIX', { recallGuard: false });
    const lastOn = on[on.length - 1].content;
    const lastOff = off[off.length - 1].content;

    assert.equal(lastOff, lastOn.replace(`${RECALL_GUARD}\n\n`, ''), `#${index + 1}`);
    assert.ok(
      lastOff.includes(index === 13 ? RECALL_LOOKUP_HEAD : PROVENANCE_CHECK_HEAD),
      `#${index + 1} : bloc de donnees present`
    );
  }
});
