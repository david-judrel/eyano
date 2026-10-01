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

test('avec troncature : les bornes reelles sont annoncees', () => {
  const content = systemContent(history(25), { systemPrompt: VOICE });

  assert.ok(content.includes(HEADER), 'section absente');
  assert.ok(
    content.includes('les messages 6 à 25'),
    `bornes incorrectes : ${content}`
  );
  assert.ok(content.includes('de 25 messages'), 'total absent');
  assert.ok(content.includes('Les messages 1 à 5 ne sont pas fournis'), 'eviction non nommee');
});

test('les bornes derivent de la fenetre, pas d une constante', () => {
  const small = systemContent(history(31), { systemPrompt: VOICE });
  const large = systemContent(history(64), { systemPrompt: VOICE });

  assert.ok(small.includes('les messages 12 à 31'), `petite fenetre : ${small}`);
  assert.ok(large.includes('les messages 45 à 64'), `grande fenetre : ${large}`);
  assert.notEqual(small, large, 'ecrit en dur dans les deux cas');
});

test('la borne ne porte aucune identite', () => {
  const content = systemContent(history(30), {
    systemPrompt: VOICE,
    channel: 'whatsapp',
  });

  assert.ok(content.startsWith(VOICE), 'la voix ouvre toujours le system');
  assert.ok(content.includes('CONTEXTE WHATSAPP'), 'le fragment de canal est la');
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

  assert.ok(system.content.includes('les messages 11 à 30'), `recu : ${system.content}`);
  assert.equal(call.request.messages.length, 21, 'system + 20 messages');
});
