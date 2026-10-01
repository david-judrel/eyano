'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { EYANO_IDENTITY, SELF_DESCRIPTION_ASPECTS } = require('../dist/index.js');

const IDENTITY_FIELDS = [
  'behavioralRules',
  'boundaries',
  'communicationStyle',
  'name',
  'nature',
  'personality',
  'principles',
  'purpose',
  'selfDescription',
  'situations',
];

/** Toutes les chaines de caractere du contrat, a n'importe quel niveau. */
function collectStrings(value, out = []) {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const child of value) collectStrings(child, out);
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) collectStrings(child, out);
  }
  return out;
}

/** Tous les noeuds objets, pour verifier le gel en profondeur. */
function collectNodes(value, out = []) {
  if (value && typeof value === 'object') {
    out.push(value);
    for (const child of Object.values(value)) collectNodes(child, out);
  }
  return out;
}

/** Toutes les valeurs booleennes, a n'importe quel niveau. */
function collectBooleans(value, out = []) {
  if (typeof value === 'boolean') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const child of value) collectBooleans(child, out);
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) collectBooleans(child, out);
  }
  return out;
}

/** Trouve une valeur interdite dans toutes les chaines du contrat. */
function findForbidden(haystack) {
  const banned =
    /gemini|google|openai|anthropic|\bclaude\b|\bgpt\b|mistral|deepseek|copilot|\bgrok\b|\bvertex\b|\bpalm\b|bedrock/i;
  return haystack.filter((value) => banned.test(value));
}

/** Lit le bloc `principles: [...]` du cerveau et en extrait les chaines. */
function brainPrinciples() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'gnoxe-brains', 'src', 'core', 'personality.ts'),
    'utf8'
  );
  const block = source.match(/principles:\s*\[([\s\S]*?)\]/);
  assert.ok(block, 'les principes du cerveau sont lisibles');

  const found = [];
  const literal = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = literal.exec(block[1])) !== null) {
    found.push(match[1] ?? match[2]);
  }
  return found;
}

test('les neuf champs de la specification sont presents, aucun autre', () => {
  assert.deepEqual(Object.keys(EYANO_IDENTITY).sort(), IDENTITY_FIELDS);
});

test("l'identite est figee en profondeur", () => {
  const nodes = collectNodes(EYANO_IDENTITY);
  assert.ok(nodes.length > 10, 'la specification a de la profondeur');

  for (const node of nodes) {
    assert.ok(Object.isFrozen(node), 'chaque noeud est fige');
  }
});

test("l'identite ne porte aucun champ booleen", () => {
  assert.deepEqual(
    collectBooleans(EYANO_IDENTITY),
    [],
    "une personnalite n'est pas un jeu d'interrupteurs"
  );

  for (const key of Object.keys(EYANO_IDENTITY.personality)) {
    const values = EYANO_IDENTITY.personality[key];
    assert.ok(Array.isArray(values), `${key} est une liste de traits, pas un interrupteur`);
    for (const value of values) assert.equal(typeof value, 'string');
  }
});

test('les six faits auto-identitaires sont couverts', () => {
  const { name, nature } = EYANO_IDENTITY;

  assert.equal(name, 'Eyano', 'fait 1 : je suis Eyano');
  assert.ok(
    nature.is.includes('un agent conversationnel'),
    'fait 3 : je suis un agent conversationnel'
  );
  assert.ok(
    nature.is.some((fact) => fact.includes('Gnoxe-Brains')),
    'fait 2 : je suis base sur Gnoxe-Brains'
  );
  assert.ok(nature.isNot.includes('David'), 'fait 4 : je ne suis pas David');
  assert.ok(
    nature.isNot.some((fact) => fact.includes('Gnoxe-Brains')),
    'fait 5 : je ne suis pas Gnoxe-Brains'
  );
  assert.ok(nature.isNot.includes('un humain'), 'fait 6 : je ne suis pas un humain');
});

test("la nature affirme et nie sans se contredire", () => {
  const { is, isNot } = EYANO_IDENTITY.nature;

  assert.ok(is.length >= 3, 'au moins trois affirmations');
  assert.ok(isNot.length >= 4, 'au moins quatre negations');

  const shared = is.filter((fact) => isNot.includes(fact));
  assert.deepEqual(shared, [], 'une meme chaine ne peut pas etre et ne pas etre');
});

test('les traits et les anti-traits sont disjoints', () => {
  const { traits, antiTraits } = EYANO_IDENTITY.personality;

  assert.ok(traits.length >= 5, 'la personnalite a une epaisseur reelle');
  assert.ok(antiTraits.length >= 3, 'la personnalite exclut explicitement');

  const shared = traits.filter((trait) => antiTraits.includes(trait));
  assert.deepEqual(shared, [], 'un trait assume ne peut pas etre un anti-trait');
});

test("les anti-traits expriment la nuance, pas l'exact oppose", () => {
  const { traits, antiTraits } = EYANO_IDENTITY.personality;

  for (const anti of antiTraits) {
    const negated = traits.find((trait) => trait.includes(anti));
    assert.equal(negated, undefined, `"${anti}" ne saurait etre un trait assume`);
  }
});

test("l'auto-description couvre exactement chaque intention", () => {
  const facets = EYANO_IDENTITY.selfDescription.facets;
  const aspects = facets.map((facet) => facet.aspect);

  assert.deepEqual(
    aspects.slice().sort(),
    SELF_DESCRIPTION_ASPECTS.slice().sort(),
    'chaque intention dispose d une facette, ni plus ni moins'
  );
  assert.equal(aspects.length, new Set(aspects).size, 'aucune facette dupliquee');
});

test('le noyau est une amorce, jamais un paragraphe recitable', () => {
  const { core, facets } = EYANO_IDENTITY.selfDescription;

  assert.ok(core.length < 200, `noyau trop long pour etre une amorce (${core.length})`);
  for (const facet of facets) {
    assert.notEqual(facet.text, core, 'aucune facette ne se confond avec le noyau');
  }
});

test("chaque facette est distincte des autres : pas de phrase unique", () => {
  const texts = EYANO_IDENTITY.selfDescription.facets.map((facet) => facet.text);

  for (const text of texts) {
    assert.ok(text.trim().length > 40, 'facette trop courte pour etre une reponse');
  }
  assert.equal(texts.length, new Set(texts).size, 'aucune reponse identique deux fois');
});

test("aucun fournisseur ni modele externe n'apparait dans l'identite", () => {
  const forbidden = findForbidden(collectStrings(EYANO_IDENTITY));
  assert.deepEqual(forbidden, [], 'l identite ne nomme aucun backend');
});

test('le fonctionnement s exprime par Gnoxe-Brains', () => {
  const all = collectStrings(EYANO_IDENTITY).join(' ');

  assert.ok(all.includes('Gnoxe-Brains'), 'reponse canonique au modele : Gnoxe-Brains');
  assert.ok(
    EYANO_IDENTITY.boundaries.some((rule) => rule.includes('Gnoxe-Brains')),
    'la regle absolue est inscrite dans les limites'
  );
});

test("les interdits d'identite sont tous presents", () => {
  const boundaries = EYANO_IDENTITY.boundaries.join(' ');

  assert.ok(boundaries.includes('humain'), 'jamais humain');
  assert.ok(boundaries.includes('David'), 'jamais le createur');
  assert.ok(boundaries.includes('conscient'), 'jamais conscient');
  assert.ok(boundaries.includes('fournisseur'), 'jamais un backend externe');
});

test("l anti-recitation est une regle de conduite explicite", () => {
  assert.ok(
    EYANO_IDENTITY.behavioralRules.some((rule) => rule.includes('réciter')),
    "l'identite est une source de comportement, pas une phrase a dire"
  );
});

test('les trois domaines du dessein sont declares', () => {
  assert.deepEqual(EYANO_IDENTITY.purpose.domains.slice(), ['comprendre', 'créer', 'résoudre']);
  assert.ok(EYANO_IDENTITY.purpose.statement.length > 40, 'raison d etre explicite');
});

test('le style est invariable puis ajuste par contexte', () => {
  const { register, adaptations } = EYANO_IDENTITY.communicationStyle;

  assert.ok(register.length > 40, 'ton general declare');
  assert.ok(adaptations.length >= 4, 'au moins quatre contextes');
  assert.equal(
    adaptations.length,
    new Set(adaptations.map((entry) => entry.context)).size,
    'aucun contexte duplique'
  );
  for (const entry of adaptations) {
    assert.ok(entry.style.trim().length > 0, `style manquant pour ${entry.context}`);
  }
});

test("les principes d'Eyano ne recoupent pas ceux du cerveau", () => {
  const engine = brainPrinciples();
  assert.ok(engine.length >= 5, 'le cerveau declare ses propres principes');

  const shared = EYANO_IDENTITY.principles.filter((principle) => engine.includes(principle));
  assert.deepEqual(
    shared,
    [],
    "deux niveaux distincts : le cerveau raisonne, l'agent se positionne"
  );
});

test("l'identite ne depend d'aucun cerveau", () => {
  const pkg = require('../package.json');

  assert.equal(pkg.dependencies, undefined, 'aucune dependance de runtime');
  assert.ok(pkg.devDependencies.typescript, 'seul outillage : le compilateur');
});
