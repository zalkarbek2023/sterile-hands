#!/usr/bin/env python3
"""Cut the chapters of the post video out of one Sterile Hands recording (scene + selfie are in sync), and
write chapters.json: per chapter the polyp shown and, per output frame (30 fps), the gesture MediaPipe detected.
Usage: python cut.py <recording id> <out dir>"""
import json
import subprocess
import sys
from pathlib import Path

rid, out = sys.argv[1], Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
# id, start (s), duration (s), the gesture the chapter explains
CHAPTERS = [
    ("hook", 209.5, 3.5, None),
    ("rotate", 126.5, 4.0, "pinch"),
    ("apart", 98.5, 5.0, "open"),
    ("back", 39.5, 3.5, "fist"),
    ("swipe1", 46.0, 3.5, "point"),
    ("swipe2", 122.5, 3.0, "point"),
    ("zoom", 13.5, 4.0, "zoom"),
    ("outro", 212.0, 4.5, None),
]
log = json.load(open(f"{rid}-log.json"))["log"]


def near(t_ms):
    return min(log, key=lambda e: abs(e["t"] - t_ms))


res = []
for cid, a, dur, gesture in CHAPTERS:
    for src, w in (("scene", 1300), ("cam", 640)):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(a), "-t", str(dur), "-i", f"{rid}-{src}.mp4",
                        "-vf", f"fps=30,scale={w}:-2", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p",
                        "-an", str(out / f"{cid}_{src}.mp4")], check=True)
    frames = [near(a * 1000 + k * 1000 / 30) for k in range(int(dur * 30))]
    polyps = [e["polyp"] for e in frames]
    res.append({"id": cid, "start": a, "dur": dur, "gesture": gesture,
                "polyp": max(set(polyps), key=polyps.count), "polyps": polyps,
                "detected": [e["g"] for e in frames], "apart": [e["apart"] for e in frames]})
    print(cid, a, dur, "polyp", res[-1]["polyp"], "detected:", sorted(set(res[-1]["detected"])))
json.dump(res, open(out / "chapters.json", "w"))
