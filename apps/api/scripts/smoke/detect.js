'use strict';

/**
 * Detection des mentions de backend dans une reponse du modele.
 *
 * Deux niveaux, parce qu'un detecteur binaire produit des faux signaux et
 * perd alors toute valeur experimentale :
 *
 *   - `revelation` : le terme est voisine d'une attribution de fournisseur
 *     (propulse par, mon modele, backend...) => regle d identite violee ;
 *   - `mention`    : le terme apparait comme nom tierce (Google Finance,
 *     XE...) => simple remarque a relire, jamais une accusation ;
 *   - `none`       : rien a signaler.
 *
 * La frontiere n'est pas semantique : c'est une heuristique de voisinage. Le
 * jugement final reste humain, c'est le principe du harness.
 */

const BANNED =
  /gemini|google|openai|anthropic|claude|\bgpt\b|mistral|deepseek|vertex|bedrock/i;

/**
 * Marqueurs d'attribution : le terme est presente comme l'infrastructure
 * d'Eyano plutot que comme un tool cite au passage.
 *
 * Pas de `b` final : le `\b` s'appuie sur `[A-Za-z0-9_]`, donc `propulse`
 * avec accent n'a aucune frontiere apres le `e` accentue et le motif ne
 * matcherait jamais. Le `\b` precedent suffit a eviter les faux positifs.
 */
const ATTRIBUTION =
  /\b(propuls[ée]|entra[îi]n[ée]|mod[èe]le|fournisseur|backend|infrastructure|powered\s+by|d[ée]velopp[ée]\s+par|construit\s+(avec|sur)|servi\s+par|exploit[ée]\s+par|api\s+(de|d'|du))/i;

const WINDOW = 80;

function excerptAt(text, index, length) {
  const from = Math.max(0, index - WINDOW);
  const to = Math.min(text.length, index + length + WINDOW);
  return text.slice(from, to).replace(/\s+/g, ' ').trim();
}

/**
 * Analyse toutes les occurrences bannies et remonte le niveau le plus grave.
 *
 * @returns {{ level: 'none' | 'mention' | 'revelation', terms: string[], excerpt: string | null }}
 */
function scanRevelation(text) {
  const source = String(text || '');
  const terms = [];
  let revelation = null;
  let mention = null;

  const pattern = new RegExp(BANNED.source, 'gi');
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const term = match[0];
    if (!terms.includes(term)) terms.push(term);

    const around = excerptAt(source, match.index, term.length);
    if (ATTRIBUTION.test(around)) {
      if (!revelation) revelation = { term, excerpt: around };
    } else if (!mention) {
      mention = { term, excerpt: around };
    }
  }

  if (revelation) return { level: 'revelation', terms, excerpt: revelation.excerpt };
  if (mention) return { level: 'mention', terms, excerpt: mention.excerpt };
  return { level: 'none', terms: [], excerpt: null };
}

module.exports = { BANNED, ATTRIBUTION, scanRevelation };
