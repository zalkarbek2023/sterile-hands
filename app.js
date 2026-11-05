// Sterile Hands: a touchless 3D atlas of six real colonoscopy polyps (REAL-Colon, CC BY 4.0).
// Each polyp is a cloud of 160k particles: height from our elevation grid (Depth Anything V2 + mucosa plane fit),
// colour from the frame. Hand gestures (hands.js) rotate, zoom, take it apart into photo / depth / mask, and swipe.
import * as THREE from 'three';
import {Hands} from './hands.js';

const $ = (id) => document.getElementById(id);
const meta = await (await fetch('data/polyps.json')).json();
const G = meta.grid;
const N = 400; // particles per side
const H = 1.6; // height exaggeration (as in the published polyps-3D video)

// ---------------------------------------------------------------- data: six polyps as textures
const loader = new THREE.TextureLoader();
async function loadPolyp(i) {
  const p = meta.polyps[i];
  const [eb, mb, photo, depth] = await Promise.all([
    fetch(`data/p${i}.elev.u16`).then((r) => r.arrayBuffer()),
    fetch(`data/p${i}.mask.u8`).then((r) => r.arrayBuffer()),
    loader.loadAsync(`data/p${i}.jpg`),
    loader.loadAsync(`data/p${i}_depth.jpg`),
  ]);
  const u16 = new Uint16Array(eb);
  const elev = new THREE.DataTexture(Uint8Array.from(u16, (v) => v >> 8), G, G, THREE.RedFormat, THREE.UnsignedByteType);
  const mask = new THREE.DataTexture(new Uint8Array(mb), G, G, THREE.RedFormat, THREE.UnsignedByteType);
  for (const t of [elev, mask]) { t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; }
  for (const t of [photo, depth]) t.colorSpace = THREE.SRGBColorSpace;
  const [x0, y0, x1, y1] = p.box_crop;  // polyp box in the crop -> centre in scene units
  return {elev, mask, photo, depth, range: new THREE.Vector2(...p.elev_range), info: p, centre: [x0 + x1 - 1, y0 + y1 - 1],
    view: 5.2 * Math.max(x1 - x0, y1 - y0)};  // camera distance that frames this polyp
}
const polyps = await Promise.all(meta.polyps.map((_, i) => loadPolyp(i)));

// ---------------------------------------------------------------- scene
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true});  // so captureStream sees every frame
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x06080b);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);

const geo = new THREE.BufferGeometry();
const uv = new Float32Array(N * N * 2), rnd = new Float32Array(N * N * 3), layer = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const k = j * N + i;
  uv[2 * k] = (i + Math.random()) / N;
  uv[2 * k + 1] = (j + Math.random()) / N;
  const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1);
  rnd.set([Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)], 3 * k);
  layer[k] = k % 3;
}
geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * N * 3), 3)); // computed in the shader
geo.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 3));
geo.setAttribute('aLayer', new THREE.BufferAttribute(layer, 1));

const U = {
  uElevA: {value: null}, uElevB: {value: null}, uMaskA: {value: null}, uMaskB: {value: null},
  uTexA: {value: null}, uTexB: {value: null}, uDepA: {value: null}, uDepB: {value: null},
  uRangeA: {value: new THREE.Vector2()}, uRangeB: {value: new THREE.Vector2()},
  uMorph: {value: 0}, uExplode: {value: 0}, uApart: {value: 0}, uH: {value: H}, uSize: {value: 2.9},
};
const mat = new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false,
  vertexShader: /* glsl */ `
    attribute vec2 aUv; attribute vec3 aRand; attribute float aLayer;
    uniform sampler2D uElevA, uElevB, uMaskA, uMaskB, uTexA, uTexB, uDepA, uDepB;
    uniform vec2 uRangeA, uRangeB;
    uniform float uMorph, uExplode, uApart, uH, uSize;
    varying vec3 vCol; varying float vAlpha;
    void main() {
      vec2 uv = aUv;                       // u = right, v = down the image (row 0 = top)
      vec2 tuv = vec2(uv.x, 1.0 - uv.y);   // jpg textures are flipped
      float eA = mix(uRangeA.x, uRangeA.y, texture2D(uElevA, uv).r);
      float eB = mix(uRangeB.x, uRangeB.y, texture2D(uElevB, uv).r);
      float e = mix(eA, eB, uMorph) * uH;
      float inside = smoothstep(0.35, 0.65, mix(texture2D(uMaskA, uv).r, texture2D(uMaskB, uv).r, uMorph));
      vec3 photo = mix(texture2D(uTexA, tuv).rgb, texture2D(uTexB, tuv).rgb, uMorph);
      vec3 dep = mix(texture2D(uDepA, tuv).rgb, texture2D(uDepB, tuv).rgb, uMorph);
      vec3 base = vec3(uv.x * 2.0 - 1.0, e, uv.y * 2.0 - 1.0);
      vec3 col = photo * mix(0.5, 1.0, inside);   // put together: the 3D polyp, mucosa around it dimmed
      vec3 pL, cL;                                // taken apart: photo (top), depth relief, SAM 2 mask (bottom)
      if (aLayer < 0.5) { pL = vec3(base.x, 1.2, base.z); cL = photo; }
      else if (aLayer < 1.5) { pL = base; cL = dep; }
      else { pL = vec3(base.x, -1.2 + e * inside, base.z); cL = mix(photo * 0.22, vec3(0.29, 0.87, 0.50), inside); }
      vec3 p = mix(base, pL, uApart) + aRand * uExplode * 2.4;
      vCol = mix(col, cL, uApart);
      vAlpha = 1.0 - smoothstep(0.9, 1.0, length(uv * 2.0 - 1.0));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uSize * 3.0 / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vCol; varying float vAlpha;
    void main() {
      vec2 q = gl_PointCoord * 2.0 - 1.0;
      float d = dot(q, q);
      if (d > 1.0 || vAlpha < 0.01) discard;
      gl_FragColor = vec4(vCol, vAlpha * (1.0 - 0.4 * d));
    }`,
});
scene.add(new THREE.Points(geo, mat));

// ---------------------------------------------------------------- state
const S = {cur: 0, az: 25, el: 38, dist: 2.6, zoom: 1, apart: 0, explode: 0, trans: null, cx: 0, cz: 0,
  goal: {az: 25, el: 38, zoom: 1, apart: 0}};
function show(i) {
  const p = polyps[i];
  U.uElevA.value = p.elev; U.uMaskA.value = p.mask; U.uTexA.value = p.photo; U.uDepA.value = p.depth; U.uRangeA.value = p.range;
  U.uMorph.value = 0;
  const m = p.info;
  $('n').textContent = `POLYP ${i + 1} / ${polyps.length}`;
  $('size').innerHTML = `${m.size_mm}<small>mm</small>`;
  $('hist').textContent = m.histology;
  $('site').textContent = `${m.site} colon · ${m.video}`;
  $('dots').innerHTML = polyps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
}
function go(step) {
  if (S.trans) return;
  const to = (S.cur + step + polyps.length) % polyps.length;
  const p = polyps[to];
  U.uElevB.value = p.elev; U.uMaskB.value = p.mask; U.uTexB.value = p.photo; U.uDepB.value = p.depth; U.uRangeB.value = p.range;
  S.trans = {to, t0: performance.now()};
}
show(0);

// ---------------------------------------------------------------- gestures
let pinchLast = null, zoomLast = null, swipeHist = [], swipeCool = 0;
const chips = [...document.querySelectorAll('.chip')];
const fx = $('fx'), fxc = fx.getContext('2d');
function onHands(hands) {
  const now = performance.now();
  const pinches = hands.filter((h) => h.g === 'pinch' && h.held >= 2);
  let active = hands[0]?.g ?? '';
  if (pinches.length === 2) {                         // two hands: zoom
    const dd = Math.hypot(pinches[0].pinchAt.x - pinches[1].pinchAt.x, pinches[0].pinchAt.y - pinches[1].pinchAt.y);
    if (zoomLast) S.goal.zoom = THREE.MathUtils.clamp(S.goal.zoom * zoomLast / dd, 0.5, 2.5);
    zoomLast = dd; pinchLast = null; active = 'zoom';
  } else if (pinches.length === 1) {                  // one hand: rotate
    const p = pinches[0].pinchAt;
    if (pinchLast) { S.goal.az -= (p.x - pinchLast.x) * 260; S.goal.el = THREE.MathUtils.clamp(S.goal.el + (p.y - pinchLast.y) * 200, -10, 89); }
    pinchLast = p; zoomLast = null;
  } else { pinchLast = null; zoomLast = null; }
  for (const h of hands) {
    if (h.g === 'open' && h.held >= 6) S.goal.apart = 1;
    if (h.g === 'fist' && h.held >= 6) S.goal.apart = 0;
  }
  const pt = hands.find((h) => h.g === 'point');     // swipe with the index finger
  if (pt) {
    swipeHist.push({x: pt.tip.x, t: now});
    swipeHist = swipeHist.filter((s) => now - s.t < 350);
    const dx = pt.tip.x - swipeHist[0].x;
    if (Math.abs(dx) > 0.2 && now > swipeCool) { go(dx > 0 ? 1 : -1); swipeCool = now + 900; swipeHist = []; active = 'swipe'; }
  } else swipeHist = [];
  chips.forEach((c) => c.classList.toggle('on', c.dataset.g === active || (active === 'point' && c.dataset.g === 'swipe')));
  if (rec) rec.log.push({t: Math.round(performance.now() - rec.t0), g: active, polyp: S.trans ? S.trans.to : S.cur, apart: +S.goal.apart.toFixed(2),
    tips: hands.map((h) => [+h.tip.x.toFixed(4), +h.tip.y.toFixed(4), h.g])});
  $('st').textContent = hands.length ? hands.map((h) => h.g).join(' · ') : 'looking for a hand…';
  const NAMES = {pinch: '🤏 pinch · rotate', zoom: '🤏🤏 two hands · zoom', open: '✋ open hand · take apart', fist: '✊ fist · put together',
    point: '☝️ point · swipe for the next polyp', swipe: '☝️ swipe · next polyp', other: '🖐 hand found'};
  $('gestText').textContent = hands.length ? NAMES[active] || NAMES.other : 'show your hand';
  // fingertip cursors over the scene
  fxc.clearRect(0, 0, fx.width, fx.height);
  for (const h of hands) {
    const x = h.tip.x * fx.width, y = h.tip.y * fx.height;
    const col = {pinch: '#FFB020', open: '#2DD4BF', fist: '#8C5CF5', point: '#4ADE80'}[h.g] || '#F4F1EA';
    fxc.strokeStyle = col; fxc.lineWidth = 3 * devicePixelRatio; fxc.shadowColor = col; fxc.shadowBlur = 18;
    fxc.beginPath(); fxc.arc(x, y, 16 * devicePixelRatio, 0, Math.PI * 2); fxc.stroke();
  }
}

// ---------------------------------------------------------------- mouse / touch fallback
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = {x: e.clientX, y: e.clientY}; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  S.goal.az -= (e.clientX - drag.x) * 0.4;
  S.goal.el = THREE.MathUtils.clamp(S.goal.el + (e.clientY - drag.y) * 0.3, -10, 89);
  drag = {x: e.clientX, y: e.clientY};
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => { S.goal.zoom = THREE.MathUtils.clamp(S.goal.zoom * (1 + e.deltaY * 0.001), 0.5, 2.5); }, {passive: true});
$('prev').onclick = () => go(-1);
$('next').onclick = () => go(1);
$('apart').onclick = () => { S.goal.apart = S.goal.apart > 0.5 ? 0 : 1; };
addEventListener('keydown', (e) => {
  if (e.key === 's' || e.key === 'S') { document.body.classList.toggle('studio'); resize(); }
  if (e.key === 'r' || e.key === 'R') record();
  if (e.key === 'ArrowRight') go(1);
  if (e.key === 'ArrowLeft') go(-1);
  if (e.key === ' ') S.goal.apart = S.goal.apart > 0.5 ? 0 : 1;
});

// ---------------------------------------------------------------- record (R): no permission dialog
// The page records its own canvases: the 3D scene and the selfie with the hand skeleton, plus a gesture log
// (time, gesture, fingertip, polyp, apart) for the edit. Locally the files go straight into recordings/.
let rec = null;
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
async function save(name, blob) {
  const ok = await fetch(`upload/${name}`, {method: 'PUT', body: blob}).then((r) => r.ok).catch(() => false);
  if (!ok) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
  return ok;
}
function record() {
  if (rec) { rec.stop(); return; }
  const type = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
  const ext = type.startsWith('video/mp4') ? 'mp4' : 'webm';
  const id = stamp();
  const sources = [['scene', canvas], ...($('pip').hidden ? [] : [['cam', $('cam')]])];
  const parts = sources.map(([name, c]) => {
    const mr = new MediaRecorder(c.captureStream(30), {mimeType: type, videoBitsPerSecond: 12e6});
    const chunks = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    return {name, mr, chunks};
  });
  rec = {t0: performance.now(), log: [], stop: null};
  parts.forEach((p) => p.mr.start(1000));
  rec.stop = async () => {
    const r = rec;
    rec = null;
    $('rec').textContent = 'saving…';
    await Promise.all(parts.map((p) => new Promise((res) => { p.mr.onstop = res; p.mr.stop(); })));
    let ok = true, mb = 0;
    for (const p of parts) {
      const blob = new Blob(p.chunks, {type});
      mb += blob.size / 1e6;
      ok = (await save(`sterile-hands-${id}-${p.name}.${ext}`, blob)) && ok;
    }
    const meta = {fps: 30, scene: [canvas.width, canvas.height], cam: [$('cam').width, $('cam').height], log: r.log};
    ok = (await save(`sterile-hands-${id}-log.json`, new Blob([JSON.stringify(meta)], {type: 'application/json'}))) && ok;
    $('rec').classList.remove('on');
    $('rec').textContent = ok ? `✓ saved ${mb.toFixed(1)} MB` : '✓ downloaded';
    setTimeout(() => { $('rec').textContent = '● REC'; }, 6000);
  };
  $('rec').classList.add('on');
  $('rec').textContent = '■ stop (R)';
}
$('rec').onclick = record;

// ---------------------------------------------------------------- start
$('go').onclick = async () => {
  $('go').textContent = 'starting…';
  try {
    const video = document.createElement('video');
    video.playsInline = true; video.muted = true;
    await new Hands(video, $('cam'), onHands).start();
    $('start').hidden = true; $('pip').hidden = false;
    document.body.classList.add('studio'); resize();
  } catch (err) {
    $('go').textContent = 'camera unavailable: use mouse';
    console.error(err);
  }
};
$('skip').onclick = () => { $('start').hidden = true; };

// ---------------------------------------------------------------- loop
function resize() {
  const w = Math.round(innerWidth * (document.body.classList.contains('studio') ? 0.6 : 1)), h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fx.width = w * devicePixelRatio; fx.height = h * devicePixelRatio;
  fx.style.width = w + 'px'; fx.style.height = h + 'px';
}
addEventListener('resize', resize);
resize();
const labels = [0, 1, 2].map((k) => $(`l${k}`));
const ease = (a, b, k) => a + (b - a) * k;
function frame(now) {
  S.az = ease(S.az, S.goal.az, 0.12); S.el = ease(S.el, S.goal.el, 0.12);
  S.apart = ease(S.apart, S.goal.apart, 0.08);
  const v0 = polyps[S.cur].view, v1 = S.trans ? polyps[S.trans.to].view : v0;
  S.dist = ease(S.dist, (v0 + (v1 - v0) * U.uMorph.value) * S.goal.zoom * (1 + 1.3 * S.apart), 0.1);
  if (S.trans) {                                    // dissolve into particles, reform as the next polyp
    const t = Math.min(1, (now - S.trans.t0) / 1100);
    U.uExplode.value = Math.sin(Math.PI * t) ** 2 * 0.4;
    U.uMorph.value = THREE.MathUtils.smoothstep(t, 0.3, 0.7);
    if (t >= 1) { S.cur = S.trans.to; S.trans = null; show(S.cur); U.uExplode.value = 0; }
  }
  U.uApart.value = S.apart;
  const a = THREE.MathUtils.degToRad(S.az), e = THREE.MathUtils.degToRad(S.el);
  const ty = 0.1 * (1 - S.apart);
  const c0 = polyps[S.cur].centre, c1 = S.trans ? polyps[S.trans.to].centre : c0, m = U.uMorph.value;
  S.cx = ease(S.cx, (c0[0] + (c1[0] - c0[0]) * m) * (1 - S.apart), 0.1);  // look at the polyp; at the whole stack when apart
  S.cz = ease(S.cz, (c0[1] + (c1[1] - c0[1]) * m) * (1 - S.apart), 0.1);
  camera.position.set(S.cx + S.dist * Math.cos(e) * Math.sin(a), ty + S.dist * Math.sin(e), S.cz + S.dist * Math.cos(e) * Math.cos(a));
  camera.lookAt(S.cx, ty, S.cz);
  renderer.render(scene, camera);
  [1.2, 0.25, -1.2].forEach((y, k) => {             // labels next to the layers when taken apart
    const v = new THREE.Vector3(1.05, y, 0).project(camera);
    labels[k].style.left = `${(v.x + 1) / 2 * canvas.clientWidth}px`;
    labels[k].style.top = `${(1 - v.y) / 2 * innerHeight}px`;
    labels[k].style.opacity = S.apart > 0.6 ? 1 : 0;
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
