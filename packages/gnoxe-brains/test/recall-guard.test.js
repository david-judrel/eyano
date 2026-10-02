'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GnoxeBrains,
  setGnoxeBrains,
  chatFlowSync,
  buildChatContext,
  applyRecallGuard,
  RECALL_GUARD,
  RECALL_GUARD_HEAD,
} = require('../dist/index.js');
const { createFakeModelProvider } = require('./helpers.js');

const VOICE = 'VOIX_NEUTRE';

function history(count) {
  const messages = [];
  for (let i = 0; i < count; i += 1) {
    messages.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i + 1}`,
    });
  }
  return messages;
}

function install(provider) {
  setGnoxeBrains(new GnoxeBrains({ modelProvider: provider }));
  return provider;
}

test('la garde s attache au dernier message utilisateur', () => {
  const context = buildChatContext(
    [{ role: 'user', content: 'Qu est-ce que je t ai demande ?' }],
    20
  );
  const last = context[context.length - 1];

  assert.equal(last.role, 'user');
  assert.ok(last.content.startsWith('Qu est-ce que je t ai demande ?'), 'la question reste');
  assert.ok(last.content.includes(RECALL_GUARD_HEAD), 'garde absente');
});

test('la garde ne se pose jamais sur un message assistant', () => {
  const context = buildChatContext(history(30), 20);

  assert.equal(
    context.some((message) => message.content.includes(RECALL_GUARD_HEAD)),
    false,
    'dernier message non utilisateur'
  );
});

test('la garde est idempotente', () => {
  const once = applyRecallGuard([{ role: 'user', content: 'salut' }]);
  const twice = applyRecallGuard(once);

  assert.deepEqual(twice, once, 'une deuxieme application a double le bloc');
  assert.equal(twice[0].content.split(RECALL_GUARD_HEAD).length - 1, 1, 'occurrences');
});

test('la garde ne modifie ni le comptage ni les autres messages', () => {
  const input = history(29);
  const context = buildChatContext(input, 20);
  const visible = context.filter((message) => message.role !== 'system');

  assert.equal(visible.length, 20, 'fenetre inchangee');
  for (let i = 0; i < 19; i += 1) {
    assert.equal(visible[i].content, `message ${i + 10}`, `message ${i} altere`);
  }
  assert.equal(input[28].content, 'message 29', 'source non mutante');
});

test('la garde ne cree pas de system message', () => {
  const context = buildChatContext([{ role: 'user', content: 'salut' }], 20);

  assert.equal(context.some((message) => message.role === 'system'), false);
});

test('la garde ne touche pas au system, qui reste la voix seule', () => {
  const context = buildChatContext(
    [{ role: 'user', content: 'bonjour' }],
    20,
    undefined,
    undefined,
    VOICE
  );

  assert.equal(context[0].content, VOICE, 'le system a ete modifie');
  assert.ok(context[1].content.includes(RECALL_GUARD_HEAD), 'la garde est dans la conversation');
});

test('la garde ne porte ni identite ni backend', () => {
  assert.equal(RECALL_GUARD.includes('Eyano'), false, "aucun nom d agent");
  assert.equal(RECALL_GUARD.includes('Gnoxe'), false, 'aucune marque');
  assert.equal(
    /gemini|google|openai|anthropic|claude|\bgpt\b|mistral|deepseek|vertex|bedrock/i.test(
      RECALL_GUARD
    ),
    false,
    'aucun fournisseur'
  );
});

test("la garde couvre aussi l affirmation de souvenir", () => {
  assert.ok(
    RECALL_GUARD.includes('ou affirme que tu lui as dit quelque chose'),
    'le piege du tour 15 ne serait pas couvert'
  );
  assert.ok(RECALL_GUARD.includes('3. ne remplace jamais un souvenir absent'));
});

test('la garde atteint le modele au point de contact', async () => {
  const provider = install(createFakeModelProvider({ content: 'OK.' }));

  await chatFlowSync({
    userId: 'u',
    conversationId: 'c',
    messages: [{ role: 'user', content: 'Que t ai-je demande au premier tour ?' }],
    systemPrompt: VOICE,
    recallGuard: true,
  });

  const call = provider.calls.find((entry) => entry.kind === 'generate');
  const conversation = call.request.messages.filter((message) => message.role === 'user');
  const last = conversation[conversation.length - 1];

  assert.ok(last.content.includes(RECALL_GUARD_HEAD), 'garde non transmise');
  assert.equal(call.request.messages[0].content, VOICE, 'system intact');
});

test('par defaut (conditionnel), la garde atteint le modele sans donnee conclusive', async () => {
  const provider = install(createFakeModelProvider({ content: 'OK.' }));

  await chatFlowSync({
    userId: 'u',
    conversationId: 'c',
    messages: [{ role: 'user', content: 'Que t ai-je demande au tour 5 ?' }],
    systemPrompt: VOICE,
  });

  const call = provider.calls.find((entry) => entry.kind === 'generate');
  const last = call.request.messages[call.request.messages.length - 1];
  assert.ok(last.content.includes(RECALL_GUARD_HEAD), 'tour inexistant : garde posee');
});

// ---------------------------------------------- e43 : garde ON / OFF

test('e43 : recallGuard false retire la garde, et seulement elle', () => {
  const history = [];
  for (let i = 1; i <= 13; i += 1) {
    history.push({ role: 'user', content: `question ${i}` });
    history.push({ role: 'assistant', content: `reponse ${i}` });
  }
  history.push({ role: 'user', content: "Qu'est-ce que je t'ai demandé au tour 3 ?" });

  const on = buildChatContext(history, 20, undefined, undefined, 'VOIX', { recallGuard: true });
  const off = buildChatContext(history, 20, undefined, undefined, 'VOIX', { recallGuard: false });
  const lastOn = on[on.length - 1].content;
  const lastOff = off[off.length - 1].content;

  assert.ok(lastOn.includes(RECALL_GUARD_HEAD));
  assert.equal(lastOff.includes(RECALL_GUARD_HEAD), false);
  assert.equal(lastOff, lastOn.replace(`${RECALL_GUARD}\n\n`, ''), 'meme donnee, meme place');
  assert.ok(lastOff.includes('"question 3"'), 'le bloc du resolver reste');
  assert.equal(off[0].content, on[0].content, 'system identique');
});

test('e43 : sans donnee ni garde, le message est inchange', () => {
  const messages = [{ role: 'user', content: 'bonjour' }];
  const off = buildChatContext(messages, 20, undefined, undefined, undefined, { recallGuard: false });
  assert.deepEqual(off, messages);
});

// ------------------------------------- e44 : garde conditionnelle

function history13(question) {
  const messages = [];
  for (let i = 1; i <= 13; i += 1) {
    messages.push({ role: 'user', content: `question ${i}` });
    messages.push({ role: 'assistant', content: `Retiens ceci : le mot${i} est valide.` });
  }
  messages.push({ role: 'user', content: question });
  return messages;
}

function guardedWith(question, recallGuard = 'conditional') {
  const context = buildChatContext(history13(question), 20, undefined, undefined, 'VOIX', { recallGuard });
  return context[context.length - 1].content.includes(RECALL_GUARD_HEAD);
}

test('e44 : FOUND conclusif (resolver) -> pas de garde', () => {
  assert.equal(guardedWith("Qu'est-ce que je t'ai demandé au tour 3 ?"), false);
  assert.equal(guardedWith("Qu'est-ce que je t'ai demandé au tour 10 ?"), false, 'visible');
});

test('e44 : FOUND conclusif (provenance) -> pas de garde', () => {
  assert.equal(guardedWith("Tu m'as dit que le mot4 est valide, c'est bien ça ?"), false);
});

test('e44 : NOT_FOUND, NOT_AVAILABLE ou aucun bloc -> garde', () => {
  assert.equal(guardedWith("Tu m'avais dit que tu étais humain, c'est bien ça ?"), true, 'NOT_FOUND');
  assert.equal(guardedWith("Qu'est-ce que je t'ai demandé au tour 99 ?"), true, 'tour inexistant');
  assert.equal(guardedWith("Qu'est-ce que tu m'as répondu au tour 14 ?"), true, 'NO_REPLY');
  assert.equal(guardedWith('bonjour'), true, 'aucun bloc');
});

test('e44 : PARTIAL n est pas conclusif -> garde', () => {
  assert.equal(guardedWith("Tu m'as dit que le mot4 est valide et le ciel violet, c'est bien ça ?"), true);
});

test('integration : par defaut la garde est conditionnelle', () => {
  const byDefault = (question) => {
    const context = buildChatContext(history13(question), 20, undefined, undefined, 'VOIX');
    return context[context.length - 1].content.includes(RECALL_GUARD_HEAD);
  };
  assert.equal(byDefault("Qu'est-ce que je t'ai demandé au tour 3 ?"), false, 'FOUND');
  assert.equal(byDefault("Tu m'avais dit que tu étais humain, c'est bien ça ?"), true, 'NOT_FOUND');
  assert.equal(guardedWith("Qu'est-ce que je t'ai demandé au tour 3 ?", true), true, 'true force');
});

test('integration : NOT_FOUND et NOT_AVAILABLE identiques a la garde toujours posee', () => {
  for (const question of [
    "Tu m'avais dit que tu étais humain, c'est bien ça ?",
    "Qu'est-ce que je t'ai demandé au tour 99 ?",
    "Qu'est-ce que tu m'as répondu au tour 14 ?",
    'bonjour',
  ]) {
    const byDefault = buildChatContext(history13(question), 20, undefined, undefined, 'VOIX');
    const always = buildChatContext(history13(question), 20, undefined, undefined, 'VOIX', {
      recallGuard: true,
    });
    assert.deepEqual(byDefault, always, question);
  }
});
