#!/usr/bin/env python3
"""Generate the Sixty Strong home-screen icons (no dependencies; stdlib only).

Orange tile, bold white "60" built from blocks, and a barbell bar underneath.
Run from the project folder:  python3 tools/make_icons.py
"""
import os, struct, zlib

ACCENT = (0xD9, 0x58, 0x1B)
WHITE = (0xFF, 0xFF, 0xFF)
DARK = (0x16, 0x1A, 0x20)

# 5 x 7 block glyphs
GLYPHS = {
    "6": ["01110", "11000", "11000", "11110", "11011", "11011", "01110"],
    "0": ["01110", "11011", "11011", "11011", "11011", "11011", "01110"],
}

def render(size):
    ss = 4                      # supersample for smooth edges
    S = size * ss
    px = [[ACCENT for _ in range(S)] for _ in range(S)]

    def rect(x0, y0, x1, y1, col):
        for y in range(max(0, int(y0)), min(S, int(y1))):
            row = px[y]
            for x in range(max(0, int(x0)), min(S, int(x1))):
                row[x] = col

    cell = S * 0.072            # glyph block size
    gw, gh, gap = 5 * cell, 7 * cell, cell * 1.2
    total_w = gw * 2 + gap
    x = (S - total_w) / 2
    y = S * 0.20
    for ch in "60":
        for r, line in enumerate(GLYPHS[ch]):
            for c, bit in enumerate(line):
                if bit == "1":
                    rect(x + c * cell, y + r * cell, x + (c + 1) * cell, y + (r + 1) * cell, WHITE)
        x += gw + gap

    # barbell: bar + two plates each side
    by = y + gh + S * 0.085
    bar_h = S * 0.03
    rect(S * 0.16, by, S * 0.84, by + bar_h, DARK)
    for (a, b, h) in [(0.16, 0.22, 0.16), (0.23, 0.27, 0.11), (0.73, 0.77, 0.11), (0.78, 0.84, 0.16)]:
        cy = by + bar_h / 2
        rect(S * a, cy - S * h / 2, S * b, cy + S * h / 2, DARK)

    # downsample
    out = []
    for y in range(size):
        row = []
        for x in range(size):
            r = g = b = 0
            for yy in range(y * ss, y * ss + ss):
                for xx in range(x * ss, x * ss + ss):
                    p = px[yy][xx]; r += p[0]; g += p[1]; b += p[2]
            n = ss * ss
            row.append((r // n, g // n, b // n))
        out.append(row)
    return out

def png(path, pixels):
    h, w = len(pixels), len(pixels[0])
    raw = b"".join(b"\x00" + bytes([c for p in row for c in p]) for row in pixels)
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) \
        + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(data)

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "app", "icons")
    os.makedirs(out, exist_ok=True)
    for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
        png(os.path.join(out, name), render(size))
        print("wrote", name)
