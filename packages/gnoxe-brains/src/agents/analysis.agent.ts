import { AgentExecuteInput, AgentResult, BaseAgent } from './agent';

/**
 * Nature d'une conclusion : COMMENT elle a ete etablie.
 *
 * Responsabilite unique : provenance epistemique du contenu produit par
 * l'analyse (etabli, calcule, estime, interpole, non etabli).
 *
 * Distinctions a respecter :
 * - `VerificationStatus` (verification.agent.ts) dit si une affirmation a
 *   SURVENU a un controle : c'est un AUTRE axe, pas le meme.
 * - `VerificationOverall` est un verdict agrege, pas une nature de conclusion.
 * - `MissionStatus` est un cycle de vie d'execution, pas un contenu.
 *
 * Les vocabulaires sont volontairement disjoints : aucune valeur de cette
 * union n'existe dans une autre taxonomie du paquet.
 */
export type AnalysisKind =
  | 'FACT'
  | 'CALCULATED'
  | 'ESTIMATE'
  | 'INTERPRETATION'
  | 'UNESTABLISHED';

export interface AnalysisConclusion {
  statement: string;
  kind: AnalysisKind;
  rationale?: string;
}

export type AnalysisData = {
  summary: string;
  conclusions: AnalysisConclusion[];
};

const KIND_LABEL: Record<AnalysisKind, string> = {
  FACT: 'FAIT',
  CALCULATED: 'CALCUL',
  ESTIMATE: 'ESTIMATION',
  INTERPRETATION: 'INTERPRETATION',
  UNESTABLISHED: 'NON ETABLI',
};

function isAnalysisKind(value: unknown): value is AnalysisKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(KIND_LABEL, value);
}

/**
 * Ramene chaque conclusion a une valeur canonique de `AnalysisKind`.
 *
 * Une seule regle : une valeur inconnue (ancien libelle, modele hors schema)
 * devient `UNESTABLISHED`, jamais une valeur d'une autre taxonomie.
 * Le resultat affiche ET le `data` partagent alors le meme vocabulaire.
 */
function normalizeAnalysis(data: AnalysisData): AnalysisData {
  const conclusions = Array.isArray(data?.conclusions) ? data.conclusions : [];

  return {
    summary: typeof data?.summary === 'string' ? data.summary : '',
    conclusions: conclusions.map((c) => ({
      ...c,
      statement: typeof c?.statement === 'string' ? c.statement : '',
      kind: isAnalysisKind(c?.kind) ? c.kind : 'UNESTABLISHED',
    })),
  };
}

function renderAnalysis(data: AnalysisData): string {
  const conclusions = Array.isArray(data?.conclusions) ? data.conclusions : [];
  const summary = data?.summary?.trim();

  const lines: string[] = [];
  if (summary) lines.push(summary, '');

  if (conclusions.length === 0) {
    lines.push('Aucune conclusion etablie sur la base des elements fournis.');
    return lines.join('\n');
  }

  for (const c of conclusions) {
    const kind = isAnalysisKind(c.kind) ? c.kind : 'UNESTABLISHED';
    lines.push(`[${KIND_LABEL[kind]}] ${c.statement}`);
    if (c.rationale) lines.push(`  justification : ${c.rationale}`);
  }

  return lines.join('\n');
}

/**
 * Specialiste d'analyse.
 *
 * Responsabilite unique : transformer les materiaux fournis en conclusions
 * classees. Il ne rassemble pas d'information (Research) et ne certifie pas
 * (Verification) : il interprete et le dit.
 */
export class AnalysisAgent extends BaseAgent {
  readonly id = 'analysis';
  readonly name = 'AnalysisAgent';
  readonly description =
    'Analyser les elements fournis et en produire des conclusions classees.';
  readonly objective =
    'Produire des conclusions structurees en distinguant faits, calculs, estimations et interpretations.';
  readonly capabilities = ['analyse', 'synthese', 'classification'];
  readonly availableTools: string[] = [];

  protected systemInstruction(): string {
    return [
      'Tu es le specialiste en analyse de GnoxeBrains.',
      'Tu travailles uniquement sur les materiaux qui te sont fournis : tu n inventes aucun fait nouveau.',
      'Classe chaque conclusion : FACT etabli, CALCULATED derive dun calcul, ESTIMATE approxime, INTERPRETATION lecture subjective, UNESTABLISHED non etabli.',
      'Quand une conclusion nest pas solide, dis le plutot que la presenter comme un fait.',
    ].join(' ');
  }

  async execute(input: AgentExecuteInput): Promise<AgentResult> {
    const startedAt = Date.now();

    const task = [
      'Analyse les elements fournis et en tire des conclusions.',
      'Reponds uniquement avec un JSON de la forme :',
      '{"summary":"...","conclusions":[{"statement":"...","kind":"FACT|CALCULATED|ESTIMATE|INTERPRETATION|UNESTABLISHED","rationale":"..."}]}',
    ].join('\n\n');

    const outcome = await this.structured<AnalysisData>(input, task);
    const normalized = outcome.data ? normalizeAnalysis(outcome.data) : undefined;
    const data = normalized ?? { summary: '', conclusions: [] };
    const content = normalized ? renderAnalysis(normalized) : outcome.content;

    const warnings = [...outcome.warnings];
    if (normalized && data.conclusions.length === 0) {
      warnings.push('AUCUNE_CONCLUSION');
    }

    return this.makeResult({
      startedAt,
      content,
      data,
      model: outcome.model,
      provider: outcome.provider,
      usage: outcome.usage,
      warnings,
    });
  }
}
