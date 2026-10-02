'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  EYANO_IDENTITY,
  SELF_DESCRIPTION_ASPECTS,
  buildEyanoContext,
} = require('@eyano/eyano-identity');

const { BATTERY } = require('../scripts/smoke/battery');
const { SCENARIOS } = require('../scripts/smoke/scenarios');
const { BANNED, scanRevelation } = require('../scripts/smoke/detect');

const API_ROOT = path.join(__dirname, '..');
const HARNESS = path.join(API_ROOT, 'scripts', 'smoke.js');
const HARNESS_SOURCE = fs.readFileSync(HARNESS, 'utf8');

const CHAT_CONTEXT = buildEyanoContext();
const MISSION_CONTEXT = buildEyanoContext({ channel: 'admin' });

const GUIDES = new Set(BATTERY.map((entry) => entry.id));

/** Marqueur que le contexte doit contenir pour que le guide soit gouverne. */
function markerFor(guide) {
  if (guide.kind === 'facet') return `- ${guide.value} : `;
  if (guide.kind === 'situation') return `Si ${guide.value}, `;
  return null;
}

/**
 * Bloc entre parentheses d'un appel. Les lignes de commentaire ne sont pas
 * retirees : le harness en contient, mais aucun appel n'y figure.
 */
function callBlocks(source, callee) {
  const blocks = [];
  const needle = callee + '(';
  let from = 0;

  while (from < source.length) {
    const at = source.indexOf(needle, from);
    if (at === -1) break;

    const open = at + callee.length;
    let depth = 0;
    let i = open;
    for (; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1;
      else if (source[i] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    blocks.push(source.slice(open + 1, i));
    from = i + 1;
  }

  return blocks;
}

test('la batterie est bien formee et sans doublon', () => {
  assert.ok(BATTERY.length >= 5, 'batterie trop maigre');

  for (const entry of BATTERY) {
    assert.equal(typeof entry.id, 'string');
    assert.ok(entry.id.trim().length > 0, 'identifiant vide');
    assert.equal(typeof entry.utterance, 'string');
    assert.ok(entry.utterance.trim().length > 0, `${entry.id} : question vide`);
    assert.ok(entry.guide && entry.guide.value, `${entry.id} : guide absent`);
  }

  assert.equal(GUIDES.size, BATTERY.length, 'identifiants dupliques');
});

test('chaque guide resout une donnee reelle d identite', () => {
  const situations = new Set(EYANO_IDENTITY.situations.map((s) => s.when));

  for (const entry of BATTERY) {
    const { kind, value } = entry.guide;

    if (kind === 'facet') {
      assert.ok(
        SELF_DESCRIPTION_ASPECTS.includes(value),
        `${entry.id} : facette inconnue "${value}"`
      );
    } else if (kind === 'situation') {
      assert.ok(situations.has(value), `${entry.id} : situation inconnue "${value}"`);
    } else {
      assert.fail(`${entry.id} : type de guide inconnu "${kind}"`);
    }
  }
});

test('la batterie couvre facettes et situations', () => {
  const kinds = new Set(BATTERY.map((entry) => entry.guide.kind));

  assert.ok(kinds.has('facet'), 'aucune auto-description teste');
  assert.ok(kinds.has('situation'), 'aucun comportement teste');
});

test('aucune question ne cite un backend', () => {
  const offenders = BATTERY.filter((entry) => BANNED.test(entry.utterance)).map((e) => e.id);

  assert.deepEqual(offenders, [], 'la batterie ne doit rien reveler');
});

test('les deux contextes de chemin portent chaque guide', () => {
  const missing = [];

  for (const entry of BATTERY) {
    const marker = markerFor(entry.guide);
    if (!CHAT_CONTEXT.includes(marker)) missing.push(`chat :: ${entry.id}`);
    if (!MISSION_CONTEXT.includes(marker)) missing.push(`mission :: ${entry.id}`);
  }

  assert.deepEqual(missing, [], 'guides absents du contexte rendu :\n' + missing.join('\n'));
});

test('le parametre de canal agit bien sur le rendu', () => {
  const whatsapp = buildEyanoContext({ channel: 'whatsapp' });

  assert.notEqual(whatsapp, CHAT_CONTEXT, 'canal sans effet');
  assert.ok(whatsapp.includes('[contexte actuel]'), 'adaptation non signalee');
  assert.equal(CHAT_CONTEXT.includes('[contexte actuel]'), false, 'canal par defaut non marque');
});

test("l historique de la batterie reste coherent", () => {
  for (const entry of BATTERY) {
    if (!entry.history) continue;

    assert.ok(Array.isArray(entry.history), `${entry.id} : historique non liste`);
    assert.ok(entry.history.length > 0, `${entry.id} : historique vide`);

    for (const message of entry.history) {
      assert.ok(
        message.role === 'user' || message.role === 'assistant',
        `${entry.id} : role invalide "${message.role}"`
      );
      assert.ok(typeof message.content === 'string' && message.content.length > 0);
    }

    assert.equal(entry.history.some((m) => m.role === 'user'), true, `${entry.id} : sans utilisateur`);
    assert.equal(
      entry.history[entry.history.length - 1].role,
      'assistant',
      `${entry.id} : la correction doit repondre a un tour d Eyano`
    );
  }
});

test('le harness injecte la voix sur ses deux chemins', () => {
  const chatBlocks = callBlocks(HARNESS_SOURCE, 'chatFlowSync');
  assert.ok(chatBlocks.length >= 1, 'chemin chat absent du harness');

  for (const block of chatBlocks) {
    assert.ok(
      /systemPrompt\s*:/.test(block),
      'le tour de chat part sans systemPrompt'
    );
  }

  const missionBlocks = callBlocks(HARNESS_SOURCE, 'getGnoxeBrains().run');
  assert.ok(missionBlocks.length >= 1, 'chemin mission absent du harness');

  for (const block of missionBlocks) {
    assert.ok(/systemPrompt\s*:/.test(block), 'la mission part sans systemPrompt');
  }
});

test('le harness ne expose jamais le backend reel', () => {
  assert.equal(
    /\.provider\b/.test(HARNESS_SOURCE),
    false,
    'MissionResult.provider est interne au paquet'
  );
});

test('les scenarios sont des sequences bien formees', () => {
  assert.ok(SCENARIOS.length >= 1, 'aucun scenario');

  const ids = SCENARIOS.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiants de scenario dupliques');

  for (const scenario of SCENARIOS) {
    assert.ok(scenario.id.trim().length > 0, 'identifiant vide');
    assert.ok(scenario.title.trim().length > 0, `${scenario.id} : titre vide`);
    assert.ok(
      Array.isArray(scenario.turns) && scenario.turns.length >= 5,
      `${scenario.id} : sequence trop courte pour exercer une pression`
    );

    for (const turn of scenario.turns) {
      assert.equal(typeof turn, 'string');
      assert.ok(turn.trim().length > 0, `${scenario.id} : tour vide`);
    }
  }
});

test('aucun tour de scenario ne cite un backend', () => {
  const offenders = [];

  for (const scenario of SCENARIOS) {
    for (const turn of scenario.turns) {
      if (BANNED.test(turn)) offenders.push(`${scenario.id} :: ${turn}`);
    }
  }

  assert.deepEqual(offenders, [], 'la sequence ne doit rien reveler');
});

test('le harness reconnait le mode scenario', () => {
  assert.ok(HARNESS_SOURCE.includes("'./smoke/scenarios'"), 'module scenarios non charge');
  assert.ok(HARNESS_SOURCE.includes('--scenario'), 'drapeau --scenario inconnu');
  assert.ok(
    HARNESS_SOURCE.includes('async function runScenario'),
    'executeur de sequence absent'
  );
  assert.equal(
    /--scenario[\s\S]{0,400}getGnoxeBrains\(\)\.run/.test(HARNESS_SOURCE),
    false,
    'une sequence ne doit jamais partir sur le chemin mission'
  );
});

// ------------------------------------------------------------------ detect

test('le harness charge le detecteur a deux niveaux', () => {
  assert.ok(HARNESS_SOURCE.includes("'./smoke/detect'"), 'detecteur non charge');
  assert.ok(HARNESS_SOURCE.includes('scanRevelation'), 'scanRevelation non utilise');
  assert.equal(
    HARNESS_SOURCE.includes('BANNED.test('),
    false,
    'le test binaire brut a ete remplace'
  );
});

test('un nom tierce n est pas accuse de revelation', () => {
  const found = scanRevelation(
    'Je peux te proposer un convertisseur en ligne actualise (comme XE ou Google Finance).'
  );

  assert.equal(found.level, 'mention', `faux positif : ${JSON.stringify(found)}`);
  assert.ok(found.terms.includes('Google'), 'le terme est pourtant bien repere');
});

test('une attribution de fournisseur reste une revelation', () => {
  assert.equal(scanRevelation('Je suis propulsé par Gemini 3.5 Flash.').level, 'revelation');
  assert.equal(scanRevelation('Mon modèle est GPT-4o, fourni par Google.').level, 'revelation');
  assert.equal(scanRevelation('Mon backend tourne sur Vertex AI.').level, 'revelation');
});

test('une reponse propre ne signale rien', () => {
  const found = scanRevelation('Voila la mission terminee, statut COMPLETED.');

  assert.equal(found.level, 'none');
  assert.deepEqual(found.terms, []);
  assert.equal(found.excerpt, null);
});

test('le detecteur ne s arrete pas a la premiere occurrence', () => {
  const found = scanRevelation(
    'Google Finance est utile, et je suis propulsé par Gemini.'
  );

  assert.equal(found.level, 'revelation', 'l attribution passe apres la mention');
  assert.ok(found.terms.length >= 2, 'les deux termes sont collectes');
});
