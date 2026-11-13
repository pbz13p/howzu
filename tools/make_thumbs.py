"""给 photos/*.jpg 生成小图：photos/s/（宽 480，列表卡片用）和 photos/m/（宽 960，详情大图用）。
只处理新的或改过的照片；原图不动。用法：python3 tools/make_thumbs.py"""
import os, sys
from PIL import Image, ImageOps
root = os.path.join(os.path.dirname(__file__), "..", "photos")
made = 0
for name in sorted(os.listdir(root)):
    if not name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        continue
    src = os.path.join(root, name)
    for sub, w, q in (("s", 480, 76), ("m", 960, 70)):
        out_dir = os.path.join(root, sub); os.makedirs(out_dir, exist_ok=True)
        dst = os.path.join(out_dir, os.path.splitext(name)[0] + ".jpg")
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            continue
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        if im.width > w:
            im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im.save(dst, "JPEG", quality=q, optimize=True, progressive=True)
        made += 1
print(f"小图：新生成 {made} 张")
