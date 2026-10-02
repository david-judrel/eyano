'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { EYANO_IDENTITY, buildEyanoContext } = require('../dist/index.js');

const CONTEXT = buildEyanoContext();
const SITUATIONS = EYANO_IDENTITY.situations;
const SECTION = '### Devant une situation';
const BANNED =
  /gemini|google|openai|anthropic|\bclaude\b|\bgpt\b|mistral|deepseek|copilot|\bgrok\b|\bvertex\b|\bpalm\b|bedrock/i;

/** Bloc rendu de la section, jusqu'a la section suivante. */
function sectionBlock() {
  const parts = CONTEXT.split(SECTION + '\n\n');
  assert.equal(parts.length, 2, 'la section situations est rendue une seule fois');
  return parts[1].split('\n\n')[0];
}

test('chaque situation relie un declenchement et une reaction', () => {
  assert.ok(SITUATIONS.length > 0, 'au moins une situation');

  for (const situation of SITUATIONS) {
    assert.equal(typeof situation.when, 'string', 'declenchement absent');
    assert.equal(typeof situation.then, 'string', 'reaction absente');
    assert.ok(situation.when.trim().length > 0, 'declenchement vide');
    assert.ok(situation.then.trim().length > 0, 'reaction vide');
  }
});

test('les declenchements et les reactions sont tous distincts', () => {
  const whens = SITUATIONS.map((s) => s.when);
  const thens = SITUATIONS.map((s) => s.then);

  assert.equal(new Set(whens).size, whens.length, 'deux situations se disputent le meme declenchement');
  assert.equal(new Set(thens).size, thens.length, 'deux situations imposent la meme reaction');
});

test('la composition Si X, Y forme une phrase complete', () => {
  for (const situation of SITUATIONS) {
    assert.equal(situation.when.endsWith('.'), false, `condition terminee : ${situation.when}`);
    assert.ok(situation.then.endsWith('.'), `reaction non terminee : ${situation.then}`);
  }
});

test('une reaction est un acte, pas une interdiction', () => {
  for (const situation of SITUATIONS) {
    assert.equal(/^\s*Ne\b/.test(situation.then), false, `interdiction detournee : ${situation.then}`);
    assert.equal(/\bjamais\b/i.test(situation.then), false, `regle negative : ${situation.then}`);
    assert.equal(/\btoujours\b/i.test(situation.then), false, `personnage fige : ${situation.then}`);
    assert.equal(/\btoujours\b/i.test(situation.when), false, `condition absolue : ${situation.when}`);
  }
});

test('les situations ne reecrivent ni les regles ni les limites', () => {
  const permanent = new Set([...EYANO_IDENTITY.behavioralRules, ...EYANO_IDENTITY.boundaries]);

  for (const situation of SITUATIONS) {
    assert.equal(permanent.has(situation.when), false, 'declenchement deja couvert');
    assert.equal(permanent.has(situation.then), false, 'reaction deja couverte');
  }
});

test('aucune situation ne nomme un backend', () => {
  const offenders = SITUATIONS.filter(
    (s) => BANNED.test(s.when) || BANNED.test(s.then)
  ).map((s) => s.when);

  assert.deepEqual(offenders, [], 'aucune mention de provider');
});

test('le contexte rend chaque situation exactement une fois', () => {
  const expected = SITUATIONS.map(
    (situation, index) => `${index + 1}. Si ${situation.when}, ${situation.then}`
  ).join('\n');

  assert.equal(sectionBlock(), expected, 'rendu fidele a la donnee');
});

test('la section se place entre les regles de conduite et les limites', () => {
  const rules = CONTEXT.indexOf('### Règles de conduite');
  const situations = CONTEXT.indexOf(SECTION);
  const limits = CONTEXT.indexOf('### Limites');

  assert.ok(rules !== -1 && situations !== -1 && limits !== -1, 'les trois sections existent');
  assert.ok(rules < situations, 'apres les regles permanentes');
  assert.ok(situations < limits, 'avant les limites dures');
});

test("l anti-recitation et les situations coexistent", () => {
  assert.equal(
    CONTEXT.includes('ne récite aucun texte mot pour mot'),
    true,
    'la consigne anti-recitation est toujours la'
  );
  assert.ok(
    EYANO_IDENTITY.behavioralRules.some((rule) => rule.includes('réciter')),
    'la regle permanente d anti-recitation est intacte'
  );
});

test("la frontiere souvenir / identite est inscrite dans les situations", () => {
  const whens = SITUATIONS.map((situation) => situation.when);

  assert.ok(
    whens.some((when) => when.includes('retrouver')),
    'aucune situation de rappel conversationnel'
  );
  assert.ok(
    whens.some((when) => when.includes('description de moi-même')),
    'aucune situation separant l identite du souvenir'
  );
  assert.ok(
    whens.some((when) => when.includes('distinguer un souvenir')),
    'aucune situation separant souvenir et deduction'
  );

  const recall = SITUATIONS.find((situation) => situation.when.includes('retrouver'));
  assert.ok(recall.then.includes('historique visible'), 'la fenetre visible n est pas nommee');
  assert.ok(recall.then.includes('je ne le trouve pas'), 'le trou de contexte n est pas nomme');
});

test("la validation injustifiee et le deplacement de faute sont couverts", () => {
  const contestation = SITUATIONS.find((situation) =>
    situation.when.includes("affirme que j'ai tort")
  );

  assert.ok(contestation, 'aucune situation de contestation');
  assert.ok(
    contestation.then.includes("maintenir l'harmonie"),
    'le motif harmonie n est pas explicitement exclu'
  );
  assert.ok(contestation.then.includes('je corrige le reste'), 'la correction manque');

  assert.ok(
    SITUATIONS.some((situation) => situation.when.includes("l'erreur vient de moi")),
    'le deplacement de responsabilite n est pas couvert'
  );
});
