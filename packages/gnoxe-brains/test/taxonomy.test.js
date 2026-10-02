'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  GnoxeBrains,
  MissionEngine,
  Orchestrator,
  MemoryObserver,
  AnalysisAgent,
  VerificationAgent,
  ResearchAgent,
  WriterAgent,
  OBSERVATION_EVENT_KEYS,
  FORBIDDEN_OBSERVATION_KEYS,
} = require('../dist/index.js');
const {
  fakeAgent,
  emptyRegistry,
  createFakeModelProvider,
  createFakeToolRegistry,
} = require('./helpers');

const SRC = path.join(__dirname, '..', 'src');

function readSource(relativePath) {
  return fs.readFileSync(path.join(SRC, relativePath), 'utf8');
}

/** Extrait les valeurs literales d'un `export type X = ...;`. */
function unionValues(relativePath, typeName) {
  const content = readSource(relativePath);
  const start = content.indexOf(`export type ${typeName}`);
  assert.ok(start >= 0, `${typeName} introuvable dans ${relativePath}`);

  const eq = content.indexOf('=', start);
  const end = content.indexOf(';', eq);
  assert.ok(eq >= 0 && end > eq, `union illisible pour ${typeName}`);

  return [...content.slice(eq + 1, end).matchAll(/'([A-Za-z_]+)'/g)].map((m) => m[1]);
}

function intersection(a, b) {
  return a.filter((value) => b.includes(value));
}

function buildStack(options = {}) {
  const modelProvider = createFakeModelProvider(options.model);
  const { registry, invocations } = createFakeToolRegistry();
  const deps = { modelProvider, toolRegistry: registry };

  const brains = new GnoxeBrains({
    agents: [
      new ResearchAgent(deps),
      new AnalysisAgent(deps),
      new VerificationAgent(deps),
      new WriterAgent(deps),
    ],
    toolRegistry: registry,
    modelProvider,
    config: { defaultModel: 'gnoxe-brains-1' },
    observer: options.observer,
  });

  return { brains, modelProvider, invocations };
}

/** Provider factice qui renvoie une charge structuree imposee. */
function providerReturning(payload) {
  return {
    name: 'taxonomy-fake',
    async generate(request) {
      return { content: 'contenu factice', model: request.model || 'gnoxe-brains-1', provider: 'taxonomy-fake' };
    },
    async *stream(request) {
      const done = await this.generate(request);
      yield { type: 'text', content: done.content };
      yield { type: 'done', content: done.content, model: done.model };
    },
    async structuredOutput() {
      return payload;
    },
    capabilities() {
      return { streaming: true, structuredOutput: true, images: false, models: ['gnoxe-brains-1'] };
    },
  };
}

// ------------------------------------------------- responsabilites distinctes

test('taxonomies de contenu : vocabulaires strictement disjoints', () => {
  const analysis = unionValues('agents/analysis.agent.ts', 'AnalysisKind');
  const status = unionValues('agents/verification.agent.ts', 'VerificationStatus');
  const overall = unionValues('agents/verification.agent.ts', 'VerificationOverall');

  assert.deepEqual(analysis, [
    'FACT',
    'CALCULATED',
    'ESTIMATE',
    'INTERPRETATION',
    'UNESTABLISHED',
  ]);
  assert.deepEqual(status, ['VERIFIED', 'UNVERIFIED', 'CONTRADICTORY']);
  assert.deepEqual(overall, ['RELIABLE', 'PARTIAL', 'UNRELIABLE']);

  assert.deepEqual(intersection(analysis, status), [], 'provenance et controle ne se melangent pas');
  assert.deepEqual(intersection(analysis, overall), [], 'provenance et verdict ne se melangent pas');
  assert.deepEqual(intersection(status, overall), [], 'etat d assertion et verdict ne se melangent pas');
});

test('taxonomies d execution : cycle de vie, evenement et contenu restent separes', () => {
  const mission = unionValues('missions/types.ts', 'MissionStatus');
  const failure = unionValues('missions/types.ts', 'MissionErrorClass');
  const observation = unionValues('observability/events.ts', 'ObservationStatus');
  const analysis = unionValues('agents/analysis.agent.ts', 'AnalysisKind');
  const status = unionValues('agents/verification.agent.ts', 'VerificationStatus');
  const overall = unionValues('agents/verification.agent.ts', 'VerificationOverall');

  assert.deepEqual(mission, [
    'PENDING',
    'PLANNING',
    'RUNNING',
    'VERIFYING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
  ]);
  assert.deepEqual(failure, ['VALIDATION', 'EXECUTION', 'DEPENDENCY', 'STEP', 'UNKNOWN']);
  assert.deepEqual(observation, ['started', 'completed', 'failed', 'cancelled', 'changed']);

  // Conventions distinctes : l evenement est en minuscules, l entite en majuscules.
  assert.ok(observation.every((value) => value === value.toLowerCase()));
  assert.ok(mission.every((value) => value === value.toUpperCase()));
  assert.deepEqual(intersection(mission, observation), []);
  assert.deepEqual(intersection(mission, failure), [], 'un echec n est pas un etat de vie');
  assert.deepEqual(intersection(failure, observation), [], 'une categorie n est pas un evenement');

  for (const value of [...analysis, ...status, ...overall]) {
    assert.ok(!mission.includes(value), `contenu detourne en cycle de vie : ${value}`);
    assert.ok(!failure.includes(value), `contenu detourne en categorie d echec : ${value}`);
    assert.ok(!observation.includes(value), `contenu detourne en evenement : ${value}`);
  }

  const errorCodeUnions = [
    ...unionValues('orchestrator/orchestrator.ts', 'OrchestratorErrorCode'),
    ...unionValues('tools/registry.ts', 'ToolRegistryErrorCode'),
    ...unionValues('core/gnoxe-brains.ts', 'GnoxeBrainsErrorCode'),
  ];
  assert.deepEqual(
    intersection(errorCodeUnions, failure),
    [],
    'un code specifique n est jamais une categorie'
  );
});

test('chaque taxonomie declare sa responsabilite dans le code', () => {
  const declarations = [
    ['missions/types.ts', "Cycle de vie d'une mission"],
    ['missions/types.ts', "Categorie homogene d'un echec de mission"],
    ['agents/analysis.agent.ts', "Nature d'une conclusion"],
    ['agents/verification.agent.ts', "Etat d'UNE affirmation"],
    ['agents/verification.agent.ts', 'Verdict GLOBAL de fiabilite'],
    ['observability/events.ts', "Cycle de vie observe d'un evenement"],
    ['orchestrator/orchestrator.ts', "Codes d'erreur d'EXECUTION de mission"],
    ['tools/registry.ts', "Codes d'erreur du REGISTRE D'OUTILS"],
    ['core/gnoxe-brains.ts', "Codes d'erreur de VALIDATION d'entree a la facade"],
    ['agents/agent.ts', 'Limites non bloquantes'],
  ];

  for (const [file, phrase] of declarations) {
    assert.ok(readSource(file).includes(phrase), `${file} doit documenter "${phrase}"`);
  }
});

// ------------------------------------------------------------- erreurs

test('une regle = un code : l objectif vide ne porte plus deux codes', async () => {
  for (const file of ['core/gnoxe-brains.ts', 'orchestrator/orchestrator.ts']) {
    const content = readSource(file);
    assert.ok(!content.includes('OBJECTIF_VIDE'), `${file} ne doit plus porter OBJECTIF_VIDE`);
    assert.ok(content.includes('INVALID_OBJECTIVE'), `${file} doit porter INVALID_OBJECTIVE`);
  }

  const brains = new GnoxeBrains({
    agents: [fakeAgent('research')],
    toolRegistry: emptyRegistry(),
  });
  await assert.rejects(
    () => brains.run({ objective: '   ' }),
    (error) => {
      assert.equal(error.name, 'GnoxeBrainsError');
      assert.equal(error.code, 'INVALID_OBJECTIVE');
      return true;
    }
  );

  const engine = new MissionEngine();
  const orchestrator = new Orchestrator({
    engine,
    agents: [fakeAgent('research')],
    toolRegistry: emptyRegistry(),
  });
  await assert.rejects(
    () => orchestrator.execute(engine.create('   ')),
    (error) => {
      assert.equal(error.name, 'OrchestratorError');
      assert.equal(error.code, 'INVALID_OBJECTIVE');
      return true;
    }
  );
});

test("taxonomies d erreur : aucune valeur partagee entre couches", () => {
  const orchestrator = unionValues('orchestrator/orchestrator.ts', 'OrchestratorErrorCode');
  const registry = unionValues('tools/registry.ts', 'ToolRegistryErrorCode');
  const facade = unionValues('core/gnoxe-brains.ts', 'GnoxeBrainsErrorCode');

  assert.deepEqual(intersection(orchestrator, registry), []);
  assert.deepEqual(intersection(facade, registry), []);
  // La regle "objectif non vide" est la SEULE valeur volontairement partagee,
  // parce que c'est la meme regle appliquee en deux couches.
  assert.deepEqual(intersection(facade, orchestrator), ['INVALID_OBJECTIVE']);
});

test('avertissements et codes d erreur ne partagent aucune valeur', () => {
  const errorCodes = new Set([
    ...unionValues('orchestrator/orchestrator.ts', 'OrchestratorErrorCode'),
    ...unionValues('tools/registry.ts', 'ToolRegistryErrorCode'),
    ...unionValues('core/gnoxe-brains.ts', 'GnoxeBrainsErrorCode'),
  ]);

  const warnings = [
    'FORMAT_NON_STRUCTURE',
    'AUCUNE_CONCLUSION',
    'AUCUN_ELEMENT_A_VERIFIER',
    'AUCUNE_SOURCE',
    'AUCUNE_INFORMATION',
    'AUCUN_MATERIAU',
  ];

  for (const warning of warnings) {
    assert.ok(!errorCodes.has(warning), `avertissement confondu avec une erreur : ${warning}`);
  }
});

// ------------------------------------------------------------------ rendu

test('rendu : chaque taxonomie conserve son propre vocabulaire affiche', async () => {
  const analysis = new AnalysisAgent({
    modelProvider: providerReturning({
      summary: 'Synthese.',
      conclusions: [{ statement: 'Affirmation testee.', kind: 'UNESTABLISHED' }],
    }),
    toolRegistry: emptyRegistry(),
  });
  const analysisResult = await analysis.execute({
    objective: 'Analyser.',
    context: { data: {} },
  });

  assert.equal(analysisResult.data.conclusions[0].kind, 'UNESTABLISHED');
  assert.ok(analysisResult.content.includes('[NON ETABLI] Affirmation testee.'));
  assert.ok(!analysisResult.content.includes('NON VERIFIE'), "l analyse ne reprend pas le vocabulaire de verification");

  const verification = new VerificationAgent({
    modelProvider: providerReturning({
      overall: 'PARTIAL',
      items: [{ claim: 'Affirmation testee.', status: 'UNVERIFIED' }],
    }),
    toolRegistry: emptyRegistry(),
  });
  const verificationResult = await verification.execute({
    objective: 'Verifier.',
    context: { data: {} },
  });

  assert.ok(verificationResult.content.includes('[NON VERIFIE] Affirmation testee.'));
  assert.ok(verificationResult.content.includes('Verdict : PARTIELLEMENT FIABLE'));
  assert.ok(!verificationResult.content.includes('NON ETABLI'));

  // `data` et `content` partagent le meme vocabulaire.
  assert.equal(verificationResult.data.overall, 'PARTIAL');
  assert.equal(verificationResult.data.items[0].status, 'UNVERIFIED');
});

test('tolerance : une valeur hors taxonomie est ramenee a la valeur canonique', async () => {
  const legacy = new AnalysisAgent({
    modelProvider: providerReturning({
      summary: 'Synthese.',
      conclusions: [{ statement: 'Affirmation ancienne.', kind: 'UNVERIFIED' }],
    }),
    toolRegistry: emptyRegistry(),
  });

  const analysisResult = await legacy.execute({ objective: 'Analyser.', context: { data: {} } });

  assert.equal(analysisResult.data.conclusions[0].kind, 'UNESTABLISHED');
  assert.ok(analysisResult.content.includes('[NON ETABLI] Affirmation ancienne.'));
  assert.ok(!analysisResult.content.includes('NON VERIFIE'), 'jamais le vocabulaire de verification');

  const crossTaxonomy = new VerificationAgent({
    modelProvider: providerReturning({
      overall: 'RELIABLE',
      items: [{ claim: 'Affirmation ancienne.', status: 'FACT' }],
    }),
    toolRegistry: emptyRegistry(),
  });

  const verificationResult = await crossTaxonomy.execute({
    objective: 'Verifier.',
    context: { data: {} },
  });

  assert.equal(verificationResult.data.items[0].status, 'UNVERIFIED');
  assert.ok(verificationResult.content.includes('[NON VERIFIE] Affirmation ancienne.'));
  assert.ok(!verificationResult.content.includes('[FAIT]'), 'jamais le vocabulaire de l analyse');
});

// --------------------------------------------------------- sous-ensemble etape

test("MissionStep n utilise que le sous-ensemble applicable de MissionStatus", async () => {
  const { brains } = buildStack();

  const { mission } = await brains.run({ objective: 'Quatre agents, quatre etapes.' });

  assert.equal(mission.status, 'COMPLETED');
  assert.equal(mission.plan.steps.length, 4);

  const applicable = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'];
  for (const step of mission.plan.steps) {
    assert.ok(applicable.includes(step.status), `etat d etape inattendu : ${step.status}`);
  }
  assert.ok(
    !mission.plan.steps.some((step) => step.status === 'PLANNING' || step.status === 'VERIFYING'),
    'PLANNING et VERIFYING appartiennent au cycle de la mission, pas a une etape'
  );
});

// ------------------------------------------------------------ compatibilite

test('compatibilite : answer(), answerStream(), run() avec et sans historique', async () => {
  const { brains } = buildStack();

  const messages = [
    { role: 'system', content: 'SYSTEME_DE_REFERENCE' },
    { role: 'user', content: 'Salut' },
  ];

  const answer = await brains.answer({ messages });
  assert.equal(answer.model, 'gnoxe-brains-1');
  assert.ok(answer.content.length > 0);

  const chunks = [];
  for await (const chunk of brains.answerStream({ messages })) chunks.push(chunk);
  assert.ok(chunks.length >= 1);
  assert.equal(chunks[chunks.length - 1].type, 'done');

  const simple = await brains.run({ objective: 'Objectif simple.' });
  assert.equal(simple.mission.status, 'COMPLETED');
  assert.equal(simple.mission.context.messages, undefined);

  const history = [{ role: 'user', content: 'CONTEXTE_MARQUEUR' }];
  const withHistory = await brains.run({
    objective: 'Objectif avec contexte.',
    context: { messages: history },
  });
  assert.equal(withHistory.mission.status, 'COMPLETED');
  assert.deepEqual(
    withHistory.mission.context.messages.map((message) => message.content),
    ['CONTEXTE_MARQUEUR']
  );
});

test('contrats publics : symboles et formes exportes preserves', async () => {
  const api = require('../dist/index.js');

  for (const symbol of [
    'GnoxeBrains',
    'MissionEngine',
    'classifyMissionError',
    'Orchestrator',
    'ResearchAgent',
    'AnalysisAgent',
    'VerificationAgent',
    'WriterAgent',
    'MemoryObserver',
    'noopObserver',
    'safeObserve',
    'toolRegistry',
    'providerRegistry',
    'isRegisteredModel',
  ]) {
    assert.ok(symbol in api, `export public absent : ${symbol}`);
  }

  assert.equal(OBSERVATION_EVENT_KEYS.length, 13);
  assert.ok(
    OBSERVATION_EVENT_KEYS.every((key) => !FORBIDDEN_OBSERVATION_KEYS.includes(key)),
    'cles observees et cles interdites doivent rester disjointes'
  );

  const { result } = await buildStack().brains.run({ objective: 'Forme du resultat.' });
  assert.deepEqual(Object.keys(result).sort(), [
    'content',
    'data',
    'durationMs',
    'model',
    'provider',
  ]);
  assert.ok(!('kind' in result), 'MissionResult ne porte aucune taxonomie de contenu');
  assert.ok(!('status' in result), 'MissionResult ne porte aucun cycle de vie');
});

// ------------------------------------------------------------ observabilite

test('observabilite : ni contenu, ni taxonomie de contenu, ni objectif', async () => {
  const observer = new MemoryObserver(500);
  const { brains } = buildStack({ observer });

  await brains.run({
    objective: 'OBJECTIF_TAXONOMIE_MARQUEUR',
    context: { messages: [{ role: 'user', content: 'HISTORIQUE_TAXONOMIE_MARQUEUR' }] },
  });

  const events = observer.events;
  assert.ok(events.length > 0);

  const allowed = new Set(OBSERVATION_EVENT_KEYS);
  const payload = JSON.stringify(events);

  for (const event of events) {
    for (const key of Object.keys(event)) {
      assert.ok(allowed.has(key), `cle inattendue dans un evenement : ${key}`);
    }
  }

  for (const forbidden of FORBIDDEN_OBSERVATION_KEYS) {
    assert.ok(!payload.includes(`"${forbidden}"`), `cle interdite presente : ${forbidden}`);
  }

  const leaks = [
    'OBJECTIF_TAXONOMIE_MARQUEUR',
    'HISTORIQUE_TAXONOMIE_MARQUEUR',
    'FACT',
    'CALCULATED',
    'ESTIMATE',
    'INTERPRETATION',
    'UNESTABLISHED',
    'VERIFIED',
    'CONTRADICTORY',
    'RELIABLE',
    'UNRELIABLE',
    'NON ETABLI',
    'NON VERIFIE',
  ];
  for (const leak of leaks) {
    assert.ok(!payload.includes(leak), `fuite dans les evenements : ${leak}`);
  }

  const validPhases = unionValues('missions/types.ts', 'MissionStatus');
  for (const event of events.filter((e) => e.scope === 'mission' || e.scope === 'step')) {
    assert.ok(validPhases.includes(event.phase), `phase hors MissionStatus : ${event.phase}`);
  }
});

// ----------------------------------------------------- contrats generiques

test('contrats generiques : aucun nom de fournisseur concret', () => {
  const genericContracts = [
    'agents/agent.ts',
    'agents/research.agent.ts',
    'agents/analysis.agent.ts',
    'agents/verification.agent.ts',
    'agents/writer.agent.ts',
    'missions/types.ts',
    'missions/mission-engine.ts',
    'missions/mission-executor.ts',
    'orchestrator/orchestrator.ts',
    'orchestrator/planner.ts',
    'tools/tool.ts',
    'tools/registry.ts',
    'observability/events.ts',
    'observability/observer.ts',
    'providers/model-provider.ts',
    'core/gnoxe-brains.ts',
    'core/config.ts',
    'core/personality.ts',
  ];

  const banned = ['Gemini', 'Google', 'genkit', 'GEMINI_API_KEY', 'gemini-adapter', 'getKeyManager'];

  for (const file of genericContracts) {
    const content = readSource(file);
    for (const token of banned) {
      assert.ok(!content.includes(token), `${file} ne doit pas nommer "${token}"`);
    }
  }
});
