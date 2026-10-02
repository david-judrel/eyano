'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { EYANO_IDENTITY, SELF_DESCRIPTION_ASPECTS, buildEyanoContext } = require('../dist/index.js');

const CONTEXT = buildEyanoContext();
const FACETS = EYANO_IDENTITY.selfDescription.facets;
const TABLE_HEADER = 'Intention -> facette :';

/** Bloc de la table intention -> facette, jusqu'a la section suivante. */
function tableBlock() {
  const parts = CONTEXT.split(TABLE_HEADER + '\n');
  assert.equal(parts.length, 2, 'la table intention -> facette est rendue une seule fois');
  return parts[1].split('\n\n')[0];
}

/** Lignes de la table, sous la forme `{ intent, aspect }`. */
function tableRows() {
  return tableBlock()
    .split('\n')
    .filter((line) => line.startsWith('- « '))
    .map((line) => {
      const match = line.match(/^- « (.+) » -> (\S+)$/);
      assert.ok(match, `ligne de table mal forme : ${line}`);
      return { intent: match[1], aspect: match[2] };
    });
}

test("chaque facette declare l'intention qui la declenche", () => {
  assert.equal(FACETS.length, SELF_DESCRIPTION_ASPECTS.length);

  for (const facet of FACETS) {
    assert.equal(typeof facet.intent, 'string', `${facet.aspect} : intention absente`);
    assert.ok(facet.intent.trim().length > 0, `${facet.aspect} : intention vide`);
  }
});

test('les intentions sont toutes distinctes', () => {
  const intents = FACETS.map((facet) => facet.intent);
  assert.equal(new Set(intents).size, intents.length, 'deux facettes ne peuvent pas se disputer');
});

test('chaque intention est une question, et rien d autre', () => {
  for (const facet of FACETS) {
    assert.ok(facet.intent.endsWith('?'), `${facet.aspect} : ce n'est pas une question`);
    assert.ok(facet.intent.split(' ').length <= 12, `${facet.aspect} : intention trop longue`);
  }
});

test('une intention ne repond pas a elle-meme', () => {
  for (const facet of FACETS) {
    assert.equal(
      facet.intent.includes(facet.text.slice(0, 40)),
      false,
      `${facet.aspect} : l'intention contient deja la reponse`
    );
    assert.notEqual(facet.intent, EYANO_IDENTITY.selfDescription.core);
  }
});

test('aucune intention ne nomme un backend', () => {
  const banned =
    /gemini|google|openai|anthropic|\bclaude\b|\bgpt\b|mistral|deepseek|copilot|\bgrok\b|\bvertex\b|\bpalm\b|bedrock/i;

  const offenders = FACETS.filter((facet) => banned.test(facet.intent)).map((f) => f.aspect);
  assert.deepEqual(offenders, [], 'la question ne revele aucun backend');
});

test('le contexte rend la table intention -> facette', () => {
  assert.ok(CONTEXT.includes(TABLE_HEADER), 'en-tete present');

  const rows = tableRows();
  assert.equal(
    rows.length,
    SELF_DESCRIPTION_ASPECTS.length,
    'exactement une ligne par intention'
  );
});

test('la table couvre exactement les facettes, sans orphelin', () => {
  const rows = tableRows();

  assert.deepEqual(
    rows.map((row) => row.aspect).sort(),
    SELF_DESCRIPTION_ASPECTS.slice().sort(),
    'chaque facette est atteignable, ni plus ni moins'
  );
  assert.equal(
    new Set(rows.map((row) => row.aspect)).size,
    rows.length,
    'aucune facette pointee deux fois'
  );
});

test('chaque intention pointe vers la facette qui porte cette intention', () => {
  const rows = tableRows();
  const byAspect = new Map(FACETS.map((facet) => [facet.aspect, facet.intent]));

  for (const row of rows) {
    assert.equal(row.intent, byAspect.get(row.aspect), `table erronee pour ${row.aspect}`);
  }
});

test('la decision est rendue avant la matiere', () => {
  const table = CONTEXT.indexOf(TABLE_HEADER);
  const material = CONTEXT.indexOf('- essence : ');

  assert.ok(table !== -1, 'table presente');
  assert.ok(material !== -1, 'facettes presentes');
  assert.ok(table < material, 'le modele choisit avant de lire les reformulations');
});

test('l amorce reste distincte de la table', () => {
  const core = EYANO_IDENTITY.selfDescription.core;

  assert.ok(CONTEXT.includes(`Amorce : ${core}`), 'amorce rendue');
  assert.equal(tableBlock().includes(core), false, "l'amorce n'est pas une entree de decision");
  assert.equal(
    CONTEXT.includes('ne récite aucun texte mot pour mot'),
    true,
    'la consigne anti-recitation encadre toujours la table'
  );
});
