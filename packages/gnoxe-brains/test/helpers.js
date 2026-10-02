'use strict';

const { MissionEngine, ToolRegistry } = require('../dist/index.js');

/**
 * Agent factice conforme au contrat `Agent`.
 * Aucun service externe : ni model, ni reseau, ni tool reel.
 */
function fakeAgent(id, options = {}) {
  return {
    id,
    name: options.name || id,
    description: options.description || `Agent ${id}`,
    objective: options.objective || `Objectif ${id}`,
    capabilities: options.capabilities || [],
    availableTools: options.availableTools || [],
    execute(input) {
      if (options.onExecute) options.onExecute(input);
      if (options.fail) {
        const error =
          options.error instanceof Error
            ? options.error
            : new Error(options.error || `Echec ${id}`);
        if (options.errorCode) error.code = options.errorCode;
        return Promise.reject(error);
      }
      const result = {
        agentId: id,
        content: options.content !== undefined ? options.content : `SORTIE:${id}`,
        data: options.data || {},
        toolsUsed: options.toolsUsed || [],
        durationMs: 1,
      };
      if (options.sources) result.sources = options.sources;
      if (options.model) result.model = options.model;
      if (options.provider) result.provider = options.provider;
      if (options.warnings) result.warnings = options.warnings;
      return Promise.resolve(result);
    },
  };
}

/** MissionEngine qui journalise chaque transition d'etat. */
class SpyMissionEngine extends MissionEngine {
  constructor() {
    super();
    this.transitions = [];
  }

  transition(mission, next) {
    this.transitions.push(`${mission.status}->${next}`);
    return super.transition(mission, next);
  }
}

/** Journal d'execution partage par plusieurs agents factices. */
function createExecutionLog() {
  const entries = [];
  return {
    entries,
    order() {
      return entries.map((e) => e.agentId);
    },
    of(agentId) {
      return entries.find((e) => e.agentId === agentId);
    },
  };
}

/** Registre de tools vide : aucune execution d'outil reelle. */
function emptyRegistry() {
  return new ToolRegistry();
}

/**
 * FakeModelProvider : aucune cle, aucun reseau, aucun backend reel.
 *
 * Sert les quatre agents (sortie structuree) et la redaction (texte).
 * Les metadonnees operationnelles renvoyees (`model`, `provider`) sont
 * volontairement distinctes de `gnoxe-brains-*` afin de prouver la
 * propagation jusqu'au `MissionResult`.
 */
function createFakeModelProvider(options = {}) {
  const providerName = options.name || 'fake-backend';
  const calls = [];

  const structuredFor = (system) => {
    if (system.includes('specialiste en recherche')) {
      return (
        options.research ?? {
          findings: [
            {
              title: 'Origine du nom',
              summary: 'Eyano signifie reponse en lingala.',
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
          summary: 'Eyano est un assistant developpe par Gnoxe Technology.',
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
      calls.push({ kind: 'generate', request });
      if (options.generateError) throw options.generateError;
      return {
        content: options.content || 'Reponse finale fournie par le fake model.',
        model: request.model || 'gnoxe-brains-1',
        provider: providerName,
      };
    },

    async *stream(request) {
      calls.push({ kind: 'stream', request });
      if (options.streamError) throw options.streamError;
      const chunks = options.chunks || ['Reponse ', 'simulee.'];
      for (const chunk of chunks) {
        yield { type: 'text', content: chunk };
      }
      yield { type: 'done', content: chunks.join('') };
    },

    async structuredOutput(request) {
      calls.push({ kind: 'structuredOutput', request });
      if (options.structuredError) throw options.structuredError;
      const system = request.messages[0] ? String(request.messages[0].content) : '';
      return structuredFor(system);
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

/**
 * Registre de tools factice : un seul tool `web-search`, aucun reseau.
 * `options.error` force l'echec de l'execution (evenement `tool` en echec).
 */
function createFakeToolRegistry(options = {}) {
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
      if (options.error) throw options.error;
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

module.exports = {
  fakeAgent,
  SpyMissionEngine,
  createExecutionLog,
  emptyRegistry,
  createFakeModelProvider,
  createFakeToolRegistry,
};
