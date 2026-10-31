# Gera os ícones (corrente de dois elos, arte própria; sem logo/cores do X).
# Uso: python3 scripts/make-icons.py  (requer Pillow)
from PIL import Image, ImageDraw
S = 1024
im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rounded_rectangle((32, 32, S - 32, S - 32), radius=220, fill=(15, 118, 110, 255))  # teal
L = Image.new('RGBA', (S, S), (0, 0, 0, 0)); g = ImageDraw.Draw(L); w = 92
g.rounded_rectangle((140, 380, 600, 644), radius=132, outline=(255, 255, 255, 255), width=w)
g.rounded_rectangle((424, 380, 884, 644), radius=132, outline=(251, 191, 36, 255), width=w)  # âmbar
g.arc((424, 380, 688, 644), start=100, end=180, fill=(255, 255, 255, 255), width=w)  # entrelaçado
L = L.rotate(-35, resample=Image.BICUBIC, center=(S / 2, S / 2))
im.alpha_composite(L)
for n in (16, 32, 48, 128):
    im.resize((n, n), Image.LANCZOS).save(f'public/icons/icon{n}.png')
