#!/usr/bin/env node
'use strict';

/**
 * Harness de conversation reelle d'Eyano.
 *
 * Envoie la batterie partagee (`scripts/smoke/battery.js`) dans les deux
 * chemins qui portent la voix d'Eyano : le tour de chat, et la mission.
 *
 * Manuel : jamais lance en CI. Ce qui tourne en CI, c'est la garde-fous
 * deterministe `test/smoke-battery.test.js`.
 *
 * Aucun resultat n'est compare automatiquement : la lecture est humaine.
 * Le seul controle automatique est la detection de backend, a deux niveaux :
 * `!! REVELATION` quand le terme est presente comme le fournisseur d'Eyano,
 * `? mention` quand il n'apparait que comme nom tierce (Google Finance, XE).
 * Un unique niveau aurait produit de faux signaux et fait perdre au harness
 * sa valeur experimentale. Le jugement final reste humain.
 *
 * Usage :
 *   node scripts/smoke.js               chat seul, batterie complete
 *   node scripts/smoke.js --dry         contextes uniquement, aucun reseau
 *   node scripts/smoke.js --missions    ajoute le chemin mission
 *   node scripts/smoke.js --scenario    conversations sequentielles, chat seul
 *   node scripts/smoke.js --only a,b    restreint aux identifiants, dans le
 *                                       mode actif (batterie ou scenario)
 *   node scripts/smoke.js --no-resolver desactive le Recall Resolver (e35),
 *                                       garde e34 conservee : controle ON/OFF
 *   node scripts/smoke.js --provenance  probes P1-P5 (e38), chacun seul derriere
 *                                       un historique pre-ecrit
 *   node scripts/smoke.js --provenance-e39
 *                                       probes R1-R8 (e39), meme historique,
 *                                       meme mode que --provenance
 *   node scripts/smoke.js --provenance-e40
 *                                       probes N/S/I/V/A (e40), historique
 *                                       propre de decisions arbitraires
 *   node scripts/smoke.js --provenance-e41
 *                                       probes P1-P6 (e41.6), historique et
 *                                       couverture propres a chaque probe
 *   node scripts/smoke.js --recall-visible-only
 *                                       retablit le contrat e35-e41 du resolver
 *                                       (visible seulement) : controle OFF d'e42
 *   node scripts/smoke.js --no-provenance
 *                                       desactive le Provenance Check (e38) :
 *                                       controle ON/OFF
 *
 * Mode scenario : chaque tour s'ajoute a l'historique du suivant, ce qui
 * rend observable la stabilite de l'identite sous pression. `--missions`
 * y est ignore : une mission prend un objectif, pas une conversation.
 */

const fs = require('node:fs');
const path = require('node:path');
const { buildEyanoContext } = require('@eyano/eyano-identity');
const { chatFlowSync, getGnoxeBrains } = require('@eyano/gnoxe-brains');
const { BATTERY } = require('./smoke/battery');
const { SCENARIOS } = require('./smoke/scenarios');
const { SEED, PROBES } = require('./smoke/provenance');
const { PROBES_E39 } = require('./smoke/provenance-e39');
const { SEED_E40, PROBES_E40 } = require('./smoke/provenance-e40');
const { PROBES_E41 } = require('./smoke/provenance-e41');
const { scanRevelation } = require('./smoke/detect');

/** Jeux de probes de provenance : chacun avec SON historique pre-ecrit. */
const PROVENANCE_SETS = {
  e38: { seed: SEED, probes: PROBES },
  e39: { seed: SEED, probes: PROBES_E39 },
  e40: { seed: SEED_E40, probes: PROBES_E40 },
  // e41.6 : chaque probe porte son historique, sa couverture et son canal.
  e41: { seed: null, probes: PROBES_E41 },
};

const API_ROOT = path.join(__dirname, '..');
const MISSION_CHANNEL = 'admin';

// ------------------------------------------------------------------ options

function parseArgs(argv) {
  const options = { dry: false, missions: false, scenario: false, only: null, resolver: true, provenance: false, provenanceSet: 'e38', provenanceCheck: true, storedRecall: true };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--dry') {
      options.dry = true;
    } else if (arg === '--missions') {
      options.missions = true;
    } else if (arg === '--scenario') {
      options.scenario = true;
    } else if (arg === '--no-resolver') {
      options.resolver = false;
    } else if (arg === '--provenance') {
      options.provenance = true;
    } else if (arg === '--provenance-e39') {
      options.provenance = true;
      options.provenanceSet = 'e39';
    } else if (arg === '--provenance-e40') {
      options.provenance = true;
      options.provenanceSet = 'e40';
    } else if (arg === '--provenance-e41') {
      options.provenance = true;
      options.provenanceSet = 'e41';
    } else if (arg === '--recall-visible-only') {
      options.storedRecall = false;
    } else if (arg === '--no-provenance') {
      options.provenanceCheck = false;
    } else if (arg === '--only') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--only attend une liste d identifiants');
      }
      options.only = splitIds(value);
      index += 1;
    } else if (arg.startsWith('--only=')) {
      options.only = splitIds(arg.slice('--only='.length));
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Argument inconnu : ${arg}`);
    }
  }

  if (options.provenance && options.scenario) {
    throw new Error('--provenance et --scenario sont exclusifs');
  }

  if (options.only && options.only.length === 0) {
    throw new Error('--only attend une liste d identifiants');
  }

  return options;
}

/** `a,b` -> `['a', 'b']`, vide ignoree. */
function splitIds(raw) {
  return String(raw)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

// ------------------------------------------------------------------- env

/**
 * Charge `apps/api/.env` sans dependance externe. Une variable deja presente
 * dans le processus reste prioritaire.
 */
function loadEnvFile() {
  const file = path.join(API_ROOT, '.env');
  if (!fs.existsSync(file)) return false;

  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return true;
}

/** Nombre de cles presentes. Les valeurs ne sont jamais lues a l'ecran. */
function countApiKeys() {
  return ['GEMINI_API_KEY_1', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY'].filter(
    (name) => Boolean(process.env[name])
  ).length;
}

// --------------------------------------------------------------- chemins

async function runChat(entry, resolver, provenanceCheck, storedRecall) {
  const messages = [
    ...(entry.history || []),
    { role: 'user', content: entry.utterance },
  ];

  // `coverage` et `channel` (e41.6) : absents, comportement anterieur.
  const output = await chatFlowSync({
    userId: 'smoke',
    conversationId: `smoke-${entry.id}`,
    messages,
    channel: entry.channel,
    systemPrompt: buildEyanoContext(entry.channel ? { channel: entry.channel } : undefined),
    recallResolver: resolver,
    provenanceCheck,
    historyCoverage: entry.coverage,
    recallStoredHistory: storedRecall,
  });

  return {
    meta: `modele=${output.model} entree=${output.inputTokens} sortie=${output.outputTokens}`,
    content: output.content,
  };
}

async function runMission(entry) {
  const { mission, result } = await getGnoxeBrains().run({
    objective: entry.utterance,
    context: {
      userId: 'smoke',
      channel: MISSION_CHANNEL,
      data: {},
      systemPrompt: buildEyanoContext({ channel: MISSION_CHANNEL }),
    },
  });

  const plan = mission.plan?.steps ?? [];
  return {
    meta: `statut=${mission.status} plan=${plan.length} modele=${result.model || '?'} duree=${result.durationMs}ms`,
    content: result.content,
  };
}

// ----------------------------------------------------------------- sortie

/**
 * Un tour de scenario : historique accumule, un seul appel par tour.
 *
 * La reponse est rendue au fur et a mesure : un echec en cours de sequence
 * conserve la transcript deja produite.
 */
async function runScenario(scenario, resolver, provenanceCheck, storedRecall, onStep) {
  const messages = [];

  for (let index = 0; index < scenario.turns.length; index += 1) {
    const turn = scenario.turns[index];
    messages.push({ role: 'user', content: turn });

    const output = await chatFlowSync({
      userId: 'smoke',
      conversationId: `smoke-scenario-${scenario.id}`,
      messages: [...messages],
      systemPrompt: buildEyanoContext(),
      recallResolver: resolver,
      provenanceCheck,
      recallStoredHistory: storedRecall,
    });

    messages.push({ role: 'assistant', content: output.content });
    onStep(index + 1, {
      turn,
      reply: output.content,
      meta: `modele=${output.model} entree=${output.inputTokens} sortie=${output.outputTokens}`,
    });
  }
}

function banner(text) {
  console.log('\n' + '='.repeat(72));
  console.log(text);
  console.log('='.repeat(72));
}

function reportRevelation(text, indent) {
  const found = scanRevelation(text);

  if (found.level === 'revelation') {
    console.log(
      `${indent}!! REVELATION DE BACKEND [${found.terms.join(', ')}] : la regle d identite est violee`
    );
    console.log(`${indent}   ... ${found.excerpt}`);
  } else if (found.level === 'mention') {
    console.log(
      `${indent}? mention de marque [${found.terms.join(', ')}] : a verifier, pas forcement une revelation`
    );
    console.log(`${indent}  ... ${found.excerpt}`);
  }
}

function reportEntry(entry, outcome) {
  console.log(`\n[${entry.id}] ${entry.utterance}`);
  console.log(`  ${outcome.meta}`);
  console.log(`  > ${outcome.content}`);

  reportRevelation(outcome.content, '  ');
}

function reportFailure(entry, error) {
  console.log(`\n[${entry.id}] ${entry.utterance}`);
  console.log(`  !! ECHEC : ${error && error.message ? error.message : error}`);
}

function reportStep(index, step) {
  console.log(`\n${index}. vous  > ${step.turn}`);
  console.log(`   eyano > ${step.reply}`);
  console.log(`   ${step.meta}`);

  reportRevelation(step.reply, '   ');
}

function printScenarios(selected) {
  for (const scenario of selected) {
    banner(`Scenario : ${scenario.title} (${scenario.id})`);
    scenario.turns.forEach((turn, index) => console.log(`${index + 1}. ${turn}`));
  }
}

function printContexts() {
  banner('Contexte du chemin chat');
  console.log(buildEyanoContext());

  banner(`Contexte du chemin mission (canal ${MISSION_CHANNEL})`);
  console.log(buildEyanoContext({ channel: MISSION_CHANNEL }));
}

// ------------------------------------------------------------------ main

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].split('/**')[1]);
    return 0;
  }

  const loaded = loadEnvFile();
  const collection = options.scenario
    ? SCENARIOS
    : options.provenance
      ? PROVENANCE_SETS[options.provenanceSet].probes.map((probe) => ({
          ...probe,
          history: probe.history || PROVENANCE_SETS[options.provenanceSet].seed,
        }))
      : BATTERY;
  const selected = options.only
    ? collection.filter((entry) => options.only.includes(entry.id))
    : collection;

  if (options.only) {
    const unknown = options.only.filter((id) => !collection.some((entry) => entry.id === id));
    if (unknown.length > 0) throw new Error(`Identifiants inconnus : ${unknown.join(', ')}`);
  }

  banner('Eyano - harness de conversation reelle');
  console.log(
    `mode         : ${
      options.scenario
        ? 'scenario (sequence accumulee)'
        : options.provenance
          ? `provenance ${options.provenanceSet} (probes isoles, historique pre-ecrit)`
          : 'batterie (tours isoles)'
    }`
  );
  console.log(`entrees      : ${selected.length}`);
  console.log(
    options.scenario
      ? 'chemins      : chat'
      : `chemins      : chat${options.missions ? ' + missions' : ''}`
  );
  console.log(`resolver     : ${options.resolver ? 'ON' : 'OFF (garde e34 seule)'}`);
  console.log(`provenance   : ${options.provenanceCheck ? 'ON' : 'OFF'}`);
  console.log(`rappel stocke: ${options.storedRecall ? 'ON (e42)' : 'OFF (visible seulement)'}`);
  console.log(`contexte .env: ${loaded ? 'charge' : 'absent'}`);
  console.log(`cles presentes: ${countApiKeys()}`);

  if (options.dry) {
    printContexts();
    if (options.scenario) printScenarios(selected);
    return 0;
  }

  if (countApiKeys() === 0) {
    console.log('\nAucune cle : le modele ne repondra pas. Lancez d abord --dry.');
  }

  const failures = [];

  if (options.scenario) {
    for (const scenario of selected) {
      banner(`Scenario : ${scenario.title} (${scenario.id})`);
      try {
        await runScenario(
          scenario,
          options.resolver,
          options.provenanceCheck,
          options.storedRecall,
          reportStep
        );
      } catch (error) {
        failures.push(scenario.id);
        console.log(`\n  !! ECHEC : ${error && error.message ? error.message : error}`);
      }
    }
  } else {
    banner('Chemin chat');
    for (const entry of selected) {
      try {
        reportEntry(
          entry,
          await runChat(entry, options.resolver, options.provenanceCheck, options.storedRecall)
        );
      } catch (error) {
        failures.push(entry.id);
        reportFailure(entry, error);
      }
    }

    if (options.missions && !options.provenance) {
      banner('Chemin mission');
      for (const entry of selected) {
        try {
          reportEntry(entry, await runMission(entry));
        } catch (error) {
          failures.push(entry.id);
          reportFailure(entry, error);
        }
      }
    }
  }

  banner('Bilan');
  const runs = options.scenario
    ? selected.length
    : selected.length * (options.missions ? 2 : 1);
  console.log(`reussites : ${runs - failures.length}`);
  console.log(`echecs    : ${failures.length}${failures.length ? ' (' + failures.join(', ') + ')' : ''}`);

  return failures.length > 0 ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
);
