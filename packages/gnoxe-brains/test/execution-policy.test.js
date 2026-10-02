'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  GnoxeBrains,
  EYANO_MODELS,
  ExecutionPolicy,
  ExecutionPolicyError,
  EXECUTION_BOUNDS,
  executionPolicy,
} = require('../dist/index.js');

const SRC = path.join(__dirname, '..', 'src');
const MESSAGES = [{ role: 'user', content: 'Salut' }];

function expectExecutionError(fn, expectedCode) {
  let raised;
  try {
    fn();
  } catch (error) {
    raised = error;
  }

  assert.ok(raised, `une erreur ${expectedCode} etait attendue`);
  assert.ok(raised instanceof ExecutionPolicyError, 'exception d execution explicite');
  assert.equal(raised.code, expectedCode, `code attendu ${expectedCode}`);
  assert.equal(raised.name, 'ExecutionPolicyError');
  assert.ok(raised.message.length > 0, 'message porteur');
  return raised;
}

function createProvider(overrides = {}) {
  const calls = [];
  const capabilities = {
    streaming: true,
    structuredOutput: true,
    images: false,
    models: ['gnoxe-brains-1', 'gnoxe-brains-1.5'],
    ...overrides,
  };

  return {
    name: 'fake-backend',
    calls,
    async generate(request) {
      calls.push({ kind: 'generate', request });
      return { content: 'ok', model: request.model, provider: 'fake-backend' };
    },
    async *stream(request) {
      calls.push({ kind: 'stream', request });
      yield { type: 'text', content: 'ok' };
      yield { type: 'done', content: 'ok' };
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

// ------------------------------------------- parametres d execution autorises

test("l'enveloppe d execution est figee et nomme chaque parametre autorise", () => {
  assert.ok(Object.isFrozen(EXECUTION_BOUNDS));
  assert.deepEqual(Object.keys(EXECUTION_BOUNDS).sort(), ['maxTokens', 'temperature']);
  assert.deepEqual(Object.keys(EXECUTION_BOUNDS.temperature).sort(), ['max', 'min']);
  assert.deepEqual(Object.keys(EXECUTION_BOUNDS.maxTokens), ['min']);

  assert.equal(EXECUTION_BOUNDS.temperature.min, 0);
  assert.equal(EXECUTION_BOUNDS.temperature.max, 2);
  assert.equal(EXECUTION_BOUNDS.maxTokens.min, 1);

  assert.ok(Object.isFrozen(EXECUTION_BOUNDS.temperature));
  assert.ok(Object.isFrozen(EXECUTION_BOUNDS.maxTokens));
  assert.ok(executionPolicy instanceof ExecutionPolicy);
});

test('parametres valides : rendus strictement a l identique', () => {
  for (const temperature of [0, 0.3, 0.5, 0.7, 1, 1.5, 2]) {
    const parameters = executionPolicy.validate({
      streaming: false,
      temperature,
      maxTokens: 1,
    });
    assert.equal(parameters.temperature, temperature, 'aucun arrondi, aucun clamp');
    assert.equal(parameters.providerParameters.temperature, temperature);
  }

  for (const maxTokens of [1, 50, 200, 4096, 8192, 16384]) {
    const parameters = executionPolicy.validate({ streaming: true, maxTokens });
    assert.equal(parameters.maxTokens, maxTokens, 'aucun plafond ajoute');
    assert.equal(parameters.providerParameters.maxTokens, maxTokens);
  }
});

test("valeur absente : aucun defaut n'est injecte par la couche", () => {
  const parameters = executionPolicy.validate({ streaming: false });

  assert.equal(parameters.temperature, undefined);
  assert.equal(parameters.maxTokens, undefined);
  assert.ok('temperature' in parameters.providerParameters, 'champ present, valeur absente');
  assert.ok('maxTokens' in parameters.providerParameters);
  assert.equal(parameters.providerParameters.temperature, undefined);
  assert.notEqual(parameters.providerParameters.temperature, 0.7, 'pas de defaut moteur');
  assert.equal(parameters.providerParameters.maxTokens, undefined);
  assert.notEqual(parameters.providerParameters.maxTokens, 8192, 'pas de defaut adaptateur');
});

test('modes : streaming obligatoire et booleen, structuredOutput declare ou absent', () => {
  expectExecutionError(() => executionPolicy.validate({}), 'EXECUTION_STREAMING_INVALID');
  expectExecutionError(
    () => executionPolicy.validate({ streaming: 'true' }),
    'EXECUTION_STREAMING_INVALID'
  );
  expectExecutionError(
    () => executionPolicy.validate({ streaming: 1 }),
    'EXECUTION_STREAMING_INVALID'
  );

  assert.equal(executionPolicy.validate({ streaming: true }).structuredOutput, false);
  assert.equal(executionPolicy.validate({ streaming: false, structuredOutput: false }).structuredOutput, false);
  assert.equal(executionPolicy.validate({ streaming: false, structuredOutput: true }).structuredOutput, true);

  expectExecutionError(
    () => executionPolicy.validate({ streaming: false, structuredOutput: 'yes' }),
    'EXECUTION_STRUCTURED_OUTPUT_INVALID'
  );
});

// --------------------------------------------------- valeurs invalides

test('temperature invalide : refus deterministe', () => {
  for (const invalid of [-0.1, 2.1, 9, NaN, Infinity, -Infinity, '0.5', null, true]) {
    const error = expectExecutionError(
      () => executionPolicy.validate({ streaming: false, temperature: invalid }),
      'EXECUTION_TEMPERATURE_INVALID'
    );
    assert.match(error.message, /Temperature invalide/);
    assert.ok(error.message.includes(String(invalid)), 'la valeur reelle est citee');
  }
});

test('maxTokens invalide : refus deterministe', () => {
  for (const invalid of [0, -1, 1.5, 0.5, '200', NaN, Infinity, null, {}]) {
    const error = expectExecutionError(
      () => executionPolicy.validate({ streaming: false, maxTokens: invalid }),
      'EXECUTION_MAX_TOKENS_INVALID'
    );
    assert.match(error.message, /maxTokens invalide/);
    assert.ok(error.message.includes(String(invalid)), 'la valeur reelle est citee');
  }
});

test('l ordre des refus est fixe : mode, puis temperature, puis maxTokens', () => {
  const everythingInvalid = {
    streaming: 'nope',
    structuredOutput: 'nope',
    temperature: 99,
    maxTokens: -5,
  };

  expectExecutionError(() => executionPolicy.validate(everythingInvalid), 'EXECUTION_STREAMING_INVALID');

  expectExecutionError(
    () =>
      executionPolicy.validate({
        ...everythingInvalid,
        streaming: false,
      }),
    'EXECUTION_STRUCTURED_OUTPUT_INVALID'
  );

  expectExecutionError(
    () =>
      executionPolicy.validate({
        streaming: false,
        structuredOutput: false,
        temperature: 99,
        maxTokens: -5,
      }),
    'EXECUTION_TEMPERATURE_INVALID'
  );

  expectExecutionError(
    () => executionPolicy.validate({ streaming: false, temperature: 0.5, maxTokens: -5 }),
    'EXECUTION_MAX_TOKENS_INVALID'
  );
});

// ----------------------------------------- refus avant appel au provider

test('refus avant appel : answer() n a aucune requete sur parametre invalide', async () => {
  const provider = createProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  for (const input of [{ temperature: 9 }, { temperature: -1 }, { maxTokens: 0 }, { maxTokens: 1.5 }]) {
    await assert.rejects(
      () => brains.answer({ messages: MESSAGES, ...input }),
      (error) => error instanceof ExecutionPolicyError && error.name === 'ExecutionPolicyError'
    );
    assert.equal(provider.calls.length, 0, 'aucun appel modele sur un refus');
  }
});

test('refus avant appel : answerStream() n a aucune requete sur parametre invalide', async () => {
  const provider = createProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  // Un generateur ne s execute qu a la premiere iteration : le refus survient
  // donc avant le premier fragment, jamais apres un appel au provider.
  const consume = (input) => async () => {
    for await (const _chunk of brains.answerStream(input)) {
      void _chunk;
    }
  };

  await assert.rejects(
    consume({ messages: MESSAGES, temperature: NaN }),
    (error) => error.code === 'EXECUTION_TEMPERATURE_INVALID'
  );
  await assert.rejects(
    consume({ messages: MESSAGES, maxTokens: 0 }),
    (error) => error.code === 'EXECUTION_MAX_TOKENS_INVALID'
  );

  assert.equal(provider.calls.length, 0, 'aucun appel streaming sur un refus');
});

test("refus avant appel : la couche de capacites n'est meme pas atteinte", async () => {
  // Modele connu, mais temperature invalide : la police tranche avant tout
  // le reste, donc aucun autre refus ne peut se produire.
  const provider = createProvider({ models: [] });
  const brains = new GnoxeBrains({ modelProvider: provider });

  await assert.rejects(
    () => brains.answer({ messages: MESSAGES, temperature: 3 }),
    (error) => error.code === 'EXECUTION_TEMPERATURE_INVALID'
  );
  assert.equal(provider.calls.length, 0);
});

// --------------------------------------- aucune modification silencieuse

test('aucune modification silencieuse : les valeurs partent intactes', async () => {
  const provider = createProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  await brains.answer({
    messages: MESSAGES,
    model: 'gnoxe-brains-1.5',
    temperature: 0.3,
    maxTokens: 4096,
  });

  const sync = provider.calls[0].request;
  assert.equal(sync.temperature, 0.3, 'temperature non corrigee');
  assert.equal(sync.maxTokens, 4096, 'maxTokens non plafonne');

  for await (const _chunk of brains.answerStream({
    messages: MESSAGES,
    model: 'gnoxe-brains-1.5',
    temperature: 1.5,
    maxTokens: 8192,
  })) {
    void _chunk;
  }

  const streamed = provider.calls[1].request;
  assert.equal(streamed.temperature, 1.5, 'temperature superieure a 1 preservee');
  assert.equal(streamed.maxTokens, 8192);
});

test('aucune valeur par defaut : un appel nu ne recoit ni 0.7 ni 8192', async () => {
  const provider = createProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  await brains.answer({ messages: MESSAGES });

  const request = provider.calls[0].request;
  assert.ok('temperature' in request, 'champ present');
  assert.equal(request.temperature, undefined, 'la police ne choisit pas');
  assert.equal(request.maxTokens, undefined, 'la police ne choisit pas');
});

test('la source ne contient aucune reecriture de valeur', () => {
  const source = fs.readFileSync(path.join(SRC, 'core', 'execution-policy.ts'), 'utf8');

  for (const token of [
    'Math.min(',
    'Math.max(',
    'Math.round(',
    'Math.floor(',
    'Math.ceil(',
    'toFixed',
    'Object.assign',
    '?? 0.7',
    '?? 8192',
    'EYANO_MODELS',
  ]) {
    assert.ok(!source.includes(token), `reecriture interdite : "${token}"`);
  }
  assert.ok(!/=\s*defaultTemperature/.test(source), 'aucun defaut consomme');
});

// ------------------------------------------ centralisation du contrat

test('une seule police pour answer() et answerStream()', () => {
  const sync = executionPolicy.validate({ streaming: false, temperature: 0.4, maxTokens: 300 });
  const stream = executionPolicy.validate({ streaming: true, temperature: 0.4, maxTokens: 300 });

  assert.deepEqual(
    { ...sync.providerParameters },
    { ...stream.providerParameters },
    'le payload provider est identique : une seule regle'
  );
  assert.equal(sync.temperature, stream.temperature);
  assert.equal(sync.maxTokens, stream.maxTokens);
  assert.equal(sync.streaming, false, 'seul le mode declare differe');
  assert.equal(stream.streaming, true);
});

test('les deux methodes envoient exactement les memes champs', async () => {
  const provider = createProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  await brains.answer({ messages: MESSAGES, temperature: 0.3, maxTokens: 200 });
  for await (const _chunk of brains.answerStream({
    messages: MESSAGES,
    temperature: 0.3,
    maxTokens: 200,
  })) {
    void _chunk;
  }

  const keysSync = Object.keys(provider.calls[0].request).sort();
  const keysStream = Object.keys(provider.calls[1].request).sort();

  assert.deepEqual(keysSync, ['maxTokens', 'messages', 'model', 'temperature']);
  assert.deepEqual(keysStream, keysSync, 'aucune methode n ajoute ni n omet un champ');
  assert.equal(provider.calls[0].request.temperature, provider.calls[1].request.temperature);
  assert.equal(provider.calls[0].request.maxTokens, provider.calls[1].request.maxTokens);
});

test('une seule erreur pour une meme regle, quel que soit le chemin', async () => {
  const provider = createProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  const signatures = new Set();
  const drain = (input) => async () => {
    for await (const _chunk of brains.answerStream(input)) {
      void _chunk;
    }
  };

  for (const call of [
    () => brains.answer({ messages: MESSAGES, temperature: 99 }),
    drain({ messages: MESSAGES, temperature: 99 }),
    () => brains.answer({ messages: MESSAGES, maxTokens: 0 }),
    drain({ messages: MESSAGES, maxTokens: 0 }),
  ]) {
    await assert.rejects(call, (error) => {
      signatures.add(`${error.name}|${error.code}|${error.message}`);
      return true;
    });
  }

  assert.equal(signatures.size, 2, 'un message par parametre, pas par methode');
  assert.equal(provider.calls.length, 0);
});

test('parametres valides : la frontiere reste executable', async () => {
  const provider = createProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  const sync = await brains.answer({ messages: MESSAGES, temperature: 0, maxTokens: 1 });
  assert.equal(sync.model, 'gnoxe-brains-1');
  await brains.answer({ messages: MESSAGES, temperature: 2, maxTokens: 8192 });
  assert.equal(provider.calls.length, 2, 'les bornes elles-memes sont acceptees');
});

// --------------------------------------------------------- determinisme

test('determinisme : memes entrees, memes sorties et memes refus', () => {
  const returns = new Set();
  for (let i = 0; i < 50; i += 1) {
    const parameters = executionPolicy.validate({
      streaming: true,
      temperature: 0.3,
      maxTokens: 4096,
    });
    returns.add(JSON.stringify({ ...parameters.providerParameters, streaming: parameters.streaming }));
  }
  assert.equal(returns.size, 1);

  const signatures = new Set();
  for (let i = 0; i < 50; i += 1) {
    try {
      executionPolicy.validate({ streaming: false, temperature: 9 });
    } catch (error) {
      signatures.add(`${error.code}|${error.message}`);
    }
  }
  assert.equal(signatures.size, 1, 'un seul code et un seul message');

  const other = new ExecutionPolicy();
  assert.deepEqual(
    { ...other.validate({ streaming: false, temperature: 1 }).providerParameters },
    { ...executionPolicy.validate({ streaming: false, temperature: 1 }).providerParameters },
    "aucune instance n'apporte d'etat"
  );
});

test('les parametres valides sont figes', () => {
  const parameters = executionPolicy.validate({ streaming: false, temperature: 1, maxTokens: 10 });

  assert.ok(Object.isFrozen(parameters));
  assert.ok(Object.isFrozen(parameters.providerParameters));

  let mutated = false;
  try {
    parameters.providerParameters.temperature = 2;
    mutated = true;
  } catch {
    // Objet fige : la valeur ne peut pas etre alteree en chemin.
  }
  assert.equal(mutated, false, 'impossible de corriger une valeur en route');
  assert.equal(parameters.providerParameters.temperature, 1);
});

// --------------------------------------- absence de routing / optimisation

test("aucune notion de fallback, de retry ou d'optimisation dans la couche", () => {
  const source = fs.readFileSync(path.join(SRC, 'core', 'execution-policy.ts'), 'utf8');

  for (const token of [
    '.sort(',
    'weight',
    'priority',
    'rank',
    'latency',
    'cost',
    'retry',
    'fallback',
    'Math.random',
    'setTimeout',
    'load',
  ]) {
    assert.ok(!source.includes(token), `notion interdite presente : "${token}"`);
  }
  assert.ok(!/\bscores?\b|\bscoring\b/i.test(source), 'aucune notion de score');
  assert.ok(!source.includes('configureGnoxeBrains'), 'aucun systeme de configuration');
  assert.ok(!source.includes('getGnoxeBrainsConfig'), 'aucun systeme de configuration');
});

test('layering : la couche ne depend que du contrat de provider', () => {
  const source = fs.readFileSync(path.join(SRC, 'core', 'execution-policy.ts'), 'utf8');

  const specs = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(specs, ['../providers/model-provider'], 'un seul import, de type seul');

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
    "'../providers/bootstrap'",
  ]) {
    assert.ok(!source.includes(token), `la couche ne doit pas nommer "${token}"`);
  }
});

// ------------------------------------------------------------- regressions

test('regressions etes 18 a 21 : surfaces preservees', async () => {
  assert.equal(EYANO_MODELS.length, 5, 'catalogue etape 19 intact');

  const provider = createProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  const answer = await brains.answer({ messages: MESSAGES });
  assert.deepEqual(Object.keys(answer).sort(), ['content', 'model', 'provider']);
  assert.ok(!('usage' in answer), 'telemetrie etape 18 intacte');
  assert.equal(provider.calls.length, 1);

  // Etape 21 : le refus de capacite reste en place, toujours avant appel.
  const narrow = createProvider({ models: ['gnoxe-brains-1'] });
  const limited = new GnoxeBrains({ modelProvider: narrow });

  await assert.rejects(
    () => limited.answer({ messages: MESSAGES, model: 'gnoxe-brains-1.5' }),
    (error) => error.name === 'ProviderCapabilityError',
    'etape 21 intacte'
  );
  assert.equal(narrow.calls.length, 0, 'le refus de capacite n a pas ete touche');
});
