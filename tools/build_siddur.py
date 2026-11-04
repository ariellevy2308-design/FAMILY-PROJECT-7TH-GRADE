"""
מוריד את טקסט "סידור נוסח עדות המזרח" מספריא ומחלק אותו לעמודים.
הרצה:  python tools/build_siddur.py
התוצאה נשמרת בתיקייה data/ (קובץ לכל חלק בסידור + manifest.json).

מקור הטקסט: Siddur Edot HaMizrach (Shaliehsaboo Edition), רישיון CC0, דרך ספריא.
"""
import json, os, re, sys, math, html, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", "cache", "siddur")
OUT = os.path.join(ROOT, "data")
BOOK = "Siddur Edot HaMizrach"

# כמה טקסט נכנס בעמוד — מכויל מול הגופן באתר (ראו style.css: .page-body)
CPL = 35            # תווים בשורה
LPP = 18.3          # שורות בעמוד
TITLE_LINES = 4.2   # כותרת של חלק חדש בסידור
HEAD_LINES = 1.7    # כותרת של תפילה
INSTR_SCALE = 0.78  # הוראות ("אומרים...") באותיות קטנות

def get_json(url, cache_name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, re.sub(r"[^\w.-]+", "_", cache_name) + ".json")
    if not os.path.exists(path):
        print("downloading", cache_name, file=sys.stderr)
        with urllib.request.urlopen(url, timeout=60) as r:
            data = json.load(r)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    with open(path, encoding="utf-8") as f:
        return json.load(f)

def leaves():
    """כל התפילות לפי הסדר: (כותרת החלק, שם התפילה, ref)"""
    index = get_json("https://www.sefaria.org/api/v2/index/" + urllib.parse.quote(BOOK.replace(" ", "_")), "index")
    out = []
    def walk(node, path, section):
        title = node.get("title") if node.get("key") != "default" else None
        p = path + [title] if title else path
        if node.get("nodes"):
            for c in node["nodes"]:
                walk(c, p, section or node.get("heTitle"))
        else:
            out.append((section or node.get("heTitle"), node.get("heTitle"), ", ".join([BOOK] + p)))
    for top in index["schema"]["nodes"]:
        walk(top, [], None)
    return out

def fetch_text(ref):
    url = "https://www.sefaria.org/api/v3/texts/" + urllib.parse.quote(ref) + "?version=hebrew&return_format=text_only"
    data = get_json(url, ref)
    return data["versions"][0]["text"] if data.get("versions") else []

def flatten(t):
    if isinstance(t, str):
        yield t
    else:
        for x in t:
            yield from flatten(x)

def clean(t):
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    t = re.sub(r"\{[^}]*\}", " ", t)
    t = re.sub(r"[֑-ֽ֯׀͏‍‌]", "", t)  # טעמים, מתג, פסק
    t = t.replace("ׇ", "ָ").replace("׃", ":")
    return re.sub(r"\s+", " ", t).strip()

def base_len(t):
    return len(re.sub(r"[֑-ׇ]", "", t))

def is_instruction(t):
    # הוראה = טקסט בלי ניקוד (בסידור הן מודפסות באותיות קטנות)
    return not re.search(r"[ְ-ּ]", t) and base_len(t) < 400

def paginate():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith(".json"):
            os.remove(os.path.join(OUT, f))

    # מקבצים את התפילות לפי החלקים הראשיים של הסידור (שחרית, ערבית, שבת...)
    sections, order = {}, []
    for sec, name, ref in leaves():
        if sec not in sections:
            sections[sec] = []; order.append(sec)
        sections[sec].append((name, ref))

    manifest = {"source": "Siddur Edot HaMizrach (CC0), via Sefaria", "books": []}
    page_no = 1  # עמוד 1 = עמוד השער (נוצר באתר)
    for idx, sec in enumerate(order):
        pages, items, used, head = [], [], 0.0, sec

        def flush():
            nonlocal items, used
            pages.append({"h": head, "i": items}); items, used = [], 0.0

        def need(lines):
            nonlocal used
            if used + lines > LPP and items: flush()
            used += lines

        need(TITLE_LINES); items.append(["t", sec])
        for name, ref in sections[sec]:
            paras = [clean(p) for p in flatten(fetch_text(ref))]
            paras = [p for p in paras if p]
            # המקור חוזר על שם החלק/התפילה כשורה בתחילת הטקסט — לא צריך, יש כבר כותרת
            titles = {clean(name or ""), clean(sec or "")}
            paras = [p for p in paras if p not in titles]
            if not paras:
                continue
            if name and name != sec:
                if LPP - used < HEAD_LINES + 1.5 and items: flush()
                need(HEAD_LINES); items.append(["c", name])
                head = name
            for para in paras:
                instr = is_instruction(para)
                cpl = CPL / INSTR_SCALE if instr else CPL
                lh = INSTR_SCALE + 0.12 if instr else 1.0
                used = float(math.ceil(used - 1e-6))  # פסקה מתחילה בשורה חדשה
                if used >= LPP: flush()
                if not items: head = name or sec
                kind = "i" if instr else "p"
                cur, cost = [], 0.0
                for w in para.split(" "):
                    c = (base_len(w) + 1) / cpl * lh
                    if used + cost + c > LPP:
                        if cur:
                            items.append([kind, " ".join(cur)])
                            kind = "i" if instr else "x"
                        flush(); head = name or sec; cur, cost = [], 0.0
                    cur.append(w); cost += c
                if cur:
                    items.append([kind, " ".join(cur)])
                used += math.ceil(cost / lh - 1e-6) * lh if instr else cost
        if items: flush()
        fname = f"{idx + 1:02d}.json"
        with open(os.path.join(OUT, fname), "w", encoding="utf-8") as f:
            json.dump(pages, f, ensure_ascii=False, separators=(",", ":"))
        manifest["books"].append({"he": sec, "file": fname, "start": page_no + 1, "count": len(pages)})
        page_no += len(pages)
    manifest["pages"] = page_no
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print("sections:", len(order), "total pages:", page_no)

if __name__ == "__main__":
    paginate()
