import { AgentExecuteInput, AgentResult, BaseAgent } from './agent';

export interface ResearchFinding {
  title: string;
  summary: string;
  source?: string;
}

export type ResearchData = {
  findings: ResearchFinding[];
  sources: string[];
};

function renderResearch(data: ResearchData): string {
  const findings = Array.isArray(data?.findings) ? data.findings : [];
  if (findings.length === 0) {
    return 'Aucune information pertinente trouvee.';
  }

  return findings
    .map((f) => {
      const source = f.source ? ` (${f.source})` : '';
      return `- ${f.title} : ${f.summary}${source}`;
    })
    .join('\n');
}

/**
 * Specialiste de la collecte d'informations.
 *
 * Responsabilite unique : interroger les tools declares, puis structurer
 * ce qui a ete trouve. Il ne conclut pas et ne redige pas la reponse finale.
 */
export class ResearchAgent extends BaseAgent {
  readonly id = 'research';
  readonly name = 'ResearchAgent';
  readonly description =
    'Rassembler des informations et des sources utiles a la mission.';
  readonly objective =
    'Collecter des informations factuelles et leurs sources sans les interpreter.';
  readonly capabilities = ['recherche', 'veille', 'collecte de sources'];
  readonly availableTools = ['web-search'];

  protected systemInstruction(): string {
    return [
      'Tu es le specialiste en recherche de GnoxeBrains.',
      'Recois des requetes, consulte les outils mis a ta disposition et rends un ensemble d informations structurees.',
      'Ne conclus jamais, ne reponds pas a la question finale : tu fournis seulement la matiere.',
      'Chaque information doit porter sa source lorsqu une source existe. Sinon, dis le explicitement.',
    ].join(' ');
  }

  async execute(input: AgentExecuteInput): Promise<AgentResult> {
    const startedAt = Date.now();
    const warnings: string[] = [];
    const toolsUsed: string[] = [];
    const toolSections: string[] = [];

    const query = (input.instruction ?? input.objective).trim().slice(0, 200);

    for (const toolName of this.availableTools) {
      const tool = this.toolRegistry.get(toolName);
      if (!tool) continue;

      const properties = (tool.parameters as { properties?: Record<string, unknown> })
        ?.properties;
      if (!properties || !properties.query) continue;

      const invocation = await this.invokeTool(toolName, { query, maxResults: 5 }, input.missionId);
      if (invocation.ok) {
        toolsUsed.push(toolName);
        toolSections.push(`[outil ${toolName}]\n${invocation.output}`);
      } else {
        warnings.push(`TOOL_FAILED:${toolName}`);
      }
    }

    if (toolsUsed.length === 0) {
      warnings.push('AUCUNE_SOURCE');
    }

    const task = [
      'Reunis les informations utiles pour servir cet objectif.',
      toolSections.length > 0
        ? `Resultats bruts des outils :\n${toolSections.join('\n\n')}`
        : 'Aucun outil na fourni de resultat : travaille a partir de tes connaissances et marque clairement ce qui nest pas confirme par une source.',
      'Reponds uniquement avec un JSON de la forme :',
      '{"findings":[{"title":"...","summary":"...","source":"..."}],"sources":["..."]}',
    ].join('\n\n');

    const outcome = await this.structured<ResearchData>(input, task);
    const data = outcome.data ?? { findings: [], sources: [] };
    const content = outcome.data ? renderResearch(outcome.data) : outcome.content;

    const sources = [
      ...new Set([
        ...(Array.isArray(data.sources) ? data.sources : []),
        ...(Array.isArray(data.findings)
          ? data.findings.map((f) => f.source).filter((s): s is string => Boolean(s))
          : []),
      ]),
    ];

    if (outcome.data && data.findings.length === 0) {
      warnings.push('AUCUNE_INFORMATION');
    }

    return this.makeResult({
      startedAt,
      content,
      data,
      toolsUsed,
      sources,
      model: outcome.model,
      provider: outcome.provider,
      usage: outcome.usage,
      warnings: [...warnings, ...outcome.warnings],
    });
  }
}
