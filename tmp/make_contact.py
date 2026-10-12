from pathlib import Path
from PIL import Image, ImageDraw

files = sorted(Path('tmp/loopify-pages').glob('*.png'))
thumb_w, thumb_h = 255, 330
cols = 4
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * thumb_w, rows * thumb_h), 'white')
draw = ImageDraw.Draw(sheet)
for i, path in enumerate(files):
    image = Image.open(path).convert('RGB')
    image.thumbnail((thumb_w - 10, thumb_h - 30))
    x = (i % cols) * thumb_w + (thumb_w - image.width) // 2
    y = (i // cols) * thumb_h + 20
    sheet.paste(image, (x, y))
    draw.text(((i % cols) * thumb_w + 8, 4 + (i // cols) * thumb_h), path.stem, fill='black')
sheet.save('tmp/loopify-contact.png')
