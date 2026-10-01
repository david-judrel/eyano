'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  GnoxeBrains,
  EYANO_MODELS,
  ProviderCapabilityResolver,
  ProviderCapabilityError,
  providerCapabilityResolver,
} = require('../dist/index.js');

const SRC = path.join(__dirname, '..', 'src');
const ROOT = path.join(__dirname, '..', '..', '..');
const MESSAGES = [{ role: 'user', content: 'Salut' }];

const CAPS_FULL = {
  streaming: true,
  structuredOutput: true,
  images: true,
  models: ['gnoxe-brains-1', 'gnoxe-brains-1.5'],
};
const CAPS_TYPICAL = {
  streaming: true,
  structuredOutput: true,
  images: false,
  models: ['gnoxe-brains-1', 'gnoxe-brains-1.5'],
};
const CAPS_NARROW = {
  streaming: true,
  structuredOutput: false,
  images: false,
  models: ['gnoxe-brains-1'],
};

function expectCapabilityError(fn, expectedCode) {
  let raised;
  try {
    fn();
  } catch (error) {
    raised = error;
  }

  assert.ok(raised, `une erreur ${expectedCode} etait attendue`);
  assert.ok(raised instanceof ProviderCapabilityError, 'exception de capacite explicite');
  assert.equal(raised.code, expectedCode, `code attendu ${expectedCode}`);
  assert.equal(raised.name, 'ProviderCapabilityError');
  assert.ok(raised.message.length > 0, 'message porteur');
  return raised;
}

/** Provider factice : `overrides` remplace des champs de capacites. */
function createProvider(overrides = {}, calls) {
  const registry = calls ?? [];
  const capabilities = {
    streaming: true,
    structuredOutput: true,
    images: false,
    models: ['gnoxe-brains-1', 'gnoxe-brains-1.5'],
    ...overrides,
  };

  return {
    name: 'fake-backend',
    calls: registry,
    async generate(request) {
      registry.push({ kind: 'generate', request });
      return { content: 'ok', model: request.model, provider: 'fake-backend' };
    },
    async *stream(request) {
      registry.push({ kind: 'stream', request });
      yield { type: 'text', content: 'ok' };
      yield { type: 'done', content: 'ok' };
    },
    async structuredOutput(request) {
      registry.push({ kind: 'structuredOutput', request });
      return {};
    },
    capabilities() {
      return capabilities;
    },
  };
}

// ------------------------------------------------- capacite disponible

test('capacite disponible : la resolution accepte et rend le modele demande', () => {
  assert.equal(
    providerCapabilityResolver.resolve(CAPS_FULL, {
      model: 'gnoxe-brains-1',
      requires: { streaming: true, structuredOutput: true, images: true },
    }),
    'gnoxe-brains-1'
  );

  assert.equal(
    providerCapabilityResolver.resolve(CAPS_TYPICAL, {
      model: 'gnoxe-brains-1.5',
      requires: { streaming: true },
    }),
    'gnoxe-brains-1.5'
  );

  assert.equal(
    providerCapabilityResolver.resolve(CAPS_FULL, { model: 'gnoxe-brains-1' }),
    'gnoxe-brains-1',
    'aucune capacite exigee : seul le soutien du modele est demande'
  );
});

// --------------------------------------------------- capacite absente

test('capacite absente : refus deterministe citant le drapeau', () => {
  const error = expectCapabilityError(
    () =>
      providerCapabilityResolver.resolve(CAPS_TYPICAL, {
        model: 'gnoxe-brains-1',
        requires: { images: true },
      }),
    'PROVIDER_CAPABILITY_UNAVAILABLE'
  );

  assert.match(error.message, /"images"/);
  assert.match(error.message, /absente/);

  expectCapabilityError(
    () =>
      providerCapabilityResolver.resolve(CAPS_NARROW, {
        model: 'gnoxe-brains-1',
        requires: { structuredOutput: true },
      }),
    'PROVIDER_CAPABILITY_UNAVAILABLE'
  );
});

test('capacite absente : lecture dans un ordre fixe, jamais arbitraire', () => {
  const BLANK = { streaming: false, structuredOutput: false, images: false, models: ['gnoxe-brains-1'] };

  const all = expectCapabilityError(
    () =>
      providerCapabilityResolver.resolve(BLANK, {
        model: 'gnoxe-brains-1',
        requires: { images: true, structuredOutput: true, streaming: true },
      }),
    'PROVIDER_CAPABILITY_UNAVAILABLE'
  );
  assert.match(all.message, /"streaming"/, 'premier drapeau du contrat, stable');

  const two = expectCapabilityError(
    () =>
      providerCapabilityResolver.resolve(BLANK, {
        model: 'gnoxe-brains-1',
        requires: { images: true, structuredOutput: true },
      }),
    'PROVIDER_CAPABILITY_UNAVAILABLE'
  );
  assert.match(two.message, /"structuredOutput"/);
});

test('capacite non demandee n est jamais exigee', () => {
  assert.equal(
    providerCapabilityResolver.resolve(CAPS_TYPICAL, {
      model: 'gnoxe-brains-1',
      requires: { streaming: true, structuredOutput: true },
    }),
    'gnoxe-brains-1',
    'images vaut false mais n est pas demande'
  );

  assert.equal(
    providerCapabilityResolver.resolve(CAPS_TYPICAL, { model: 'gnoxe-brains-1', requires: {} }),
    'gnoxe-brains-1'
  );
});

// ------------------------------------------------------ modele inconnu

test('modele inconnu au catalogue : refus avant toute lecture du provider', () => {
  const error = expectCapabilityError(
    () => providerCapabilityResolver.resolve(CAPS_FULL, { model: 'gnoxe-brains-9' }),
    'PROVIDER_MODEL_UNKNOWN'
  );

  assert.match(error.message, /gnoxe-brains-9/);
  assert.match(error.message, /gnoxe-brains-1, gnoxe-brains-1\.5/, 'catalogue liste');

  // Le provider accepterait n'importe quoi : c'est le catalogue qui tranche.
  const ANYTHING = { streaming: true, structuredOutput: true, images: true, models: ['gnoxe-brains-3'] };
  expectCapabilityError(
    () => providerCapabilityResolver.resolve(ANYTHING, { model: 'gnoxe-brains-3' }),
    'PROVIDER_MODEL_UNKNOWN'
  );
});

// ------------------------------------------------- provider incompatible

test('provider incompatible : le provider ne soutient pas le modele', () => {
  const error = expectCapabilityError(
    () => providerCapabilityResolver.resolve(CAPS_NARROW, { model: 'gnoxe-brains-1.5' }),
    'PROVIDER_MODEL_UNSUPPORTED'
  );

  assert.match(error.message, /gnoxe-brains-1\.5/);
  assert.match(error.message, /gnoxe-brains-1/, 'offre du provider listee');

  const EMPTY = { streaming: true, structuredOutput: true, images: true, models: [] };
  const empty = expectCapabilityError(
    () => providerCapabilityResolver.resolve(EMPTY, { model: 'gnoxe-brains-1' }),
    'PROVIDER_MODEL_UNSUPPORTED'
  );
  assert.match(empty.message, /aucun modele/);
});

test('l ordre des refus est fixe : existence, soutien, puis capacite', () => {
  const CAPS_MINIMAL = { streaming: false, structuredOutput: false, images: false, models: [] };

  expectCapabilityError(
    () => providerCapabilityResolver.resolve(CAPS_MINIMAL, { model: 'inconnu' }),
    'PROVIDER_MODEL_UNKNOWN'
  );
  expectCapabilityError(
    () => providerCapabilityResolver.resolve(CAPS_MINIMAL, { model: 'gnoxe-brains-1' }),
    'PROVIDER_MODEL_UNSUPPORTED'
  );
  expectCapabilityError(
    () =>
      providerCapabilityResolver.resolve(CAPS_NARROW, {
        model: 'gnoxe-brains-1',
        requires: { images: true },
      }),
    'PROVIDER_CAPABILITY_UNAVAILABLE'
  );
});

// --------------------------------------------- refus avant appel provider

test('refus avant appel : aucun appel provider sur modele non soutenu', async () => {
  const provider = createProvider({ models: ['gnoxe-brains-1'] });
  const brains = new GnoxeBrains({ modelProvider: provider });

  await assert.rejects(
    () => brains.answer({ messages: MESSAGES, model: 'gnoxe-brains-1.5' }),
    (error) => {
      assert.ok(error instanceof ProviderCapabilityError);
      assert.equal(error.code, 'PROVIDER_MODEL_UNSUPPORTED');
      return true;
    }
  );

  assert.equal(provider.calls.length, 0, 'aucun appel modele sur un refus');
});

test('refus avant appel : answerStream exige le streaming', async () => {
  const provider = createProvider({ streaming: false });
  const brains = new GnoxeBrains({ modelProvider: provider });

  await assert.rejects(
    async () => {
      for await (const _chunk of brains.answerStream({ messages: MESSAGES })) {
        void _chunk;
      }
    },
    (error) => error.code === 'PROVIDER_CAPABILITY_UNAVAILABLE'
  );

  assert.equal(provider.calls.length, 0, 'aucun appel streaming sur un refus');
});

test('capacite offerte : appel realise normalement', async () => {
  const provider = createProvider({ images: true });
  const brains = new GnoxeBrains({ modelProvider: provider });

  const answer = await brains.answer({ messages: MESSAGES, model: 'gnoxe-brains-1.5' });
  assert.equal(answer.model, 'gnoxe-brains-1.5');
  assert.equal(provider.calls.length, 1);

  const chunks = [];
  for await (const chunk of brains.answerStream({ messages: MESSAGES })) {
    chunks.push(chunk);
  }
  assert.equal(chunks[chunks.length - 1].type, 'done');
  assert.equal(provider.calls.length, 2, 'chemin streaming nominal intact');
});

// --------------------------------------------------------- determinisme

test('determinisme : memes entrees, memes sorties et memes refus', () => {
  const returns = new Set();
  for (let i = 0; i < 50; i += 1) {
    returns.add(
      providerCapabilityResolver.resolve(CAPS_TYPICAL, {
        model: 'gnoxe-brains-1.5',
        requires: { streaming: true },
      })
    );
  }
  assert.deepEqual([...returns], ['gnoxe-brains-1.5']);

  const signatures = new Set();
  for (let i = 0; i < 50; i += 1) {
    try {
      providerCapabilityResolver.resolve(CAPS_TYPICAL, { model: 'gnoxe-brains-1', requires: { images: true } });
    } catch (error) {
      signatures.add(`${error.code}|${error.message}`);
    }
  }
  assert.equal(signatures.size, 1, 'un seul code et un seul message');

  const other = new ProviderCapabilityResolver();
  assert.equal(
    other.resolve(CAPS_TYPICAL, { model: 'gnoxe-brains-1' }),
    providerCapabilityResolver.resolve(CAPS_TYPICAL, { model: 'gnoxe-brains-1' }),
    'aucune instance n apporte d etat'
  );
});

// ------------------------------------------------------ absence de fallback

test('absence de fallback : jamais un autre modele propose ni rendu', () => {
  let rendered;
  try {
    rendered = providerCapabilityResolver.resolve(CAPS_NARROW, { model: 'gnoxe-brains-1.5' });
  } catch (error) {
    assert.equal(error.code, 'PROVIDER_MODEL_UNSUPPORTED');
  }
  assert.equal(rendered, undefined, 'un refus ne rend aucune valeur de substitut');

  let capacity;
  try {
    capacity = providerCapabilityResolver.resolve(CAPS_TYPICAL, {
      model: 'gnoxe-brains-1',
      requires: { images: true },
    });
  } catch (error) {
    assert.equal(error.code, 'PROVIDER_CAPABILITY_UNAVAILABLE');
  }
  assert.equal(capacity, undefined, 'une capacite manquante ne degrade pas vers un autre modele');

  // Quand tout convient, c'est exactement le modele demande qui revient,
  // pas le defaut du catalogue.
  assert.equal(
    providerCapabilityResolver.resolve(CAPS_FULL, { model: 'gnoxe-brains-1.5' }),
    'gnoxe-brains-1.5'
  );
});

// ------------------------------------- absence de scoring / priorisation

test('absence de scoring : la couche est une identite sur un succes', () => {
  for (const caps of [CAPS_FULL, CAPS_TYPICAL, CAPS_NARROW]) {
    for (const model of ['gnoxe-brains-1']) {
      if (!caps.models.includes(model)) continue;
      assert.equal(
        providerCapabilityResolver.resolve(caps, { model }),
        model,
        'aucune reselection'
      );
    }
  }

  // Un provider riche et un provider pauvre rendent le meme modele :
  // aucun provider n est prefere a un autre.
  assert.equal(
    providerCapabilityResolver.resolve(CAPS_FULL, { model: 'gnoxe-brains-1', requires: { images: true } }),
    providerCapabilityResolver.resolve(CAPS_NARROW, { model: 'gnoxe-brains-1' })
  );
});

test('aucune notion de score, de priorite ou de classement dans la couche', () => {
  const source = fs.readFileSync(
    path.join(SRC, 'core', 'provider-capability-resolver.ts'),
    'utf8'
  );

  for (const token of ['.sort(', 'weight', 'priority', 'rank', 'latency', 'cost']) {
    assert.ok(!source.includes(token), `notion interdite presente : "${token}"`);
  }
  assert.ok(!/\bscores?\b|\bscoring\b/i.test(source), 'aucune notion de score');
  assert.ok(!source.includes('Array.from'), 'aucun reordonnancement');
  assert.ok(source.includes('CAPABILITY_FLAGS'), 'ordre de lecture declare une seule fois');
});

// ------------------------------------------------------------- layering

test('layering : la couche ne depend que du contrat et du catalogue', () => {
  const source = fs.readFileSync(
    path.join(SRC, 'core', 'provider-capability-resolver.ts'),
    'utf8'
  );

  const specs = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(specs.sort(), ['../providers/model-provider', '@eyano/types']);

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
  ]) {
    assert.ok(!source.includes(token), `la couche ne doit pas nommer "${token}"`);
  }

  // Aucun import inverse : le contrat de provider ne connait pas la couche.
  const contract = fs.readFileSync(
    path.join(SRC, 'providers', 'model-provider.ts'),
    'utf8'
  );
  assert.ok(
    !contract.includes("from '../core"),
    'le contrat ModelProvider ne doit pas dependre de core/ (cycle)'
  );
  assert.ok(!contract.includes('provider-capability-resolver'), 'pas de reference circulaire');

  // Le catalogue reste vierge de toute dependance provider (une simple
  // mention de documentation n est pas un import).
  const catalog = fs.readFileSync(path.join(ROOT, 'packages', 'types', 'src', 'index.ts'), 'utf8');
  assert.ok(!/from\s+'(?!\.)/.test(catalog), 'le catalogue ne depense d aucun module externe');
  assert.ok(
    !/(?:from\s+'|import\s*\()\s*providers/.test(catalog),
    'aucun import provider depuis le catalogue'
  );
});

test('regressions ete 18, 19 et 20 : surfaces preservees', async () => {
  assert.equal(EYANO_MODELS.length, 5, 'catalogue etape 19 intact');

  const provider = createProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  const answer = await brains.answer({ messages: MESSAGES });
  assert.equal(!('usage' in answer), true, 'telemetrie etape 18 intacte');
  assert.deepEqual(Object.keys(answer).sort(), ['content', 'model', 'provider']);
});
