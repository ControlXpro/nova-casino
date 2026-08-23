"""Turn a subject-on-black render into a proper cut-out with an alpha channel.

`mix-blend-mode: screen` only *looks* transparent: the element is still an
opaque rectangle, so any filter or glow draws around the box rather than the
subject — which is exactly the square halo around the crash rocket.

This keys the black plate out into real alpha, feathers the edge, trims to the
subject's bounding box, and writes WebP with alpha. The element box then hugs
the artwork and normal CSS shadows behave.

Usage:
    python tools/cutout.py <url> <out-name> [low] [high]
"""
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageFilter

ART = Path("art")


def fetch(url: str) -> Image.Image:
    req = urllib.request.Request(url, headers={"User-Agent": "nova-casino-art/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return Image.open(BytesIO(r.read())).convert("RGB")


def cutout(img: Image.Image, low: int = 14, high: int = 58) -> Image.Image:
    """Alpha from channel maximum: black plate -> 0, lit subject -> 255.

    Using max(R,G,B) rather than luminance keeps saturated flame colours fully
    opaque; a luminance key would eat the deep orange in the exhaust.
    """
    r, g, b = img.split()
    value = ImageChops_max(ImageChops_max(r, g), b)

    span = max(1, high - low)
    alpha = value.point(lambda v: 0 if v <= low else (255 if v >= high
                                                     else int((v - low) * 255 / span)))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))     # feather the edge

    out = img.convert("RGBA")
    out.putalpha(alpha)

    bbox = alpha.getbbox()
    if bbox:
        out = out.crop(bbox)
    return out


def ImageChops_max(a: Image.Image, b: Image.Image) -> Image.Image:
    from PIL import ImageChops
    return ImageChops.lighter(a, b)


def main() -> None:
    url, name = sys.argv[1], sys.argv[2]
    low = int(sys.argv[3]) if len(sys.argv) > 3 else 14
    high = int(sys.argv[4]) if len(sys.argv) > 4 else 58

    img = cutout(fetch(url), low, high)
    img.thumbnail((448, 448), Image.LANCZOS)
    dest = ART / f"{name}.webp"
    img.save(dest, "WEBP", quality=80, method=6)
    print(f"{name}: {img.size[0]}x{img.size[1]}  {dest.stat().st_size // 1024} KB  (alpha)")


if __name__ == "__main__":
    main()
