import { EYANO_IDENTITY } from './identity';

/**
 * Moteur Personality / Behavior d'Eyano (etape 27).
 *
 * Il n'a qu'une seule source de verite : `EYANO_IDENTITY`. Aucune phrase,
 * aucun style, aucun principe n'est ecrit ici : ce module ne fait que
 * ORGANISER la specification en une system instruction executable.
 *
 * Ce qu'il ne fait PAS :
 *   - pas de code de routage : la table intention -> facette est de la
 *     donnee, le modele l'applique ; aucune branche n'est ecrite ici ;
 *   - pas de reponse pre-ecrite : rien n'est code en dur pour
 *     " Qui es-tu ? " ;
 *   - pas de memoire, pas de RAG, pas d'outil, pas d'orchestration ;
 *   - pas de personnage fige : les situations encadrent une decision,
 *     elles n'imposent pas une reaction unique ;
 *   - pas de mention de provider ni de modele externe.
 *
 * Determinisme : fonction pure de `EYANO_IDENTITY` et de `options`.
 * Memes entrees, sortie strictement identique : aucun `Date`, aucun `Math.random`.
 */
export interface EyanoContextOptions {
  /**
   * Canal de conversation. S'il correspond au `context` d'une adaptation de
   * `communicationStyle`, cette adaptation est signalee comme contexte actuel.
   */
  readonly channel?: string;
}

function numbered(items: readonly string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function bullets(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

/**
 * Construit la system instruction d'Eyano.
 *
 * Sections, toutes derivees de `EYANO_IDENTITY` :
 * identite, dessein, principes, personnalite, style de communication,
 * regles de conduite, situations, limites, auto-description.
 */
export function buildEyanoContext(options: EyanoContextOptions = {}): string {
  const identity = EYANO_IDENTITY;
  const channel = options.channel?.trim().toLowerCase();

  const adaptations = identity.communicationStyle.adaptations.map((entry) => {
    const current = Boolean(channel) && entry.context.toLowerCase().includes(channel!);
    return `- ${current ? '[contexte actuel] ' : ''}${entry.context} : ${entry.style}`;
  });

  // Notes de canal : seulement pour le contexte actuel. Sans canal reconnu,
  // la sortie est identique a l'octet pres a ce qu'elle etait avant.
  const channelNotes = identity.communicationStyle.adaptations
    .filter(
      (entry) =>
        Boolean(channel) && Boolean(entry.channelNote) && entry.context.toLowerCase().includes(channel!)
    )
    .map((entry) => `Canal actuel : ${entry.channelNote}`);

  const facets = identity.selfDescription.facets.map(
    (facet) => `- ${facet.aspect} : ${facet.text}`
  );

  const facetIntents = identity.selfDescription.facets.map(
    (facet) => `« ${facet.intent} » -> ${facet.aspect}`
  );

  const nature = [
    ...identity.nature.is.map((fact) => `tu es ${fact}`),
    ...identity.nature.isNot.map((fact) => `tu n'es pas ${fact}`),
  ];

  return [
    `## ${identity.name}`,
    bullets(nature),

    '### Dessein',
    identity.purpose.statement,
    `Domaines : ${identity.purpose.domains.join(', ')}.`,

    '### Principes',
    numbered(identity.principles),

    '### Personnalité',
    `Traits assumés : ${identity.personality.traits.join(', ')}.`,
    `Anti-traits : ${identity.personality.antiTraits.join(', ')}.`,

    '### Style de communication',
    identity.communicationStyle.register,
    'Adaptation au contexte :',
    adaptations.join('\n'),
    ...channelNotes,

    '### Règles de conduite',
    numbered(identity.behavioralRules),

    '### Devant une situation',
    numbered(
      identity.situations.map((situation) => `Si ${situation.when}, ${situation.then}`)
    ),

    '### Limites',
    numbered(identity.boundaries),

    '### Auto-description',
    `Amorce : ${identity.selfDescription.core}`,
    [
      'Ces formulations sont une matière, jamais un script.',
      "Reformule-les selon la conversation, choisis dans la table intention -> facette ci-dessous,",
      'et ne récite aucun texte mot pour mot.',
    ].join(' '),
    'Intention -> facette :',
    bullets(facetIntents),
    facets.join('\n'),
  ].join('\n\n');
}
