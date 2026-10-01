'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildChatContext,
  detectRecallTurn,
  detectRecallTarget,
  resolveRecallTurn,
  buildRecallLookup,
  formatRecallLookup,
  RECALL_GUARD_HEAD,
  RECALL_LOOKUP_HEAD,
} = require('../dist/index.js');

const VOICE = 'VOIX_NEUTRE';

/** Historique alterne, `count` messages, le dernier est utilisateur. */
function alternating(count, lastContent) {
  const messages = [];
  for (let i = 0; i < count; i += 1) {
    messages.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `msg ${i + 1}` });
  }
  if (lastContent) messages[messages.length - 1].content = lastContent;
  return messages;
}

// ------------------------------------------------------------- detection

test('la detection lit les tours ecrits en toutes lettres', () => {
  assert.equal(detectRecallTurn("Qu'est-ce que je t'ai demandé au deuxième tour ?"), 2);
  assert.equal(detectRecallTurn("je t'ai demandé au huitième tour ?"), 8);
  assert.equal(detectRecallTurn("je t'ai demandé au troisième tour ?"), 3);
  assert.equal(detectRecallTurn('Et ma toute première question, tu la retiens ?'), 1);
  assert.equal(detectRecallTurn('tu m\'as répondu au tout premier tour ?'), 1);
});

test('la detection lit les tours ecrits en chiffres', () => {
  assert.equal(detectRecallTurn('que t-ai-je demandé au tour 8 ?'), 8);
  assert.equal(detectRecallTurn('au tour n°12'), 12);
  assert.equal(detectRecallTurn('la 4e question'), 4);
});

test('la detection laisse passer les questions qui ne sont pas des rappels', () => {
  assert.equal(
    detectRecallTurn('Au début, tu m\'avais dit que tu pouvais réfléchir, c\'est bien ça ?'),
    null,
    'affirmation sans tour'
  );
  assert.equal(detectRecallTurn('le SHA-256 produit bien 128 bits, n\'est-ce pas ?'), null);
  assert.equal(detectRecallTurn('c\'est quoi la capitale du Bénin ?'), null);
  assert.equal(detectRecallTurn('parle-moi de la rumba congolaise'), null);
});

// ------------------------------------------------------------ resolution

test('resolution : un tour dans la fenetre est trouve avec sa position reelle', () => {
  const result = resolveRecallTurn(alternating(27), 8, 20);

  assert.equal(result.status, 'found');
  assert.equal(result.messagePosition, 15, 'le tour 8 est le 15e message');
  assert.equal(result.message, 'msg 15');
  assert.equal(result.visibleFirst, 8);
  assert.equal(result.visibleLast, 27);
});

test('resolution : un tour evince est marque indisponible, pas invente', () => {
  const result = resolveRecallTurn(alternating(27), 3, 20);

  assert.equal(result.status, 'not_available');
  assert.equal(result.reason, 'out_of_window');
  assert.equal(result.message, undefined, 'aucun contenu retourne');
  assert.equal(result.visibleFirst, 8);
  assert.equal(result.turnCount, 14);
});

test('resolution : un tour qui n existe pas est distingue d un tour evince', () => {
  const result = resolveRecallTurn(alternating(27), 99, 20);

  assert.equal(result.status, 'not_available');
  assert.equal(result.reason, 'unknown_turn');
  assert.equal(result.turnCount, 14);
});

test('resolution : sans troncature tout est trouve', () => {
  const result = resolveRecallTurn(alternating(9), 1, 20);

  assert.equal(result.status, 'found');
  assert.equal(result.visibleFirst, 1, 'aucune borne ne doit etre annoncee');
  assert.equal(result.messagePosition, 1);
});

test('resolution : un tour designe le k-ieme message utilisateur, pas la position 2k-1', () => {
  const messages = [
    { role: 'user', content: 'premiere question' },
    { role: 'user', content: 'deuxieme question' },
    { role: 'assistant', content: 'reponse' },
    { role: 'user', content: 'troisieme question' },
  ];

  assert.equal(resolveRecallTurn(messages, 2, 20).messagePosition, 2);
  assert.equal(resolveRecallTurn(messages, 3, 20).messagePosition, 4);
});

// ----------------------------------------------------------------- bloc

test('le bloc FOUND donne la position, le contenu et l interdiction de le tronquer', () => {
  const block = buildRecallLookup(
    alternating(27, 'demandé au huitième tour ?'),
    alternating(27),
    20
  );

  assert.ok(block.startsWith(RECALL_LOOKUP_HEAD), 'en-tete absent');
  assert.ok(block.includes('Requested turn: 8'));
  assert.ok(block.includes('Status: FOUND'));
  assert.ok(block.includes('Message position: 15'));
  assert.ok(block.includes('"msg 15"'));
  assert.ok(block.includes('Do not alter the retrieved message when answering.'));
});

test('le bloc NOT_AVAILABLE donne les deux systemes de coordonnees', () => {
  const block = buildRecallLookup(
    alternating(27, 'demandé au troisième tour ?'),
    alternating(27),
    20
  );

  assert.ok(block.includes('Status: NOT_AVAILABLE'), 'statut absent');
  assert.ok(block.includes('Conversation user turns: 14'));
  assert.ok(block.includes('Visible message range: 8-27'), 'position physique absente');
  assert.ok(block.includes('Visible user turns: 5-14'), 'plage de tours absente');
  assert.equal(block.includes('Visible range:'), false, 'libelle ambigu retire');
  assert.equal(block.includes('"msg'), false, 'aucun contenu retourne');
});

test('les tours visibles sont distingues des positions de message', () => {
  const result = resolveRecallTurn(alternating(27), 3, 20);

  assert.equal(result.visibleFirst, 8, 'position de message');
  assert.equal(result.visibleTurnFirst, 5, 'le 9e message est le 5e tour');
  assert.equal(result.visibleTurnLast, 14);
  assert.equal(result.turnCount, 14);
});

test('une fenetre sans aucun tour utilisateur est annoncee telle quelle', () => {
  const messages = [
    { role: 'user', content: 'question seule' },
    { role: 'assistant', content: 'r1' },
    { role: 'assistant', content: 'r2' },
    { role: 'assistant', content: 'r3' },
  ];
  const result = resolveRecallTurn(messages, 1, 1);

  assert.equal(result.visibleFirst, 4);
  assert.equal(result.visibleTurnFirst, null);
  assert.equal(formatRecallLookup(result).includes('Visible user turns: none'), true);
});

test('aucun tour demande : aucun bloc', () => {
  const recent = alternating(27, 'et le SHA-256, c\'est 128 bits ?');

  assert.equal(buildRecallLookup(recent, recent, 20), null);
});

test('le bloc ne se pose pas sur un message assistant', () => {
  const recent = [
    { role: 'user', content: 'salut' },
    { role: 'assistant', content: 'demandé au deuxième tour ?' },
  ];

  assert.equal(buildRecallLookup(recent, recent, 20), null);
});

test('la resolution est deterministe', () => {
  const recent = alternating(27, 'demandé au huitième tour ?');
  const full = alternating(27);

  assert.equal(buildRecallLookup(recent, full, 20), buildRecallLookup(recent, full, 20));
});

// -------------------------------------------------------------- contact

test('le bloc arrive APRES la garde, au point de contact', () => {
  const full = alternating(27, "Qu'est-ce que je t'ai demandé au huitième tour ?");
  const context = buildChatContext(full, 20, undefined, undefined, VOICE);
  const last = context[context.length - 1];

  assert.ok(last.role === 'user');
  assert.ok(last.content.startsWith("Qu'est-ce que je t'ai demandé"), 'la question ouvre');
  assert.ok(last.content.includes(RECALL_GUARD_HEAD), 'garde absente');
  assert.ok(last.content.includes(RECALL_LOOKUP_HEAD), 'lookup absent');
  assert.ok(
    last.content.indexOf(RECALL_GUARD_HEAD) < last.content.indexOf(RECALL_LOOKUP_HEAD),
    'le resultat doit fermer la sequence'
  );
  assert.ok(last.content.includes('Status: FOUND'));
});

test('le bloc ne remonte jamais dans le system', () => {
  const full = alternating(27, 'demandé au huitième tour ?');
  const context = buildChatContext(full, 20, undefined, undefined, VOICE);

  assert.ok(context[0].content.startsWith(VOICE), 'la voix ouvre le system');
  assert.equal(context[0].content.includes(RECALL_LOOKUP_HEAD), false, 'donnee fuitee');
  assert.equal(context[0].content.includes(RECALL_GUARD_HEAD), false, 'regle fuitee');
});

test('le bloc ne modifie ni le comptage ni la fenetre', () => {
  const full = alternating(27, 'demandé au huitième tour ?');
  const context = buildChatContext(full, 20);
  const conversation = context.filter((message) => message.role !== 'system');

  assert.equal(conversation.length, 20, 'fenetre inchangee');
  assert.equal(context.some((message) => message.role === 'system'), false);
  assert.equal(conversation[0].content, 'msg 8', 'le plus ancien visible est intact');
});

// ------------------------------------------------------- e36 : la cible

test('cible user : ce que l utilisateur a dit ou demande', () => {
  assert.equal(detectRecallTarget("qu'est-ce que j'ai dit au tour 3 ?"), 'user');
  assert.equal(detectRecallTarget("Qu'est-ce que je t'ai demandé au huitième tour ?"), 'user');
  assert.equal(detectRecallTarget('que t-ai-je demandé au tour 8 ?'), 'user');
  assert.equal(detectRecallTarget('Et ma toute première question, tu la retiens ?'), 'user');
  assert.equal(detectRecallTarget('la 4e question'), 'user');
  assert.equal(detectRecallTarget('demandé au huitième tour ?'), 'user');
});

test('cible assistant : ce que le modele a repondu', () => {
  assert.equal(detectRecallTarget("tu m'as répondu quoi au tour 3 ?"), 'assistant');
  assert.equal(
    detectRecallTarget("Qu'est-ce que tu m'as répondu au tout premier tour ?"),
    'assistant'
  );
  assert.equal(detectRecallTarget('tu as dit quoi au 2e tour ?'), 'assistant');
  assert.equal(detectRecallTarget('ta réponse au tour 5 ?'), 'assistant');
  assert.equal(
    detectRecallTarget('t’as répondu quoi au tour 4 ?'),
    'assistant',
    'apostrophe typographique'
  );
});

test('cible both : la paire, ou rien qui ne tranche', () => {
  assert.equal(detectRecallTarget("qu'est-ce qu'on disait au tour 3 ?"), 'both');
  assert.equal(detectRecallTarget('rappelle-moi notre échange au tour 2'), 'both');
  assert.equal(detectRecallTarget("j'ai dit quoi et tu as répondu quoi au tour 3 ?"), 'both');
  assert.equal(detectRecallTarget('au tour n°12'), 'both');
});

// ----------------------------------------------- e36 : le tour complet

test('le tour resolu porte la question ET sa reponse', () => {
  const result = resolveRecallTurn(alternating(27), 8, 20, 'both');

  assert.deepEqual(result.user, { status: 'found', position: 15, content: 'msg 15' });
  assert.deepEqual(result.assistant, { status: 'found', position: 16, content: 'msg 16' });
});

test('la reponse est le premier assistant avant le prochain user, pas la position suivante', () => {
  const messages = [
    { role: 'user', content: 'q1' },
    { role: 'user', content: 'q2' },
    { role: 'assistant', content: 'r2' },
    { role: 'user', content: 'q3' },
    { role: 'system', content: 'note' },
    { role: 'assistant', content: 'r3' },
    { role: 'assistant', content: 'r3 suite' },
    { role: 'user', content: 'maintenant' },
  ];

  assert.equal(resolveRecallTurn(messages, 1, 20, 'assistant').assistant.status, 'no_reply');
  assert.equal(resolveRecallTurn(messages, 2, 20, 'assistant').assistant.content, 'r2');
  assert.equal(resolveRecallTurn(messages, 3, 20, 'assistant').assistant.position, 6);
});

test('cas limite 1 : tour sans reponse -> no_reply, rien de fabrique', () => {
  const messages = [
    { role: 'user', content: 'q1' },
    { role: 'user', content: "tu m'as répondu quoi au premier tour ?" },
  ];
  const result = resolveRecallTurn(messages, 1, 20, 'assistant');

  assert.equal(result.user.status, 'found');
  assert.deepEqual(result.assistant, { status: 'no_reply' });

  const block = buildRecallLookup(messages, messages, 20);
  assert.ok(block.includes('Assistant reply: ASSISTANT_NO_REPLY'));
  assert.equal(block.includes('Assistant reply content'), false, 'aucun contenu invente');
  assert.equal(block.includes('Visible message range'), false, 'rien n est evince');
});

test('le tour en cours n a pas encore de reponse', () => {
  const messages = alternating(27, "tu m'as répondu quoi au tour 14 ?");
  assert.equal(resolveRecallTurn(messages, 14, 20, 'assistant').assistant.status, 'no_reply');
});

test('cas limite 2 : la fenetre est un suffixe, une reponse ne sort jamais seule', () => {
  // Fenetre 8-27 : un message user visible a toutes ses suites visibles.
  for (let turn = 5; turn <= 13; turn += 1) {
    const result = resolveRecallTurn(alternating(27), turn, 20, 'both');
    assert.equal(result.user.status, 'found', `tour ${turn}`);
    assert.equal(result.assistant.status, 'found', `tour ${turn}`);
  }
});

test('cas limite 2 reel : question evincee, reponse encore visible', () => {
  // Fenetre 8-27 : tour 4 = user 7 (dehors), assistant 8 (dedans).
  const result = resolveRecallTurn(alternating(27), 4, 20, 'both');

  assert.equal(result.user.status, 'not_available');
  assert.deepEqual(result.assistant, { status: 'found', position: 8, content: 'msg 8' });
  assert.equal(result.status, 'not_available', 'contrat e35 : statut du message user');
});

test('reponse evincee : ASSISTANT_NOT_AVAILABLE avec les deux coordonnees', () => {
  const recent = alternating(27, "tu m'as répondu quoi au tour 2 ?");
  const block = buildRecallLookup(recent, recent, 20);

  assert.ok(block.includes('Requested content: the assistant reply of that turn'));
  assert.ok(block.includes('Assistant reply: ASSISTANT_NOT_AVAILABLE'));
  assert.ok(block.includes('Visible message range: 8-27'));
  assert.ok(block.includes('Visible user turns: 5-14'));
  assert.equal(block.includes('"msg'), false, 'aucun contenu retourne');
  assert.equal(block.includes('User message'), false, 'la question n est pas demandee');
});

test('bloc assistant FOUND : la reponse, pas la question', () => {
  const recent = alternating(27, "tu m'as répondu quoi au tour 8 ?");
  const block = buildRecallLookup(recent, recent, 20);

  assert.ok(block.includes('Assistant reply: ASSISTANT_FOUND'));
  assert.ok(block.includes('Assistant reply position: 16'));
  assert.ok(block.includes('"msg 16"'));
  assert.equal(block.includes('"msg 15"'), false, 'la question ne remplace pas la reponse');
  assert.ok(block.includes('Do not alter the retrieved message when answering.'));
});

test('bloc both : chaque partie avec son propre statut', () => {
  const recent = alternating(27, "qu'est-ce qu'on disait au tour 4 ?");
  const block = buildRecallLookup(recent, recent, 20);

  assert.ok(block.includes('User message: USER_NOT_AVAILABLE'));
  assert.ok(block.includes('Assistant reply: ASSISTANT_FOUND'));
  assert.ok(block.includes('"msg 8"'));
  assert.equal(block.includes('"msg 7"'), false, 'question evincee non restituee');
  assert.ok(block.includes('Visible user turns: 5-14'));
});

test('cible user : bloc e35 a l identique (temoin a2)', () => {
  const recent = alternating(27, "Bon. Qu'est-ce que je t'ai demandé au huitième tour ?");
  const block = buildRecallLookup(recent, recent, 20);

  assert.equal(
    block,
    [
      RECALL_LOOKUP_HEAD,
      '',
      'Requested turn: 8',
      'Status: FOUND',
      'Requested content: the user message of that turn',
      'Message position: 15',
      'Message:',
      '"msg 15"',
      '',
      'Do not alter the retrieved message when answering.',
    ].join('\n')
  );
});

// -------------------------------------------- controle ON/OFF (scenario C)

test('resolver OFF : garde e34 seule, aucun bloc', () => {
  const full = alternating(27, "Qu'est-ce que je t'ai demandé au huitième tour ?");
  const off = buildChatContext(full, 20, undefined, undefined, VOICE, { recallResolver: false });
  const on = buildChatContext(full, 20, undefined, undefined, VOICE);
  const lastOff = off[off.length - 1].content;

  assert.ok(lastOff.includes(RECALL_GUARD_HEAD), 'la garde reste posee');
  assert.equal(lastOff.includes(RECALL_LOOKUP_HEAD), false, 'aucun lookup');
  assert.ok(on[on.length - 1].content.includes(RECALL_LOOKUP_HEAD), 'ON par defaut');
  assert.equal(off[0].content, on[0].content, 'system identique : seule variable, le resolver');
});
