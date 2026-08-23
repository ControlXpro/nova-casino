"""Slice generated symbol sheets into individual slot-reel symbols.

The image model does not honour a requested grid size — one sheet comes back
4x4, the next 4x6 — so the grid is detected from the sheet itself: tiles sit on
a flat black field, so the dark rows and columns between them give the cut
lines. Cells are then de-duplicated perceptually (the model repeats symbols)
and the first N distinct ones are written out.

Usage:
    python tools/symbols.py sheets.json          # {"theme-id": "https://..."}
"""
import json
import pathlib
import sys
import urllib.request
from io import BytesIO

from PIL import Image

OUT = pathlib.Path("art/sym")
CELL = 176           # exported symbol size (px)
WANT = 8             # symbols needed per theme: 6 regular + wild + scatter
DARK = 42            # a pixel this dark counts as background
GAP = 0.90           # a line this proportion dark counts as a gutter


def fetch(url: str) -> Image.Image:
    req = urllib.request.Request(url, headers={"User-Agent": "nova-casino-art/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return Image.open(BytesIO(r.read())).convert("RGB")


def _bands(is_gap: list[bool], min_len: int) -> list[tuple[int, int]]:
    """Turn a per-line gap mask into (start, end) runs of non-gap content."""
    bands, start = [], None
    for i, gap in enumerate(is_gap):
        if not gap and start is None:
            start = i
        elif gap and start is not None:
            if i - start >= min_len:
                bands.append((start, i))
            start = None
    if start is not None and len(is_gap) - start >= min_len:
        bands.append((start, len(is_gap)))
    return bands


def detect_grid(img: Image.Image):
    """Find content bands on both axes by looking for dark gutters."""
    g = img.convert("L")
    w, h = g.size
    px = g.load()
    step = max(1, w // 512)          # subsample: these sheets are 2048px

    col_gap = []
    for x in range(w):
        dark = sum(1 for y in range(0, h, step) if px[x, y] < DARK)
        col_gap.append(dark / len(range(0, h, step)) > GAP)
    row_gap = []
    for y in range(h):
        dark = sum(1 for x in range(0, w, step) if px[x, y] < DARK)
        row_gap.append(dark / len(range(0, w, step)) > GAP)

    cols = _bands(col_gap, w // 12)
    rows = _bands(row_gap, h // 12)
    return cols, rows


def ahash(img: Image.Image) -> int:
    """Average hash — cheap perceptual fingerprint for de-duplication."""
    small = img.convert("L").resize((8, 8), Image.LANCZOS)
    data = list(small.getdata())
    avg = sum(data) / len(data)
    bits = 0
    for i, v in enumerate(data):
        if v > avg:
            bits |= 1 << i
    return bits


def dist(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def ink(cell: Image.Image) -> float:
    """Fraction of non-background pixels — filters out blank cells."""
    g = cell.convert("L").resize((32, 32))
    return sum(1 for v in g.getdata() if v >= DARK) / 1024


def slice_sheet(theme: str, url: str) -> int:
    img = fetch(url)
    cols, rows = detect_grid(img)
    if len(cols) < 2 or len(rows) < 2:
        print(f"  {theme:<22} GRID NOT FOUND ({len(cols)}x{len(rows)})")
        return 0

    cells = []
    for (y0, y1) in rows:
        for (x0, x1) in cols:
            c = img.crop((x0, y0, x1, y1))
            if ink(c) < 0.45:          # mostly empty cell, skip
                continue
            cells.append(c)

    picked, hashes = [], []
    for c in cells:
        h = ahash(c)
        if any(dist(h, prev) < 6 for prev in hashes):
            continue                    # near-duplicate of one we already took
        hashes.append(h)
        picked.append(c)
        if len(picked) == WANT:
            break

    if len(picked) < WANT:              # top up with the least-similar leftovers
        for c in cells:
            if len(picked) == WANT:
                break
            if c not in picked:
                picked.append(c)

    d = OUT / theme
    d.mkdir(parents=True, exist_ok=True)
    total = 0
    for i, c in enumerate(picked[:WANT]):
        c = c.resize((CELL, CELL), Image.LANCZOS)
        p = d / f"{i}.webp"
        c.save(p, "WEBP", quality=82, method=6)
        total += p.stat().st_size
    print(f"  {theme:<22} grid {len(cols)}x{len(rows)}  cells {len(cells):>2}  "
          f"unique {len(hashes):>2}  wrote {min(len(picked), WANT)}  {total // 1024} KB")
    return total


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sheets = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    total = 0
    for theme, url in sheets.items():
        try:
            total += slice_sheet(theme, url)
        except Exception as exc:
            print(f"  {theme:<22} FAILED: {exc}")
    print(f"total {total // 1024} KB across {len(sheets)} themes")


if __name__ == "__main__":
    main()
