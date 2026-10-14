"""
יוצר טקסטורות "נייר אמיתי" מהתמונות של הספר:
מיישר כל עמוד מצולם, מוחק ממנו את הטקסט (inpainting) ומשאיר רק את הנייר —
עם הכתמים, הצהבהבות והקצוות הכהים האמיתיים.
הרצה:  python tools/make_paper.py      (צריך את התמונות המקוריות בתיקייה raw/)
"""
import os
import cv2
import numpy as np
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw")
OUT = os.path.join(ROOT, "images", "paper")
K = 2048 / 1000  # הקואורדינטות נמדדו על תמונות מוקטנות ל-1000 פיקסלים
SIZE = (640, 960)

# (תמונה, פינה עליונה-שמאלית, תחתונה-שמאלית, תחתונה-ימנית, עליונה-ימנית) — עמודים בלי אצבעות
PAGES = [
    ("05", (78, 346), (88, 757), (356, 765), (352, 345)),
    ("01", (410, 233), (412, 752), (748, 756), (748, 222)),
    ("07", (28, 312), (2, 800), (316, 840), (336, 320)),
    ("03", (55, 250), (40, 640), (300, 670), (306, 234)),
    ("02", (355, 290), (345, 750), (662, 760), (680, 280)),
    ("04", (130, 280), (105, 656), (382, 670), (382, 290)),
]

def warp(n, ul, ll, lr, ur):
    im = ImageOps.exif_transpose(Image.open(os.path.join(RAW, n + ".jpg"))).convert("RGB")
    q = [c * K for p in (ul, ll, lr, ur) for c in p]
    return np.array(im.transform(SIZE, Image.QUAD, q, Image.BICUBIC))

def remove_text(rgb):
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    # הנייר המקומי (בלי הטקסט) = טשטוש חזק; דיו = פיקסלים כהים בהרבה מהסביבה
    bg = cv2.medianBlur(gray, 41)
    ink = (bg.astype(int) - gray.astype(int)) > 22
    mask = cv2.dilate(ink.astype(np.uint8) * 255, np.ones((5, 5), np.uint8), iterations=2)
    out = cv2.inpaint(bgr, mask, 9, cv2.INPAINT_TELEA)
    # שני סבבים — מחיקת שאריות דקות
    gray2 = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY)
    ink2 = (cv2.medianBlur(gray2, 41).astype(int) - gray2.astype(int)) > 14
    mask2 = cv2.dilate(ink2.astype(np.uint8) * 255, np.ones((3, 3), np.uint8), iterations=2)
    out = cv2.inpaint(out, mask2, 7, cv2.INPAINT_TELEA)
    # טשטוש קל מאוד כדי להעלים "צלקות" של המחיקה ולהשאיר את הכתמים
    soft = cv2.GaussianBlur(out, (0, 0), 2.2)
    return cv2.cvtColor(soft, cv2.COLOR_BGR2RGB)

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    i = 0
    for n, *quad in PAGES:
        paper = Image.fromarray(remove_text(warp(n, *quad)))
        w, h = paper.size
        paper = paper.crop((int(w * .05), int(h * .05), int(w * .95), int(h * .95))).resize(SIZE, Image.LANCZOS)
        for img in (paper, ImageOps.mirror(paper)):   # גם גרסה הפוכה — יותר גיוון
            i += 1
            img.save(os.path.join(OUT, f"paper-{i}.jpg"), quality=78, optimize=True)
    print("textures:", i)
