'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GnoxeBrains,
  setGnoxeBrains,
  chatFlowSync,
  buildChatContext,
} = require('../dist/index.js');
const { createFakeModelProvider } = require('./helpers.js');

const VOICE = 'VOIX_NEUTRE';
const HEADER = '### Historique visible';

function history(count, start = 1) {
  const messages = [];
  for (let i = 0; i < count; i += 1) {
    messages.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${start + i}`,
    });
  }
  return messages;
}

function systemContent(messages, options = {}) {
  const context = buildChatContext(
    messages,
    options.max ?? 20,
    options.userName,
    options.channel,
    options.systemPrompt
  );
  const system = context.find((message) => message.role === 'system');
  return system ? system.content : null;
}

function install(provider) {
  setGnoxeBrains(new GnoxeBrains({ modelProvider: provider }));
  return provider;
}

test('sans troncature : aucune borne n est annoncee', () => {
  const content = systemContent(history(20), { systemPrompt: VOICE });

  assert.ok(content.includes(VOICE), 'la voix est la');
  assert.equal(content.includes(HEADER), false, 'rien a annoncer quand tout tient');
  assert.equal(content.includes('ne sont pas fournis'), false);
});

test('avec troncature : les bornes reelles sont annoncees en tours', () => {
  // 25 messages, fenetre 6-25 : message 6 = reponse du tour 3, 7 = tour 4.
  const content = systemContent(history(25), { systemPrompt: VOICE });

  assert.ok(content.includes(HEADER), 'section absente');
  assert.ok(content.includes('les tours 4 à 13'), `bornes incorrectes : ${content}`);
  assert.ok(content.includes("d'une conversation de 13 tours"), 'total absent');
  assert.ok(content.includes('Les tours 1 à 3 ne sont pas fournis'), 'eviction non nommee');
  assert.ok(content.includes('sauf ta réponse au tour 3'), 'reponse orpheline non signalee');
});

test('etape 37 : aucune plage en positions de message', () => {
  const content = systemContent(history(27), { systemPrompt: VOICE });

  assert.ok(content.includes('les tours 5 à 14'), `recu : ${content}`);
  assert.equal(/messages? \d/.test(content), false, `position de message annoncee : ${content}`);
  assert.equal(content.includes('8 à 27'), false, 'ancienne plage e33');
});

test('fenetre qui commence par une question : pas de reponse orpheline', () => {
  // 26 messages, fenetre 7-26 : message 7 = tour 4, rien d'autre en tete.
  const content = systemContent(history(26), { systemPrompt: VOICE });

  assert.ok(content.includes('les tours 4 à 13'), `recu : ${content}`);
  assert.ok(content.includes('Les tours 1 à 3 ne sont pas fournis.'));
  assert.equal(content.includes('sauf ta réponse'), false);
});

test('un seul tour evince : singulier', () => {
  // 22 messages, fenetre 3-22 : message 3 = tour 2.
  const content = systemContent(history(22), { systemPrompt: VOICE });

  assert.ok(content.includes("Le tour 1 n'est pas fourni."), `recu : ${content}`);
});

test('les bornes derivent de la fenetre, pas d une constante', () => {
  const small = systemContent(history(31), { systemPrompt: VOICE });
  const large = systemContent(history(64), { systemPrompt: VOICE });

  assert.ok(small.includes('les tours 7 à 16'), `petite fenetre : ${small}`);
  assert.ok(large.includes('les tours 23 à 32'), `grande fenetre : ${large}`);
  assert.notEqual(small, large, 'ecrit en dur dans les deux cas');
});

test('la borne ne porte aucune identite', () => {
  const content = systemContent(history(30), {
    systemPrompt: VOICE,
    channel: 'whatsapp',
  });

  assert.ok(content.startsWith(VOICE), 'la voix ouvre toujours le system');
  assert.equal(/whatsapp/i.test(content), false, 'nettoyage A.2 : aucun fragment de canal');
  assert.ok(content.includes(HEADER), 'la borne est la');
  assert.equal(content.includes('Eyano'), false, "aucun nom d agent dans la borne");
  assert.equal(content.includes('Gnoxe'), false, 'aucune marque dans la borne');
});

test("sans voix ni fragment : la borne ne cree jamais de system", () => {
  const context = buildChatContext(history(40), 20);

  assert.equal(
    context.some((message) => message.role === 'system'),
    false,
    "l'etape 27 interdit un system cree de toutes pieces"
  );
});

test('la borne ne modifie pas le nombre de messages transmis', () => {
  const context = buildChatContext(history(40), 20, undefined, undefined, VOICE);
  const recent = context.filter((message) => message.role !== 'system');

  assert.equal(recent.length, 20, 'la fenetre reste bornee a max');
  assert.equal(recent[0].content, 'message 21', 'les plus recents sont conserves');
});

test('la borne est generee au fil de la conversation', async () => {
  const provider = install(createFakeModelProvider({ content: 'OK.' }));

  await chatFlowSync({
    userId: 'u',
    conversationId: 'c',
    messages: history(30),
    systemPrompt: VOICE,
  });

  const call = provider.calls.find((entry) => entry.kind === 'generate');
  const system = call.request.messages.find((message) => message.role === 'system');

  assert.ok(system.content.includes('les tours 6 à 15'), `recu : ${system.content}`);
  assert.equal(call.request.messages.length, 21, 'system + 20 messages');
});
