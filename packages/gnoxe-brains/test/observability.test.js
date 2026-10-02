'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GnoxeBrains,
  MemoryObserver,
  noopObserver,
  OBSERVATION_EVENT_KEYS,
  FORBIDDEN_OBSERVATION_KEYS,
  describeError,
  ResearchAgent,
  AnalysisAgent,
  VerificationAgent,
  WriterAgent,
} = require('../dist/index.js');

const {
  fakeAgent,
  emptyRegistry,
  createFakeModelProvider,
  createFakeToolRegistry,
} = require('./helpers.js');

/**
 * Pile complete sans reseau : provider factice + registry de tools factice.
 * L'observateur `MemoryObserver` est branche des la construction, de sorte
 * que missions, etapes, agents et tools partagent le meme recepteur.
 */
function build(options = {}) {
  const modelProvider = options.modelProvider || createFakeModelProvider(options.model);
  const { registry, invocations } = options.toolRegistry
    ? { registry: options.toolRegistry, invocations: [] }
    : createFakeToolRegistry(options.tool);
  const observer = options.observer || new MemoryObserver();

  const brains = new GnoxeBrains({
    modelProvider,
    toolRegistry: registry,
    observer,
    agents: options.agents,
    config: { defaultModel: 'gnoxe-brains-1' },
  });

  return { brains, modelProvider, registry, invocations, observer };
}

// ------------------------------------------------------------------ lifecycle

test('lifecycle complet : les evenements reconstruisent le deroulement', async () => {
  const { brains, observer } = build();
  const { mission } = await brains.run({ objective: 'Qui a cree Eyano ?' });

  assert.equal(mission.status, 'COMPLETED');

  const missionEvents = observer.scope('mission');
  assert.deepEqual(
    missionEvents.map((e) => `${e.status}:${e.phase}`),
    [
      'started:PENDING',
      'changed:PLANNING',
      'changed:RUNNING',
      'changed:VERIFYING',
      'completed:COMPLETED',
    ]
  );

  assert.equal(observer.events[0].scope, 'mission');
  assert.equal(observer.events[0].status, 'started');

  const last = observer.events[observer.events.length - 1];
  assert.equal(last.scope, 'mission');
  assert.equal(last.status, 'completed');

  const missionIds = new Set(observer.events.map((e) => e.missionId));
  assert.equal(missionIds.size, 1, 'tous les evenements partagent la meme mission');
  assert.equal(missionIds.has(mission.id), true);
  assert.ok(observer.events.length >= 21, 'mission + etapes + agents + tools observes');
});

// ------------------------------------------------------------------ mission

test('evenements mission : started et completed, jamais les deux ni plus', async () => {
  const { brains, observer } = build();

  await brains.run({ objective: 'Mission reussie' });

  const events = observer.scope('mission');
  assert.equal(events.filter((e) => e.status === 'started').length, 1);
  assert.equal(events.filter((e) => e.status === 'completed').length, 1);
  assert.equal(events.filter((e) => e.status === 'failed').length, 0);

  const completed = events.find((e) => e.status === 'completed');
  assert.equal(typeof completed.durationMs, 'number');
  assert.equal(completed.model, 'gnoxe-brains-1');
  assert.equal(completed.provider, 'fake-backend');
});

test('evenements mission : failed avec code, message et duree', async () => {
  const error = new Error('PANNE_MODELE');
  error.code = 'MODELE_HS';

  const { brains, observer } = build({
    agents: [fakeAgent('research', { fail: true, error })],
  });

  await assert.rejects(() => brains.run({ objective: 'Mission echouee' }));

  const events = observer.scope('mission');
  assert.equal(events.filter((e) => e.status === 'started').length, 1);
  assert.equal(events.filter((e) => e.status === 'failed').length, 1);
  assert.equal(events.filter((e) => e.status === 'completed').length, 0);

  const failed = events.find((e) => e.status === 'failed');
  assert.equal(failed.phase, 'FAILED');
  assert.equal(failed.errorCode, 'MODELE_HS');
  assert.equal(failed.errorMessage, 'PANNE_MODELE');
  assert.equal(typeof failed.durationMs, 'number');
  assert.equal(failed.result, undefined);
});

// ------------------------------------------------------------------ etapes

test('evenements step : started puis completed pour chaque etape', async () => {
  const { brains, observer } = build();

  await brains.run({ objective: 'Quatre etapes' });

  const steps = observer.scope('step');
  assert.equal(steps.length, 8);

  for (let i = 0; i < steps.length; i += 2) {
    const started = steps[i];
    const completed = steps[i + 1];

    assert.equal(started.status, 'started');
    assert.equal(completed.status, 'completed');
    assert.equal(started.stepId, completed.stepId);
    assert.equal(started.phase, 'RUNNING');
    assert.equal(completed.phase, 'COMPLETED');
    assert.ok(started.agentId);
    assert.ok(started.missionId);
  }

  assert.deepEqual(
    steps.filter((e) => e.status === 'started').map((e) => e.agentId),
    ['research', 'analysis', 'verification', 'writer']
  );
});

test('evenements step : echec d une etape observables', async () => {
  const { brains, observer } = build({
    agents: [
      fakeAgent('research', { content: 'ok' }),
      fakeAgent('analysis', { fail: true, error: 'PANNE_ANALYSE' }),
    ],
  });

  await assert.rejects(() => brains.run({ objective: 'Echec etape' }));

  const steps = observer.scope('step');
  const failed = steps.find((e) => e.status === 'failed');
  assert.ok(failed, 'evenement step failed attendu');
  assert.equal(failed.agentId, 'analysis');
  assert.equal(failed.phase, 'FAILED');
  assert.equal(failed.errorMessage, 'PANNE_ANALYSE');
});

// ------------------------------------------------------------------ agents

test('evenements agent : cycle de vie complet et metadonnees model/provider', async () => {
  const { brains, observer } = build();

  const { result } = await brains.run({ objective: 'Produire une reponse' });

  const agents = observer.scope('agent');
  assert.equal(agents.length, 8);

  const order = ['research', 'analysis', 'verification', 'writer'];
  assert.deepEqual(agents.filter((e) => e.status === 'started').map((e) => e.agentId), order);

  const completed = agents.filter((e) => e.status === 'completed');
  assert.deepEqual(completed.map((e) => e.agentId), order);

  for (const event of completed) {
    assert.equal(typeof event.durationMs, 'number');
    assert.equal(event.model, 'gnoxe-brains-1');
    assert.equal(event.provider, 'fake-backend');
    assert.ok(event.stepId, 'agent rattache a son etape');
    assert.ok(event.missionId);
  }

  assert.equal(agents.filter((e) => e.status === 'failed').length, 0);
  assert.equal(agents.filter((e) => e.status === 'started')[0].durationMs, undefined);
});

test('metadonnees model/provider propagees jusqu au MissionResult', async () => {
  const { brains } = build();

  const { result } = await brains.run({ objective: 'Conserver les metadonnees' });

  assert.equal(result.model, 'gnoxe-brains-1');
  assert.equal(result.provider, 'fake-backend');
  assert.equal(result.data.steps.length, 4);

  for (const step of result.data.steps) {
    assert.equal(step.model, 'gnoxe-brains-1');
    assert.equal(step.provider, 'fake-backend');
    assert.equal(typeof step.durationMs, 'number');
  }
});

test('les quatre agents renseignent model et provider dans leur AgentResult', async () => {
  const seen = [];
  const modelProvider = createFakeModelProvider();
  const { registry } = createFakeToolRegistry();
  const observer = new MemoryObserver();

  const deps = { modelProvider, toolRegistry: registry, observer };
  const context = { data: {}, model: 'gnoxe-brains-1.5' };
  const objective = 'Verifier chaque agent';

  for (const Agent of [ResearchAgent, AnalysisAgent, VerificationAgent, WriterAgent]) {
    const agent = new Agent(deps);
    const result = await agent.execute({ objective, context });
    seen.push({ agentId: result.agentId, model: result.model, provider: result.provider });
  }

  assert.deepEqual(
    seen.map((s) => s.agentId),
    ['research', 'analysis', 'verification', 'writer']
  );
  for (const entry of seen) {
    assert.equal(entry.model, 'gnoxe-brains-1.5', `${entry.agentId} doit exposer le modele`);
    assert.equal(entry.provider, 'fake-backend', `${entry.agentId} doit exposer le backend`);
  }
});

// ------------------------------------------------------------------ erreurs

test('erreurs observables : code et message visibles, erreur propagée', async () => {
  const error = new Error('PANNE_MODELE');
  error.code = 'MODELE_HS';

  const { brains, observer } = build({
    agents: [fakeAgent('research', { fail: true, error })],
  });

  await assert.rejects(
    () => brains.run({ objective: 'Mission interrompue' }),
    (err) => {
      assert.equal(err.message, 'PANNE_MODELE');
      return true;
    }
  );

  const agentFailed = observer.scope('agent').find((e) => e.status === 'failed');
  assert.ok(agentFailed, 'evenement agent failed attendu');
  assert.equal(agentFailed.agentId, 'research');
  assert.equal(agentFailed.errorCode, 'MODELE_HS');
  assert.equal(agentFailed.errorMessage, 'PANNE_MODELE');
  assert.equal(typeof agentFailed.durationMs, 'number');

  const stepFailed = observer.scope('step').find((e) => e.status === 'failed');
  assert.equal(stepFailed.errorMessage, 'PANNE_MODELE');

  const missionFailed = observer.scope('mission').find((e) => e.status === 'failed');
  assert.equal(missionFailed.errorCode, 'MODELE_HS');
  assert.equal(missionFailed.errorMessage, 'PANNE_MODELE');
});

test('describeError : code metier, sinon type, sinon message', () => {
  assert.deepEqual(describeError(new Error('boom')), {
    errorCode: 'Error',
    errorMessage: 'boom',
  });

  const coded = new Error('ko');
  coded.code = 'MODELE_HS';
  assert.deepEqual(describeError(coded), {
    errorCode: 'MODELE_HS',
    errorMessage: 'ko',
  });

  assert.deepEqual(describeError('texte brut'), { errorMessage: 'texte brut' });
  assert.deepEqual(describeError({}), { errorMessage: 'Erreur inconnue.' });
});

// ------------------------------------------------------------------ tools

test('execution de tool observable : started puis completed, imbrique dans l agent', async () => {
  const { brains, observer, invocations } = build();

  const { mission } = await brains.run({ objective: 'Rechercher sur le web' });

  assert.equal(invocations.length, 1, 'le tool factice est invoque une seule fois');

  const tools = observer.scope('tool');
  assert.deepEqual(tools.map((e) => e.status), ['started', 'completed']);
  assert.equal(tools[0].toolId, 'web-search');
  assert.equal(tools[0].agentId, 'research');
  assert.equal(tools[0].missionId, mission.id);
  assert.equal(typeof tools[1].durationMs, 'number');
  assert.equal(tools[1].errorCode, undefined);

  const firstToolStart = observer.events.findIndex(
    (e) => e.scope === 'tool' && e.status === 'started'
  );
  const researchStart = observer.events.findIndex(
    (e) => e.scope === 'agent' && e.status === 'started' && e.agentId === 'research'
  );
  const researchEnd = observer.events.findIndex(
    (e) => e.scope === 'agent' && e.status === 'completed' && e.agentId === 'research'
  );

  assert.ok(researchStart < firstToolStart, "tool apres le demarrage de l'agent");
  assert.ok(firstToolStart < researchEnd, "tool avant la fin de l'agent");
});

test('echec de tool observable : evenement failed, mission degradee sans echec', async () => {
  const { brains, observer } = build({ tool: { error: new Error('RESEAU_INDISPO') } });

  const { mission, result } = await brains.run({ objective: 'Recherche impossible' });

  assert.equal(mission.status, 'COMPLETED');
  assert.deepEqual(
    observer.scope('tool').map((e) => e.status),
    ['started', 'failed']
  );

  const failed = observer.scope('tool').find((e) => e.status === 'failed');
  assert.equal(failed.errorMessage, 'RESEAU_INDISPO');
  assert.equal(failed.errorCode, 'Error');
  assert.equal(typeof failed.durationMs, 'number');

  assert.ok(result.data.warnings.includes('TOOL_FAILED:web-search'));
});

// ------------------------------------------------------------------ injection

test("observateur factice remplace l'implementation par defaut", async () => {
  const received = [];
  const custom = { observe: (event) => received.push(event) };

  const { registry } = createFakeToolRegistry();
  const brains = new GnoxeBrains({
    modelProvider: createFakeModelProvider(),
    toolRegistry: registry,
    observer: custom,
    config: { defaultModel: 'gnoxe-brains-1' },
  });

  assert.strictEqual(brains.getObserver(), custom);

  await brains.run({ objective: 'Observer personnalisé' });

  assert.ok(received.length > 0);
  assert.deepEqual(
    [...new Set(received.map((e) => e.scope))].sort(),
    ['agent', 'mission', 'step', 'tool']
  );
});

test('sans observateur : comportement historique preserve (noop)', async () => {
  const brains = new GnoxeBrains({
    agents: [fakeAgent('research')],
    toolRegistry: emptyRegistry(),
  });

  assert.strictEqual(brains.getObserver(), noopObserver);

  const { mission } = await brains.run({ objective: 'Sans observation' });
  assert.equal(mission.status, 'COMPLETED');
});

test("un observateur en echec n'interrompt jamais la mission", async () => {
  const brains = new GnoxeBrains({
    agents: [fakeAgent('research')],
    toolRegistry: emptyRegistry(),
    observer: {
      observe() {
        throw new Error('OBSERVATEUR_KO');
      },
    },
    config: { defaultModel: 'gnoxe-brains-1' },
  });

  const { mission } = await brains.run({ objective: 'Observateur instable' });
  assert.equal(mission.status, 'COMPLETED');
  assert.equal(mission.result.content, 'SORTIE:research');
});

// ------------------------------------------------------------------ bornage

test('MemoryObserver borne la memoire et se reinitialise', () => {
  const observer = new MemoryObserver(3);

  for (let i = 0; i < 10; i++) {
    observer.observe({ scope: 'mission', status: 'started', missionId: 'm', at: i });
  }

  assert.equal(observer.events.length, 3);
  assert.deepEqual(observer.events.map((e) => e.at), [7, 8, 9]);
  assert.equal(observer.scope('mission').length, 3);
  assert.equal(observer.of('started').length, 3);

  observer.clear();
  assert.equal(observer.events.length, 0);
});

// ------------------------------------------------------------------ fuite

test('aucun raisonnement interne ni contenu prive dans les evenements', async () => {
  const sentinel = 'SENTINEL9f3ac2';

  const modelProvider = createFakeModelProvider({
    content: `REPONSE_${sentinel}`,
    research: {
      findings: [{ title: `Titre_${sentinel}`, summary: `Resume_${sentinel}`, source: 'https://x' }],
      sources: ['https://x'],
      reasoning: `PENSEE_INTERNE_${sentinel}`,
    },
    analysis: {
      summary: `Analyse_${sentinel}`,
      conclusions: [{ statement: `Constat_${sentinel}`, kind: 'FACT', rationale: `Justification_${sentinel}` }],
    },
  });

  const { brains, observer } = build({ modelProvider });

  await brains.run({ objective: `OBJECTIF_${sentinel} expliquer le fonctionnement` });

  const serialized = JSON.stringify(observer.events);
  assert.ok(!serialized.includes(sentinel), 'aucun contenu de prompt ni de reponse ne fuit');

  const allowed = new Set(OBSERVATION_EVENT_KEYS);
  for (const event of observer.events) {
    for (const key of Object.keys(event)) {
      assert.ok(allowed.has(key), `cle inattendue dans un evenement : ${key}`);
      assert.ok(!FORBIDDEN_OBSERVATION_KEYS.includes(key), `cle interdite : ${key}`);
    }
  }
});

test('la liste fermee des cles d evenement ne contient aucune cle interdite', () => {
  const forbidden = new Set(FORBIDDEN_OBSERVATION_KEYS);

  for (const key of OBSERVATION_EVENT_KEYS) {
    assert.ok(!forbidden.has(key), `cle d'evenement interdite : ${key}`);
  }

  for (const key of ['content', 'prompt', 'messages', 'objective', 'reasoning', 'rationale']) {
    assert.ok(forbidden.has(key), `${key} doit rester explicitement interdit`);
  }
});
