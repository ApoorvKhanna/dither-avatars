# dither-avatars

Procedural halftone avatars. 8 animated shapes, billions of variants. Pure Canvas, zero dependencies.

Any string deterministically maps to a unique animated avatar — same name always produces the same shape, color, and motion.

## Shapes

Rose, Vortex, Jellyfish, Phoenix, Waves, Flame, Crystal, Octopus

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3002` to see the demo — type any name, hit Generate.

## Usage in Your Project

Copy the `src/` folder into your project. The library is framework-agnostic at the core (pure Canvas), with optional React components.

### React Component

```tsx
import HalftoneCanvas from './src/halftone-canvas';
import { animationForAgent } from './src/animations';

function Avatar({ name }: { name: string }) {
  return (
    <HalftoneCanvas
      animation={animationForAgent(name)}
      width={200}
      height={200}
      options={{
        dotSpacing: 5,        // distance between dots (lower = denser)
        maxDotRadius: 2.5,    // max dot size
        timeScale: 0.9,       // animation speed
        timeOffset: 0,        // phase offset
        lightMode: false,     // true = dark dots on light bg
      }}
    />
  );
}
```

### Vanilla Canvas (No React)

```ts
import { HalftoneRenderer } from './src/renderer';
import { animationForAgent } from './src/animations';

const canvas = document.getElementById('avatar') as HTMLCanvasElement;
const renderer = new HalftoneRenderer(
  canvas,
  animationForAgent('ShadowWolf42'),
  { dotSpacing: 5, maxDotRadius: 2.5, timeScale: 0.9 }
);
renderer.start();

// Later:
renderer.stop();
```

### Static Image Dithering

```tsx
import DitheredImage from './src/dithered-image';

<DitheredImage
  src="/photo.jpg"
  width={200}
  height={200}
  algorithm="floyd-steinberg"  // or 'atkinson', 'ordered'
  dotColor="#6366f1"
  pixelSize={4}
  invert={true}               // for dark backgrounds
/>
```

## API

### `animationForAgent(name: string): AnimationFn`

Returns a deterministic animation function for any string. The name is hashed to select one of 8 shapes with randomized parameters (petal count, speed, color, scale, etc).

### `HalftoneRenderer`

```ts
new HalftoneRenderer(canvas, animationFn, options?)
```

| Option | Default | Description |
|--------|---------|-------------|
| `dotSpacing` | `5` | Pixel distance between dots |
| `maxDotRadius` | `2.5` | Maximum dot radius |
| `timeScale` | `1` | Animation speed multiplier |
| `timeOffset` | `0` | Initial time offset (stagger multiple avatars) |
| `lightMode` | `false` | Dark dots on light background |

Methods: `.start()`, `.stop()`

## How It Works

1. **Name hashing** — deterministic hash maps any string to a seed
2. **Shape selection** — `seed % 8` picks the base shape
3. **Parameter generation** — seeded PRNG fills shape-specific params (petal count, speed, hue, etc)
4. **Rendering** — grid of dots, each evaluated against the animation function's signed distance field
5. **Animation** — `requestAnimationFrame` loop with time-based noise and jitter

No external libraries. The entire system is ~600 lines of TypeScript using the Canvas 2D API.

## License

MIT
