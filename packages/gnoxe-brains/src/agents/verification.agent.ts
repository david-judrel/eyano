import { AgentExecuteInput, AgentResult, BaseAgent } from './agent';

/**
 * Etat d'UNE affirmation soumise au controle.
 *
 * Responsabilite unique : dire ce qu'un controle a donne sur une affirmation
 * precise (confirmee, non confirmee, contredite).
 *
 * Distinctions a respecter :
 * - `AnalysisKind` (analysis.agent.ts) classe la PROVENANCE d'une conclusion,
 *   pas l'issue d'un controle : les deux vocabulaires sont disjoints.
 * - `VerificationOverall` agrege ces etats en un verdict de fiabilite.
 * - `MissionStatus` est un cycle de vie d'execution, pas un contenu.
 */
export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'CONTRADICTORY';

/**
 * Verdict GLOBAL de fiabilite d'un materiau.
 *
 * Responsabilite unique : synthese agregee rendue AVANT le detail des items.
 * Ce n'est ni un etat de mission, ni un etat d'affirmation.
 */
export type VerificationOverall = 'RELIABLE' | 'PARTIAL' | 'UNRELIABLE';

export interface VerificationItem {
  claim: string;
  status: VerificationStatus;
  note?: string;
}

export type VerificationData = {
  overall: VerificationOverall;
  items: VerificationItem[];
};

const STATUS_LABEL: Record<VerificationStatus, string> = {
  VERIFIED: 'VERIFIE',
  UNVERIFIED: 'NON VERIFIE',
  CONTRADICTORY: 'CONTRADICTOIRE',
};

const OVERALL_LABEL: Record<VerificationOverall, string> = {
  RELIABLE: 'FIABLE',
  PARTIAL: 'PARTIELLEMENT FIABLE',
  UNRELIABLE: 'NON FIABLE',
};

function isStatus(value: unknown): value is VerificationStatus {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STATUS_LABEL, value);
}

function isOverall(value: unknown): value is VerificationOverall {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(OVERALL_LABEL, value);
}

/**
 * Ramene chaque valeur a une constante canonique de sa taxonomie.
 *
 * Une seule regle : une valeur inconnue (ancien libelle, modele hors schema)
 * devient `UNVERIFIED` / `PARTIAL`, jamais une valeur d'une autre taxonomie.
 * Le resultat affiche ET le `data` partagent alors le meme vocabulaire.
 */
function normalizeVerification(data: VerificationData): VerificationData {
  const items = Array.isArray(data?.items) ? data.items : [];

  return {
    overall: isOverall(data?.overall) ? data.overall : 'PARTIAL',
    items: items.map((item) => ({
      ...item,
      claim: typeof item?.claim === 'string' ? item.claim : '',
      status: isStatus(item?.status) ? item.status : 'UNVERIFIED',
    })),
  };
}

function renderVerification(data: VerificationData): string {
  const items = Array.isArray(data?.items) ? data.items : [];
  const overall = isOverall(data?.overall) ? data.overall : 'PARTIAL';

  const lines: string[] = [`Verdict : ${OVERALL_LABEL[overall]}`, ''];

  if (items.length === 0) {
    lines.push('Aucun element a verifier dans les materiaux fournis.');
    return lines.join('\n');
  }

  for (const item of items) {
    const status = isStatus(item.status) ? item.status : 'UNVERIFIED';
    lines.push(`[${STATUS_LABEL[status]}] ${item.claim}`);
    if (item.note) lines.push(`  ${item.note}`);
  }

  return lines.join('\n');
}

/**
 * Specialiste de verification.
 *
 * Responsabilite unique : examiner ce qui lui est soumis et dire ce qui
 * tient, ce qui manque et ce qui se contredit. Il ne corrige pas et ne
 * re-ecrit pas la conclusion.
 */
export class VerificationAgent extends BaseAgent {
  readonly id = 'verification';
  readonly name = 'VerificationAgent';
  readonly description =
    'Verifier les informations fournies et signaler ce qui manque ou se contredit.';
  readonly objective =
    'Etablir un verdict de fiabilite en identifiant les elements non verifies ou contradictoires.';
  readonly capabilities = ['verification', 'coherence', 'detection incertitude'];
  readonly availableTools: string[] = [];

  protected systemInstruction(): string {
    return [
      'Tu es le specialiste en verification de GnoxeBrains.',
      'Tu examines les affirmations qui te sont soumises et tu les classes : VERIFIED etabli, UNVERIFIED non etabli, CONTRADICTORY en contradiction avec un autre element.',
      'Tu ne fabriques aucune preuve : labsence de source ou de justification impose UNVERIFIED.',
      'Rends aussi un verdict global : RELIABLE, PARTIAL ou UNRELIABLE.',
    ].join(' ');
  }

  async execute(input: AgentExecuteInput): Promise<AgentResult> {
    const startedAt = Date.now();

    const task = [
      'Verifie chaque affirmation presente dans les materiaux fournis.',
      'Reponds uniquement avec un JSON de la forme :',
      '{"overall":"RELIABLE|PARTIAL|UNRELIABLE","items":[{"claim":"...","status":"VERIFIED|UNVERIFIED|CONTRADICTORY","note":"..."}]}',
    ].join('\n\n');

    const outcome = await this.structured<VerificationData>(input, task);
    const normalized = outcome.data ? normalizeVerification(outcome.data) : undefined;
    const data = normalized ?? { overall: 'PARTIAL' as VerificationOverall, items: [] };
    const content = normalized ? renderVerification(normalized) : outcome.content;

    const warnings = [...outcome.warnings];
    if (normalized && data.items.length === 0) {
      warnings.push('AUCUN_ELEMENT_A_VERIFIER');
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
