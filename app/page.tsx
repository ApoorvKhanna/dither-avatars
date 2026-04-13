'use client';

import { useState, useCallback } from 'react';
import HalftoneCanvas from '../src/halftone-canvas';
import { animationForAgent, type AnimationFn } from '../src/animations';

const ADJECTIVES = [
  'Shadow', 'Neon', 'Cosmic', 'Feral', 'Hollow', 'Iron', 'Velvet', 'Toxic',
  'Phantom', 'Rogue', 'Silent', 'Wicked', 'Frozen', 'Savage', 'Hyper', 'Dread',
  'Astral', 'Pixel', 'Glitch', 'Void', 'Crimson', 'Flux', 'Quantum', 'Nova',
  'Ghost', 'Storm', 'Blitz', 'Zero', 'Havoc', 'Cipher', 'Chrome', 'Ember',
];
const NOUNS = [
  'Wolf', 'Panda', 'Falcon', 'Viper', 'Fox', 'Shark', 'Raven', 'Dragon',
  'Lynx', 'Mantis', 'Phoenix', 'Cobra', 'Hawk', 'Tiger', 'Orca', 'Raptor',
  'Moth', 'Jackal', 'Kraken', 'Beetle', 'Wraith', 'Golem', 'Daemon', 'Nomad',
  'Ronin', 'Bandit', 'Spectre', 'Hunter', 'Drifter', 'Coyote', 'Osprey', 'Mamba',
];

function randomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

const SHAPE_NAMES = ['Rose', 'Vortex', 'Jellyfish', 'Phoenix', 'Waves', 'Flame', 'Crystal', 'Octopus'];

function shapeForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return SHAPE_NAMES[Math.abs(h) % 8];
}

function generateBatch(count: number): { name: string; anim: AnimationFn }[] {
  return Array.from({ length: count }, () => {
    const name = randomName();
    return { name, anim: animationForAgent(name) };
  });
}

export default function DemoPage() {
  const [dark, setDark] = useState(true);
  const [avatars, setAvatars] = useState(() => generateBatch(16));
  const [customName, setCustomName] = useState('');
  const [customAvatar, setCustomAvatar] = useState<{ name: string; anim: AnimationFn } | null>(null);

  const regenerate = useCallback(() => setAvatars(generateBatch(16)), []);

  const generateFromName = useCallback(() => {
    if (!customName.trim()) return;
    setCustomAvatar({ name: customName.trim(), anim: animationForAgent(customName.trim()) });
  }, [customName]);

  const bg = dark ? '#0a0a0f' : '#f5f5f0';
  const fg = dark ? '#e2e2e8' : '#1a1a1a';
  const cardBg = dark ? '#12121c' : '#ffffff';
  const borderCol = dark ? '#1e1e2a' : '#e0e0e0';
  const mutedCol = dark ? '#555' : '#999';
  const accentCol = '#818cf8';

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: ${bg}; color: ${fg}; font-family: 'Inter', system-ui, sans-serif; transition: background 0.3s, color 0.3s; }
        .page { background: ${bg}; min-height: 100vh; }

        .page { max-width: 1100px; margin: 0 auto; padding: 48px 32px; }

        .header { text-align: center; margin-bottom: 40px; }
        .header h1 {
          font-family: 'Playfair Display', serif;
          font-size: 48px;
          font-weight: 900;
          letter-spacing: -1px;
          margin-bottom: 8px;
        }
        .header h1 span { color: ${accentCol}; }
        .header p { color: ${mutedCol}; font-size: 15px; line-height: 1.6; max-width: 520px; margin: 0 auto 16px; }
        .header-stats {
          display: flex;
          justify-content: center;
          gap: 32px;
          font-size: 12px;
          color: ${mutedCol};
        }
        .header-stats strong { color: ${fg}; font-size: 16px; display: block; }

        .controls {
          display: flex;
          gap: 10px;
          justify-content: center;
          align-items: center;
          margin-bottom: 36px;
          flex-wrap: wrap;
        }
        .btn {
          background: ${accentCol};
          color: #fff;
          border: none;
          padding: 10px 24px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn:hover { background: #6366f1; }
        .btn--outline {
          background: transparent;
          border: 1px solid ${borderCol};
          color: ${fg};
        }
        .btn--outline:hover { border-color: ${accentCol}; color: ${accentCol}; background: transparent; }

        .toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border: 1px solid ${borderCol};
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          color: ${fg};
          background: ${cardBg};
          transition: all 0.2s;
        }
        .toggle:hover { border-color: ${accentCol}; }
        .toggle-icon { font-size: 16px; }

        .name-input {
          background: ${cardBg};
          border: 1px solid ${borderCol};
          color: ${fg};
          padding: 10px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-family: 'JetBrains Mono', monospace;
          width: 220px;
          outline: none;
          transition: border 0.2s;
        }
        .name-input:focus { border-color: ${accentCol}; }
        .name-input::placeholder { color: ${mutedCol}; }

        .preview {
          display: flex;
          justify-content: center;
          margin-bottom: 40px;
        }
        .preview-card {
          background: ${cardBg};
          border: 2px solid ${accentCol};
          border-radius: 12px;
          overflow: hidden;
          text-align: center;
          width: 280px;
          box-shadow: 0 8px 32px rgba(129,140,248,0.15);
        }
        .preview-canvas { display: block; }
        .preview-info {
          padding: 14px;
          border-top: 1px solid ${borderCol};
        }
        .preview-name {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          font-weight: 700;
        }
        .preview-shape {
          font-size: 11px;
          color: ${mutedCol};
          margin-top: 2px;
          font-family: 'JetBrains Mono', monospace;
        }

        .section-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 3px;
          color: ${mutedCol};
          font-weight: 600;
          margin-bottom: 20px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }
        .card {
          background: ${cardBg};
          border: 1px solid ${borderCol};
          border-radius: 8px;
          overflow: hidden;
          transition: transform 0.2s, border-color 0.2s;
          cursor: pointer;
        }
        .card:hover { transform: translateY(-3px); border-color: ${accentCol}30; }
        .card canvas { display: block; width: 100%; height: auto; background: ${dark ? 'transparent' : '#ffffff'}; }
        .preview-canvas { background: ${dark ? 'transparent' : '#ffffff'}; }
        .card-info {
          padding: 10px 14px;
          border-top: 1px solid ${borderCol};
        }
        .card-name {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 600;
          color: ${fg};
        }
        .card-shape {
          font-size: 10px;
          color: ${mutedCol};
          margin-top: 2px;
        }

        .footer {
          text-align: center;
          padding: 40px 20px;
          color: ${mutedCol};
          font-size: 12px;
          line-height: 1.6;
        }
        .footer strong { color: ${fg}; }

        @media (max-width: 768px) {
          .page { padding: 24px 16px; }
          .header h1 { font-size: 32px; }
          .grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .controls { flex-direction: column; }
          .name-input { width: 100%; }
        }
      `}</style>

      <div className="page">
        <div className="header">
          <h1>Dither <span>Avatars</span></h1>
          <p>
            Procedural halftone avatars. 8 shapes, billions of variants.
            Type any name to generate a unique, deterministic, animated identity.
          </p>
          <div className="header-stats">
            <div><strong>8</strong> shapes</div>
            <div><strong>2B+</strong> variants</div>
            <div><strong>0</strong> dependencies</div>
          </div>
        </div>

        <div className="controls">
          <input
            className="name-input"
            type="text"
            placeholder="Type a name..."
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generateFromName()}
          />
          <button className="btn" onClick={generateFromName}>Generate</button>
          <button className="btn btn--outline" onClick={regenerate}>Randomize Grid</button>
          <button className="toggle" onClick={() => setDark(d => !d)}>
            <span className="toggle-icon">{dark ? '\u2600' : '\u263E'}</span>
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>

        {customAvatar && (
          <div className="preview">
            <div className="preview-card">
              <HalftoneCanvas
                key={`${customAvatar.name}-${dark}`}
                className="preview-canvas"
                animation={customAvatar.anim}
                width={280}
                height={280}
                options={{ dotSpacing: 5, maxDotRadius: 2.5, timeScale: 0.9, timeOffset: 0, lightMode: !dark }}
              />
              <div className="preview-info">
                <div className="preview-name">{customAvatar.name}</div>
                <div className="preview-shape">{shapeForName(customAvatar.name)}</div>
              </div>
            </div>
          </div>
        )}

        <div className="section-label">Random Avatars</div>
        <div className="grid">
          {avatars.map(({ name, anim }, i) => (
            <div key={`${name}-${i}`} className="card">
              <HalftoneCanvas
                key={`${name}-${dark}`}
                animation={anim}
                width={260}
                height={200}
                options={{
                  dotSpacing: 5,
                  maxDotRadius: 2.5,
                  timeScale: 0.9,
                  timeOffset: i * 7,
                  lightMode: !dark,
                }}
              />
              <div className="card-info">
                <div className="card-name">{name}</div>
                <div className="card-shape">{shapeForName(name)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="footer">
          Pure Canvas. <strong>Zero dependencies.</strong> Deterministic from any string.<br />
          Rose / Vortex / Jellyfish / Phoenix / Waves / Flame / Crystal / Octopus
        </div>
      </div>
    </>
  );
}
