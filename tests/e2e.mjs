// End-to-end check against `vite preview` (port 4173), every Supabase call mocked.
// Run: npm run build && (npm run preview &) && npm run e2e
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require(require("node:child_process").execSync("npm root -g").toString().trim() + "/playwright"));
}

const BASE = process.env.BASE ?? "http://localhost:4173";
mkdirSync("screens", { recursive: true });
let failed = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failed++;
};

const PUBLISHED = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "הדגמה: התחדשות רובע ט\"ו",
  quarter_id: "q-o",
  stage: 2,
  scores: { 1: 3, 2: 2, 10: 4, 13: 2, 14: 3, 16: 3, 22: 4, 28: 2, 36: 3, 42: 2 },
  notes: { 1: "פרוטוקול צוות תכנון" },
  target: 70,
  status: "published",
  author: "ענת",
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-02T10:00:00Z",
};
const saves = [];
const SCORE = JSON.parse(readFileSync(new URL("./fixtures/plan-score.json", import.meta.url)));
const PLAN = { id: SCORE.plan_project_id, title: "מתחם האצטדיון", kind: "urban_renewal", status: "approved", plan_number: SCORE.plan_number, quarter_id: "q-a", units_existing: 124, units_planned: 974 };
const PENDING = { ...PLAN, id: "44444444-4444-4444-8444-444444444444", title: "תוכנית חדשה לבדיקה", plan_number: "603-9999999" };
const server = new Map([[PUBLISHED.id, PUBLISHED]]);

async function mock(page) {
  await page.route("**/functions/v1/shchuna-measure", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ready":false}' }));
  await page.route("**/rest/v1/**", async (route) => {
    const url = route.request().url();
    const body = route.request().postDataJSON?.() ?? {};
    const json = (d) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
    if (url.includes("rpc/shchuna_editor")) return json(body.p_key === "test-key" ? "ענת" : null);
    if (url.includes("rpc/shchuna_list"))
      return json([...server.values()].filter((a) => a.status === "published" || body.p_key === "test-key"));
    if (url.includes("rpc/shchuna_save")) {
      saves.push(body);
      const row = { ...body.p_data, id: body.p_id, author: "ענת", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      server.set(row.id, row);
      return json(row);
    }
    if (url.includes("rpc/shchuna_history")) return json([{ id: 1, editor: "ענת", created_at: new Date().toISOString(), snapshot: PUBLISHED }]);
    if (url.includes("rpc/shchuna_remove")) {
      server.delete(body.p_id);
      return json(null);
    }
    if (url.includes("/plan_projects")) return json([PLAN, PENDING]);
    if (url.includes("/shchuna_measure_runs")) return json([{ id: 1, plan_project_id: PENDING.id, status: "error", error: "test failure", started_at: "2026-10-29T19:00:00Z" }]);
    if (url.includes("/shchuna_plan_scores")) return json([{ ...SCORE, stage: 2, method: "claude-session", model: "claude-opus-5-5", measured_at: "2026-10-29T19:00:00Z" }]);
    if (url.includes("/quarters")) return json([{ id: "q-o", name: 'רובע ט"ו' }, { id: "q-g", name: "רובע ז'" }]);
    return json([]);
  });
}

const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const menu = async (page, label) => {
  await page.locator("ai-menu .logo").click();
  await page.locator("ai-menu [role=menuitem]", { hasText: label }).first().click();
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "he-IL" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/fonts|favicon/.test(m.text()) && errors.push(m.text()));
await mock(page);

// Landing
await page.goto(BASE + "/");
await page.waitForTimeout(1500);
ok(await page.locator("ai-menu .logo").waitFor({ timeout: 10000 }).then(() => true, () => false), "A&I logo button in the top bar");
ok(!(await page.locator("header >> text=העתקת קישור").first().isVisible().catch(() => false)), "no loose development buttons in the bar");
ok((await page.locator("ai-menu").getAttribute("brand")) === "ashdod", "municipal brand on the logo button");
ok((await page.locator(".hero .iso-b").count()) === 44, "neighborhood model draws 44 buildings");
ok((await page.locator("h1.display").innerText()).includes("44 מדדים"), "hero headline");
ok(await page.locator(".pub", { hasText: "הדגמה" }).isVisible(), "published assessment listed on landing");
ok(await noHScroll(page), "landing: no horizontal scroll (desktop)");
await page.screenshot({ path: "screens/landing.png" });
await page.locator(".hero .iso-hud button").first().click();
await page.waitForTimeout(1000);
ok((await page.locator(".iso-deg").first().innerText()) !== "000°", "model rotates");

// Brand link goes home
await page.goto(BASE + "/updates");
await page.locator(".brand").click();
await page.waitForURL(BASE + "/");
ok(true, "app name links to the home page");

// New assessment
await page.getByRole("button", { name: "התחלת הערכה" }).click();
await page.waitForURL(/\/a\/[0-9a-f-]{36}/);
const id = page.url().split("/a/")[1].split("?")[0];
ok(!!id, "start assessment opens a workspace");
await page.locator(".title-input").fill("בדיקה: רובע ז' צפון");
await page.locator(".ws-meta select").selectOption("q-g");
await page.getByRole("radio", { name: "ג ביצוע" }).click();
await page.locator("#m-13 .metric-head").click();
ok(page.url().includes("m=13"), "open metric is in the address");
await page.locator("#m-13 .score-row button", { hasText: "3" }).click();
await page.locator("#n-13").fill("תשריט 1:500, חזיתות מסחריות לאורך הרחוב");
await page.keyboard.press("Escape");
await page.locator("#m-14 .metric-head").click();
await page.keyboard.press("4");
await page.waitForTimeout(300);
const stored = await page.evaluate((id) => JSON.parse(localStorage.getItem("shchuna.assessments.v2")).find((a) => a.id === id), id);
ok(stored?.scores?.[13] === 3 && stored?.scores?.[14] === 4, "scores saved locally (click and keyboard)");
ok(stored?.stage === 3 && stored?.quarter_id === "q-g" && stored?.notes?.[13]?.includes("תשריט"), "stage, quarter and evidence saved");
ok((await page.locator("#m-4").getAttribute("class"))?.includes("off"), "stage-irrelevant metrics dimmed");
await page.locator(".ws-side .iso-b[data-metric='22']").click();
ok(page.url().includes("tab=2") && page.url().includes("m=22"), "clicking a building opens its metric");
await page.screenshot({ path: "screens/workspace.png" });

// Dashboard
await page.getByRole("button", { name: "לוח מחוונים" }).click();
await page.waitForTimeout(900);
ok(await page.locator(".kpi").first().isVisible(), "dashboard KPIs");
ok((await page.locator(".path li").count()) > 0, "path to target listed");
await page.screenshot({ path: "screens/dashboard.png" });
await page.locator(".path li button").first().click();
ok(/m=\d+/.test(page.url()), "path step opens its metric");

// Report
await page.getByRole("button", { name: "דוח" }).click();
await page.waitForTimeout(500);
ok(await page.locator(".paper h1", { hasText: "בדיקה" }).isVisible(), "report renders");
await page.screenshot({ path: "screens/report.png", fullPage: false });

// Editor key, server save
await menu(page, "כניסת עורך");
await page.locator("dialog[open] input").fill("wrong");
await page.locator("dialog[open] button[type=submit]").click();
ok(await page.locator("dialog[open] .err").waitFor({ timeout: 4000 }).then(() => true, () => false), "wrong editor key rejected");
await page.locator("dialog[open] input").fill("test-key");
await page.locator("dialog[open] button[type=submit]").click();
await page.waitForTimeout(400);
ok(await page.locator(".toast", { hasText: "שלום ענת" }).waitFor({ timeout: 4000 }).then(() => true, () => false), "editor key accepted");
await page.getByRole("button", { name: "תשתית ובינוי" }).click();
await page.locator("#m-1 .metric-head").click();
await page.locator("#m-1 .score-row button", { hasText: "2" }).click();
await page.waitForTimeout(1500);
const last = saves.filter((s) => s.p_id === id).at(-1);
ok(last?.p_key === "test-key" && last?.p_data?.scores?.[1] === 2 && last?.p_data?.quarter_id === "q-g", "autosave sends the assessment to shchuna_save");
await menu(page, "פרסום ההערכה");
await page.waitForTimeout(1300);
ok(saves.at(-1)?.p_data?.status === "published", "publish goes through the editor RPC");
await menu(page, "היסטוריית גרסאות");
ok(await page.locator("dialog[open] .hist li").first().waitFor({ timeout: 4000 }).then(() => true, () => false), "version history opens");
await page.locator("dialog[open] .modal-head .ghost").click();

// Lists and compare
await page.goto(BASE + "/assessments");
await page.waitForTimeout(800);
ok((await page.locator(".a-card").count()) >= 2, "assessment list shows local and server items");
await page.locator(".chip", { hasText: "רובע ז'" }).click();
await page.waitForTimeout(700);
ok((await page.locator(".a-card").count()) === 1 && page.url().includes("q=q-g"), "quarter filter");
await page.screenshot({ path: "screens/assessments.png" });
await page.goto(BASE + "/compare");
await page.waitForTimeout(800);
ok((await page.locator(".cmp-grid .radar polygon[fill-opacity]").count()) >= 2, "compare overlays two assessments");
// Plans in the city (measurements of "מה נבנה סביבי")
await page.goto(BASE + "/plans");
await page.waitForTimeout(1200);
ok((await page.locator(".heat tbody tr").count()) === 1, "plans heat map lists the measured plan");
ok((await page.locator(".heat tbody tr .h-cell").count()) === 13, "heat map has 13 topic cells");
ok(await page.locator(".pending", { hasText: "תוכנית חדשה לבדיקה" }).isVisible(), "unmeasured plan listed as pending");
ok(await page.locator(".pending .err-tag").isVisible(), "a failed automatic measurement is shown, not silent");
ok(await page.locator(".panel.city .li").first().isVisible(), "city-wide weak and silent metrics");
await page.screenshot({ path: "screens/plans.png" });
await page.locator(".heat .h-plan a").first().click();
await page.waitForURL(/\/plans\/[0-9a-f-]{36}/);
await page.waitForTimeout(800);
ok((await page.locator(".ev").count()) === 44, "plan page shows all 44 metrics with evidence");
await page.locator(".ev:not(.silent) .ev-head").first().click();
ok(await page.locator(".ev.open blockquote").isVisible(), "evidence quote opens");
ok((await page.locator('a[href^="https://ashdod-ma-nivne.vercel.app/p/"]').count()) === 1, "link back to the plan in מה נבנה סביבי");
await page.screenshot({ path: "screens/plan-detail.png" });
await page.getByRole("button", { name: "פתיחה כהערכה לעריכה" }).click();
await page.waitForURL(/\/a\/[0-9a-f-]{36}/);
const seeded = await page.evaluate(() => JSON.parse(localStorage.getItem("shchuna.assessments.v2"))[0]);
ok(Object.keys(seeded.scores).length === Object.values(SCORE.metrics).filter((e) => e.score != null).length && Object.keys(seeded.notes).length > 0, "plan opens as an editable assessment with its scores");

await page.goto(BASE + "/method");
ok(await page.getByText("איך הכלי מודד את האמינות של עצמו").isVisible(), "method page");


// Delete
await page.goto(BASE + `/a/${id}`);
await page.waitForTimeout(500);
await menu(page, "מחיקת הערכה");
await page.locator("dialog[open] .btn.danger").click();
await page.waitForURL(BASE + "/assessments");
ok(!(await page.evaluate((id) => localStorage.getItem("shchuna.assessments.v2").includes(id), id)), "delete removes the assessment");

// Read-only published assessment for a visitor
await menu(page, "יציאה ממצב עורך");
await page.goto(BASE + `/a/${PUBLISHED.id}`);
await page.waitForTimeout(700);
ok(await page.locator(".notice", { hasText: "שכפול" }).isVisible(), "published assessment is read-only for visitors");

// Installability
const cdp = await ctx.newCDPSession(page);
await page.goto(BASE + "/");
await page.waitForTimeout(1500);
const inst = await cdp.send("Page.getInstallabilityErrors");
ok(inst.installabilityErrors.length === 0, `installable (${JSON.stringify(inst.installabilityErrors)})`);
ok(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), "service worker registered");

// Mobile
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mock(mp);
for (const p of ["/", "/plans", `/plans/${PLAN.id}`, "/assessments", `/a/${PUBLISHED.id}`, `/a/${PUBLISHED.id}?tab=dash`, `/a/${PUBLISHED.id}?tab=report`, "/compare", "/method", "/updates"]) {
  await mp.goto(BASE + p);
  await mp.waitForTimeout(900);
  ok(await noHScroll(mp), `mobile ${p}: no horizontal scroll`);
}
await mp.goto(BASE + "/");
await mp.waitForTimeout(1500);
await mp.screenshot({ path: "screens/mobile-landing.png" });
await mp.goto(BASE + `/a/${PUBLISHED.id}?tab=1`);
await mp.waitForTimeout(1000);
await mp.screenshot({ path: "screens/mobile-workspace.png" });

ok(errors.length === 0, `no console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ""}`);
await browser.close();
console.log(failed ? `\n${failed} FAILED` : "\nALL GREEN");
process.exit(failed ? 1 : 0);
