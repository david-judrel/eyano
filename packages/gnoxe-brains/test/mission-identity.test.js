'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { BaseAgent, GnoxeBrains } = require('../dist/index.js');
const { createFakeModelProvider, createFakeToolRegistry, fakeAgent } = require('./helpers.js');

/**
 * Agent de sonde : ne produit rien d'interet, mais expose le message
 * systeme que `BaseAgent.buildMessages` construirait pour lui.
 */
class ProbeAgent extends BaseAgent {
  id = 'probe';
  name = 'ProbeAgent';
  description = 'Agent de sonde du message systeme.';
  objective = 'Observer ce que recoit un agent.';
  capabilities = [];
  availableTools = [];

  systemInstruction() {
    return 'Instruction specifique au probe.';
  }

  async execute() {
    return { agentId: 'probe', content: 'OK', data: {}, toolsUsed: [], durationMs: 1 };
  }

  probe(input, task) {
    return this.buildMessages(input, task);
  }
}

function buildProbe() {
  const modelProvider = createFakeModelProvider();
  const { registry } = createFakeToolRegistry();
  const agent = new ProbeAgent({ modelProvider, toolRegistry: registry });
  return { agent, modelProvider, toolRegistry: registry };
}

test('la voix de la mission ouvre le message systeme', () => {
  const { agent } = buildProbe();

  const messages = agent.probe(
    { objective: 'Objectif observe.', context: { systemPrompt: 'VOIX_EYANO', data: {} } },
    'TACHE'
  );

  assert.equal(messages[0].role, 'system');
  assert.ok(messages[0].content.startsWith('VOIX_EYANO'), 'la voix ouvre le system');
  assert.ok(
    messages[0].content.indexOf('VOIX_EYANO') < messages[0].content.indexOf('ProbeAgent'),
    'la voix precede le nom de l agent'
  );
  assert.ok(messages[0].content.includes('Instruction specifique au probe.'));
  assert.equal(messages[1].role, 'user');
  assert.ok(messages[1].content.includes('TACHE'));
});

test('sans voix : le cerveau ne porte aucune identite', () => {
  const { agent } = buildProbe();

  const messages = agent.probe(
    { objective: 'Objectif observe.', context: { data: {} } },
    'TACHE'
  );

  assert.equal(messages[0].role, 'system');
  assert.equal(messages[0].content.includes('Eyano'), false, 'aucun nom d agent');
  assert.ok(
    messages[0].content.includes('GnoxeBrains'),
    'la personnalite generique du cerveau est bien presente'
  );
  assert.ok(messages[0].content.includes('ProbeAgent'), 'les constantes de l agent restent');
  assert.equal(messages[0].content.startsWith('\n'), false, 'aucune entree vide');
});

test('la voix ne derive jamais de l objectif ni de l historique', () => {
  const { agent } = buildProbe();

  const messages = agent.probe(
    {
      objective: 'OBJECTIF_UTILISATEUR',
      context: {
        systemPrompt: 'VOIX_EYANO',
        messages: [{ role: 'user', content: 'HISTORIQUE_UTILISATEUR' }],
        data: {},
      },
    },
    'TACHE'
  );

  assert.ok(messages[0].content.includes('VOIX_EYANO'));
  assert.equal(messages[0].content.includes('OBJECTIF_UTILISATEUR'), false, 'hors system');
  assert.equal(messages[0].content.includes('HISTORIQUE_UTILISATEUR'), false, 'hors system');

  assert.ok(messages[1].content.includes('OBJECTIF_UTILISATEUR'), 'rendu dans le user');
  assert.ok(messages[1].content.includes('HISTORIQUE_UTILISATEUR'), 'rendu dans le user');
});

test('transmission : run() porte systemPrompt jusqu a l agent', async () => {
  const received = [];
  const modelProvider = createFakeModelProvider();
  const { registry } = createFakeToolRegistry();

  const brains = new GnoxeBrains({
    agents: [fakeAgent('spy', { onExecute: (input) => received.push(input) })],
    toolRegistry: registry,
    modelProvider,
    config: { defaultModel: 'gnoxe-brains-1' },
  });

  const { mission } = await brains.run({
    objective: 'Objectif observe au niveau de l agent.',
    context: { systemPrompt: 'VOIX_EYANO', data: {} },
  });

  assert.equal(mission.status, 'COMPLETED');
  assert.equal(received.length, 1, 'un seul agent execute');
  assert.equal(received[0].context.systemPrompt, 'VOIX_EYANO');
});

test('transmission : la mission conserve la voix dans son contexte', async () => {
  const modelProvider = createFakeModelProvider();
  const { registry } = createFakeToolRegistry();

  const brains = new GnoxeBrains({
    agents: [fakeAgent('spy')],
    toolRegistry: registry,
    modelProvider,
    config: { defaultModel: 'gnoxe-brains-1' },
  });

  const { mission } = await brains.run({
    objective: 'Objectif observe.',
    context: { systemPrompt: 'VOIX_EYANO', data: {} },
  });

  assert.equal(mission.context.systemPrompt, 'VOIX_EYANO');
});

test('mission sans voix : aucune valeur par defaut nest inventee', async () => {
  const received = [];
  const modelProvider = createFakeModelProvider();
  const { registry } = createFakeToolRegistry();

  const brains = new GnoxeBrains({
    agents: [fakeAgent('spy', { onExecute: (input) => received.push(input) })],
    toolRegistry: registry,
    modelProvider,
    config: { defaultModel: 'gnoxe-brains-1' },
  });

  const { mission } = await brains.run({ objective: 'Objectif observe.' });

  assert.equal(mission.status, 'COMPLETED');
  assert.equal(received[0].context.systemPrompt, undefined, 'jamais de voix par defaut');
  assert.equal(mission.context.systemPrompt, undefined);
});
