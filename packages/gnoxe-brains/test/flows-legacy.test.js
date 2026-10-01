'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  GnoxeBrains,
  GnoxeBrainsProvider,
  summaryFlow,
  documentAnalysisFlow,
  chatFlow,
  chatFlowSync,
  titleFlow,
  setGnoxeBrains,
  getAIProvider,
  setAIProvider,
  getActiveProviderName,
} = require('../dist/index.js');

const { createFakeModelProvider } = require('./helpers.js');

const FLOWS_DIR = path.join(__dirname, '..', 'src', 'flows');

function install(provider) {
  const brains = new GnoxeBrains({
    modelProvider: provider,
    config: { defaultModel: 'gnoxe-brains-1' },
  });
  setGnoxeBrains(brains);
  return brains;
}

function chatInput(message) {
  return {
    userId: 'user-1',
    conversationId: 'conv-1',
    messages: [{ role: 'user', content: message }],
  };
}

// ---------------------------------------------------------------- summaryFlow

test('summaryFlow : signature conservee et delegation vers GnoxeBrains', async () => {
  const provider = createFakeModelProvider({ content: '  Resume final.  ' });
  install(provider);

  const output = await summaryFlow([
    { role: 'user', content: 'Salut Eyano' },
    { role: 'assistant', content: 'Bonjour !' },
  ]);

  assert.equal(output, 'Resume final.');

  const call = provider.calls.find((c) => c.kind === 'generate');
  assert.ok(call, 'un seul appel modele');
  assert.equal(provider.calls.filter((c) => c.kind === 'generate').length, 1);
  assert.equal(call.request.model, 'gnoxe-brains-1');
  assert.equal(call.request.temperature, 0.3);
  assert.equal(call.request.maxTokens, 200);
  assert.equal(call.request.messages.length, 1);
  assert.equal(call.request.messages[0].role, 'user');

  const prompt = call.request.messages[0].content;
  assert.ok(prompt.includes('2-3 phrases maximum'));
  assert.ok(prompt.includes('Utilisateur: Salut Eyano'));
  assert.ok(prompt.includes('EYANO: Bonjour !'));
});

test('summaryFlow : la panne du modele est propagée, jamais masquee', async () => {
  install(createFakeModelProvider({ generateError: new Error('MODELE_KO') }));

  await assert.rejects(
    () => summaryFlow([{ role: 'user', content: 'Salut' }]),
    /MODELE_KO/
  );
});

// -------------------------------------------------------- documentAnalysisFlow

test('documentAnalysisFlow : signature conservee et delegation vers GnoxeBrains', async () => {
  const provider = createFakeModelProvider({ content: '  Analyse brute.  ' });
  install(provider);

  const output = await documentAnalysisFlow('CONTENU_DU_DOCUMENT', 'Quel est le resume ?');

  assert.equal(output, '  Analyse brute.  ', 'le retour reste brut, comme avant');

  const call = provider.calls.find((c) => c.kind === 'generate');
  assert.equal(call.request.model, 'gnoxe-brains-1.5');
  assert.equal(call.request.temperature, 0.5);
  assert.equal(call.request.maxTokens, 4096);
  assert.equal(call.request.messages.length, 1);

  const prompt = call.request.messages[0].content;
  assert.ok(prompt.includes('CONTENU_DU_DOCUMENT'));
  assert.ok(prompt.includes('Quel est le resume ?'));
  assert.ok(prompt.includes("contenu d'un document"));
});

test('documentAnalysisFlow : la panne du modele est propagée', async () => {
  install(createFakeModelProvider({ generateError: new Error('MODELE_KO') }));

  await assert.rejects(() => documentAnalysisFlow('doc', 'question'), /MODELE_KO/);
});

// ------------------------------------------------------- independance legacy

test('summaryFlow et documentAnalysisFlow ignorent totalement le AIProvider legacy', async () => {
  const legacy = {
    name: 'legacy-backend',
    generate: async () => 'LEGACY',
    stream: async function* () {},
  };

  setAIProvider(legacy);
  install(createFakeModelProvider({ content: 'BRAIN' }));

  try {
    // Les deux canaux coexistent sans se meler : la telemetrie legacy
    // voit encore son provider, les flows voient GnoxeBrains.
    assert.equal(getActiveProviderName(), 'legacy-backend');
    assert.equal(await getAIProvider().generate([{ role: 'user', content: 'x' }]), 'LEGACY');

    assert.equal(await summaryFlow([{ role: 'user', content: 'Salut' }]), 'BRAIN');
    assert.equal(await documentAnalysisFlow('doc', 'q'), 'BRAIN');
  } finally {
    setAIProvider(new GnoxeBrainsProvider());
    setGnoxeBrains(null);
  }
});

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

test('aucun flow ne reference plus getAIProvider', () => {
  for (const file of ['chat.flow.ts', 'title.flow.ts', 'summary.flow.ts', 'document.flow.ts']) {
    const content = fs.readFileSync(path.join(FLOWS_DIR, file), 'utf8');
    const code = stripComments(content);

    assert.ok(!code.includes('getAIProvider'), `${file} ne doit plus appeler getAIProvider`);
    assert.ok(code.includes('getGnoxeBrains'), `${file} doit passer par GnoxeBrains`);
  }
});

// ------------------------------------------------------------ anciennes API

test('anciennes API publiques conservees', () => {
  assert.equal(typeof getAIProvider, 'function');
  assert.equal(typeof setAIProvider, 'function');
  assert.equal(typeof getActiveProviderName, 'function');

  const provider = getAIProvider();
  assert.equal(typeof provider.name, 'string');
  assert.equal(typeof provider.generate, 'function');
  assert.equal(typeof provider.stream, 'function');

  assert.equal(getActiveProviderName(), 'gnoxe-brains');

  assert.equal(typeof summaryFlow, 'function');
  assert.equal(typeof documentAnalysisFlow, 'function');
  assert.equal(summaryFlow.length, 1);
  assert.equal(documentAnalysisFlow.length, 2);
});

test('remplacement du provider legacy par un fake provider', async () => {
  const fake = {
    name: 'fake-legacy',
    generate: async () => 'FAKE_LEGACY',
    stream: async function* () {
      yield 'FAKE_LEGACY';
    },
  };

  setAIProvider(fake);
  try {
    assert.equal(getActiveProviderName(), 'fake-legacy');
    assert.equal(await getAIProvider().generate([{ role: 'user', content: 'x' }]), 'FAKE_LEGACY');
    const chunks = [];
    for await (const chunk of getAIProvider().stream([{ role: 'user', content: 'x' }])) {
      chunks.push(chunk);
    }
    assert.deepEqual(chunks, ['FAKE_LEGACY']);
  } finally {
    setAIProvider(new GnoxeBrainsProvider());
  }

  assert.equal(getActiveProviderName(), 'gnoxe-brains');
});

// ------------------------------------------------------------ non-regression

test('non-regression : chatFlowSync, chatFlow et titleFlow restent operationnels', async () => {
  install(createFakeModelProvider({ content: 'Reponse.', chunks: ['Bon', 'jour'] }));

  try {
    const sync = await chatFlowSync(chatInput('Presente-toi brievement.'));
    assert.deepEqual(Object.keys(sync).sort(), ['content', 'inputTokens', 'model', 'outputTokens']);
    assert.equal(sync.content, 'Reponse.');
    assert.equal(sync.model, 'gnoxe-brains-1');
    assert.equal(sync.outputTokens, Math.ceil('Reponse.'.length / 4));

    const events = [];
    for await (const event of chatFlow(chatInput('Presente-toi brievement.'))) {
      events.push(event);
    }
    assert.deepEqual(
      events.map((e) => e.type),
      ['text', 'text', 'done']
    );
    assert.equal(events[events.length - 1].content, 'Bonjour');

    assert.equal(await titleFlow('Comment installer Eyano sur mon telephone ?'), 'Reponse.');
    assert.equal(await titleFlow('Salut !'), 'Nouvelle conversation');
  } finally {
    setGnoxeBrains(null);
  }
});

test('propagation des erreurs : streaming et reponse sync refusent de masquer la panne', async () => {
  install(
    createFakeModelProvider({
      generateError: new Error('MODELE_KO'),
      streamError: new Error('STREAM_KO'),
    })
  );

  try {
    await assert.rejects(() => chatFlowSync(chatInput('Presente-toi brievement.')), /MODELE_KO/);
    await assert.rejects(
      async () => {
        for await (const event of chatFlow(chatInput('Presente-toi brievement.'))) {
          void event;
        }
      },
      /STREAM_KO/
    );
  } finally {
    setGnoxeBrains(null);
  }
});
