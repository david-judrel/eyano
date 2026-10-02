'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { GnoxeBrains, MissionEngine, Orchestrator, createDefaultExecutor } = require('../dist/index.js');

const SRC = path.join(__dirname, '..', 'src');
const ORCHESTRATOR_DIR = path.join(SRC, 'orchestrator');

/** Backend concrets qui ne doivent jamais apparaitre dans la couche de controle. */
const FORBIDDEN = [
  'GeminiAdapter',
  'gemini-adapter',
  'gemini.adapter',
  'gemini.provider',
  'GeminiKeyManager',
  'Genkit',
  'genkit',
  '@genkit-ai',
  'Google',
  'googleai',
  'GEMINI_API_KEY',
  'providers/bootstrap',
  'providers/gemini',
];

function listSources(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listSources(full);
      return entry.name.endsWith('.ts') ? [full] : [];
    });
}

test("l'Orchestrator n'importe aucun provider concret", () => {
  const files = listSources(ORCHESTRATOR_DIR);
  assert.ok(files.length >= 2, 'fichiers orchestrator introuvables');

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const token of FORBIDDEN) {
      assert.ok(
        !content.includes(token),
        `${path.relative(SRC, file)} ne doit pas contenir "${token}"`
      );
    }
  }
});

test('la facade GnoxeBrains reste exempee de provider concret', () => {
  const content = fs.readFileSync(path.join(SRC, 'core', 'gnoxe-brains.ts'), 'utf8');
  for (const token of FORBIDDEN) {
    assert.ok(!content.includes(token), `core/gnoxe-brains.ts ne doit pas contenir "${token}"`);
  }
});

test('core/defaults.ts est le seul point qui resolve un provider', () => {
  const offenders = listSources(SRC)
    .filter((file) => !file.includes(`${path.sep}providers${path.sep}`))
    .filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      return content.includes("from '../providers/bootstrap'") || content.includes('gemini-adapter');
    })
    .map((file) => path.relative(SRC, file).replace(/\\/g, '/'));

  assert.deepEqual(offenders, ['core/defaults.ts']);
});

test('GnoxeBrains assemble un Orchestrator par defaut (pas de executor fantome)', () => {
  const executor = createDefaultExecutor({ engine: new MissionEngine() });

  assert.ok(executor instanceof Orchestrator);
  assert.deepEqual(
    executor.listAgents().map((a) => a.id),
    ['research', 'analysis', 'verification', 'writer']
  );

  const brains = new GnoxeBrains();
  assert.ok(brains instanceof GnoxeBrains);
});
