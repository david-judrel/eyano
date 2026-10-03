'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ActivityStep } from './ActivityStep';

/** Ecart entre deux grains de poussiere (px CSS). */
const SPACING = 26;
/** Duree caracteristique d'une generation : la progression est ESTIMEE. */
const EXPECTED_MS = 7000;
/** Floutage proportionnel a la largeur de la carte (px CSS). */
const BLUR_RATIO = 0.07;
/** La progression plafonne : seule l'image reelle l'acheve. */
const MAX_PROGRESS = 95;

/**
 * Trois nappes de la meme couleur de marque, teintees par rotation de hue
 * (0 / +100 / +200 deg) : un degrade multicolore sans jamais coder une
 * couleur en dur. Elles sont dessinees en premier, floutees : les cercles
 * passent en dessous, il ne reste qu'une lueur.
 */
const AURAS = [
  { dx: -0.15, dy: -0.12, r: 0.3, hue: 0, k: 0.95 },
  { dx: 0.17, dy: 0.05, r: 0.27, hue: 100, k: 0.85 },
  { dx: 0.0, dy: 0.17, r: 0.25, hue: 200, k: 0.8 },
];

/**
 * Kepler cree une image : ligne d'activite et apercu anime — trois nappes
 * multicolores floutees qui derivent, une poussiere qui scintille a leur
 * surface, un balayage de lumiere qui traverse la carte. La progression est
 * une estimation (le moteur n'en donne pas), affichee en texte seul.
 * `prefers-reduced-motion` fige la scene (sans balayage).
 */
export function ImageGenerationActivity() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let frame = 0;
    let lastProgress = -1;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const size = canvas.clientWidth;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (now: number) => {
      const elapsed = now - start;
      const t = reduceMotion ? 0 : elapsed / 1000;
      const size = canvas.clientWidth;
      if (!size) {
        frame = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, size, size);
      // Couleur lue au theme en cours : jamais de valeur en dur.
      ctx.fillStyle = getComputedStyle(canvas).color;

      // 1. Nappes multicolores floutees : le fond, jamais des anneaux.
      for (const a of AURAS) {
        const cx = (0.5 + a.dx + 0.1 * Math.sin(t * 0.4 + a.hue)) * size;
        const cy = (0.5 + a.dy + 0.08 * Math.cos(t * 0.35 + a.hue)) * size;
        const pulse = 1 + 0.06 * Math.sin(t * 0.9 + a.hue);
        ctx.save();
        ctx.filter = `blur(${(size * BLUR_RATIO).toFixed(1)}px) hue-rotate(${a.hue}deg)`;
        ctx.globalAlpha = a.k * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, a.r * size * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 2. Balayage de lumiere diagonal, par dessus les nappes.
      if (!reduceMotion) {
        const sweep = ((t * 0.26) % 1.5 - 0.25) * size;
        const width = size * 0.22;
        const slices = 20;
        const step = (2 * size) / slices;
        ctx.save();
        ctx.filter = 'none';
        ctx.translate(size / 2, size / 2);
        ctx.rotate(-0.6);
        for (let s = 0; s < slices; s++) {
          const x = -size + step * (s + 0.5);
          const d = (x - sweep) / width;
          ctx.globalAlpha = 0.09 * Math.exp(-d * d);
          ctx.fillRect(x - step / 2, -size, step + 1, 2 * size);
        }
        ctx.restore();
      }

      // 3. Poussiere : grains rares, teinte qui derive doucement sur le cycle.
      ctx.save();
      ctx.filter = `hue-rotate(${(Math.sin(t * 0.25) * 140).toFixed(0)}deg)`;
      const count = Math.max(2, Math.floor(size / SPACING));
      const offset = (size - (count - 1) * SPACING) / 2;
      for (let i = 0; i < count; i++) {
        for (let j = 0; j < count; j++) {
          const nx = i / (count - 1);
          const ny = j / (count - 1);
          let intensity = 0;
          for (const a of AURAS) {
            const sigma = a.r * 0.75;
            const dx = nx - (0.5 + a.dx);
            const dy = ny - (0.5 + a.dy);
            intensity += Math.exp(-(dx * dx + dy * dy) / (sigma * sigma));
          }
          const twinkle = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 1.7 + j * 2.3);
          const alpha = 0.05 * twinkle + Math.min(0.5, intensity * 0.45) * twinkle;
          if (alpha < 0.03) continue;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(offset + i * SPACING, offset + j * SPACING, 0.7 + Math.min(1, intensity) * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      const estimate = Math.floor(MAX_PROGRESS * (1 - Math.exp(-elapsed / EXPECTED_MS)));
      if (estimate !== lastProgress) {
        lastProgress = estimate;
        setProgress(estimate);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <ActivityStep icon={Sparkles} label="Création de l'image" status="running" detail={`Environ ${progress} %`}>
      <div className="relative mt-1 w-full max-w-md overflow-hidden rounded-lg border border-border-subtle bg-surface">
        <canvas ref={canvasRef} aria-hidden className="block aspect-square w-full text-brand-text" />
      </div>
    </ActivityStep>
  );
}
