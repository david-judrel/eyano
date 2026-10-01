import { Mission, MissionResult } from './types';

/**
 * Contrat entre GnoxeBrains et l'executeur de missions.
 *
 * GnoxeBrains cree la mission, la confie a l'executor puis enregistre l'issue.
 * Le contenu meme de la planification, du choix des agents et des tools est
 * la responsabilite de l'executor (implante par `Orchestrator` a l'etape 7).
 *
 * L'implemente doit etre bornee : une execution = un plan = une fin.
 * Elle cloture elle meme la mission (`COMPLETED`) en cas de succes et la
 * marque en echec (`FAILED`) avant de rejeter, afin que le cycle de vie
 * reste consultable meme utilisee en dehors de GnoxeBrains.
 */
export interface MissionExecutor {
  execute(mission: Mission): Promise<MissionResult>;
}
