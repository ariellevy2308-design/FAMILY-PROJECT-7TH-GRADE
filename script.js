(() => {
  const cfg = BOOK_CONFIG;
  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;

  $("#site-title").textContent = cfg.title;
  document.title = cfg.title;

  // ---------- מידות לפי גודל המסך ----------
  function fitSize() {
    const vw = document.documentElement.clientWidth;
    const mobile = vw < 600;
    const availW = Math.min(vw, 1300) - (mobile ? 24 : 32 + 130);
    const availH = innerHeight - 290;
    // ההטיה בתלת־ממד מרחיבה את החלק התחתון של הספר — משאירים לזה מקום
    const pw = Math.max(90, Math.min(360, availW / (mobile ? 2.3 : 2.12), availH / 1.6));
    root.style.setProperty("--pw", pw + "px");
    root.style.setProperty("--ph", pw * 1.5 + "px");
    root.style.setProperty("--th", Math.max(26, pw * 0.3) + "px");
  }
  fitSize();
  addEventListener("resize", fitSize);

  // טוען תמונה רק אם הקובץ באמת קיים — אחרת נשאר העיצוב הזמני
  function applyImage(el, src) {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url("${src}")`;
      el.classList.add("has-image");
    };
    img.src = src;
  }

  const coverArt = () => `
    <div class="cover-art">
      <div class="small">תורה · נביאים · כתובים</div>
      <div class="ornament"></div>
      <div class="big">תנ״ך</div>
      <div class="ornament"></div>
    </div>`;

  // ---------- הספר הסגור ב-3D ----------
  const box = $("#box");
  const faces = {
    front: box.querySelector(".front"),
    back: box.querySelector(".back"),
    spine: box.querySelector(".spine"),
    edge: box.querySelector(".fore-edge"),
    top: box.querySelector(".top"),
    bottom: box.querySelector(".bottom"),
  };
  faces.front.classList.add("leather");
  faces.front.innerHTML = coverArt();
  faces.back.classList.add("leather");
  faces.spine.classList.add("leather");
  faces.spine.innerHTML = `<div class="spine-title">תנ״ך</div>`;
  [faces.edge, faces.top, faces.bottom].forEach((f) => f.classList.add("pages-edge"));
  applyImage(faces.front, cfg.outside.front);
  applyImage(faces.back, cfg.outside.back);
  applyImage(faces.spine, cfg.outside.spine);
  applyImage(faces.edge, cfg.outside.edgeSide);
  applyImage(faces.top, cfg.outside.edgeTop);
  applyImage(faces.bottom, cfg.outside.edgeTop);

  let rotX = -12, rotY = -28, dragging = false, moved = 0, lastX = 0, lastY = 0, idleSince = performance.now();
  const scene = $("#scene");

  scene.addEventListener("pointerdown", (e) => {
    dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
    scene.setPointerCapture(e.pointerId);
    scene.classList.add("dragging");
  });
  scene.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    rotY += dx * 0.5;
    rotX = Math.max(-60, Math.min(60, rotX - dy * 0.4));
    lastX = e.clientX; lastY = e.clientY;
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    scene.classList.remove("dragging");
    idleSince = performance.now();
    if (moved < 6) openBook();
  };
  scene.addEventListener("pointerup", endDrag);
  scene.addEventListener("pointercancel", () => { dragging = false; scene.classList.remove("dragging"); });

  // כשלא נוגעים — הספר מסתובב לאט מעצמו
  function animateBox(t) {
    if (!dragging && t - idleSince > 1500) {
      rotY += 0.18;
      rotX += (-12 + Math.sin(t / 1800) * 6 - rotX) * 0.02;
    }
    box.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    requestAnimationFrame(animateBox);
  }
  requestAnimationFrame(animateBox);

  // ---------- הספר הפתוח ----------
  // העמודים נוצרים בקוד (נייר ישן + טקסט התנ"ך), ורק הדפים שליד העמוד הנוכחי
  // קיימים בדף בכל רגע — כך גם ספר של אלפי עמודים נשאר מהיר.
  const book = $("#book");
  const stackL = $("#stack-left");
  const stackR = $("#stack-right");
  const bookSelect = $("#book-select");

  let manifest = { pages: 1, books: [] };
  let totalPages = 2;          // כולל עמוד השער, תמיד זוגי
  let n = 3;                   // מספר הדפים (leaves) כולל שתי הכריכות
  let current = 0;             // כמה דפים כבר הופכו
  const leafEls = new Map();
  const bookCache = new Map();
  const WINDOW = 3;

  const ones = "אבגדהוזחט", tens = "יכלמנסעפצ", hundreds = "קרשת";
  function hebNum(num) {
    let s = "";
    if (num >= 1000) { s = hebNum(Math.floor(num / 1000)) + "׳"; num %= 1000; }
    while (num >= 400) { s += "ת"; num -= 400; }
    if (num >= 100) { s += hundreds[Math.floor(num / 100) - 1]; num %= 100; }
    if (num === 15) return s + "טו";
    if (num === 16) return s + "טז";
    if (num >= 10) { s += tens[Math.floor(num / 10) - 1]; num %= 10; }
    if (num) s += ones[num - 1];
    return s;
  }

  // מספר אקראי קבוע לכל עמוד — כדי שהכתמים יהיו תמיד באותו מקום
  function rand(seed) {
    let t = seed * 2654435761 >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function agedPaper(el, pageNo) {
    const r = rand(pageNo + 7);
    const layers = [];
    const stains = 3 + Math.floor(r() * 4);
    for (let i = 0; i < stains; i++) {
      const x = Math.round(r() * 100), y = Math.round(r() * 100);
      const s = Math.round(7 + r() * 26), a = (0.07 + r() * 0.17).toFixed(2);
      layers.push(`radial-gradient(circle at ${x}% ${y}%, rgba(150,95,30,${a}) 0, rgba(150,95,30,${(a / 2).toFixed(2)}) ${s * 0.6}%, transparent ${s}%)`);
    }
    for (let i = 0; i < 6; i++) { // נקודות "פוקסינג" קטנות
      const x = Math.round(r() * 100), y = Math.round(r() * 100);
      layers.push(`radial-gradient(circle at ${x}% ${y}%, rgba(130,80,30,.22) 0, transparent ${(0.6 + r()).toFixed(1)}%)`);
    }
    el.style.backgroundImage = layers.join(",") + ", var(--paper-base)";
  }

  function bookForPage(p) {
    return manifest.books.find((b) => p >= b.start && p < b.start + b.count);
  }
  function loadBook(b) {
    if (!bookCache.has(b.file)) {
      bookCache.set(b.file, fetch("data/" + b.file).then((r) => r.json()));
    }
    return bookCache.get(b.file);
  }

  function fillPage(el, p) {
    agedPaper(el, p);
    el.classList.add("gen-page");
    const head = document.createElement("div");
    head.className = "run-head";
    const body = document.createElement("div");
    body.className = "page-body";
    el.append(head, body);

    if (p === 1) { // עמוד השער
      el.classList.add("title-page");
      body.innerHTML = `
        <div class="tp-frame">
          <div class="tp-small">סֵפֶר</div>
          <div class="tp-big">תּוֹרָה<br>נְבִיאִים<br>וּכְתוּבִים</div>
          <div class="orn"></div>
          <div class="tp-small">מְדֻיָּק הֵיטֵב</div>
        </div>`;
      return;
    }
    const b = bookForPage(p);
    if (!b) return; // עמוד ריק בסוף
    head.innerHTML = `<span class="pnum">${hebNum(p)}</span><span class="rh">${b.he}</span>`;
    loadBook(b).then((pages) => {
      const items = pages[p - b.start] || [];
      let html = "", open = false;
      const openP = () => { if (!open) { html += "<p>"; open = true; } };
      const closeP = () => { if (open) { html += "</p>"; open = false; } };
      for (const it of items) {
        if (it[0] === "t") { closeP(); html += `<div class="book-title"><div class="orn"></div><h3>סֵפֶר ${it[1]}</h3><div class="orn"></div></div>`; }
        else if (it[0] === "c") { closeP(); html += `<div class="chap">פרק ${it[1]}</div>`; }
        else if (it[0] === "v") { openP(); html += `<span class="vn">${it[1]}</span>${it[2]} `; }
        else { openP(); html += `${it[1]} `; }
      }
      closeP();
      body.innerHTML = html;
    });
  }

  function buildFace(i, side) {
    const el = document.createElement("div");
    el.className = `page-face ${side}`;
    if (i === 0 && side === "front") { el.classList.add("cover-face", "leather"); el.innerHTML = coverArt(); applyImage(el, cfg.outside.front); }
    else if (i === 0) { el.classList.add("cover-face", "inside-cover"); applyImage(el, cfg.insideFront); }
    else if (i === n - 1 && side === "front") { el.classList.add("cover-face", "inside-cover"); applyImage(el, cfg.insideBack); }
    else if (i === n - 1) { el.classList.add("cover-face", "leather"); applyImage(el, cfg.outside.back); }
    else fillPage(el, side === "front" ? 2 * i - 1 : 2 * i);
    return el;
  }

  function leafTransform(i) {
    const flipped = i < current;
    let z;
    if (i === 0 || i === n - 1) z = 0;
    else z = Math.max(1, 12 - (flipped ? current - 1 - i : i - current)) * 0.6;
    return `translateZ(${z}px) rotateY(${flipped ? 180 : 0}deg)`;
  }

  function createLeaf(i) {
    const leaf = document.createElement("div");
    leaf.className = "leaf" + (i === 0 || i === n - 1 ? " cover" : "");
    leaf.append(buildFace(i, "front"), buildFace(i, "back"));
    leaf.style.transition = "none";
    leaf.style.transform = leafTransform(i);
    book.appendChild(leaf);
    leaf.getBoundingClientRect();
    leaf.style.transition = "";
    leafEls.set(i, leaf);
  }

  function setStack(el, count, dir) {
    const T = Math.round(Math.min(1, count / Math.max(1, n - 2)) * 14);
    const sh = [];
    for (let j = 1; j <= T; j++) sh.push(`${dir * j * 0.45}px ${j * 0.55}px 0 ${j % 2 ? "#e6d6b4" : "#bfa77b"}`);
    if (T) sh.push(`${dir * T * 0.45 + dir * 2}px ${T * 0.55 + 4}px 8px rgba(0,0,0,.35)`);
    el.style.boxShadow = sh.join(",") || "none";
    el.style.visibility = count > 0 && current > 0 && current < n ? "visible" : "hidden";
  }

  function render() {
    const want = new Set([0, n - 1]);
    for (let i = current - WINDOW; i <= current + WINDOW; i++) if (i > 0 && i < n - 1) want.add(i);
    want.forEach((i) => { if (!leafEls.has(i)) createLeaf(i); });
    leafEls.forEach((leaf, i) => {
      leaf.style.transform = leafTransform(i);
      if (!want.has(i)) {
        leafEls.delete(i);
        setTimeout(() => leaf.remove(), 1100); // אחרי שהאנימציה נגמרת
      }
    });

    setStack(stackL, n - 1 - Math.max(current, 1), -1);
    setStack(stackR, Math.min(current - 1, n - 2), 1);

    book.classList.toggle("closed-start", current === 0);
    book.classList.toggle("closed-end", current === n);
    $("#prev").disabled = current === 0;
    $("#next").disabled = current === n;

    let label;
    if (current === 0) label = "הכריכה הקדמית · לחצו כדי לפתוח";
    else if (current === n) label = "הכריכה האחורית";
    else if (current === 1) label = "עמוד השער";
    else {
      const r = 2 * (current - 1), l = r + 1;
      const b = bookForPage(r) || bookForPage(l);
      label = `עמודים ${r}–${l} מתוך ${totalPages}` + (b ? ` · ${b.he}` : "");
      if (b && bookSelect.value !== b.file) bookSelect.value = b.file;
    }
    $("#page-indicator").textContent = label;
  }

  function jumpTo(leaf) {
    leafEls.forEach((el) => el.remove());
    leafEls.clear();
    current = Math.max(0, Math.min(n, leaf));
    render();
  }

  const next = () => { if (current < n) { current++; render(); } };
  const prev = () => { if (current > 0) { current--; render(); } };

  $("#next").addEventListener("click", next);
  $("#prev").addEventListener("click", prev);
  bookSelect.addEventListener("change", () => {
    const b = manifest.books.find((x) => x.file === bookSelect.value);
    if (b) jumpTo(Math.floor(b.start / 2) + 1);
    bookSelect.blur(); // כדי שהחיצים במקלדת ידפדפו ולא יחליפו ספר
  });

  // לחיצה על הצד השמאלי = קדימה, הצד הימני = אחורה (כמו בספר עברי). אפשר גם להחליק.
  let startX = null;
  book.addEventListener("pointerdown", (e) => { startX = e.clientX; });
  book.addEventListener("pointerup", (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 40) return dx > 0 ? next() : prev();
    if (current === 0) return next();
    if (current === n) return prev();
    const r = book.getBoundingClientRect();
    e.clientX < r.left + r.width / 2 ? next() : prev();
  });

  fetch("data/manifest.json").then((r) => r.json()).then((m) => {
    manifest = m;
    totalPages = m.pages + (m.pages % 2);
    n = totalPages / 2 + 2;
    bookSelect.innerHTML = m.books.map((b) => `<option value="${b.file}">${b.he}</option>`).join("");
    jumpTo(current);
  });

  // ---------- מעבר בין התצוגות ----------
  function showView(name) {
    const inside = name === "inside";
    $("#view-outside").classList.toggle("active", !inside);
    $("#view-inside").classList.toggle("active", inside);
    $("#btn-outside").setAttribute("aria-pressed", String(!inside));
    $("#btn-inside").setAttribute("aria-pressed", String(inside));
  }
  function openBook() {
    showView("inside");
    if (current === 0) setTimeout(next, 650); // אנימציית פתיחת הכריכה
  }
  $("#btn-outside").addEventListener("click", () => showView("outside"));
  $("#btn-inside").addEventListener("click", openBook);

  // ---------- דבר היוצר ----------
  const modal = $("#creator-modal");
  const textBox = $("#creator-text");
  cfg.creatorNote.trim().split(/\n\s*\n/).forEach((para) => {
    const p = document.createElement("p");
    p.textContent = para.trim();
    textBox.appendChild(p);
  });
  $("#creator-name").textContent = cfg.creatorName;

  let lastFocus = null;
  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    modal.querySelector(".modal-close").focus();
  }
  function closeModal() {
    modal.hidden = true;
    lastFocus && lastFocus.focus();
  }
  $("#btn-creator").addEventListener("click", openModal);
  modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));

  addEventListener("keydown", (e) => {
    if (!modal.hidden) { if (e.key === "Escape") closeModal(); return; }
    if (!$("#view-inside").classList.contains("active") || e.target.tagName === "SELECT") return;
    if (e.key === "ArrowLeft") next();
    if (e.key === "ArrowRight") prev();
  });

  render();
})();
