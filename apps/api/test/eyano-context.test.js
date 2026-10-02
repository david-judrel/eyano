'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src');
const VOICE_FILES = ['modules/ai/ai.service.ts', 'modules/whatsapp/whatsapp.service.ts'];

function read(relative) {
  return fs.readFileSync(path.join(SRC, relative), 'utf8');
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

test('apps/api construit la system instruction depuis le moteur Eyano', () => {
  for (const file of VOICE_FILES) {
    const content = read(file);
    assert.ok(content.includes("from '@eyano/eyano-identity'"), `${file} importe le moteur`);
    assert.ok(content.includes('buildEyanoContext'), `${file} appelle le moteur`);
  }
});

test('chaque tour de conversation fournit systemPrompt', () => {
  for (const file of VOICE_FILES) {
    const content = read(file);
    const calls = content.match(/chatFlow(Sync)?\s*\(\s*\{/g) || [];
    const injections = content.split('systemPrompt: buildEyanoContext').length - 1;

    assert.ok(calls.length > 0, `${file} pilote un tour de conversation`);
    assert.equal(injections, calls.length, `${file} : systemPrompt manquant sur un appel`);
  }
});

test('la voix est produite par le moteur, jamais ecrite en dur', () => {
  for (const file of VOICE_FILES) {
    const content = read(file);
    assert.equal(
      /systemPrompt:\s*['"`]/.test(content),
      false,
      `${file} : la system instruction doit venir de buildEyanoContext`
    );
  }

  const hardcoded = [/Je suis Eyano/, /cre[ée]e? par David/, /une IA cre/];
  for (const file of walk(SRC)) {
    const content = fs.readFileSync(file, 'utf8');
    const name = path.relative(SRC, file).split(path.sep).join('/');

    for (const pattern of hardcoded) {
      assert.equal(
        pattern.test(content),
        false,
        `${name} ne doit pas coder une reponse identitaire en dur`
      );
    }
  }
});
