"""Compose labelled contact sheets from rendered stills.
  python3 tools/contact_sheet.py <dir_with_jpgs> <out_prefix> [cols=6] [rows=5] [thumb_w=480]
Files are sorted by the time encoded in their name (..._12.50.jpg)."""
import sys, os, re, glob
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
rows = int(sys.argv[4]) if len(sys.argv) > 4 else 5
tw = int(sys.argv[5]) if len(sys.argv) > 5 else 480
th = tw * 9 // 16
files = sorted(glob.glob(os.path.join(d, '*.jpg')), key=lambda f: float(re.findall(r'_([\d.]+)\.jpg$', f)[0]) if re.findall(r'_([\d.]+)\.jpg$', f) else 0)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/fonts-japanese-gothic.ttf', 18)
except Exception:
    font = ImageFont.load_default()
per = cols * rows
for pg in range(0, len(files), per):
    sheet = Image.new('RGB', (cols * tw, rows * (th + 24)), (16, 16, 20)); dr = ImageDraw.Draw(sheet)
    for k, f in enumerate(files[pg:pg + per]):
        im = Image.open(f).resize((tw, th)); x = (k % cols) * tw; y = (k // cols) * (th + 24)
        sheet.paste(im, (x, y)); lab = os.path.basename(f).replace('.jpg', '')
        dr.text((x + 6, y + th + 2), lab, fill=(230, 220, 200), font=font)
    path = f'{out}_{pg // per + 1:02d}.jpg'; sheet.save(path, quality=88); print(path)
