// Verifie le contraste WCAG des paires texte/fond du Design System, dans
// les deux themes, a partir de src/styles/tokens.css (la source unique).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url)), 'utf8');

function readTheme(selector) {
  const block = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
  const vars = {};
  for (const m of block.matchAll(/--ey-([\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}
const light = readTheme(':root');
const dark = { ...light, ...readTheme('.dark') };

function rgba(value) {
  const [rgb, alpha] = value.split('/').map((s) => s.trim());
  const [r, g, b] = rgb.split(/\s+/).map(Number);
  return { rgb: [r, g, b], a: alpha === undefined ? 1 : Number(alpha) };
}
const over = (top, bottom) => top.rgb.map((v, i) => v * top.a + bottom[i] * (1 - top.a));
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Couleur opaque d'un fond (un fond translucide est pose sur `background`). */
function surface(theme, name) {
  const base = rgba(theme.background).rgb;
  if (name === 'background') return base;
  if (name.endsWith('-subtle') && theme[name].includes('/')) return over(rgba(theme[name]), base);
  return over(rgba(theme[name]), base);
}

// [texte, fond, minimum] — AA : 4.5 pour le texte, 3 pour icones / grands textes / focus.
const PAIRS = [
  ...['background', 'surface', 'surface-raised', 'surface-overlay'].flatMap((bg) => [
    ['foreground', bg, 4.5],
    ['foreground-secondary', bg, 4.5],
    ['foreground-muted', bg, 4.5],
    ['brand-text', bg, 4.5],
    ['error', bg, 4.5],
    ['warning', bg, 4.5],
    ['info', bg, 4.5],
    ['success', bg, 4.5],
    ['focus', bg, 3],
  ]),
  ['brand-foreground', 'brand', 4.5],
  ['brand-foreground', 'brand-hover', 4.5],
  ['brand-foreground', 'brand-active', 4.5],
  ['foreground-inverse', 'surface-inverse', 4.5],
  ['brand-text', 'brand-subtle', 4.5],
  ['error', 'error-subtle', 4.5],
  ['warning', 'warning-subtle', 4.5],
  ['info', 'info-subtle', 4.5],
  ['success', 'success-subtle', 4.5],
];

let failures = 0;
for (const [name, theme] of [['clair', light], ['sombre', dark]]) {
  for (const [fg, bg, min] of PAIRS) {
    const r = ratio(over(rgba(theme[fg]), surface(theme, bg)), surface(theme, bg));
    const ok = r >= min;
    if (!ok) failures++;
    if (!ok || process.argv.includes('--verbose')) {
      console.log(`${ok ? 'ok  ' : 'ECHEC'} ${name.padEnd(6)} ${fg.padEnd(21)} sur ${bg.padEnd(16)} ${r.toFixed(2)} (min ${min})`);
    }
  }
}
if (failures) {
  console.error(`\n${failures} paire(s) sous le contraste WCAG AA.`);
  process.exit(1);
}
console.log(`contraste : ${PAIRS.length * 2} paires conformes WCAG AA (clair + sombre)`);
