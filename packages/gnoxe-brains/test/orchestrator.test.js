'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GnoxeBrains,
  MissionEngine,
  Orchestrator,
  ToolRegistry,
} = require('../dist/index.js');
const { fakeAgent, SpyMissionEngine, createExecutionLog } = require('./helpers.js');

const emptyRegistry = () => new ToolRegistry();

test('mission simple : un agent, une etape, mission COMPLETED', async () => {
  const brains = new GnoxeBrains({
    agents: [fakeAgent('research', { content: 'Bonjour, je suis Eyano.' })],
    toolRegistry: emptyRegistry(),
  });

  const { mission, result } = await brains.run({ objective: 'Saluer Eyano' });

  assert.equal(mission.status, 'COMPLETED');
  assert.equal(mission.plan.steps.length, 1);
  assert.equal(mission.plan.steps[0].agentId, 'research');
  assert.equal(mission.plan.steps[0].status, 'COMPLETED');
  assert.equal(mission.result.content, 'Bonjour, je suis Eyano.');
  assert.equal(result.content, 'Bonjour, je suis Eyano.');
  assert.equal(mission.error, undefined);
});

test('mission multi-agents : 4 agents, 4 etapes ordonnees', async () => {
  const agents = ['research', 'analysis', 'verification', 'writer'].map((id) => fakeAgent(id));
  const brains = new GnoxeBrains({ agents, toolRegistry: emptyRegistry() });

  const { mission } = await brains.run({ objective: 'Analyser un sujet' });

  assert.equal(mission.status, 'COMPLETED');
  assert.equal(mission.plan.steps.length, 4);
  assert.deepEqual(
    mission.plan.steps.map((s) => s.agentId),
    ['research', 'analysis', 'verification', 'writer']
  );
  assert.deepEqual(
    mission.plan.steps.map((s) => s.order),
    [0, 1, 2, 3]
  );
  assert.ok(mission.plan.steps.every((s) => s.status === 'COMPLETED'));
});

test("ordre d'execution impose par le plan, independamment de l'ordre d'injection", async () => {
  const log = createExecutionLog();
  const mk = (id) =>
    fakeAgent(id, {
      onExecute: () => log.entries.push({ agentId: id }),
    });

  const brains = new GnoxeBrains({
    agents: [mk('writer'), mk('research'), mk('verification'), mk('analysis')],
    toolRegistry: emptyRegistry(),
  });

  await brains.run({ objective: 'Respecter le pipeline' });

  assert.deepEqual(log.order(), ['research', 'analysis', 'verification', 'writer']);
});

test('transmission des previousResults aux agents suivants', async () => {
  let received = null;

  const brains = new GnoxeBrains({
    agents: [
      fakeAgent('research', { content: 'DONNEE_RECHERCHE', sources: ['https://example.com'] }),
      fakeAgent('writer', {
        content: 'Reponse assemblée.',
        onExecute: (input) => {
          received = input.previousResults;
        },
      }),
    ],
    toolRegistry: emptyRegistry(),
  });

  const { result } = await brains.run({ objective: 'Enchainer les etapes' });

  assert.ok(Array.isArray(received));
  assert.equal(received.length, 1);
  assert.equal(received[0].agentId, 'research');
  assert.equal(received[0].content, 'DONNEE_RECHERCHE');
  assert.deepEqual(received[0].sources, ['https://example.com']);
  assert.equal(result.content, 'Reponse assemblée.');
});

test('transitions de statuts : PENDING -> PLANNING -> RUNNING -> VERIFYING -> COMPLETED', async () => {
  const engine = new SpyMissionEngine();
  const observed = {};
  let mission;

  const mk = (id) =>
    fakeAgent(id, {
      onExecute: () => {
        observed[id] = mission.status;
      },
    });

  const orchestrator = new Orchestrator({
    engine,
    agents: [mk('research'), mk('analysis'), mk('verification'), mk('writer')],
    toolRegistry: emptyRegistry(),
  });

  mission = engine.create('Etudier le sujet');
  await orchestrator.execute(mission);

  assert.deepEqual(engine.transitions, [
    'PENDING->PLANNING',
    'PLANNING->RUNNING',
    'RUNNING->VERIFYING',
  ]);
  assert.equal(observed.research, 'RUNNING');
  assert.equal(observed.analysis, 'RUNNING');
  assert.equal(observed.verification, 'VERIFYING');
  assert.equal(observed.writer, 'VERIFYING');
  assert.equal(mission.status, 'COMPLETED');
});

test("erreur d'un agent -> mission FAILED et etape FAILED", async () => {
  const brains = new GnoxeBrains({
    agents: [
      fakeAgent('research', { content: 'Premiere etape ok' }),
      fakeAgent('analysis', { fail: true, error: 'PANNE_MODELE' }),
    ],
    toolRegistry: emptyRegistry(),
  });

  await assert.rejects(
    () => brains.run({ objective: 'Mission qui echoue' }),
    (err) => {
      assert.equal(err.message, 'PANNE_MODELE');
      return true;
    }
  );

  const [mission] = brains.listMissions();
  assert.equal(mission.status, 'FAILED');
  assert.equal(mission.error, 'PANNE_MODELE');
  assert.equal(mission.plan.steps[0].status, 'COMPLETED');
  assert.equal(mission.plan.steps[1].status, 'FAILED');
  assert.equal(mission.plan.steps[1].error, 'PANNE_MODELE');
  assert.equal(mission.result, null);
});

test('agent introuvable -> mission FAILED', async () => {
  const brains = new GnoxeBrains({
    agents: [fakeAgent('research')],
    toolRegistry: emptyRegistry(),
    planBuilder: () => [{ title: 'Etape fantome', agentId: 'ghost' }],
  });

  await assert.rejects(
    () => brains.run({ objective: 'Mission fantome' }),
    (err) => {
      assert.equal(err.name, 'OrchestratorError');
      assert.equal(err.code, 'AGENT_INTROUVABLE');
      return true;
    }
  );

  const [mission] = brains.listMissions();
  assert.equal(mission.status, 'FAILED');
  assert.match(mission.error, /ghost/);
  assert.equal(mission.plan.steps[0].status, 'FAILED');
});

test('objectif invalide refuse avant toute execution', async () => {
  const brains = new GnoxeBrains({
    agents: [fakeAgent('research')],
    toolRegistry: emptyRegistry(),
  });

  await assert.rejects(
    () => brains.run({ objective: '   ' }),
    (err) => {
      assert.equal(err.name, 'GnoxeBrainsError');
      assert.equal(err.code, 'INVALID_OBJECTIVE');
      return true;
    }
  );
  assert.equal(brains.listMissions().length, 0);

  const engine = new MissionEngine();
  const orchestrator = new Orchestrator({
    engine,
    agents: [fakeAgent('research')],
    toolRegistry: emptyRegistry(),
  });
  const mission = engine.create('   ');

  await assert.rejects(
    () => orchestrator.execute(mission),
    (err) => {
      assert.equal(err.name, 'OrchestratorError');
      assert.equal(err.code, 'INVALID_OBJECTIVE', 'une regle = un code, quelle que soit la couche');
      return true;
    }
  );
  assert.equal(mission.status, 'FAILED');
});

test('resultat final correctement produit, sans raisonnement interne', async () => {
  const agents = [
    fakeAgent('research', {
      content: 'Faits collectes',
      sources: ['https://example.com'],
      model: 'gnoxe-brains-1',
      provider: 'fake-backend',
    }),
    fakeAgent('analysis', { content: 'Analyse terminee' }),
    fakeAgent('verification', { content: 'Verifie', warnings: ['SOURCE_UNIQUE'] }),
    fakeAgent('writer', { content: 'Reponse finale.' }),
  ];
  const brains = new GnoxeBrains({ agents, toolRegistry: emptyRegistry() });

  const { mission, result } = await brains.run({ objective: 'Produire une reponse' });

  assert.equal(result.content, 'Reponse finale.');
  assert.equal(mission.result.content, 'Reponse finale.');
  assert.equal(typeof result.durationMs, 'number');
  assert.ok(result.durationMs >= 0);
  assert.equal(result.model, 'gnoxe-brains-1');
  assert.equal(result.provider, 'fake-backend');
  assert.equal(result.data.planSteps, 4);
  assert.deepEqual(
    result.data.steps.map((s) => s.agentId),
    ['research', 'analysis', 'verification', 'writer']
  );
  assert.deepEqual(result.data.warnings, ['SOURCE_UNIQUE']);
  assert.deepEqual(Object.keys(result.data).sort(), ['planSteps', 'steps', 'warnings']);
});

test('plan valide mais sans etape -> mission FAILED', async () => {
  const brains = new GnoxeBrains({
    agents: [],
    toolRegistry: emptyRegistry(),
    planBuilder: () => [],
  });

  await assert.rejects(
    () => brains.run({ objective: 'Sans etape' }),
    (err) => {
      assert.equal(err.name, 'OrchestratorError');
      assert.equal(err.code, 'PLAN_VIDE');
      return true;
    }
  );

  const [mission] = brains.listMissions();
  assert.equal(mission.status, 'FAILED');
  assert.match(mission.error, /Plan vide/);
});

test("tool indisponible -> mission FAILED avant execution", async () => {
  const brains = new GnoxeBrains({
    agents: [fakeAgent('research', { availableTools: ['web-search'] })],
    toolRegistry: emptyRegistry(),
  });

  await assert.rejects(
    () => brains.run({ objective: 'Rechercher sur le web' }),
    (err) => {
      assert.equal(err.name, 'OrchestratorError');
      assert.equal(err.code, 'TOOL_UNAVAILABLE');
      return true;
    }
  );

  const [mission] = brains.listMissions();
  assert.equal(mission.status, 'FAILED');
  assert.match(mission.error, /web-search/);
  assert.equal(mission.plan.steps[0].status, 'PENDING');
});

test('plan pre-construit : les etapes fournies sont executees telles quelles', async () => {
  const log = createExecutionLog();
  const agents = [
    fakeAgent('analysis', { onExecute: () => log.entries.push({ agentId: 'analysis' }) }),
    fakeAgent('research', { onExecute: () => log.entries.push({ agentId: 'research' }) }),
  ];
  const engine = new MissionEngine();
  const orchestrator = new Orchestrator({
    engine,
    agents,
    toolRegistry: emptyRegistry(),
    planBuilder: () => [],
  });

  const mission = engine.create('Mission avec plan recu');
  mission.plan = {
    missionId: mission.id,
    objective: mission.objective,
    createdAt: Date.now(),
    steps: [
      {
        id: 'step_recue_1',
        missionId: mission.id,
        order: 0,
        title: 'Analyse d abord',
        status: 'PENDING',
        agentId: 'analysis',
      },
      {
        id: 'step_recue_2',
        missionId: mission.id,
        order: 1,
        title: 'Recherche ensuite',
        status: 'PENDING',
        agentId: 'research',
      },
    ],
  };

  const result = await orchestrator.execute(mission);

  assert.deepEqual(log.order(), ['analysis', 'research']);
  assert.equal(mission.status, 'COMPLETED');
  assert.equal(result.data.planSteps, 2);
  assert.equal(result.content, 'SORTIE:research');
});

test('agent duplique refuse a la construction de l Orchestrateur', () => {
  const engine = new MissionEngine();
  assert.throws(
    () =>
      new Orchestrator({
        engine,
        agents: [fakeAgent('research'), fakeAgent('research')],
        toolRegistry: emptyRegistry(),
      }),
    (err) => {
      assert.equal(err.name, 'OrchestratorError');
      assert.equal(err.code, 'AGENT_INVALIDE');
      return true;
    }
  );
});
