import { promises as fs } from 'fs';
import * as path from 'path';
import { ChatMessage } from '@eyano/types';

/**
 * Abstraction minimale de persistance du contexte conversationnel WhatsApp.
 *
 * Objectif (etape 8) : conserver et transmettre le contexte utile d'un JID
 * au-dela du redemarrage du processus, SANS construire de memoire avancee,
 * de memoire vectorielle ni de memoire autonome.
 *
 * Le stockage reste remplace : l'injection d'une autre implementation
 * (base de donnees, ...) ne touche pas au service WhatsApp.
 */
export interface WhatsAppHistoryStore {
  /** Historique d'un JID, ou une liste vide si rien n'est enregistre. */
  load(jid: string): Promise<ChatMessage[]>;
  /** Historique et coordonnees de conversation (etape 41). */
  loadHistory(jid: string): Promise<StoredHistory>;
  /**
   * Remplace l'historique d'un JID. `firstTurn` : tour reel du premier
   * message utilisateur conserve (1 = rien n'a ete supprime).
   */
  save(jid: string, messages: ChatMessage[], firstTurn?: number | null): Promise<void>;
}

/**
 * Etape 41 : le service TRONQUE l'historique stocke. Sans coordonnees, le
 * cerveau prenait les 30 derniers messages pour toute la conversation :
 * "tour 12" rendait le contenu du tour 22, et une recherche de provenance
 * se disait exhaustive. On persiste donc le tour reel du premier message
 * utilisateur conserve.
 */
export interface StoredHistory {
  messages: ChatMessage[];
  /**
   * `1` : historique complet. `n` : les tours 1 a n-1 ont ete supprimes.
   * `null` : supprimes, nombre inconnu. `undefined` : ancien format, non
   * enregistre (au service de decider).
   */
  firstTurn?: number | null;
}

/**
 * Les images sont des pieces jointes en base64 (jusqu'a 10 Mo) : on ne les
 * persiste pas. Elles restent disponibles en memoire vive le temps de la
 * session, ce qui conserve le comportement courant du service.
 */
function toPersistable(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

function isFirstTurn(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && (value as number) >= 1);
}

/**
 * Deux formats lus : l'ancien (tableau seul, coordonnees inconnues) et le
 * format e41 `{ firstTurn, messages }`. Tout le reste : historique vide.
 */
function parseHistory(raw: string): StoredHistory {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { messages: parsed.filter(isPersisted) };
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.messages)) {
      const history: StoredHistory = { messages: parsed.messages.filter(isPersisted) };
      if (isFirstTurn(parsed.firstTurn)) history.firstTurn = parsed.firstTurn;
      return history;
    }
  } catch {
    // JSON corrompu : traite comme absent.
  }
  return { messages: [] };
}

function serialize(messages: ChatMessage[], firstTurn?: number | null): string {
  const record: { firstTurn?: number | null; messages: ChatMessage[] } = {
    messages: toPersistable(messages),
  };
  if (firstTurn !== undefined) record.firstTurn = firstTurn;
  return JSON.stringify(record);
}

function isPersisted(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ChatMessage>;
  return (
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string'
  );
}

export class InMemoryWhatsAppHistoryStore implements WhatsAppHistoryStore {
  private readonly data = new Map<string, string>();

  async load(jid: string): Promise<ChatMessage[]> {
    return (await this.loadHistory(jid)).messages;
  }

  async loadHistory(jid: string): Promise<StoredHistory> {
    const raw = this.data.get(jid);
    return raw ? parseHistory(raw) : { messages: [] };
  }

  async save(jid: string, messages: ChatMessage[], firstTurn?: number | null): Promise<void> {
    this.data.set(jid, serialize(messages, firstTurn));
  }
}

/**
 * Stockage fichier : un document JSON par JID.
 *
 * Choisi pour son cout minimal (aucune migration, aucun schema) tout en
 * survivant a un redemarrage. Les ecritures sont atomiques (fichier
 * temporaire puis renommage) pour eviter un JSON tronque en cas d'arret.
 */
export class FileWhatsAppHistoryStore implements WhatsAppHistoryStore {
  constructor(private readonly directory: string) {}

  private fileFor(jid: string): string {
    const safe = jid.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    return path.join(this.directory, `${safe || 'unknown'}.json`);
  }

  async load(jid: string): Promise<ChatMessage[]> {
    return (await this.loadHistory(jid)).messages;
  }

  async loadHistory(jid: string): Promise<StoredHistory> {
    try {
      return parseHistory(await fs.readFile(this.fileFor(jid), 'utf-8'));
    } catch {
      return { messages: [] };
    }
  }

  async save(jid: string, messages: ChatMessage[], firstTurn?: number | null): Promise<void> {
    await fs.mkdir(this.directory, { recursive: true });

    const target = this.fileFor(jid);
    const temporary = `${target}.${process.pid}.tmp`;

    await fs.writeFile(temporary, serialize(messages, firstTurn), 'utf-8');
    await fs.rename(temporary, target);
  }
}

/** Historique en memoire d'un JID, avec ses coordonnees resolues. */
export interface BoundedHistory {
  messages: ChatMessage[];
  /** Tour reel du premier message utilisateur conserve ; `null` : inconnu. */
  firstTurn: number | null;
}

/**
 * Coordonnees d'un historique charge. L'ancien format ne les enregistrait
 * pas : un tableau plus court que la borne n'a jamais ete tronque (tour 1),
 * un tableau a la borne a pu l'etre, sans trace (inconnu).
 */
export function resolveStoredHistory(stored: StoredHistory, maxHistory: number): BoundedHistory {
  if (stored.firstTurn !== undefined) {
    return { messages: stored.messages, firstTurn: stored.firstTurn };
  }
  return {
    messages: stored.messages,
    firstTurn: stored.messages.length < maxHistory ? 1 : null,
  };
}

/**
 * Ajoute un message et tronque a `maxHistory`, en tenant le compte des
 * tours supprimes : chaque message utilisateur retire decale d'un tour le
 * premier tour conserve. Mutation en place (cache du service).
 */
export function appendBounded(history: BoundedHistory, message: ChatMessage, maxHistory: number): void {
  history.messages.push(message);
  if (history.messages.length <= maxHistory) return;

  const removed = history.messages.splice(0, history.messages.length - maxHistory);
  if (history.firstTurn !== null) {
    history.firstTurn += removed.filter((entry) => entry.role === 'user').length;
  }
}
