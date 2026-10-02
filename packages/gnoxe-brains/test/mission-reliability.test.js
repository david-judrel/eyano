'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GnoxeBrains,
  MemoryObserver,
  MissionEngine,
  Orchestrator,
  ToolRegistry,
  classifyMissionError,
  ResearchAgent,
  AnalysisAgent,
  VerificationAgent,
  WriterAgent,
} = require('../dist/index.js');
const { emptyRegistry, createFakeToolRegistry } = require('./helpers');

const OBJECTIVE = 'Qui a cree Eyano ?';
const MARKERS = {
  research: '## ResearchAgent',
  analysis: '## AnalysisAgent',
  verification: '## VerificationAgent',
  writer: '## WriterAgent',
};

/**
 * FakeModelProvider scriptable : aucun reseau, aucune cle.
 *
 * `failOn` arrete un AGENT precis au niveau du modele, `offline` arrete
 * tout appel. Une exception neuve est fabriquee a chaque appel afin de ne
 * jamais partager d'objet d'erreur entre missions.
 */
function createProvider(options = {}) {
  const calls = [];
  const makeError = () =>
    options.error instanceof Error ? options.error : new Error(options.error ?? 'PANNE_MODELE');

  const payload = (system) => {
    if (system.includes(MARKERS.research)) {
      return options.research ?? {
        findings: [{ title: 'Origine', summary: 'Eyano signifie reponse en lingala.' }],
        sources: ['https://eyano.example/nom'],
      };
    }
    if (system.includes(MARKERS.analysis)) {
      return options.analysis ?? {
        summary: 'Gnoxe Technology developpe Eyano.',
        conclusions: [{ statement: 'David Judrel GNONDABEKA est le createur.', kind: 'FACT' }],
      };
    }
    if (system.includes(MARKERS.verification)) {
      return options.verification ?? {
        overall: 'RELIABLE',
        items: [{ claim: 'David Judrel GNONDABEKA est le createur.', status: 'VERIFIED' }],
      };
    }
    return options.structured ?? { sourcesUsed: [], inputResultCount: 0 };
  };

  const stops = (request) => {
    if (options.offline) return true;
    if (!options.failOn) return false;
    const system = String(request.messages?.[0]?.content ?? '');
    return system.includes(MARKERS[options.failOn]);
  };

  return {
    name: 'fake-offline',
    calls,
    async generate(request) {
      calls.push({ kind: 'generate', model: request.model });
      if (stops(request)) throw makeError();
      return {
        content: 'Reponse finale fournie par le fake model.',
        model: request.model || 'gnoxe-brains-1',
        provider: 'fake-offline',
      };
    },
    async *stream(request) {
      const done = await this.generate(request);
      yield { type: 'text', content: done.content };
      yield { type: 'done', content: done.content };
    },
    async structuredOutput(request) {
      calls.push({ kind: 'structuredOutput', model: request.model });
      if (stops(request)) throw makeError();
      const system = String(request.messages?.[0]?.content ?? '');
      return payload(system);
    },
    capabilities() {
      return { streaming: true, structuredOutput: true, images: false, models: ['gnoxe-brains-1'] };
    },
  };
}

/** Copie conforme de l'agent, dont `execute` echoue aussitot. */
function brokenAgent(agent, message) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    objective: agent.objective,
    capabilities: agent.capabilities,
    availableTools: agent.availableTools,
    execute() {
      return Promise.reject(new Error(message));
    },
  };
}

/**
 * Pile standard (4 agents reels + web-search factice).
 *
 * `breakAgent` remplace UN specialiste par sa version en echec : c'est
 * l'agent qui echoue, pas le modele, afin de couvrir `STEP` et
 * `DEPENDENCY` comme deux situations distinctes.
 */
function buildStack(options = {}) {
  const modelProvider = options.modelProvider ?? createProvider(options.provider);
  const { registry, invocations } = createFakeToolRegistry();
  const deps = { modelProvider, toolRegistry: registry, observer: options.observer };

  const agents = [
    new ResearchAgent(deps),
    new AnalysisAgent(deps),
    new VerificationAgent(deps),
    new WriterAgent(deps),
  ].map((agent) =>
    agent.id === options.breakAgent ? brokenAgent(agent, options.breakMessage ?? 'PANNE_AGENT') : agent
  );

  const brains = new GnoxeBrains({
    agents,
    toolRegistry: registry,
    modelProvider,
    config: { defaultModel: 'gnoxe-brains-1', ...options.config },
    observer: options.observer,
    executor: options.executor,
  });

  return { brains, modelProvider, registry, invocations, agents, observer: options.observer };
}

function assertPublicFailure(mission, { message }) {
  assert.equal(mission.status, 'FAILED');
  assert.equal(mission.result, null);
  assert.equal(typeof mission.error, 'string');
  assert.ok(mission.error.includes(message), `message public attendu : ${mission.error}`);
  assert.equal(mission.error.includes('\n'), false, 'message public sur une seule ligne');
  assert.equal(mission.error.includes('    at '), false, 'aucune stack trace publiee');
  assert.ok(mission.error.length <= 501, 'message public borne');
  assert.equal(typeof mission.errorCode, 'string');
  assert.equal(typeof mission.errorClass, 'string');
}

// ------------------------------------------------------------------- succes

test('succes complet : mission terminee, aucune trace d echec', async () => {
  const { brains } = buildStack();

  const { mission, result } = await brains.run({ objective: OBJECTIVE });

  assert.equal(mission.status, 'COMPLETED');
  assert.equal(mission.error, undefined);
  assert.equal(mission.errorCode, undefined);
  assert.equal(mission.errorClass, undefined);
  assert.ok(mission.plan.steps.every((s) => s.status === 'COMPLETED'));
  assert.equal(result.content, 'Reponse finale fournie par le fake model.');
});

test('compatibilite : run({objective}) et run({objective, context.messages})', async () => {
  const { brains } = buildStack();

  const simple = await brains.run({ objective: OBJECTIVE });
  assert.equal(simple.mission.status, 'COMPLETED');
  assert.equal(simple.mission.context.messages, undefined);

  const history = [
    { role: 'system', content: 'SYSTEME' },
    { role: 'user', content: 'CONTEXTE_MARQUEUR' },
  ];
  const withHistory = await brains.run({ objective: OBJECTIVE, context: { messages: history } });
  assert.equal(withHistory.mission.status, 'COMPLETED');
  assert.deepEqual(
    withHistory.mission.context.messages.map((m) => m.content),
    ['SYSTEME', 'CONTEXTE_MARQUEUR']
  );
  assert.notEqual(simple.mission.id, withHistory.mission.id);
});

test('answer() et answerStream() restent inchanges', async () => {
  const { brains } = buildStack();
  const messages = [
    { role: 'system', content: 'SYSTEME' },
    { role: 'user', content: 'Salut' },
  ];

  const answer = await brains.answer({ messages });
  assert.equal(answer.model, 'gnoxe-brains-1');
  assert.equal(answer.provider, 'fake-offline');
  assert.ok(answer.content.length > 0);

  const chunks = [];
  for await (const chunk of brains.answerStream({ messages })) chunks.push(chunk);
  assert.equal(chunks[chunks.length - 1].type, 'done');
  assert.equal(chunks[chunks.length - 1].content, answer.content);
});

// ------------------------------------------------------- echec par agent

for (const [label, agentId, stepOrder] of [
  ['ResearchAgent', 'research', 0],
  ['AnalysisAgent', 'analysis', 1],
  ['VerificationAgent', 'verification', 2],
  ['WriterAgent', 'writer', 3],
]) {
  test(`echec ${label} : mission FAILED, etape FAILED, pas de faux COMPLETED`, async () => {
    const { brains, observer } = buildStack({
      breakAgent: agentId,
      breakMessage: `PANNE_${agentId.toUpperCase()}`,
      observer: new MemoryObserver(500),
    });

    await assert.rejects(
      () => brains.run({ objective: OBJECTIVE }),
      (error) => {
        assert.equal(error.message, `PANNE_${agentId.toUpperCase()}`);
        assert.equal(error.errorClass, 'STEP');
        return true;
      }
    );

    const [mission] = brains.listMissions();
    assertPublicFailure(mission, { message: `PANNE_${agentId.toUpperCase()}` });
    assert.equal(mission.errorClass, 'STEP');

    const steps = mission.plan.steps;
    assert.equal(steps[stepOrder].status, 'FAILED');
    assert.equal(steps[stepOrder].error, `PANNE_${agentId.toUpperCase()}`);
    for (const step of steps.slice(stepOrder + 1)) {
      assert.notEqual(step.status, 'COMPLETED', 'aucune etape suivante executee');
      assert.equal(step.status, 'PENDING');
    }
    for (const step of steps.slice(0, stepOrder)) {
      assert.equal(step.status, 'COMPLETED');
    }

    assert.ok(
      observer.scope('agent').some((e) => e.status === 'failed' && e.agentId === agentId),
      'echec agent observe'
    );
    assert.ok(
      observer.scope('step').some((e) => e.status === 'failed' && e.phase === 'FAILED'),
      'echec etape observe'
    );
    const failedMission = observer.scope('mission').find((e) => e.status === 'failed');
    assert.equal(failedMission.phase, 'FAILED');
    assert.equal(failedMission.errorCode, 'Error');
    assert.ok(failedMission.errorMessage.includes(`PANNE_${agentId.toUpperCase()}`));
  });
}

// ------------------------------------------------------------- provider

test('echec provider : classe DEPENDENCY, mission FAILED, code exploitable', async () => {
  const { brains, observer } = buildStack({
    provider: { offline: true, error: 'MODELE_HORS_SERVICE' },
    observer: new MemoryObserver(500),
  });

  await assert.rejects(
    () => brains.run({ objective: OBJECTIVE }),
    (error) => {
      assert.equal(error.message, 'MODELE_HORS_SERVICE');
      assert.equal(error.errorClass, 'DEPENDENCY');
      return true;
    }
  );

  const [mission] = brains.listMissions();
  assertPublicFailure(mission, { message: 'MODELE_HORS_SERVICE' });
  assert.equal(mission.errorClass, 'DEPENDENCY');
  assert.equal(mission.errorCode, 'Error');
  assert.equal(mission.plan.steps[0].status, 'FAILED');
  assert.equal(mission.plan.steps[1].status, 'PENDING');

  const failed = observer.scope('mission').find((e) => e.status === 'failed');
  assert.equal(failed.errorCode, 'Error');
  assert.equal(failed.errorMessage, mission.error);
});

test('echec provider : la marque de dependance ne change pas le code operationnel', async () => {
  const { brains } = buildStack({
    provider: { offline: true, error: Object.assign(new Error('MODELE_HS'), { code: 'MODELE_HS' }) },
  });

  await assert.rejects(() => brains.run({ objective: OBJECTIVE }));

  const [mission] = brains.listMissions();
  assert.equal(mission.errorCode, 'MODELE_HS', 'le code metier d origine est conserve');
  assert.equal(mission.errorClass, 'DEPENDENCY');
});

// ------------------------------------------------------------------ tool

test('echec tool : mission degradee, jamais un echec, evenement tool/failed', async () => {
  const observer = new MemoryObserver(500);
  const modelProvider = createProvider();
  const registry = new ToolRegistry();
  const invocations = [];
  registry.register({
    name: 'web-search',
    description: 'Recherche simulee.',
    parameters: { type: 'object', properties: { query: { type: 'string' } } },
    async execute() {
      invocations.push(1);
      throw new Error('RESEAU_INDISPO');
    },
  });

  const deps = { modelProvider, toolRegistry: registry, observer };
  const brains = new GnoxeBrains({
    agents: [
      new ResearchAgent(deps),
      new AnalysisAgent(deps),
      new VerificationAgent(deps),
      new WriterAgent(deps),
    ],
    toolRegistry: registry,
    modelProvider,
    observer,
  });

  const { mission, result } = await brains.run({ objective: OBJECTIVE });

  assert.equal(mission.status, 'COMPLETED', 'un outil en echec ne rate pas la mission');
  assert.equal(mission.error, undefined);
  assert.equal(invocations.length, 1);
  assert.ok(result.data.warnings.includes('TOOL_FAILED:web-search'));

  const toolEvents = observer.scope('tool');
  assert.deepEqual(toolEvents.map((e) => e.status), ['started', 'failed']);
  assert.equal(toolEvents[1].errorCode, 'Error');
  assert.equal(toolEvents[1].errorMessage, 'RESEAU_INDISPO');
});

// -------------------------------------------------------- executor externe

test("executor qui leve une exception : mission cloturee en FAILED, jamais bloquee", async () => {
  const { brains, observer } = buildStack({
    executor: {
      execute() {
        throw new Error('EXECUTOR_BUG');
      },
    },
    observer: new MemoryObserver(500),
  });

  await assert.rejects(
    () => brains.run({ objective: OBJECTIVE }),
    (error) => {
      assert.equal(error.message, 'EXECUTOR_BUG');
      assert.equal(error.errorClass, 'UNKNOWN', 'provenance inconnue : jamais devinee');
      return true;
    }
  );

  const [mission] = brains.listMissions();
  assertPublicFailure(mission, { message: 'EXECUTOR_BUG' });
  assert.equal(mission.errorClass, 'UNKNOWN');
  assert.notEqual(mission.status, 'RUNNING');
  assert.ok(observer.scope('mission').some((e) => e.status === 'failed'));
});

test("executor qui rejette sans cloturer : la facade cloture la mission", async () => {
  const { brains } = buildStack({
    executor: {
      async execute() {
        return { content: 'resultat sans cloture', durationMs: 1 };
      },
    },
  });

  const { mission, result } = await brains.run({ objective: OBJECTIVE });

  assert.equal(mission.status, 'COMPLETED');
  assert.equal(result.content, 'resultat sans cloture');
  assert.equal(mission.result.content, 'resultat sans cloture');
});

test('une mission deja terminale n est jamais re-marquee', async () => {
  const { brains } = buildStack({
    executor: {
      async execute(mission) {
        mission.status = 'COMPLETED';
        mission.result = { content: 'deja cloturee', durationMs: 1, data: {} };
        throw new Error('APRES_CLOTURE');
      },
    },
  });

  await assert.rejects(
    () => brains.run({ objective: OBJECTIVE }),
    (error) => {
      assert.equal(error.message, 'APRES_CLOTURE');
      return true;
    }
  );

  const [mission] = brains.listMissions();
  assert.equal(mission.status, 'COMPLETED', 'un etat terminal est stable');
  assert.equal(mission.error, undefined);
  assert.equal(mission.result.content, 'deja cloturee');
});

test('mission jamais bloquee en RUNNING : toutes les exceptions cloturent', async () => {
  const executors = [
    { name: 'sync', execute() { throw new Error('SYNC_BUG'); } },
    { name: 'async', async execute() { throw new Error('ASYNC_BUG'); } },
    { name: 'reject', execute() { return Promise.reject(new Error('REJECT_BUG')); } },
    { name: 'string', execute() { throw 'VALEUR_BRUTE'; } },
    { name: 'undefined', execute() { throw undefined; } },
  ];

  for (const executor of executors) {
    const { brains } = buildStack({ executor });
    await assert.rejects(() => brains.run({ objective: OBJECTIVE }));

    const [mission] = brains.listMissions();
    assert.notEqual(mission.status, 'RUNNING', `${executor.name} : mission non bloquee`);
    assert.equal(mission.status, 'FAILED', `${executor.name} : statut final FAILED`);
    assert.equal(typeof mission.error, 'string', `${executor.name} : message public present`);
    assert.equal(typeof mission.errorClass, 'string', `${executor.name} : classe presente`);
  }
});

test('le moteur refuse toute operation sur une mission terminee', async () => {
  const engine = new MissionEngine();
  const mission = engine.create('Objectif termine');
  engine.complete(mission, { content: 'resultat' });

  assert.throws(() => engine.complete(mission, { content: 'autre' }), /deja terminee/);
  assert.throws(() => engine.fail(mission, 'apres coup'), /deja terminee/);
  assert.throws(() => engine.cancel(mission), /deja terminee/);
  assert.throws(() => engine.addStep(mission, { title: 'Etape tardive' }), /deja terminee/);
  assert.throws(() => engine.transition(mission, 'FAILED'), /invalide/);

  assert.equal(mission.status, 'COMPLETED', "l'etat terminal est stable");
  assert.equal(mission.error, undefined);
  assert.equal(mission.errorClass, undefined);
});

test('executer une mission deja terminee est refuse sans la re-marquer', async () => {
  const engine = new MissionEngine();
  const mission = engine.create('Mission deja terminee');
  engine.complete(mission, { content: 'premier resultat' });

  const orchestrator = new Orchestrator({
    engine,
    agents: [],
    toolRegistry: emptyRegistry(),
  });

  await assert.rejects(
    () => orchestrator.execute(mission),
    (error) => {
      assert.equal(error.name, 'OrchestratorError');
      assert.equal(error.code, 'MISSION_TERMINEE');
      assert.equal(classifyMissionError(error), 'EXECUTION');
      return true;
    }
  );

  assert.equal(mission.status, 'COMPLETED');
  assert.equal(mission.error, undefined, 'un etat terminal ne recoit jamais de signature d echec');
  assert.equal(mission.result.content, 'premier resultat');
  assert.equal(mission.plan, null, 'aucune planification lancee');
});

// ------------------------------------------------------ classification

test('classification : chaque situation d echec porte sa categorie', async () => {
  const ghostAgent = (id) => ({
    id,
    name: id,
    description: id,
    objective: id,
    capabilities: [],
    availableTools: [],
    execute: async () => ({ agentId: id, content: 'x', data: {}, toolsUsed: [], durationMs: 1 }),
  });

  const scenarios = [
    {
      label: 'validation a la facade',
      createsMission: false,
      build: () => buildStack(),
      run: (brains) => brains.run({ objective: '   ' }),
      errorName: 'GnoxeBrainsError',
      missionClass: undefined,
    },
    {
      label: 'plan vide',
      createsMission: true,
      build: () => {
        const { registry, modelProvider } = buildStack();
        return {
          brains: new GnoxeBrains({
            agents: [],
            toolRegistry: registry,
            modelProvider,
          }),
        };
      },
      run: (brains) => brains.run({ objective: OBJECTIVE }),
      errorName: 'OrchestratorError',
      missionClass: 'EXECUTION',
      errorCode: 'PLAN_VIDE',
    },
    {
      label: 'agent introuvable',
      createsMission: true,
      build: () => {
        const { registry, modelProvider } = buildStack();
        return {
          brains: new GnoxeBrains({
            agents: [ghostAgent('present')],
            planBuilder: () => [{ title: 'Etape fantome', agentId: 'manquant' }],
            toolRegistry: registry,
            modelProvider,
          }),
        };
      },
      run: (brains) => brains.run({ objective: OBJECTIVE }),
      errorName: 'OrchestratorError',
      missionClass: 'STEP',
      errorCode: 'AGENT_INTROUVABLE',
    },
    {
      label: 'tool indisponible',
      createsMission: true,
      build: () => {
        const { registry, modelProvider } = buildStack();
        const agent = { ...ghostAgent('chercheur'), availableTools: ['outil-absent'] };
        return {
          brains: new GnoxeBrains({
            agents: [agent],
            toolRegistry: registry,
            modelProvider,
          }),
        };
      },
      run: (brains) => brains.run({ objective: OBJECTIVE }),
      errorName: 'OrchestratorError',
      missionClass: 'DEPENDENCY',
      errorCode: 'TOOL_UNAVAILABLE',
    },
  ];

  for (const scenario of scenarios) {
    const { brains } = scenario.build();

    await assert.rejects(
      () => scenario.run(brains),
      (error) => {
        assert.equal(error.name, scenario.errorName, scenario.label);
        assert.equal(typeof error.errorClass, 'string', `${scenario.label} : classe sur l'erreur`);
        return true;
      }
    );

    const missions = brains.listMissions();

    if (!scenario.createsMission) {
      assert.equal(missions.length, 0, `${scenario.label} : aucune mission creee`);
      continue;
    }

    assert.equal(missions.length, 1, scenario.label);
    const [mission] = missions;
    assert.equal(mission.status, 'FAILED', scenario.label);
    assert.equal(mission.errorClass, scenario.missionClass, scenario.label);
    assert.equal(mission.errorCode, scenario.errorCode, scenario.label);
    assert.equal(typeof mission.error, 'string', scenario.label);
    assert.notEqual(mission.status, 'RUNNING', scenario.label);
  }
});

// ---------------------------------------------------- isolation / idempotence

test('deux appels de run() avec le meme objectif produisent deux missions distinctes', async () => {
  const { brains, invocations } = buildStack();

  const first = await brains.run({ objective: OBJECTIVE });
  const second = await brains.run({ objective: OBJECTIVE });

  assert.notEqual(first.mission.id, second.mission.id);
  assert.equal(first.mission.status, 'COMPLETED');
  assert.equal(second.mission.status, 'COMPLETED');
  assert.notEqual(first.mission.result, second.mission.result, 'aucun objet de resultat partage');
  assert.notEqual(first.mission.context, second.mission.context, 'aucun contexte partage');
  assert.equal(brains.listMissions().length, 2);
  assert.equal(invocations.length, 2, 'le tool est rejoue, pas partage');
});

test('deux missions simultanees sont isolees', async () => {
  const { brains } = buildStack();

  const [a, b] = await Promise.all([
    brains.run({ objective: 'Premiere mission', context: { channel: 'web', userId: 'u-1' } }),
    brains.run({ objective: 'Seconde mission', context: { channel: 'whatsapp', userId: 'u-2' } }),
  ]);

  assert.equal(a.mission.status, 'COMPLETED');
  assert.equal(b.mission.status, 'COMPLETED');
  assert.notEqual(a.mission.id, b.mission.id);
  assert.notEqual(a.mission.objective, b.mission.objective);
  assert.equal(a.mission.context.channel, 'web');
  assert.equal(b.mission.context.channel, 'whatsapp');
  assert.equal(a.mission.context.userId, 'u-1');
  assert.equal(b.mission.context.userId, 'u-2');
  assert.deepEqual(Object.keys(a.mission.plan.steps), Object.keys(b.mission.plan.steps));
  assert.notEqual(a.mission.plan.steps[0].id, b.mission.plan.steps[0].id);
});

test("le contexte d'une mission est inaccessible a une autre", async () => {
  const { brains } = buildStack();

  const withHistory = await brains.run({
    objective: 'Mission avec historique',
    context: { messages: [{ role: 'user', content: 'SECRET_UN' }] },
  });
  const withoutHistory = await brains.run({ objective: 'Mission sans historique' });

  assert.equal(withHistory.mission.context.messages.length, 1);
  assert.equal(withoutHistory.mission.context.messages, undefined);
  assert.equal(JSON.stringify(withoutHistory.mission).includes('SECRET_UN'), false);
  assert.equal(JSON.stringify(withHistory.mission).includes('SECRET_DEUX'), false);
});

test("les observateurs ne melangent pas les evenements de deux missions", async () => {
  const observerA = new MemoryObserver(500);
  const observerB = new MemoryObserver(500);

  const a = buildStack({ observer: observerA });
  const b = buildStack({ observer: observerB });

  const first = await a.brains.run({ objective: 'Mission A' });
  const second = await b.brains.run({ objective: 'Mission B' });

  const ids = (observer) => new Set(observer.events.map((e) => e.missionId));
  assert.deepEqual([...ids(observerA)], [first.mission.id]);
  assert.deepEqual([...ids(observerB)], [second.mission.id]);
  assert.equal(observerA.events.length > 0, true);
  assert.equal(observerB.events.length > 0, true);
  assert.ok(!observerA.events.some((e) => e.missionId === second.mission.id));
  assert.ok(!observerB.events.some((e) => e.missionId === first.mission.id));
});

test('les agents sont reutilisables d une execution a lautre', async () => {
  const { brains, agents, modelProvider } = buildStack();

  const first = await brains.run({ objective: OBJECTIVE });
  const second = await brains.run({ objective: OBJECTIVE });

  assert.equal(first.mission.status, 'COMPLETED');
  assert.equal(second.mission.status, 'COMPLETED');
  assert.deepEqual(agents.map((a) => a.id), ['research', 'analysis', 'verification', 'writer']);
  assert.equal(
    modelProvider.calls.length >= 8,
    true,
    'les memes agents rappellent le modele a chaque execution'
  );
  assert.notEqual(first.mission.plan.steps[0].id, second.mission.plan.steps[0].id);
});

test('le ToolRegistry ne conserve aucun etat propre a une mission', async () => {
  const { brains, registry, invocations } = buildStack();
  const namesBefore = registry.names().slice();
  const sizeBefore = registry.size();

  await brains.run({ objective: OBJECTIVE });
  await brains.run({ objective: OBJECTIVE });

  assert.deepEqual(registry.names(), namesBefore, 'aucun tool ajoute ni retire');
  assert.equal(registry.size(), sizeBefore);
  assert.equal(invocations.length, 2, "l'etat d'execution n'est pas stocke dans le registre");
  assert.equal(registry.get('web-search').name, 'web-search');
});

// ---------------------------------------------------------------- timeout

test("comportement actuel du timeout : missionTimeoutMs n est jamais applique", async () => {
  const base = createProvider();
  const wait = () => new Promise((resolve) => setTimeout(resolve, 40));
  const slowProvider = {
    name: 'slow-provider',
    async generate(request) {
      await wait();
      return base.generate(request);
    },
    async *stream(request) {
      for await (const chunk of base.stream(request)) yield chunk;
    },
    async structuredOutput(request) {
      await wait();
      return base.structuredOutput(request);
    },
    capabilities() {
      return base.capabilities();
    },
  };

  const { registry } = createFakeToolRegistry();
  const agents = [
    new ResearchAgent({ modelProvider: slowProvider, toolRegistry: registry }),
    new AnalysisAgent({ modelProvider: slowProvider, toolRegistry: registry }),
    new VerificationAgent({ modelProvider: slowProvider, toolRegistry: registry }),
    new WriterAgent({ modelProvider: slowProvider, toolRegistry: registry }),
  ];
  const brains = new GnoxeBrains({
    agents,
    toolRegistry: registry,
    modelProvider: slowProvider,
    config: { missionTimeoutMs: 5, defaultModel: 'gnoxe-brains-1' },
  });

  assert.equal(brains.getConfig().missionTimeoutMs, 5, 'la valeur est bien stockee');
  assert.equal(brains.getConfig().defaultModel, 'gnoxe-brains-1');

  const { mission } = await brains.run({ objective: OBJECTIVE });

  assert.equal(mission.status, 'COMPLETED', 'aucune minuterie : la mission n est pas interrompue');
  assert.ok(mission.result.durationMs > 0);
});

test('la valeur par defaut du timeout reste 0 (illimite, non applique)', async () => {
  const { brains } = buildStack();
  assert.equal(brains.getConfig().missionTimeoutMs, 0);
});

// ------------------------------------------------------- observabilite

test('observabilite des echecs : coherentes, sans contenu sensible', async () => {
  const observer = new MemoryObserver(500);
  const { brains } = buildStack({
    provider: { offline: true, error: 'MODELE_HORS_SERVICE' },
    observer,
  });

  await assert.rejects(() =>
    brains.run({
      objective: 'OBJECTIF_TRES_SENSIBLE',
      context: { messages: [{ role: 'user', content: 'HISTORIQUE_TRES_SENSIBLE' }] },
    })
  );

  const events = observer.events;
  const payload = JSON.stringify(events);

  assert.ok(events.some((e) => e.scope === 'mission' && e.status === 'failed'));
  assert.ok(events.some((e) => e.scope === 'step' && e.status === 'failed'));
  assert.ok(events.some((e) => e.scope === 'agent' && e.status === 'failed'));
  assert.ok(events.some((e) => e.scope === 'mission' && e.status === 'started'));

  for (const leak of [
    'OBJECTIF_TRES_SENSIBLE',
    'HISTORIQUE_TRES_SENSIBLE',
    '    at ',
    '\\n',
  ]) {
    assert.equal(payload.includes(leak), false, `fuite dans les evenements : ${leak}`);
  }
  for (const event of events) {
    assert.equal(
      typeof event.errorMessage === 'string' && event.errorMessage.includes('\n'),
      false,
      'aucun message d evenement multiligne'
    );
  }
});

test('un evenement de mission echouee porte code, classe et phase', async () => {
  const observer = new MemoryObserver(500);
  const { brains } = buildStack({ observer, breakAgent: 'analysis', breakMessage: 'PANNE_ANALYSE' });

  await assert.rejects(() => brains.run({ objective: OBJECTIVE }));

  const failed = observer.scope('mission').find((e) => e.status === 'failed');
  assert.equal(failed.phase, 'FAILED');
  assert.equal(failed.errorCode, 'Error');
  assert.equal(failed.errorMessage, 'PANNE_ANALYSE');
  assert.equal(typeof failed.durationMs, 'number');
  assert.equal(failed.missionId, observer.scope('mission')[0].missionId);
});
