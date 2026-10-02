'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  providerRegistry,
  toolRegistry,
  ensureToolsRegistered,
  getGnoxeBrainsConfig,
  OBSERVATION_EVENT_KEYS,
  FORBIDDEN_OBSERVATION_KEYS,
} = require('@eyano/gnoxe-brains');

const {
  MissionsService,
  MissionExecutionError,
} = require('../dist/modules/missions/missions.service.js');

const API_ROOT = path.join(__dirname, '..');
const MISSIONS_SRC = path.join(API_ROOT, 'src', 'modules', 'missions');

const OBJECTIVE =
  'OBJECTIF_MARQUEUR_ETAPE12 : evaluer l opportunite d une boutique en ligne a Brazzaville.';
const FINAL_CONTENT = 'Reponse finale redigee par le test.';
const MODEL_ID = 'gnoxe-brains-1';

// ------------------------------------------------------------------ doubles

function createFakeProvider(name) {
  const calls = [];

  const provider = {
    name,
    async generate(request) {
      calls.push({ kind: 'generate', request });
      return { content: FINAL_CONTENT, model: request.model || MODEL_ID, provider: name };
    },
    async *stream(request) {
      yield { type: 'text', content: 'ok' };
      yield { type: 'done', content: 'ok', model: request.model || MODEL_ID };
    },
    async structuredOutput(request) {
      calls.push({ kind: 'structured', request });

      const system = request.messages[0]?.content || '';
      if (system.includes('## ResearchAgent')) {
        return {
          findings: [
            {
              title: 'Constat',
              summary: 'Issu du tool de recherche.',
              source: 'https://example.org/a',
            },
          ],
          sources: ['https://example.org/a'],
        };
      }
      if (system.includes('## AnalysisAgent')) {
        return {
          summary: 'Synthese du test.',
          conclusions: [
            { statement: 'Constat etabli.', kind: 'FACT', rationale: 'Source unique.' },
          ],
        };
      }
      if (system.includes('## VerificationAgent')) {
        return {
          overall: 'PARTIAL',
          items: [{ claim: 'Constat etabli.', status: 'VERIFIED', note: 'Source presente.' }],
        };
      }
      return {};
    },
    capabilities() {
      return { streaming: true, structuredOutput: true, images: false, models: [MODEL_ID] };
    },
  };

  return { provider, calls };
}

const fake = createFakeProvider('mission-test');
const webSearchCalls = [];

const fakeWebSearch = {
  name: 'web-search',
  description: 'Recherche web simulee : aucun appel reseau.',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' }, maxResults: { type: 'number' } },
  },
  async execute(args) {
    webSearchCalls.push(args);
    return `Resultats factices pour "${args.query}" : https://example.org/a`;
  },
};

// Enregistrement unique : registre de tools reel (web-search remplace par un
// double) et registre de providers sans backend reel (aucun appel reseau).
toolRegistry.clear();
ensureToolsRegistered();
toolRegistry.register(fakeWebSearch, { override: true });

providerRegistry.clear();
providerRegistry.register('mission-test', fake.provider);
providerRegistry.setActive('mission-test');

function resetCalls() {
  fake.calls.length = 0;
  webSearchCalls.length = 0;
}

function readSource(name) {
  return fs.readFileSync(path.join(MISSIONS_SRC, name), 'utf8');
}

// ------------------------------------------------------------ pipeline reel

test('GnoxeBrains.run() pilote un cas reel : plan, agents, tools et resultat', async () => {
  resetCalls();
  const trace = await new MissionsService().run({ objective: OBJECTIVE }, 'admin-42');

  assert.equal(trace.status, 'COMPLETED');
  assert.match(trace.missionId, /^mission_/);
  assert.ok(trace.durationMs >= 0);

  assert.equal(trace.plan.length, 4);
  assert.deepEqual(
    trace.plan.map((step) => step.title),
    ['Recherche', 'Analyse', 'Verification', 'Redaction']
  );
  assert.deepEqual(trace.agents, ['research', 'analysis', 'verification', 'writer']);
  assert.ok(trace.plan.every((step) => step.status === 'COMPLETED'));
  assert.deepEqual(trace.plan[0].toolIds, ['web-search']);

  assert.deepEqual(trace.toolsUsed, ['web-search']);
  assert.equal(webSearchCalls.length, 1);
  assert.equal(typeof webSearchCalls[0].query, 'string');
  assert.ok(webSearchCalls[0].query.length > 0);

  assert.equal(fake.calls.filter((call) => call.kind === 'structured').length, 3);
  assert.equal(fake.calls.filter((call) => call.kind === 'generate').length, 1);

  const firstCallMessages = JSON.stringify(fake.calls[0].request.messages);
  assert.ok(firstCallMessages.includes('OBJECTIF_MARQUEUR_ETAPE12'), 'objectif transmis au modele');

  assert.equal(trace.result.content, FINAL_CONTENT);
  assert.equal(trace.result.model, MODEL_ID);
  assert.deepEqual(trace.result.warnings, []);
  assert.ok(!('provider' in trace.result), 'l identite du backend reste interne');
});

test('le pipeline multi-agents est bien observe de bout en bout', async () => {
  resetCalls();
  const trace = await new MissionsService().run({ objective: OBJECTIVE }, 'admin-42');
  const events = trace.events;

  assert.ok(events.length > 0, 'un observateur reel doit produire des evenements');

  const scopes = new Set(events.map((event) => event.scope));
  for (const scope of ['mission', 'step', 'agent', 'tool']) {
    assert.ok(scopes.has(scope), `portee manquante : ${scope}`);
  }

  const allowed = new Set(OBSERVATION_EVENT_KEYS);
  for (const event of events) {
    for (const key of Object.keys(event)) {
      assert.ok(allowed.has(key), `cle inattendue dans un evenement : ${key}`);
    }
    assert.ok(!('provider' in event), 'aucun evenement ne doit exposer le backend');
  }

  const payload = JSON.stringify(events);
  assert.ok(!payload.includes('OBJECTIF_MARQUEUR_ETAPE12'), 'l objectif ne doit pas fuiter');
  assert.ok(!payload.includes(FINAL_CONTENT), 'le contenu ne doit pas fuiter');
  for (const forbidden of FORBIDDEN_OBSERVATION_KEYS) {
    assert.ok(!payload.includes(`"${forbidden}"`), `cle interdite presente : ${forbidden}`);
  }

  const missionPhases = events
    .filter((event) => event.scope === 'mission')
    .map((event) => event.phase);
  for (const phase of ['PENDING', 'PLANNING', 'RUNNING', 'VERIFYING', 'COMPLETED']) {
    assert.ok(missionPhases.includes(phase), `phase de mission manquante : ${phase}`);
  }

  const agents = events.filter((event) => event.scope === 'agent');
  for (const agentId of ['research', 'analysis', 'verification', 'writer']) {
    assert.ok(
      agents.some((event) => event.agentId === agentId && event.status === 'completed'),
      `agent non observe : ${agentId}`
    );
  }

  const tools = events.filter((event) => event.scope === 'tool');
  assert.ok(
    tools.some((event) => event.toolId === 'web-search' && event.status === 'completed'),
    'invocation du tool non observee'
  );
});

// ------------------------------------------------------------------- echec

test('un echec du fournisseur marque la mission FAILED et propage l erreur', async () => {
  resetCalls();

  const failing = {
    name: 'mission-fail',
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
      return { streaming: true, structuredOutput: true, images: false, models: [MODEL_ID] };
    },
  };

  providerRegistry.register('mission-fail', failing);
  providerRegistry.setActive('mission-fail');

  try {
    await assert.rejects(
      () => new MissionsService().run({ objective: OBJECTIVE }, 'admin-42'),
      (error) => {
        assert.ok(error instanceof MissionExecutionError, 'erreur de mission attendue');
        assert.match(error.missionId, /^mission_/);
        assert.equal(error.message, 'panne du modele');

        const failed = error.events.find(
          (event) => event.scope === 'mission' && event.status === 'failed'
        );
        assert.ok(failed, 'evenement de mission FAILED attendu');
        assert.equal(failed.phase, 'FAILED');
        assert.equal(failed.errorCode, 'Error');

        assert.ok(
          error.events.some(
            (event) =>
              event.scope === 'agent' && event.status === 'failed' && event.agentId === 'research'
          ),
          'echec de l agent observe'
        );
        return true;
      }
    );
  } finally {
    providerRegistry.setActive('mission-test');
  }
});

test('un objectif vide est rejete avant toute execution', async () => {
  await assert.rejects(
    () => new MissionsService().run({ objective: '   ' }),
    (error) => error.name === 'GnoxeBrainsError' && error.code === 'INVALID_OBJECTIVE'
  );
});

// ------------------------------------------------------- injection provider

test('la bascule de fournisseur passe par le registre sans toucher au pipeline', async () => {
  resetCalls();

  const alternate = createFakeProvider('mission-alt');
  providerRegistry.register('mission-alt', alternate.provider);
  providerRegistry.setActive('mission-alt');

  try {
    const trace = await new MissionsService().run({ objective: OBJECTIVE }, 'admin-42');

    assert.equal(trace.status, 'COMPLETED');
    assert.equal(fake.calls.length, 0, 'le fournisseur precedent ne doit plus etre sollicite');
    assert.ok(alternate.calls.length > 0, 'le fournisseur alternatif doit servir la mission');
    assert.ok(!('provider' in trace.result), 'aucun identifiant de backend expose');
  } finally {
    providerRegistry.setActive('mission-test');
  }
});

test('le chemin fonctionne sans observateur explicite', async () => {
  resetCalls();

  const service = new MissionsService();
  service.setObserverFactory(() => undefined);

  const trace = await service.run({ objective: OBJECTIVE }, 'admin-42');

  assert.equal(trace.status, 'COMPLETED');
  assert.equal(trace.plan.length, 4);
  assert.equal(trace.result.content, FINAL_CONTENT);
  assert.deepEqual(trace.events, [], 'sans observateur, aucun evenement');
});

// -------------------------------------------------------- historique (etape 14)

test("l historique de conversation est transmis jusqu au prompt des agents", async () => {
  resetCalls();

  const messages = [
    { role: 'user', content: 'HISTORIQUE_API_MARQUEUR : bonjour' },
    { role: 'assistant', content: 'HISTORIQUE_API_MARQUEUR : salut, je te prie' },
    { role: 'user', content: 'HISTORIQUE_API_MARQUEUR : parle moi de Gnoxe' },
  ];

  const trace = await new MissionsService().run({ objective: OBJECTIVE, messages }, 'admin-42');

  assert.equal(trace.status, 'COMPLETED');

  const structured = fake.calls.filter((call) => call.kind === 'structured');
  assert.equal(structured.length, 3, 'les trois agents a sortie structuree');

  for (const call of structured) {
    const system = call.request.messages[0];
    const user = call.request.messages[1];
    assert.equal(system.role, 'system');
    assert.equal(user.role, 'user');
    assert.ok(
      !system.content.includes('HISTORIQUE_API_MARQUEUR'),
      "l historique ne doit jamais atteindre le systeme"
    );
    assert.ok(user.content.includes('Historique de conversation'), 'section historique attendue');
    assert.ok(user.content.includes('HISTORIQUE_API_MARQUEUR : bonjour'));
    assert.ok(user.content.includes('HISTORIQUE_API_MARQUEUR : parle moi de Gnoxe'));
  }

  const generate = fake.calls.find((call) => call.kind === 'generate');
  assert.ok(generate, 'la redaction doit recevoir le prompt');
  assert.ok(
    generate.request.messages[1].content.includes('Historique de conversation'),
    'le quatrieme agent recoit aussi le contexte'
  );

  assert.ok(
    !JSON.stringify(trace).includes('HISTORIQUE_API_MARQUEUR'),
    "l historique n est jamais expose dans la trace"
  );
});

test('sans historique, aucun prompt ne contient de section historique', async () => {
  resetCalls();

  const trace = await new MissionsService().run({ objective: OBJECTIVE }, 'admin-42');

  assert.equal(trace.status, 'COMPLETED');
  assert.ok(fake.calls.length > 0, 'les agents ont ete sollicites');
  for (const call of fake.calls) {
    assert.ok(
      !call.request.messages[1].content.includes('Historique de conversation'),
      'comportement historique preserve sans messages'
    );
  }
});

test("l historique est borne a maxContextMessages avant transmission", async () => {
  resetCalls();

  const max = getGnoxeBrainsConfig().maxContextMessages;
  assert.ok(max > 0, 'la politique de taille doit etre active');

  const messages = [];
  for (let i = 0; i < 40; i += 1) {
    messages.push({ role: 'user', content: `BOURNE_API_MSG_${String(i).padStart(3, '0')}` });
  }

  const trace = await new MissionsService().run({ objective: OBJECTIVE, messages }, 'admin-42');
  assert.equal(trace.status, 'COMPLETED');

  const structured = fake.calls.filter((call) => call.kind === 'structured');
  assert.ok(structured.length > 0);
  for (const call of structured) {
    const user = call.request.messages[1].content;
    assert.ok(user.includes('BOURNE_API_MSG_039'), 'le message le plus recent est conserve');
    assert.ok(!user.includes('BOURNE_API_MSG_019'), 'les messages sortants sont ecartes');
    assert.ok(!user.includes('BOURNE_API_MSG_000'), 'les messages les plus anciens sont ecartes');
  }

  assert.ok(!JSON.stringify(trace).includes('BOURNE_API_MSG_'), 'la trace reste liberee');
});

// ----------------------------------------------------- gardes applicatives

test('le module missions reste isole et ne nomme aucun fournisseur', () => {
  const tokens = [
    'gemini',
    'Gemini',
    'Google',
    'googleai',
    'GEMINI_API_KEY',
    'getModelProvider',
    'getAIProvider',
    'getKeyManager',
    'GeminiAdapter',
    'GeminiKeyManager',
    'genkit',
    'chatFlow',
    'summaryFlow',
  ];

  for (const file of ['missions.service.ts', 'missions.controller.ts', 'missions.module.ts']) {
    const content = readSource(file);
    for (const token of tokens) {
      assert.ok(!content.includes(token), `${file} ne doit pas contenir "${token}"`);
    }
  }
});

test("l endpoint missions est protege, borne et journalise", () => {
  const controller = readSource('missions.controller.ts');

  assert.ok(
    controller.includes('@UseGuards(AuthGuard, AdminGuard, RateLimitGuard)'),
    'garde authentification, admin et rate limit attendue'
  );
  assert.ok(controller.includes("@Post('run')"), 'route POST /missions/run attendue');
  assert.ok(controller.includes('isRegisteredModel'), 'modele valide avant execution');
  assert.ok(controller.includes('MAX_OBJECTIVE_LENGTH'), 'objectif borne');
  assert.ok(controller.includes("action: 'RUN_MISSION'"), 'execution journalisee en audit');

  const actions = [...controller.matchAll(/action:\s*'([^']+)'/g)].map((match) => match[1]);
  for (const action of actions) {
    assert.ok(!/gemini|google/i.test(action), `action d audit tenant du fournisseur : ${action}`);
  }

  const service = readSource('missions.service.ts');
  assert.ok(service.includes('new GnoxeBrains('), 'le service passe par la facade publique');
  assert.ok(service.includes('.run('), 'execution via GnoxeBrains.run()');
  assert.ok(service.includes('new MemoryObserver('), 'observateur reel branche');

  const appModule = fs.readFileSync(path.join(API_ROOT, 'src', 'app.module.ts'), 'utf8');
  assert.ok(appModule.includes('MissionsModule'), 'module enregistre dans AppModule');
});

test("l endpoint missions valide l historique avant transmission", () => {
  const controller = readSource('missions.controller.ts');

  assert.ok(controller.includes('class MissionMessageDto'), 'contrat de message du DTO');
  assert.ok(controller.includes('normalizeMessages'), 'historique valide avant execution');
  assert.ok(controller.includes("entry.role !== 'user'"), 'seuls les roles de dialogue acceptes');
  assert.ok(
    controller.includes("entry.role !== 'assistant'") ||
      controller.includes("role !== 'assistant'"),
    'role assistant accepte explicitement'
  );
  assert.ok(
    controller.includes('typeof entry.content !== \'string\''),
    'contenu textuel verifie'
  );
  assert.ok(
    controller.includes('model: body.model, messages'),
    'historique transmis au service'
  );
  assert.ok(
    !/role:\s*'system'/.test(controller),
    'aucun role systeme ne peut entrer par cette porte'
  );

  const service = readSource('missions.service.ts');
  assert.ok(
    service.includes('context.messages = input.messages'),
    'historique place dans le contexte de mission'
  );
  assert.ok(
    service.includes('messages?: ChatMessage[]'),
    'le type ChatMessage de @eyano/types est reutilise, pas redefini'
  );
});

// --------------------------------------------- projection applicative (etape 18)

test('la projection API de la mission reste stable : interne non expose', async () => {
  resetCalls();
  const trace = await new MissionsService().run({ objective: OBJECTIVE }, 'admin-42');

  assert.deepEqual(Object.keys(trace).sort(), [
    'agents',
    'durationMs',
    'events',
    'missionId',
    'plan',
    'result',
    'status',
    'toolsUsed',
  ]);

  assert.deepEqual(Object.keys(trace.result).sort(), [
    'content',
    'durationMs',
    'model',
    'warnings',
  ]);

  assert.ok(!('provider' in trace.result), 'identite du backend interdite en API');
  assert.ok(!('usage' in trace.result), "l usage reste interne tant que l API n en a pas besoin");
  assert.ok(!('usage' in trace), "aucun agregat d usage au sommet de la trace");
  assert.ok(!('errorClass' in trace), 'les missions reussies ne portent aucune classe');

  const payload = JSON.stringify(trace.result);
  assert.ok(!payload.includes('OBJECTIF_MARQUEUR_ETAPE12'), 'aucune donnee d usage ou de mission');
});
