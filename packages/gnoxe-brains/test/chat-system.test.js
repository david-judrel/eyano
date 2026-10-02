'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  GnoxeBrains,
  setGnoxeBrains,
  chatFlowSync,
  buildChatContext,
} = require('../dist/index.js');
const { createFakeModelProvider } = require('./helpers.js');

const SRC = path.join(__dirname, '..', 'src');

function install(provider) {
  setGnoxeBrains(new GnoxeBrains({ modelProvider: provider }));
  return provider;
}

function input(overrides = {}) {
  return {
    userId: 'user-1',
    conversationId: 'conv-1',
    messages: [{ role: 'user', content: 'Merci beaucoup' }],
    ...overrides,
  };
}

function systemMessage(provider) {
  const call = provider.calls.find((entry) => entry.kind === 'generate');
  assert.ok(call, 'un appel generate est attendu');
  return call.request.messages[0];
}

function walk(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const found = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full, predicate));
    } else if (predicate(entry.name)) {
      found.push(full);
    }
  }

  return found;
}

test('systemPrompt injecte : la voix atteint le modele en premier message', async () => {
  const provider = install(createFakeModelProvider({ content: 'OK.' }));

  await chatFlowSync(input({ systemPrompt: 'VOIX_EYANO' }));

  const message = systemMessage(provider);
  assert.equal(message.role, 'system');
  assert.equal(message.content, 'VOIX_EYANO');
});

test('la voix injectee precede les fragments de session', async () => {
  const provider = install(createFakeModelProvider({ content: 'OK.' }));

  await chatFlowSync(input({ systemPrompt: 'VOIX_EYANO', userName: 'David Judrel' }));

  const message = systemMessage(provider);
  assert.ok(message.content.startsWith('VOIX_EYANO'), 'la voix ouvre le system');
  assert.ok(message.content.includes("L'utilisateur s'appelle David."), 'le fragment suit');
  assert.ok(message.content.indexOf('VOIX_EYANO') < message.content.indexOf('appelle David'));
});

test('sans voix injectee : seuls les fragments de session forment le system', async () => {
  const provider = install(createFakeModelProvider({ content: 'OK.' }));

  await chatFlowSync(input({ userName: 'David' }));

  const message = systemMessage(provider);
  assert.equal(message.role, 'system');
  assert.ok(message.content.includes("L'utilisateur s'appelle David."));
  assert.equal(message.content.includes('Eyano'), false, 'le cerveau ne porte aucune identite');
});

test('sans voix ni fragment : aucun message system nest produit', async () => {
  const provider = install(createFakeModelProvider({ content: 'OK.' }));

  await chatFlowSync(input());

  const call = provider.calls.find((entry) => entry.kind === 'generate');
  assert.equal(call.request.messages[0].role, 'user');
  assert.equal(
    call.request.messages.some((message) => message.role === 'system'),
    false
  );
});

test('les fragments de session ne contiennent aucune identite', () => {
  const context = buildChatContext(
    [{ role: 'user', content: 'Salut' }],
    20,
    'David Judrel GNONDABEKA',
    'whatsapp'
  );

  assert.equal(context[0].role, 'system');
  assert.ok(context[0].content.includes('CONTEXTE WHATSAPP'));
  assert.equal(context[0].content.includes('Eyano'), false, 'aucun nom d agent');
  assert.equal(context[0].content.includes('Gnoxe'), false, 'aucune marque');
});

test("le cerveau ne contient plus l identite d Eyano", () => {
  const sources = walk(SRC, (name) => name.endsWith('.ts'));
  assert.ok(sources.length > 20, 'sources introuvables');

  for (const file of sources) {
    const content = fs.readFileSync(file, 'utf8');
    const name = path.relative(SRC, file).split(path.sep).join('/');

    assert.equal(
      content.includes('EYANO_SYSTEM_PROMPT'),
      false,
      `${name} ne doit plus declarer l identite Eyano`
    );
    assert.equal(
      content.includes("Profil d'Eyano"),
      false,
      `${name} ne doit plus contenir le profil Eyano`
    );
  }
});
