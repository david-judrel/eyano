'use strict';

const test = require('node:test');
const { beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  GnoxeBrains,
  chatFlow,
  chatFlowSync,
  titleFlow,
  setGnoxeBrains,
  buildChatContext,
  isRegisteredModel,
  listRegisteredModels,
  resolveBackendModel,
  resolveLogicalModel,
} = require('../dist/index.js');

const webSearchModule = require('../dist/tools/web-search.tool');

const REAL_WEB_SEARCH = webSearchModule.webSearch;
const searchCalls = [];

function createFakeModelProvider(options = {}) {
  const generateCalls = [];
  const streamCalls = [];
  const providerName = options.name || 'fake-backend';

  return {
    name: providerName,
    generateCalls,
    streamCalls,

    async generate(request) {
      generateCalls.push(request);
      if (options.generateError) throw options.generateError;
      return {
        content: options.content !== undefined ? options.content : 'Reponse simulee.',
        model: request.model || 'gnoxe-brains-1',
        provider: providerName,
      };
    },

    async *stream(request) {
      streamCalls.push(request);
      if (options.streamError) throw options.streamError;
      const chunks = options.chunks || ['Reponse ', 'simulee.'];
      for (const chunk of chunks) {
        yield { type: 'text', content: chunk };
      }
      yield { type: 'done', content: chunks.join('') };
    },

    async structuredOutput() {
      return {};
    },

    capabilities() {
      return {
        streaming: true,
        structuredOutput: true,
        images: false,
        models: ['gnoxe-brains-1', 'gnoxe-brains-1.5'],
      };
    },
  };
}

function install(provider) {
  setGnoxeBrains(new GnoxeBrains({ modelProvider: provider }));
  return provider;
}

function baseInput(overrides = {}) {
  return {
    userId: 'user-1',
    conversationId: 'conv-1',
    messages: [{ role: 'user', content: 'Presente-toi brievement.' }],
    ...overrides,
  };
}

beforeEach(() => {
  searchCalls.length = 0;
  webSearchModule.webSearch = async (query) => {
    searchCalls.push(query);
    return [{ title: 'Source', url: 'https://eyano.example/src', snippet: 'Extrait.' }];
  };
  install(createFakeModelProvider());
});

afterEach(() => {
  webSearchModule.webSearch = REAL_WEB_SEARCH;
  setGnoxeBrains(null);
});

// ------------------------------------------------------------------ 1 et 2

test('chatFlow delegue a GnoxeBrains.answerStream', async () => {
  const provider = install(createFakeModelProvider({ chunks: ['Bon', 'jour', ' Eyano'] }));

  const events = [];
  for await (const event of chatFlow(baseInput())) {
    events.push(event);
  }

  assert.equal(provider.streamCalls.length, 1);
  assert.deepEqual(
    events.map((e) => e.type),
    ['text', 'text', 'text', 'done']
  );
  assert.deepEqual(
    events.filter((e) => e.type === 'text').map((e) => e.content),
    ['Bon', 'jour', ' Eyano']
  );
  assert.equal(events[events.length - 1].content, 'Bonjour Eyano');
});

test('chatFlowSync delegue a GnoxeBrains.answer', async () => {
  const provider = install(createFakeModelProvider({ content: 'Reponse complete.' }));

  const result = await chatFlowSync(baseInput());

  assert.equal(provider.generateCalls.length, 1);
  assert.equal(provider.streamCalls.length, 0);
  assert.equal(result.content, 'Reponse complete.');
  assert.deepEqual(Object.keys(result), ['content', 'model', 'inputTokens', 'outputTokens']);
});

// ------------------------------------------------------------------ 3

test('titleFlow : salutation generee -> court-circuit sans appel modele', async () => {
  const provider = install(createFakeModelProvider({ content: 'Ne doit pas etre appele' }));

  const title = await titleFlow('Salut !');

  assert.equal(title, 'Nouvelle conversation');
  assert.equal(provider.generateCalls.length, 0);
  assert.equal(provider.streamCalls.length, 0);
});

test('titleFlow : message reel -> un appel modele court, titre tronque a 100', async () => {
  const longTitle = `${'Titre tres long '.repeat(20)}`;
  const provider = install(createFakeModelProvider({ content: `  ${longTitle}  ` }));

  const title = await titleFlow('Comment installer Eyano sur mon telephone ?');

  assert.equal(provider.generateCalls.length, 1);
  const request = provider.generateCalls[0];
  assert.equal(request.model, 'gnoxe-brains-1');
  assert.equal(request.temperature, 0.3);
  assert.equal(request.maxTokens, 50);
  assert.equal(request.messages.length, 1);
  assert.equal(request.messages[0].role, 'user');
  assert.ok(title.length <= 100);
  assert.equal(title, longTitle.trim().substring(0, 100));
});

// ------------------------------------------------------------------ 4 5 6

test('contexte utilisateur : le prenom est injecte dans la system instruction', async () => {
  const provider = install(createFakeModelProvider());

  await chatFlowSync(baseInput({ userName: 'David Judrel GNONDABEKA' }));

  const messages = provider.generateCalls[0].messages;
  assert.equal(messages[0].role, 'system');
  assert.ok(messages[0].content.includes("L'utilisateur s'appelle David."));
});

test('nettoyage A.2 : le canal ne change pas le prompt du cerveau', async () => {
  const provider = install(createFakeModelProvider());

  await chatFlowSync(baseInput({ channel: 'whatsapp' }));
  const withChannel = provider.generateCalls[0].messages[0].content;

  await chatFlowSync(baseInput());
  const withoutChannel = provider.generateCalls[1].messages[0].content;

  // Le style de canal vient de la voix (eyano-identity), jamais du cerveau.
  assert.equal(withChannel, withoutChannel);
  assert.equal(/whatsapp/i.test(withChannel), false);
});

test('modele demande : transmis au provider et reflete dans la sortie', async () => {
  const provider = install(createFakeModelProvider());

  const sync = await chatFlowSync(baseInput({ model: 'gnoxe-brains-1.5' }));
  assert.equal(provider.generateCalls[0].model, 'gnoxe-brains-1.5');
  assert.equal(sync.model, 'gnoxe-brains-1.5');

  const streamed = [];
  for await (const event of chatFlow(baseInput({ model: 'gnoxe-brains-1.5' }))) {
    streamed.push(event);
  }
  assert.equal(provider.streamCalls[0].model, 'gnoxe-brains-1.5');
  assert.equal(streamed[streamed.length - 1].model, 'gnoxe-brains-1.5');
});

test('modele par defaut : gnoxe-brains-1, comme avant la migration', async () => {
  const provider = install(createFakeModelProvider());

  const sync = await chatFlowSync(baseInput());

  assert.equal(provider.generateCalls[0].model, 'gnoxe-brains-1');
  assert.equal(sync.model, 'gnoxe-brains-1');
});

test('modele effectif : la sortie reflete le modele utilise, pas celui demande', async () => {
  const provider = install(createFakeModelProvider());
  const rawGenerate = provider.generate.bind(provider);
  provider.generate = async (request) => {
    const response = await rawGenerate(request);
    return { ...response, model: 'gnoxe-brains-1' };
  };

  const sync = await chatFlowSync(baseInput({ model: 'gnoxe-brains-1.5' }));
  assert.equal(provider.generateCalls[0].model, 'gnoxe-brains-1.5');
  assert.equal(sync.model, 'gnoxe-brains-1', 'le modele effectif prime sur le modele demande');

  const streamed = install(createFakeModelProvider());
  streamed.stream = async function* () {
    yield { type: 'text', content: 'ok' };
    yield { type: 'done', content: 'ok', model: 'gnoxe-brains-1' };
  };

  const events = [];
  for await (const event of chatFlow(baseInput({ model: 'gnoxe-brains-1.5' }))) {
    events.push(event);
  }
  assert.equal(events[events.length - 1].model, 'gnoxe-brains-1');
});

test('modele inconnu : refuse par le registre au lieu dun repli silencieux', async () => {
  assert.equal(isRegisteredModel('gnoxe-brains-1'), true);
  assert.equal(isRegisteredModel('gnoxe-brains-1.5'), true);
  assert.equal(isRegisteredModel('gnoxe-brains-2'), false);
  assert.equal(isRegisteredModel('n importe quoi'), false);
  assert.equal(isRegisteredModel(undefined), false);
  assert.deepEqual(listRegisteredModels(), ['gnoxe-brains-1', 'gnoxe-brains-1.5']);

  assert.equal(resolveBackendModel(undefined), 'gemini-3.5-flash-lite');
  assert.equal(resolveLogicalModel(undefined), 'gnoxe-brains-1');

  assert.throws(() => resolveBackendModel('gnoxe-brains-2'), /Modele inconnu/);
  assert.throws(() => resolveLogicalModel('gnoxe-brains-code'), /Modele inconnu/);
});

// ------------------------------------------------------------------ 7

test('streaming conserve : fragments relayes un par un puis un evenement done', async () => {
  install(createFakeModelProvider({ chunks: ['a', 'b', 'c', 'd'] }));

  const events = [];
  for await (const event of chatFlow(baseInput())) {
    events.push(event);
  }

  const texts = events.filter((e) => e.type === 'text');
  assert.equal(texts.length, 4);
  assert.deepEqual(
    texts.map((e) => e.content),
    ['a', 'b', 'c', 'd']
  );

  const done = events[events.length - 1];
  assert.equal(done.type, 'done');
  assert.equal(done.content, 'abcd');
  assert.equal(done.outputTokens, Math.ceil('abcd'.length / 4));
  assert.equal(typeof done.inputTokens, 'number');
});

// ------------------------------------------------------------------ 8

test('erreurs : chatFlowSync propage l exception du provider', async () => {
  install(createFakeModelProvider({ generateError: new Error('MODELE_HORS_SERVICE') }));

  await assert.rejects(() => chatFlowSync(baseInput()), (err) => {
    assert.equal(err.message, 'MODELE_HORS_SERVICE');
    return true;
  });
});

test('erreurs : chatFlow propage l exception du streaming', async () => {
  install(createFakeModelProvider({ streamError: new Error('STREAM_CASSE') }));

  await assert.rejects(
    async () => {
      for await (const event of chatFlow(baseInput())) {
        void event;
      }
    },
    (err) => {
      assert.equal(err.message, 'STREAM_CASSE');
      return true;
    }
  );
});

// ------------------------------------------------------------------ 9

test('compatibilite des signatures publiques', async () => {
  assert.equal(typeof chatFlow, 'function');
  assert.equal(typeof chatFlowSync, 'function');
  assert.equal(typeof titleFlow, 'function');
  assert.equal(chatFlow.length, 1);
  assert.equal(chatFlowSync.length, 1);
  assert.equal(titleFlow.length, 1);

  const output = await chatFlowSync(baseInput());
  assert.deepEqual(Object.keys(output).sort(), [
    'content',
    'inputTokens',
    'model',
    'outputTokens',
  ]);
  assert.equal(typeof output.content, 'string');
  assert.equal(typeof output.model, 'string');
  assert.equal(typeof output.inputTokens, 'number');
  assert.equal(typeof output.outputTokens, 'number');
});

// ------------------------------------------------------------------ 10

test('non-regression : estimation de tokens et contenu identiques', async () => {
  install(createFakeModelProvider({ content: 'Une reponse de reference.' }));

  const input = baseInput({
    messages: [
      { role: 'system', content: 'ignored by buildChatContext' },
      { role: 'user', content: 'Premier message' },
      { role: 'assistant', content: 'Reponse assistant' },
      { role: 'user', content: 'Message utilisateur final' },
    ],
  });

  const result = await chatFlowSync(input);

  const expectedContext = buildChatContext(input.messages, 20, undefined, undefined);
  const expectedInputTokens = expectedContext.reduce(
    (acc, m) => acc + Math.ceil(m.content.length / 4),
    0
  );

  assert.equal(result.inputTokens, expectedInputTokens);
  assert.equal(result.outputTokens, Math.ceil('Une reponse de reference.'.length / 4));
  assert.equal(result.content, 'Une reponse de reference.');
});

test('non-regression : injection du contexte de recherche web', async () => {
  const provider = install(createFakeModelProvider({ content: 'Reponse avec recherche.' }));

  const result = await chatFlowSync(
    baseInput({ messages: [{ role: 'user', content: 'Quel est le dernier album sorti ?' }] })
  );

  assert.equal(searchCalls.length, 1);
  const lastMessage = provider.generateCalls[0].messages.slice(-1)[0];
  assert.ok(lastMessage.content.includes('[Resultats de recherche web'));
  assert.ok(lastMessage.content.includes('Source: Extrait.'));
  assert.equal(result.content, 'Reponse avec recherche.');
});

test('non-regression : pas de recherche web quand le declencheur ne matche pas', async () => {
  install(createFakeModelProvider());

  await chatFlowSync(baseInput({ messages: [{ role: 'user', content: 'Merci beaucoup' }] }));

  assert.equal(searchCalls.length, 0);
});

// ------------------------------------------------------------------ couches

test('les trois flows n utilisent plus le AIProvider legacy', () => {
  const flowsDir = path.join(__dirname, '..', 'dist', 'flows');
  for (const file of ['chat.flow.js', 'title.flow.js']) {
    const content = fs.readFileSync(path.join(flowsDir, file), 'utf8');
    assert.ok(!content.includes('getAIProvider'), `${file} ne doit plus appeler getAIProvider()`);
    assert.ok(content.includes('getGnoxeBrains'), `${file} doit passer par GnoxeBrains`);
  }
});

test("apps/api : tous les symboles importes depuis le package GnoxeBrains existent toujours", () => {
  const apiSrc = path.join(__dirname, '..', '..', '..', 'apps', 'api', 'src');
  const aiPackage = require('../dist/index.js');
  const importRe = /\bimport\s*\{([^}]*)\}\s*from\s*['"]@eyano\/gnoxe-brains['"]/g;

  const collect = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return collect(full);
      if (!entry.name.endsWith('.ts')) return [];
      const content = fs.readFileSync(full, 'utf8');
      const symbols = [];
      let match;
      while ((match = importRe.exec(content)) !== null) {
        for (const raw of match[1].split(',')) {
          const name = raw.trim().replace(/^type\s+/, '');
          if (name) symbols.push(name);
        }
      }
      return symbols.length > 0 ? [{ file: path.relative(apiSrc, full), symbols }] : [];
    });

  const imports = collect(apiSrc);
  assert.ok(imports.length > 0, 'apps/api doit bien importer depuis le package GnoxeBrains');

  for (const { file, symbols } of imports) {
    for (const symbol of symbols) {
      assert.ok(
        symbol in aiPackage,
        `${file} importe un symbole absent du package GnoxeBrains : ${symbol}`
      );
    }
  }
});

test("apps/api : ai.service.ts n a pas ete converti vers GnoxeBrains", () => {
  const aiService = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'apps', 'api', 'src', 'modules', 'ai', 'ai.service.ts'),
    'utf8'
  );
  assert.ok(!aiService.includes('GnoxeBrains'), 'ai.service.ts doit rester inchange');
  assert.ok(!aiService.includes('getModelProvider'), 'ai.service.ts doit rester inchange');
});

test('declencheur : l actualite declenche la recherche, les questions pratiques non', async () => {
  install(createFakeModelProvider());
  await chatFlowSync(baseInput({ messages: [{ role: 'user', content: "c'est quoi le dernier album de Fally Ipupa ?" }] }));
  assert.equal(searchCalls.length, 1);

  for (const content of ['Comment installer Node.js ?', 'Tu peux écouter ma question ?', 'J ai un bug dans mon code', 'Crée un plan de révision']) {
    searchCalls.length = 0;
    await chatFlowSync(baseInput({ messages: [{ role: 'user', content }] }));
    assert.equal(searchCalls.length, 0, content);
  }
});

test('declencheur : tolere les fautes de frappe sur les mots d actualite', async () => {
  install(createFakeModelProvider());
  for (const content of ["c'est uoi le dernie albul de fallu ipupa", 'il y a un concer ce soir ?', 'qui a gagné l electon ?']) {
    searchCalls.length = 0;
    await chatFlowSync(baseInput({ messages: [{ role: 'user', content }] }));
    assert.equal(searchCalls.length, 1, content);
  }
  for (const content of ['j ai pris mon cafe', 'merci pour ton aide']) {
    searchCalls.length = 0;
    await chatFlowSync(baseInput({ messages: [{ role: 'user', content }] }));
    assert.equal(searchCalls.length, 0, content);
  }
});

test('recherche : une question de suite reprend le sujet de la question precedente', async () => {
  install(createFakeModelProvider());
  const messages = [
    { role: 'user', content: 'qui est Denis sassou nguesso' },
    { role: 'assistant', content: 'Denis Sassou-Nguesso est un homme d Etat congolais.' },
    { role: 'user', content: 'son dernier mendats?' },
  ];
  searchCalls.length = 0;
  await chatFlowSync(baseInput({ messages }));
  assert.equal(searchCalls.length, 1);
  assert.match(searchCalls[0], /^Denis sassou nguesso son dernier mendats/);

  searchCalls.length = 0;
  await chatFlowSync(baseInput({ messages: [...messages.slice(0, 2), { role: 'user', content: 'quel est le dernier album de Fally Ipupa sorti en 2026' }] }));
  assert.doesNotMatch(searchCalls[0], /sassou/i, 'question autonome : sujet precedent non ajoute');
});
