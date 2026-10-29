// Publishes the rubric and the metric definitions as public/measure-config.json.
// The shchuna-measure edge function reads this file, so the server measures with
// exactly the yardstick in the repo. Runs before every build (npm run prebuild).
import { readFileSync, writeFileSync } from "node:fs";
const { ALL_METRICS } = await import("../src/data/chapters.ts");
const rubric = readFileSync("docs/measurement-rubric.md", "utf8");
// The rubric (sent in full) carries the official requirement of every metric; the metric list
// only adds the page and the eligibility note, to avoid sending each requirement twice.
const official = Object.fromEntries(JSON.parse(readFileSync("docs/official-v2.json", "utf8")).metrics.map((m) => [m.id, m]));
const metrics = ALL_METRICS.map(({ id, name, full, maxScore, stages, page }) => {
  const o = official[id];
  const description = [`שכונה 360° גרסה 2.0, עמ' ${page}. הדרישות בטבלת המחוון.`, o.eligibility && `תנאי זכאות: ${o.eligibility}`].filter(Boolean).join(" ");
  return { id, name, full, maxScore, stages, description };
});
writeFileSync("public/measure-config.json", JSON.stringify({ rubric, metrics }));
console.log(`public/measure-config.json: ${metrics.length} metrics, rubric ${rubric.length} chars`);
