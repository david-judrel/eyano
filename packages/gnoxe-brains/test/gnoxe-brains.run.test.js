'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GnoxeBrains,
  ToolRegistry,
  ResearchAgent,
  AnalysisAgent,
  VerificationAgent,
  WriterAgent,
} = require('../dist/index.js');

/**
 * FakeModelProvider : aucune cle, aucun reseau, aucun backend reel.
 * C'est le point d'injection qui prouve que la chaine
 * `GnoxeBrains -> MissionEngine -> Orchestrator -> Agents -> ModelProvider`
 * fonctionne sans jamais toucher a un provider concret.
 */
function createFakeModelProvider(options = {}) {
  const providerName = options.name || 'fake-backend';
  const calls = [];

  const structured = (system) => {
    if (system.includes('specialiste en recherche')) {
      return (
        options.research ?? {
          findings: [
            {
              title: 'Origine du nom',
              summary: "Eyano signifie reponse en lingala.",
              source: 'https://eyano.example/nom',
            },
          ],
          sources: ['https://eyano.example/nom'],
        }
      );
    }
    if (system.includes('specialiste en analyse')) {
      return (
        options.analysis ?? {
          summary: 'Eyano est un assistantdeveloppe par Gnoxe Technology.',
          conclusions: [
            {
              statement: 'David Judrel GNONDABEKA est le createur d Eyano.',
              kind: 'FACT',
              rationale: 'Fourni par le contexte de la mission.',
            },
          ],
        }
      );
    }
    if (system.includes('specialiste en verification')) {
      return (
        options.verification ?? {
          overall: 'RELIABLE',
          items: [
            {
              claim: 'David Judrel GNONDABEKA est le createur d Eyano.',
              status: 'VERIFIED',
              note: 'Conforme aux materiaux fournis.',
            },
          ],
        }
      );
    }
    return options.structured ?? {};
  };

  return {
    name: providerName,
    calls,

    async generate(request) {
      calls.push({ kind: 'generate', model: request.model });
      if (options.generateError) throw options.generateError;
      return {
        content: options.text || 'Reponse finale fournie par le fake model.',
        model: request.model || 'gnoxe-brains-1',
        provider: providerName,
      };
    },

    async *stream(request) {
      const response = await this.generate(request);
      yield { type: 'text', content: response.content };
      yield { type: 'done', content: response.content };
    },

    async structuredOutput(request) {
      calls.push({ kind: 'structuredOutput', model: request.model });
      if (options.structuredError) throw options.structuredError;
      const system = request.messages[0] ? String(request.messages[0].content) : '';
      return structured(system);
    },

    capabilities() {
      return {
        streaming: true,
        structuredOutput: true,
        images: false,
        models: ['gnoxe-brains-1', 'gnoxe-brains-1.5'],
      };
    },
  };
}

/** FakeToolRegistry : tool `web-search` local, aucun appel reseau. */
function createFakeToolRegistry() {
  const registry = new ToolRegistry();
  const invocations = [];

  registry.register({
    name: 'web-search',
    description: 'Recherche web simulee pour les tests.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxResults: { type: 'number' },
      },
    },
    async execute(args) {
      invocations.push(args);
      return JSON.stringify({
        query: args.query,
        results: [
          {
            title: 'Gnoxe Technology',
            url: 'https://eyano.example/gnoxe',
            snippet: 'Brazzaville, Congo.',
          },
        ],
      });
    },
  });

  return { registry, invocations };
}

function buildStack(options = {}) {
  const modelProvider = createFakeModelProvider(options.model);
  const { registry, invocations } = createFakeToolRegistry();
  const deps = { modelProvider, toolRegistry: registry };

  const agents = [
    new ResearchAgent(deps),
    new AnalysisAgent(deps),
    new VerificationAgent(deps),
    new WriterAgent(deps),
  ];

  const brains = new GnoxeBrains({
    agents,
    toolRegistry: registry,
    config: { defaultModel: 'gnoxe-brains-1' },
  });

  return { brains, modelProvider, invocations };
}

test('GnoxeBrains.run() de bout en bout : MissionEngine -> Orchestrator -> 4 Agents -> ModelProvider', async () => {
  const { brains, modelProvider, invocations } = buildStack();

  const { mission, result } = await brains.run({
    objective: 'Qui a cree Eyano ?',
    context: { channel: 'whatsapp', userId: 'u-1' },
  });

  assert.equal(mission.status, 'COMPLETED');
  assert.equal(mission.context.channel, 'whatsapp');
  assert.equal(mission.context.userId, 'u-1');

  assert.equal(mission.plan.steps.length, 4);
  assert.deepEqual(
    mission.plan.steps.map((s) => s.agentId),
    ['research', 'analysis', 'verification', 'writer']
  );
  assert.ok(mission.plan.steps.every((s) => s.status === 'COMPLETED'));

  assert.ok(modelProvider.calls.length >= 4, 'au moins un appel modele par agent');
  assert.equal(invocations.length, 1, 'le tool web-search est invoque une seule fois');

  assert.equal(result.content, 'Reponse finale fournie par le fake model.');
  assert.equal(mission.result.content, result.content);
  assert.equal(result.provider, 'fake-backend');
  assert.equal(result.model, 'gnoxe-brains-1');
  assert.equal(result.data.planSteps, 4);
  assert.deepEqual(result.data.steps[0].toolsUsed, ['web-search']);
  assert.equal(mission.plan.steps[0].toolIds[0], 'web-search');
  assert.equal(typeof result.durationMs, 'number');
});

test('GnoxeBrains.run() : echec du model -> mission FAILED et erreur propagee', async () => {
  const offline = new Error('MODELE_HORS_SERVICE');
  const { brains } = buildStack({
    model: { structuredError: offline, generateError: offline },
  });

  await assert.rejects(
    () => brains.run({ objective: 'Mission sans modele' }),
    (err) => {
      assert.equal(err.message, 'MODELE_HORS_SERVICE');
      return true;
    }
  );

  const [mission] = brains.listMissions();
  assert.equal(mission.status, 'FAILED');
  assert.equal(mission.error, 'MODELE_HORS_SERVICE');
  assert.equal(mission.result, null);
  assert.equal(mission.plan.steps[0].status, 'FAILED');
  assert.equal(mission.plan.steps[1].status, 'PENDING');
});

test('GnoxeBrains.run() : contexte transmis tel quel aux agents', async () => {
  const seen = [];
  const { brains, modelProvider } = buildStack();
  const original = modelProvider.structuredOutput.bind(modelProvider);

  modelProvider.structuredOutput = async (request) => {
    seen.push(request.messages[1].content);
    return original(request);
  };

  await brains.run({
    objective: 'Verifier la transmission',
    context: { channel: 'whatsapp', model: 'gnoxe-brains-1.5' },
  });

  assert.equal(seen.length, 3);
  assert.ok(seen.every((prompt) => prompt.includes('Objectif de la mission :')));
  assert.ok(seen.every((prompt) => prompt.includes('canal: whatsapp')));
  assert.ok(seen.every((prompt) => prompt.includes('modele: gnoxe-brains-1.5')));
  assert.ok(seen[1].includes('Resultats des etapes precedentes'), 'agent suivant informe');
});
