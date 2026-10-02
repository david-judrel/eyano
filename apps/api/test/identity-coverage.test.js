'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src');
const BRAINS = '@eyano/gnoxe-brains';

/**
 * Points d'entree de generation qui ne sont pas des fonctions importees :
 * methodes appelees sur une instance de la facade.
 */
const METHOD_MARKERS = [/\.answer\s*\(/, /\.answerStream\s*\(/, /\.run\s*\(/];

/**
 * Exemptions legitimement sans voix.
 *
 * Chaque entree nomme LE fichier et LE motif appele, plus une raison.
 * Une exemption dont plus aucun appel ne correspond est un reste a purger :
 * le test `aucune exemption n est devenue obsolete` la detecte.
 */
const EXEMPTIONS = [
  {
    file: 'modules/ai/ai.service.ts',
    marker: /\btitleFlow\s*\(/,
    why: "metadonnee d'interface : le titre est un libelle, pas une prise de parole",
  },
  {
    file: 'modules/missions/missions.controller.ts',
    marker: /\.run\s*\(/,
    why: 'relais HTTP vers MissionsService : la generation a lieu dans missions.service',
  },
  {
    file: 'modules/image/image.service.ts',
    marker: /\bimageFlow\s*\(/,
    why: "Kepler Image : le prompt decrit une image a produire, ce n'est pas une prise de parole d'Eyano",
  },
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

function relative(file) {
  return path.relative(SRC, file).split(path.sep).join('/');
}

/**
 * Retire les commentaires avant recensement : une mention de `run()` dans
 * une JSDoc n'est pas un appel. Les lignes de commentaire sont remplacees
 * par une ligne vide, jamais supprimees, afin de conserver les numeros.
 */
function stripComments(content) {
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*/')
      ) {
        return '';
      }
      return line.replace(/(^|[^:])\/\/.*$/, '$1');
    })
    .join('\n');
}

function sources() {
  return walk(SRC).map((file) => ({ file: relative(file), content: stripComments(fs.readFileSync(file, 'utf8')) }));
}

/**
 * Symboles de type flow importes depuis le cerveau, partout dans `apps/api`.
 *
 * La liste des portes d'entree se derive des IMPORTS : importer un nouveau
 * `...Flow` le rend immellement soumis au recensement, sans toucher a ce
 * fichier. C'est ce qui rend le tripwire durable.
 */
function importedFlowNames() {
  const names = new Set();
  const importRe = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']*)'/g;

  for (const { content } of sources()) {
    let match;
    while ((match = importRe.exec(content)) !== null) {
      if (match[2] !== BRAINS) continue;
      for (const raw of match[1].split(',')) {
        const name = raw
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          .trim();
        if (name.includes('Flow')) names.add(name);
      }
    }
  }

  return [...names];
}

function markers() {
  return [
    ...importedFlowNames().map((name) => new RegExp('\\b' + name + '\\s*\\(')),
    ...METHOD_MARKERS,
  ];
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

function blockOf(content, openIndex) {
  let depth = 0;
  let i = openIndex;
  for (; i < content.length; i += 1) {
    if (content[i] === '(') depth += 1;
    else if (content[i] === ')') {
      depth -= 1;
      if (depth === 0) return content.slice(openIndex + 1, i);
    }
  }
  return content.slice(openIndex + 1);
}

/** Recense toutes les portes d'entree de generation de `apps/api`. */
function discover() {
  const calls = [];
  const patterns = markers();

  for (const { file, content } of sources()) {
    for (const marker of patterns) {
      const re = new RegExp(marker.source, 'g');
      let match;
      while ((match = re.exec(content)) !== null) {
        const open = content.indexOf('(', match.index);
        calls.push({
          file,
          line: lineOf(content, match.index),
          snippet: content.slice(match.index, open + 1).replace(/\s+/g, ' ').trim(),
          marker,
          block: open === -1 ? '' : blockOf(content, open),
        });
      }
    }
  }

  return calls;
}

function exemptionFor(call) {
  return EXEMPTIONS.find(
    (entry) => entry.file === call.file && entry.marker.source === call.marker.source
  );
}

const FLOW_NAMES = importedFlowNames();
const CALLS = discover();

test('le recensement est bien derive des imports du cerveau', () => {
  assert.ok(FLOW_NAMES.includes('chatFlow'), 'chatFlow importe');
  assert.ok(FLOW_NAMES.includes('chatFlowSync'), 'chatFlowSync importe');
  assert.ok(FLOW_NAMES.includes('titleFlow'), 'titleFlow importe');
  assert.ok(FLOW_NAMES.length >= 3, `flows importes introuvables (${FLOW_NAMES.length})`);
});

test('des portes d entree de generation sont bien recensees', () => {
  assert.ok(CALLS.length >= 4, `portes d entree introuvables (${CALLS.length})`);

  const files = new Set(CALLS.map((call) => call.file));
  assert.ok(files.has('modules/ai/ai.service.ts'));
  assert.ok(files.has('modules/whatsapp/whatsapp.service.ts'));
  assert.ok(files.has('modules/missions/missions.service.ts'));
});

test('chaque porte d entree a la voix d Eyano ou une exemption motivee', () => {
  const failures = [];

  for (const call of CALLS) {
    if (/\bsystemPrompt\s*:/.test(call.block)) continue;

    const exemption = exemptionFor(call);
    if (exemption) {
      assert.ok(exemption.why.trim().length > 0, `exemption sans motif : ${exemption.file}`);
      continue;
    }

    failures.push(`${call.file}:${call.line}  ${call.snippet}`);
  }

  assert.deepEqual(failures, [], 'portes d entree sans voix ni exemption :\n' + failures.join('\n'));
});

test('aucune exemption n est devenue obsolete', () => {
  const stale = EXEMPTIONS.filter(
    (entry) =>
      !CALLS.some((call) => call.file === entry.file && call.marker.source === entry.marker.source)
  ).map((entry) => `${entry.file} :: ${entry.marker.source}`);

  assert.deepEqual(stale, [], 'exemptions qui ne correspondent plus a aucun appel');
});

test('les exemptions portent une raison lisible', () => {
  for (const entry of EXEMPTIONS) {
    assert.ok(entry.why.trim().length > 20, `motif trop court : ${entry.file}`);
    assert.equal(typeof entry.marker, 'object');
    assert.ok(entry.file.endsWith('.ts'));
  }
});

test('meme exemptee, la voix reste disponible pour la couche superieure', () => {
  const aiService = fs.readFileSync(path.join(SRC, 'modules', 'ai', 'ai.service.ts'), 'utf8');
  const missions = fs.readFileSync(path.join(SRC, 'modules', 'missions', 'missions.service.ts'), 'utf8');

  assert.ok(
    aiService.includes("'@eyano/eyano-identity'"),
    'ai.service reste en mesure de fournir la voix'
  );
  assert.ok(
    missions.includes("'@eyano/eyano-identity'"),
    'missions.service reste en mesure de fournir la voix'
  );
});
