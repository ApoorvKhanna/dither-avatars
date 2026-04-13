'use client';

import { useEffect, useRef, useState } from 'react';

interface DitheredImageProps {
  src: string;
  width: number;
  height: number;
  pixelSize?: number;       // size of each dither cell (default 4)
  dotColor?: string;        // color for dark pixels (default '#6366f1')
  bgColor?: string;         // color for light pixels (default 'transparent')
  algorithm?: 'floyd-steinberg' | 'ordered' | 'atkinson';
  threshold?: number;       // 0-255 brightness threshold (default 128)
  invert?: boolean;          // render dots on light areas instead of dark (for dark backgrounds)
  className?: string;
  style?: React.CSSProperties;
}

export default function DitheredImage({
  src, width, height,
  pixelSize = 4,
  dotColor = '#6366f1',
  bgColor = 'transparent',
  algorithm = 'atkinson',
  threshold = 128,
  invert = false,
  className,
  style,
}: DitheredImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Draw image to offscreen canvas to get pixel data
      const off = document.createElement('canvas');
      off.width = width;
      off.height = height;
      const offCtx = off.getContext('2d')!;

      // Scale image to fill canvas (cover)
      const imgAspect = img.width / img.height;
      const canvasAspect = width / height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgAspect > canvasAspect) {
        sw = img.height * canvasAspect;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / canvasAspect;
        sy = (img.height - sh) / 2;
      }
      offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

      const imageData = offCtx.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      // Convert to grayscale float array
      const gray = new Float32Array(width * height);
      for (let i = 0; i < gray.length; i++) {
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        const b = pixels[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      }

      // Apply dithering
      if (algorithm === 'floyd-steinberg') {
        floydSteinberg(gray, width, height, threshold);
      } else if (algorithm === 'atkinson') {
        atkinson(gray, width, height, threshold);
      } else {
        ordered(gray, width, height, threshold);
      }

      // Render dithered result as dots
      ctx.clearRect(0, 0, width, height);

      if (bgColor !== 'transparent') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.fillStyle = dotColor;
      const half = pixelSize / 2;
      const dotR = half * 0.85;

      for (let y = 0; y < height; y += pixelSize) {
        for (let x = 0; x < width; x += pixelSize) {
          // Sample center of cell
          const idx = (y + Math.floor(half)) * width + (x + Math.floor(half));
          const shouldDraw = invert ? gray[idx] > threshold : gray[idx] < threshold;
        if (idx < gray.length && shouldDraw) {
            ctx.beginPath();
            ctx.arc(x + half, y + half, dotR, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      setLoaded(true);
    };
    img.src = src;
  }, [src, width, height, pixelSize, dotColor, bgColor, algorithm, threshold]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ ...style, opacity: loaded ? 1 : 0, transition: 'opacity 0.5s' }}
    />
  );
}

// ═══════════════════════════════════
// Dithering algorithms
// ═══════════════════════════════════

function floydSteinberg(gray: Float32Array, w: number, h: number, threshold: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = gray[i];
      const val = old < threshold ? 0 : 255;
      gray[i] = val;
      const err = old - val;

      if (x + 1 < w)             gray[i + 1]     += err * 7 / 16;
      if (y + 1 < h && x > 0)    gray[i + w - 1] += err * 3 / 16;
      if (y + 1 < h)             gray[i + w]     += err * 5 / 16;
      if (y + 1 < h && x + 1 < w) gray[i + w + 1] += err * 1 / 16;
    }
  }
}

function atkinson(gray: Float32Array, w: number, h: number, threshold: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = gray[i];
      const val = old < threshold ? 0 : 255;
      gray[i] = val;
      const err = (old - val) / 8; // Atkinson divides by 8, not full error

      if (x + 1 < w)              gray[i + 1]     += err;
      if (x + 2 < w)              gray[i + 2]     += err;
      if (y + 1 < h && x > 0)     gray[i + w - 1] += err;
      if (y + 1 < h)              gray[i + w]     += err;
      if (y + 1 < h && x + 1 < w) gray[i + w + 1] += err;
      if (y + 2 < h)              gray[i + 2 * w] += err;
    }
  }
}

function ordered(gray: Float32Array, w: number, h: number, threshold: number) {
  // 4x4 Bayer matrix
  const bayer = [
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5,
  ];
  const bayerSize = 4;
  const scale = 255 / 16;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const bayerVal = bayer[(y % bayerSize) * bayerSize + (x % bayerSize)] * scale;
      gray[i] = gray[i] + bayerVal - threshold < 0 ? 0 : 255;
    }
  }
}
