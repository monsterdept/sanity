#!/usr/bin/env python3
"""Generate src-tauri/icons/source.png — the placeholder app icon.

A sunburst of concentric rings running cool→hot outward, which is the app in one
picture. Written with zlib and struct rather than Pillow so it runs on any machine with
a bare Python: this needs to work on a fresh checkout, and an icon generator that
requires `pip install` is one nobody re-runs.

Replace with real artwork whenever there is some; then `just icons`.
"""

import struct
import zlib
from pathlib import Path

SIZE = 1024
BG = (0x1A, 0x1A, 0x1A)  # Monster Dept Ink

# Cool (understood) → hot (surprising and unexplained). Same ramp the UI uses; keep the
# two in step or the icon stops describing the product.
RAMP = [
    (0x35, 0x81, 0x89),
    (0x42, 0xA2, 0xAB),
    (0xC0, 0x95, 0x57),
    (0xBF, 0x96, 0x5D),
    (0x8F, 0x57, 0x53),
]

# Ring boundaries as a fraction of the radius, plus the gap between rings.
RINGS = [(0.20, 0.36), (0.38, 0.54), (0.56, 0.72), (0.74, 0.90)]
# Wedge gaps per ring, in turns — more subdivisions further out, like the real thing.
SPOKES = [3, 5, 8, 13]


def pixel(x: int, y: int) -> tuple[int, int, int]:
    import math

    cx = cy = SIZE / 2
    dx, dy = x - cx, y - cy
    r = math.hypot(dx, dy) / (SIZE / 2)
    theta = (math.atan2(dy, dx) / (2 * math.pi)) % 1.0

    for i, (lo, hi) in enumerate(RINGS):
        if lo <= r < hi:
            # Wedge separators: a thin gap at each spoke boundary.
            n = SPOKES[i]
            frac = (theta * n) % 1.0
            if frac < 0.035 or frac > 0.965:
                return BG
            return RAMP[min(i + 1, len(RAMP) - 1)]
    if r < RINGS[0][0]:
        return RAMP[0]
    return BG


def main() -> None:
    rows = bytearray()
    for y in range(SIZE):
        rows.append(0)  # PNG filter type 0 (None) per scanline
        for x in range(SIZE):
            rows.extend(pixel(x, y))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0)  # 8-bit RGB
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + chunk(b"IEND", b"")
    )

    out = Path(__file__).resolve().parent.parent / "src-tauri" / "icons" / "source.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(png)
    print(f"wrote {out} ({len(png) // 1024}kB)")


if __name__ == "__main__":
    main()
