import { ChatMessage } from '@eyano/types';

/**
 * Garde de rappel au point de contact.
 *
 * EXPERIENCE (etape 34) : placer la contrainte la plus proche possible de la
 * question, plutot que de la rajouter dans le system prompt ou l'identite.
 *
 * Resultats e32/e33 : declarer les bornes de la fenetre (e33) et declarer la
 * frontiere dans l'identite n'a empeche aucune des trois fabrications
 * (rappel hors fenetre, rappel hors index, fausse prememisse). L'hypothese
 * testee ici est que la POSITION de la contrainte compte plus que son
 * volume. Si cet essai echoue aussi, le prompt n'est pas le bon mecanisme.
 *
 * Le module reste genrique : aucune marque, aucune identite. C'est un
 * contrat d'utilisation de l'historique fourni, pas une voix.
 *
 * Une seule ligne d'insertion dans `buildChatContext` : si l'essai echoue,
 * la suppression est immediate et sans collateral.
 */

/** Tete du bloc, utilisee aussi comme marqueur d'idempotence. */
export const RECALL_GUARD_HEAD = '### RÈGLE DE RAPPEL POUR CE MESSAGE';

/**
 * Texte de la garde. Le `ou affirme que tu lui as dit quelque chose` est la
 * seule extension par rapport au brouillon : sans elle, la regle ne couvre
 * pas le piege du tour 15 (l'utilisateur affirme un souvenir au lieu de le
 * demander), qui fait pourtant partie des mesures voulues.
 */
export const RECALL_GUARD = [
  RECALL_GUARD_HEAD,
  "Si l'utilisateur demande ce qu'il a dit ou ce que tu as dit à un tour précis, ou affirme que tu lui as dit quelque chose :",
  "1. utilise uniquement les messages effectivement présents dans l'historique visible ;",
  "2. si l'élément demandé n'est pas présent, dis que tu ne peux pas le vérifier ;",
  '3. ne remplace jamais un souvenir absent par un contenu similaire, plausible ou issu de ton identité.',
].join('\n');

/**
 * Pose la garde juste apres le dernier message utilisateur.
 *
 * Non mutante : renvoie le meme tableau si rien n'est a faire. La garde ne
 * s'attache jamais a un message assistant ni s'il existe deja.
 *
 * `extra` est un bloc de donnees (le Recall Resolver, etape 35) pose APRES
 * la regle, donc le plus proche de la generation : le modele lit d'abord ce
 * qu'il doit faire, ensuite le resultat concret qu'il doit utiliser.
 */
export function applyRecallGuard(messages: ChatMessage[], extra?: string | null): ChatMessage[] {
  const last = messages[messages.length - 1];

  if (!last || last.role !== 'user') return messages;
  if (last.content.includes(RECALL_GUARD_HEAD)) return messages;

  const blocks = [RECALL_GUARD, extra || ''].filter(Boolean).join('\n\n');

  const guarded = [...messages];
  guarded[guarded.length - 1] = {
    ...last,
    content: `${last.content}\n\n${blocks}`,
  };
  return guarded;
}

/**
 * Etape 43 : les MEMES blocs de donnees, au MEME point de contact, sans la
 * garde. Controle experimental uniquement (garde ON/OFF a donnees egales).
 * Contenu produit : celui d'`applyRecallGuard` moins le seul texte
 * `RECALL_GUARD`.
 */
export function attachRecallData(messages: ChatMessage[], data?: string | null): ChatMessage[] {
  const last = messages[messages.length - 1];

  if (!data || !last || last.role !== 'user') return messages;

  const attached = [...messages];
  attached[attached.length - 1] = { ...last, content: `${last.content}\n\n${data}` };
  return attached;
}
