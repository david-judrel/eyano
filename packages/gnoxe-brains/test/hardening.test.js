'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_GNOXE_BRAINS_CONFIG,
  getAIProvider,
  setAIProvider,
  getActiveProviderName,
  GnoxeBrainsProvider,
} = require('../dist/index.js');

const SRC = path.join(__dirname, '..', 'src');

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', '.git']);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(full));
    } else if (entry.name.endsWith('.ts')) {
      found.push(full);
    }
  }

  return found;
}

function read(relative) {
  return fs.readFileSync(path.join(SRC, relative), 'utf8');
}

/** Code seul : une documentation qui declare l'absence d'un champ ne compte pas. */
function stripComments(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');
}

function codeOf(relative) {
  return stripComments(read(relative));
}

function occurrences(files, token) {
  return files.filter((file) => stripComments(fs.readFileSync(file, 'utf8')).includes(token));
}

function relative(file) {
  return path.relative(SRC, file).split(path.sep).join('/');
}

test('la configuration ne porte aucun parametre d execution', () => {
  assert.deepEqual(
    Object.keys(DEFAULT_GNOXE_BRAINS_CONFIG).sort(),
    ['defaultModel', 'maxContextMessages', 'missionTimeoutMs'],
    'la configuration ne contient ni temperature ni budget de tokens'
  );

  const config = codeOf('core/config.ts');
  assert.ok(!/emperature/.test(config), 'aucune temperature dans le code');
  assert.ok(!/maxTokens/.test(config), 'aucun budget de tokens');
  assert.ok(
    Object.isFrozen(DEFAULT_GNOXE_BRAINS_CONFIG),
    'les valeurs par defaut restent figees'
  );
});

test('aucune reference a un parametre d execution disparu ne subsiste', () => {
  const offenders = occurrences(walk(SRC), 'defaultTemperature').map(relative);

  assert.deepEqual(
    offenders,
    [],
    'un champ retire de la configuration ne doit plus etre reference'
  );
});

test('la compatibilite legacy AIProvider est conservee', () => {
  for (const [name, value] of Object.entries({
    getAIProvider,
    setAIProvider,
    getActiveProviderName,
    GnoxeBrainsProvider,
  })) {
    assert.equal(typeof value, 'function', `${name} reste exporte et fonctionnel`);
  }

  assert.ok(
    codeOf('providers/index.ts').includes('AIProvider'),
    'le contrat AIProvider reste declare pour ses consommateurs'
  );
  assert.ok(
    typeof getActiveProviderName === 'function',
    'le point d entree consomme par apps/api repond'
  );
});

test('les deux conventions d erreur coexistent sans se confondre', () => {
  const agents = codeOf('agents/agent.ts');
  const reliability = codeOf('core/execution-reliability.ts');

  assert.ok(
    !agents.includes('ProviderExecutionError'),
    'le chemin mission ne requalifie pas : identite et code metier preserves'
  );
  assert.ok(
    agents.includes('markDependencyError'),
    'le chemin mission marque la dependance sans changer le type'
  );
  assert.ok(
    reliability.includes('class ProviderExecutionError'),
    'le chemin facade qualifie avec un code moteur deterministe'
  );
});

test('les agents n emettent aucun parametre d execution', () => {
  const files = walk(path.join(SRC, 'agents'));

  assert.ok(files.length >= 5, 'les quatre agents plus la base');
  assert.deepEqual(
    occurrences(files, 'temperature').map(relative),
    [],
    'sans parametre transmis, la police d execution n a rien a valider ici'
  );
  assert.deepEqual(occurrences(files, 'maxTokens').map(relative), []);
});
