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


def font_at(weight, size):
    path = os.path.join(
        ROOT, "node_modules", "@expo-google-fonts", "outfit",
        weight, f"Outfit_{weight}.ttf",
    )
    return ImageFont.truetype(path, size)


def splash(w=1284, h=2778):
    img = brand_background(w, h)
    logo = 420
    cx = w // 2
    top = int(h * 0.40) - logo // 2
    left = cx - logo // 2
    cy = top + logo // 2

    # Concentric "signal" rings radiating from the logo, fading outward.
    rings = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rings)
    for i, r in enumerate((330, 500, 700, 940, 1230)):
        alpha = int(70 * (1 - i / 5.5) ** 1.6) + 6
        rd.ellipse((cx - r, cy - r, cx + r, cy + r), outline=WHITE + (alpha,), width=3)
    img.alpha_composite(rings)

    # Soft radial glow behind the tile.
    glow = Image.new("L", (w, h), 0)
    ImageDraw.Draw(glow).ellipse((cx - 420, cy - 420, cx + 420, cy + 420), fill=95)
    img.paste(solid((w, h), SKY_300), (0, 0), glow.filter(ImageFilter.GaussianBlur(160)))

    # Faint ECG trace running edge to edge behind the tile, fading at the sides.
    trace = Image.new("L", (w, h), 0)
    ty = cy + 6
    pts = [(-20, ty), (cx - 560, ty), (cx - 500, ty - 40), (cx - 440, ty + 70),
           (cx - 380, ty - 130), (cx - 330, ty), (cx - 250, ty),
           (cx + 250, ty), (cx + 330, ty), (cx + 380, ty - 60), (cx + 440, ty + 90),
           (cx + 500, ty - 30), (cx + 560, ty), (w + 20, ty)]
    ImageDraw.Draw(trace).line(pts, fill=255, width=5, joint="curve")
    fade = Image.linear_gradient("L").rotate(90, expand=True).resize((w, h))
    edge = ImageChops.multiply(fade, ImageChops.invert(fade)).point(lambda v: min(255, v * 4))
    trace = ImageChops.multiply(trace, edge).point(lambda v: int(v * 0.35))
    img.paste(solid((w, h), WHITE), (0, 0), trace)

    # Tile: drop shadow, icon, and a thin top-lit glass edge.
    halo = Image.new("L", (w, h), 0)
    ImageDraw.Draw(halo).rounded_rectangle(
        (left, top + 40, left + logo, top + logo + 40), radius=logo * 0.22, fill=120)
    img.paste(solid((w, h), SKY_900), (0, 0), halo.filter(ImageFilter.GaussianBlur(46)))
    tile = masked(full_icon(logo, 0.58), "rounded")
    img.alpha_composite(tile, (left, top))
    edge_layer = Image.new("RGBA", (logo * SS, logo * SS), (0, 0, 0, 0))
    ImageDraw.Draw(edge_layer).rounded_rectangle(
        (2, 2, logo * SS - 3, logo * SS - 3), radius=logo * SS * 0.22, outline=WHITE + (110,), width=SS * 3)
    img.alpha_composite(edge_layer.resize((logo, logo), Image.LANCZOS), (left, top))

    d = ImageDraw.Draw(img)
    name_font = font_at("800ExtraBold", 132)
    name = "HealthHub"
    tw = d.textlength(name, font=name_font)
    name_y = top + logo + 100
    d.text(((w - tw) / 2, name_y), name, font=name_font, fill=WHITE)

    tag_font = font_at("500Medium", 44)
    tag = "YOUR HEALTH, ALL IN ONE PLACE"
    spacing = 6
    widths = [d.textlength(c, font=tag_font) + spacing for c in tag]
    x = (w - (sum(widths) - spacing)) / 2
    for c, cw in zip(tag, widths):
        d.text((x, name_y + 190), c, font=tag_font, fill=SKY_50 + (215,))
        x += cw

    # Loading dots near the bottom, leading dot brightest.
    dots = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots)
    dy = int(h * 0.90)
    for i, a in enumerate((255, 140, 70)):
        dx = cx + (i - 1) * 64
        dd.ellipse((dx - 13, dy - 13, dx + 13, dy + 13), fill=WHITE + (a,))
    img.alpha_composite(dots)
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
