import { AgentExecuteInput, AgentResult, BaseAgent } from './agent';

export type WriterData = {
  /** Sources transmises par les etapes precedentes et reprises dans la reponse. */
  sourcesUsed: string[];
  /** Nombre de resultats d'etapes consommes. */
  inputResultCount: number;
};

/**
 * Specialiste de redaction finale.
 *
 * Responsabilite unique : transformer les resultats valides en reponse
 * claire pour l'utilisateur. Il n'ajoute aucune information qui ne soit
 * deja presente dans les materiaux fournis.
 *
 * CONTRAT STRICT - le Writer :
 * - ne declare AUCUN outil (`availableTools` vide) : il ne recherche rien ;
 * - ne formule aucune affirmation factuelle nouvelle (chiffre, date, source,
 *   nom) qui ne fige deja dans `previousResults` ;
 * - produit uniquement le contenu redactionnel : sa `data` se limite aux
 *   sources recueillies aux etapes precedentes et au nombre d'entrees
 *   consommees ;
 * - conserve la distinction donnees verifiees / contenu non etabli en
 *   reprenant tels quels les marqueurs des etapes (`[NON VERIFIE]`,
 *   `NON ETABLI`) et en le signalant explicitement quand c'est le cas ;
 * - rend un `content` : c'est ce contenu, et lui seul, qui devient
 *   `MissionResult.content`.
 *
 * Ce n'est ni un agent generaliste, ni un second moteur de recherche.
 */
export class WriterAgent extends BaseAgent {
  readonly id = 'writer';
  readonly name = 'WriterAgent';
  readonly description =
    'Rediger la reponse finale a partir des resultats valides.';
  readonly objective =
    'Produire une reponse finale claire sans jamais inventer de nouvelle information.';
  readonly capabilities = ['redaction', 'synthese', 'mise en forme'];
  readonly availableTools: string[] = [];

  protected systemInstruction(): string {
    return [
      'Tu es le specialiste en redaction de GnoxeBrains.',
      'Tu rediges la reponse finale a partir exclusivement des materiaux qui te sont fournis.',
      'Tu n inventes aucun chiffre, aucune date, aucune source et aucun fait absent des materiaux.',
      'Si une information manque ou est marquee comme non verifiee, tu le dis explicitement dans la reponse.',
      'Tu supprimes les repetitions et tu gardes uniquement ce qui sert lutilisateur.',
    ].join(' ');
  }

  protected buildUserPrompt(input: AgentExecuteInput, task: string): string {
    // Nettoyage A.3 : le writer est generique et ne connait aucun canal. Le
    // format propre a un canal (WhatsApp...) vient de la voix fournie par
    // l'application (`context.systemPrompt`, registre de canal).
    const sections: string[] = [
      'Format attendu : reponse directe, structurée si le sujet le merite.',
    ];

    sections.push(super.buildUserPrompt(input, task));
    return sections.join('\n\n');
  }

  async execute(input: AgentExecuteInput): Promise<AgentResult> {
    const startedAt = Date.now();
    const previous = input.previousResults ?? [];

    const task = [
      'Redige la reponse finale destinee a lutilisateur.',
      previous.length === 0
        ? 'Aucun materiau fourni : indique que linformation nest pas disponible plutot que de linventer.'
        : 'Appuie-toi uniquement sur les resultats des etapes precedents ci-dessus.',
    ].join('\n\n');

    const response = await this.plain(input, task);

    const sourcesUsed = [
      ...new Set(previous.flatMap((r) => (Array.isArray(r.sources) ? r.sources : []))),
    ];

    return this.makeResult({
      startedAt,
      content: response.content,
      data: { sourcesUsed, inputResultCount: previous.length },
      sources: sourcesUsed,
      model: response.model,
      provider: response.provider,
      usage: response.usage,
      warnings: previous.length === 0 ? ['AUCUN_MATERIAU'] : [],
    });
  }
}
