// Bundles the web app into the Android module's assets (forgecad/src/main/assets/web).
import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";

const out = path.resolve("../src/main/assets/web");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const common = {
  bundle: true,
  minify: process.argv.includes("--dev") ? false : true,
  sourcemap: false,
  format: "iife",
  target: ["chrome90"],
  platform: "browser",
  logLevel: "warning",
  external: ["fs", "path", "module", "worker_threads", "crypto", "url", "node:*"],
  define: { "process.env.NODE_ENV": '"production"', "import.meta.url": "self.location.href" },
};

await esbuild.build({ ...common, entryPoints: ["src/main.js"], outfile: path.join(out, "app.js") });
await esbuild.build({ ...common, entryPoints: ["src/workers/kernel-worker.js"], outfile: path.join(out, "kernel-worker.js") });
await esbuild.build({ ...common, entryPoints: ["src/workers/slicer-worker.js"], outfile: path.join(out, "slicer-worker.js") });
await esbuild.build({ ...common, entryPoints: ["src/workers/cam-worker.js"], outfile: path.join(out, "cam-worker.js") });

for (const f of ["index.html", "styles.css", "icon.svg", "manifest.webmanifest", "sw.js"]) {
  fs.copyFileSync(path.join("public", f), path.join(out, f));
}
fs.copyFileSync("node_modules/replicad-opencascadejs/dist/replicad_single.wasm", path.join(out, "occt.wasm"));

// Licences of bundled open-source components.
const lic = path.join(out, "licenses");
fs.mkdirSync(lic);
for (const [name, file] of [
  ["opencascade-LGPL-2.1.txt", "node_modules/replicad-opencascadejs/LICENSE"],
  ["replicad-MIT.txt", "node_modules/replicad/LICENSE"],
  ["three-MIT.txt", "node_modules/three/LICENSE"],
]) {
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(lic, name));
}
fs.writeFileSync(path.join(lic, "clipper-BSL.txt"), "Clipper library by Angus Johnson (http://www.angusj.com), JavaScript port by Timo. Distributed under the Boost Software License 1.0.\n");
const size = fs.readdirSync(out).reduce((s, f) => s + (fs.statSync(path.join(out, f)).isFile() ? fs.statSync(path.join(out, f)).size : 0), 0);
console.log(`ForgeCAD web built into ${out} (${(size / 1e6).toFixed(1)} MB)`);
