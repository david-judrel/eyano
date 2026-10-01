'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  GnoxeBrains,
  EYANO_MODELS,
  ExecutionPolicyError,
  ModelResolutionError,
  ProviderCapabilityError,
  ProviderExecutionError,
  aggregateUsage,
  getDefaultModel,
} = require('../dist/index.js');

const SRC = path.join(__dirname, '..', 'src');
const MESSAGES = [{ role: 'user', content: 'Salut' }];

/**
 * Provider factice TRACE : chaque entree de couche observee est enregistree
 * dans l ordre, ce qui rend l ordre reel des couches prouvable.
 * `capabilities`, `generate`, `stream` et `structuredOutput` sont les seules
 * porte d entree du provider.
 */
function createPipelineProvider(options = {}) {
  const trace = [];
  const calls = [];
  const capabilitiesValue = {
    streaming: true,
    structuredOutput: true,
    images: false,
    models: ['gnoxe-brains-1', 'gnoxe-brains-1.5'],
    ...options.capabilities,
  };

  return {
    name: 'fake-backend',
    trace,
    calls,
    capabilities() {
      trace.push('capabilities');
      return capabilitiesValue;
    },
    async generate(request) {
      trace.push('generate');
      calls.push(request);
      if (options.generateError) throw options.generateError;
      return (
        options.response ?? {
          content: 'Reponse.',
          model: request.model,
          provider: 'fake-backend',
        }
      );
    },
    async *stream(request) {
      trace.push('stream');
      calls.push(request);
      if (options.streamErrorBeforeFirst) throw options.streamErrorBeforeFirst;

      const chunks = options.textChunks ?? ['bonjour'];
      for (const content of chunks) {
        yield { type: 'text', content };
      }

      if (options.streamErrorAfter) throw options.streamErrorAfter;

      yield options.doneChunk
        ? { type: 'done', content: chunks.join(''), ...options.doneChunk }
        : { type: 'done', content: chunks.join('') };
    },
    async structuredOutput(request) {
      trace.push('structuredOutput');
      calls.push(request);
      return {};
    },
  };
}

function rejected(promise, expected) {
  return assert.rejects(promise, (error) => {
    assert.ok(
      error instanceof expected,
      `attendu ${expected.name}, recu ${error.name}`
    );
    return true;
  });
}

function assertNoNetwork(provider) {
  assert.equal(provider.calls.length, 0, 'aucun appel model');
  assert.ok(!provider.trace.includes('generate'), 'generate jamais touche');
  assert.ok(!provider.trace.includes('stream'), 'stream jamais touche');
  assert.ok(
    !provider.trace.includes('structuredOutput'),
    'structuredOutput jamais touche'
  );
}

// ------------------------------------------------- flux nominaux

test('texte : toutes les couches, dans lordre, un seul appel', async () => {
  const usage = Object.freeze({
    model: 'gnoxe-brains-1.5',
    provider: 'fake-backend',
    inputTokens: 11,
    outputTokens: 7,
    totalTokens: 18,
  });
  // Reponse GELEE : toute tentative d ecriture dedans ferait echouer le test.
  const response = Object.freeze({
    content: 'Bonjour.',
    model: 'gnoxe-brains-1.5',
    provider: 'fake-backend',
    usage,
  });

  const provider = createPipelineProvider({ response });
  const brains = new GnoxeBrains({ modelProvider: provider });

  const result = await brains.answer({
    messages: MESSAGES,
    model: 'gnoxe-brains-1.5',
    temperature: 0.3,
    maxTokens: 4096,
  });

  assert.deepEqual(provider.trace, ['capabilities', 'generate'], 'ordre reel des couches');
  assert.equal(provider.calls.length, 1, 'une seule execution');

  const request = provider.calls[0];
  assert.equal(request.messages, MESSAGES, 'historique transmis tel quel, jamais reecrit');
  assert.equal(request.model, 'gnoxe-brains-1.5', 'modele resolu, inchange');
  assert.equal(request.temperature, 0.3, 'parametre de la police, intact');
  assert.equal(request.maxTokens, 4096);
  assert.deepEqual(Object.keys(request).sort(), [
    'maxTokens',
    'messages',
    'model',
    'temperature',
  ]);

  assert.deepEqual(Object.keys(result).sort(), ['content', 'model', 'provider']);
  assert.equal(result.content, 'Bonjour.');
  assert.equal(result.model, 'gnoxe-brains-1.5');
  assert.equal(result.provider, 'fake-backend');
  assert.ok(!('usage' in result), 'telemetrie non exposee par la facade');

  assert.equal(usage.totalTokens, 18, 'telemetrie du provider intacte sur une reponse gelee');
  assert.ok(!provider.trace.includes('structuredOutput'), 'aucun appel structure en chemin');
});

test('streaming : toutes les couches, dans lordre, un seul appel', async () => {
  const provider = createPipelineProvider({
    textChunks: ['Sal', 'ut'],
    doneChunk: {
      model: 'gnoxe-brains-1.5',
      usage: Object.freeze({
        model: 'gnoxe-brains-1.5',
        provider: 'fake-backend',
        inputTokens: 4,
        outputTokens: 2,
        totalTokens: 6,
      }),
    },
  });
  const brains = new GnoxeBrains({ modelProvider: provider });

  const chunks = [];
  for await (const chunk of brains.answerStream({
    messages: MESSAGES,
    model: 'gnoxe-brains-1.5',
    temperature: 0.3,
    maxTokens: 4096,
  })) {
    chunks.push(chunk);
  }

  assert.deepEqual(provider.trace, ['capabilities', 'stream'], 'ordre reel des couches');
  assert.equal(provider.calls.length, 1);
  assert.equal(provider.calls[0].temperature, 0.3);
  assert.equal(provider.calls[0].maxTokens, 4096);
  assert.equal(provider.calls[0].model, 'gnoxe-brains-1.5');

  assert.deepEqual(
    chunks.map((chunk) => chunk.type),
    ['text', 'text', 'done']
  );

  const done = chunks[chunks.length - 1];
  assert.deepEqual(Object.keys(done).sort(), ['content', 'model', 'provider', 'type']);
  assert.equal(done.content, 'Salut');
  assert.equal(done.model, 'gnoxe-brains-1.5');
  assert.equal(done.provider, 'fake-backend');
  assert.ok(!('usage' in done), 'telemetrie du flux non exposee par la facade');
  assert.ok(!provider.trace.includes('structuredOutput'));
});

// ------------------------------------------- ordre exact des validations

test('lordre est fixe : police, puis modele, puis capacite, puis execution', async () => {
  // 1. Police AVANT le modele : les deux sont invalides, la police gagne.
  const policeVsModele = createPipelineProvider({ capabilities: { models: [] } });
  await rejected(
    new GnoxeBrains({ modelProvider: policeVsModele }).answer({
      messages: MESSAGES,
      model: 'inconnu',
      temperature: 9,
    }),
    ExecutionPolicyError
  );
  assertNoNetwork(policeVsModele);
  assert.deepEqual(policeVsModele.trace, [], 'aucune couche atteinte');

  // 2. Police interne : temperature jugee avant maxTokens.
  const policeInterne = createPipelineProvider();
  const policeErreur = await new GnoxeBrains({ modelProvider: policeInterne })
    .answer({ messages: MESSAGES, temperature: 9, maxTokens: 0 })
    .catch((error) => error);
  assert.ok(policeErreur instanceof ExecutionPolicyError);
  assert.equal(policeErreur.code, 'EXECUTION_TEMPERATURE_INVALID', 'temperature jugee en premier');
  assertNoNetwork(policeInterne);
  assert.deepEqual(policeInterne.trace, [], 'aucune couche atteinte');

  // 3. Modele AVANT la capacite : les deux refusent, le modele gagne,
  //    et capabilities() n est meme pas interroge.
  const modeleVsCapacite = createPipelineProvider({
    capabilities: { models: [] },
    generateError: new Error('KO'),
  });
  await rejected(
    new GnoxeBrains({ modelProvider: modeleVsCapacite }).answer({
      messages: MESSAGES,
      model: 'inconnu',
    }),
    ModelResolutionError
  );
  assertNoNetwork(modeleVsCapacite);
  assert.deepEqual(modeleVsCapacite.trace, [], 'capabilities() pas encore appele');

  // 4. Capacite AVANT l appel : capabilities() est consulte, generate() non.
  const capaciteVsAppel = createPipelineProvider({
    capabilities: { models: ['gnoxe-brains-1'] },
    generateError: new Error('KO'),
  });
  await rejected(
    new GnoxeBrains({ modelProvider: capaciteVsAppel }).answer({
      messages: MESSAGES,
      model: 'gnoxe-brains-1.5',
    }),
    ProviderCapabilityError
  );
  assert.equal(capaciteVsAppel.calls.length, 0, 'generate() pas atteint');
  assert.deepEqual(capaciteVsAppel.trace, ['capabilities']);

  // 5. La qualification d echec arrive en DERNIER, apres le reel appel.
  const execution = createPipelineProvider({ generateError: new Error('KO') });
  await rejected(
    new GnoxeBrains({ modelProvider: execution }).answer({ messages: MESSAGES }),
    ProviderExecutionError
  );
  assert.deepEqual(execution.trace, ['capabilities', 'generate']);
  assert.equal(execution.calls.length, 1, 'l appel a eu lieu avant la qualification');
});

// ------------------------------------- les cinq familles d erreur de la facade

test('les cinq rejets de la facade sont atteignables et distinguables', async () => {
  const cases = [
    {
      label: 'policy',
      error: ExecutionPolicyError,
      code: 'EXECUTION_TEMPERATURE_INVALID',
      input: { messages: MESSAGES, temperature: 9 },
      options: {},
      network: 0,
    },
    {
      label: 'model',
      error: ModelResolutionError,
      code: 'MODEL_UNKNOWN',
      input: { messages: MESSAGES, model: 'inconnu' },
      options: {},
      network: 0,
    },
    {
      label: 'capability',
      error: ProviderCapabilityError,
      code: 'PROVIDER_MODEL_UNSUPPORTED',
      input: { messages: MESSAGES, model: 'gnoxe-brains-1.5' },
      options: { capabilities: { models: ['gnoxe-brains-1'] } },
      network: 0,
    },
    {
      label: 'provider',
      error: ProviderExecutionError,
      code: 'PROVIDER_CALL_FAILED',
      input: { messages: MESSAGES },
      options: { generateError: new Error('PANNE') },
      network: 1,
    },
  ];

  for (const item of cases) {
    const provider = createPipelineProvider(item.options);
    const brains = new GnoxeBrains({ modelProvider: provider });

    const error = await brains.answer(item.input).catch((err) => err);
    assert.ok(error instanceof item.error, `${item.label} : type attendu`);
    assert.equal(error.code, item.code, `${item.label} : code attendu`);
    assert.equal(
      provider.calls.length,
      item.network,
      `${item.label} : nombre d appels attendu`
    );
    if (item.network === 0) assertNoNetwork(provider);
  }

  // 5. streaming : meme contrat, phase avant premier fragment.
  const streamer = createPipelineProvider({ streamErrorBeforeFirst: new Error('KO') });
  const streamingError = await (async () => {
    try {
      for await (const _chunk of new GnoxeBrains({ modelProvider: streamer }).answerStream({
        messages: MESSAGES,
      })) {
        void _chunk;
      }
      return null;
    } catch (error) {
      return error;
    }
  })();

  assert.ok(streamingError instanceof ProviderExecutionError, 'streaming : type attendu');
  assert.equal(streamingError.code, 'PROVIDER_STREAM_FAILED');
  assert.equal(streamingError.fragmentsDelivered, 0);
  assert.equal(streamer.calls.length, 1, 'streaming : appel unique');
  assert.deepEqual(streamer.trace, ['capabilities', 'stream']);
});

test('tous les refus empechent tout appel reseau', async () => {
  const refusals = [
    { input: { messages: MESSAGES, temperature: 9 }, options: {} },
    { input: { messages: MESSAGES, temperature: -1 }, options: {} },
    { input: { messages: MESSAGES, maxTokens: 0 }, options: {} },
    { input: { messages: MESSAGES, maxTokens: 1.5 }, options: {} },
    { input: { messages: MESSAGES, model: 'inconnu' }, options: {} },
    { input: { messages: MESSAGES, maxTokens: 32768 }, options: {} },
    {
      input: { messages: MESSAGES, model: 'gnoxe-brains-1.5' },
      options: { capabilities: { models: ['gnoxe-brains-1'] } },
    },
    {
      input: { messages: MESSAGES, model: 'gnoxe-brains-1.5' },
      options: { capabilities: { streaming: false } },
      stream: true,
    },
    { input: { messages: MESSAGES, model: '  ' }, options: { capabilities: { models: [] } } },
  ];

  for (const item of refusals) {
    const provider = createPipelineProvider(item.options);
    const brains = new GnoxeBrains({ modelProvider: provider });

    if (item.stream) {
      await assert.rejects(async () => {
        for await (const _chunk of brains.answerStream(item.input)) {
          void _chunk;
        }
      });
    } else {
      await assert.rejects(() => brains.answer(item.input));
    }

    assertNoNetwork(provider);
  }
});

// ------------------------------------- echec provider qualifie (etape 23)

test('echec provider : qualifie par etape 23, cause originale preservee', async () => {
  const original = new Error('MODELE_HORS_SERVICE');
  original.code = 'ECONNRESET';
  original.statusCode = 503;

  const provider = createPipelineProvider({ generateError: original });
  const brains = new GnoxeBrains({ modelProvider: provider });

  const error = await brains.answer({ messages: MESSAGES }).catch((err) => err);

  assert.ok(error instanceof ProviderExecutionError);
  assert.equal(error.code, 'PROVIDER_CALL_FAILED');
  assert.equal(error.message, 'MODELE_HORS_SERVICE', 'message du provider, intact');
  assert.equal(error.cause, original, 'reference originale conservee');
  assert.equal(error.cause.code, 'ECONNRESET', 'contexte du provider conserve');
  assert.equal(error.cause.statusCode, 503);
  assert.equal(error.fragmentsDelivered, 0);
  assert.equal(provider.calls.length, 1, 'appel effectue puis echec, sans retry');
  assert.deepEqual(provider.trace, ['capabilities', 'generate']);
});

test('echec streaming : deux phases distinguables de bout en bout', async () => {
  const avant = createPipelineProvider({ streamErrorBeforeFirst: new Error('AVANT_KO') });
  const avantError = await (async () => {
    try {
      for await (const _c of new GnoxeBrains({ modelProvider: avant }).answerStream({
        messages: MESSAGES,
      })) {
        void _c;
      }
      return null;
    } catch (error) {
      return error;
    }
  })();

  assert.equal(avantError.code, 'PROVIDER_STREAM_FAILED');
  assert.equal(avantError.fragmentsDelivered, 0);
  assert.equal(avantError.message, 'AVANT_KO');
  assert.equal(avant.calls.length, 1);

  const pendant = createPipelineProvider({
    textChunks: ['a', 'b'],
    streamErrorAfter: new Error('PENDANT_KO'),
  });
  const recus = [];
  const pendantError = await (async () => {
    try {
      for await (const chunk of new GnoxeBrains({ modelProvider: pendant }).answerStream({
        messages: MESSAGES,
      })) {
        recus.push(chunk);
      }
      return null;
    } catch (error) {
      return error;
    }
  })();

  assert.equal(pendantError.code, 'PROVIDER_STREAM_INTERRUPTED');
  assert.equal(pendantError.fragmentsDelivered, 2);
  assert.equal(pendantError.message, 'PENDANT_KO');
  assert.equal(pendantError.cause.message, 'PENDANT_KO');
  assert.equal(recus.filter((chunk) => chunk.type === 'text').length, 2, 'fragments rendus avant');
  assert.equal(pendant.calls.length, 1, 'aucun flux de remplacement');
});

// ------------------------------------- aucune substitution de modele

test('aucun modele nest silencieusement substitue', async () => {
  // Defaut : le modele declare au catalogue est bien celui demande.
  const parDefaut = createPipelineProvider();
  const defautResult = await new GnoxeBrains({ modelProvider: parDefaut }).answer({
    messages: MESSAGES,
  });
  assert.equal(getDefaultModel(), EYANO_MODELS.find((entry) => entry.default).id);
  assert.equal(parDefaut.calls[0].model, getDefaultModel(), 'defaut du catalogue, demande tel quel');
  assert.equal(defautResult.model, getDefaultModel());

  // Refus de capacite : AUCUN repli vers un modele couvert.
  const etroit = createPipelineProvider({ capabilities: { models: ['gnoxe-brains-1'] } });
  await assert.rejects(
    () => new GnoxeBrains({ modelProvider: etroit }).answer({
      messages: MESSAGES,
      model: 'gnoxe-brains-1.5',
    }),
    (error) => error.name === 'ProviderCapabilityError'
  );
  assert.equal(etroit.calls.length, 0, 'jamais un appel vers le modele couvert');
  assert.deepEqual(etroit.trace, ['capabilities']);

  // Echec d execution : le modele de la requete reste celui de la resolution.
  const panne = createPipelineProvider({ generateError: new Error('KO') });
  await assert.rejects(() =>
    new GnoxeBrains({ modelProvider: panne }).answer({
      messages: MESSAGES,
      model: 'gnoxe-brains-1.5',
      maxTokens: 4096,
    })
  );
  assert.equal(panne.calls.length, 1, 'une seule tentative');
  assert.equal(panne.calls[0].model, 'gnoxe-brains-1.5', 'modele de la resolution d origine');

  // Modele effectif : seule la reponse du provider peut le faire varier,
  // jamais le moteur.
  const effectif = createPipelineProvider({
    response: { content: 'ok', model: 'gnoxe-brains-1', provider: 'fake-backend' },
  });
  const sortie = await new GnoxeBrains({ modelProvider: effectif }).answer({
    messages: MESSAGES,
    model: 'gnoxe-brains-1.5',
  });
  assert.equal(effectif.calls[0].model, 'gnoxe-brains-1.5', 'demande intacte');
  assert.equal(sortie.model, 'gnoxe-brains-1', 'modele effectif rapporte par le provider');
});

// ------------------------------------- aucun retry, fallback ou routing

test('aucun retry, fallback ou routing : un seul site d appel par methode', () => {
  const source = fs.readFileSync(path.join(SRC, 'core', 'gnoxe-brains.ts'), 'utf8');

  assert.equal(source.split('provider.generate(').length - 1, 1, 'un seul appel generate');
  assert.equal(source.split('provider.stream(').length - 1, 1, 'un seul appel stream');

  const start = source.indexOf('async answer(');
  const end = source.indexOf('async *answerStream(');
  assert.ok(start >= 0 && end > start, 'bornes de answer() trouves');
  const answerBody = source.slice(start, end);

  for (const token of [
    'for (',
    'while (',
    'setTimeout',
    'setInterval',
    'Math.random',
    'AbortSignal',
    '.catch(',
    'attempt',
    'retry',
    'fallback',
  ]) {
    assert.ok(!answerBody.includes(token), `mecanique de reprise dans answer() : "${token}"`);
  }

  assert.ok(!/resolveModel\s*\([^)]*\)[\s\S]*resolveModel\s*\(/.test(answerBody), 'une seule resolution');
});

test('aucun provider de remplacement : le meme objet est le seul consulte', async () => {
  const principal = createPipelineProvider({ generateError: new Error('KO') });
  const brains = new GnoxeBrains({ modelProvider: principal });

  await assert.rejects(() => brains.answer({ messages: MESSAGES, model: 'gnoxe-brains-1.5' }));

  assert.equal(principal.calls.length, 1);
  assert.deepEqual(principal.trace, ['capabilities', 'generate'], 'une seule resolution de capacite');

  const succ = await new GnoxeBrains({ modelProvider: principal })
    .answer({ messages: MESSAGES })
    .catch((error) => error);

  assert.ok(succ instanceof ProviderExecutionError, 'le meme provider echoue de la meme facon');
  assert.equal(principal.calls.length, 2, 'deux appels, un par tentative demandee, jamais superposes');
  assert.deepEqual(principal.trace, [
    'capabilities',
    'generate',
    'capabilities',
    'generate',
  ]);
});

// ------------------------------------------------- telemetrie (etape 18)

test('telemetrie : rien nest fabrique, rien nest expose par la facade', async () => {
  // Provider sans decompte : aucun zero invente.
  const sansUsage = createPipelineProvider();
  const sansResultat = await new GnoxeBrains({ modelProvider: sansUsage }).answer({
    messages: MESSAGES,
  });
  assert.ok(!('usage' in sansResultat), 'aucun usage fabrique sur la reponse');

  // L absence d information reste un resultat a part entiere.
  assert.equal(aggregateUsage([undefined, null]), undefined, 'aucun zero fabrique');
  assert.equal(aggregateUsage([]), undefined);

  // Un decompte rapporte est agrege tel quel, sans double compte.
  const totaux = aggregateUsage([
    { model: 'gnoxe-brains-1', provider: 'fake-backend', inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    { model: 'gnoxe-brains-1.5', provider: 'fake-backend' },
  ]);
  assert.equal(totaux.calls, 2, 'chaque appel compte une fois');
  assert.equal(totaux.callsWithTokens, 1, 'un seul decompte fourni');
  assert.equal(totaux.inputTokens, 10);
  assert.equal(totaux.outputTokens, 5);
  assert.equal(totaux.totalTokens, 15);

  // Telemetrie fournie par le provider sur un flux : inchangee a la source,
  // et jamais filtree dans l evenement public.
  const usage = Object.freeze({
    model: 'gnoxe-brains-1',
    provider: 'fake-backend',
    inputTokens: 3,
    outputTokens: 1,
    totalTokens: 4,
  });
  const flux = createPipelineProvider({ doneChunk: { usage } });
  const evenements = [];
  for await (const chunk of new GnoxeBrains({ modelProvider: flux }).answerStream({
    messages: MESSAGES,
  })) {
    evenements.push(chunk);
  }

  const done = evenements[evenements.length - 1];
  assert.equal(done.type, 'done');
  assert.ok(!('usage' in done), 'la telemetrie ne filtre pas dans le contrat public');
  assert.equal(usage.totalTokens, 4, 'objet de telemetrie gelee, jamais reecrit');
  assert.equal(flux.calls.length, 1);
});

// ------------------------------------------------------- cloture du moteur

test('cloture : les cinq etapes sont toutes traversees en un seul appel', async () => {
  const provider = createPipelineProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  const resultat = await brains.answer({
    messages: MESSAGES,
    model: 'gnoxe-brains-1.5',
    temperature: 0.7,
    maxTokens: 8192,
  });

  // Etape 22 : police executee (parametres valides acceptes tels quels).
  assert.equal(provider.calls[0].temperature, 0.7);
  assert.equal(provider.calls[0].maxTokens, 8192);
  // Etape 20 : modele resolu.
  assert.equal(provider.calls[0].model, 'gnoxe-brains-1.5');
  // Etape 21 : capacites consultees avant l appel.
  assert.deepEqual(provider.trace, ['capabilities', 'generate']);
  // Etape 23 : aucun echec, donc aucune qualification produite.
  assert.ok(!(resultat instanceof ProviderExecutionError));
  // Etape 18 : contrat de reponse strictement preserve.
  assert.deepEqual(Object.keys(resultat).sort(), ['content', 'model', 'provider']);
  // Catalogue etape 19 intact.
  assert.equal(EYANO_MODELS.length, 5);
});
