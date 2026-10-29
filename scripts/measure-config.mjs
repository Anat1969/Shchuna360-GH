// Publishes the rubric and the metric definitions as public/measure-config.json.
// The shchuna-measure edge function reads this file, so the server measures with
// exactly the yardstick in the repo. Runs before every build (npm run prebuild).
import { readFileSync, writeFileSync } from "node:fs";
const { ALL_METRICS } = await import("../src/data/chapters.ts");
const rubric = readFileSync("docs/measurement-rubric.md", "utf8");
const metrics = ALL_METRICS.map(({ id, name, full, maxScore, stages, description }) => ({ id, name, full, maxScore, stages, description }));
writeFileSync("public/measure-config.json", JSON.stringify({ rubric, metrics }));
console.log(`public/measure-config.json: ${metrics.length} metrics, rubric ${rubric.length} chars`);
