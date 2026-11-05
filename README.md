# Sterile Hands: a touchless 3D polyp atlas

**Try it:** https://zalkarbek2023.github.io/sterile-hands/ (desktop Chrome with a webcam; mouse and touch also work)

An endoscopist in sterile gloves can't touch a mouse. Sterile Hands lets you explore six real colonoscopy polyps in 3D with hand gestures only. Everything runs in your browser, and the camera never leaves your device.

| Gesture | What it does |
|---|---|
| 🤏 Pinch and move | Rotate the polyp |
| ✋ Open hand (hold) | Take it apart into three layers: the photo, the depth relief (Depth Anything V2) and the polyp mask (SAM 2) |
| ✊ Fist (hold) | Put it back together |
| ☝️ Quick swipe with the index finger | Next polyp: the particles scatter and re-form |
| 🤏🤏 Pinch with both hands | Zoom |

Without a camera, drag to rotate, scroll to zoom, use ◀ ▶ to change polyps and Space to take it apart.

## How it works

- **Hands.** [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) finds 21 points per hand, for up to two hands, on the GPU in the browser.
  - `hands.js` turns the points into poses: pinch, open, fist and point.
  - A pose counts only after it has held for a few frames.
  - A pinch needs the thumb and index tips to touch while the index still reaches forward, so a relaxed, curled hand doesn't count.
- **3D.** Each polyp is 160,000 particles in Three.js, positioned in a shader (`app.js`):
  - height comes from the elevation grid of [colonoscopy-ai](https://github.com/zalkarbek2023/colonoscopy-ai)'s polyp3d (Depth Anything V2 plus a plane fitted to the mucosa);
  - colour comes from the frame;
  - "take apart" moves each third of the particles to its own layer;
  - "next" scatters them and morphs into the next polyp's textures.
- **Data.** Six polyps from REAL-Colon with expert size, histology and site (`data/polyps.json`).

**Recording.** Press **R** to record. The page records its own canvases (the 3D scene, and the selfie with the hand skeleton), plus a gesture log. With `python serve.py . 8765` the files are saved into `recordings/`; anywhere else they download.

## Run locally

```bash
python serve.py . 8765    # or any static server; the camera needs localhost or https
open http://127.0.0.1:8765
```

`video/` is the Remotion project that cut the post video from one recording (`cut.py` + `src/Post.tsx`).

Limits:
- It needs good light and both hands in view.
- The gesture thresholds were tuned on one person.
- The 3D surfaces are single-frame depth estimates in relative units.
- This is a research and teaching demo, not a medical device.

## Credits

- Polyp frames and labels: REAL-Colon, Biffi et al., *Scientific Data* 2024, CC BY 4.0.
- Hand tracking: Google MediaPipe Tasks (Apache-2.0).
- 3D: Three.js (MIT).
- Depth Anything V2 and SAM 2 come from the colonoscopy-ai pipeline.
- Inspired by takeapart.app.

Code in this repository: MIT. **Zalkarbek Arapbaev**, physician and computer vision engineer, Bishkek · [LinkedIn](https://www.linkedin.com/in/zalkarbek-arapbaev-77185525a/) · [X](https://x.com/Zalkarbek_AI)
