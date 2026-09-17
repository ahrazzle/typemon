#!/usr/bin/env python3
"""Generate the Typemon track manifest (tracks.json) + audio ledger rows.

Input : assets/ccbysa/audio/*.ogg (pulled from OpMonTeam/OpMon-Data, master @ 2026-08-28)
Output:
  assets/ccbysa/audio/tracks.json     - machine Track manifest: { file, license,
                                         source, durationMs, bpm, beatMs, vet }
  assets/ccbysa/ATTRIBUTION.md        - appended audio ledger rows (per-file)

The track manifest is the timing contract: the judge derives its beat-grid
from this file, never from the decoded audio. Duration is the exact PCM frame
count (ffmpeg stereo 44.1k) so the manifest and the file cannot disagree.
BPM is the DESIGN tempo (game-assigned within Typejoy's 20-120 range);
tempoVerified:false means a human ear must confirm the music matches the
pinned BPM before the track ships in a paid context (vet rule: exclude on doubt).
"""
import json, os, re, hashlib, subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = "OpMonTeam/OpMon-Data"
AUTH = "OpMon Team contributors (github.com/OpMonTeam/OpMon-Data)"
LIC = "CC-BY-SA-4.0"
SHA = "master@2026-08-28"

# Design BPM per battle-loop track (game-assigned; Typejoy range 20-120).
# These are initial values for the beat-grid — ears confirm musical fit.
DESIGN_BPM = {
    "wildbattle.ogg": 100,
    "mysterioucity.ogg": 90,
    "route14.ogg": 110,
}

def exact_duration_ms(path):
    """Exact PCM frame count via ffmpeg decode (stereo 44.1k), ms duration."""
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "s16le", "-ac", "2", "-ar", "44100", "-"],
        capture_output=True)
    n = len(p.stdout)
    frames = n // 4                       # 2ch x 2 bytes
    return round(frames / 44100 * 1000, 2)

def sha1(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()[:12]

tracks = {}
audio_dir = ROOT   # this IS the audio layer dir
ledger_rows = []

for fn in sorted(os.listdir(audio_dir)):
    if not fn.endswith(".ogg"):
        continue
    path = os.path.join(audio_dir, fn)
    dur_ms = exact_duration_ms(path)
    bpm = DESIGN_BPM.get(fn, 100)
    beat_ms = 60000 / bpm
    beats_total = dur_ms / beat_ms
    tracks[fn] = {
        "file": fn,
        "license": LIC,
        "source": SRC + "/Audio/music",
        "attribution": AUTH,
        "durationMs": dur_ms,
        "declaredS": round(dur_ms / 1000, 4),
        "bpm": bpm,
        "beatMs": round(beat_ms, 2),
        "beatsTotal": round(beats_total, 1),
        "vet": "pending-ears",            # IP-remix + tempo check: human ear at review
        "tempoVerified": False,
        "sha1": sha1(path),
    }
    rel = "audio/" + fn
    ledger_rows.append(f"| {rel} | {sha1(path)} | {LIC} | {dur_ms} ms | {bpm} BPM | pending-ears |")

out = {
    "schema": "typemon.track.v1",
    "generated": SHA,
    "license": LIC,
    "attribution": AUTH,
    "note": "Judge beat-grid derives from this manifest, never the decoded audio. vet=pending-ears = exclude on doubt until human ear pass.",
    "count": len(tracks),
    "tracks": tracks,
}
with open(os.path.join(audio_dir, "tracks.json"), "w") as f:
    json.dump(out, f, indent=2)

# Append audio rows to the attribution ledger (one level up: the island root)
ledger_path = os.path.join(os.path.dirname(ROOT), "ATTRIBUTION.md")
with open(ledger_path, "a") as f:
    f.write("\n## Audio ledger (battle-loop set)\n\n")
    f.write("| File | SHA-1 (12) | License | Duration (ms) | Design BPM | Vet |\n|---|---|---|---|---|---|\n")
    f.write("\n".join(ledger_rows) + "\n")

print(f"tracks.json: {len(tracks)} tracks")
for fn, t in tracks.items():
    print(f"  {fn}: {t['declaredS']}s | {t['bpm']} BPM | {t['beatsTotal']} beats | {t['vet']}")
