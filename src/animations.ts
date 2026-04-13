import { fbm } from './noise';

export interface AnimResult {
  d: number;
  shade: number;
  hue: number;
  sat: number;
}

export type AnimationFn = (
  px: number, py: number,
  cx: number, cy: number,
  r: number, t: number,
) => AnimResult;

// ═══════════════════════════════════════════════════════
// Seeded random number generator (deterministic per name)
// ═══════════════════════════════════════════════════════

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Returns a seeded PRNG that produces values in [0, 1) */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ═══════════════════════════════════════════════════════
// Parameterized animation factories
// Each takes a params object and returns a unique AnimationFn
// ═══════════════════════════════════════════════════════

interface RoseParams {
  petals: number;       // 3-9
  innerPetals: number;  // 3-11
  bloomSpeed: number;   // 0.2-0.7
  rotSpeed: number;     // 0.08-0.25
  breatheSpeed: number; // 0.6-1.8
  hueBase: number;      // 220-300
  hueRange: number;     // 8-25
  satBase: number;      // 50-75
  scale: number;        // 0.75-0.95
}

function makeRose(p: RoseParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const bloom = (Math.sin(t * p.bloomSpeed) + 1) * 0.5;
    const breathe = Math.sin(t * p.breatheSpeed) * 0.03;
    const petalDepth = 0.15 + bloom * 0.45;
    const petal = Math.cos(angle * p.petals + t * p.rotSpeed) * petalDepth;
    const innerPetal = Math.cos(angle * p.innerPetals - t * p.rotSpeed * 1.5 + 0.6) * petalDepth * 0.6;
    const baseR = r * (0.3 + bloom * (p.scale - 0.3) + breathe) * (1 + petal + innerPetal * bloom);
    const wobble = fbm(angle * 2 + t * 0.2, dist * 0.01 + t * 0.1, 3) * r * 0.08 * bloom;
    const d = dist - (baseR + wobble);
    const centerDark = Math.max(0, 1 - dist / (r * 0.2)) * 0.4;
    return { d, shade: centerDark, hue: p.hueBase + Math.sin(angle * 3 + t) * p.hueRange, sat: p.satBase + bloom * 20 };
  };
}

interface VortexParams {
  arms: number;         // 2-6
  spinSpeed: number;    // 0.8-2.5
  pulseSpeed: number;   // 0.3-0.9
  tightness: number;    // 0.02-0.05
  hueBase: number;      // 210-280
  satBase: number;      // 45-70
  scale: number;        // 0.55-0.80
  eyeSize: number;      // 0.04-0.12
}

function makeVortex(p: VortexParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const spiralAngle = angle + dist * p.tightness - t * p.spinSpeed;
    const arms = (Math.sin(spiralAngle * p.arms) + 1) * 0.5;
    const pulse = Math.sin(t * p.pulseSpeed) * 0.2 + Math.sin(t * p.pulseSpeed * 0.4) * 0.15;
    const vortexR = r * (p.scale + pulse);
    const tight = Math.max(0, 1 - dist / vortexR);
    const spiral = arms * tight;
    const turb = fbm(dx * 0.02 + t * 0.3, dy * 0.02 - t * 0.2, 4) * r * 0.15;
    const d = dist - (vortexR * (0.4 + spiral * 0.6) + turb);
    const eyeR = r * p.eyeSize * (1 + Math.sin(t * 0.8) * 0.3);
    const eyeD = dist - eyeR;
    if (eyeD < 0) return { d: Math.abs(eyeD) + 5, shade: 0, hue: p.hueBase, sat: p.satBase };
    return { d, shade: spiral * 0.3, hue: p.hueBase + dist * 0.1, sat: p.satBase + tight * 30 };
  };
}

interface JellyfishParams {
  tentacles: number;    // 4-8
  pulseSpeed: number;   // 0.5-1.2
  swaySpeed: number;    // 1.0-2.2
  bellSize: number;     // 0.4-0.65
  spread: number;       // 0.08-0.16
  hueBase: number;      // 240-310
  satBase: number;      // 40-65
}

function makeJellyfish(p: JellyfishParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx;
    const bellCy = cy - r * 0.25 + Math.sin(t * p.pulseSpeed) * r * 0.08;
    const bellDy = (py - bellCy) * 1.6;
    const bellDist = Math.sqrt(dx * dx + bellDy * bellDy);
    const expand = 1 + Math.sin(t * p.pulseSpeed) * 0.15;
    const bellR = r * p.bellSize * expand + fbm(Math.atan2(py - bellCy, dx) * 3 + t * 0.3, t * 0.2, 3) * r * 0.06;
    const bellD = bellDist - bellR;
    let tentD = 999;
    const halfTent = Math.floor(p.tentacles / 2);
    if (py > bellCy + r * 0.1) {
      const ty = py - (bellCy + r * 0.1);
      const fade = Math.min(1, ty / (r * 0.8));
      for (let i = -halfTent; i <= halfTent; i++) {
        const sway = Math.sin(ty * 0.04 + t * p.swaySpeed + i * 1.2) * (15 + ty * 0.3)
                   + Math.sin(ty * 0.02 - t * p.swaySpeed * 0.5 + i * 0.7) * 8;
        const thickness = (4 - fade * 2.5) * expand;
        tentD = Math.min(tentD, Math.abs(dx - i * r * p.spread - sway) - thickness);
      }
    }
    const d = Math.min(bellD, tentD);
    const isBell = bellD < tentD;
    const glow = isBell ? Math.max(0, 1 - bellDist / bellR) * 0.3 : 0;
    return { d, shade: glow, hue: p.hueBase + Math.sin(t * 0.3) * 20, sat: p.satBase + (isBell ? 25 : 10) };
  };
}

interface PhoenixParams {
  flapSpeed: number;    // 0.7-1.8
  riseSpeed: number;    // 0.2-0.5
  wingSpan: number;     // 0.7-1.0
  wingWidth: number;    // 0.18-0.32
  tailFlicker: number;  // 2.0-4.5
  hueBody: number;      // 240-290
  hueTail: number;      // 10-40
  satBody: number;      // 50-70
}

function makePhoenix(p: PhoenixParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx;
    const rise = Math.sin(t * p.riseSpeed) * r * 0.12;
    const bCy = cy + rise;
    const bDy = py - bCy;
    const flapAngle = Math.sin(t * p.flapSpeed) * 0.5 + 0.3;
    const bodyD = Math.sqrt(dx * dx * 2.5 + bDy * bDy * 4) - r * 0.2;
    function wing(side: number): number {
      const wx = dx * side;
      if (wx < 0) return 999;
      const wingTip = wx / (r * p.wingSpan);
      const wingY = bDy + wx * flapAngle + Math.sin(wx * 0.05 + t * 2) * 8;
      const wingThickness = r * p.wingWidth * (1 - wingTip * 0.7);
      return Math.abs(wingY) - wingThickness;
    }
    const leftWing = wing(1);
    const rightWing = wing(-1);
    let tailD = 999;
    if (bDy > r * 0.1) {
      const ty = bDy - r * 0.1;
      const flicker = Math.sin(ty * 0.08 + t * p.tailFlicker) * (8 + ty * 0.2) + fbm(ty * 0.03 + t, dx * 0.02, 3) * 10;
      tailD = Math.abs(dx - flicker) - (6 - ty * 0.02);
    }
    const headD = Math.sqrt(dx * dx + (bDy + r * 0.25) ** 2) - r * 0.12;
    const d = Math.min(bodyD, leftWing, rightWing, tailD, headD);
    const isFlame = tailD === d;
    return { d, shade: isFlame ? 0.2 : 0, hue: isFlame ? p.hueTail : p.hueBody + Math.sin(t) * 15, sat: isFlame ? 80 : p.satBody };
  };
}

// ═══════════════════════════════════════════════════════
// New shapes (Waves, Dragon, Crystal, Serpent)
// ═══════════════════════════════════════════════════════

interface WavesParams {
  layers: number;         // 3-7
  speed: number;          // 0.4-1.2
  amplitude: number;      // 0.15-0.35
  frequency: number;      // 2-5
  hueBase: number;        // 160-220 (teals/blues)
  satBase: number;        // 50-80
  drift: number;          // 0.3-0.9
}

function makeWaves(p: WavesParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let minD = 999;
    let totalShade = 0;
    for (let i = 0; i < p.layers; i++) {
      const phase = i * (Math.PI / p.layers) + t * p.speed * (1 + i * 0.15);
      const yOff = (i - p.layers / 2) * (r * 0.28);
      const waveY = cy + yOff + Math.sin(px * p.frequency / r + phase) * r * p.amplitude
                   + Math.sin(px * p.frequency * 0.6 / r + phase * 1.3 + i) * r * p.amplitude * 0.4;
      const waveDist = Math.abs(py - waveY);
      const thickness = r * (0.08 + Math.sin(t * 0.5 + i) * 0.02);
      const d = waveDist - thickness;
      if (d < minD) {
        minD = d;
        totalShade = Math.max(0, 1 - waveDist / (thickness * 2)) * 0.3;
      }
    }
    const outerD = dist - r * 0.9;
    const d = Math.max(minD, outerD);
    return { d, shade: totalShade, hue: p.hueBase + py / r * 20 + Math.sin(t * 0.3) * 10, sat: p.satBase };
  };
}

interface FlameParams {
  flickerSpeed: number;   // 1.0-3.0
  swaySpeed: number;      // 0.3-0.8
  swayAmount: number;     // 0.05-0.15
  width: number;          // 0.25-0.45
  height: number;         // 0.6-0.85
  layers: number;         // 2-4
  hueCore: number;        // 40-60 (yellow)
  hueMid: number;         // 15-35 (orange)
  hueOuter: number;       // 0-15 (red)
  satBase: number;        // 70-95
}

function makeFlame(p: FlameParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    // Flame base is at the bottom, tip at the top
    const baseCy = cy + r * 0.35;
    const dx = px - cx;
    const dy = py - baseCy;

    // Global sway
    const sway = Math.sin(t * p.swaySpeed) * r * p.swayAmount;

    // Flame shape: tapers from wide base to narrow tip
    // Use multiple noise-displaced layers for organic look
    let minD = 999;
    let closestLayer = 0;

    for (let layer = 0; layer < p.layers; layer++) {
      const layerScale = 1 - layer * 0.2; // inner layers are smaller
      const layerSway = sway * (1 + layer * 0.3);
      const layerSpeed = p.flickerSpeed * (1 + layer * 0.4);

      // For each y-level, compute the flame width
      if (dy < 0) { // above the base = inside flame territory
        const rise = Math.abs(dy) / (r * p.height);
        if (rise > 1.2) continue; // above the flame tip

        // Taper: wide at bottom, narrow at top
        const taper = Math.max(0, 1 - rise * rise);
        const baseWidth = r * p.width * layerScale * taper;

        // Turbulence: organic flicker
        const turb1 = fbm(dy * 0.03 + t * layerSpeed, dx * 0.02 + layer, 3) * r * 0.12;
        const turb2 = Math.sin(dy * 0.06 + t * layerSpeed * 1.3 + layer * 2) * r * 0.06;
        const totalWidth = baseWidth + turb1 + turb2;

        // Tip narrowing with noise
        const tipWobble = fbm(t * layerSpeed * 0.5 + layer * 5, rise * 3, 2) * r * 0.08 * rise;

        const flameX = dx - layerSway * rise - tipWobble;
        const d = Math.abs(flameX) - totalWidth;

        if (d < minD) {
          minD = d;
          closestLayer = layer;
        }
      }
    }

    // Also add a rounded base/ember glow
    const baseDist = Math.sqrt(dx * dx * 3 + (dy > 0 ? dy * dy * 8 : dy * dy * 2));
    const baseD = baseDist - r * p.width * 0.6;
    if (baseD < minD) {
      minD = baseD;
      closestLayer = p.layers; // mark as base
    }

    const d = minD;
    const rise = Math.max(0, -dy) / (r * p.height);

    // Color: yellow core at top, orange middle, red outer/base
    let hue: number;
    let shade: number;
    if (closestLayer === 0) {
      hue = p.hueCore + rise * 15; // bright yellow at tips
      shade = 0.4 + rise * 0.2;
    } else if (closestLayer < p.layers) {
      hue = p.hueMid + Math.sin(t * 2 + closestLayer) * 8;
      shade = 0.25;
    } else {
      hue = p.hueOuter;
      shade = 0.15;
    }

    return {
      d,
      shade,
      hue,
      sat: p.satBase - rise * 15,
    };
  };
}

interface CrystalParams {
  facets: number;         // 5-9
  growSpeed: number;      // 0.3-0.8
  shimmer: number;        // 1-3
  mainSize: number;       // 0.35-0.55
  shardCount: number;     // 3-6
  hueBase: number;        // 170-260 (cyan-purple)
  satBase: number;        // 35-65
}

function makeCrystal(p: CrystalParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Main crystal: polygonal shape
    const grow = 1 + Math.sin(t * p.growSpeed) * 0.1;
    const facetAngle = (Math.PI * 2) / p.facets;
    const snapAngle = Math.round(angle / facetAngle) * facetAngle;
    const angleFrac = (angle - snapAngle) / facetAngle;
    const facetDist = r * p.mainSize * grow / Math.cos(angleFrac * Math.PI);
    const mainD = dist - facetDist;

    // Shards radiating outward
    let shardD = 999;
    for (let i = 0; i < p.shardCount; i++) {
      const shardAngle = (i / p.shardCount) * Math.PI * 2 + t * 0.1;
      const shardDir = Math.atan2(
        Math.sin(shardAngle),
        Math.cos(shardAngle)
      );
      const aDiff = Math.abs(angle - shardDir);
      const aDiffWrap = Math.min(aDiff, Math.PI * 2 - aDiff);
      if (aDiffWrap < 0.15) {
        const shardLen = r * (0.5 + Math.sin(t * p.shimmer + i * 2) * 0.15) * grow;
        const inShard = dist > facetDist * 0.8 && dist < facetDist + shardLen;
        if (inShard) {
          const width = (3 - aDiffWrap * 20) * (1 - (dist - facetDist) / shardLen);
          shardD = Math.min(shardD, aDiffWrap * dist - width);
        }
      }
    }

    const d = Math.min(mainD, shardD);
    const shimmerVal = Math.sin(angle * p.facets * 2 + t * p.shimmer) * 0.15 + 0.15;
    return {
      d,
      shade: d === mainD ? shimmerVal : 0.3,
      hue: p.hueBase + Math.sin(angle * 2 + t * 0.5) * 25,
      sat: p.satBase + shimmerVal * 30,
    };
  };
}

interface OctopusParams {
  tentacles: number;      // 6-8
  curlTight: number;      // 1.5-3.0
  pulseSpeed: number;     // 0.4-1.0
  swaySpeed: number;      // 0.8-1.8
  headSize: number;       // 0.3-0.45
  eyeSize: number;        // 0.04-0.07
  hueBase: number;        // 0-360
  satBase: number;        // 50-80
}

function makeOctopus(p: OctopusParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    // Bulbous head: bobs up and down, pulses in size
    const headCy = cy - r * 0.2 + Math.sin(t * p.pulseSpeed) * r * 0.08;
    const headCx = cx + Math.sin(t * p.pulseSpeed * 0.7) * r * 0.03;
    const hdx = px - headCx, hdy = py - headCy;
    const breathe = 1 + Math.sin(t * p.pulseSpeed * 1.3) * 0.12;
    const headDist = Math.sqrt(hdx * hdx * 1.8 + hdy * hdy * (hdy < 0 ? 1.2 : 2.5));
    const headR = r * p.headSize * breathe;
    const headD = headDist - headR;

    // Eyes: follow the head position
    const eyeSpread = r * 0.12;
    const eyeY = headCy + r * 0.05;
    const eyeLD = Math.sqrt((px - (headCx - eyeSpread)) ** 2 + (py - eyeY) ** 2) - r * p.eyeSize;
    const eyeRD = Math.sqrt((px - (headCx + eyeSpread)) ** 2 + (py - eyeY) ** 2) - r * p.eyeSize;
    const eyeD = Math.min(eyeLD, eyeRD);

    // Tentacles: curl outward and downward with wave-like animation
    let tentD = 999;
    const tentBase = headCy + r * 0.12;
    for (let i = 0; i < p.tentacles; i++) {
      const baseAngle = (i / p.tentacles) * Math.PI - Math.PI * 0.5;
      // Each tentacle sways with a different phase
      const sway = Math.sin(t * p.swaySpeed * 1.5 + i * 1.3) * 0.45;

      // Walk along each tentacle with animated wave
      for (let j = 0; j <= 20; j++) {
        const frac = j / 20;
        const len = frac * r * 0.75;
        // Curl animates over time — tentacles constantly coiling/uncoiling
        const curlDir = i % 2 === 0 ? 1 : -1;
        const curlAnim = Math.sin(t * p.swaySpeed * 0.8 + i * 2) * 0.5;
        const curl = frac * frac * (p.curlTight + curlAnim) * curlDir;
        // Wave propagates down the tentacle
        const wave = Math.sin(frac * 8 - t * p.swaySpeed * 2 + i * 1.1) * r * 0.06 * frac;
        const angle = baseAngle + sway + curl;
        const tx = cx + Math.cos(angle) * (r * 0.15 + len * 0.8) + wave;
        const ty = tentBase + Math.sin(angle + Math.PI * 0.5) * len * 0.3 + len * 0.85
                 + Math.sin(frac * 6 + t * p.swaySpeed * 1.5 + i) * r * 0.03;
        const thickness = r * (0.045 - frac * 0.032) * breathe;
        const segD = Math.sqrt((px - tx) ** 2 + (py - ty) ** 2) - thickness;
        if (segD < tentD) tentD = segD;
      }
    }

    const d = Math.min(headD, eyeD, tentD);
    const isEye = eyeD === d;
    const isTent = tentD === d;
    const glow = !isTent ? Math.max(0, 1 - headDist / headR) * 0.25 : 0;
    return {
      d,
      shade: isEye ? 0.5 : glow,
      hue: isEye ? 50 : p.hueBase + (isTent ? Math.sin(t * 0.5) * 15 : 0),
      sat: isEye ? 85 : p.satBase + (isTent ? -10 : 15),
    };
  };
}

// ═══════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════

/** Fixed presets for direct import (hero uses phoenix) */
export const phoenix: AnimationFn = makePhoenix({
  flapSpeed: 1.2, riseSpeed: 0.35, wingSpan: 0.85, wingWidth: 0.25,
  tailFlicker: 3, hueBody: 260, hueTail: 20, satBody: 60,
});

export const rose: AnimationFn = makeRose({
  petals: 5, innerPetals: 5, bloomSpeed: 0.4, rotSpeed: 0.15,
  breatheSpeed: 1.2, hueBase: 255, hueRange: 15, satBase: 60, scale: 0.85,
});

export const vortex: AnimationFn = makeVortex({
  arms: 3, spinSpeed: 1.5, pulseSpeed: 0.6, tightness: 0.03,
  hueBase: 230, satBase: 55, scale: 0.65, eyeSize: 0.08,
});

export const jellyfish: AnimationFn = makeJellyfish({
  tentacles: 7, pulseSpeed: 0.8, swaySpeed: 1.5, bellSize: 0.55,
  spread: 0.12, hueBase: 270, satBase: 50,
});

/**
 * Generate a unique animation for any agent name.
 * Every name produces a different combination of shape, petal count,
 * speed, color, and scale — no two agents look the same.
 */
export function animationForAgent(name: string): AnimationFn {
  const seed = hashString(name);
  const rng = seededRandom(seed);

  // Pick from 8 shapes
  const shapeIdx = seed % 8;

  const rf = (min: number, max: number) => min + rng() * (max - min);
  const ri = (min: number, max: number) => Math.floor(min + rng() * (max - min + 1));

  switch (shapeIdx) {
    case 0:
      return makeRose({
        petals: ri(3, 9),
        innerPetals: ri(3, 11),
        bloomSpeed: rf(0.2, 0.7),
        rotSpeed: rf(0.08, 0.25),
        breatheSpeed: rf(0.6, 1.8),
        hueBase: ri(200, 340),  // wider: blue through pink
        hueRange: rf(8, 30),
        satBase: ri(45, 80),
        scale: rf(0.75, 0.95),
      });
    case 1:
      return makeVortex({
        arms: ri(2, 6),
        spinSpeed: rf(0.8, 2.5),
        pulseSpeed: rf(0.3, 0.9),
        tightness: rf(0.02, 0.05),
        hueBase: ri(180, 300),  // wider: teal through purple
        satBase: ri(40, 75),
        scale: rf(0.55, 0.80),
        eyeSize: rf(0.04, 0.12),
      });
    case 2:
      return makeJellyfish({
        tentacles: ri(4, 8),
        pulseSpeed: rf(0.5, 1.2),
        swaySpeed: rf(1.0, 2.2),
        bellSize: rf(0.4, 0.65),
        spread: rf(0.08, 0.16),
        hueBase: ri(220, 320),
        satBase: ri(40, 70),
      });
    case 3:
      return makePhoenix({
        flapSpeed: rf(0.7, 1.8),
        riseSpeed: rf(0.2, 0.5),
        wingSpan: rf(0.7, 1.0),
        wingWidth: rf(0.18, 0.32),
        tailFlicker: rf(2.0, 4.5),
        hueBody: ri(220, 300),
        hueTail: ri(5, 45),
        satBody: ri(50, 75),
      });
    case 4:
      return makeWaves({
        layers: ri(3, 7),
        speed: rf(0.4, 1.2),
        amplitude: rf(0.15, 0.35),
        frequency: rf(2, 5),
        hueBase: ri(160, 230),  // teals/ocean blues
        satBase: ri(50, 80),
        drift: rf(0.3, 0.9),
      });
    case 5:
      return makeFlame({
        flickerSpeed: rf(1.0, 3.0),
        swaySpeed: rf(0.3, 0.8),
        swayAmount: rf(0.05, 0.15),
        width: rf(0.25, 0.45),
        height: rf(0.6, 0.85),
        layers: ri(2, 4),
        hueCore: ri(40, 60),     // yellow
        hueMid: ri(15, 35),      // orange
        hueOuter: ri(0, 15),     // red
        satBase: ri(70, 95),
      });
    case 6:
      return makeCrystal({
        facets: ri(5, 9),
        growSpeed: rf(0.3, 0.8),
        shimmer: rf(1, 3),
        mainSize: rf(0.35, 0.55),
        shardCount: ri(3, 6),
        hueBase: ri(170, 280),
        satBase: ri(35, 65),
      });
    case 7:
    default:
      return makeOctopus({
        tentacles: ri(6, 8),
        curlTight: rf(1.5, 3.0),
        pulseSpeed: rf(0.4, 1.0),
        swaySpeed: rf(0.8, 1.8),
        headSize: rf(0.3, 0.45),
        eyeSize: rf(0.04, 0.07),
        hueBase: ri(280, 360),  // magentas/pinks
        satBase: ri(50, 80),
      });
  }
}

export const ANIMATIONS = { rose, vortex, jellyfish, phoenix } as const;
