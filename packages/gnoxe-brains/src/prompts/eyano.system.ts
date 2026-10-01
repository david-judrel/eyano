import { ChatMessage } from '@eyano/types';
import { applyRecallGuard } from './recall-guard';
import { buildRecallLookup } from '../recall/recall-resolver';
import { describeVisibleTurns, missingTurns } from '../recall/visible-turns';

/**
 * System instruction : ce que la couche superieure injecte, plus les
 * fragments de session que seul le transport connait.
 *
 * REGLE (etape 27) : ce module ne porte AUCUNE identite. Le cerveau est
 * generique : la voix d'Eyano est fournie par `systemPrompt`, construite par
 * `@eyano/eyano-identity`. Sans injection, seuls les fragments session
 * (prenom, canal) peuvent former un system message.
 */
/**
 * Bornes reelles de la fenetre, generees depuis le decoupage effectif.
 *
 * Un modele ne peut pas distinguer un evenement evince d'un evenement
 * jamais vu s'il ignore ou s'arrete l'historique qu'on lui fournit : face
 * a un trou, il complete. Lui donner les bornes exactes lui permet de
 * separer "absent de la fenetre" de "jamais arrive".
 *
 * Aucune valeur n'est ecrite en dur : tout derive de l'historique et de `max`.
 *
 * Etape 37 : les bornes sont donnees en TOURS, plus en positions de
 * message. "les messages 8 a 27" etait relu comme "a partir du huitieme
 * tour" (e36, ON-1), alors que les tours 5 a 7 etaient visibles.
 */
function visibleWindowStatement(messages: ChatMessage[], max: number): string {
  const turns = describeVisibleTurns(messages, max);
  const missing = missingTurns(turns);

  const sentences: string[] = [];
  if (turns.first !== null && turns.last !== null) {
    sentences.push(
      `Ce contexte contient les tours ${turns.first} à ${turns.last} d'une conversation de ${turns.turnCount} tours (un tour = un message de l'utilisateur et ta réponse).`
    );
  }
  if (missing) {
    const [from, to] = missing;
    const span = from === to ? `Le tour ${from} n'est pas fourni` : `Les tours ${from} à ${to} ne sont pas fournis`;
    sentences.push(
      turns.partialTurn !== null
        ? `${span}, sauf ta réponse au tour ${turns.partialTurn}, placée en tête du contexte.`
        : `${span}.`
    );
  }

  return [
    '### Historique visible',
    sentences.join(' '),
    "Un événement situé hors de cette plage ne doit pas être présenté comme un souvenir certain.",
  ].join('\n');
}

export interface ChatContextOptions {
  /**
   * Recall Resolver (etape 35). Actif par defaut. `false` sert UNIQUEMENT au
   * controle experimental (resolver ON/OFF a scenario egal) : la garde e34,
   * elle, reste toujours posee.
   */
  recallResolver?: boolean;
}

export function buildChatContext(
  messages: ChatMessage[],
  maxContextMessages: number = 20,
  userName?: string,
  channel?: string,
  systemPrompt?: string,
  options: ChatContextOptions = {}
): ChatMessage[] {
  const recent = messages.slice(-maxContextMessages);
  const parts: string[] = [];

  if (systemPrompt) {
    parts.push(systemPrompt);
  }

  if (userName) {
    const firstName = userName.trim().split(/\s+/)[0];
    parts.push(
      `L'utilisateur s'appelle ${firstName}. Tu peux l'interpeller occasionnellement par son prénom de manière naturelle, pas dans chaque réponse.`
    );
  }

  if (channel === 'whatsapp') {
    parts.push(
      'CONTEXTE WHATSAPP: L\'utilisateur te contacte via WhatsApp. Réponses courtes, naturelles, conversationnelles. Tu peux recevoir des images et documents texte - analyse-les. Fichiers non supportés ou trop lourds → explique poliment. Emojis avec modération. Pas de markdown complexe.'
    );
  }

  // Ajoutee seulement s'il existe deja un system message : la borne ANNOTTE
  // un contexte, elle n'en cree jamais. Le contrat "sans voix ni fragment,
  // aucun system" (etape 27) reste donc intact.
  if (parts.length > 0 && messages.length > maxContextMessages) {
    parts.push(visibleWindowStatement(messages, maxContextMessages));
  }

  // Garde de rappel (etape 34) : la contrainte est posee AU POINT DE
  // CONTACT, dans le dernier message utilisateur, et non dans le system
  // instruction. Le transport fusionne tous les roles system en une seule
  // instruction : une regle inseree "avant le dernier message" y serait
  // remontee, et l'experience ne mesurerait rien.
  //
  // Recall Resolver (etape 35) : detecte avant la garde (question brute),
  // rendu apres elle. La donnee ferme la sequence, la regle ne reste donc
  // jamais le dernier mot lu par le modele.
  const lookup =
    options.recallResolver === false
      ? null
      : buildRecallLookup(recent, messages, maxContextMessages);
  const visible = applyRecallGuard(recent, lookup);

  if (parts.length === 0) {
    return visible;
  }

  return [{ role: 'system', content: parts.join('\n\n') }, ...visible];
}

export function buildTitlePrompt(firstMessage: string): string {
  return `Génère un titre court (2-5 mots) pour cette conversation.

Message: "${firstMessage}"

Règles:
- Capturer l'INTENTION ou le SUJET principal
- Creatif et varié
- Pas de markdown, pas de guillemets, juste le titre
- En français`;
}
