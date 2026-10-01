'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { OBSERVATION_EVENT_KEYS, FORBIDDEN_OBSERVATION_KEYS } = require('../dist/index.js');

const ROOT = path.join(__dirname, '..', '..', '..');
const PKG = path.join(ROOT, 'packages');
const SRC = path.join(__dirname, '..', 'src');
const API_SRC = path.join(ROOT, 'apps', 'api', 'src');

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', '.git', '.whatsapp_history']);

function walk(dir, predicate) {
  if (!fs.existsSync(dir)) return [];
  const found = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full, predicate));
    } else if (predicate(entry.name, full)) {
      found.push(full);
    }
  }

  return found;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

/** Backend concrets et dependances interdites hors de la couche `providers/`. */
const FORBIDDEN_BACKEND = [
  'GeminiAdapter',
  'gemini-adapter',
  'GeminiKeyManager',
  'gemini-key-manager',
  'GEMINI_API_KEY',
  'providers/bootstrap',
  'Genkit',
  'genkit',
  '@genkit-ai',
  'Google',
  'googleai',
];

function assertNoBackendToken(file) {
  const content = read(file);
  for (const token of FORBIDDEN_BACKEND) {
    assert.ok(
      !content.includes(token),
      `${relative(file)} ne doit pas contenir "${token}"`
    );
  }
}

// ------------------------------------------------------------------ genkit

test('aucun import genkit / @genkit-ai/* n existe', () => {
  const offenders = [];

  for (const manifest of walk(ROOT, (name) => name === 'package.json')) {
    if (/genkit/i.test(read(manifest))) offenders.push(relative(manifest));
  }

  for (const file of [
    ...walk(path.join(PKG, 'gnoxe-brains', 'src'), (n) => n.endsWith('.ts')),
    ...walk(path.join(ROOT, 'apps', 'api', 'src'), (n) => n.endsWith('.ts')),
    ...walk(path.join(ROOT, 'apps', 'web'), (n) => n.endsWith('.ts') || n.endsWith('.tsx')),
  ]) {
    if (/@genkit-ai|\bgenkit\b/i.test(read(file))) offenders.push(relative(file));
  }

  assert.deepEqual(offenders, [], 'aucune trace de genkit attendue');
});

// ------------------------------------------------------------------ agents

test("aucun agent n'importe directement Gemini", () => {
  const files = walk(path.join(SRC, 'agents'), (n) => n.endsWith('.ts'));
  assert.ok(files.length >= 5, 'agents introuvables');

  for (const file of files) {
    assertNoBackendToken(file);

    const content = read(file);
    const specs = [...content.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    for (const spec of specs) {
      if (spec.includes('providers')) {
        assert.equal(
          spec,
          '../providers/model-provider',
          `${relative(file)} ne doit importer que le contrat ModelProvider (a obtenu "${spec}")`
        );
      }
    }
  }
});

// ----------------------------------------------------------- orchestrateur

test("aucun orchestrateur n'importe directement Gemini", () => {
  const files = walk(path.join(SRC, 'orchestrator'), (n) => n.endsWith('.ts'));
  assert.ok(files.length >= 3, 'orchestrateur introuvable');

  for (const file of files) {
    assertNoBackendToken(file);
    assert.ok(
      !read(file).includes("from '../providers"),
      `${relative(file)} ne doit dependre d'aucun provider`
    );
  }
});

// ------------------------------------------------------------------- tools

test("aucun outil ne depend directement d'un provider concret", () => {
  const files = walk(path.join(SRC, 'tools'), (n) => n.endsWith('.ts'));
  assert.ok(files.length >= 6, 'tools introuvables');

  for (const file of files) {
    assertNoBackendToken(file);
    assert.ok(
      !read(file).includes("from '../providers"),
      `${relative(file)} ne doit dependre d'aucun provider`
    );
  }
});

// ---------------------------------------------------------------- apps/api

test('apps/api ne contourne pas GnoxeBrains pour les flows', () => {
  const offenders = walk(API_SRC, (n) => n.endsWith('.ts')).filter((file) => {
    const content = read(file);
    return /getAIProvider|getModelProvider|summaryFlow|documentAnalysisFlow/.test(content);
  });

  assert.deepEqual(
    offenders.map(relative),
    [],
    "apps/api ne doit appeler ni l'ancien AIProvider ni les flows non consommes"
  );

  const aiService = path.join(API_SRC, 'modules', 'ai', 'ai.service.ts');
  const content = read(aiService);
  for (const flow of ['chatFlow', 'chatFlowSync', 'titleFlow']) {
    assert.ok(content.includes(flow), `ai.service.ts doit toujours utiliser ${flow}`);
  }
});

test('apps/api ne depend d aucun symbole de transport du paquet', () => {
  const offenders = walk(API_SRC, (n) => n.endsWith('.ts')).flatMap((file) =>
    read(file)
      .split(/\r?\n/)
      .flatMap((line, index) =>
        /\b(getKeyManager|GeminiAdapter|GeminiKeyManager)\b/.test(line)
          ? [`${relative(file)}:${index + 1}: ${line.trim()}`]
          : []
      )
  );

  assert.deepEqual(
    offenders,
    [],
    "apps/api doit consommer la facade neutre du paquet, jamais le transport interne"
  );
});

test('les actions d audit applicatives n identifient aucun fournisseur', () => {
  const controller = read(path.join(API_SRC, 'modules', 'ai', 'ai.controller.ts'));
  const actions = [...controller.matchAll(/action:\s*'([^']+)'/g)].map((m) => m[1]);

  assert.ok(actions.length >= 2, 'actions d audit introuvables');
  for (const action of actions) {
    assert.ok(!/gemini/i.test(action), `action d audit tenant du fournisseur : ${action}`);
  }
  assert.ok(!/gemini/i.test(controller), 'le controleur IA ne doit nommer aucun fournisseur');
});

test('les journaux du transport ne revelent aucun fournisseur', () => {
  const files = walk(path.join(SRC, 'providers'), (n) => n.endsWith('.ts'));
  const offenders = [];

  for (const file of files) {
    read(file)
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (!/console\.\w+\(/.test(line)) return;
        const at = `${relative(file)}:${index + 1}`;

        // Un journal sur plusieurs lignes echapperait a la lecture du libelle.
        if (!line.includes(');')) offenders.push(`${at}: journal multi-ligne`);
        if (/gemini/i.test(line)) offenders.push(`${at}: ${line.trim()}`);
      });
  }

  assert.deepEqual(offenders, [], 'aucun journal du transport ne doit nommer le fournisseur');
});

test('la surface publique du paquet ne nomme aucun fournisseur concret', () => {
  const api = require('../dist/index.js');
  const banned = ['GeminiAdapter', 'GeminiKeyManager', 'getKeyManager'];

  for (const symbol of banned) {
    assert.ok(!(symbol in api), `le paquet ne doit plus exporter ${symbol}`);
  }

  assert.equal(typeof api.getProviderKeyMetrics, 'function');
  assert.equal(typeof api.resetProviderKeys, 'function');
});

// --------------------------------------------------------------- packages

test('aucune dependance externe ajoutee sans necessite', () => {
  const manifest = JSON.parse(read(path.join(PKG, 'gnoxe-brains', 'package.json')));

  assert.deepEqual(manifest.dependencies, { '@eyano/types': '*' });
  assert.deepEqual(Object.keys(manifest.devDependencies), ['typescript']);
  assert.ok(!JSON.stringify(manifest).includes('genkit'));
});

test('packages/gnoxe-brains est le package courant', () => {
  const manifest = JSON.parse(read(path.join(PKG, 'gnoxe-brains', 'package.json')));

  assert.equal(manifest.name, '@eyano/gnoxe-brains');
  assert.ok(fs.existsSync(path.join(PKG, 'gnoxe-brains', 'src', 'index.ts')));
  assert.ok(fs.existsSync(path.join(PKG, 'gnoxe-brains', 'test')));
});

test('le renommage est complet : aucun ancien package ne subsiste', () => {
  const entries = fs.readdirSync(PKG);

  assert.ok(entries.includes('gnoxe-brains'), 'packages/gnoxe-brains doit exister');
  assert.ok(!entries.includes('ai'), "l'ancien repertoire du paquet ne doit plus exister");
  assert.ok(
    !entries.some((name) => name.includes('gnoxe') && name !== 'gnoxe-brains'),
    `aucun autre paquet ne doit porter le nom GnoxeBrains (trouve : ${entries.join(', ')})`
  );

  // Aucun repertoire "ai" residuel dans l'arbre des paquets (hors noms legitimes
  // comme ai.service, ai-requests, etc. qui sont des fichiers).
  const found = [];
  const stack = [PKG];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (!entry.isDirectory()) continue;
      const full = path.join(current, entry.name);
      if (entry.name === 'ai') found.push(full);
      stack.push(full);
    }
  }

  assert.deepEqual(found.map(relative), []);
});

// ---------------------------------------------------------- observabilite

test("l'observation n'accede a aucun contenu ni a aucun provider", () => {
  const files = walk(path.join(SRC, 'observability'), (n) => n.endsWith('.ts'));
  assert.ok(files.length >= 3, 'fichiers d observation introuvables');

  for (const file of files) {
    const content = read(file);
    const specs = [...content.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);

    for (const spec of specs) {
      assert.ok(
        spec.startsWith('./'),
        `${relative(file)} ne doit importer qu'un module d'observation (a obtenu "${spec}")`
      );
      assert.ok(
        !/(prompts|flows|missions|agents|tools|providers|core)/.test(spec),
        `${relative(file)} ne doit acceder a aucun contenu (a obtenu "${spec}")`
      );
    }

    assert.ok(!content.includes('fetch('), `${relative(file)} ne doit appeler aucun reseau`);
    assert.ok(!content.includes('console.'), `${relative(file)} ne doit pas logger en dur`);
    assert.ok(!content.includes('process.env'), `${relative(file)} ne doit lire aucune configuration`);
  }
});

test("la liste fermee des cles d'evenement ne contient aucune cle interdite", () => {
  const forbidden = new Set(FORBIDDEN_OBSERVATION_KEYS);

  for (const key of OBSERVATION_EVENT_KEYS) {
    assert.ok(!forbidden.has(key), `cle d'evenement interdite : ${key}`);
  }

  assert.equal(OBSERVATION_EVENT_KEYS.length, 13);
});

// --------------------------------------------------- migration de namespace

test("aucune reference active a l ancien nom de package", () => {
  const OLD_NAME = '@eyano/' + 'ai';
  const OLD_DIR = 'packages/' + 'ai';
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const nameRe = new RegExp(`${escape(OLD_NAME)}(?![A-Za-z0-9_-])`);
  const dirRe = new RegExp(`${escape(OLD_DIR)}(?![A-Za-z0-9_-])`);

  const textFiles = walk(
    ROOT,
    (name) =>
      /\.(ts|tsx|js|jsx|mjs|cjs|json|yml|yaml|sh|ps1|txt)$/i.test(name) ||
      name === 'Dockerfile' ||
      name === '.gitignore' ||
      name === '.dockerignore'
  );

  const offenders = [];
  for (const file of textFiles) {
    const lines = read(file).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (nameRe.test(lines[i]) || dirRe.test(lines[i])) {
        offenders.push(`${relative(file)}:${i + 1}: ${lines[i].trim()}`);
      }
    }
  }

  assert.deepEqual(offenders, [], 'le nom et le chemin ancien doivent avoir disparu du code');
});
