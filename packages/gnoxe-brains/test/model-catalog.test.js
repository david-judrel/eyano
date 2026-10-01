'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  EYANO_MODELS,
  DEFAULT_MODEL_ID,
  getDefaultModel,
  getModelInfo,
  getAvailableModels,
  isRegisteredModel,
  listRegisteredModels,
  resolveBackendModel,
  resolveLogicalModel,
} = require('../dist/index.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const TYPES_SOURCE = path.join(ROOT, 'packages', 'types', 'src', 'index.ts');
const WEB_LIB = path.join(ROOT, 'apps', 'web', 'src', 'lib');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

// ------------------------------------------------------- une seule table

test('le catalogue public est une table unique et bien forme', () => {
  assert.ok(Array.isArray(EYANO_MODELS));
  assert.equal(EYANO_MODELS.length, 5);

  const ids = EYANO_MODELS.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
  assert.equal(new Set(EYANO_MODELS.map((e) => e.name)).size, ids.length, 'libelles uniques');

  for (const entry of EYANO_MODELS) {
    assert.equal(typeof entry.name, 'string');
    assert.equal(typeof entry.description, 'string');
    assert.ok(entry.maxTokens > 0, `${entry.id} : capacite declaree`);
    assert.equal(typeof entry.available, 'boolean');
    assert.equal(typeof entry.default, 'boolean');
  }
});

test('exactement un modele est declare par defaut', () => {
  const defaults = EYANO_MODELS.filter((entry) => entry.default);

  assert.equal(defaults.length, 1, 'un seul defaut, jamais plusieurs');
  assert.equal(typeof defaults[0].id, 'string');
  assert.equal(DEFAULT_MODEL_ID, defaults[0].id, 'le registre lit le defaut du catalogue');
  assert.equal(getDefaultModel(), DEFAULT_MODEL_ID, 'une seule notion de defaut publique');
});

// ------------------------------------- deux vues, un meme catalogue

test('le registre d execution est derive des seules entrees disponibles', () => {
  const available = EYANO_MODELS.filter((entry) => entry.available).map((entry) => entry.id);

  assert.deepEqual(listRegisteredModels(), available, 'registre = catalogue disponible');
  assert.deepEqual(getAvailableModels().map((entry) => entry.id), available);
});

test('chaque modele disponible resout un backend reel', () => {
  for (const id of listRegisteredModels()) {
    const backend = resolveBackendModel(id);
    assert.equal(typeof backend, 'string', `${id} : backend absent`);
    assert.ok(backend.length > 0, `${id} : backend vide`);
    assert.equal(resolveLogicalModel(id), id, `${id} : aller-retour stable`);
  }
});

test('un modele non disponible reste au catalogue mais n est jamais executable', () => {
  const unavailable = EYANO_MODELS.filter((entry) => !entry.available).map((entry) => entry.id);

  assert.deepEqual(unavailable, ['gnoxe-brains-2', 'gnoxe-brains-code', 'gnoxe-brains-vision']);

  for (const id of unavailable) {
    assert.equal(isRegisteredModel(id), false, `${id} : refuse par le registre`);
    assert.ok(getModelInfo(id), `${id} : toujours documente au catalogue`);
    assert.throws(() => resolveBackendModel(id), /Modele inconnu/);
    assert.throws(() => resolveLogicalModel(id), /Modele inconnu/);
  }

  assert.deepEqual(
    getAvailableModels().map((entry) => entry.id),
    listRegisteredModels(),
    'le selecteur et le registre voient la meme disponibilite'
  );
});

test('sans modele demande, le defaut du catalogue est applique', () => {
  assert.equal(resolveLogicalModel(undefined), DEFAULT_MODEL_ID);
  assert.equal(
    resolveBackendModel(undefined),
    resolveBackendModel(DEFAULT_MODEL_ID),
    'le defaut n a aucun traitement special : il passe par la meme table'
  );
  assert.equal(isRegisteredModel(undefined), false, 'un indefini n est pas un modele valide');
});

// ------------------------------------- identite et unification des defauts

test('le catalogue public ne nomme aucun fournisseur ni backend', () => {
  const source = read(TYPES_SOURCE);

  for (const token of [
    'gemini',
    'Gemini',
    'Google',
    'googleai',
    'GEMINI_API_KEY',
    'Genkit',
    'genkit',
    '@genkit-ai',
    'fetch(',
    'process.env',
    'console.',
  ]) {
    assert.ok(!source.includes(token), `types/src/index.ts ne doit pas nommer "${token}"`);
  }
});

test('l interface n emporte aucune copie de catalogue', () => {
  assert.ok(
    !fs.existsSync(path.join(WEB_LIB, 'models.ts')),
    'la copie apps/web/src/lib/models.ts est supprimee'
  );
  assert.ok(
    !fs.existsSync(path.join(ROOT, 'packages', 'types', 'src', 'index.d.ts')),
    "l artefact dupliquant l union AIModel est supprime"
  );
  assert.ok(
    !fs.existsSync(path.join(ROOT, 'packages', 'types', 'src', 'index.js')),
    'le doublon compile dans src/ est supprime'
  );

  const store = read(path.join(WEB_LIB, 'store.ts'));
  assert.ok(store.includes("from '@eyano/types'"), 'la boutique lit le catalogue commun');
  assert.ok(!store.includes("'gnoxe-brains-1'"), 'aucun identifiant en dur dans la boutique');

  const profile = read(path.join(ROOT, 'apps', 'web', 'src', 'components', 'ProfileContent.tsx'));
  assert.ok(!profile.includes("'gnoxe-brains-1'"), 'aucun identifiant en dur dans le profil');

  const topBar = read(path.join(ROOT, 'apps', 'web', 'src', 'components', 'TopBar.tsx'));
  assert.ok(topBar.includes("from '@eyano/types'"), 'le selecteur lit le catalogue commun');
  assert.ok(!topBar.includes('@/lib/models'), 'plus de reference au fichier supprime');
});

test('le modele par defaut n est plus redifie dans le code applicatif', () => {
  const literals = [
    path.join(ROOT, 'packages', 'gnoxe-brains', 'src', 'flows', 'chat.flow.ts'),
    path.join(ROOT, 'packages', 'gnoxe-brains', 'src', 'flows', 'title.flow.ts'),
    path.join(ROOT, 'packages', 'gnoxe-brains', 'src', 'flows', 'summary.flow.ts'),
    path.join(ROOT, 'apps', 'api', 'src', 'modules', 'ai', 'ai.service.ts'),
  ];

  for (const file of literals) {
    const source = read(file);
    assert.ok(
      !source.includes("'gnoxe-brains-1'"),
      `${path.relative(ROOT, file)} : defaut redifie`
    );
  }

  // Le mapping de traduction reste, lui, en un seul endroit.
  const registry = read(
    path.join(ROOT, 'packages', 'gnoxe-brains', 'src', 'providers', 'model-registry.ts')
  );
  assert.ok(registry.includes("'gnoxe-brains-1': 'gemini-3.5-flash-lite'"));
  assert.ok(
    /for \(const entry of EYANO_MODELS\)/.test(registry),
    'les cles derivent du catalogue'
  );
  assert.ok(registry.includes('if (!entry.available) continue;'), 'seules les entrees disponibles');
});

// ------------------------------------------------- validation unifiee

test('toutes les routes exposant un modele passent par le registre', () => {
  const controllers = [
    path.join(ROOT, 'apps', 'api', 'src', 'modules', 'ai', 'ai.controller.ts'),
    path.join(ROOT, 'apps', 'api', 'src', 'modules', 'missions', 'missions.controller.ts'),
    path.join(ROOT, 'apps', 'api', 'src', 'modules', 'messages', 'messages.controller.ts'),
  ];

  for (const file of controllers) {
    const source = read(file);
    assert.ok(
      source.includes('isRegisteredModel'),
      `${path.relative(ROOT, file)} : modele non valide`
    );
    assert.ok(
      source.includes('BadRequestException'),
      `${path.relative(ROOT, file)} : refus explicite`
    );
  }
});
