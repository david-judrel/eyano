'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  GnoxeBrains,
  ToolRegistry,
  MemoryObserver,
  aggregateUsage,
  FORBIDDEN_OBSERVATION_KEYS,
  ResearchAgent,
  AnalysisAgent,
  VerificationAgent,
  WriterAgent,
} = require('../dist/index.js');
const {
  fakeAgent,
  createFakeModelProvider,
  createFakeToolRegistry,
} = require('./helpers');

const SRC = path.join(__dirname, '..', 'src');
const ROOT = path.join(__dirname, '..', '..', '..');
const OBJECTIVE = 'OBJECTIF_MARQUEUR_ETAPE18 : mesurer la telemetrie de mission.';

const AGENT_IDS = ['research', 'analysis', 'verification', 'writer'];

/** Provider factice qui peut rapporter (ou non) un usage par appel. */
function providerWithUsage(usage) {
  const base = createFakeModelProvider();

  return {
    name: base.name,
    calls: base.calls,
    async generate(request) {
      const response = await base.generate(request);
      return usage
        ? { ...response, usage: { model: response.model, provider: response.provider, ...usage } }
        : response;
    },
    async *stream(request) {
      for await (const chunk of base.stream(request)) yield chunk;
    },
    async structuredOutput(request) {
      return base.structuredOutput(request);
    },
    capabilities() {
      return base.capabilities();
    },
  };
}

function buildStack(options = {}) {
  const provider = options.provider ?? createFakeModelProvider();
  const tool = createFakeToolRegistry();
  const observer = options.observer;
  const deps = { modelProvider: provider, toolRegistry: tool.registry, observer };

  const brains = new GnoxeBrains({
    agents: [
      new ResearchAgent(deps),
      new AnalysisAgent(deps),
      new VerificationAgent(deps),
      new WriterAgent(deps),
    ],
    toolRegistry: tool.registry,
    modelProvider: provider,
    config: { defaultModel: 'gnoxe-brains-1' },
    observer,
  });

  return { brains, provider, tool };
}

// ------------------------------------------------- contrat d'usage generique

test('aucun usage : aggregateUsage refuse de fabriquer un zero', () => {
  assert.equal(aggregateUsage([]), undefined, 'une absence reste une absence');
  assert.equal(aggregateUsage([undefined, null]), undefined);
});

test('un appel modele : agregat d une seule entree, sans double comptage', () => {
  const usage = { model: 'gnoxe-brains-1', provider: 'fake-backend', inputTokens: 10, outputTokens: 5 };

  const totals = aggregateUsage([usage]);

  assert.deepEqual(totals, {
    calls: 1,
    callsWithTokens: 1,
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
  });
  assert.equal(totals.inputTokens, usage.inputTokens, 'jamais additionne deux fois');
  assert.equal(totals.outputTokens, usage.outputTokens, 'jamais additionne deux fois');
});

test('plusieurs appels : agregat deterministe et insensible a l ordre', () => {
  const a = { model: 'gnoxe-brains-1', provider: 'fake-backend', inputTokens: 10, outputTokens: 5 };
  const b = { model: 'gnoxe-brains-1', provider: 'fake-backend', inputTokens: 20, outputTokens: 7 };

  const forward = aggregateUsage([a, b]);
  const backward = aggregateUsage([b, a]);

  assert.deepEqual(forward, backward, 'le resultat ne depend pas de l ordre');
  assert.deepEqual(forward, {
    calls: 2,
    callsWithTokens: 2,
    inputTokens: 30,
    outputTokens: 12,
    totalTokens: 42,
  });

  const before = JSON.stringify([a, b]);
  aggregateUsage([a, b]);
  assert.equal(JSON.stringify([a, b]), before, 'aucune mutation des arguments');
});

test('absence de double comptage : une entree sans tokens ne cree ni appel fantome ni total faux', () => {
  const withTokens = {
    model: 'gnoxe-brains-1',
    provider: 'fake-backend',
    inputTokens: 10,
    outputTokens: 5,
  };
  const withoutTokens = { model: 'gnoxe-brains-1', provider: 'fake-backend' };

  const totals = aggregateUsage([withTokens, withoutTokens]);

  assert.equal(totals.calls, 2, 'deux appels reels, deux appels comptes');
  assert.equal(totals.callsWithTokens, 1, 'un seul a fourni un decompte');
  assert.equal(totals.inputTokens, 10, 'le total reflete uniquement ce qui a ete rapporte');
  assert.equal(totals.outputTokens, 5);
  assert.equal(totals.totalTokens, 15);
});

test('totalTokens : derive seulement quand aucune entree ne le fournit', () => {
  const explicit = aggregateUsage([
    { model: 'm', provider: 'p', totalTokens: 100 },
    { model: 'm', provider: 'p', totalTokens: 50 },
  ]);
  assert.equal(explicit.totalTokens, 150, 'somme des totaux fournis');

  const derived = aggregateUsage([
    { model: 'm', provider: 'p', inputTokens: 10, outputTokens: 5 },
    { model: 'm', provider: 'p', inputTokens: 5, outputTokens: 5 },
  ]);
  assert.equal(derived.totalTokens, 25, 'input + output quand aucun total n est donne');

  const mixed = aggregateUsage([
    { model: 'm', provider: 'p', inputTokens: 10, totalTokens: 100 },
    { model: 'm', provider: 'p', inputTokens: 5, outputTokens: 5 },
  ]);
  assert.equal(mixed.totalTokens, 100, 'un total fourni prime, jamais complete a l aveugle');
  assert.equal(mixed.inputTokens, 15);
});

test('le contrat d usage ne reference aucun fournisseur ni SDK concret', () => {
  const usageSource = fs.readFileSync(path.join(SRC, 'observability', 'usage.ts'), 'utf8');
  const providerSource = fs.readFileSync(path.join(SRC, 'providers', 'model-provider.ts'), 'utf8');

  for (const token of [
    'Gemini',
    'gemini',
    'Google',
    'googleai',
    'GEMINI_API_KEY',
    'Genkit',
    'genkit',
    '@genkit-ai',
    'fetch(',
    'process.env',
    'console.',
  ]) {
    assert.ok(!usageSource.includes(token), `usage.ts ne doit pas nommer "${token}"`);
  }

  assert.ok(
    !/from\s+'(?!\.\/)/.test(usageSource),
    'usage.ts n importe aucun module hors observabilite'
  );
  assert.ok(providerSource.includes('usage?: ModelUsage'), 'point d extension present');
  assert.ok(
    !/MODEL_PRICING|pricing|cost/i.test(usageSource),
    "aucun tarif dans le contrat d usage"
  );
});

// ------------------------------------------------------ telemetrie de mission

test('usage absent : aucune telemetrie d usage n est fabriquee', async () => {
  const { brains } = buildStack();

  const { result, mission } = await brains.run({ objective: OBJECTIVE });

  assert.equal('usage' in result, false, 'pas de cle usage quand rien n est observe');
  assert.equal(mission.result.usage, undefined);
  assert.equal(aggregateUsage([]), undefined);
});

test('usage disponible : propage du provider jusqu au MissionResult', async () => {
  const provider = providerWithUsage({ inputTokens: 120, outputTokens: 40, totalTokens: 160 });
  const { brains } = buildStack({ provider });

  const { result } = await brains.run({ objective: OBJECTIVE });

  assert.ok(result.usage, 'un backend qui rapporte un usage doit etre reflete');
  assert.deepEqual(result.usage, {
    calls: 1,
    callsWithTokens: 1,
    inputTokens: 120,
    outputTokens: 40,
    totalTokens: 160,
  });
  // Seul l appel textuel de redaction passe par `generate` : les trois agents
  // a sortie structuree n ont aucun canal d usage. Un seul appel est compte.
  assert.equal(result.usage.calls, 1, 'aucun appel fantome cree');
});

test('modele effectif et provider effectif traces sans invention', async () => {
  const provider = createFakeModelProvider({ name: 'backend-interne' });
  const { brains } = buildStack({ provider });

  const { result } = await brains.run({
    objective: OBJECTIVE,
    context: { model: 'gnoxe-brains-1.5' },
  });

  assert.equal(result.model, 'gnoxe-brains-1.5', 'le modele effectif, pas le modele par defaut');
  assert.equal(result.provider, 'backend-interne', 'interne, jamais expose en API');
  assert.equal(result.data.steps.every((step) => step.model === 'gnoxe-brains-1.5'), true);
});

test('duree : toujours renseignee sur une mission reussie', async () => {
  const { brains } = buildStack();

  const { result } = await brains.run({ objective: OBJECTIVE });

  assert.equal(typeof result.durationMs, 'number');
  assert.ok(result.durationMs >= 0);
  for (const step of result.data.steps) {
    assert.equal(typeof step.durationMs, 'number');
    assert.ok(step.durationMs >= 0);
  }
});

test('mission reussie : telemetrie operationnelle complete', async () => {
  const { brains } = buildStack();

  const { result, mission } = await brains.run({ objective: OBJECTIVE });

  assert.equal(mission.status, 'COMPLETED');
  assert.equal(result.data.planSteps, 4);
  assert.deepEqual(result.data.steps.map((step) => step.agentId), AGENT_IDS);

  const toolIds = [...new Set(result.data.steps.flatMap((step) => step.toolsUsed))];
  assert.deepEqual(toolIds, ['web-search'], 'un outil observe, sans doublon');
  assert.equal(typeof result.durationMs, 'number');
  assert.equal(typeof result.model, 'string');
  assert.deepEqual(result.data.warnings, []);
});

test('plusieurs outils : identifiers agrges sans doublon ni omission', async () => {
  const provider = createFakeModelProvider();
  const registry = new ToolRegistry();
  const executed = [];

  for (const name of ['web-search', 'datetime-tool']) {
    registry.register({
      name,
      description: 'outil factice',
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
      async execute() {
        executed.push(name);
        return `sortie de ${name}`;
      },
    });
  }

  const research = {
    id: 'research',
    name: 'ResearchAgent',
    description: 'collecte',
    objective: 'collecter',
    capabilities: [],
    availableTools: ['web-search', 'datetime-tool'],
    async execute() {
      const outputs = [];
      for (const name of ['web-search', 'datetime-tool']) {
        outputs.push(await registry.execute(name, { query: 'q' }, { agentId: 'research' }));
      }
      return {
        agentId: 'research',
        content: outputs.join('\n'),
        data: {},
        toolsUsed: ['web-search', 'datetime-tool'],
        durationMs: 1,
      };
    },
  };

  const deps = { modelProvider: provider, toolRegistry: registry };
  const brains = new GnoxeBrains({
    agents: [research, new AnalysisAgent(deps), new VerificationAgent(deps), new WriterAgent(deps)],
    toolRegistry: registry,
    modelProvider: provider,
  });

  const { result } = await brains.run({ objective: OBJECTIVE });

  assert.equal(executed.length, 2, 'chaque outil est reellement invoque une fois');
  assert.deepEqual(result.data.steps[0].toolsUsed, ['web-search', 'datetime-tool']);

  const toolIds = [...new Set(result.data.steps.flatMap((step) => step.toolsUsed))];
  assert.equal(toolIds.length, 2, 'les deux outils sont agrges');
  assert.ok(toolIds.includes('web-search') && toolIds.includes('datetime-tool'));
});

test('mission echouee : aucun usage projete, evenements conserves', async () => {
  const observer = new MemoryObserver(500);
  const failing = {
    name: 'fake-backend',
    async generate() {
      throw new Error('panne du modele');
    },
    async *stream() {
      throw new Error('panne du modele');
    },
    async structuredOutput() {
      throw new Error('panne du modele');
    },
    capabilities() {
      return { streaming: true, structuredOutput: true, images: false, models: ['gnoxe-brains-1'] };
    },
  };

  const { brains } = buildStack({ provider: failing, observer });

  let raised;
  try {
    await brains.run({ objective: OBJECTIVE });
  } catch (error) {
    raised = error;
  }

  assert.ok(raised, 'la panne est propagee');
  const mission = brains.listMissions()[0];
  assert.equal(mission.status, 'FAILED');
  assert.equal(mission.result, null, 'aucun resultat, donc aucun usage');
  assert.equal(mission.errorClass, 'DEPENDENCY');

  const events = observer.events;
  assert.ok(
    events.some((event) => event.scope === 'mission' && event.status === 'failed'),
    'l echec reste observable'
  );
  assert.ok(
    events.some((event) => event.scope === 'agent' && event.status === 'failed'),
    "l agent fautive est observe"
  );
});

test('absence de donnees sensibles dans la telemetrie', async () => {
  const observer = new MemoryObserver(500);
  const provider = providerWithUsage({ inputTokens: 12, outputTokens: 4 });
  const { brains } = buildStack({ provider, observer });

  const { result } = await brains.run({ objective: OBJECTIVE });

  const events = JSON.stringify(observer.events);
  assert.ok(!events.includes('OBJECTIF_MARQUEUR_ETAPE18'), "l objectif ne fuit pas");
  for (const forbidden of FORBIDDEN_OBSERVATION_KEYS) {
    assert.ok(!events.includes(`"${forbidden}"`), `cle interdite : ${forbidden}`);
  }

  const usageKeys = Object.keys(result.usage).sort();
  assert.deepEqual(usageKeys, [
    'calls',
    'callsWithTokens',
    'inputTokens',
    'outputTokens',
    'totalTokens',
  ]);
  for (const key of usageKeys) {
    assert.equal(typeof result.usage[key], 'number', `${key} reste numerique`);
  }

  const serialized = JSON.stringify(result.usage);
  assert.ok(!serialized.includes('OBJECTIF_MARQUEUR'), "l usage ne porte aucun objectif");
  assert.ok(!serialized.includes('backend-interne'), "l usage interne reste interne");
});

test("compatibilite : answer() et answerStream() ne changent pas", async () => {
  const provider = createFakeModelProvider({ content: 'Reponse courte.' });
  const brains = new GnoxeBrains({ modelProvider: provider });

  const answer = await brains.answer({ messages: [{ role: 'user', content: 'Salut' }] });
  assert.deepEqual(Object.keys(answer).sort(), ['content', 'model', 'provider']);
  assert.equal(answer.content, 'Reponse courte.');
  assert.equal(!('usage' in answer), true, 'answer() n expose aucun usage');

  const chunks = [];
  for await (const chunk of brains.answerStream({
    messages: [{ role: 'user', content: 'Salut' }],
  })) {
    chunks.push(chunk);
  }
  assert.equal(chunks[chunks.length - 1].type, 'done');
  assert.deepEqual(Object.keys(chunks[chunks.length - 1]).sort(), ['content', 'model', 'provider', 'type']);
});

// ---------------------------------------------------------- pricing historique

test('conservation du pricing historique : tarifs gemini-* preserves, indexes sur le modele', () => {
  const pricingPath = path.join(ROOT, 'apps', 'api', 'src', 'modules', 'usage', 'usage.service.ts');
  const pricing = fs.readFileSync(pricingPath, 'utf8');

  for (const id of [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-2.0-flash',
    'gnoxe-brains-1',
    'gnoxe-brains-1.5',
  ]) {
    assert.ok(pricing.includes(`'${id}'`), `tarif historique conserve : ${id}`);
  }

  const match = pricing.match(/private calculateCost\([^)]*\)[^{]*\{([\s\S]*?)\n  \}/);
  assert.ok(match, 'fonction de calcul introuvable');
  const body = match[1];
  assert.ok(body.includes('MODEL_PRICING[model]'), 'indexation sur le modele');
  assert.ok(!body.includes('provider'), 'le cout ne depend jamais du backend');
  assert.ok(!body.includes('gemini'), 'aucun tarif en dur dans le calcul');
  assert.ok(!/MODEL_PRICING\s*=/.test(body), 'le tableau reste une donnee declarative');

  // La tarification reste hors du paquet d intelligence.
  const brainsSources = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) brainsSources.push(full);
    }
  };
  walk(SRC);

  for (const file of brainsSources) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(
      !content.includes('MODEL_PRICING'),
      `${path.relative(ROOT, file)} ne doit porter aucun tarif`
    );
  }
});
