(() => {
  const cfg = BOOK_CONFIG;
  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;

  $("#site-title").textContent = cfg.title;
  document.title = cfg.title;

  // ---------- מידות לפי גודל המסך ----------
  function fitSize() {
    const arrows = innerWidth < 600 ? 80 : 130;
    const availW = Math.min(innerWidth, 1300) - 32 - arrows;
    const availH = innerHeight - 270;
    const pw = Math.max(110, Math.min(360, availW / 2, availH / 1.5));
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
  const book = $("#book");
  const pages = cfg.pages.slice();
  if (pages.length % 2) pages.push({ text: "", blank: true });

  // כל דף (leaf) = צד קדמי + צד אחורי
  const leafDefs = [
    [{ kind: "cover-front" }, { kind: "inside", src: cfg.insideFront }],
  ];
  for (let i = 0; i < pages.length; i += 2) {
    leafDefs.push([{ kind: "page", page: pages[i], num: i + 1 }, { kind: "page", page: pages[i + 1], num: i + 2 }]);
  }
  leafDefs.push([{ kind: "inside", src: cfg.insideBack }, { kind: "cover-back" }]);

  function buildFace(def, side) {
    const el = document.createElement("div");
    el.className = `page-face ${side}`;
    if (def.kind === "cover-front") {
      el.classList.add("cover-face", "leather");
      el.innerHTML = coverArt();
      applyImage(el, cfg.outside.front);
    } else if (def.kind === "cover-back") {
      el.classList.add("cover-face", "leather");
      applyImage(el, cfg.outside.back);
    } else if (def.kind === "inside") {
      el.classList.add("cover-face", "inside-cover");
      applyImage(el, def.src);
    } else {
      el.classList.add("paper");
      const text = document.createElement("div");
      text.className = "page-text";
      text.textContent = def.page.text || "";
      el.appendChild(text);
      const num = document.createElement("div");
      num.className = "page-num";
      num.textContent = def.page.text ? def.num : "";
      el.appendChild(num);
      applyImage(el, def.page.image);
    }
    return el;
  }

  const leaves = leafDefs.map(([front, back]) => {
    const leaf = document.createElement("div");
    leaf.className = "leaf";
    leaf.appendChild(buildFace(front, "front"));
    leaf.appendChild(buildFace(back, "back"));
    book.appendChild(leaf);
    return leaf;
  });

  const n = leaves.length;
  let current = 0; // כמה דפים כבר הופכו

  function render() {
    leaves.forEach((leaf, i) => {
      const flipped = i < current;
      const z = (flipped ? i : n - i) * 0.5;
      leaf.style.transform = `translateZ(${z}px) rotateY(${flipped ? 180 : 0}deg)`;
    });
    book.classList.toggle("closed-start", current === 0);
    book.classList.toggle("closed-end", current === n);
    $("#prev").disabled = current === 0;
    $("#next").disabled = current === n;

    let label;
    if (current === 0) label = "הכריכה הקדמית · לחצו כדי לפתוח";
    else if (current === n) label = "הכריכה האחורית";
    else if (current === 1) label = "עמוד 1";
    else if (current === n - 1) label = `עמוד ${pages.length}`;
    else label = `עמודים ${(current - 1) * 2} ו־${(current - 1) * 2 + 1}`;
    $("#page-indicator").textContent = `${label}  ·  מתוך ${cfg.pages.length} עמודים`;
  }

  const next = () => { if (current < n) { current++; render(); } };
  const prev = () => { if (current > 0) { current--; render(); } };

  $("#next").addEventListener("click", next);
  $("#prev").addEventListener("click", prev);

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
    if (!$("#view-inside").classList.contains("active")) return;
    if (e.key === "ArrowLeft") next();
    if (e.key === "ArrowRight") prev();
  });

  render();
})();
