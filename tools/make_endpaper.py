"""
יוצר "נייר שיש" (marbled paper) — הנייר המעוטר שמודבק בצד הפנימי של הכריכה בספרים ישנים.
הדוגמה נוצרת מתמטית (רעש מעוות), בצבעים שמתאימים לספר.
הרצה:  python tools/make_endpaper.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 640, 960
rng = np.random.default_rng(1908)

def value_noise(w, h, cell):
    gw, gh = w // cell + 2, h // cell + 2
    grid = rng.random((gh, gw))
    ys, xs = np.mgrid[0:h, 0:w] / cell
    x0, y0 = xs.astype(int), ys.astype(int)
    fx, fy = xs - x0, ys - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = grid[y0, x0], grid[y0, x0 + 1]
    c, d = grid[y0 + 1, x0], grid[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

def fbm(w, h, base, octaves=5):
    out, amp, total = np.zeros((h, w)), 1.0, 0.0
    for o in range(octaves):
        out += amp * value_noise(w, h, max(2, base >> o))
        total += amp; amp *= 0.5
    return out / total

def stretched(base):
    # רעש שנמתח לגובה — הזרמים בנייר שיש ארוכים ואנכיים
    small = fbm(W, H // 3, base)
    return np.asarray(Image.fromarray((small * 255).astype(np.float32), mode="F").resize((W, H), Image.BICUBIC)) / 255

ys, xs = np.mgrid[0:H, 0:W].astype(float)
# עיוות כפול של המרחב — זה מה שיוצר את הזרימה של נייר שיש
q1, q2 = stretched(90), stretched(70)
r1 = stretched(64) + 1.6 * q1
r2 = stretched(48) + 1.6 * q2
phase = xs * 0.075 + 7.0 * r1 + 3.0 * r2
veins = np.sin(phase)
t = (veins + 1) / 2 * 0.8 + stretched(30) * 0.2

# צבעים: חום כהה, בורדו, אוקר, כחול-אפרפר, קרם — מתאים לפליז ולנייר הישן
stops = np.array([0.0, 0.22, 0.42, 0.55, 0.7, 0.86, 1.0])
cols = np.array([
    [52, 30, 22], [112, 46, 34], [168, 112, 58], [214, 190, 140],
    [74, 88, 100], [126, 72, 40], [40, 28, 22],
], float)
rgb = np.stack([np.interp(t, stops, cols[:, k]) for k in range(3)], axis=-1)

# קווים דקים כהים בין הצבעים (כמו "עורקים" בשיש)
edge = np.abs(np.sin(phase * 2))
rgb *= (0.7 + 0.3 * np.clip(edge * 5, 0, 1))[..., None]

# הזדקנות: הנייר דהה ומצהיב, קצת כהה בשוליים
yellow = np.array([196, 160, 104], float)
rgb = rgb * 0.82 + yellow * 0.18
vig = 1 - 0.28 * (((xs / W - .5) ** 2 + (ys / H - .5) ** 2) * 2.2)
rgb *= vig[..., None]

img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
img.save(os.path.join(ROOT, "images", "endpaper.jpg"), quality=84, optimize=True)
print("saved images/endpaper.jpg")
