'use strict';

/**
 * Kepler Image : contrat, facade, flow et transport, SANS acces reseau.
 * Le transport est teste avec un `fetch` simule ; aucun appel au backend.
 */

process.env.GEMINI_API_KEY_1 = 'cle-test-1';
process.env.GEMINI_API_KEY_2 = 'cle-test-2';
delete process.env.GEMINI_API_KEY_3;
delete process.env.GEMINI_API_KEY_4;

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GnoxeBrains,
  setGnoxeBrains,
  imageFlow,
  ImageGenerationError,
  DEFAULT_IMAGE_MODEL_ID,
  listRegisteredImageModels,
  MAX_IMAGE_PROMPT_LENGTH,
} = require('../dist/index.js');
// Transport interne : jamais exporte par le paquet, teste ici directement.
const { GeminiAdapter, getKeyManager } = require('../dist/providers/gemini-adapter.js');

const PNG = Buffer.from('fausse-image').toString('base64');

function fakeImageProvider(overrides = {}) {
  const calls = [];
  return {
    calls,
    name: 'faux',
    capabilities: () => ({ streaming: false, structuredOutput: false, images: false, imageGeneration: true, models: [] }),
    async generate() { throw new Error('non utilise'); },
    async *stream() {},
    async structuredOutput() { return {}; },
    async generateImage(request) {
      calls.push(request);
      return { data: PNG, mimeType: 'image/png', model: request.model || 'kepler-image-1', provider: 'faux' };
    },
    ...overrides,
  };
}

// ------------------------------------------------------- registre / contrat

test('registre : identifiant logique par defaut, aucun nom reel expose', () => {
  assert.equal(DEFAULT_IMAGE_MODEL_ID, 'kepler-image-1');
  assert.deepEqual(listRegisteredImageModels(), ['kepler-image-1']);
  const api = require('../dist/index.js');
  assert.equal('resolveBackendImageModel' in api, false, 'le resolveur backend reste interne');
});

// ---------------------------------------------------------------- facade

test('facade : image, type MIME et identifiant logique, jamais le provider', async () => {
  const provider = fakeImageProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });
  const result = await brains.generateImage({ prompt: '  une planete rouge  ' });

  assert.deepEqual(result, { data: PNG, mimeType: 'image/png', model: 'kepler-image-1' });
  assert.equal('provider' in result, false);
  assert.equal(provider.calls[0].prompt, 'une planete rouge', 'prompt nettoye');
});

test('facade : prompt vide ou trop long -> INVALID_PROMPT, aucun appel', async () => {
  const provider = fakeImageProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });

  for (const prompt of ['', '   ', 'x'.repeat(MAX_IMAGE_PROMPT_LENGTH + 1)]) {
    await assert.rejects(brains.generateImage({ prompt }), (error) => error.code === 'INVALID_PROMPT');
  }
  assert.equal(provider.calls.length, 0);
});

test('facade : capacite absente -> UNAVAILABLE, jamais de repli', async () => {
  const noCapability = fakeImageProvider({
    capabilities: () => ({ streaming: true, structuredOutput: true, images: true, models: [] }),
  });
  const noMethod = fakeImageProvider({ generateImage: undefined });

  for (const provider of [noCapability, noMethod]) {
    const brains = new GnoxeBrains({ modelProvider: provider });
    await assert.rejects(brains.generateImage({ prompt: 'x' }), (error) => error.code === 'UNAVAILABLE');
  }
});

// ------------------------------------------------------------------ flow

test('imageFlow : passe par la facade du singleton', async () => {
  const provider = fakeImageProvider();
  setGnoxeBrains(new GnoxeBrains({ modelProvider: provider }));

  const result = await imageFlow({ prompt: 'un astronaute sur Mars' });
  assert.equal(result.mimeType, 'image/png');
  assert.equal(provider.calls.length, 1);
});

test('imageFlow : les erreurs du provider remontent avec leur code', async () => {
  setGnoxeBrains(
    new GnoxeBrains({
      modelProvider: fakeImageProvider({
        async generateImage() {
          throw new ImageGenerationError('QUOTA_EXHAUSTED', 'quota');
        },
      }),
    })
  );
  await assert.rejects(imageFlow({ prompt: 'x' }), (error) => error.code === 'QUOTA_EXHAUSTED');
});

// -------------------------------------------------- transport (fetch simule)

const realFetch = global.fetch;

function mockFetch(responder) {
  const requests = [];
  global.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(init.body) });
    const { status = 200, json } = responder(requests.length, String(url));
    return { ok: status >= 200 && status < 300, status, json: async () => json };
  };
  return requests;
}

function resetKeys() {
  for (const key of getKeyManager().keys) {
    key.cooldownUntil = 0;
    key.failures = 0;
  }
}

test.afterEach(() => {
  global.fetch = realFetch;
  resetKeys();
});

test('transport : structure exacte de la requete envoyee au modele image', async () => {
  const requests = mockFetch(() => ({
    json: { candidates: [{ content: { parts: [{ text: 'voici' }, { inlineData: { mimeType: 'image/png', data: PNG } }] } }] },
  }));
  const result = await new GeminiAdapter().generateImage({ prompt: 'une planete rouge' });

  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/gemini-2\.5-flash-image:generateContent\?key=cle-test-/);
  assert.deepEqual(requests[0].body, {
    contents: [{ role: 'user', parts: [{ text: 'une planete rouge' }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  });
  assert.deepEqual(result, { data: PNG, mimeType: 'image/png', model: 'kepler-image-1', provider: 'gemini' });
});

test('transport : 429 RESOURCE_EXHAUSTED sur toutes les cles -> QUOTA_EXHAUSTED', async () => {
  const requests = mockFetch(() => ({
    status: 429,
    json: { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'You exceeded your current quota' } },
  }));

  await assert.rejects(new GeminiAdapter().generateImage({ prompt: 'x' }), (error) => {
    assert.equal(error.code, 'QUOTA_EXHAUSTED');
    assert.equal(/googleapis|RESOURCE_EXHAUSTED/.test(error.message), false, 'aucun detail brut');
    return true;
  });
  assert.equal(requests.length, 2, 'chaque cle essayee une fois');
});

test('transport : le 429 image ne met AUCUNE cle en pause (le chat reste servi)', async () => {
  mockFetch(() => ({ status: 429, json: { error: { status: 'RESOURCE_EXHAUSTED' } } }));
  await assert.rejects(new GeminiAdapter().generateImage({ prompt: 'x' }));
  assert.ok(getKeyManager().getStatus().every((key) => key.isActive), 'aucune cle en pause');

  mockFetch(() => ({ json: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } }));
  const chat = await new GeminiAdapter().generate({ messages: [{ role: 'user', content: 'salut' }] });
  assert.equal(chat.content, 'ok');
});

test('transport : le 429 du chat garde sa politique (cle mise en pause)', async () => {
  mockFetch(() => ({ status: 429, json: { error: { status: 'RESOURCE_EXHAUSTED' } } }));
  await assert.rejects(new GeminiAdapter().generate({ messages: [{ role: 'user', content: 'x' }] }), /rotation/);
  assert.ok(getKeyManager().getStatus().every((key) => !key.isActive), 'cles en pause');
});

test('transport : reponse sans image -> NO_IMAGE avec la raison', async () => {
  mockFetch(() => ({ json: { candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'refus' }] } }] } }));
  await assert.rejects(new GeminiAdapter().generateImage({ prompt: 'x' }), (error) => {
    assert.equal(error.code, 'NO_IMAGE');
    assert.match(error.message, /SAFETY/);
    return true;
  });
});

test('transport : modele inconnu -> UNKNOWN_MODEL, aucun appel', async () => {
  const requests = mockFetch(() => ({ json: {} }));
  await assert.rejects(
    new GeminiAdapter().generateImage({ prompt: 'x', model: 'inconnu' }),
    (error) => error.code === 'UNKNOWN_MODEL'
  );
  assert.equal(requests.length, 0);
});

test('transport : autre erreur -> FAILED, sans le detail brut du backend', async () => {
  mockFetch(() => ({ status: 500, json: { error: { message: 'detail interne https://x.googleapis.com' } } }));
  await assert.rejects(new GeminiAdapter().generateImage({ prompt: 'x' }), (error) => {
    assert.equal(error.code, 'FAILED');
    assert.equal(error.message.includes('googleapis'), false);
    return true;
  });
});

test('capacite : le transport declare la generation d images', () => {
  assert.equal(new GeminiAdapter().capabilities().imageGeneration, true);
});

// ------------------------------------------- second transport (prototype)

const { PollinationsImageAdapter } = require('../dist/providers/pollinations-image-adapter.js');
const { getImageProvider } = require('../dist/providers/bootstrap.js');

function fakeHttp(status, contentType, body = Buffer.from('JPEG')) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return new Response(body, { status, headers: { 'content-type': contentType } });
  };
  return { calls, impl };
}

test('pollinations : requete authentifiee, filtre actif, image en base64', async () => {
  const http = fakeHttp(200, 'image/jpeg');
  const adapter = new PollinationsImageAdapter(http.impl, () => 'cle-test');
  const result = await adapter.generateImage({ prompt: 'un chien roux' });

  const url = new URL(http.calls[0].url);
  assert.equal(decodeURIComponent(url.pathname), '/image/un chien roux');
  assert.equal(url.searchParams.get('safe'), 'true');
  assert.equal(url.searchParams.get('model'), 'zimage');
  assert.equal(http.calls[0].init.headers.Authorization, 'Bearer cle-test');
  assert.deepEqual(result, {
    data: Buffer.from('JPEG').toString('base64'),
    mimeType: 'image/jpeg',
    model: DEFAULT_IMAGE_MODEL_ID,
    provider: 'pollinations',
  });
});

test('pollinations : sans cle -> UNAVAILABLE, aucun appel', async () => {
  const http = fakeHttp(200, 'image/jpeg');
  const adapter = new PollinationsImageAdapter(http.impl, () => undefined);
  await assert.rejects(adapter.generateImage({ prompt: 'x' }), { code: 'UNAVAILABLE' });
  assert.equal(http.calls.length, 0);
});

test('pollinations : statuts HTTP -> codes stables, sans detail brut', async () => {
  for (const [status, code] of [[401, 'UNAVAILABLE'], [403, 'UNAVAILABLE'], [402, 'QUOTA_EXHAUSTED'], [429, 'QUOTA_EXHAUSTED'], [400, 'NO_IMAGE'], [500, 'FAILED']]) {
    const http = fakeHttp(status, 'application/json', Buffer.from('{"error":"secret backend"}'));
    const adapter = new PollinationsImageAdapter(http.impl, () => 'cle-test');
    await assert.rejects(adapter.generateImage({ prompt: 'x' }), (error) => {
      assert.equal(error.code, code, `HTTP ${status}`);
      assert.equal(/secret backend/.test(error.message), false);
      return true;
    });
  }
});

test('pollinations : reponse qui n est pas une image -> NO_IMAGE ; reseau -> FAILED', async () => {
  const notImage = new PollinationsImageAdapter(fakeHttp(200, 'application/json').impl, () => 'k');
  await assert.rejects(notImage.generateImage({ prompt: 'x' }), { code: 'NO_IMAGE' });
  const down = new PollinationsImageAdapter(async () => { throw new Error('ECONNRESET'); }, () => 'k');
  await assert.rejects(down.generateImage({ prompt: 'x' }), { code: 'FAILED' });
});

test('pollinations : modele inconnu -> UNKNOWN_MODEL', async () => {
  const adapter = new PollinationsImageAdapter(fakeHttp(200, 'image/png').impl, () => 'k');
  await assert.rejects(adapter.generateImage({ prompt: 'x', model: 'inconnu' }), { code: 'UNKNOWN_MODEL' });
});

test('choix du backend image : KEPLER_IMAGE_BACKEND, defaut inchange', () => {
  const previous = process.env.KEPLER_IMAGE_BACKEND;
  try {
    delete process.env.KEPLER_IMAGE_BACKEND;
    assert.notEqual(getImageProvider().name, 'pollinations');
    process.env.KEPLER_IMAGE_BACKEND = 'pollinations';
    assert.equal(getImageProvider().name, 'pollinations');
  } finally {
    if (previous === undefined) delete process.env.KEPLER_IMAGE_BACKEND;
    else process.env.KEPLER_IMAGE_BACKEND = previous;
  }
});

// --------------------------------------------------- retouche (image de depart)

const JPEG_SOURCE = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');

test('retouche gemini : l image de depart precede la consigne', async () => {
  const requests = mockFetch(() => ({
    json: { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }] },
  }));
  await new GeminiAdapter().generateImage({ prompt: 'ajoute un chapeau', sourceImage: { data: JPEG_SOURCE, mimeType: 'image/jpeg' } });
  assert.deepEqual(requests[0].body.contents[0].parts, [
    { inlineData: { mimeType: 'image/jpeg', data: JPEG_SOURCE } },
    { text: 'ajoute un chapeau' },
  ]);
});

test('retouche pollinations : multipart vers l edition, image en retour', async () => {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ data: [{ b64_json: JPEG_SOURCE }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const adapter = new PollinationsImageAdapter(impl, () => 'cle-test');
  const result = await adapter.generateImage({ prompt: 'retire l humain', sourceImage: { data: JPEG_SOURCE, mimeType: 'image/jpeg' } });

  assert.equal(calls[0].url, 'https://gen.pollinations.ai/v1/images/edits');
  assert.equal(calls[0].init.method, 'POST');
  const form = calls[0].init.body;
  assert.equal(form.get('prompt'), 'retire l humain');
  assert.equal(form.get('model'), 'flux-klein');
  assert.deepEqual(Buffer.from(await form.get('image').arrayBuffer()), Buffer.from(JPEG_SOURCE, 'base64'));
  assert.deepEqual(result, { data: JPEG_SOURCE, mimeType: 'image/jpeg', model: DEFAULT_IMAGE_MODEL_ID, provider: 'pollinations' });
});

test('retouche pollinations : reponse sans image -> NO_IMAGE ; quota -> QUOTA_EXHAUSTED', async () => {
  const empty = new PollinationsImageAdapter(async () => new Response('{"data":[]}', { status: 200 }), () => 'k');
  await assert.rejects(empty.generateImage({ prompt: 'x', sourceImage: { data: JPEG_SOURCE, mimeType: 'image/jpeg' } }), { code: 'NO_IMAGE' });
  const broke = new PollinationsImageAdapter(async () => new Response('{}', { status: 402 }), () => 'k');
  await assert.rejects(broke.generateImage({ prompt: 'x', sourceImage: { data: JPEG_SOURCE, mimeType: 'image/jpeg' } }), { code: 'QUOTA_EXHAUSTED' });
});

test('facade : image de depart transmise ; type ou taille invalide refuses sans appel', async () => {
  const provider = fakeImageProvider();
  const brains = new GnoxeBrains({ modelProvider: provider });
  await brains.generateImage({ prompt: 'ajoute un chapeau', sourceImage: { data: JPEG_SOURCE, mimeType: 'image/jpeg' } });
  assert.deepEqual(provider.calls[0].sourceImage, { data: JPEG_SOURCE, mimeType: 'image/jpeg' });

  for (const sourceImage of [{ data: JPEG_SOURCE, mimeType: 'image/svg+xml' }, { data: '', mimeType: 'image/png' }]) {
    await assert.rejects(brains.generateImage({ prompt: 'x', sourceImage }), { code: 'INVALID_PROMPT' });
  }
  assert.equal(provider.calls.length, 1);
});

test('pollinations : image « bloquee par le filtre » -> NO_IMAGE, jamais affichee', async () => {
  const impl = async () => new Response(Buffer.from('JPEG'), {
    status: 200,
    headers: { 'content-type': 'image/jpeg', 'content-disposition': 'inline; filename="request-blocked-by-safety-filter.jpeg"' },
  });
  const adapter = new PollinationsImageAdapter(impl, () => 'k');
  await assert.rejects(adapter.generateImage({ prompt: 'x' }), { code: 'NO_IMAGE' });
});

test('pollinations : KEPLER_POLLINATIONS_MODEL choisit le modele de creation', async () => {
  const previous = process.env.KEPLER_POLLINATIONS_MODEL;
  try {
    process.env.KEPLER_POLLINATIONS_MODEL = 'sana';
    const http = fakeHttp(200, 'image/jpeg');
    await new PollinationsImageAdapter(http.impl, () => 'k').generateImage({ prompt: 'x' });
    assert.equal(new URL(http.calls[0].url).searchParams.get('model'), 'sana');
  } finally {
    if (previous === undefined) delete process.env.KEPLER_POLLINATIONS_MODEL;
    else process.env.KEPLER_POLLINATIONS_MODEL = previous;
  }
});
