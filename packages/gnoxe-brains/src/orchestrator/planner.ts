import { Mission } from '../missions/types';
import { Agent } from '../agents/agent';

/**
 * Description d'une etape avant materialisation par le MissionEngine.
 *
 * Le planner ne fabrique pas de `MissionStep` : il declare l'intention.
 * C'est l'Orchestrator qui appelle `MissionEngine.addStep()` afin que le
 * moteur reste l'unique producteur d'identifiants et d'ordre.
 */
export interface PlanStepSpec {
  title: string;
  description?: string;
  agentId?: string;
  toolIds?: string[];
}

/**
 * Contrat d'un planner.
 *
 * Deterministe a l'etape 7 : meme objectif + memes agents = meme plan.
 * Un planner autonome (adapte au contexte) pourra etre introduit plus tard
 * sans changer ce contrat.
 */
export type PlanBuilder = (mission: Mission, agents: Agent[]) => PlanStepSpec[];

/**
 * Pipeline canonique de GnoxeBrains.
 *
 * Ordre fixe et borne : pas de rebouclage, pas de re-planification pendant
 * l'execution. Une mission ne peut pas inventer d'etape en cours de route.
 */
export const DEFAULT_PLAN_ORDER: readonly string[] = [
  'research',
  'analysis',
  'verification',
  'writer',
];

const PLAN_STEP_TITLES: Record<string, { title: string; description: string }> = {
  research: {
    title: 'Recherche',
    description: "Collecter les informations utiles a l'objectif.",
  },
  analysis: {
    title: 'Analyse',
    description: 'Analyser les informations collectees et en extraire les points cles.',
  },
  verification: {
    title: 'Verification',
    description: "Verifier la coherence et la fiabilite des conclusions avant restitution.",
  },
  writer: {
    title: 'Redaction',
    description: 'Rediger la reponse finale destinee a l\'utilisateur.',
  },
};

/**
 * Planificateur deterministe : pipeline `recherche -> analyse -> verification
 * -> redaction`, filtre sur les agents reelslement disponibles.
 *
 * Les agents hors pipeline (fournis par l'application ou les tests) sont
 * ajoutes en fin de plan, dans l'ordre ou ils ont ete fournis.
 */
export function buildDeterministicPlan(mission: Mission, agents: Agent[]): PlanStepSpec[] {
  const byId = new Map<string, Agent>();
  for (const agent of agents) {
    if (agent?.id && !byId.has(agent.id)) byId.set(agent.id, agent);
  }

  const specs: PlanStepSpec[] = [];
  const consumed = new Set<string>();

  for (const id of DEFAULT_PLAN_ORDER) {
    const agent = byId.get(id);
    if (!agent) continue;

    const title = PLAN_STEP_TITLES[id];
    specs.push({
      title: title ? title.title : `Etape ${id}`,
      description: title ? title.description : agent.objective,
      agentId: agent.id,
      toolIds: [...agent.availableTools],
    });
    consumed.add(agent.id);
  }

  for (const agent of agents) {
    if (consumed.has(agent.id)) continue;
    consumed.add(agent.id);

    specs.push({
      title: `Etape ${agent.name}`,
      description: agent.objective,
      agentId: agent.id,
      toolIds: [...agent.availableTools],
    });
  }

  return specs;
}
