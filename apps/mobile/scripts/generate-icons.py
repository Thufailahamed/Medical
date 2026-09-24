#!/usr/bin/env python3
"""Generate HealthHub app icons, splash and Android launcher assets.

Usage (from apps/mobile):  python3 scripts/generate-icons.py
Requires Pillow. Every asset is rendered at 4x and downsampled for clean
anti-aliased edges.
"""

import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
FONT = os.path.join(
    ROOT, "node_modules", "@expo-google-fonts", "outfit",
    "800ExtraBold", "Outfit_800ExtraBold.ttf",
)
SS = 4

# Brand palette — mirrors src/constants/theme.ts (sky scale).
SKY_300 = (125, 211, 252)
SKY_400 = (56, 189, 248)
SKY_500 = (14, 165, 233)
SKY_600 = (2, 132, 199)
SKY_700 = (3, 105, 161)
SKY_900 = (12, 74, 110)
SKY_50 = (240, 249, 255)
WHITE = (255, 255, 255)


def hexc(c):
    return "#%02X%02X%02X" % c


def solid(size, color, alpha=255):
    return Image.new("RGBA", size, color + (alpha,))


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def brand_background(w, h):
    """Diagonal sky gradient with a soft top-left glow and bottom-right depth.

    Computed per-pixel on a small grid and upscaled — gradients are smooth,
    so this is both fast and band-free.
    """
    gw = 256
    gh = max(2, int(round(gw * h / w)))
    aspect = h / w
    px = []
    for j in range(gh):
        v = j / (gh - 1)
        for i in range(gw):
            u = i / (gw - 1)
            t = (u + v * aspect) / (1 + aspect)
            c = lerp(SKY_400, SKY_600, smooth(t / 0.6)) if t < 0.6 else lerp(SKY_600, SKY_700, smooth((t - 0.6) / 0.4))
            g = max(0.0, 1 - math.hypot(u - 0.15, (v - 0.1) * aspect) / 0.75)
            c = lerp(c, WHITE, 0.22 * g * g)
            d = max(0.0, 1 - math.hypot(u - 1.0, (v - 1.0) * aspect) / 0.9)
            c = lerp(c, SKY_900, 0.35 * d * d)
            px.append(c)
    img = Image.new("RGB", (gw, gh))
    img.putdata(px)
    return img.resize((w, h), Image.BICUBIC).convert("RGBA")


def heart_points(cx, cy, width):
    """Classic parametric heart, scaled so its width equals `width`."""
    s = width / 32.0
    pts = []
    for i in range(720):
        t = 2 * math.pi * i / 720
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * s, cy - (y + 2.5) * s))
    return pts


def pulse_points(cx, cy, width):
    """ECG trace in heart-relative units (x: -1..1 of half width)."""
    hw, hh = width / 2, width / 2
    trace = [
        (-0.62, 0.0), (-0.24, 0.0), (-0.12, -0.34), (0.04, 0.30),
        (0.16, -0.12), (0.24, 0.0), (0.62, 0.0),
    ]
    return [(cx + x * hw, cy + y * hh) for x, y in trace]


def draw_polyline(draw, pts, color, w):
    draw.line(pts, fill=color, width=int(w), joint="curve")
    r = w / 2
    for x, y in (pts[0], pts[-1]):
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)


def mark(size, heart_frac, silhouette=False, shadow=True):
    """Transparent RGBA layer containing the heart + pulse mark."""
    S = size * SS
    cx, cy = S / 2, S / 2
    hw = S * heart_frac
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    heart_mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(heart_mask).polygon(heart_points(cx, cy, hw), fill=255)
    # Blur + threshold rounds the sharp tip and notch into soft curves.
    heart_mask = heart_mask.filter(ImageFilter.GaussianBlur(hw * 0.016)).point(lambda v: 255 if v >= 120 else 0)

    pulse_mask = Image.new("L", (S, S), 0)
    draw_polyline(ImageDraw.Draw(pulse_mask), pulse_points(cx, cy - hw * 0.03, hw), 255, hw * 0.068)

    if silhouette:
        out.paste(solid((S, S), WHITE), (0, 0), ImageChops.subtract(heart_mask, pulse_mask))
        return out.resize((size, size), Image.LANCZOS)

    if shadow:
        sh = heart_mask.point(lambda v: int(v * 0.38))
        sh = sh.transform(sh.size, Image.AFFINE, (1, 0, 0, 0, 1, -hw * 0.05))
        sh = sh.filter(ImageFilter.GaussianBlur(hw * 0.06))
        out.paste(solid((S, S), SKY_900), (0, 0), sh)

    # Heart body: white fading to a faint sky tint at the tip.
    vert = Image.linear_gradient("L").resize((S, S), Image.BICUBIC)
    body = Image.composite(solid((S, S), SKY_50), solid((S, S), WHITE), vert)
    out.paste(body, (0, 0), heart_mask)

    # Pulse trace in brand gradient.
    horiz = Image.linear_gradient("L").rotate(90, expand=True).resize((S, S), Image.BICUBIC)
    trace = Image.composite(solid((S, S), SKY_700), solid((S, S), SKY_500), ImageChops.invert(horiz))
    out.paste(trace, (0, 0), pulse_mask)

    return out.resize((size, size), Image.LANCZOS)


def full_icon(size, heart_frac=0.56):
    bg = brand_background(size * SS, size * SS).resize((size, size), Image.LANCZOS)
    bg.alpha_composite(mark(size, heart_frac))
    return bg


def masked(img, shape):
    size = img.size[0]
    m = Image.new("L", (size * SS, size * SS), 0)
    d = ImageDraw.Draw(m)
    if shape == "circle":
        d.ellipse((0, 0, size * SS - 1, size * SS - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, size * SS - 1, size * SS - 1), radius=size * SS * 0.22, fill=255)
    m = m.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), m)
    return out


def splash(w=1284, h=2778):
    img = brand_background(w, h)
    logo = 420
    tile = masked(full_icon(logo, 0.58), "rounded")
    halo = Image.new("L", (w, h), 0)
    top = int(h * 0.40) - logo // 2
    left = (w - logo) // 2
    ImageDraw.Draw(halo).rounded_rectangle(
        (left, top + 30, left + logo, top + logo + 30), radius=logo * 0.22, fill=110)
    img.paste(solid((w, h), SKY_900), (0, 0), halo.filter(ImageFilter.GaussianBlur(40)))
    img.alpha_composite(tile, (left, top))

    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, 132)
    text = "HealthHub"
    tw = d.textlength(text, font=font)
    d.text(((w - tw) / 2, top + logo + 90), text, font=font, fill=WHITE)
    return img.convert("RGB")


def save(img, *parts):
    path = os.path.join(*parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    print("wrote", os.path.relpath(path, ROOT))


def main():
    # Expo / iOS: full-bleed opaque square (iOS applies its own mask).
    save(full_icon(1024).convert("RGB"), ASSETS, "icon.png")
    # Android adaptive icon: mark inside the 66% safe zone + gradient background.
    save(mark(1024, 0.40), ASSETS, "adaptive-icon.png")
    save(brand_background(1024, 1024).convert("RGB"), ASSETS, "adaptive-icon-background.png")
    save(mark(1024, 0.40, silhouette=True, shadow=False), ASSETS, "adaptive-icon-monochrome.png")
    save(mark(96, 0.86, silhouette=True, shadow=False), ASSETS, "notification-icon.png")
    save(masked(full_icon(48, 0.6), "rounded"), ASSETS, "favicon.png")
    save(splash(), ASSETS, "splash.png")

    # Native Android launcher (android/ is committed, so prebuild may not rerun).
    densities = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for name, k in densities.items():
        legacy = int(48 * k)
        adaptive = int(108 * k)
        save(masked(full_icon(legacy, 0.58), "rounded"), RES, f"mipmap-{name}", "ic_launcher.png")
        save(masked(full_icon(legacy, 0.54), "circle"), RES, f"mipmap-{name}", "ic_launcher_round.png")
        save(mark(adaptive, 0.40), RES, f"mipmap-{name}", "ic_launcher_foreground.png")
        save(brand_background(adaptive * SS, adaptive * SS).resize((adaptive, adaptive), Image.LANCZOS).convert("RGB"),
             RES, f"mipmap-{name}", "ic_launcher_background.png")
        save(mark(adaptive, 0.40, silhouette=True, shadow=False), RES, f"mipmap-{name}", "ic_launcher_monochrome.png")


if __name__ == "__main__":
    main()
