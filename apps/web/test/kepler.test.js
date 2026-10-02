'use strict';

/**
 * Kepler Image (web) : logique d'interface, client API, drapeau.
 *
 * Aucun outil de test React dans `apps/web` et aucune dependance ajoutee :
 * les modules `.ts` sont compiles a la volee avec `typescript` (deja dans
 * le depot). Le composant n'affiche que l'etat de `lib/kepler.ts`, teste ici.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  module._compile(outputText, filename);
};

const SRC = path.join(__dirname, '..', 'src');
const kepler = require(path.join(SRC, 'lib', 'kepler.ts'));
const {
  keplerReducer,
  initialKeplerState,
  keplerErrorMessage,
  keplerErrorCode,
  canSubmit,
  imageDataUrl,
  downloadFileName,
  MAX_KEPLER_PROMPT_LENGTH,
} = kepler;

const IMAGE = { data: 'QUJD', mimeType: 'image/png' };
const run = (...actions) => actions.reduce(keplerReducer, initialKeplerState);

// ---------------------------------------------------------- etat de l'UI

test('etat vide : rien a envoyer tant que le prompt est vide', () => {
  assert.equal(initialKeplerState.status, 'idle');
  assert.equal(canSubmit(initialKeplerState), false);
  assert.deepEqual(run({ type: 'submit' }), initialKeplerState);
  assert.equal(canSubmit(run({ type: 'prompt', value: 'x'.repeat(MAX_KEPLER_PROMPT_LENGTH + 1) })), false);
});

test('generation : chargement, prompt conserve, pas de double requete', () => {
  const loading = run({ type: 'prompt', value: 'une planete' }, { type: 'submit' });
  assert.equal(loading.status, 'loading');
  assert.equal(loading.prompt, 'une planete');
  assert.equal(canSubmit(loading), false, 'bouton desactive');
  assert.equal(keplerReducer(loading, { type: 'submit' }), loading, 'second envoi ignore');
  assert.equal(keplerReducer(loading, { type: 'prompt', value: 'autre' }).prompt, 'une planete');
});

test('succes : image affichee, puis nouvelle image en gardant le prompt', () => {
  const done = run({ type: 'prompt', value: 'une planete' }, { type: 'submit' }, { type: 'success', image: IMAGE });
  assert.equal(done.status, 'done');
  assert.deepEqual(done.image, IMAGE);

  const fresh = keplerReducer(done, { type: 'reset' });
  assert.equal(fresh.status, 'idle');
  assert.equal(fresh.image, null);
  assert.equal(fresh.prompt, 'une planete');
});

test('etat d erreur : message explicite pour le quota (429 RESOURCE_EXHAUSTED)', () => {
  const failed = run({ type: 'prompt', value: 'une planete' }, { type: 'submit' }, { type: 'failure', code: 'QUOTA_EXHAUSTED' });
  assert.equal(failed.status, 'error');
  assert.equal(failed.image, null);
  assert.match(failed.error, /quota/i);
  assert.equal(failed.prompt, 'une planete', 'prompt conserve pour reessayer');
  assert.equal(canSubmit(failed), true, 'on peut reessayer');
});

test('etat d erreur : chaque code a son message, inconnu -> message generique', () => {
  for (const code of ['UNAVAILABLE', 'NO_IMAGE', 'INVALID_PROMPT', 'RATE_LIMITED', 'NETWORK']) {
    assert.notEqual(keplerErrorMessage(code), keplerErrorMessage(undefined), code);
  }
  assert.equal(keplerErrorMessage('INCONNU'), keplerErrorMessage('FAILED'));
});

test('code d erreur : celui de l API, sinon deduit du statut', () => {
  assert.equal(keplerErrorCode(503, { code: 'QUOTA_EXHAUSTED' }), 'QUOTA_EXHAUSTED');
  assert.equal(keplerErrorCode(429, { message: 'Trop de requetes' }), 'RATE_LIMITED');
  assert.equal(keplerErrorCode(404, null), 'UNAVAILABLE');
  assert.equal(keplerErrorCode(500, null), 'FAILED');
});

test('affichage et telechargement', () => {
  assert.equal(imageDataUrl(IMAGE), 'data:image/png;base64,QUJD');
  assert.equal(
    downloadFileName(IMAGE, new Date('2026-10-02T10:20:30Z')),
    'kepler-image-2026-10-02-10-20-30.png'
  );
  assert.match(downloadFileName({ data: '', mimeType: 'image/jpeg' }), /\.jpeg$/);
});

// -------------------------------------------------------------- client API

const realFetch = global.fetch;
test.afterEach(() => {
  global.fetch = realFetch;
});

function loadApi() {
  return require(path.join(SRC, 'lib', 'api.ts'));
}

test('client : requete POST /image/generate avec le prompt et le jeton', async () => {
  const { api } = loadApi();
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ data: 'QUJD', mimeType: 'image/png', model: 'kepler-image-1' }) };
  };
  api.token = 'jeton-test';

  const image = await api.generateImage('une planete');
  assert.deepEqual(image, IMAGE, 'seulement image et type MIME');
  assert.match(calls[0].url, /\/image\/generate$/);
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { prompt: 'une planete' });
  assert.equal(calls[0].init.headers.Authorization, 'Bearer jeton-test');
});

test('client : 503 QUOTA_EXHAUSTED -> erreur porteuse du code', async () => {
  const { api, KeplerRequestError } = loadApi();
  global.fetch = async () => ({ ok: false, status: 503, json: async () => ({ code: 'QUOTA_EXHAUSTED', message: 'x' }) });
  await assert.rejects(api.generateImage('x'), (error) => error instanceof KeplerRequestError && error.code === 'QUOTA_EXHAUSTED');
});

test('client : serveur injoignable -> NETWORK', async () => {
  const { api } = loadApi();
  global.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(api.generateImage('x'), (error) => error.code === 'NETWORK');
});

// ---------------------------------------------------------------- drapeau

function flagWith(value) {
  const file = path.join(SRC, 'lib', 'features.ts');
  delete require.cache[file];
  const previous = process.env.NEXT_PUBLIC_KEPLER_IMAGE;
  if (value === undefined) delete process.env.NEXT_PUBLIC_KEPLER_IMAGE;
  else process.env.NEXT_PUBLIC_KEPLER_IMAGE = value;
  try {
    return require(file).KEPLER_IMAGE_ENABLED;
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_KEPLER_IMAGE;
    else process.env.NEXT_PUBLIC_KEPLER_IMAGE = previous;
  }
}

test('drapeau : coupe par defaut, seule la valeur exacte "true" l active', () => {
  assert.equal(flagWith(undefined), false);
  assert.equal(flagWith('false'), false);
  assert.equal(flagWith('1'), false);
  assert.equal(flagWith('true'), true);
});

test('drapeau coupe : /kepler en 404 et aucune entree dans la Sidebar', () => {
  const page = fs.readFileSync(path.join(SRC, 'app', 'kepler', 'page.tsx'), 'utf8');
  assert.match(page, /if \(!KEPLER_IMAGE_ENABLED\) notFound\(\);/);

  const sidebar = fs.readFileSync(path.join(SRC, 'components', 'Sidebar.tsx'), 'utf8');
  const entry = sidebar.indexOf("router.push('/kepler')");
  assert.ok(entry > 0, 'entree presente');
  assert.ok(sidebar.lastIndexOf('{KEPLER_IMAGE_ENABLED && (', entry) > 0, 'entree gardee par le drapeau');
  assert.equal((sidebar.match(/\/kepler/g) || []).length, 1, 'une seule entree');
});
