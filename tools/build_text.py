"""
מוריד את טקסט התנ"ך מ-Sefaria ומחלק אותו לעמודים.
הרצה:  python tools/build_text.py
התוצאה נשמרת בתיקייה data/ (קובץ לכל ספר + manifest.json).

מקור הטקסט: "מקרא על פי המסורה" (Miqra according to the Masorah), רישיון CC-BY-SA, דרך Sefaria.
"""
import json, os, re, sys, urllib.request, urllib.parse, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", "cache")
OUT = os.path.join(ROOT, "data")

# כמה טקסט נכנס בעמוד — מכויל מול הגופן באתר (ראו style.css: .gen-page)
CPL = 35      # תווים בשורה
LPP = 18.3    # שורות בעמוד
TITLE_LINES = 4.2
CHAPTER_LINES = 1.7

BOOKS = [
    ("Genesis", "בראשית"), ("Exodus", "שמות"), ("Leviticus", "ויקרא"), ("Numbers", "במדבר"), ("Deuteronomy", "דברים"),
    ("Joshua", "יהושע"), ("Judges", "שופטים"), ("I Samuel", "שמואל א"), ("II Samuel", "שמואל ב"),
    ("I Kings", "מלכים א"), ("II Kings", "מלכים ב"), ("Isaiah", "ישעיהו"), ("Jeremiah", "ירמיהו"), ("Ezekiel", "יחזקאל"),
    ("Hosea", "הושע"), ("Joel", "יואל"), ("Amos", "עמוס"), ("Obadiah", "עובדיה"), ("Jonah", "יונה"), ("Micah", "מיכה"),
    ("Nahum", "נחום"), ("Habakkuk", "חבקוק"), ("Zephaniah", "צפניה"), ("Haggai", "חגי"), ("Zechariah", "זכריה"), ("Malachi", "מלאכי"),
    ("Psalms", "תהלים"), ("Proverbs", "משלי"), ("Job", "איוב"), ("Song of Songs", "שיר השירים"), ("Ruth", "רות"),
    ("Lamentations", "איכה"), ("Ecclesiastes", "קהלת"), ("Esther", "אסתר"), ("Daniel", "דניאל"), ("Ezra", "עזרא"),
    ("Nehemiah", "נחמיה"), ("I Chronicles", "דברי הימים א"), ("II Chronicles", "דברי הימים ב"),
]

def heb_num(n):
    ones = "אבגדהוזחט"; tens = "יכלמנסעפצ"; hundreds = "קרשת"
    s = ""
    while n >= 400: s += "ת"; n -= 400
    if n >= 100: s += hundreds[n // 100 - 1]; n %= 100
    if n == 15: return s + "טו"
    if n == 16: return s + "טז"
    if n >= 10: s += tens[n // 10 - 1]; n %= 10
    if n: s += ones[n - 1]
    return s

def fetch(name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name.replace(" ", "_") + ".json")
    if not os.path.exists(path):
        url = "https://www.sefaria.org/api/v3/texts/" + urllib.parse.quote(name) + "?version=hebrew&return_format=text_only"
        print("downloading", name, file=sys.stderr)
        with urllib.request.urlopen(url, timeout=60) as r:
            data = json.load(r)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data["versions"][0]["text"], f, ensure_ascii=False)
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def clean(t):
    t = html.unescape(re.sub(r"<[^>]+>", "", t))
    t = re.sub(r"\{[^}]*\}", " ", t)                 # סימני פרשה פתוחה/סתומה
    t = re.sub(r"[֑-ֽ֯׀͏‍‌]", "", t)  # טעמים, מתג, פסק
    t = t.replace("ׇ", "ָ")                # קמץ קטן -> קמץ (תמיכת גופן)
    t = t.replace("׃", ":")                     # סוף פסוק
    return re.sub(r"\s+", " ", t).strip()

def base_len(t):
    return len(re.sub(r"[֑-ׇ]", "", t))

def paginate():
    os.makedirs(OUT, exist_ok=True)
    manifest = {"source": "Miqra according to the Masorah (CC-BY-SA), via Sefaria", "books": []}
    page_no = 1  # עמוד 1 = עמוד השער (נוצר באתר)
    for idx, (en, he) in enumerate(BOOKS):
        chapters = fetch(en)
        pages, items, used = [], [], 0.0

        def flush():
            nonlocal items, used
            pages.append(items); items, used = [], 0.0

        def need(lines):
            nonlocal used
            if used + lines > LPP and items: flush()
            used += lines

        need(TITLE_LINES); items.append(["t", he])
        for ci, ch in enumerate(chapters, 1):
            if not ch: continue
            if LPP - used < CHAPTER_LINES + 1.5 and items: flush()
            need(CHAPTER_LINES); items.append(["c", heb_num(ci)])
            used = float(int(used + 0.999))  # פרק מתחיל בשורה חדשה
            for vi, v in enumerate(ch, 1):
                words = clean(v).split(" ")
                label = heb_num(vi)
                cur = []
                cost_so_far = (len(label) + 2) / CPL
                for w in words:
                    c = (base_len(w) + 1) / CPL
                    if used + cost_so_far + c > LPP:
                        if cur:
                            items.append(["v", label, " ".join(cur)] if label else ["x", " ".join(cur)])
                            label = ""
                        flush(); cur = []; cost_so_far = 0.0
                    cur.append(w); cost_so_far += c
                if cur:
                    items.append(["v", label, " ".join(cur)] if label else ["x", " ".join(cur)])
                used += cost_so_far
        if items: flush()
        fname = f"{idx + 1:02d}.json"
        with open(os.path.join(OUT, fname), "w", encoding="utf-8") as f:
            json.dump(pages, f, ensure_ascii=False, separators=(",", ":"))
        manifest["books"].append({"he": he, "file": fname, "start": page_no + 1, "count": len(pages)})
        page_no += len(pages)
    manifest["pages"] = page_no
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print("total pages:", page_no)

if __name__ == "__main__":
    paginate()
