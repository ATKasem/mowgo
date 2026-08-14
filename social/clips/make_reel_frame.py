#!/usr/bin/env python3
"""Render MowGo Wed 'gate code' card + vertical reel frame (gray + #22c55e)."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

GRAY_BG = (38, 41, 47, 255)      # card bg
GREEN = (34, 197, 94, 255)       # #22c55e
WHITE = (245, 245, 245, 255)
MUTED = (156, 163, 175, 255)     # gray-400

def font(size, bold=True):
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
    except Exception:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)

# ---------- Card 1080x1080 ----------
card = Image.new("RGB", (1080, 1080), GRAY_BG[:3])
d = ImageDraw.Draw(card)

# green ENGAGEMENT tag (top-left, pill)
tag_text = "ENGAGEMENT"
tag_f = font(34)
bbox = d.textbbox((0, 0), tag_text, font=tag_f)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
pad_x, pad_y = 26, 14
tx, ty = 80, 80
d.rounded_rectangle([tx, ty, tx + tw + 2 * pad_x, ty + th + 2 * pad_y], radius=th + pad_y, fill=(34, 197, 94, 40))
d.text((tx + pad_x, ty + pad_y - bbox[1]), tag_text, font=tag_f, fill=GREEN)

# headline: "We all have" white / "that client." green
head_f = font(118)
for i, (line, color) in enumerate([("We all have", WHITE), ("that client.", GREEN)]):
    bb = d.textbbox((0, 0), line, font=head_f)
    w = bb[2] - bb[0]
    d.text(((1080 - w) / 2 - bb[0], 400 + i * 150 - bb[1]), line, font=head_f, fill=color)

# bottom: @mowgoapp
handle_f = font(40)
bb = d.textbbox((0, 0), "@mowgoapp", font=handle_f)
d.text(((1080 - (bb[2] - bb[0])) / 2 - bb[0], 960 - bb[1]), "@mowgoapp", font=handle_f, fill=MUTED)

card.save("/opt/data/mowgo/social/clips/wed-card-rebuilt.png")

# ---------- Vertical frame 1080x1920 ----------
bg = card.resize((1080, 1920))
bg = bg.filter(ImageFilter.GaussianBlur(36))
bg = ImageEnhance.Brightness(bg).enhance(0.55)

frame = Image.new("RGB", (1080, 1920))
frame.paste(bg, (0, 0))
fg = card.resize((920, 920), Image.LANCZOS)
frame.paste(fg, ((1080 - 920) // 2, (1920 - 920) // 2))
frame.save("/opt/data/mowgo/social/clips/reel-frame-gatecode.png")
print("saved card + frame")
