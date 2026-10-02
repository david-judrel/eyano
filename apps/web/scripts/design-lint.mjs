// EYANO — garde-fou du Design System.
//
// Echoue si un fichier de l'interface reintroduit une valeur que le systeme
// interdit : couleur en dur, couleur Tailwind brute, white/black, taille de
// texte arbitraire, opacite de texte, halo, z-index ou arrondi arbitraire,
// ancien alias de migration. Les valeurs vivent dans src/styles/tokens.css et
// tailwind.config.ts, jamais dans les composants. Voir DESIGN-SYSTEM.md.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../src', import.meta.url));

/** Fichiers ou une valeur litterale est legitime, avec la raison. */
const EXEMPT = {
  'app/layout.tsx': 'theme-color des navigateurs : valeur litterale exigee par la balise meta',
  'app/api/og/route.tsx': "image Open Graph generee cote serveur : pas de CSS, valeurs litterales",
  'lib/metadata.ts': 'couleurs des manifestes / meta : valeurs litterales exigees',
};

/** Fichiers pas encore migres (liste qui ne doit faire que diminuer). */
const PENDING = new Set([
  'app/admin/ai/page.tsx',
  'app/admin/audit/page.tsx',
  'app/admin/layout.tsx',
  'app/admin/overview/page.tsx',
  'app/admin/page.tsx',
  'app/auth/callback/page.tsx',
  'app/admin/users/page.tsx',
  'app/error.tsx',
  'app/global-error.tsx',
  'app/not-found.tsx',
  'components/LoginContent.tsx',
  'components/MobileInstallGate.tsx',
  'components/ProfileContent.tsx',
]);

const PALETTE = 'red|green|blue|yellow|orange|amber|emerald|gray|zinc|neutral|slate|purple|pink|indigo|cyan|teal|lime|sky|violet|rose|fuchsia|stone';
const COLOR_UTIL = 'bg|text|border|ring|ring-offset|outline|from|to|via|fill|stroke|divide|placeholder|decoration|shadow|caret|accent';

/** [nom, motif sur une classe (sans variantes), explication]. */
const RULES = [
  ['couleur en dur', /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/, 'utiliser un jeton (bg-surface, text-foreground-muted...)'],
  ['couleur Tailwind brute', new RegExp(`^(${COLOR_UTIL})-(${PALETTE})-\\d`), 'utiliser un jeton semantique (error, warning, info, success...)'],
  ['white / black', new RegExp(`^(${COLOR_UTIL})-(white|black)\\b`), 'utiliser foreground / background / surface'],
  ['couleur arbitraire', new RegExp(`^(${COLOR_UTIL})-\\[`), 'utiliser un jeton'],
  ['opacite de couleur', new RegExp(`^(${COLOR_UTIL})-[a-z-]+\\/(\\d+|\\[[^\\]]+\\])$`), 'utiliser un niveau semantique (foreground-secondary, -muted, border-subtle...)'],
  ['taille de texte hors echelle', /^text-(xs|sm|base|lg|xl|[2-9]xl|\[[^\]]+\])$/, 'utiliser text-body-md, text-label, text-caption, text-heading-*...'],
  ['graisse hors echelle', /^font-(thin|extralight|light|bold|extrabold|black)$/, 'utiliser font-normal, font-medium ou font-semibold'],
  ['interligne / approche arbitraire', /^(leading|tracking)-\[/, "l'echelle typographique fixe deja l'interligne et l'approche"],
  ['ombre hors systeme', /^shadow-(sm|md|lg|xl|2xl|inner|\[)/, 'utiliser shadow-subtle, shadow-raised ou shadow-overlay'],
  ['halo', /glow/, 'pas de halo : le survol change le fond, la bordure ou la couleur'],
  ['z-index arbitraire', /^z-(\d+|\[)/, 'utiliser z-raised, z-sticky, z-overlay, z-dropdown, z-modal, z-toast, z-tooltip'],
  ['arrondi hors echelle', /^rounded(-[trbl]{1,2})?(-(none|2xl|3xl|\[[^\]]+\]))?$/, 'utiliser rounded-sm, -md, -lg, -xl ou -full'],
  ['espacement arbitraire', /^-?(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y)-(\[|2\.5$|3\.5$|7$|9$|11$|14$|28$|36$)/, "utiliser l'echelle d'espacement (voir DESIGN-SYSTEM.md)"],
  ['alias de migration', /^(bg|text|border|ring)-(surface-[23]|muted|brand-dim|primary|destructive|overlay|glass)\b|^ring-ring\b/, 'utiliser le nouveau nom de jeton'],
];

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(tsx|ts)$/.test(entry.name)) files.push(path);
  }
})(ROOT);

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

let errors = 0;
let pendingViolations = 0;
const stalePending = [];

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  if (EXEMPT[rel]) continue;
  const source = stripComments(readFileSync(file, 'utf8'));
  const found = [];

  source.split('\n').forEach((line, index) => {
    // Couleurs litterales n'importe ou dans le code.
    const literal = line.match(/(['"`(\s:])(#[0-9a-fA-F]{3,8})\b|\brgba?\(\s*\d/);
    if (literal) found.push([index + 1, 'couleur en dur', (literal[2] ?? literal[0]).trim(), RULES[0][2]]);

    for (const raw of line.match(/[\w:/\[\]%.#()!-]+/g) ?? []) {
      const cls = raw.replace(/^!/, '').split(':').pop();
      for (const [name, pattern, hint] of RULES.slice(1)) {
        if (pattern.test(cls)) found.push([index + 1, name, raw, hint]);
      }
    }
  });

  if (PENDING.has(rel)) {
    pendingViolations += found.length;
    if (found.length === 0) stalePending.push(rel);
    continue;
  }
  for (const [line, name, value, hint] of found) {
    errors++;
    console.error(`${rel}:${line}  ${name} : ${value}  -> ${hint}`);
  }
}

if (stalePending.length) {
  console.error(`\nFichiers deja conformes encore listes comme « a migrer » (a retirer de PENDING) :\n  ${stalePending.join('\n  ')}`);
  errors += stalePending.length;
}
console.log(`design-lint : ${files.length} fichiers, ${PENDING.size} encore a migrer (${pendingViolations} ecarts tolérés).`);
if (errors) {
  console.error(`\n${errors} ecart(s) au Design System.`);
  process.exit(1);
}
console.log('design-lint : aucun ecart hors fichiers a migrer.');
