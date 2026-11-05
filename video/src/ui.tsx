// Dark cinematic primitives for a 4:5 (1080x1350) explainer that reads on a phone and a laptop.
import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate, Easing} from 'remotion';
import {loadFont as loadOnest} from '@remotion/google-fonts/Onest';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';

export const {fontFamily: SANS} = loadOnest('normal', {weights: ['400', '600', '800'], subsets: ['latin', 'cyrillic']});
export const {fontFamily: MONO} = loadMono('normal', {weights: ['400', '500'], subsets: ['latin', 'cyrillic']});

export const BG = '#06080B';
export const TEXT = '#F4F1EA';
export const DIM = '#8A929C';
export const COL: Record<string, string> = {
  kalpak: '#FFB020', elechek: '#22D3EE', tunduk: '#FF6B4A', yurt: '#A3E635', horse: '#C084FC', miss: '#FF4D4D',
};

export const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const ramp = (f: number, a: number, b: number, e = OUT) => interpolate(f, [a, b], [0, 1], {...CLAMP, easing: e});
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const grad = (a: string, b: string): React.CSSProperties => ({
  backgroundImage: `linear-gradient(90deg, ${a}, ${b})`,
  WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
});

// Headline: words rise in one by one; one line can carry a gradient.
export const Words: React.FC<{
  text: string; at?: number; size?: number; color?: string; gradLine?: number; gradFrom?: string; gradTo?: string;
  style?: React.CSSProperties;
}> = ({text, at = 0, size = 92, color = TEXT, gradLine = -1, gradFrom = COL.kalpak, gradTo = COL.tunduk, style}) => {
  const f = useCurrentFrame();
  let k = 0;
  return (
    <div style={{position: 'absolute', fontFamily: SANS, fontSize: size, fontWeight: 800, lineHeight: 1.04,
      letterSpacing: -size * 0.035, color, ...style}}>
      {text.split('|').map((line, li) => (
        <div key={li} style={{display: 'flex', flexWrap: 'wrap', columnGap: size * 0.24}}>
          {line.split(' ').map((w, wi) => {
            const p = at < 0 ? 1 : ramp(f, at + k * 3, at + k * 3 + 16);  // at < 0: fully shown (frame 0 = thumbnail)
            k++;
            return (
              <span key={wi} style={{display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * size * 0.35}px)`,
                filter: `blur(${(1 - p) * 8}px)`, ...(li === gradLine ? grad(gradFrom, gradTo) : {})}}>{w}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export const Mono: React.FC<{children: React.ReactNode; at?: number; size?: number; color?: string; style?: React.CSSProperties}> = ({
  children, at = 0, size = 24, color = DIM, style,
}) => {
  const f = useCurrentFrame();
  const p = at < 0 ? 1 : ramp(f, at, at + 14);
  return (
    <div style={{position: 'absolute', fontFamily: MONO, fontSize: size, lineHeight: 1.45, letterSpacing: 0.4, color, opacity: p,
      transform: `translateY(${(1 - p) * 10}px)`, ...style}}>{children}</div>
  );
};

// Fades a section in and out over its own local frames.
export const Section: React.FC<{dur: number; fadeIn?: boolean; children: React.ReactNode}> = ({dur, fadeIn = true, children}) => {
  const f = useCurrentFrame();
  const o = Math.min(fadeIn ? ramp(f, 0, 8, IN_OUT) : 1, 1 - ramp(f, dur - 8, dur, IN_OUT));
  return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};

// Background: near-black with a slow warm/teal glow and fine grain.
export const Backdrop: React.FC = () => {
  const f = useCurrentFrame();
  const s = Math.sin(f / 70);
  return (
    <AbsoluteFill style={{background: BG}}>
      <AbsoluteFill style={{background: `radial-gradient(900px 620px at ${50 + s * 8}% -6%, rgba(255,176,32,0.16), transparent 70%)`}} />
      <AbsoluteFill style={{background: `radial-gradient(800px 700px at ${70 - s * 6}% 108%, rgba(34,211,238,0.10), transparent 70%)`}} />
      <svg width="100%" height="100%" style={{position: 'absolute', opacity: 0.09, mixBlendMode: 'overlay'}}>
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={Math.floor(f / 2) % 8} /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};
