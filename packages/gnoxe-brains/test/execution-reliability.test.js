'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  GnoxeBrains,
  EYANO_MODELS,
  ExecutionReliability,
  ProviderExecutionError,
  executionReliability,
} = require('../dist/index.js');

const SRC = path.join(__dirname, '..', 'src');
const MESSAGES = [{ role: 'user', content: 'Salut' }];

function createProvider(options = {}) {
  const calls = [];
  const capabilities = {
    streaming: true,
    structuredOutput: true,
    images: false,
    models: ['gnoxe-brains-1', 'gnoxe-brains-1.5'],
    ...options.capabilities,
  };

  return {
    name: 'fake-backend',
    calls,
    async generate(request) {
      calls.push({ kind: 'generate', request });
      if (options.generateError) throw options.generateError;
      return { content: 'ok', model: request.model, provider: 'fake-backend' };
    },
    async *stream(request) {
      calls.push({ kind: 'stream', request });
      if (options.streamErrorBeforeFirst) throw options.streamErrorBeforeFirst;

      const chunks = options.textChunks ?? ['ok'];
      for (const content of chunks) {
        yield { type: 'text', content };
      }

      if (options.streamErrorAfter) throw options.streamErrorAfter;
      yield { type: 'done', content: chunks.join('') };
    },
    async structuredOutput(request) {
      calls.push({ kind: 'structuredOutput', request });
      return {};
    },
    capabilities() {
      return capabilities;
    },
  };
}

async function collect(brains, input) {
  const received = [];
  for await (const chunk of brains.answerStream(input)) {
    received.push(chunk);
  }
  return received;
}

// ------------------------------------------------------------------ contrat

test('contrat : trois codes de phase, aucun partage avec la validation', () => {
  const source = fs.readFileSync(path.join(SRC, 'core', 'execution-reliability.ts'), 'utf8');

  for (const code of [
    'PROVIDER_CALL_FAILED',
    'PROVIDER_STREAM_FAILED',
    'PROVIDER_STREAM_INTERRUPTED',
  ]) {
    assert.ok(source.includes(`'${code}'`), `code absent : ${code}`);
  }

  // Aucun code de la couche de validation etape 22 n est reutilise ici.
  for (const validationCode of [
    'EXECUTION_STREAMING_INVALID',
    'EXECUTION_STRUCTURED_OUTPUT_INVALID',
    'EXECUTION_TEMPERATURE_INVALID',
    'EXECUTION_MAX_TOKENS_INVALID',
  ]) {
    assert.ok(!source.includes(validationCode), `code de validation detourne : ${validationCode}`);
  }

  assert.ok(executionReliability instanceof ExecutionReliability);
});

test('contrat : message strictement identique a celui du provider', async () => {
  const provider = createProvider({ generateError: new Error('MODELE_HORS_SERVICE') });
  const brains = new GnoxeBrains({ modelProvider: provider });

  await assert.rejects(
    () => brains.answer({ messages: MESSAGES }),
    (error) => {
      assert.equal(error.message, 'MODELE_HORS_SERVICE', 'aucun prefixe, aucune reformulation');
      assert.equal(error.name, 'ProviderExecutionError');
      assert.equal(error.code, 'PROVIDER_CALL_FAILED');
      return true;
    }
  );
});

test('contrat : la cause est LA reference originale, jamais un clone', async () => {
  const original = new Error('MODELE_KO');
  original.code = 'ETIMEDOUT';
  original.statusCode = 503;

  const provider = createProvider({ generateError: original });
  const brains = new GnoxeBrains({ modelProvider: provider });

  await assert.rejects(
    () => brains.answer({ messages: MESSAGES }),
    (error) => {
      assert.equal(error.cause, original, 'reference conservee, pas de copie');
      assert.equal(error.cause.name, 'Error', 'nom d origine intact');
      assert.equal(error.cause.message, 'MODELE_KO');
      assert.equal(error.cause.code, 'ETIMEDOUT', 'contexte metier intact');
      assert.equal(error.cause.statusCode, 503);
      assert.ok(typeof error.cause.stack === 'string', 'pile originale intacte');
      return true;
    }
  );
});

test('contrat : un jeton non Error n est pas deforme', async () => {
  assert.equal(executionReliability.callFailure('texte brut').message, 'texte brut');
  assert.equal(executionReliability.callFailure(42).message, '42');
  assert.equal(executionReliability.callFailure(new Error('')).message, '');
});

// ------------------------------------- validation contre execution provider

test('erreur de validation : aucun appel provider, jamais une erreur d execution', async () => {
  const cases = [
    { input: { messages: MESSAGES, temperature: 9 }, name: 'ExecutionPolicyError' },
    { input: { messages: MESSAGES, maxTokens: 0 }, name: 'ExecutionPolicyError' },
    { input: { messages: MESSAGES, model: 'inconnu' }, name: 'ModelResolutionError' },
    {
      input: { messages: MESSAGES, model: 'gnoxe-brains-1.5' },
      name: 'ProviderCapabilityError',
      options: { capabilities: { models: ['gnoxe-brains-1'] } },
    },
  ];

  for (const item of cases) {
    const provider = createProvider(item.options);
    const brains = new GnoxeBrains({ modelProvider: provider });

    await assert.rejects(
      () => brains.answer(item.input),
      (error) => {
        assert.equal(error.name, item.name, `attendu ${item.name}`);
        assert.ok(!(error instanceof ProviderExecutionError), 'jamais qualifiee en echec provider');
        return true;
      }
    );

    assert.equal(provider.calls.length, 0, `${item.name} : aucun appel provider`);
  }
});

test('erreur provider : appel effectue puis echec, avec un code d execution', async () => {
  const provider = createProvider({ generateError: new Error('PANNE') });
  const brains = new GnoxeBrains({ modelProvider: provider });

  await assert.rejects(
    () => brains.answer({ messages: MESSAGES, model: 'gnoxe-brains-1.5' }),
    (error) => {
      assert.ok(error instanceof ProviderExecutionError);
      assert.equal(error.code, 'PROVIDER_CALL_FAILED');
      assert.equal(error.fragmentsDelivered, 0);
      return true;
    }
  );

  assert.equal(provider.calls.length, 1, 'l appel A eu lieu : c est la difference');
  assert.equal(provider.calls[0].request.model, 'gnoxe-brains-1.5', 'modele resolu, inchange');
});

// ------------------------------------------------------- phases du streaming

test('streaming : echec avant le premier fragment', async () => {
  const provider = createProvider({ streamErrorBeforeFirst: new Error('STREAM_KO') });
  const brains = new GnoxeBrains({ modelProvider: provider });

  const received = [];
  await assert.rejects(
    async () => {
      for await (const chunk of brains.answerStream({ messages: MESSAGES })) {
        received.push(chunk);
      }
    },
    (error) => {
      assert.equal(error.code, 'PROVIDER_STREAM_FAILED');
      assert.equal(error.fragmentsDelivered, 0);
      assert.equal(error.message, 'STREAM_KO');
      return true;
    }
  );

  assert.equal(received.length, 0, 'rien n a ete rendu a l appelant');
  assert.equal(provider.calls.length, 1);
});

test('streaming : echec pendant le flux, apres les fragments rendus', async () => {
  const provider = createProvider({
    textChunks: ['bonjour ', 'tout le '],
    streamErrorAfter: new Error('COUPE'),
  });
  const brains = new GnoxeBrains({ modelProvider: provider });

  const received = [];
  await assert.rejects(
    async () => {
      for await (const chunk of brains.answerStream({ messages: MESSAGES })) {
        received.push(chunk);
      }
    },
    (error) => {
      assert.equal(error.code, 'PROVIDER_STREAM_INTERRUPTED');
      assert.equal(error.fragmentsDelivered, 2, 'le compteur reflete ce que l appelant a affiche');
      assert.equal(error.message, 'COUPE');
      return true;
    }
  );

  const texts = received.filter((chunk) => chunk.type === 'text');
  assert.equal(texts.length, 2, 'les deux fragments ont bien ete rendus avant l echec');
  assert.ok(!received.some((chunk) => chunk.type === 'done'), 'aucun done sur un flux coupe');
  assert.equal(provider.calls.length, 1);
});

test('streaming : echec a l ouverture du flux', async () => {
  const provider = createProvider();
  const opened = new Error('OUVERTURE_KO');
  provider.stream = () => {
    provider.calls.push({ kind: 'stream', request: {} });
    throw opened;
  };

  const brains = new GnoxeBrains({ modelProvider: provider });

  await assert.rejects(
    async () => {
      for await (const chunk of brains.answerStream({ messages: MESSAGES })) {
        void chunk;
      }
    },
    (error) => {
      assert.equal(error.code, 'PROVIDER_STREAM_FAILED');
      assert.equal(error.fragmentsDelivered, 0);
      assert.equal(error.cause, opened);
      return true;
    }
  );

  assert.equal(provider.calls.length, 1);
});

test('streaming : le chemin nominal reste intact', async () => {
  const provider = createProvider({ textChunks: ['a', 'b'] });
  const brains = new GnoxeBrains({ modelProvider: provider });

  const received = await collect(brains, { messages: MESSAGES });

  assert.deepEqual(
    received.map((chunk) => chunk.type),
    ['text', 'text', 'done']
  );
  assert.equal(received[received.length - 1].content, 'ab');
  assert.equal(received[received.length - 1].provider, 'fake-backend');
});

// --------------------------------------------------- aucune substitution

test("l'erreur du consommateur n'est jamais requalifiee en echec provider", async () => {
  const provider = createProvider({ textChunks: ['un', 'deux'] });
  const brains = new GnoxeBrains({ modelProvider: provider });

  await assert.rejects(
    async () => {
      for await (const _chunk of brains.answerStream({ messages: MESSAGES })) {
        throw new Error('CONSO_KO');
      }
    },
    (error) => {
      assert.equal(error.message, 'CONSO_KO');
      assert.equal(error.name, 'Error', 'nom d origine, pas celui de la couche');
      assert.ok(!(error instanceof ProviderExecutionError));
      return true;
    }
  );
});

test('une erreur deja qualifiee ne l est pas une deuxieme fois', async () => {
  const original = new Error('KO');
  const once = executionReliability.callFailure(original);

  const twice = executionReliability.callFailure(once);
  assert.equal(twice, once, 'aucune enveloppe imbriquee');
  assert.equal(twice.cause, original, 'la cause reste la premiere erreur');

  const wrapped = await executionReliability
    .call(() => Promise.reject(once))
    .catch((error) => error);

  assert.equal(wrapped, once, 'call() ne re-enveloppe pas non plus');
  assert.equal(wrapped.cause, original);
});

test('pas de retry : une seule tentative, un seul appel provider', async () => {
  for (const plan of [
    { input: { messages: MESSAGES }, options: { generateError: new Error('KO') } },
    { input: { messages: MESSAGES, model: 'gnoxe-brains-1.5' }, options: { generateError: new Error('KO') } },
  ]) {
    const provider = createProvider(plan.options);
    const brains = new GnoxeBrains({ modelProvider: provider });

    await assert.rejects(() => brains.answer(plan.input));
    assert.equal(provider.calls.length, 1, 'aucune seconde tentative');
  }
});

test('aucun changement de modele apres echec : la resolution reste intangible', async () => {
  const provider = createProvider({ generateError: new Error('KO') });
  const brains = new GnoxeBrains({ modelProvider: provider });

  await assert.rejects(() =>
    brains.answer({ messages: MESSAGES, model: 'gnoxe-brains-1.5', maxTokens: 4096 })
  );

  assert.equal(provider.calls.length, 1, 'jamais un nouvel appel vers un modele de repli');
  assert.equal(provider.calls[0].request.model, 'gnoxe-brains-1.5', 'modele demande, non substitue');
  assert.equal(provider.calls[0].request.maxTokens, 4096, 'parametres de la resolution d origine');

  const streamed = createProvider({ streamErrorBeforeFirst: new Error('KO') });
  const streaming = new GnoxeBrains({ modelProvider: streamed });

  await assert.rejects(async () => {
    for await (const _chunk of streaming.answerStream({
      messages: MESSAGES,
      model: 'gnoxe-brains-1.5',
    })) {
      void _chunk;
    }
  });

  assert.equal(streamed.calls.length, 1, 'le streaming non plus ne retente pas');
  assert.equal(streamed.calls[0].request.model, 'gnoxe-brains-1.5');
});

test('determinisme : memes entrees, memes codes et memes messages', () => {
  const signatures = new Set();

  for (let i = 0; i < 50; i += 1) {
    const error = executionReliability.callFailure(new Error('KO'));
    signatures.add(`${error.name}|${error.code}|${error.message}|${error.fragmentsDelivered}`);
  }
  assert.equal(signatures.size, 1);

  const streamSignatures = new Set();
  for (let i = 0; i < 50; i += 1) {
    const error = executionReliability.streamFailure(new Error('KO'), 3);
    streamSignatures.add(`${error.code}|${error.fragmentsDelivered}`);
  }
  assert.equal(streamSignatures.size, 1);

  const zero = new Set();
  for (let i = 0; i < 50; i += 1) {
    zero.add(executionReliability.streamFailure(new Error('KO'), 0).code);
  }
  assert.deepEqual([...zero], ['PROVIDER_STREAM_FAILED']);

  assert.ok(executionReliability.callFailure(new Error('KO')) instanceof ProviderExecutionError);
  assert.ok(
    new ExecutionReliability().callFailure(new Error('KO')) instanceof ProviderExecutionError,
    'aucune instance n apporte d etat'
  );
});

test("l'operation est invoquee une seule fois : aucune boucle de reprise", () => {
  const source = fs.readFileSync(path.join(SRC, 'core', 'execution-reliability.ts'), 'utf8');

  assert.equal(source.split('operation()').length - 1, 1, 'exactement une invocation');

  for (const token of [
    'setTimeout',
    'setInterval',
    'Math.random',
    'AbortSignal',
    'Date.now',
    '.sort(',
    '.catch(',
    'attempt',
    'new Promise',
    'for (',
    'while (',
  ]) {
    assert.ok(!source.includes(token), `mecanique de reprise interdite : "${token}"`);
  }
});

// --------------------------------------------------------------- layering

test('layering : la couche ne depend de rien du tout', () => {
  const source = fs.readFileSync(path.join(SRC, 'core', 'execution-reliability.ts'), 'utf8');

  const specs = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(specs, [], 'aucun import : la couche ne connait ni le catalogue ni le provider');

  for (const token of [
    'GeminiAdapter',
    'gemini-adapter',
    'GeminiKeyManager',
    'providers/bootstrap',
    'Genkit',
    'genkit',
    'Google',
    'googleai',
    'GEMINI_API_KEY',
    'process.env',
    'fetch(',
    'console.',
    'EYANO_MODELS',
    'configureGnoxeBrains',
    'getGnoxeBrainsConfig',
    'modelResolver',
    'executionPolicy',
    'providerCapabilityResolver',
    'markDependencyError',
    'describeError',
  ]) {
    assert.ok(!source.includes(token), `la couche ne doit pas nommer "${token}"`);
  }
});

test('regressions etes 18 a 22 : surfaces preservees', async () => {
  assert.equal(EYANO_MODELS.length, 5, 'catalogue etape 19 intact');

  const provider = createProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  const answer = await brains.answer({ messages: MESSAGES, temperature: 0.3, maxTokens: 200 });
  assert.deepEqual(Object.keys(answer).sort(), ['content', 'model', 'provider']);
  assert.ok(!('usage' in answer), 'telemetrie etape 18 intacte');
  assert.equal(provider.calls[0].request.temperature, 0.3, 'police etape 22 intacte');
  assert.equal(provider.calls[0].request.maxTokens, 200);

  await assert.rejects(
    () =>
      new GnoxeBrains({
        modelProvider: createProvider({ capabilities: { models: ['gnoxe-brains-1'] } }),
      }).answer({ messages: MESSAGES, model: 'gnoxe-brains-1.5' }),
    (error) => error.name === 'ProviderCapabilityError',
    'etape 21 intacte'
  );

  await assert.rejects(
    () => brains.answer({ messages: MESSAGES, temperature: 9 }),
    (error) => error.name === 'ExecutionPolicyError',
    'etape 22 intacte'
  );
  assert.equal(provider.calls.length, 1, 'les refus de validation ne sont jamais enveloppes');
});
