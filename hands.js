// Hand tracking in the browser (MediaPipe Hand Landmarker, 21 landmarks per hand) -> gestures.
// Everything runs locally: the camera frames never leave the page.
import {FilesetResolver, HandLandmarker} from '@mediapipe/tasks-vision';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// One hand's pose from its landmarks (x mirrored for a selfie view).
export function classify(lm) {
  const palm = d(lm[0], lm[9]) + 1e-6;
  const ext = [[8, 6], [12, 10], [16, 14], [20, 18]].map(([tip, pip]) => d(lm[tip], lm[0]) > d(lm[pip], lm[0]) * 1.12);
  const n = ext.filter(Boolean).length;
  // a real pinch: thumb and index tips touch while the index still reaches forward (its tip beyond its middle
  // joint). A relaxed, curled hand also brings the tips close, but its index is folded back: not a pinch.
  const pinch = d(lm[4], lm[8]) < 0.26 * palm && d(lm[8], lm[0]) > d(lm[6], lm[0]);
  let g = 'other';
  if (pinch) g = 'pinch';
  else if (n >= 4) g = 'open';
  else if (n === 0) g = 'fist';
  else if (ext[0] && n === 1) g = 'point';
  const mid = {x: 1 - (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2};
  return {g, pinchAt: mid, tip: {x: 1 - lm[8].x, y: lm[8].y}};
}

export class Hands {
  constructor(video, pipCanvas, onFrame) {
    this.video = video;
    this.pip = pipCanvas.getContext('2d');
    this.pipCanvas = pipCanvas;
    this.onFrame = onFrame;
    this.stable = [];   // per hand: {g, count}
  }

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({video: {width: 640, height: 480, facingMode: 'user'}, audio: false});
    this.video.srcObject = stream;
    await this.video.play();
    const files = await FilesetResolver.forVisionTasks(WASM);
    this.lm = await HandLandmarker.createFromOptions(files, {
      baseOptions: {modelAssetPath: MODEL, delegate: 'GPU'}, runningMode: 'VIDEO', numHands: 2,
    });
    const loop = () => { this.tick(); requestAnimationFrame(loop); };
    loop();
  }

  tick() {
    if (this.video.readyState < 2) return;
    const res = this.lm.detectForVideo(this.video, performance.now());
    const hands = (res.landmarks || []).map(classify);
    // debounce: a pose counts once it has held for 4 frames
    hands.forEach((h, i) => {
      const s = this.stable[i] || {g: h.g, count: 0};
      s.count = s.g === h.g ? s.count + 1 : 0;
      s.g = h.g;
      this.stable[i] = s;
      h.held = s.count;
    });
    this.stable.length = hands.length;
    this.draw(res.landmarks || [], hands);
    this.onFrame(hands);
  }

  draw(all, hands) {
    const c = this.pip, W = this.pipCanvas.width, H = this.pipCanvas.height;
    c.save();
    c.translate(W, 0);
    c.scale(-1, 1);
    c.drawImage(this.video, 0, 0, W, H);
    c.restore();
    c.fillStyle = 'rgba(6,8,11,0.35)';
    c.fillRect(0, 0, W, H);
    all.forEach((lm, i) => {
      const col = {pinch: '#FFB020', open: '#2DD4BF', fist: '#8C5CF5', point: '#4ADE80'}[hands[i].g] || '#F4F1EA';
      c.strokeStyle = col;
      c.lineWidth = 2.5;
      for (const [a, b] of BONES) {
        c.beginPath();
        c.moveTo((1 - lm[a].x) * W, lm[a].y * H);
        c.lineTo((1 - lm[b].x) * W, lm[b].y * H);
        c.stroke();
      }
      c.fillStyle = col;
      for (const p of lm) { c.beginPath(); c.arc((1 - p.x) * W, p.y * H, 2.6, 0, Math.PI * 2); c.fill(); }
    });
  }
}
