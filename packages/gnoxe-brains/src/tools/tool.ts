/**
 * Abstraction d'une capacite mobilisable par GnoxeBrains.
 *
 * Un Tool est une fonctionnalite concrete et verifiable (calcul, date,
 * recherche web, lecture de fichier...) exposee de facon homogene afin
 * de pouvoir etre choisie puis invoquee par un Agent.
 *
 * Regle : un Tool ne connait ni le provider de modele, ni les Agents,
 * ni l'Orchestrator. Il recoit des arguments et retourne du texte.
 */
export interface Tool {
  /** Identifiant stable utilise pour la resolution (`calculator`, `web-search`, ...). */
  name: string;
  /** Phrase d'aide a la selection : decrit QUAND utiliser ce tool. */
  description: string;
  /** Schema JSON des arguments attendus. */
  parameters: Record<string, unknown>;
  /** Execution. Retourne une chaine ; les erreurs metier sont rendues comme texte. */
  execute(args: Record<string, unknown>): Promise<string>;
}
