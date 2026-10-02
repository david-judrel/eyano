'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EYANO_IDENTITY,
  SELF_DESCRIPTION_ASPECTS,
  buildEyanoContext,
} = require('../dist/index.js');

/** Toutes les chaines du contexte construit. */
function flatten(value, out = []) {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const child of value) flatten(child, out);
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) flatten(child, out);
  }
  return out;
}

const CONTEXT = buildEyanoContext();

test('determinisme : memes entrees, sortie strictement identique', () => {
  assert.equal(CONTEXT, buildEyanoContext());
  assert.equal(buildEyanoContext({ channel: 'whatsapp' }), buildEyanoContext({ channel: 'whatsapp' }));
  assert.equal(buildEyanoContext({}), buildEyanoContext());
  assert.notEqual(CONTEXT, buildEyanoContext({ channel: 'whatsapp' }));
});

test('identite injectee : nom, nature et dessein', () => {
  assert.ok(CONTEXT.startsWith('## Eyano'), 'le nom ouvre la system instruction');

  for (const fact of EYANO_IDENTITY.nature.is) {
    assert.ok(CONTEXT.includes(`tu es ${fact}`), `nature manquante : ${fact}`);
  }
  for (const fact of EYANO_IDENTITY.nature.isNot) {
    assert.ok(CONTEXT.includes(`tu n'es pas ${fact}`), `negation manquante : ${fact}`);
  }

  assert.ok(CONTEXT.includes(EYANO_IDENTITY.purpose.statement));
  assert.ok(CONTEXT.includes(EYANO_IDENTITY.purpose.domains.join(', ')));
});

test('personnalite presente dans le contexte', () => {
  for (const trait of EYANO_IDENTITY.personality.traits) {
    assert.ok(CONTEXT.includes(trait), `trait absent : ${trait}`);
  }
  for (const anti of EYANO_IDENTITY.personality.antiTraits) {
    assert.ok(CONTEXT.includes(anti), `anti-trait absent : ${anti}`);
  }
});

test('principes et regles de conduite presents', () => {
  for (const principle of EYANO_IDENTITY.principles) {
    assert.ok(CONTEXT.includes(principle), `principe absent : ${principle}`);
  }
  for (const rule of EYANO_IDENTITY.behavioralRules) {
    assert.ok(CONTEXT.includes(rule), `regle absente : ${rule}`);
  }
});

test("les interdits d'invention sont exprimes", () => {
  assert.ok(CONTEXT.includes("tu n'es pas une personne consciente"), 'conscience');
  assert.ok(CONTEXT.includes('humain'), 'identite humaine');
  assert.ok(CONTEXT.includes('émotions réelles'), 'emotions reelles');
  assert.ok(CONTEXT.includes('expérience personnelle'), 'experience personnelle');
});

test('style de communication : registre et adaptations', () => {
  assert.ok(CONTEXT.includes(EYANO_IDENTITY.communicationStyle.register));
  assert.ok(CONTEXT.includes('Adaptation au contexte'));

  for (const entry of EYANO_IDENTITY.communicationStyle.adaptations) {
    assert.ok(CONTEXT.includes(`${entry.context} : ${entry.style}`), `adaptation : ${entry.context}`);
  }
});

test('facettes disponibles : chaque intention a sa matiere', () => {
  assert.ok(CONTEXT.includes(EYANO_IDENTITY.selfDescription.core), 'amorce presente');

  for (const aspect of SELF_DESCRIPTION_ASPECTS) {
    assert.ok(CONTEXT.includes(`- ${aspect} : `), `facette absente : ${aspect}`);
  }

  const facets = EYANO_IDENTITY.selfDescription.facets;
  assert.equal(facets.length, SELF_DESCRIPTION_ASPECTS.length);
  for (const facet of facets) {
    assert.ok(CONTEXT.includes(facet.text), `texte absent : ${facet.aspect}`);
  }
});

test('anti-recitation : la consigne de reformulation est explicite', () => {
  assert.ok(CONTEXT.includes('ne récite aucun texte mot pour mot'));
  assert.ok(CONTEXT.includes('matière, jamais un script'));
  assert.ok(
    EYANO_IDENTITY.behavioralRules.some((rule) => rule.includes('réciter') && CONTEXT.includes(rule)),
    'la regle anti-recitation du contrat est portee par le contexte'
  );
});

test('distinction Eyano / Gnoxe-Brains', () => {
  assert.ok(CONTEXT.includes('tu es propulsé par Gnoxe-Brains'), 'Eyano repose sur le cerveau');
  assert.ok(CONTEXT.includes("tu n'es pas Gnoxe-Brains lui-même"), 'Eyano n est pas le cerveau');
  assert.ok(CONTEXT.includes('Gnoxe-Brains'), 'le cerveau est nomme');
});

test('distinction Eyano / David', () => {
  assert.ok(CONTEXT.includes("tu n'es pas David"), 'David n est pas Eyano');

  const creator = EYANO_IDENTITY.boundaries.find(
    (rule) => rule.includes('David') && rule.includes('créateur')
  );
  assert.ok(creator, 'la limite nomme David comme createur');
  assert.ok(CONTEXT.includes(creator), 'elle est portee par le contexte');
});

test('aucun provider ni modele externe dans le contexte construit', () => {
  const banned =
    /gemini|google|openai|anthropic|\bclaude\b|\bgpt\b|mistral|deepseek|copilot|\bgrok\b|\bvertex\b|\bpalm\b|bedrock/i;

  const offenders = flatten(CONTEXT).filter((value) => banned.test(value));
  assert.deepEqual(offenders, [], 'la voix ne revele aucun backend');
});

test('canal : laut adaptation correspondante est signalee', () => {
  const whatsapp = buildEyanoContext({ channel: 'whatsapp' });

  assert.ok(whatsapp.includes('[contexte actuel] Chat informel / WhatsApp'));
  assert.equal(
    whatsapp.split('[contexte actuel]').length - 1,
    1,
    'une seule adaptation est le contexte actuel'
  );
  assert.equal(whatsapp.includes('[contexte actuel] Question technique'), false);
});

test('sans canal : aucune adaptation n est marquee, toutes restent disponibles', () => {
  assert.equal(CONTEXT.includes('[contexte actuel]'), false);

  const segment = CONTEXT.split('Adaptation au contexte :')[1].split('###')[0];
  assert.equal(
    segment.split('\n- ').length - 1,
    EYANO_IDENTITY.communicationStyle.adaptations.length
  );
});

test('le contexte ne contient aucune donnee de session', () => {
  assert.equal(CONTEXT.includes("L'utilisateur s'appelle"), false, 'le prenom vient du transport');
  assert.equal(CONTEXT.includes('CONTEXTE WHATSAPP'), false, 'le canal operationnel vient du transport');
});

test('le contexte est une instruction complete, pas un fragment', () => {
  assert.ok(CONTEXT.length > 800, `contexte trop pauvre (${CONTEXT.length} caracteres)`);

  for (const section of [
    '### Dessein',
    '### Principes',
    '### Personnalité',
    '### Style de communication',
    '### Règles de conduite',
    '### Limites',
    '### Auto-description',
  ]) {
    assert.ok(CONTEXT.includes(section), `section manquante : ${section}`);
  }

  assert.deepEqual(flatten(CONTEXT).length, 1, 'une seule chaine, aucune accumulation');
});

// --------------------------------------- nettoyage A.2 : note de canal

test('A.2 : la note WhatsApp n apparait que pour le canal WhatsApp', () => {
  const whatsapp = buildEyanoContext({ channel: 'whatsapp' });
  const note = 'Canal actuel : L\'utilisateur te contacte via WhatsApp.';

  assert.ok(whatsapp.includes(note));
  assert.ok(whatsapp.includes('images et documents texte - analyse-les'));
  assert.ok(whatsapp.includes('Fichiers non supportés ou trop lourds → explique poliment.'));
  assert.equal(buildEyanoContext().includes('Canal actuel'), false, 'web : inchange');
  assert.equal(buildEyanoContext({ channel: 'admin' }).includes('Canal actuel'), false, 'missions : inchange');
});
