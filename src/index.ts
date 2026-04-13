// Core library
export { HalftoneRenderer, type RendererOptions } from './renderer';
export { animationForAgent, type AnimationFn, type AnimResult } from './animations';
export { noise2, fbm } from './noise';

// React components
export { default as HalftoneCanvas } from './halftone-canvas';
export { default as DitheredImage } from './dithered-image';
