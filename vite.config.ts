import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const build = `${pkg.version}-${Date.now().toString(36)}`;

// Stamp the service worker with this build, so every deploy installs a new
// worker and the app can offer "update now".
const swStamp = (): Plugin => ({
  name: "sw-stamp",
  apply: "build",
  writeBundle(opts) {
    const file = `${opts.dir}/sw.js`;
    writeFileSync(file, readFileSync(file, "utf8").replaceAll("__BUILD__", build));
  },
});

export default defineConfig({
  plugins: [react(), swStamp()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: { environment: "node" },
} as never);
