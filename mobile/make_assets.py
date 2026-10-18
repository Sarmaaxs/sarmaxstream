# Builds the launcher icon + splash screen images for @capacitor/assets.
# Icon = lime play button on near-black. Splash = your existing wordmark (public/favicon.png).
import os
from PIL import Image, ImageDraw

LIME, BG = (212, 255, 26), (11, 11, 13)
os.makedirs("assets", exist_ok=True)

def triangle(size, scale):
    big = size * 2
    im = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    h = big * scale
    w = h * 0.9
    x0 = big / 2 - w * 0.38          # nudged right so it looks optically centred
    d.polygon([(x0, big / 2 - h / 2), (x0, big / 2 + h / 2), (x0 + w, big / 2)], fill=LIME)
    return im.resize((size, size), Image.LANCZOS)

Image.new("RGBA", (1024, 1024), BG + (255,)).save("assets/icon-background.png")
triangle(1024, 0.36).save("assets/icon-foreground.png")           # adaptive icon: stays inside the safe zone
only = Image.new("RGBA", (1024, 1024), BG + (255,))
only.alpha_composite(triangle(1024, 0.42))
only.save("assets/icon-only.png")

fav = Image.open("../public/favicon.png").convert("RGB")
corner = fav.getpixel((4, 4))
for name in ("splash.png", "splash-dark.png"):
    canvas = Image.new("RGB", (2732, 2732), corner)
    logo = fav.resize((1300, 1300), Image.LANCZOS)
    canvas.paste(logo, ((2732 - 1300) // 2, (2732 - 1300) // 2))
    canvas.save("assets/" + name)
print("assets ready")
