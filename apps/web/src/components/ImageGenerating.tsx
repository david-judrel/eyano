'use client';

import { useEffect, useRef, useState } from 'react';

/** Ecart entre deux points de la grille (px CSS). */
const SPACING = 11;
/** Duree caracteristique d'une generation : la progression est ESTIMEE. */
const EXPECTED_MS = 7000;

/**
 * Attente de Kepler Image : grille de points dont des nappes lumineuses
 * derivent lentement, et une progression estimee (le backend n'en donne
 * aucune). Elle plafonne a 95 % : seule l'image reelle la termine.
 */
export function ImageGenerating() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const color = getComputedStyle(canvas).color || 'rgb(59, 130, 246)';
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
          let glow = 0;
          for (const b of blobs) {
            const dx = nx - b.x;
            const dy = ny - b.y;
            glow += Math.exp(-(dx * dx + dy * dy) / (b.r * b.r));
          }
          const twinkle = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7 + j * 2.3);
          const alpha = Math.min(0.85, 0.06 + glow * 0.55 * (0.6 + 0.4 * twinkle));
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(offset + i * SPACING, offset + j * SPACING, 0.8 + glow * 0.7, 0, Math.PI * 2);
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
    <div
      className="w-full max-w-[420px] rounded-2xl border border-border bg-surface-2 p-4"
      role="status"
      aria-label="Création de l'image en cours"
    >
      <div className="text-sm font-medium text-foreground/70 mb-3">Création de l&apos;image</div>
      <div className="relative">
        <canvas ref={canvasRef} className="block w-full aspect-square text-brand" />
        <span className="absolute bottom-2 right-2 rounded-full border border-border bg-surface-3 px-2.5 py-1 text-xs font-medium text-brand tabular-nums">
          {progress} %
        </span>
      </div>
    </div>
  );
}
