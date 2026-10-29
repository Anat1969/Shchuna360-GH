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

## חישוב
- מדדים שאינם רלוונטיים לשלב לא נספרים במכנה (באב הטיפוס נספרו, וזה היה באג).
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
