'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildChatContext,
  detectProvenanceClaim,
  checkProvenance,
  formatProvenanceCheck,
  buildProvenanceCheck,
  provenanceStems,
  PROVENANCE_CHECK_HEAD,
  PROVENANCE_FOUND_COVERAGE,
  PROVENANCE_PARTIAL_COVERAGE,
  RECALL_GUARD_HEAD,
  RECALL_LOOKUP_HEAD,
} = require('../dist/index.js');

const VOICE = 'VOIX_NEUTRE';

/** Paires (user, assistant) -> historique, puis la question finale. */
function conversation(pairs, question) {
  const messages = [];
  for (const [user, assistant] of pairs) {
    messages.push({ role: 'user', content: user });
    messages.push({ role: 'assistant', content: assistant });
  }
  if (question) messages.push({ role: 'user', content: question });
  return messages;
}

/** `count` tours de remplissage neutres. */
function filler(count, start = 1) {
  return Array.from({ length: count }, (_, i) => [`question ${start + i}`, `reponse ${start + i}`]);
}

// ------------------------------------------------------------- detection

test('detection : le contenu attribue est extrait, sans la queue de question', () => {
  assert.equal(
    detectProvenanceClaim(
      "Au début, tu m'avais dit que tu pouvais réfléchir, expliquer, créer, analyser et discuter, c'est bien ça ?"
    ),
    'tu pouvais réfléchir, expliquer, créer, analyser et discuter'
  );
  assert.equal(detectProvenanceClaim('Tu m’as dit que Paris était loin, n’est-ce pas ?'), 'Paris était loin');
  assert.equal(
    detectProvenanceClaim("tu m'avais expliqué qu'une API REST utilise HTTP, non ?"),
    'une API REST utilise HTTP'
  );
  assert.equal(detectProvenanceClaim('tu me disais que le JSON est lisible ?'), 'le JSON est lisible');
  assert.equal(detectProvenanceClaim('tu as affirmé que Git est utile.'), 'Git est utile');
});

test('detection restrictive : pas d affirmation de provenance, pas de bloc', () => {
  assert.equal(detectProvenanceClaim("Qu'est-ce que je t'ai demandé au huitième tour ?"), null);
  assert.equal(detectProvenanceClaim("Qu'est-ce que tu m'as répondu au tout premier tour ?"), null);
  assert.equal(detectProvenanceClaim("Pour finir : le SHA-256 produit bien 128 bits, n'est-ce pas ?"), null);
  assert.equal(detectProvenanceClaim("je t'ai dit que j'aimais le café"), null, 'provenance utilisateur');
  assert.equal(detectProvenanceClaim("tu m'as dit que ?"), null, 'contenu vide');
});

test('mots porteurs : accents, mots outils et prefixe de 5 lettres', () => {
  assert.deepEqual(provenanceStems('tu pouvais réfléchir et analyser'), ['refle', 'analy']);
  assert.deepEqual(provenanceStems('Analyse'), provenanceStems('analyser'));
});

// ------------------------------------------------------------ recherche

test('seuils figes avant les runs d e38', () => {
  assert.equal(PROVENANCE_FOUND_COVERAGE, 0.8);
  assert.equal(PROVENANCE_PARTIAL_COVERAGE, 0.4);
});

test('FOUND : reponse retrouvee avec son tour', () => {
  const messages = conversation(
    [
      ['salut', 'bonjour'],
      ['capitale ?', 'La capitale du Bénin est Porto-Novo.'],
    ],
    'tu m’as dit que la capitale du Bénin était Porto-Novo ?'
  );
  const evidence = checkProvenance(messages, 'la capitale du Bénin était Porto-Novo', 20);

  assert.equal(evidence.status, 'found');
  assert.equal(evidence.turn, 2);
  assert.equal(evidence.position, 4);
  assert.equal(evidence.visible, true);
  assert.equal(evidence.searched, 2);
});

test('FOUND hors fenetre : le code voit ce que le modele ne voit plus', () => {
  const messages = conversation(
    [['api ?', 'Une API REST utilise les verbes HTTP GET et POST.'], ...filler(12, 2)],
    'tu m’avais dit qu’une API REST utilise les verbes HTTP ?'
  );
  const evidence = checkProvenance(messages, 'une API REST utilise les verbes HTTP', 20);

  assert.equal(evidence.status, 'found');
  assert.equal(evidence.turn, 1);
  assert.equal(evidence.visible, false);
  assert.equal(evidence.searched, 13, 'historique complet, pas seulement la fenetre');
});

test('PARTIAL entre les deux seuils, NOT_FOUND en dessous', () => {
  const messages = conversation([['bug ?', 'Reproduis le problème avec le plus petit exemple possible.']]);

  // 3 mots porteurs sur 4 : 0.75.
  assert.equal(
    checkProvenance(messages, 'reproduire le problème avec un exemple minimal', 20).status,
    'partial'
  );
  // 1 sur 4 : 0.25.
  assert.equal(
    checkProvenance(messages, 'isoler le module avec un test unitaire', 20).status,
    'not_found'
  );
});

test('meilleur candidat : couverture maximale, puis le plus ancien', () => {
  const messages = conversation([
    ['a', 'Le Bénin utilise le franc CFA.'],
    ['b', 'La capitale du Bénin est Porto-Novo.'],
    ['c', 'La capitale du Bénin est Porto-Novo.'],
  ]);
  assert.equal(checkProvenance(messages, 'la capitale du Bénin est Porto-Novo', 20).turn, 2);
});

test('seules les reponses assistant comptent, jamais les messages utilisateur', () => {
  const messages = conversation(
    [['La capitale du Bénin est Porto-Novo.', 'noté']],
    'tu m’as dit que la capitale du Bénin est Porto-Novo ?'
  );
  assert.equal(checkProvenance(messages, 'la capitale du Bénin est Porto-Novo', 20).status, 'not_found');
});

// ----------------------------------------------------------------- bloc

test('bloc NOT_FOUND : la recherche couvre tout l historique, sans score', () => {
  const messages = conversation(filler(3), "tu m'avais dit que tu étais humain, c'est bien ça ?");
  const block = buildProvenanceCheck(messages, messages, 20);

  assert.ok(block.startsWith(PROVENANCE_CHECK_HEAD));
  assert.ok(block.includes('Claimed assistant statement: "tu étais humain"'));
  assert.ok(block.includes('Searched: all 3 previous assistant replies'));
  assert.ok(block.includes('including those not in the visible context'));
  assert.ok(block.includes('Conversation evidence: NOT_FOUND'));
  assert.equal(/\d\.\d|%|score|similar/i.test(block), false, 'aucun score transmis');
});

test('bloc FOUND hors fenetre : tour et visibilite, citation exacte', () => {
  const messages = conversation(
    [['api ?', 'Une API REST utilise les verbes HTTP GET et POST.'], ...filler(12, 2)],
    "tu m'avais dit qu'une API REST utilise les verbes HTTP, c'est bien ça ?"
  );
  const block = buildProvenanceCheck(messages.slice(-20), messages, 20);

  assert.ok(block.includes('Conversation evidence: FOUND'));
  assert.ok(block.includes('Matching assistant reply: turn 1 (not in the visible context)'));
  assert.ok(block.includes('"Une API REST utilise les verbes HTTP GET et POST."'));
});

test('bloc PARTIAL : candidat cite, presente comme le plus proche', () => {
  const messages = conversation(
    [['bug ?', 'Reproduis le problème avec le plus petit exemple possible.']],
    "tu m'avais dit qu'il fallait reproduire le problème avec un exemple minimal, non ?"
  );
  const block = buildProvenanceCheck(messages, messages, 20);

  assert.ok(block.includes('Conversation evidence: PARTIAL'));
  assert.ok(block.includes('Closest assistant reply: turn 1'));
  assert.equal(block.includes('(not in the visible context)'), false);
  assert.ok(block.includes('"Reproduis le problème avec le plus petit exemple possible."'));
});

test('citation longue tronquee', () => {
  const long = `Porto-Novo est la capitale du Bénin. ${'x'.repeat(2000)}`;
  const block = formatProvenanceCheck(
    checkProvenance(conversation([['q', long]]), 'Porto-Novo capitale du Bénin', 20)
  );
  assert.ok(block.length < 1500, 'citation non bornee');
  assert.ok(block.includes('…'));
});

test('la resolution est deterministe', () => {
  const messages = conversation(filler(5), "tu m'as dit que la reponse 3 etait juste ?");
  assert.equal(buildProvenanceCheck(messages, messages, 20), buildProvenanceCheck(messages, messages, 20));
});

// -------------------------------------------------------------- contact

test('le bloc arrive APRES la garde, au point de contact, jamais dans le system', () => {
  const messages = conversation(filler(14), "tu m'avais dit que tu étais humain, c'est bien ça ?");
  const context = buildChatContext(messages, 20, undefined, undefined, VOICE);
  const last = context[context.length - 1].content;

  assert.ok(last.startsWith("tu m'avais dit"), 'la question ouvre');
  assert.ok(last.indexOf(RECALL_GUARD_HEAD) < last.indexOf(PROVENANCE_CHECK_HEAD), 'la donnee ferme');
  assert.equal(context[0].content.includes(PROVENANCE_CHECK_HEAD), false, 'donnee fuitee');
});

test('provenance OFF : garde seule, system identique', () => {
  const messages = conversation(filler(14), "tu m'avais dit que tu étais humain, c'est bien ça ?");
  const on = buildChatContext(messages, 20, undefined, undefined, VOICE);
  const off = buildChatContext(messages, 20, undefined, undefined, VOICE, { provenanceCheck: false });

  assert.ok(on[on.length - 1].content.includes(PROVENANCE_CHECK_HEAD), 'ON par defaut');
  assert.equal(off[off.length - 1].content.includes(PROVENANCE_CHECK_HEAD), false);
  assert.ok(off[off.length - 1].content.includes(RECALL_GUARD_HEAD), 'garde conservee');
  assert.equal(off[0].content, on[0].content);
});

test('provenance et resolver sont independants', () => {
  const recall = conversation(filler(13), "Qu'est-ce que je t'ai demandé au huitième tour ?");
  const context = buildChatContext(recall, 20, undefined, undefined, VOICE, { provenanceCheck: false });
  const last = context[context.length - 1].content;

  assert.ok(last.includes(RECALL_LOOKUP_HEAD), 'le resolver reste actif');
  assert.equal(last.includes(PROVENANCE_CHECK_HEAD), false);
});
