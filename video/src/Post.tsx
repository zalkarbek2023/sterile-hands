// Sterile Hands: the post video (4:5, 1080x1350) cut from one real recording of the app.
// The scene and the selfie are the app's own canvases, recorded in sync; captions follow chapters.json,
// and the small "detected" chip shows what MediaPipe classified on that very frame.
import React from 'react';
import {AbsoluteFill, Sequence, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';
import chapters from '../public/clips/chapters.json';
import atlas from '../public/clips/polyps.json';
import {Words, Mono, Backdrop, ramp, lerp, IN_OUT, SANS, MONO, TEXT, DIM} from './ui';

type Ch = {id: string; dur: number; gesture: string | null; polyp: number; polyps: number[]; detected: string[]; apart: number[]};
const CH = chapters as unknown as Ch[];
const POLYPS = (atlas as unknown as {polyps: {size_mm: number; histology: string; site: string; video: string}[]}).polyps;
const GCOL: Record<string, string> = {pinch: '#FFB020', zoom: '#FFB020', open: '#2DD4BF', fist: '#8C5CF5', point: '#4ADE80', swipe: '#4ADE80'};
const TEAL = '#2DD4BF';
const VIOLET = '#8C5CF5';

// what each chapter says, in plain words
const COPY: Record<string, {step?: string; g?: string; act?: string; color?: string; s: number; ox: number; oy: number}> = {
  hook: {s: 0.85, ox: 0.52, oy: 0.52},
  rotate: {step: '1', g: '🤏 Pinch and move', act: 'rotates the polyp', color: GCOL.pinch, s: 1.1, ox: 0.62, oy: 0.56},
  apart: {step: '2', g: '✋ Open your hand', act: 'takes it apart', color: GCOL.open, s: 1.15, ox: 0.55, oy: 0.5},
  back: {step: '3', g: '✊ Make a fist', act: 'puts it back together', color: GCOL.fist, s: 0.95, ox: 0.5, oy: 0.55},
  swipe1: {step: '4', g: '☝️ Swipe', act: 'next polyp', color: GCOL.point, s: 0.9, ox: 0.5, oy: 0.52},
  swipe2: {step: '4', g: '☝️ Swipe', act: 'next polyp', color: GCOL.point, s: 1.0, ox: 0.65, oy: 0.5},
  zoom: {step: '5', g: '🤏🤏 Two hands', act: 'zoom in and out', color: GCOL.zoom, s: 0.9, ox: 0.5, oy: 0.62},
  outro: {s: 0.9, ox: 0.55, oy: 0.5},
};
const CLIP_ASPECT = 1300 / 1234; // scene clips: the app's left 60% (studio mode)
const FPS = 30;
const starts = CH.reduce<number[]>((acc, c, i) => [...acc, i ? acc[i - 1] + Math.round(CH[i - 1].dur * FPS) : 0], []);
export const TOTAL = starts[starts.length - 1] + Math.round(CH[CH.length - 1].dur * FPS);

// ---------------------------------------------------------------- layers
// The polyp point (ox, oy) of the clip lands at (540, ty): the middle band between the caption and the cards.
const Scene: React.FC<{c: Ch; dim?: number; ty?: number}> = ({c, dim = 0, ty = 600}) => {
  const f = useCurrentFrame();
  const k = COPY[c.id];
  const H = 1350 * k.s * lerp(1, 1.04, f / (c.dur * FPS)); // slow push-in
  const W = H * CLIP_ASPECT;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <OffthreadVideo src={staticFile(`clips/${c.id}_scene.mp4`)} muted style={{position: 'absolute', width: W, height: H,
        left: 540 - k.ox * W, top: ty - k.oy * H, filter: 'brightness(1.35) contrast(1.06) saturate(1.2)'}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(6,8,11,0.92) 0%, rgba(6,8,11,0.25) 26%, rgba(6,8,11,0) 50%, rgba(6,8,11,0.55) 78%, rgba(6,8,11,0.95) 100%)'}} />
      {dim > 0 && <AbsoluteFill style={{background: `rgba(6,8,11,${dim})`}} />}
    </AbsoluteFill>
  );
};

const Selfie: React.FC<{c: Ch}> = ({c}) => {
  const f = useCurrentFrame();
  // the chip shows MediaPipe's own label on this frame, when it is the gesture this chapter explains
  const raw = c.detected[Math.min(f, c.detected.length - 1)] || '';
  const g = c.gesture && (raw === c.gesture || (c.gesture === 'point' && raw === 'swipe')) ? raw : '';
  const col = GCOL[g] || DIM;
  return (
    <div style={{position: 'absolute', right: 40, bottom: 44, width: 520}}>
      <div style={{fontFamily: MONO, fontSize: 18, color: TEXT, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10}}>
        <span style={{width: 10, height: 10, borderRadius: 5, background: '#E5484D', boxShadow: '0 0 12px #E5484D'}} />
        LIVE · hand tracking in the browser
      </div>
      <div style={{position: 'relative', width: 520, height: 390, borderRadius: 26, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.18)',
        boxShadow: '0 24px 70px rgba(0,0,0,0.6)'}}>
        <OffthreadVideo src={staticFile(`clips/${c.id}_cam.mp4`)} muted style={{width: '100%', height: '100%'}} />
        {g && (
          <div style={{position: 'absolute', left: 14, top: 14, padding: '6px 12px', borderRadius: 10, background: 'rgba(6,8,11,0.78)',
            border: `1.5px solid ${col}`, fontFamily: MONO, fontSize: 20, color: col}}>detected: {g}</div>
        )}
      </div>
    </div>
  );
};

const PolypCard: React.FC<{c: Ch}> = ({c}) => {
  const f = useCurrentFrame();
  const i = c.polyps[Math.min(f, c.polyps.length - 1)];
  const p = POLYPS[i];
  const changed = c.polyps.findIndex((x, k) => k > 0 && x !== c.polyps[k - 1]); // frame of a swipe, if any
  const pulse = changed > 0 ? Math.max(0, 1 - Math.abs(f - changed) / 12) : 0;
  return (
    <div style={{position: 'absolute', left: 40, bottom: 44, width: 440, padding: '20px 24px', borderRadius: 22, background: 'rgba(14,17,22,0.86)',
      border: `1px solid ${pulse > 0 ? GCOL.point : 'rgba(255,255,255,0.12)'}`, backdropFilter: 'blur(12px)',
      transform: `scale(${1 + 0.06 * pulse})`, transformOrigin: 'left bottom', boxShadow: pulse > 0 ? `0 0 ${40 * pulse}px ${GCOL.point}` : 'none'}}>
      <div style={{fontFamily: MONO, fontSize: 17, color: DIM, letterSpacing: 2}}>POLYP {i + 1} / 6 · REAL COLONOSCOPY</div>
      <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 64, color: TEXT, letterSpacing: -2, lineHeight: 1.05, marginTop: 6}}>
        {p.size_mm}<span style={{fontSize: 28, color: DIM, marginLeft: 6}}>mm</span>
      </div>
      <div style={{fontFamily: SANS, fontWeight: 600, fontSize: 28, color: TEXT, lineHeight: 1.15}}>{p.histology}</div>
      <div style={{fontFamily: MONO, fontSize: 18, color: DIM, marginTop: 6}}>{p.site} colon</div>
    </div>
  );
};

const Caption: React.FC<{k: (typeof COPY)[string]}> = ({k}) => (
  <>
    <div style={{position: 'absolute', left: 56, top: 52, display: 'flex', alignItems: 'center', gap: 14}}>
      <div style={{width: 46, height: 46, borderRadius: 23, background: k.color, color: '#06080B', fontFamily: SANS, fontWeight: 800, fontSize: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{k.step}</div>
      <Mono at={-1} size={20} color={DIM} style={{position: 'relative', letterSpacing: 3}}>GESTURE {k.step} OF 5</Mono>
    </div>
    <Words text={k.g!} at={2} size={78} style={{left: 52, top: 118}} />
    <Words text={`→ ${k.act}`} at={10} size={52} color={k.color} style={{left: 56, top: 212}} />
  </>
);

const ApartLegend: React.FC<{c: Ch}> = ({c}) => {
  const f = useCurrentFrame();
  const a = c.apart[Math.min(f, c.apart.length - 1)];
  const o = ramp(f, 20, 36);
  if (c.id !== 'apart' || a < 0.5) return null;
  const rows = [['#E8A07A', 'photo'], ['#F5C542', 'depth · Depth Anything V2'], ['#4ADE80', 'mask · SAM 2']];
  return (
    <div style={{position: 'absolute', right: 40, top: 330, padding: '16px 20px', borderRadius: 18, background: 'rgba(14,17,22,0.8)',
      border: '1px solid rgba(255,255,255,0.12)', opacity: o}}>
      <div style={{fontFamily: MONO, fontSize: 16, color: DIM, letterSpacing: 2, marginBottom: 8}}>LAYERS, TOP TO BOTTOM</div>
      {rows.map(([col, label]) => (
        <div key={label} style={{display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontSize: 22, color: TEXT, lineHeight: 1.7}}>
          <span style={{width: 14, height: 14, borderRadius: 7, background: col}} />{label}
        </div>
      ))}
    </div>
  );
};

const Progress: React.FC<{step?: string}> = ({step}) => (
  <div style={{position: 'absolute', right: 56, top: 64, display: 'flex', gap: 8}}>
    {[1, 2, 3, 4, 5].map((n) => (
      <div key={n} style={{width: 34, height: 6, borderRadius: 3, background: step && n <= Number(step) ? TEXT : 'rgba(255,255,255,0.18)'}} />
    ))}
  </div>
);

// ---------------------------------------------------------------- chapters
const Chapter: React.FC<{c: Ch}> = ({c}) => {
  const f = useCurrentFrame();
  const k = COPY[c.id];
  const fade = Math.min(ramp(f, 0, 6, IN_OUT), 1 - ramp(f, c.dur * FPS - 4, c.dur * FPS, IN_OUT));
  return (
    <AbsoluteFill style={{opacity: c.id === 'hook' ? 1 : fade}}>
      <Scene c={c} />
      <Caption k={k} />
      <Progress step={k.step} />
      <ApartLegend c={c} />
      <PolypCard c={c} />
      <Selfie c={c} />
    </AbsoluteFill>
  );
};

const Hook: React.FC<{c: Ch}> = ({c}) => (
  <AbsoluteFill>
    <Scene c={c} ty={680} />
    <Words text="Sterile Hands" at={-1} size={104} gradLine={0} gradFrom={TEAL} gradTo={VIOLET} style={{left: 52, top: 50}} />
    <Words text="Sterile gloves can't|touch a mouse." at={-1} size={54} style={{left: 56, top: 186}} />
    <Words text="So the 3D follows|your hands." at={14} size={54} color={TEAL} style={{left: 56, top: 316}} />
    <PolypCard c={c} />
    <Selfie c={c} />
  </AbsoluteFill>
);

const Outro: React.FC<{c: Ch}> = ({c}) => (
  <AbsoluteFill>
    <Scene c={c} dim={0.55} ty={640} />
    <Words text="Try it with|your own hands" at={4} size={92} gradLine={1} gradFrom={TEAL} gradTo={VIOLET} style={{left: 52, top: 60}} />
    <div style={{position: 'absolute', left: 56, top: 320, padding: '18px 30px', borderRadius: 999, background: 'rgba(14,17,22,0.9)',
      border: `1.5px solid ${TEAL}`, fontFamily: SANS, fontWeight: 600, fontSize: 34, color: TEXT}}>zalkarbek2023.github.io/sterile-hands</div>
    <Mono at={14} size={28} color={TEXT} style={{left: 56, top: 440, width: 960}}>
      Runs in your browser.<br />The camera never leaves your device.
    </Mono>
    <div style={{position: 'absolute', left: 56, top: 590, display: 'flex', flexDirection: 'column', gap: 14}}>
      {['MediaPipe · 21 points per hand', 'Three.js · 160,000 particles per polyp', '6 real polyps · REAL-Colon, CC BY 4.0'].map((t, i) => (
        <div key={t} style={{fontFamily: MONO, fontSize: 24, color: TEXT, padding: '10px 18px', borderRadius: 12, background: 'rgba(14,17,22,0.8)',
          border: '1px solid rgba(255,255,255,0.12)', width: 'fit-content'}}>{t}</div>
      ))}
    </div>
    <Mono at={24} size={22} color={TEXT} style={{left: 56, top: 1180, width: 960}}>Zalkarbek Arapbaev · physician & CV engineer · Bishkek</Mono>
    <Mono at={30} size={18} style={{left: 56, top: 1220, width: 960}}>Research demo, not a medical device.</Mono>
  </AbsoluteFill>
);

export const Post: React.FC = () => (
  <AbsoluteFill style={{background: '#06080B'}}>
    <Backdrop />
    {CH.map((c, i) => (
      <Sequence key={c.id} from={starts[i]} durationInFrames={Math.round(c.dur * FPS)}>
        {c.id === 'hook' ? <Hook c={c} /> : c.id === 'outro' ? <Outro c={c} /> : <Chapter c={c} />}
      </Sequence>
    ))}
  </AbsoluteFill>
);
