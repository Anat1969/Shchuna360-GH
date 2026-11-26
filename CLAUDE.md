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
- מדד 38 (זכויות שמש) נקבע בפונקציה באופן דטרמיניסטי מ-`https://ashdod-ma-nivne.vercel.app/plans/<slug>/sun-metric38.json` (מחושב בריפו HITCHADSHUT, `scripts/shade-metric38.ts`), עם confidence `simulation` ("חישוב בסימולציה"). בלי הקובץ, המודל מודד כרגיל.
- בדיקת הסכמה (תמל/2022): 29 מתוך 35 זהים, 35 מתוך 35 בהפרש עד נקודה. לחזור עליה אחרי כל שינוי במחוון או בפונקציה.
  16.11.2026, אחרי שכבות ה-GIS: 28 מתוך 30 זהים, 29 בהפרש עד נקודה. מדד 14 נמדד לראשונה (1). מדד 18 עלה מ-2 ל-5 (המודל זיכה גם על BRT בהרצל).
  גיבוי המדידות שלפני: `shchuna_plan_scores_backup_20261116`.

## שכבות GIS עירוניות (מגרסה 3.1)
- המקור: קבצי shapefile של העירייה ברשת ישראל (ITM). `scripts/gis/convert.py` ממיר כל שכבה ל-`data/gis/<layer>[-N].json`
  (קואורדינטות ITM בדיוק 10 ס"מ, חלקים של עד 1.5MB). פקודה לכל שכבה בראש הקובץ.
- טעינה: `select shchuna_gis_load('https://raw.githubusercontent.com/Anat1969/Shchuna360-GH/<sha>/data/gis/<file>.json')` דרך כלי ה-SQL.
  חלק 1 מחליף את השכבה. רשומת השכבה (כותרת, קובץ מקור, תאריך) ב-`shchuna_gis_layers`. שכבה חדשה: שורה שם, המרה, טעינה.
- טבלאות: `shchuna_gis_layers`, `shchuna_gis_features` (props jsonb, geom 2039). קריאה ציבורית. התצוגה `shchuna_gis_walk` היא רשת ההליכה
  (בלי מידרג 8 ו-9 ובלי "חניה ..."). מידרג לפי השמות (הערכה): 1 עורקי, 2 מאסף, 3 מקומי, 8 בין-עירוני, 9 מעבר חניה, 10 מדרחוב.
- עשר שכבות (16.11.2026): bus_stops, streets, street_widths, gushim, parcels, lots (ייעודים), sidewalks (סקר 2021, חלקי),
  light_poles, traffic_lights, rova. השכבות משותפות ל"הרחובות הטובים" (NiceStreets-GH, `street_profile` ומנוע הבדיקה 0.2).
- שכבת `bike_paths` (24.11.2026): שבילי אופניים מ-`bike_road.shp`, 139 קטעים. נטענה ב-SQL מ-`data/bike-paths.geojson` של NiceStreets-GH
  (WGS84, הומר חזרה ל-ITM). מוקד 106 לא נכנס לכאן: הקובץ כולל פרטים אישיים, והספירות לפי רחוב ב-`moked106_street_counts` (צוות בלבד).
- קטלוג חי של כל השכבות: `select * from shchuna_gis_layers`. משתמשים: שכונה 360, הרחובות הטובים. "רחוב טוב במספרים" עוד מחשב מ-OSM (`rn_osm`).
- שכבת `buildings` (16.11.2026): טביעות OSM עם קומות לפי מקור (shimur, osm, estimate, unknown) ו-`floors_basis`.
  `supabase/migrations/20261117a_shchuna_gis_buildings.sql`, מריצים בשלבים. כלל: כל עובדה עירונית נשמרת עם המקור שלה,
  ומקור אמין יותר מחליף הערכה. שכבת מבנים עירונית תיכנס כמקור עליון.
- תדירות אוטובוסים (18.11.2026): לוח הזמנים הרשמי (GTFS של משרד התחבורה) דרך ה-API של Open Bus (הסדנא), כי ההורדה הישירה חסומה.
  488 תחנות, יום חול 16.11.2026: נסיעות ביום ובשיא 07:00-09:00. שכבה `bus_frequency`. האיסוף רץ ברקע ב-pg_cron
  (`shchuna_gtfs_tick`, 20 תחנות לדקה, מסיים ומבטל את עצמו). `shchuna_plan_transit` מחזיר לתוכנית את התחנות התדירות עד 250 מ'
  (8 אוטובוסים ומעלה בשיא = כל 15 דקות; הנחה). לחידוש: `shchuna_gtfs_list(<יום>)`, לעדכן את היום ב-tick ולתזמן מחדש.
- `shchuna_plan_gis(plan)` מחזיר עובדות (מדדים 10, 14, 15, 18 כולל תדירות, רוחבים, קדסטר) ולא זורק שגיאה; כל חלק עם שגיאה משלו.
  היא עוטפת את `shchuna_plan_gis_core` ומוסיפה `services` מ-`shchuna_plan_services` (מדד 10, מגרשי מסחר ומבני ציבור עד 250 מ').
  `shchuna_plan_gis_map(plan)` מחזיר נתיבי SVG למפה בדף התוכנית (`src/components/CityLayers.tsx`).
- המדידה האוטומטית מקבלת את העובדות, והמחוון (סעיף "שכבות GIS עירוניות") קובע איך הן נספרות. ניקוד מהשכבה: confidence `gis`.
- הגירות: `supabase/migrations/20261116*_shchuna_gis*.sql`.

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
בסביבה שחוסמת `*.vercel.app`: להוריד את `ai-menu.js`, `demo.js` ו-`ashdod-logo.png` מ-`AppOfApp-GH/public` (raw.githubusercontent.com)
לתיקייה, ולהריץ עם `APPOFAPP_DIR=<תיקייה> PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1`. בלי זה בדיקות הלוגו נכשלות בגלל הרשת, לא בגלל הקוד.

## תיקונים של ענת
(כל תיקון נרשם כאן ומיושם מאותו רגע.)
- 30.10.2026: כל פעולה מחקרית, השוואתית או אבולוציונית מסתיימת בכלל תכנון שנלמד. היומן המשותף נמצא ב-HITCHADSHUT, בקובץ `docs/planning-insights.md`.
