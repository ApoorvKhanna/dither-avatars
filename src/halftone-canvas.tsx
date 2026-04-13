'use client';

import { useEffect, useRef, useMemo } from 'react';
import { HalftoneRenderer, type RendererOptions } from './renderer';
import type { AnimationFn } from './animations';

interface HalftoneCanvasProps {
  animation: AnimationFn;
  width: number;
  height: number;
  options?: RendererOptions;
  className?: string;
  style?: React.CSSProperties;
}

export default function HalftoneCanvas({
  animation, width, height, options, className, style,
}: HalftoneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<HalftoneRenderer | null>(null);

  // Stabilize options so the effect doesn't re-fire on every render
  const stableOptions = useMemo(() => options, [
    options?.dotSpacing,
    options?.maxDotRadius,
    options?.timeOffset,
    options?.timeScale,
    options?.lightMode,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    rendererRef.current = new HalftoneRenderer(canvas, animation, stableOptions);
    rendererRef.current.start();

    return () => {
      rendererRef.current?.stop();
      rendererRef.current = null;
    };
  }, [animation, stableOptions]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={style}
    />
  );
}
