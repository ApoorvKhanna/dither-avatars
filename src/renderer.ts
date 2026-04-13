import { noise2 } from './noise';
import type { AnimationFn } from './animations';

export interface RendererOptions {
  dotSpacing?: number;
  maxDotRadius?: number;
  timeOffset?: number;
  timeScale?: number;
  lightMode?: boolean;
}

export class HalftoneRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFn: AnimationFn;
  private dotSpacing: number;
  private maxDotR: number;
  private timeOffset: number;
  private timeScale: number;
  private lightMode: boolean;
  private tick = 0;
  private rafId = 0;

  constructor(canvas: HTMLCanvasElement, animFn: AnimationFn, opts: RendererOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.animFn = animFn;
    this.dotSpacing = opts.dotSpacing ?? 5;
    this.maxDotR = opts.maxDotRadius ?? 2.5;
    this.timeOffset = opts.timeOffset ?? 0;
    this.timeScale = opts.timeScale ?? 1;
    this.lightMode = opts.lightMode ?? false;
  }

  start() {
    this.tick = 0;
    this.loop();
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private loop = () => {
    this.tick++;
    const t = (this.tick * 0.016 + this.timeOffset) * this.timeScale;
    const { ctx, canvas, dotSpacing: sp, maxDotR: mr } = this;
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2, r = Math.min(cx, cy) * 0.85;

    ctx.clearRect(0, 0, w, h);

    const cols = Math.ceil(w / sp);
    const rows = Math.ceil(h / sp);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = col * sp + sp * 0.5;
        const py = row * sp + sp * 0.5;

        const res = this.animFn(px, py, cx, cy, r, t);
        if (res.d > 6) continue;

        const edge = res.d < 0 ? 1 : Math.max(0, 1 - res.d / 5);
        if (edge < 0.05) continue;

        const nv = noise2(px * 0.03 + t * 0.12, py * 0.03 - t * 0.08) * 0.08;
        const density = Math.min(1, edge * (0.4 + res.shade + nv));
        const dotR = mr * density;
        if (dotR < 0.3) continue;

        const jx = noise2(px * 0.1 + t * 0.05, py * 0.1) * 0.7;
        const jy = noise2(px * 0.1, py * 0.1 + t * 0.05) * 0.7;
        const light = this.lightMode
          ? 15 + density * 25          // dark dots on light bg: 15-40%
          : 38 + (1 - density) * 32;   // light dots on dark bg: 38-70%

        ctx.fillStyle = `hsl(${res.hue}, ${res.sat}%, ${light}%)`;
        ctx.beginPath();
        ctx.arc(px + jx, py + jy, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}
