# שכונה 360°

כלי הערכה לתכנון שכונות לפי 44 מדדי ILGBC, עבור עיריית אשדוד. גרסה 2.0 נבנתה מחדש ב-Claude Code מתוך אב הטיפוס ב-Lovable
(פרויקט `22d5863f-908d-46cd-bc9b-cc271973a302`). תוכן המדדים הועבר כלשונו ל-`src/data/chapters.ts`.

## בעלות ולוגו
- האפליקציה שייכת לעיריית אשדוד. בסרגל העליון: `<ai-menu brand="ashdod">` (לוגו העירייה), לפי תקן
  github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-menu-standard.md
- כל פעולות העריכה והפיתוח רק בתוך כפתור הלוגו, דרך `usePageMenu` ב-`src/components/TopBar.tsx`.

## סטאק
Vite 8, React 19, TypeScript 7, motion 14, supabase-js 2. CSS ידני ב-`src/styles.css` (בלי Tailwind), טוקנים עם `light-dark()`.
ניתוב עצמי על History API עם View Transitions (`src/lib/router.ts`). כל מצב שאפשר לשתף נמצא בכתובת: `/a/:id?tab=1|2|3|dash|report&m=13`.

## Supabase
- פרויקט ASHDODMAP (`cbhexpybdggwzyakgagd`), משותף לאפליקציות העירייה. כל אובייקט של האפליקציה בקידומת `shchuna_`.
- טבלאות: `shchuna_assessments`, `shchuna_versions`, `shchuna_editor_keys`. רבעים מתוך `quarters` (קריאה ציבורית).
- קריאה ציבורית רק להערכות `status='published'`. כל כתיבה דרך RPC `shchuna_save` / `shchuna_remove` עם מפתח עורך
  (hash SHA-256 בטבלת המפתחות), ובכל שמירה נוצרת גרסה ב-`shchuna_versions`.
- קישור עורך: `/?key=...` (המפתח נשמר בדפדפן ונמחק מהכתובת). מפתח חדש: הכנסת hash לטבלת `shchuna_editor_keys`.
- הערכות נשמרות קודם בדפדפן (local-first), ומסתנכרנות לשרת רק כשיש עורך.

## אמת המידה (מגרסה 3.0)
- המקור: "שכונה 360°: מדדים לתכנון ולפיתוח עירוני, גרסה 2.0, ינואר 2025" (המועצה הישראלית לבנייה ירוקה ומשרד הבינוי).
  החילוץ: `docs/official-v2.json` (מבוא בלשון המקור, תמצית דרישות, שלב ג׳, תנאי זכאות, עמוד). `node scripts/official.mjs`
  מייצר ממנו את `src/data/official.ts` ואת טבלת המחוון ב-`docs/measurement-rubric.md`. לא לערוך אותם ידנית.
- הניקוד המרבי ב-`src/data/chapters.ts` לפי טבלת הסיכום של 2.0, חוץ ממדד 41 = 3 (לפי פרק המדד), וכך הסך 120.
- כל המדדים חלים בכל שלב (כך במסמך). אין סינון לפי שלב. מדד שאינו חל על הפרויקט: `na` בהערכה ("לא רלוונטי לפרויקט").
- דרגות: ארד 55, כסף 65, זהב 75, פלטינום 85 נקודות מתוך 120 (מגרסה 1.2; 2.0 לא מפרסמת דרגות).
- ניקודים מלפני 3.0 (סולם אב הטיפוס) הומרו יחסית: `src/data/scale.ts`. בהערכות מקומיות ההמרה רצה פעם אחת (מפתח v2 ל-v3),
  במדידות התוכניות מסומן `converted: true` עד מדידה מחדש.
- האפליקציה השנייה "שכונה 360" ב-Lovable (pro-metrics-vue) אוחדה לכאן: ממנה נלקחו המבנה, הניקוד והעמודים של גרסה 2.0.
  נוסחי ההנחיות שבה לא נלקחו, כי רובם לא מהמסמך הרשמי.

## חישוב
- "מסלול ליעד": נקודה אחר נקודה למדד עם האחוז הנמוך ביותר. ההנחה כתובה בממשק ובדף השיטה.
- התובנות במדדים לא אומתו מול המקורות, ומסומנות "טרם אומתה".

## תוכניות בעיר (חיבור ל"מה נבנה סביבי")
- המקור: `plan_projects`, `plan_models`, `plan_media` באותו פרויקט ASHDODMAP (אפליקציה `ashdod-ma-nivne.vercel.app`, דף תוכנית `/p/:id`).
- המדידות: `shchuna_plan_scores` (מפתח `plan_project_id`), קריאה ציבורית, כתיבה דרך RPC `shchuna_save_plan_score` עם מפתח עורך.
- המחוון: `docs/measurement-rubric.md`. לפני כל build הוא נכתב ל-`public/measure-config.json`, והפונקציה `shchuna-measure`
  קוראת אותו בזמן ריצה. שינוי במחוון בריפו משנה גם את המדידה האוטומטית.
- מדידה אוטומטית: `supabase/functions/shchuna-measure`. דורשת סוד `ANTHROPIC_API_KEY` בפרויקט ASHDODMAP; בלעדיו GET מחזיר `ready:false`
  והדף מציג "ממתינה".
- כלל: ציון null = "לא ניתן למדוד", לא אפס. לצד כל ציון מוצג כיסוי.
- יומן ריצות: `shchuna_measure_runs` (running / done / error עם הסיבה), נכתב דרך RPC `shchuna_measure_log`. אין כישלון שקט.
- סכמת הפלט ל-Claude: מערך אחד של פריטים זהים, בלי שדות nullable (מגבלה: 16 שדות union, וגם גודל דקדוק).
  "לא ניתן למדוד" = score -1 ומחרוזות ריקות, והפונקציה ממירה ל-null. נשלחים עד 3 מסמכים: הוראות, נספח חברתי, נספח בינוי.
  קובץ שאינו PDF (למשל index.html כשהקובץ עוד לא נפרס) לא נשלח.
- בדיקת הסכמה (תמל/2022): 29 מתוך 35 זהים, 35 מתוך 35 בהפרש עד נקודה. לחזור עליה אחרי כל שינוי במחוון או בפונקציה.

## עדכונים
- `public/sw.js` מקבל חותמת build בכל בנייה; גרסה חדשה מציגה "עדכון עכשיו". כל שינוי מהותי: להוסיף רשומה ל-`CHANGES`
  ב-`src/pages/Updates.tsx` ולהעלות `version` ב-package.json.

## פריסה
- Vercel: פרויקט `shchuna360` (`prj_bxwAv2gfTzHIvQAm766h0euXtBd9`), מחובר ל-GitHub. כל מיזוג ל-main פורס לייצור.
- הגנת Vercel Authentication כבויה, כדי שהאתר יהיה ציבורי. `vercel.json` מפנה כל נתיב ל-index.html.

## בדיקה
```bash
npm run build && npx vite preview --port 4173 & npm test && npm run e2e
```
`tests/e2e.mjs` מריץ Playwright עם מוקים לכל קריאות Supabase, כולל בדיקת לוגו העירייה, התקנה, ובלי גלילה אופקית בנייד.

## תיקונים של ענת
(כל תיקון נרשם כאן ומיושם מאותו רגע.)
- 30.10.2026: כל פעולה מחקרית, השוואתית או אבולוציונית מסתיימת בכלל תכנון שנלמד. היומן המשותף נמצא ב-HITCHADSHUT, בקובץ `docs/planning-insights.md`.
