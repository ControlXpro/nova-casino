"""Fetch generated game art and optimise it for the web.

Higgsfield returns ~4 MB PNGs. Card art renders at roughly 200x150 CSS px, so
we downscale to 480x360 (2x for retina) and save WebP — about 100x smaller,
which keeps the whole 100+ game library under a few MB.

Usage:
    python tools/art.py manifest.json        # {"game-id": "https://..."}
"""
import json
import pathlib
import sys
import urllib.request
from io import BytesIO

from PIL import Image

ART = pathlib.Path("art")
SIZE = (480, 360)
QUALITY = 80


def fetch(url: str) -> Image.Image:
    req = urllib.request.Request(url, headers={"User-Agent": "nova-casino-art/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return Image.open(BytesIO(r.read())).convert("RGB")


def process(game_id: str, url: str) -> int:
    img = fetch(url)
    # ids starting with "_" are page backgrounds, kept wide
    size = (1280, 720) if game_id.startswith("_") else SIZE
    # cover-crop so nothing is letterboxed
    target = size[0] / size[1]
    w, h = img.size
    if w / h > target:
        new_w = int(h * target)
        img = img.crop(((w - new_w) // 2, 0, (w + new_w) // 2, h))
    else:
        new_h = int(w / target)
        img = img.crop((0, (h - new_h) // 2, w, (h + new_h) // 2))

    img = img.resize(size, Image.LANCZOS)
    dest = ART / f"{game_id}.webp"
    img.save(dest, "WEBP", quality=QUALITY, method=6)
    return dest.stat().st_size


def main() -> None:
    ART.mkdir(exist_ok=True)
    manifest = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    total = 0
    for game_id, url in manifest.items():
        try:
            size = process(game_id, url)
            total += size
            print(f"  {game_id:<26} {size // 1024:>4} KB")
        except Exception as exc:                      # keep going on one bad URL
            print(f"  {game_id:<26} FAILED: {exc}")
    print(f"total {total // 1024} KB across {len(manifest)} images")


if __name__ == "__main__":
    main()
