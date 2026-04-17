from PIL import Image, ImageDraw

def create_icon(size, filename):
    # ツイートアーカイブのブルー色 (#1d9bf0)
    bg_color = (29, 155, 240)
    img = Image.new('RGB', (size, size), color=bg_color)
    draw = ImageDraw.Draw(img)
    
    # 簡易なしおりの形
    margin = size // 4
    draw.rectangle([margin, margin // 2, size - margin, size - margin // 2], fill='white')
    draw.polygon([(margin, size - margin // 2), (size - margin, size - margin // 2), (size // 2, size - margin)], fill='white')
    
    img.save(filename, 'PNG')
    print(f"Created {filename} ({size}x{size})")

sizes = [16, 48, 128]
for s in sizes:
    create_icon(s, f"extension/icons/logo{s}.png")
