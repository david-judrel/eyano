'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GnoxeBrains,
  EYANO_MODELS,
  ModelResolver,
  ModelResolutionError,
  modelResolver,
  isRegisteredModel,
} = require('../dist/index.js');
const { createFakeModelProvider } = require('./helpers');

const MESSAGES = [{ role: 'user', content: 'Salut' }];

function code(error) {
  return error && error.code;
}

function expectResolutionError(fn, expectedCode) {
  let raised;
  try {
    fn();
  } catch (error) {
    raised = error;
  }

  assert.ok(raised, `une erreur ${expectedCode} etait attendue`);
  assert.ok(raised instanceof ModelResolutionError, 'exception de resolution explicite');
  assert.equal(raised.code, expectedCode, `code attendu ${expectedCode}`);
  assert.equal(raised.name, 'ModelResolutionError');
  assert.ok(raised.message.length > 0, 'message porteur');
  return raised;
}

// --------------------------------------------------- contrat du resolver

test('modele demande : retourne tel quel, sans substitution', () => {
  assert.equal(modelResolver.resolve({ model: 'gnoxe-brains-1' }), 'gnoxe-brains-1');
  assert.equal(modelResolver.resolve({ model: 'gnoxe-brains-1.5' }), 'gnoxe-brains-1.5');
  assert.equal(
    modelResolver.resolve({ model: '  gnoxe-brains-1.5  ' }),
    'gnoxe-brains-1.5',
    'la chaine est normalisee avant confrontation au catalogue'
  );
});

test('modele demande et capacite couverte : la demande gagne', () => {
  assert.equal(
    modelResolver.resolve({ model: 'gnoxe-brains-1', minMaxTokens: 8192 }),
    'gnoxe-brains-1'
  );
  assert.equal(
    modelResolver.resolve({ model: 'gnoxe-brains-1.5', minMaxTokens: 16384 }),
    'gnoxe-brains-1.5'
  );
});

test('modele inconnu : refus MODEL_UNKNOWN, jamais un autre modele', () => {
  const error = expectResolutionError(
    () => modelResolver.resolve({ model: 'gnoxe-brains-2-pro' }),
    'MODEL_UNKNOWN'
  );

  assert.match(error.message, /Modele inconnu : "gnoxe-brains-2-pro"/);
  assert.match(error.message, /gnoxe-brains-1, gnoxe-brains-1\.5/, 'offre listee');

  let substituted = true;
  try {
    modelResolver.resolve({ model: 'gnoxe-brains-2-pro' });
  } catch {
    substituted = false;
  }
  assert.equal(substituted, false, 'aucun repli silencieux sur le defaut');
});

test('modele au catalogue mais non executable : refus MODEL_UNAVAILABLE', () => {
  for (const id of ['gnoxe-brains-2', 'gnoxe-brains-code', 'gnoxe-brains-vision']) {
    const error = expectResolutionError(
      () => modelResolver.resolve({ model: id }),
      'MODEL_UNAVAILABLE'
    );
    assert.match(error.message, new RegExp(`Modele non disponible : "${id}"`));
    assert.equal(isRegisteredModel(id), false, 'meme verdict que le registre');
  }
});

test('capacite insuffisante sur le modele demande : refus explicite', () => {
  const error = expectResolutionError(
    () => modelResolver.resolve({ model: 'gnoxe-brains-1', minMaxTokens: 32768 }),
    'MODEL_INSUFFICIENT_CAPACITY'
  );

  assert.match(error.message, /capacite 8192 < 32768 demandes/);
});

test('selection par capacite : le defaut seulement s il est eligible', () => {
  assert.equal(
    modelResolver.resolve({ minMaxTokens: 50 }),
    'gnoxe-brains-1',
    'le defaut couvre la demande'
  );

  assert.equal(
    modelResolver.resolve({ minMaxTokens: 16384 }),
    'gnoxe-brains-1.5',
    'le defaut (8192) est exclu : la capacite prime sur le defaut'
  );
});

test('aucun modele disponible ne couvre la demande : refus deterministe', () => {
  const error = expectResolutionError(
    () => modelResolver.resolve({ minMaxTokens: 32768 }),
    'NO_MODEL_MEETS_REQUIREMENT'
  );

  assert.match(error.message, /32768 tokens/);
  assert.match(error.message, /gnoxe-brains-1 \(8192\), gnoxe-brains-1\.5 \(16384\)/);
});

test('exigence de capacite mal formee : refus MODEL_INVALID_REQUIREMENT', () => {
  for (const invalid of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const error = expectResolutionError(
      () => modelResolver.resolve({ minMaxTokens: invalid }),
      'MODEL_INVALID_REQUIREMENT'
    );
    assert.ok(error.message.includes(String(invalid)), `valeur ${invalid} citee`);
  }
});

test('resolution deterministe : meme demande, meme reponse, sans etat', () => {
  const results = new Set();
  for (let i = 0; i < 50; i += 1) {
    results.add(modelResolver.resolve({ minMaxTokens: 16384 }));
  }
  assert.deepEqual([...results], ['gnoxe-brains-1.5']);

  const other = new ModelResolver();
  assert.equal(
    other.resolve({ model: 'gnoxe-brains-1' }),
    modelResolver.resolve({ model: 'gnoxe-brains-1' }),
    'aucune instance n apporte d etat'
  );
});

test('aucun score : la capacite est un filtre, pas un classement', () => {
  // Deux modeles disponibles couvrent 100. Sans score, le defaut gagne
  // car il est unique et eligible, pas parce qu il serait "meilleur".
  assert.equal(modelResolver.resolve({ minMaxTokens: 100 }), 'gnoxe-brains-1');

  // Un point au-dela de sa capacite et il sort du jeu, sans compensation.
  expectResolutionError(
    () => modelResolver.resolve({ model: 'gnoxe-brains-1', minMaxTokens: 16384 }),
    'MODEL_INSUFFICIENT_CAPACITY'
  );
  assert.equal(modelResolver.resolve({ minMaxTokens: 16384 }), 'gnoxe-brains-1.5');
});

test('le resolver ne modifie jamais le catalogue', () => {
  const before = JSON.stringify(EYANO_MODELS);

  modelResolver.resolve({ model: 'gnoxe-brains-1.5' });
  modelResolver.resolve({ minMaxTokens: 50 });
  expectResolutionError(() => modelResolver.resolve({ model: 'inconnu' }), 'MODEL_UNKNOWN');

  assert.equal(JSON.stringify(EYANO_MODELS), before, 'catalogue immuable');
  assert.equal(EYANO_MODELS.length, 5, 'catalogue etape 19 preserve');
});

test('chaque resolution rend un identifiant executable', () => {
  const requests = [
    { model: 'gnoxe-brains-1' },
    { model: 'gnoxe-brains-1.5' },
    {},
    { minMaxTokens: 50 },
    { minMaxTokens: 16384 },
    { model: 'gnoxe-brains-1.5', minMaxTokens: 1 },
  ];

  for (const request of requests) {
    const resolved = modelResolver.resolve(request);
    assert.equal(isRegisteredModel(resolved), true, `${JSON.stringify(request)} -> ${resolved}`);
  }
});

test('aucun message de refus ne nomme un fournisseur', () => {
  const attempts = [
    () => modelResolver.resolve({ model: 'inconnu' }),
    () => modelResolver.resolve({ model: 'gnoxe-brains-2' }),
    () => modelResolver.resolve({ model: 'gnoxe-brains-1', minMaxTokens: 32768 }),
    () => modelResolver.resolve({ minMaxTokens: 32768 }),
    () => modelResolver.resolve({ minMaxTokens: 0 }),
  ];

  for (const attempt of attempts) {
    let message = '';
    try {
      attempt();
    } catch (error) {
      message = error.message;
    }
    assert.ok(message.length > 0);

    for (const token of ['gemini', 'Gemini', 'Google', 'googleai', 'Genkit']) {
      assert.ok(!message.includes(token), `refus nommant "${token}"`);
    }
  }
});

// --------------------------------------------------- integration facade

test('integration answer() : sans modele ni capacite, le defaut de configuration s applique', async () => {
  const provider = createFakeModelProvider({ content: 'Reponse courte.' });
  const brains = new GnoxeBrains({ modelProvider: provider });

  const answer = await brains.answer({ messages: MESSAGES });

  assert.equal(answer.content, 'Reponse courte.');
  assert.equal(answer.model, 'gnoxe-brains-1');
  assert.equal(provider.calls.length, 1, 'un seul appel modele');
  assert.equal(provider.calls[0].request.model, 'gnoxe-brains-1');
  assert.equal(provider.calls[0].request.maxTokens, undefined, 'aucune capacite imposee');
});

test('integration answer() : modele inconnu refuse avant tout appel', async () => {
  const provider = createFakeModelProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  await assert.rejects(
    () => brains.answer({ messages: MESSAGES, model: 'jean-michel' }),
    (error) => {
      assert.ok(error instanceof ModelResolutionError);
      assert.equal(code(error), 'MODEL_UNKNOWN');
      return true;
    }
  );

  assert.equal(provider.calls.length, 0, 'aucun appel modele sur un refus');
});

test('integration answer() : capacite incompatible refusee avant tout appel', async () => {
  const provider = createFakeModelProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  await assert.rejects(
    () => brains.answer({ messages: MESSAGES, model: 'gnoxe-brains-1', maxTokens: 32768 }),
    (error) => code(error) === 'MODEL_INSUFFICIENT_CAPACITY'
  );
  assert.equal(provider.calls.length, 0);

  await assert.rejects(
    () => brains.answer({ messages: MESSAGES, maxTokens: 32768 }),
    (error) => code(error) === 'MODEL_INSUFFICIENT_CAPACITY'
  );
  assert.equal(provider.calls.length, 0, 'aucun appel pour la seconde tentative non plus');
});

test('integration answer() : la preference configuree reste la reference', async () => {
  const provider = createFakeModelProvider({ content: 'ok' });
  const brains = new GnoxeBrains({
    modelProvider: provider,
    config: { defaultModel: 'gnoxe-brains-1.5' },
  });

  const withoutModel = await brains.answer({ messages: MESSAGES });
  assert.equal(withoutModel.model, 'gnoxe-brains-1.5', 'defaut configure conserve');

  const withCapacity = await brains.answer({ messages: MESSAGES, maxTokens: 16384 });
  assert.equal(withCapacity.model, 'gnoxe-brains-1.5', 'capacite couverte par la preference');

  await assert.rejects(
    () => brains.answer({ messages: MESSAGES, maxTokens: 32768 }),
    (error) => code(error) === 'MODEL_INSUFFICIENT_CAPACITY',
    'jamais de substitution par un autre modele'
  );
  assert.equal(provider.calls.length, 2, 'seuls les deux appels valides atteignent le provider');
});

test('integration answer() : capacite couverte, appel effectue', async () => {
  const provider = createFakeModelProvider({ content: 'ok' });
  const brains = new GnoxeBrains({ modelProvider: provider });

  const answer = await brains.answer({ messages: MESSAGES, maxTokens: 200 });

  assert.equal(answer.model, 'gnoxe-brains-1');
  assert.equal(provider.calls.length, 1);
  assert.equal(provider.calls[0].request.maxTokens, 200, 'la capacite reste transmise');

  const explicit = await brains.answer({
    messages: MESSAGES,
    model: 'gnoxe-brains-1.5',
    maxTokens: 4096,
  });
  assert.equal(explicit.model, 'gnoxe-brains-1.5');
});

test('integration answerStream() : memes refus, aucun appel sur incompatibilite', async () => {
  const provider = createFakeModelProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  await assert.rejects(
    async () => {
      for await (const _chunk of brains.answerStream({ messages: MESSAGES, model: 'inconnu' })) {
        // iteration attendue : le refus survient avant le premier fragment
      }
    },
    (error) => code(error) === 'MODEL_UNKNOWN'
  );
  assert.equal(provider.calls.length, 0);

  const chunks = [];
  for await (const chunk of brains.answerStream({ messages: MESSAGES })) {
    chunks.push(chunk);
  }
  assert.equal(chunks[chunks.length - 1].type, 'done');
  assert.equal(provider.calls.length, 1, 'le chemin nominal reste intact');
});
