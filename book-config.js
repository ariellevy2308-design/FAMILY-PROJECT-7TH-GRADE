// ============================================================
//  הגדרות הספר — כאן מחליפים תמונות, עמודים ואת "דבר היוצר"
// ============================================================
//  כל תמונה שמים בתיקייה images/ ורושמים כאן את שם הקובץ.
//  אם תמונה לא קיימת (null) — האתר מציג עיצוב זמני במקומה.
// ============================================================

const BOOK_CONFIG = {
  title: "ספר התנ״ך של סבא שלי",

  // תמונות החוץ של הספר (לתצוגת ה-3D)
  outside: {
    front: "images/cover-front.jpg",
    back: "images/cover-back.jpg",
    spine: "images/spine.jpg",
    edgeSide: "images/edge-v.jpg",   // צד הדפים
    edgeTop: "images/edge-h.jpg",    // הדפים מלמעלה ומלמטה
  },

  // הכריכה מבפנים
  insideFront: "images/inside-front.jpg",
  insideBack: "images/inside-back.jpg",

  // עמודי הספר לפי הסדר (ספר עברי: ימין ואז שמאל).
  // { image: "images/page-01.jpg" }   או   { text: "..." }
  pages: [
    { image: "images/page-01.jpg" },
    { image: "images/page-02.jpg" },
    { image: "images/page-03.jpg" },
    { image: "images/page-04.jpg" },
    { image: "images/page-05.jpg" },
    { image: "images/page-06.jpg" },
    { image: "images/page-07.jpg" },
    { image: "images/page-08.jpg" },
    { image: "images/page-09.jpg" },
    { image: "images/page-10.jpg" },
    { image: "images/page-11.jpg" },
    { image: "images/page-12.jpg" },
    { image: "images/page-13.jpg" },
  ],

  // הטקסט של "דבר היוצר" — כל שורה ריקה = פסקה חדשה
  creatorNote: `
כאן יופיע "דבר היוצר".

הטקסט יתווסף בהמשך הפרויקט.
  `,
  creatorName: "", // שם היוצר / היוצרת
};
