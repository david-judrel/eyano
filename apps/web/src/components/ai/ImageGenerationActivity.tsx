'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ActivityStep } from './ActivityStep';

/** Ecart entre deux points de la grille (px CSS). */
const SPACING = 11;
/** Duree caracteristique d'une generation : la progression est ESTIMEE. */
const EXPECTED_MS = 7000;

/**
 * Kepler cree une image : ligne d'activite + apercu anime (grille de points
 * dont des nappes derivent). La progression est une estimation (le moteur
 * n'en donne pas) qui plafonne a 95 % : seule l'image reelle la termine.
 * Les points prennent la couleur `brand-text` (lisible dans les deux themes).
 */
export function ImageGenerationActivity() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const color = getComputedStyle(canvas).color;
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
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = color;

      // Trois nappes qui derivent lentement (coordonnees normalisees).
      const blobs = [
        { x: 0.35 + 0.18 * Math.sin(t * 0.5), y: 0.3 + 0.12 * Math.cos(t * 0.4), r: 0.22 },
        { x: 0.65 + 0.15 * Math.cos(t * 0.35), y: 0.62 + 0.15 * Math.sin(t * 0.45), r: 0.26 },
        { x: 0.5 + 0.25 * Math.sin(t * 0.25 + 2), y: 0.5 + 0.2 * Math.cos(t * 0.3 + 1), r: 0.18 },
      ];

      const count = Math.floor(size / SPACING);
      const offset = (size - (count - 1) * SPACING) / 2;
      for (let i = 0; i < count; i++) {
        for (let j = 0; j < count; j++) {
          const nx = i / count;
          const ny = j / count;
          let intensity = 0;
          for (const b of blobs) {
            const dx = nx - b.x;
            const dy = ny - b.y;
            intensity += Math.exp(-(dx * dx + dy * dy) / (b.r * b.r));
          }
          const twinkle = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7 + j * 2.3);
          ctx.globalAlpha = Math.min(0.85, 0.08 + intensity * 0.55 * (0.6 + 0.4 * twinkle));
          ctx.beginPath();
          ctx.arc(offset + i * SPACING, offset + j * SPACING, 0.8 + intensity * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      const estimate = Math.floor(95 * (1 - Math.exp(-elapsed / EXPECTED_MS)));
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
