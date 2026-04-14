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

// ── 0: Rose ──────────────────────────────────────────

interface RoseParams {
  petals: number;
  innerPetals: number;
  bloomSpeed: number;
  rotSpeed: number;
  breatheSpeed: number;
  hueBase: number;
  hueRange: number;
  satBase: number;
  scale: number;
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

// ── 1: Vortex ────────────────────────────────────────

interface VortexParams {
  arms: number;
  spinSpeed: number;
  pulseSpeed: number;
  tightness: number;
  hueBase: number;
  satBase: number;
  scale: number;
  eyeSize: number;
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

// ── 2: Jellyfish ─────────────────────────────────────

interface JellyfishParams {
  tentacles: number;
  pulseSpeed: number;
  swaySpeed: number;
  bellSize: number;
  spread: number;
  hueBase: number;
  satBase: number;
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

// ── 3: Phoenix ───────────────────────────────────────

interface PhoenixParams {
  flapSpeed: number;
  riseSpeed: number;
  wingSpan: number;
  wingWidth: number;
  tailFlicker: number;
  hueBody: number;
  hueTail: number;
  satBody: number;
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

// ── 4: Waves ─────────────────────────────────────────

interface WavesParams {
  layers: number;
  speed: number;
  amplitude: number;
  frequency: number;
  hueBase: number;
  satBase: number;
  drift: number;
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

// ── 5: Flame ─────────────────────────────────────────

interface FlameParams {
  flickerSpeed: number;
  swaySpeed: number;
  swayAmount: number;
  width: number;
  height: number;
  layers: number;
  hueCore: number;
  hueMid: number;
  hueOuter: number;
  satBase: number;
}

function makeFlame(p: FlameParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const baseCy = cy + r * 0.35;
    const dx = px - cx;
    const dy = py - baseCy;
    const sway = Math.sin(t * p.swaySpeed) * r * p.swayAmount;

    let minD = 999;
    let closestLayer = 0;

    for (let layer = 0; layer < p.layers; layer++) {
      const layerScale = 1 - layer * 0.2;
      const layerSway = sway * (1 + layer * 0.3);
      const layerSpeed = p.flickerSpeed * (1 + layer * 0.4);

      if (dy < 0) {
        const rise = Math.abs(dy) / (r * p.height);
        if (rise > 1.2) continue;
        const taper = Math.max(0, 1 - rise * rise);
        const baseWidth = r * p.width * layerScale * taper;
        const turb1 = fbm(dy * 0.03 + t * layerSpeed, dx * 0.02 + layer, 3) * r * 0.12;
        const turb2 = Math.sin(dy * 0.06 + t * layerSpeed * 1.3 + layer * 2) * r * 0.06;
        const totalWidth = baseWidth + turb1 + turb2;
        const tipWobble = fbm(t * layerSpeed * 0.5 + layer * 5, rise * 3, 2) * r * 0.08 * rise;
        const flameX = dx - layerSway * rise - tipWobble;
        const d = Math.abs(flameX) - totalWidth;
        if (d < minD) { minD = d; closestLayer = layer; }
      }
    }

    const baseDist = Math.sqrt(dx * dx * 3 + (dy > 0 ? dy * dy * 8 : dy * dy * 2));
    const baseD = baseDist - r * p.width * 0.6;
    if (baseD < minD) { minD = baseD; closestLayer = p.layers; }

    const d = minD;
    const rise = Math.max(0, -dy) / (r * p.height);
    let hue: number, shade: number;
    if (closestLayer === 0) {
      hue = p.hueCore + rise * 15;
      shade = 0.4 + rise * 0.2;
    } else if (closestLayer < p.layers) {
      hue = p.hueMid + Math.sin(t * 2 + closestLayer) * 8;
      shade = 0.25;
    } else {
      hue = p.hueOuter;
      shade = 0.15;
    }
    return { d, shade, hue, sat: p.satBase - rise * 15 };
  };
}

// ── 6: Crystal ───────────────────────────────────────

interface CrystalParams {
  facets: number;
  growSpeed: number;
  shimmer: number;
  mainSize: number;
  shardCount: number;
  hueBase: number;
  satBase: number;
}

function makeCrystal(p: CrystalParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const grow = 1 + Math.sin(t * p.growSpeed) * 0.1;
    const facetAngle = (Math.PI * 2) / p.facets;
    const snapAngle = Math.round(angle / facetAngle) * facetAngle;
    const angleFrac = (angle - snapAngle) / facetAngle;
    const facetDist = r * p.mainSize * grow / Math.cos(angleFrac * Math.PI);
    const mainD = dist - facetDist;

    let shardD = 999;
    for (let i = 0; i < p.shardCount; i++) {
      const shardAngle = (i / p.shardCount) * Math.PI * 2 + t * 0.1;
      const shardDir = Math.atan2(Math.sin(shardAngle), Math.cos(shardAngle));
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

// ── 7: Octopus ───────────────────────────────────────

interface OctopusParams {
  tentacles: number;
  curlTight: number;
  pulseSpeed: number;
  swaySpeed: number;
  headSize: number;
  eyeSize: number;
  hueBase: number;
  satBase: number;
}

function makeOctopus(p: OctopusParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const headCy = cy - r * 0.2 + Math.sin(t * p.pulseSpeed) * r * 0.08;
    const headCx = cx + Math.sin(t * p.pulseSpeed * 0.7) * r * 0.03;
    const hdx = px - headCx, hdy = py - headCy;
    const breathe = 1 + Math.sin(t * p.pulseSpeed * 1.3) * 0.12;
    const headDist = Math.sqrt(hdx * hdx * 1.8 + hdy * hdy * (hdy < 0 ? 1.2 : 2.5));
    const headR = r * p.headSize * breathe;
    const headD = headDist - headR;

    const eyeSpread = r * 0.12;
    const eyeY = headCy + r * 0.05;
    const eyeLD = Math.sqrt((px - (headCx - eyeSpread)) ** 2 + (py - eyeY) ** 2) - r * p.eyeSize;
    const eyeRD = Math.sqrt((px - (headCx + eyeSpread)) ** 2 + (py - eyeY) ** 2) - r * p.eyeSize;
    const eyeD = Math.min(eyeLD, eyeRD);

    let tentD = 999;
    const tentBase = headCy + r * 0.12;
    for (let i = 0; i < p.tentacles; i++) {
      const baseAngle = (i / p.tentacles) * Math.PI - Math.PI * 0.5;
      const sway = Math.sin(t * p.swaySpeed * 1.5 + i * 1.3) * 0.45;
      for (let j = 0; j <= 20; j++) {
        const frac = j / 20;
        const len = frac * r * 0.75;
        const curlDir = i % 2 === 0 ? 1 : -1;
        const curlAnim = Math.sin(t * p.swaySpeed * 0.8 + i * 2) * 0.5;
        const curl = frac * frac * (p.curlTight + curlAnim) * curlDir;
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
// Natural phenomena shapes (8–31)
// ═══════════════════════════════════════════════════════

// ── 8: Fish ──────────────────────────────────────────

interface FishParams {
  bodyLen: number;
  bodyHeight: number;
  tailSize: number;
  swimSpeed: number;
  waveAmp: number;
  hueBase: number;
  satBase: number;
}

function makeFish(p: FishParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const swimOff = Math.sin(t * p.swimSpeed * 0.3) * r * 0.06;
    const dx = px - cx - swimOff, dy = py - cy;
    const bend = Math.sin(dx / r * 5 + t * p.swimSpeed * 2) * r * p.waveAmp;
    const bdy = dy - bend;
    const nx = dx / (r * p.bodyLen);
    const taper = Math.max(0.3, 1 - Math.max(0, nx) * 0.5);
    const bodyD = Math.sqrt(nx * nx + (bdy / (r * p.bodyHeight * taper)) ** 2) * r * p.bodyLen - r * p.bodyLen;

    const tx = dx + r * p.bodyLen * 0.85;
    const tw = Math.sin(t * p.swimSpeed * 2.5) * r * 0.1;
    const tailDy = bdy - tw * Math.max(0, tx / (r * 0.2));
    const tailD = tx > 0 ? Math.max(Math.abs(tailDy) - tx * 0.7, tx - r * p.tailSize) : 999;

    const eyeD = Math.sqrt((dx + r * p.bodyLen * 0.55) ** 2 + (bdy - r * 0.01) ** 2) - r * 0.03;
    const finY = bdy - Math.sin(t * p.swimSpeed * 1.5) * r * 0.04;
    const dorsalD = (dy < cy - r * 0.05) ? Math.sqrt((dx * 2) ** 2 + finY * finY) - r * 0.12 : 999;

    const d = Math.min(bodyD, tailD, eyeD, dorsalD);
    const isEye = eyeD === d;
    return {
      d,
      shade: isEye ? 0.5 : Math.max(0, 1 - Math.abs(bdy) / (r * p.bodyHeight)) * 0.2,
      hue: isEye ? 40 : p.hueBase + Math.sin(dx / r * 3 + t) * 12,
      sat: isEye ? 85 : p.satBase,
    };
  };
}

// ── 9: Turtle ────────────────────────────────────────

interface TurtleParams {
  shellSize: number;
  headSize: number;
  flipperLen: number;
  swimSpeed: number;
  hueShell: number;
  hueBody: number;
  satBase: number;
}

function makeTurtle(p: TurtleParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const bob = Math.sin(t * p.swimSpeed) * r * 0.04;
    const dx = px - cx, dy = py - (cy + bob);
    const shellR = r * p.shellSize;
    const shellDist = Math.sqrt(dx * dx + (dy * 1.5) ** 2);
    const shellD = shellDist - shellR;
    const shellAngle = Math.atan2(dy, dx);
    const hexShade = (Math.cos(shellAngle * 6 + t * 0.15) * 0.5 + 0.5) *
                     Math.max(0, 1 - shellDist / shellR) * 0.25;

    const headBob = Math.sin(t * p.swimSpeed * 1.3) * r * 0.02;
    const hdx = dx - shellR * 0.85, hdy = dy - headBob;
    const headD = Math.sqrt(hdx * hdx * 1.5 + hdy * hdy * 2.5) - r * p.headSize;

    let flipD = 999;
    const angles = [-2.5, -0.6, 0.6, 2.5];
    for (let i = 0; i < 4; i++) {
      const fa = angles[i] + Math.sin(t * p.swimSpeed * 1.5 + i * 1.2) * 0.25;
      const fx = dx - Math.cos(fa) * shellR * 0.75;
      const fy = dy - Math.sin(fa) * shellR * 0.45;
      const along = fx * Math.cos(fa) + fy * Math.sin(fa);
      const perp = -fx * Math.sin(fa) + fy * Math.cos(fa);
      flipD = Math.min(flipD, Math.sqrt(along * along + perp * perp * 4) - r * p.flipperLen);
    }

    const tailD = Math.sqrt((dx + shellR * 0.85) ** 2 + dy * dy * 6) - r * 0.04;
    const d = Math.min(shellD, headD, flipD, tailD);
    const isShell = shellD === d;
    return {
      d,
      shade: isShell ? hexShade : 0.1,
      hue: isShell ? p.hueShell + Math.sin(shellAngle * 3 + t * 0.3) * 15 : p.hueBody,
      sat: p.satBase,
    };
  };
}

// ── 10: Tree ─────────────────────────────────────────

interface TreeParams {
  trunkWidth: number;
  trunkHeight: number;
  canopySize: number;
  swaySpeed: number;
  swayAmount: number;
  hueLeaves: number;
  hueTrunk: number;
  satBase: number;
}

function makeTree(p: TreeParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const sway = Math.sin(t * p.swaySpeed) * r * p.swayAmount;
    const dx = px - cx, dy = py - cy;

    const trunkTop = cy - r * 0.05;
    const trunkBot = cy + r * 0.45;
    const trunkH = trunkBot - trunkTop;
    const trunkFrac = (py - trunkTop) / trunkH;
    const trunkSway = sway * (1 - trunkFrac) * 0.3;
    const trunkW = r * p.trunkWidth * (0.8 + trunkFrac * 0.2);
    const trunkD = (py >= trunkTop && py <= trunkBot)
      ? Math.abs(dx - trunkSway) - trunkW
      : 999;

    const canopyCx = cx + sway * 0.6;
    const canopyCy = cy - r * 0.2;
    const cdx = px - canopyCx, cdy = py - canopyCy;
    const canopyDist = Math.sqrt(cdx * cdx + (cdy * 1.2) ** 2);
    const canopyR = r * p.canopySize;
    const leafNoise = fbm(cdx * 0.04 + t * 0.15, cdy * 0.04 + t * 0.1, 3) * r * 0.08;
    const canopyD = canopyDist - canopyR - leafNoise;

    const d = Math.min(trunkD, canopyD);
    const isTrunk = trunkD === d;
    const leafShade = Math.max(0, 1 - canopyDist / canopyR) * 0.3;
    return {
      d,
      shade: isTrunk ? 0.1 : leafShade,
      hue: isTrunk ? p.hueTrunk : p.hueLeaves + fbm(cdx * 0.03 + t * 0.1, cdy * 0.03, 2) * 20,
      sat: isTrunk ? 30 : p.satBase,
    };
  };
}

// ── 11: Palm Tree ────────────────────────────────────

interface PalmTreeParams {
  trunkCurve: number;
  frondCount: number;
  frondLen: number;
  swaySpeed: number;
  hueLeaves: number;
  hueTrunk: number;
  satBase: number;
}

function makePalmTree(p: PalmTreeParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const sway = Math.sin(t * p.swaySpeed) * r * 0.03;

    const trunkBot = cy + r * 0.45;
    const trunkTop = cy - r * 0.2;
    const trunkH = trunkBot - trunkTop;
    let trunkD = 999;
    if (py >= trunkTop - r * 0.05 && py <= trunkBot) {
      const frac = (py - trunkTop) / trunkH;
      const curve = Math.sin(frac * Math.PI * 0.5) * r * p.trunkCurve + sway * (1 - frac);
      const width = r * (0.035 + frac * 0.02);
      trunkD = Math.abs(dx - curve) - width;
    }

    const crownX = cx + Math.sin(0.5 * Math.PI * 0.5) * r * p.trunkCurve + sway;
    const crownY = trunkTop;
    let frondD = 999;
    for (let i = 0; i < p.frondCount; i++) {
      const baseAngle = (i / p.frondCount) * Math.PI * 2 + t * 0.08;
      const frondSway = Math.sin(t * p.swaySpeed * 1.5 + i * 1.7) * 0.15;
      const angle = baseAngle + frondSway;
      for (let j = 0; j <= 15; j++) {
        const frac = j / 15;
        const len = frac * r * p.frondLen;
        const droop = frac * frac * r * 0.25;
        const fx = crownX + Math.cos(angle) * len;
        const fy = crownY + Math.sin(angle) * len * 0.4 + droop;
        const thickness = r * (0.04 - frac * 0.03);
        const seg = Math.sqrt((px - fx) ** 2 + (py - fy) ** 2) - thickness;
        frondD = Math.min(frondD, seg);
      }
    }

    const coconutD = Math.min(
      Math.sqrt((px - crownX - r * 0.03) ** 2 + (py - crownY - r * 0.05) ** 2) - r * 0.03,
      Math.sqrt((px - crownX + r * 0.04) ** 2 + (py - crownY - r * 0.04) ** 2) - r * 0.025,
    );

    const d = Math.min(trunkD, frondD, coconutD);
    const isTrunk = trunkD === d;
    const isCoconut = coconutD === d;
    return {
      d,
      shade: isCoconut ? 0.15 : 0.1,
      hue: isTrunk ? p.hueTrunk : isCoconut ? 30 : p.hueLeaves + Math.sin(t * 0.3) * 10,
      sat: isTrunk ? 25 : isCoconut ? 50 : p.satBase,
    };
  };
}

// ── 12: Planet ───────────────────────────────────────

interface PlanetParams {
  size: number;
  bands: number;
  bandSpeed: number;
  ringTilt: number;
  ringWidth: number;
  hueBase: number;
  hueBand: number;
  satBase: number;
}

function makePlanet(p: PlanetParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const planetR = r * p.size;
    const planetD = dist - planetR;

    const bandY = dy / planetR;
    const bandVal = Math.sin(bandY * p.bands * Math.PI + t * p.bandSpeed) * 0.5 + 0.5;
    const stormX = dx / planetR;
    const storm = fbm(stormX * 3 + t * 0.2, bandY * 3, 3) * 0.15;
    const planetShade = bandVal * 0.25 + storm;

    const ringCy = cy;
    const ringDy = (py - ringCy) * (1 / Math.max(0.1, p.ringTilt));
    const ringDist = Math.sqrt(dx * dx + ringDy * ringDy);
    const ringInner = planetR * 1.3;
    const ringOuter = planetR * (1.3 + p.ringWidth);
    const ringD = Math.max(ringInner - ringDist, ringDist - ringOuter);
    const behindPlanet = (dy > -planetR * 0.1 && dist < planetR) ? 999 : ringD;

    const d = Math.min(planetD, behindPlanet);
    const isRing = behindPlanet === d && behindPlanet < planetD;
    return {
      d,
      shade: isRing ? 0.2 : planetShade,
      hue: isRing ? p.hueBase + 40 : p.hueBase + bandVal * p.hueBand,
      sat: isRing ? p.satBase - 10 : p.satBase + bandVal * 15,
    };
  };
}

// ── 13: Sun ──────────────────────────────────────────

interface SunParams {
  coreSize: number;
  rayCount: number;
  rayLen: number;
  pulseSpeed: number;
  flareSpeed: number;
  hueCore: number;
  hueCorona: number;
  satBase: number;
}

function makeSun(p: SunParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const pulse = 1 + Math.sin(t * p.pulseSpeed) * 0.08;
    const coreR = r * p.coreSize * pulse;
    const coreD = dist - coreR;

    const rayAngle = angle * p.rayCount + t * 0.5;
    const ray = (Math.sin(rayAngle) * 0.5 + 0.5);
    const flare = fbm(angle * 2 + t * p.flareSpeed, dist * 0.01 + t * 0.3, 3) * r * 0.12;
    const rayR = coreR + r * p.rayLen * ray * (0.7 + Math.sin(t * p.flareSpeed + angle * 3) * 0.3) + flare;
    const coronaD = dist - rayR;

    const prominenceAngle = t * 0.3;
    const prominenceDist = Math.abs(angle - prominenceAngle);
    const promWrap = Math.min(prominenceDist, Math.PI * 2 - prominenceDist);
    const promD = promWrap < 0.3
      ? dist - (coreR + r * 0.3 * (1 - promWrap / 0.3) * (Math.sin(t * 2) * 0.3 + 0.7))
      : 999;

    const d = Math.min(coreD, coronaD, promD);
    const isCore = coreD === d;
    const coreFrac = Math.max(0, 1 - dist / coreR);
    const surface = fbm(angle * 4 + t * 0.8, dist * 0.02, 3) * 0.2;
    return {
      d,
      shade: isCore ? coreFrac * 0.4 + surface : 0.15,
      hue: isCore ? p.hueCore + surface * 30 : p.hueCorona + ray * 15,
      sat: isCore ? p.satBase : p.satBase - 15,
    };
  };
}

// ── 14: Snowflake ────────────────────────────────────

interface SnowflakeParams {
  armWidth: number;
  branchLen: number;
  branchCount: number;
  rotSpeed: number;
  sparkle: number;
  hueBase: number;
  satBase: number;
}

function makeSnowflake(p: SnowflakeParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) + t * p.rotSpeed;
    const sixAngle = ((angle % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6;
    const mirrorAngle = Math.abs(sixAngle);
    const ax = dist * Math.cos(mirrorAngle);
    const ay = dist * Math.sin(mirrorAngle);

    const armD = Math.abs(ay) - r * p.armWidth;
    const armClip = ax - r * 0.7;
    const mainArm = Math.max(armD, armClip, -ax);

    let branchD = 999;
    for (let i = 1; i <= p.branchCount; i++) {
      const bx = i / (p.branchCount + 1) * r * 0.65;
      const bLen = r * p.branchLen * (1 - i / (p.branchCount + 2));
      const relX = ax - bx;
      const branchAngle = 0.5;
      const projAlong = relX * Math.cos(branchAngle) + ay * Math.sin(branchAngle);
      const projPerp = -relX * Math.sin(branchAngle) + ay * Math.cos(branchAngle);
      if (projAlong > 0 && projAlong < bLen) {
        branchD = Math.min(branchD, Math.abs(projPerp) - r * p.armWidth * 0.6);
      }
    }

    const centerD = dist - r * 0.08;
    const d = Math.min(mainArm, branchD, centerD);
    const shimmer = Math.sin(dist * 0.1 + angle * 6 + t * p.sparkle) * 0.15 + 0.15;
    return {
      d,
      shade: shimmer,
      hue: p.hueBase + Math.sin(angle * 3 + t * 0.5) * 15,
      sat: p.satBase,
    };
  };
}

// ── 15: Mushroom ─────────────────────────────────────

interface MushroomParams {
  capSize: number;
  capHeight: number;
  stemWidth: number;
  stemHeight: number;
  spotCount: number;
  pulseSpeed: number;
  hueCap: number;
  hueSpot: number;
  satBase: number;
}

function makeMushroom(p: MushroomParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const breathe = 1 + Math.sin(t * p.pulseSpeed) * 0.04;
    const dx = px - cx, dy = py - cy;

    const capCy = cy - r * 0.15;
    const capDx = dx, capDy = (py - capCy) * (1 / p.capHeight);
    const capDist = Math.sqrt(capDx * capDx + capDy * capDy);
    const capR = r * p.capSize * breathe;
    const capD = capDist - capR;
    const capClip = py - (capCy + capR * p.capHeight * 0.3);

    const stemTop = capCy + capR * p.capHeight * 0.25;
    const stemBot = cy + r * 0.45;
    const stemW = r * p.stemWidth * (1 + (py - stemTop) / (stemBot - stemTop) * 0.3);
    const stemD = (py >= stemTop && py <= stemBot) ? Math.abs(dx) - stemW : 999;

    const gillY = capCy + capR * p.capHeight * 0.2;
    const gillD = (py > gillY && py < gillY + r * 0.08 && Math.abs(dx) < capR * 0.85)
      ? Math.abs(Math.sin(dx * 0.15)) * 3 - 1
      : 999;

    const mainCapD = Math.max(capD, -capClip);
    const d = Math.min(mainCapD, stemD, gillD);
    const isCap = mainCapD === d;

    let spotShade = 0;
    if (isCap) {
      const capAngle = Math.atan2(py - capCy, dx);
      const capFrac = capDist / capR;
      for (let i = 0; i < p.spotCount; i++) {
        const sa = (i / p.spotCount) * Math.PI * 2 + 0.5;
        const sr = 0.4 + (i % 3) * 0.15;
        const sx = Math.cos(sa) * sr * capR;
        const sy = Math.sin(sa) * sr * capR * p.capHeight;
        const spotDist = Math.sqrt((dx - sx) ** 2 + ((py - capCy) - sy) ** 2);
        if (spotDist < r * 0.06) spotShade = 0.3;
      }
    }

    return {
      d,
      shade: isCap ? 0.15 + spotShade : 0.08,
      hue: isCap ? (spotShade > 0 ? p.hueSpot : p.hueCap) : p.hueCap - 20,
      sat: p.satBase,
    };
  };
}

// ── 16: Butterfly ────────────────────────────────────

interface ButterflyParams {
  wingSpan: number;
  wingHeight: number;
  flapSpeed: number;
  hoverSpeed: number;
  hueUpper: number;
  hueLower: number;
  satBase: number;
}

function makeButterfly(p: ButterflyParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const hover = Math.sin(t * p.hoverSpeed) * r * 0.05;
    const dx = px - cx, dy = py - (cy + hover);
    const adx = Math.abs(dx);
    const flapScale = 0.6 + (Math.sin(t * p.flapSpeed) * 0.5 + 0.5) * 0.4;

    const bodyD = Math.sqrt(dx * dx * 12 + dy * dy) - r * 0.25;

    const uwCx = r * p.wingSpan * 0.45 * flapScale;
    const uwCy = -r * 0.08;
    const uwDx = adx - uwCx, uwDy = dy - uwCy;
    const upperD = Math.sqrt(uwDx * uwDx + uwDy * uwDy * 1.6) - r * p.wingHeight;

    const lwCx = r * p.wingSpan * 0.35 * flapScale;
    const lwCy = r * 0.15;
    const lwDx = adx - lwCx, lwDy = dy - lwCy;
    const lowerD = Math.sqrt(lwDx * lwDx * 1.3 + lwDy * lwDy * 2) - r * p.wingHeight * 0.7;

    const antennaD = (dy < -r * 0.2)
      ? Math.min(
          Math.sqrt((adx - r * 0.06 + Math.abs(dy + r * 0.2) * 0.3) ** 2 + (dy + r * 0.2) ** 2 * 0.3) - r * 0.015,
          Math.sqrt((adx - r * 0.08) ** 2 + (dy + r * 0.45) ** 2) - r * 0.02,
        )
      : 999;

    const d = Math.min(bodyD, upperD, lowerD, antennaD);
    const isBody = bodyD === d || antennaD === d;
    const isUpper = upperD === d;
    const wingPattern = Math.sin(adx * 0.08 + dy * 0.06 + t * 0.5) * 0.15 + 0.1;
    return {
      d,
      shade: isBody ? 0.1 : wingPattern,
      hue: isBody ? 30 : isUpper ? p.hueUpper + Math.sin(t * 0.3) * 10 : p.hueLower,
      sat: isBody ? 40 : p.satBase,
    };
  };
}

// ── 17: Starfish ─────────────────────────────────────

interface StarfishParams {
  arms: number;
  armLen: number;
  armWidth: number;
  rotSpeed: number;
  pulseSpeed: number;
  hueBase: number;
  satBase: number;
}

function makeStarfish(p: StarfishParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) + t * p.rotSpeed;
    const pulse = 1 + Math.sin(t * p.pulseSpeed) * 0.06;

    const armAngle = (Math.PI * 2) / p.arms;
    const sector = ((angle % armAngle) + armAngle) % armAngle;
    const halfArm = armAngle / 2;
    const fromCenter = Math.abs(sector - halfArm);
    const armShape = Math.cos(fromCenter / halfArm * Math.PI * 0.5);

    const baseR = r * 0.15;
    const tipR = r * p.armLen * pulse;
    const armR = baseR + (tipR - baseR) * armShape;
    const armW = r * p.armWidth * (0.5 + armShape * 0.5);

    const perpDist = dist * Math.sin(fromCenter);
    const alongDist = dist * Math.cos(fromCenter);
    const armTaper = Math.max(0, 1 - alongDist / tipR);
    const effectiveWidth = armW * armTaper;

    const starD = Math.max(perpDist - effectiveWidth, dist - armR);
    const centerD = dist - baseR;
    const d = Math.min(starD, centerD);

    const texture = fbm(dx * 0.03 + t * 0.1, dy * 0.03, 2) * 0.15;
    return {
      d,
      shade: texture + Math.max(0, 1 - dist / (r * 0.15)) * 0.2,
      hue: p.hueBase + Math.sin(angle * p.arms + t * 0.3) * 10,
      sat: p.satBase,
    };
  };
}

// ── 18: Coral ────────────────────────────────────────

interface CoralParams {
  branches: number;
  branchLen: number;
  swaySpeed: number;
  thickness: number;
  hueBase: number;
  satBase: number;
  roughness: number;
}

function makeCoral(p: CoralParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const baseY = cy + r * 0.4;
    let minD = 999;

    for (let b = 0; b < p.branches; b++) {
      const bx = (b / (p.branches - 1) - 0.5) * r * 0.7;
      const sway = Math.sin(t * p.swaySpeed + b * 1.8) * r * 0.04;

      for (let j = 0; j <= 15; j++) {
        const frac = j / 15;
        const height = frac * r * p.branchLen;
        const curve = Math.sin(frac * Math.PI * 0.7 + b * 2.1) * r * 0.1;
        const swayFrac = sway * frac;
        const segX = cx + bx + curve + swayFrac;
        const segY = baseY - height;
        const thick = r * p.thickness * (1 - frac * 0.6);
        const noise = fbm(segX * 0.03 + b, segY * 0.03 + t * 0.2, 2) * r * p.roughness;
        const seg = Math.sqrt((px - segX) ** 2 + (py - segY) ** 2) - thick - noise;
        minD = Math.min(minD, seg);
      }

      if (b % 2 === 0) {
        const forkY = baseY - r * p.branchLen * 0.6;
        const forkDir = b % 4 === 0 ? 1 : -1;
        for (let j = 0; j <= 8; j++) {
          const frac = j / 8;
          const fx = cx + bx + frac * r * 0.15 * forkDir + sway * 0.6;
          const fy = forkY - frac * r * p.branchLen * 0.3;
          const thick = r * p.thickness * 0.5 * (1 - frac * 0.7);
          const seg = Math.sqrt((px - fx) ** 2 + (py - fy) ** 2) - thick;
          minD = Math.min(minD, seg);
        }
      }
    }

    const baseD = Math.sqrt((px - cx) ** 2 * 2 + ((py - baseY) * 3) ** 2) - r * 0.15;
    const d = Math.min(minD, baseD);
    return {
      d,
      shade: Math.max(0, 0.15 - (py - cy) / r * 0.1),
      hue: p.hueBase + Math.sin((py - cy) / r * 3 + t * 0.3) * 15,
      sat: p.satBase,
    };
  };
}

// ── 19: Nautilus ─────────────────────────────────────

interface NautilusParams {
  coils: number;
  growth: number;
  thickness: number;
  rotSpeed: number;
  hueBase: number;
  hueInner: number;
  satBase: number;
}

function makeNautilus(p: NautilusParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    let minD = 999;
    let closestAngle = 0;
    const totalAngle = p.coils * Math.PI * 2;
    for (let i = 0; i <= 80; i++) {
      const frac = i / 80;
      const a = frac * totalAngle + t * p.rotSpeed;
      const spiralR = r * 0.05 * Math.exp(p.growth * frac * totalAngle / (Math.PI * 2));
      if (spiralR > r * 0.8) continue;
      const sx = cx + Math.cos(a) * spiralR;
      const sy = cy + Math.sin(a) * spiralR;
      const thick = r * p.thickness * (0.3 + frac * 0.7);
      const seg = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2) - thick;
      if (seg < minD) {
        minD = seg;
        closestAngle = a;
      }
    }

    const chamberLine = Math.sin(closestAngle * 3) * 0.5 + 0.5;
    return {
      d: minD,
      shade: chamberLine * 0.2,
      hue: p.hueBase + (1 - dist / r) * (p.hueInner - p.hueBase),
      sat: p.satBase + chamberLine * 15,
    };
  };
}

// ── 20: Fern ─────────────────────────────────────────

interface FernParams {
  leaflets: number;
  curlAmount: number;
  swaySpeed: number;
  stemLen: number;
  leafLen: number;
  hueBase: number;
  satBase: number;
}

function makeFern(p: FernParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    let minD = 999;
    const baseY = cy + r * 0.4;
    const topY = cy - r * 0.45;
    const stemH = baseY - topY;
    const sway = Math.sin(t * p.swaySpeed) * r * 0.03;
    const unfurl = (Math.sin(t * 0.3) * 0.5 + 0.5) * 0.3 + 0.7;

    for (let j = 0; j <= 30; j++) {
      const frac = j / 30;
      const curl = frac * frac * p.curlAmount * unfurl;
      const sx = cx + Math.sin(curl) * r * 0.15 + sway * frac;
      const sy = baseY - frac * stemH;
      const stemSeg = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2) - r * 0.02;
      minD = Math.min(minD, stemSeg);

      if (j > 3 && j % Math.max(1, Math.floor(30 / p.leaflets)) === 0) {
        for (const side of [-1, 1]) {
          const leafAngle = curl + side * (1.0 + frac * 0.5) + Math.sin(t * p.swaySpeed * 1.3 + j) * 0.1;
          const lLen = r * p.leafLen * (1 - frac * 0.6);
          for (let k = 0; k <= 6; k++) {
            const lf = k / 6;
            const lx = sx + Math.cos(leafAngle) * lf * lLen;
            const ly = sy + Math.sin(leafAngle) * lf * lLen * 0.5;
            const lThick = r * 0.018 * (1 - lf * 0.8);
            const lSeg = Math.sqrt((px - lx) ** 2 + (py - ly) ** 2) - lThick;
            minD = Math.min(minD, lSeg);
          }
        }
      }
    }

    return {
      d: minD,
      shade: Math.max(0, 0.1 + (baseY - py) / stemH * 0.15),
      hue: p.hueBase + Math.sin((py - cy) / r * 4 + t * 0.3) * 12,
      sat: p.satBase,
    };
  };
}

// ── 21: Lotus ────────────────────────────────────────

interface LotusParams {
  petalLayers: number;
  petalCount: number;
  openSpeed: number;
  hueInner: number;
  hueOuter: number;
  satBase: number;
  waterHue: number;
}

function makeLotus(p: LotusParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const open = (Math.sin(t * p.openSpeed) * 0.5 + 0.5) * 0.6 + 0.4;

    let petalD = 999;
    let closestLayer = 0;
    for (let layer = 0; layer < p.petalLayers; layer++) {
      const layerScale = 0.15 + (layer / p.petalLayers) * 0.55;
      const layerAngleOff = (layer * Math.PI) / p.petalCount + t * 0.05;
      const tiltUp = (1 - layer / p.petalLayers) * 0.4 * open;
      const petalR = r * layerScale * (1 + tiltUp);

      const pAngle = ((angle + layerAngleOff) % (Math.PI * 2 / p.petalCount) + Math.PI * 2 / p.petalCount)
                     % (Math.PI * 2 / p.petalCount) - Math.PI / p.petalCount;
      const petalShape = Math.cos(pAngle * p.petalCount * 0.5) * petalR;
      const yShift = layer * r * 0.03;
      const adjustedDist = Math.sqrt(dx * dx + (dy + yShift) * (dy + yShift));
      const pd = adjustedDist - petalShape;
      if (pd < petalD) { petalD = pd; closestLayer = layer; }
    }

    const centerD = dist - r * 0.1;
    const centerPod = Math.sin(angle * 8 + t * 0.2) * 0.1 + 0.2;

    const waterY = cy + r * 0.15;
    const waterD = (py > waterY)
      ? Math.abs(py - waterY - Math.sin(px * 0.05 + t * 0.8) * r * 0.02) - r * 0.01
      : 999;

    const d = Math.min(petalD, centerD, waterD);
    const isCenter = centerD === d;
    const isWater = waterD === d;
    const layerFrac = closestLayer / p.petalLayers;
    return {
      d,
      shade: isCenter ? centerPod : isWater ? 0.05 : 0.15 + layerFrac * 0.1,
      hue: isCenter ? 50 : isWater ? p.waterHue : p.hueInner + layerFrac * (p.hueOuter - p.hueInner),
      sat: isWater ? 40 : p.satBase,
    };
  };
}

// ── 22: Tornado ──────────────────────────────────────

interface TornadoParams {
  width: number;
  height: number;
  spinSpeed: number;
  swaySpeed: number;
  swayAmount: number;
  layers: number;
  hueBase: number;
  satBase: number;
}

function makeTornado(p: TornadoParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const topY = cy - r * p.height * 0.5;
    const botY = cy + r * p.height * 0.5;
    const dy = py - topY;
    const totalH = botY - topY;
    if (dy < -r * 0.1 || dy > totalH + r * 0.1) {
      return { d: 999, shade: 0, hue: p.hueBase, sat: p.satBase };
    }

    const frac = Math.max(0, Math.min(1, dy / totalH));
    const sway = Math.sin(t * p.swaySpeed + frac * 3) * r * p.swayAmount * frac;
    const centerX = cx + sway;
    const dx = px - centerX;

    const funnelW = r * p.width * (0.15 + frac * 0.85);
    const funnelD = Math.abs(dx) - funnelW;

    const spiralAngle = Math.atan2(dy, dx) + frac * 10 - t * p.spinSpeed;
    const spiral = Math.sin(spiralAngle * p.layers) * 0.5 + 0.5;
    const turb = fbm(dx * 0.02 + t * 0.5, dy * 0.02, 3) * r * 0.06;

    const topClip = -dy;
    const botClip = dy - totalH;
    const d = Math.max(funnelD - turb, topClip, botClip);

    const debrisShade = spiral * 0.25 * Math.max(0, 1 - Math.abs(dx) / funnelW);
    return {
      d,
      shade: debrisShade,
      hue: p.hueBase + frac * 20 + spiral * 10,
      sat: p.satBase - frac * 15,
    };
  };
}

// ── 23: Galaxy ───────────────────────────────────────

interface GalaxyParams {
  arms: number;
  tightness: number;
  spinSpeed: number;
  coreSize: number;
  diskSize: number;
  hueCore: number;
  hueArm: number;
  satBase: number;
}

function makeGalaxy(p: GalaxyParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const coreR = r * p.coreSize;
    const coreD = dist - coreR;
    const coreBright = Math.max(0, 1 - dist / coreR) * 0.4;

    const diskR = r * p.diskSize;
    const diskFalloff = Math.max(0, 1 - dist / diskR);
    const spiralAngle = angle - dist * p.tightness + t * p.spinSpeed;
    const armVal = (Math.sin(spiralAngle * p.arms) * 0.5 + 0.5) * diskFalloff;
    const starNoise = fbm(dx * 0.03 + t * 0.1, dy * 0.03, 3) * 0.2 * diskFalloff;

    const threshold = 0.2;
    const armStrength = armVal + starNoise;
    const diskD = armStrength > threshold ? dist - diskR : dist - diskR * armStrength * 2;

    const d = Math.min(coreD, diskD);
    return {
      d,
      shade: coreBright + armVal * 0.2 + starNoise,
      hue: dist < coreR ? p.hueCore : p.hueArm + armVal * 30,
      sat: p.satBase + diskFalloff * 20,
    };
  };
}

// ── 24: Lightning ────────────────────────────────────

interface LightningParams {
  segments: number;
  spread: number;
  branches: number;
  flashSpeed: number;
  thickness: number;
  hueBase: number;
  satBase: number;
}

function makeLightning(p: LightningParams): AnimationFn {
  const boltSeed = p.segments * 1000 + p.branches * 100;
  return (px, py, cx, cy, r, t) => {
    const flash = (Math.sin(t * p.flashSpeed) * 0.5 + 0.5) * 0.7 + 0.3;
    const topY = cy - r * 0.45;
    const botY = cy + r * 0.4;
    const totalH = botY - topY;

    let minD = 999;
    function traceBolt(startX: number, startY: number, endY: number, thick: number, seed: number) {
      const steps = Math.max(5, Math.floor(p.segments * ((endY - startY) / totalH)));
      let bx = startX;
      for (let i = 0; i <= steps; i++) {
        const frac = i / steps;
        const by = startY + (endY - startY) * frac;
        const jag = fbm(frac * 8 + seed + Math.floor(t * p.flashSpeed * 0.5) * 3, seed * 0.1, 2) * r * p.spread;
        bx = startX + jag;
        const seg = Math.sqrt((px - bx) ** 2 + (py - by) ** 2) - thick * flash;
        minD = Math.min(minD, seg);

        if (i === Math.floor(steps * 0.4) || i === Math.floor(steps * 0.65)) {
          return bx;
        }
      }
      return bx;
    }

    const mainX = traceBolt(cx, topY, botY, r * p.thickness, boltSeed);
    for (let b = 0; b < p.branches; b++) {
      const branchY = topY + totalH * (0.25 + b * 0.25);
      const branchDir = b % 2 === 0 ? 1 : -1;
      const branchStartX = cx + fbm(branchY * 0.01 + boltSeed, b + Math.floor(t * p.flashSpeed * 0.5), 2) * r * p.spread;
      traceBolt(branchStartX, branchY, branchY + totalH * 0.3, r * p.thickness * 0.5, boltSeed + b * 7);
    }

    const glowD = minD - r * 0.05 * flash;
    const d = minD;
    return {
      d,
      shade: Math.max(0, 1 - minD / (r * 0.15)) * 0.5 * flash,
      hue: p.hueBase + Math.sin(t * 3) * 15,
      sat: p.satBase * flash,
    };
  };
}

// ── 25: Cactus ───────────────────────────────────────

interface CactusParams {
  bodyWidth: number;
  bodyHeight: number;
  armCount: number;
  armHeight: number;
  breatheSpeed: number;
  hueBase: number;
  satBase: number;
}

function makeCactus(p: CactusParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const breathe = 1 + Math.sin(t * p.breatheSpeed) * 0.03;
    const dx = px - cx, dy = py - cy;
    const botY = cy + r * 0.45;
    const topY = cy - r * p.bodyHeight * 0.5;
    const bw = r * p.bodyWidth * breathe;

    const bodyD = (py >= topY - bw && py <= botY)
      ? Math.abs(dx) - bw
      : Math.min(
          Math.sqrt(dx * dx + (py - topY) ** 2) - bw,
          Math.sqrt(dx * dx + (py - botY) ** 2) - bw,
        );
    const topCap = Math.sqrt(dx * dx + (py - topY) ** 2) - bw;

    let armD = 999;
    for (let i = 0; i < p.armCount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const armBaseY = cy - r * 0.05 + i * r * 0.18;
      const armBend = armBaseY - r * p.armHeight;
      const aw = bw * 0.65 * breathe;

      const hSegX = dx - side * bw;
      const hLen = r * 0.15;
      const horzD = (Math.abs(py - armBaseY) < aw && hSegX * side > 0 && hSegX * side < hLen)
        ? Math.abs(py - armBaseY) - aw : 999;

      const vBaseX = cx + side * (bw + hLen);
      const vDx = px - vBaseX;
      const vTop = armBend;
      const vertD = (py >= vTop - aw && py <= armBaseY + aw)
        ? Math.abs(vDx) - aw : 999;
      const vTopCap = Math.sqrt(vDx * vDx + (py - vTop) ** 2) - aw;

      armD = Math.min(armD, horzD, vertD, vTopCap);
    }

    const mainBody = Math.min(bodyD, topCap);
    const d = Math.min(mainBody, armD);

    const ribPattern = Math.sin(dx / bw * Math.PI * 4) * 0.08;
    const spineShade = (Math.abs(Math.sin(py * 0.15 + dx * 0.1)) < 0.05) ? 0.3 : 0;
    return {
      d,
      shade: ribPattern + spineShade + 0.05,
      hue: p.hueBase + Math.sin(dy / r * 2 + t * 0.2) * 8,
      sat: p.satBase,
    };
  };
}

// ── 26: Dandelion ────────────────────────────────────

interface DandelionParams {
  seedCount: number;
  seedLen: number;
  puffSize: number;
  swaySpeed: number;
  detachSpeed: number;
  hueBase: number;
  satBase: number;
}

function makeDandelion(p: DandelionParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const sway = Math.sin(t * p.swaySpeed) * r * 0.02;

    const stemBot = cy + r * 0.45;
    const stemTop = cy - r * 0.1;
    const stemD = (py >= stemTop && py <= stemBot)
      ? Math.abs(dx - sway * (1 - (py - stemTop) / (stemBot - stemTop))) - r * 0.015
      : 999;

    const puffCx = cx + sway;
    const puffCy = stemTop;
    const pdx = px - puffCx, pdy = py - puffCy;
    const puffDist = Math.sqrt(pdx * pdx + pdy * pdy);
    const puffR = r * p.puffSize;
    const puffCore = puffDist - r * 0.04;

    let seedD = 999;
    for (let i = 0; i < p.seedCount; i++) {
      const seedAngle = (i / p.seedCount) * Math.PI * 2 + Math.sin(t * 0.1 + i) * 0.1;
      const detach = Math.max(0, Math.sin(t * p.detachSpeed + i * 0.7) - 0.7) * r * 0.15;
      const drift = detach * Math.sin(t * 0.5 + i * 2) * 0.5;

      for (let j = 0; j <= 5; j++) {
        const frac = j / 5;
        const sr = frac * r * p.seedLen + detach;
        const sx = puffCx + Math.cos(seedAngle) * sr + drift;
        const sy = puffCy + Math.sin(seedAngle) * sr - detach * 0.5;
        const thick = r * (0.008 + (1 - frac) * 0.005);
        seedD = Math.min(seedD, Math.sqrt((px - sx) ** 2 + (py - sy) ** 2) - thick);
      }

      const tuftX = puffCx + Math.cos(seedAngle) * (r * p.seedLen + detach) + drift;
      const tuftY = puffCy + Math.sin(seedAngle) * (r * p.seedLen + detach) - detach * 0.5;
      for (let k = 0; k < 5; k++) {
        const ta = seedAngle + (k / 5 - 0.5) * 1.5;
        const tx = tuftX + Math.cos(ta) * r * 0.03;
        const ty = tuftY + Math.sin(ta) * r * 0.03;
        seedD = Math.min(seedD, Math.sqrt((px - tx) ** 2 + (py - ty) ** 2) - r * 0.004);
      }
    }

    const d = Math.min(stemD, puffCore, seedD);
    const isStem = stemD === d;
    return {
      d,
      shade: isStem ? 0.05 : 0.2,
      hue: isStem ? p.hueBase - 30 : p.hueBase + Math.sin(puffDist * 0.05 + t) * 10,
      sat: isStem ? 35 : p.satBase,
    };
  };
}

// ── 27: Dragonfly ────────────────────────────────────

interface DragonflyParams {
  bodyLen: number;
  wingSpan: number;
  wingLen: number;
  hoverSpeed: number;
  wingBeat: number;
  hueBody: number;
  hueWing: number;
  satBase: number;
}

function makeDragonfly(p: DragonflyParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const hover = Math.sin(t * p.hoverSpeed) * r * 0.06;
    const drift = Math.sin(t * p.hoverSpeed * 0.7) * r * 0.04;
    const dx = px - (cx + drift), dy = py - (cy + hover);

    const bodyD = Math.sqrt(dx * dx * 8 + dy * dy) - r * p.bodyLen;
    const headD = Math.sqrt((dx - r * p.bodyLen * 0.35) ** 2 * 1.5 + dy * dy * 1.5) - r * 0.07;
    const tailTaper = Math.max(0, (-dx - r * p.bodyLen * 0.2) / (r * p.bodyLen));
    const tailW = r * 0.03 * (1 - tailTaper * 0.6);
    const tailD = (dx < -r * p.bodyLen * 0.2) ? Math.abs(dy) - tailW : 999;
    const tailEnd = dx + r * p.bodyLen * 0.8;

    const wingFlap = Math.sin(t * p.wingBeat) * 0.15;
    const adx = Math.abs(dy);
    let wingD = 999;
    const wingPairs = [
      { x: r * 0.05, len: r * p.wingLen, w: r * 0.08 },
      { x: -r * 0.08, len: r * p.wingLen * 0.85, w: r * 0.07 },
    ];
    for (const wp of wingPairs) {
      const wx = dx - wp.x;
      const wy = adx - wp.len * (0.5 + wingFlap);
      const wd = Math.sqrt(wx * wx * 0.5 + wy * wy) - wp.w;
      wingD = Math.min(wingD, wd);
    }

    const eyeD = Math.sqrt((dx - r * p.bodyLen * 0.4) ** 2 + (Math.abs(dy) - r * 0.03) ** 2) - r * 0.02;
    const d = Math.min(bodyD, headD, Math.max(tailD, tailEnd), wingD, eyeD);
    const isWing = wingD === d;
    const isEye = eyeD === d;
    return {
      d,
      shade: isWing ? 0.08 : isEye ? 0.5 : 0.15,
      hue: isWing ? p.hueWing + Math.sin(t * 0.5) * 15 : isEye ? 40 : p.hueBody,
      sat: isWing ? p.satBase - 15 : isEye ? 80 : p.satBase,
    };
  };
}

// ── 28: Seahorse ─────────────────────────────────────

interface SeahorseParams {
  bodyScale: number;
  curlTight: number;
  bobSpeed: number;
  snoutLen: number;
  finSpeed: number;
  hueBase: number;
  satBase: number;
}

function makeSeahorse(p: SeahorseParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const bob = Math.sin(t * p.bobSpeed) * r * 0.05;
    let minD = 999;
    let isHead = false;

    for (let i = 0; i <= 40; i++) {
      const frac = i / 40;
      const curveAngle = frac * Math.PI * p.curlTight + Math.PI * 0.5;
      const spiralR = r * p.bodyScale * (0.35 - frac * 0.3);
      const sx = cx + Math.cos(curveAngle) * spiralR;
      const sy = cy - r * 0.2 + frac * r * 0.7 + bob + Math.sin(curveAngle) * spiralR * 0.3;
      const thick = r * (0.06 - frac * 0.04) * (1 + Math.sin(t * 0.5) * 0.05);
      const seg = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2) - thick;
      if (seg < minD) {
        minD = seg;
        isHead = frac < 0.1;
      }
    }

    const headX = cx + Math.cos(Math.PI * 0.5) * r * p.bodyScale * 0.35;
    const headY = cy - r * 0.2 + bob;
    const headD = Math.sqrt((px - headX) ** 2 * 1.5 + (py - headY) ** 2 * 2) - r * 0.08;
    if (headD < minD) { minD = headD; isHead = true; }

    const snoutD = Math.sqrt(
      ((px - headX - r * p.snoutLen * 0.5) * 1.5) ** 2 +
      ((py - headY + r * 0.02) * 4) ** 2
    ) - r * p.snoutLen;
    minD = Math.min(minD, snoutD);

    const eyeD = Math.sqrt((px - headX + r * 0.02) ** 2 + (py - headY) ** 2) - r * 0.02;
    minD = Math.min(minD, eyeD);
    const isEye = eyeD < minD + 0.5;

    const crownY = headY - r * 0.08;
    let crownD = 999;
    for (let i = 0; i < 5; i++) {
      const ca = (i / 5 - 0.5) * 1.2 - 0.3;
      const cx2 = headX + Math.cos(ca) * r * 0.06;
      const cy2 = crownY + Math.sin(ca) * r * 0.04 - r * 0.02;
      crownD = Math.min(crownD, Math.sqrt((px - cx2) ** 2 + (py - cy2) ** 2) - r * 0.012);
    }
    minD = Math.min(minD, crownD);

    const finX = cx - r * 0.05;
    const finY = cy + r * 0.05 + bob;
    const finWave = Math.sin(t * p.finSpeed + (py - finY) * 0.1) * r * 0.03;
    const finD = Math.sqrt(((px - finX - finWave) * 3) ** 2 + (py - finY) ** 2) - r * 0.08;
    minD = Math.min(minD, finD);

    return {
      d: minD,
      shade: isEye ? 0.5 : 0.12,
      hue: isEye ? 40 : p.hueBase + Math.sin((py - cy) / r * 4 + t * 0.3) * 15,
      sat: isEye ? 80 : p.satBase,
    };
  };
}

// ── 29: Amoeba ───────────────────────────────────────

interface AmoebaParams {
  blobCount: number;
  morphSpeed: number;
  baseSize: number;
  pseudopodLen: number;
  hueBase: number;
  satBase: number;
  nucleusSize: number;
}

function makeAmoeba(p: AmoebaParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    let blobR = r * p.baseSize;
    for (let i = 0; i < p.blobCount; i++) {
      const bAngle = (i / p.blobCount) * Math.PI * 2 + Math.sin(t * p.morphSpeed * 0.3 + i * 1.7) * 0.5;
      const aDiff = angle - bAngle;
      const wrapped = Math.atan2(Math.sin(aDiff), Math.cos(aDiff));
      const influence = Math.exp(-wrapped * wrapped * 3);
      const extend = Math.sin(t * p.morphSpeed + i * 2.3) * r * p.pseudopodLen;
      blobR += influence * extend;
    }

    const noise = fbm(angle * 2 + t * p.morphSpeed * 0.5, dist * 0.01 + t * 0.2, 3) * r * 0.08;
    blobR += noise;

    const bodyD = dist - blobR;

    const nucleusDx = dx - Math.sin(t * p.morphSpeed * 0.4) * r * 0.05;
    const nucleusDy = dy - Math.cos(t * p.morphSpeed * 0.3) * r * 0.04;
    const nucleusDist = Math.sqrt(nucleusDx * nucleusDx + nucleusDy * nucleusDy);
    const nucleusD = nucleusDist - r * p.nucleusSize;

    const d = Math.min(bodyD, nucleusD);
    const isNucleus = nucleusD === d;
    const membrane = Math.max(0, 1 - Math.abs(bodyD) / (r * 0.05)) * 0.2;
    return {
      d,
      shade: isNucleus ? 0.3 : membrane + 0.05,
      hue: isNucleus ? p.hueBase + 30 : p.hueBase + Math.sin(angle * 2 + t * 0.3) * 15,
      sat: isNucleus ? p.satBase + 15 : p.satBase,
    };
  };
}

// ── 30: Eclipse ──────────────────────────────────────

interface EclipseParams {
  moonSize: number;
  coronaLen: number;
  coronaRays: number;
  pulseSpeed: number;
  beadCount: number;
  hueCorona: number;
  satBase: number;
}

function makeEclipse(p: EclipseParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const moonR = r * p.moonSize;
    const moonD = dist - moonR;

    const pulse = 1 + Math.sin(t * p.pulseSpeed) * 0.1;
    const rayMod = (Math.sin(angle * p.coronaRays + t * 0.3) * 0.5 + 0.5) * 0.6 + 0.4;
    const coronaR = moonR + r * p.coronaLen * pulse * rayMod;
    const coronaNoise = fbm(angle * 3 + t * 0.4, dist * 0.01 + t * 0.2, 3) * r * 0.08;
    const coronaD = dist - (coronaR + coronaNoise);

    let beadD = 999;
    for (let i = 0; i < p.beadCount; i++) {
      const ba = (i / p.beadCount) * Math.PI * 2 + t * 0.1;
      const bx = cx + Math.cos(ba) * moonR;
      const by = cy + Math.sin(ba) * moonR;
      const bPulse = Math.sin(t * p.pulseSpeed * 2 + i * 1.5) * 0.5 + 0.5;
      beadD = Math.min(beadD, Math.sqrt((px - bx) ** 2 + (py - by) ** 2) - r * 0.025 * bPulse);
    }

    if (moonD < 0) {
      return { d: Math.abs(moonD) + 5, shade: 0, hue: 0, sat: 0 };
    }

    const d = Math.min(coronaD, beadD);
    const coronaFrac = Math.max(0, 1 - (dist - moonR) / (r * p.coronaLen));
    return {
      d,
      shade: coronaFrac * 0.4 + 0.1,
      hue: p.hueCorona + coronaFrac * 30,
      sat: p.satBase + coronaFrac * 20,
    };
  };
}

// ── 31: Seashell ─────────────────────────────────────

interface SeashellParams {
  coils: number;
  growth: number;
  ribCount: number;
  rotSpeed: number;
  hueBase: number;
  hueAccent: number;
  satBase: number;
}

function makeSeashell(p: SeashellParams): AnimationFn {
  return (px, py, cx, cy, r, t) => {
    const dx = px - cx, dy = py - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    let minD = 999;
    let closestFrac = 0;
    const totalAngle = p.coils * Math.PI * 2;
    for (let i = 0; i <= 60; i++) {
      const frac = i / 60;
      const a = frac * totalAngle + t * p.rotSpeed - Math.PI * 0.5;
      const spiralR = r * 0.06 * Math.exp(p.growth * frac * p.coils);
      if (spiralR > r * 0.9) continue;
      const sx = cx + Math.cos(a) * spiralR * 0.9;
      const sy = cy + Math.sin(a) * spiralR;
      const thick = r * (0.02 + frac * 0.06);
      const seg = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2) - thick;
      if (seg < minD) { minD = seg; closestFrac = frac; }
    }

    const outerFrac = closestFrac;
    const lip = outerFrac > 0.85 ? (outerFrac - 0.85) / 0.15 : 0;
    const lipFlare = lip * r * 0.04;
    minD -= lipFlare;

    const ribShade = Math.sin(closestFrac * p.ribCount * Math.PI * 2) * 0.12;
    const pearlShade = Math.sin(closestFrac * 20 + t * 0.3) * 0.08 + 0.08;
    return {
      d: minD,
      shade: ribShade + pearlShade,
      hue: p.hueBase + closestFrac * (p.hueAccent - p.hueBase),
      sat: p.satBase + closestFrac * 10,
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

  const shapeIdx = seed % 32;

  const rf = (min: number, max: number) => min + rng() * (max - min);
  const ri = (min: number, max: number) => Math.floor(min + rng() * (max - min + 1));

  switch (shapeIdx) {
    case 0:
      return makeRose({
        petals: ri(3, 9), innerPetals: ri(3, 11), bloomSpeed: rf(0.2, 0.7),
        rotSpeed: rf(0.08, 0.25), breatheSpeed: rf(0.6, 1.8),
        hueBase: ri(200, 340), hueRange: rf(8, 30), satBase: ri(45, 80), scale: rf(0.75, 0.95),
      });
    case 1:
      return makeVortex({
        arms: ri(2, 6), spinSpeed: rf(0.8, 2.5), pulseSpeed: rf(0.3, 0.9),
        tightness: rf(0.02, 0.05), hueBase: ri(180, 300), satBase: ri(40, 75),
        scale: rf(0.55, 0.80), eyeSize: rf(0.04, 0.12),
      });
    case 2:
      return makeJellyfish({
        tentacles: ri(4, 8), pulseSpeed: rf(0.5, 1.2), swaySpeed: rf(1.0, 2.2),
        bellSize: rf(0.4, 0.65), spread: rf(0.08, 0.16),
        hueBase: ri(220, 320), satBase: ri(40, 70),
      });
    case 3:
      return makePhoenix({
        flapSpeed: rf(0.7, 1.8), riseSpeed: rf(0.2, 0.5), wingSpan: rf(0.7, 1.0),
        wingWidth: rf(0.18, 0.32), tailFlicker: rf(2.0, 4.5),
        hueBody: ri(220, 300), hueTail: ri(5, 45), satBody: ri(50, 75),
      });
    case 4:
      return makeWaves({
        layers: ri(3, 7), speed: rf(0.4, 1.2), amplitude: rf(0.15, 0.35),
        frequency: rf(2, 5), hueBase: ri(160, 230), satBase: ri(50, 80), drift: rf(0.3, 0.9),
      });
    case 5:
      return makeFlame({
        flickerSpeed: rf(1.0, 3.0), swaySpeed: rf(0.3, 0.8), swayAmount: rf(0.05, 0.15),
        width: rf(0.25, 0.45), height: rf(0.6, 0.85), layers: ri(2, 4),
        hueCore: ri(40, 60), hueMid: ri(15, 35), hueOuter: ri(0, 15), satBase: ri(70, 95),
      });
    case 6:
      return makeCrystal({
        facets: ri(5, 9), growSpeed: rf(0.3, 0.8), shimmer: rf(1, 3),
        mainSize: rf(0.35, 0.55), shardCount: ri(3, 6),
        hueBase: ri(170, 280), satBase: ri(35, 65),
      });
    case 7:
      return makeOctopus({
        tentacles: ri(6, 8), curlTight: rf(1.5, 3.0), pulseSpeed: rf(0.4, 1.0),
        swaySpeed: rf(0.8, 1.8), headSize: rf(0.3, 0.45), eyeSize: rf(0.04, 0.07),
        hueBase: ri(280, 360), satBase: ri(50, 80),
      });
    case 8:
      return makeFish({
        bodyLen: rf(0.35, 0.55), bodyHeight: rf(0.18, 0.28), tailSize: rf(0.15, 0.25),
        swimSpeed: rf(0.5, 1.5), waveAmp: rf(0.03, 0.08),
        hueBase: ri(180, 220), satBase: ri(50, 80),
      });
    case 9:
      return makeTurtle({
        shellSize: rf(0.35, 0.5), headSize: rf(0.08, 0.14), flipperLen: rf(0.1, 0.18),
        swimSpeed: rf(0.3, 0.8), hueShell: ri(80, 140), hueBody: ri(100, 160), satBase: ri(40, 70),
      });
    case 10:
      return makeTree({
        trunkWidth: rf(0.04, 0.08), trunkHeight: rf(0.4, 0.6), canopySize: rf(0.3, 0.45),
        swaySpeed: rf(0.3, 0.8), swayAmount: rf(0.02, 0.06),
        hueLeaves: ri(90, 150), hueTrunk: ri(25, 45), satBase: ri(45, 75),
      });
    case 11:
      return makePalmTree({
        trunkCurve: rf(0.08, 0.2), frondCount: ri(5, 9), frondLen: rf(0.25, 0.4),
        swaySpeed: rf(0.4, 1.0), hueLeaves: ri(85, 140), hueTrunk: ri(25, 45), satBase: ri(45, 70),
      });
    case 12:
      return makePlanet({
        size: rf(0.4, 0.55), bands: ri(3, 8), bandSpeed: rf(0.1, 0.4),
        ringTilt: rf(0.2, 0.5), ringWidth: rf(0.15, 0.35),
        hueBase: ri(15, 45), hueBand: ri(15, 40), satBase: ri(50, 80),
      });
    case 13:
      return makeSun({
        coreSize: rf(0.25, 0.38), rayCount: ri(8, 16), rayLen: rf(0.15, 0.35),
        pulseSpeed: rf(0.3, 0.8), flareSpeed: rf(0.5, 1.5),
        hueCore: ri(40, 55), hueCorona: ri(15, 40), satBase: ri(70, 95),
      });
    case 14:
      return makeSnowflake({
        armWidth: rf(0.02, 0.04), branchLen: rf(0.1, 0.2), branchCount: ri(2, 5),
        rotSpeed: rf(0.05, 0.2), sparkle: rf(1, 3),
        hueBase: ri(190, 230), satBase: ri(30, 60),
      });
    case 15:
      return makeMushroom({
        capSize: rf(0.3, 0.45), capHeight: rf(0.5, 0.8), stemWidth: rf(0.06, 0.1),
        stemHeight: rf(0.3, 0.5), spotCount: ri(3, 7), pulseSpeed: rf(0.3, 0.8),
        hueCap: ri(0, 30), hueSpot: ri(40, 60), satBase: ri(55, 80),
      });
    case 16:
      return makeButterfly({
        wingSpan: rf(0.6, 0.9), wingHeight: rf(0.2, 0.35), flapSpeed: rf(1.5, 3.5),
        hoverSpeed: rf(0.5, 1.2), hueUpper: ri(260, 320), hueLower: ri(20, 50), satBase: ri(55, 85),
      });
    case 17:
      return makeStarfish({
        arms: ri(5, 7), armLen: rf(0.4, 0.65), armWidth: rf(0.08, 0.15),
        rotSpeed: rf(0.03, 0.1), pulseSpeed: rf(0.3, 0.8),
        hueBase: ri(10, 40), satBase: ri(55, 80),
      });
    case 18:
      return makeCoral({
        branches: ri(4, 7), branchLen: rf(0.5, 0.75), swaySpeed: rf(0.3, 0.8),
        thickness: rf(0.03, 0.06), hueBase: ri(340, 370), satBase: ri(50, 75), roughness: rf(0.02, 0.05),
      });
    case 19:
      return makeNautilus({
        coils: rf(2.0, 3.5), growth: rf(0.15, 0.3), thickness: rf(0.03, 0.06),
        rotSpeed: rf(0.05, 0.2), hueBase: ri(20, 50), hueInner: ri(330, 360), satBase: ri(45, 70),
      });
    case 20:
      return makeFern({
        leaflets: ri(6, 12), curlAmount: rf(1.5, 3.0), swaySpeed: rf(0.3, 0.8),
        stemLen: rf(0.7, 0.9), leafLen: rf(0.1, 0.2),
        hueBase: ri(100, 145), satBase: ri(50, 75),
      });
    case 21:
      return makeLotus({
        petalLayers: ri(3, 5), petalCount: ri(6, 10), openSpeed: rf(0.2, 0.6),
        hueInner: ri(330, 360), hueOuter: ri(290, 330), satBase: ri(55, 80), waterHue: ri(180, 210),
      });
    case 22:
      return makeTornado({
        width: rf(0.2, 0.35), height: rf(0.7, 0.9), spinSpeed: rf(2, 5),
        swaySpeed: rf(0.3, 0.8), swayAmount: rf(0.05, 0.15), layers: ri(3, 6),
        hueBase: ri(200, 240), satBase: ri(30, 55),
      });
    case 23:
      return makeGalaxy({
        arms: ri(2, 5), tightness: rf(0.02, 0.06), spinSpeed: rf(0.2, 0.6),
        coreSize: rf(0.08, 0.15), diskSize: rf(0.55, 0.75),
        hueCore: ri(40, 60), hueArm: ri(210, 270), satBase: ri(40, 70),
      });
    case 24:
      return makeLightning({
        segments: ri(8, 15), spread: rf(0.1, 0.25), branches: ri(2, 4),
        flashSpeed: rf(1.5, 4.0), thickness: rf(0.015, 0.03),
        hueBase: ri(220, 270), satBase: ri(60, 90),
      });
    case 25:
      return makeCactus({
        bodyWidth: rf(0.08, 0.14), bodyHeight: rf(0.6, 0.85), armCount: ri(1, 3),
        armHeight: rf(0.15, 0.3), breatheSpeed: rf(0.2, 0.5),
        hueBase: ri(100, 145), satBase: ri(50, 75),
      });
    case 26:
      return makeDandelion({
        seedCount: ri(12, 24), seedLen: rf(0.12, 0.22), puffSize: rf(0.08, 0.14),
        swaySpeed: rf(0.3, 0.8), detachSpeed: rf(0.2, 0.6),
        hueBase: ri(50, 70), satBase: ri(30, 55),
      });
    case 27:
      return makeDragonfly({
        bodyLen: rf(0.15, 0.25), wingSpan: rf(0.3, 0.5), wingLen: rf(0.2, 0.35),
        hoverSpeed: rf(0.5, 1.2), wingBeat: rf(3, 8),
        hueBody: ri(140, 200), hueWing: ri(180, 240), satBase: ri(50, 75),
      });
    case 28:
      return makeSeahorse({
        bodyScale: rf(0.7, 1.0), curlTight: rf(1.5, 2.5), bobSpeed: rf(0.4, 1.0),
        snoutLen: rf(0.06, 0.12), finSpeed: rf(1.5, 3.0),
        hueBase: ri(20, 50), satBase: ri(55, 80),
      });
    case 29:
      return makeAmoeba({
        blobCount: ri(4, 8), morphSpeed: rf(0.4, 1.2), baseSize: rf(0.3, 0.5),
        pseudopodLen: rf(0.08, 0.18), hueBase: ri(80, 160), satBase: ri(40, 65), nucleusSize: rf(0.08, 0.14),
      });
    case 30:
      return makeEclipse({
        moonSize: rf(0.25, 0.38), coronaLen: rf(0.15, 0.35), coronaRays: ri(8, 16),
        pulseSpeed: rf(0.2, 0.6), beadCount: ri(5, 10),
        hueCorona: ri(30, 55), satBase: ri(60, 90),
      });
    case 31:
    default:
      return makeSeashell({
        coils: rf(2.0, 3.5), growth: rf(0.2, 0.35), ribCount: ri(8, 16),
        rotSpeed: rf(0.03, 0.12), hueBase: ri(20, 50), hueAccent: ri(330, 360), satBase: ri(40, 65),
      });
  }
}

export const ANIMATIONS = { rose, vortex, jellyfish, phoenix } as const;
