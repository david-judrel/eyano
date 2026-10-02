'use strict';

/**
 * Probes d'etape 43 : garde e34 ON / OFF, contrat e42 identique.
 *
 * Aucun probe nouveau : chacun est REPRIS tel quel de son experience
 * d'origine (historique, couverture, canal, grille). Seule variable : la
 * presence du texte de la garde (`--no-guard`).
 *
 * Cibles (FOUND hors fenetre, sur-prudence d'e42) : Q1, Q2, Q3, Q6, plus B
 * de frontiere-souvenir (mode scenario). Temoin : Q4, plus A''.
 * Garde-fous (ce que la garde pourrait proteger) : Q5 (e42), P1 (e41.6),
 * N2 et S1 (e40), plus C de frontiere-souvenir.
 *
 * Seuils figes avant les runs (cibles : 15 reponses par condition) :
 *   H1 soutenue        : correct OFF >= correct ON + 5, 0 erreur nuisible
 *                        sur les cibles, erreurs garde-fous OFF <= ON ;
 *   la garde protege   : gain >= +5 mais erreurs garde-fous OFF > ON ;
 *   H1 refutee         : gain <= +1 ;
 *   non concluant      : gain de +2 a +4.
 */

const { PROBES_E42 } = require('./provenance-e42');
const { PROBES_E41 } = require('./provenance-e41');
const { SEED_E40, PROBES_E40 } = require('./provenance-e40');

function reuse(list, id, group, extra = {}) {
  const { off, ...probe } = list.find((entry) => entry.id === id);
  return { ...probe, ...extra, group };
}

const PROBES_E43 = [
  reuse(PROBES_E42, 'Q1', 'cible'),
  reuse(PROBES_E42, 'Q2', 'cible'),
  reuse(PROBES_E42, 'Q3', 'cible'),
  reuse(PROBES_E42, 'Q6', 'cible'),
  reuse(PROBES_E42, 'Q4', 'temoin'),
  reuse(PROBES_E42, 'Q5', 'garde-fou'),
  reuse(PROBES_E41, 'P1', 'garde-fou'),
  reuse(PROBES_E40, 'N2', 'garde-fou', { history: SEED_E40 }),
  reuse(PROBES_E40, 'S1', 'garde-fou', { history: SEED_E40 }),
];

module.exports = { PROBES_E43 };
