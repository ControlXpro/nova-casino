"""Resolve, download and process the art for the 200 instant games.

The CDN key is hf_<date>_<HHMMSS>_<job-id>.png where the time is the write
time. Rather than transcribe 200 URLs by hand we anchor on the one timestamp
we know and walk forward: find the first job of a batch by probing a forward
window, then the rest of that batch sits within a few seconds of it.

Each source image yields two files, so a game is personalised inside the game
as well as on its lobby card:
    art/<id>.webp         480x360  lobby card
    art/scene/<id>.webp   960x540  in-game backdrop, darkened for legibility

Usage:  python tools/fetch200.py [--anchor HHMMSS]
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://d8j0ntlcm91z4.cloudfront.net/user_39wgFi7Tu7lxq3w55HXxhkUTa10/hf_20260824_"
CARD = (480, 360)
SCENE = (960, 540)
QUALITY = 80
FORWARD = 900          # seconds to search ahead of the previous batch anchor
NEAR = 10              # seconds either side once a batch anchor is known


def url_for(hhmmss: str, job: str) -> str:
    return f"{BASE}{hhmmss}_{job}.png"


def exists(u: str) -> bool:
    req = urllib.request.Request(u, method="HEAD",
                                 headers={"User-Agent": "nova-casino-art/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status == 200
    except Exception:
        return False


def secs(hhmmss: str) -> int:
    h, m, s = int(hhmmss[:2]), int(hhmmss[2:4]), int(hhmmss[4:])
    return h * 3600 + m * 60 + s


def stamp(total: int) -> str:
    total %= 86400
    return f"{total // 3600:02d}{total // 60 % 60:02d}{total % 60:02d}"


def find(job: str, centre: int, span: int, forward_only: bool = False) -> str | None:
    """Probe timestamps outward from `centre` until one resolves."""
    offsets = range(0, span + 1) if forward_only else \
        [d for i in range(span + 1) for d in ((i, -i) if i else (0,))]
    cands = [stamp(centre + o) for o in offsets] if forward_only else \
        [stamp(centre + o) for o in offsets]
    with ThreadPoolExecutor(max_workers=32) as pool:
        # probe in blocks so a near hit does not wait on the whole window
        for i in range(0, len(cands), 64):
            block = cands[i:i + 64]
            for hh, ok in zip(block, pool.map(lambda h: exists(url_for(h, job)), block)):
                if ok:
                    return hh
    return None


def fetch(u: str) -> Image.Image:
    req = urllib.request.Request(u, headers={"User-Agent": "nova-casino-art/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return Image.open(BytesIO(r.read())).convert("RGB")


def cover(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    target = size[0] / size[1]
    w, h = img.size
    if w / h > target:
        nw = int(h * target)
        img = img.crop(((w - nw) // 2, 0, (w + nw) // 2, h))
    else:
        nh = int(w / target)
        img = img.crop((0, (h - nh) // 2, w, (h + nh) // 2))
    return img.resize(size, Image.LANCZOS)


def process(gid: str, img: Image.Image) -> tuple[int, int]:
    art = ROOT / "art"
    (art / "scene").mkdir(parents=True, exist_ok=True)

    card = cover(img, CARD)
    card.save(art / f"{gid}.webp", "WEBP", quality=QUALITY, method=6)

    # The backdrop sits behind live controls, so knock it back: the scrim in
    # CSS handles contrast, but starting from a darker plate keeps text crisp
    # even where the art is bright.
    sc = cover(img, SCENE)
    sc = ImageEnhance.Brightness(sc).enhance(0.62)
    sc = ImageEnhance.Color(sc).enhance(1.08)
    sc.save(art / "scene" / f"{gid}.webp", "WEBP", quality=74, method=6)

    return ((art / f"{gid}.webp").stat().st_size,
            (art / "scene" / f"{gid}.webp").stat().st_size)


def main() -> None:
    anchor = "151454"
    if "--anchor" in sys.argv:
        anchor = sys.argv[sys.argv.index("--anchor") + 1]

    ids = list(json.loads((ROOT / "tools" / "prompts200.json").read_text(encoding="utf-8")))
    jobs = json.loads((ROOT / "tools" / "jobs200.json").read_text(encoding="utf-8"))

    resolved: dict[str, str] = {}
    cache = ROOT / "tools" / "urls200.json"
    if cache.exists():
        resolved = json.loads(cache.read_text(encoding="utf-8"))

    centre = secs(anchor)
    for start in range(0, len(ids), 12):
        batch = ids[start:start + 12]
        if all(g in resolved for g in batch):
            centre = secs(resolved[batch[0]].split("_")[-2])
            continue
        # anchor the batch on its first unresolved job
        head = next(g for g in batch if g not in resolved)
        hh = find(jobs[head], centre, FORWARD, forward_only=True)
        if hh is None:
            print(f"  batch @{start}: could not anchor {head}")
            continue
        centre = secs(hh)
        resolved[head] = url_for(hh, jobs[head])

        def one(gid: str) -> tuple[str, str | None]:
            if gid in resolved:
                return gid, resolved[gid]
            h = find(jobs[gid], centre, NEAR)
            return gid, (url_for(h, jobs[gid]) if h else None)

        with ThreadPoolExecutor(max_workers=12) as pool:
            for gid, u in pool.map(one, batch):
                if u:
                    resolved[gid] = u
                else:
                    print(f"  unresolved: {gid}")
        cache.write_text(json.dumps(resolved, indent=1), encoding="utf-8")
        print(f"  batch @{start:>3}: {sum(1 for g in batch if g in resolved)}/12 resolved")

    print(f"resolved {len(resolved)}/{len(ids)}")

    total = 0

    def build(gid: str) -> str:
        nonlocal total
        try:
            a, b = process(gid, fetch(resolved[gid]))
            total += a + b
            return f"  {gid:<22} {a // 1024:>3}K card  {b // 1024:>3}K scene"
        except Exception as exc:
            return f"  {gid:<22} FAILED: {exc}"

    with ThreadPoolExecutor(max_workers=8) as pool:
        for line in pool.map(build, [g for g in ids if g in resolved]):
            if "FAILED" in line:
                print(line)
    print(f"total {total // 1024} KB across {len(resolved)} games (card + scene)")


if __name__ == "__main__":
    main()
