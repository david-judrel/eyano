'use strict';

/**
 * Kepler Image (API) : drapeau, gardes, traduction des erreurs. Sans
 * reseau : la couche d'intelligence est remplacee par un faux provider.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { GnoxeBrains, setGnoxeBrains, ImageGenerationError } = require('@eyano/gnoxe-brains');

const DIST = path.join(__dirname, '..', 'dist');
const { ImageService } = require(path.join(DIST, 'modules/image/image.service.js'));
const { ImageController } = require(path.join(DIST, 'modules/image/image.controller.js'));
const { isKeplerImageEnabled } = require(path.join(DIST, 'modules/image/kepler-flag.js'));
const { AuthGuard } = require(path.join(DIST, 'guards/auth.guard.js'));
const { RateLimitGuard } = require(path.join(DIST, 'guards/rate-limit.guard.js'));

const PNG = Buffer.from('fausse-image').toString('base64');

function useProvider(generateImage) {
  setGnoxeBrains(
    new GnoxeBrains({
      modelProvider: {
        name: 'faux-backend',
        capabilities: () => ({ streaming: false, structuredOutput: false, images: false, imageGeneration: true, models: [] }),
        async generate() { throw new Error('non utilise'); },
        async *stream() {},
        async structuredOutput() { return {}; },
        generateImage,
      },
    })
  );
}

// ---------------------------------------------------------------- drapeau

test('drapeau : coupe par defaut, seule la valeur exacte "true" l active', () => {
  assert.equal(isKeplerImageEnabled({}), false);
  for (const value of ['false', '1', 'TRUE', 'yes', '']) {
    assert.equal(isKeplerImageEnabled({ KEPLER_IMAGE_ENABLED: value }), false, value);
  }
  assert.equal(isKeplerImageEnabled({ KEPLER_IMAGE_ENABLED: 'true' }), true);
});

function appModuleImportsImage(flag) {
  const env = { ...process.env };
  delete env.KEPLER_IMAGE_ENABLED;
  if (flag !== undefined) env.KEPLER_IMAGE_ENABLED = flag;
  const script = `
    require('reflect-metadata');
    const { AppModule } = require('./dist/app.module.js');
    const imports = Reflect.getMetadata('imports', AppModule) || [];
    process.stdout.write(String(imports.some((m) => m && m.name === 'ImageModule')));
  `;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: path.join(__dirname, '..'), env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() === 'true';
}

test('drapeau : module ABSENT d AppModule sans variable ou avec false', () => {
  assert.equal(appModuleImportsImage(undefined), false);
  assert.equal(appModuleImportsImage('false'), false);
});

test('drapeau : module present seulement avec KEPLER_IMAGE_ENABLED=true', () => {
  assert.equal(appModuleImportsImage('true'), true);
});

test('drapeau documente et coupe dans .env.example', () => {
  const example = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
  assert.match(example, /^KEPLER_IMAGE_ENABLED=false$/m);
});

// ----------------------------------------------------------------- gardes

test('gardes : authentification et limitation de debit', () => {
  const guards = Reflect.getMetadata('__guards__', ImageController) || [];
  assert.ok(guards.includes(AuthGuard), 'AuthGuard');
  assert.ok(guards.includes(RateLimitGuard), 'RateLimitGuard');
});

// ------------------------------------------------- service et traduction

test('succes : image, type MIME, modele logique ; jamais le backend', async () => {
  useProvider(async () => ({ data: PNG, mimeType: 'image/png', model: 'kepler-image-1', provider: 'faux-backend' }));
  const result = await new ImageController(new ImageService()).generate({ prompt: 'une planete' });

  assert.deepEqual(result, { data: PNG, mimeType: 'image/png', model: 'kepler-image-1' });
  assert.equal(JSON.stringify(result).includes('faux-backend'), false);
});

async function failureFor(error) {
  useProvider(async () => {
    throw error;
  });
  try {
    await new ImageService().generate('x');
  } catch (caught) {
    return { status: caught.getStatus(), body: caught.getResponse() };
  }
  assert.fail('une erreur etait attendue');
}

test('429 RESOURCE_EXHAUSTED : 503 avec le code QUOTA_EXHAUSTED', async () => {
  const { status, body } = await failureFor(new ImageGenerationError('QUOTA_EXHAUSTED', 'detail interne'));
  assert.equal(status, 503);
  assert.equal(body.code, 'QUOTA_EXHAUSTED');
  assert.equal(body.message.includes('detail interne'), false, 'message stable, pas le detail');
});

test('traduction de chaque code stable', async () => {
  const expected = {
    INVALID_PROMPT: 400,
    UNKNOWN_MODEL: 400,
    UNAVAILABLE: 503,
    NO_IMAGE: 422,
    FAILED: 502,
  };
  for (const [code, status] of Object.entries(expected)) {
    const result = await failureFor(new ImageGenerationError(code, 'x'));
    assert.equal(result.status, status, code);
    assert.equal(result.body.code, code);
  }
});

test('erreur inattendue : 502 FAILED, sans fuite du message brut', async () => {
  const { status, body } = await failureFor(new Error('https://backend.example secret'));
  assert.equal(status, 502);
  assert.equal(body.code, 'FAILED');
  assert.equal(JSON.stringify(body).includes('secret'), false);
});

test('prompt absent ou non textuel : 400 INVALID_PROMPT', async () => {
  useProvider(async () => assert.fail('aucun appel attendu'));
  for (const prompt of [undefined, null, 42, '   ']) {
    await assert.rejects(new ImageService().generate(prompt), (error) => {
      assert.equal(error.getStatus(), 400);
      assert.equal(error.getResponse().code, 'INVALID_PROMPT');
      return true;
    });
  }
});
