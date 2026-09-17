#!/usr/bin/env python3
"""Generate the Typemon CC-BY-SA asset manifest (ATTRIBUTION.md + poses.json).

Input : assets/ccbysa/**/*.png (pulled from OpMonTeam/OpMon-Data, master @ 2026-08-28)
Output:
  assets/ccbysa/ATTRIBUTION.md  - per-file attribution ledger (ship-time proof)
  assets/ccbysa/poses.json      - machine Pose manifest: { id, frames[], license }
                                   (the ONLY provenance point the engine reads)

The license layer is a ship-time island: the engine consumes poses.json only,
never directory paths. Paid/original monsters will live in a separate manifest
whose build assertion guarantees zero ccbysa entries.
"""
import json, os, re, hashlib
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))   # this IS the ccbysa layer dir
SRC = "OpMonTeam/OpMon-Data"
AUTH = "OpMon Team contributors (github.com/OpMonTeam/OpMon-Data)"
LIC = "CC-BY-SA-4.0"
SHA = "master@2026-08-28"

def sha1(p):
    h = hashlib.sha1()
    with open(p, "rb") as f:
        h.update(f.read())
    return h.hexdigest()[:12]

def walk(base):
    out = []
    for dirpath, _dirs, files in os.walk(base):
        # skip our own generated outputs
        if os.path.basename(dirpath) == "ccbysa" and any(f.endswith((".py", ".md", ".json")) for f in files):
            files = [f for f in files if f.endswith(".png")]
        for fn in sorted(files):
            if fn.endswith(".png"):
                out.append(os.path.join(dirpath, fn))
    return out

pngs = walk(ROOT)

lines = [
    f"# Typemon — CC-BY-SA asset layer (attribution ledger)",
    "",
    f"**Source:** {SRC} · {SHA}",
    f"**License:** {LIC} (Attribution-ShareAlike 4.0 International)",
    f"**Attribution:** {AUTH}",
    "",
    "This directory is a ship-time island: it ships beside the MIT engine as a",
    "distinct asset layer. Derivatives of these files MUST remain CC-BY-SA.",
    "Paid/original monsters never reference this namespace (build-asserted).",
    "",
    "## Per-file ledger",
    "",
    "| File | SHA-1 (12) | License |",
    "|---|---|---|",
]
for p in pngs:
    rel = os.path.relpath(p, ROOT)
    lines.append(f"| {rel} | {sha1(p)} | {LIC} |")

with open(os.path.join(ROOT, "ATTRIBUTION.md"), "w") as f:
    f.write("\n".join(lines) + "\n")

# ---- poses.json ----------------------------------------------------------
poses = {}
for p in pngs:
    rel = os.path.relpath(p, ROOT)           # e.g. ccbysa/opmons/1-0.png
    parts = rel.split(os.sep)
    if parts[0] == "opmons":
        if len(parts) == 2:                  # opmons/NN-F.png
            m = re.match(r"^(.+?)-(\d+)\.png$", parts[1])
            if not m:
                continue
            mid, frame = m.group(1), int(m.group(2))
            key = f"opmon-{mid}"
            poses.setdefault(key, {"id": key, "frames": [], "license": LIC, "source": SRC})
            poses[key]["frames"].append({"frame": frame, "path": rel})
        else:                                # opmons/anims/*.png
            m = re.match(r"^(.+?)(?:_(\w+))?\.png$", parts[1])
            if not m:
                continue
            name, anim = m.group(1), m.group(2) or "anim"
            key = f"opmon-{name}"
            poses.setdefault(key, {"id": key, "frames": [], "license": LIC, "source": SRC})
            poses[key]["frames"].append({"frame": anim, "path": rel})
    elif parts[0] == "anims":                # opmons/anims/*.png -> extra frames
        m = re.match(r"^(.+?)-(\d+)(?:_(\w+))?\.png$", parts[1])
        if not m:
            continue
        mid, n, anim = m.group(1), m.group(2), m.group(3) or "alt"
        key = f"opmon-{mid}"
        poses.setdefault(key, {"id": key, "frames": [], "license": LIC, "source": SRC})
        poses[key]["frames"].append({"frame": f"{n}_{anim}", "path": rel})
    elif parts[0] == "types":
        key = f"type-{parts[1][:-4]}"
        poses[key] = {"id": key, "frames": [{"frame": 0, "path": rel}], "license": LIC, "source": SRC}
    elif parts[0] == "battle_bkg":
        key = f"bkg-{parts[1][:-4]}"
        poses[key] = {"id": key, "frames": [{"frame": 0, "path": rel}], "license": LIC, "source": SRC}

for v in poses.values():
    v["frames"].sort(key=lambda f: str(f["frame"]))

# ---- geometry pass (alpha bbox, density, scale hint) --------------------
# Objective read on the "reads as a monster at battle scale" gate:
#   areaPct  = bbox area / full-canvas area   (sparse sprites are small %)
#   density  = painted pixels / bbox area     (dot vs solid silhouette)
#   aspect   = w/h                            (<1 vertical, >1 wide)
#   scaleHint= battle-scale draw multiplier derived from areaPct
#   flags    = ["tiny"] if areaPct < 15% (auto-scale), ["sparse"] if density<10%
def geometry(path):
    im = Image.open(os.path.join(ROOT, path)).convert("RGBA")
    a = im.getchannel("A")
    bbox = a.getbbox()  # (l, t, r, b) or None
    if not bbox:
        return {"bbox": None, "density": 0.0, "areaPct": 0.0, "aspect": 1.0, "scaleHint": 1.0, "flags": []}
    l, t, r, b = bbox
    w, h = r - l, b - t
    total = im.width * im.height
    area = w * h
    px = a.crop(bbox).point(lambda v: 1 if v > 32 else 0)
    painted = sum(px.getdata())
    density = painted / area if area else 0
    areaPct = area / total * 100
    aspect = w / h if h else 1
    scale = 1.0
    flags = []
    if areaPct < 15:
        scale = max(1.6, min(2.6, 100 / (areaPct * 2)))  # grow small sprites to battle presence
        flags.append("tiny")
    if density < 0.10:
        flags.append("sparse")
    return {"bbox": [l, t, r, b], "density": round(density, 3), "areaPct": round(areaPct, 1),
            "aspect": round(aspect, 2), "scaleHint": round(scale, 2), "flags": flags}

for key, v in poses.items():
    numeric = [f for f in v["frames"] if isinstance(f["frame"], int)]
    if numeric:
        v["geometry"] = geometry(numeric[0]["path"])
    else:
        v["geometry"] = {"bbox": None, "density": 0.0, "areaPct": 0.0, "aspect": 1.0, "scaleHint": 1.0, "flags": []}

out = {
    "schema": "typemon.pose.v1",
    "generated": SHA,
    "license": LIC,
    "attribution": AUTH,
    "count": len(poses),
    "poses": poses,
}
with open(os.path.join(ROOT, "poses.json"), "w") as f:
    json.dump(out, f, indent=2)

opmons = [k for k in poses if k.startswith("opmon-") and any(isinstance(f["frame"], int) for f in poses[k]["frames"])]
print(f"poses.json: {len(poses)} poses ({len(opmons)} monsters, "
      f"{sum(1 for k in opmons if len(poses[k]['frames'])>1)} with >1 frame)")
print(f"ATTRIBUTION.md: {len(pngs)} ledger lines")
