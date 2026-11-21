// End-to-end smoke test: run with the static server on :8123 (npm run serve).
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const OUT = process.env.SHOTS || "shots";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`[${m.type()}] ${m.text()}`); });
page.on("pageerror", (e) => errors.push("[pageerror] " + e.message));
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
await page.goto("http://localhost:8123/");
await page.waitForSelector(".home", { timeout: 60000 });
await shot("01-home");
// open sample
await page.click("text=Examples");
await page.click("text=Mounting bracket");
await page.waitForFunction(() => window.forgecad && window.forgecad.result.bodies.length > 0, null, { timeout: 60000 });
await page.waitForTimeout(800);
await shot("02-bracket");
console.log("errors in model:", JSON.stringify(await page.evaluate(() => window.forgecad.result.errors)));
console.log("bodies:", JSON.stringify(await page.evaluate(() => window.forgecad.result.bodies.map((b) => [b.id, Math.round(b.volume)]))));
// browser tree
await page.click('button[title="Browser"]');
await page.waitForTimeout(400);
await shot("03-tree");
await page.mouse.click(380, 400);
// print workspace
await page.click('.tab[data-ws="print"]');
await page.waitForTimeout(1500);
await shot("04-print");
await page.click('.tool:has-text("Slice")');
await page.waitForSelector(".statbar", { timeout: 60000 });
await page.waitForTimeout(500);
await shot("05-sliced");
// cnc
await page.click('.tab[data-ws="cnc"]');
await page.waitForTimeout(1500);
await shot("06-cnc");
// add CNC operations
for (const op of ["Facing", "Adaptive clearing", "Contour / profile", "Drilling"]) {
  await page.click('.tool:has-text("Operation")');
  await page.click(`.pop .menu-item:has-text("${op}")`);
  await page.waitForTimeout(200);
}
await page.click('.tool:has-text("Generate")');
await page.waitForFunction(() => window.forgecad.cam.results, null, { timeout: 120000 });
await page.waitForTimeout(600);
console.log("cam:", JSON.stringify(await page.evaluate(() => window.forgecad.cam.results.map((r) => [r.error, r.moves.length / 5]))));
await page.mouse.click(380, 300);
await shot("07-toolpaths");
await page.click('.tool:has-text("Simulate")');
await page.waitForTimeout(500);
await page.click('.player .btn.small'); await page.click('.player .btn.small'); await page.click('.player .btn.small'); await page.click('.player .btn.small');
await page.waitForTimeout(4000);
await shot("08-sim");
await page.click('.player button[title="Stop simulation"]');
// new design with a sketch
await page.click('.tab[data-ws="design"]');
await page.click('.tool:has-text("Sketch")');
await page.click('.big-action:has-text("Top")');
await page.waitForTimeout(500);
await page.click('.tool:has-text("Rectangle")');
const cv = await page.$(".sketch-canvas");
const bb = await cv.boundingBox();
const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
await page.mouse.click(cx - 120, cy + 140); await page.mouse.click(cx + 60, cy + 40);
await page.click('.tool:has-text("Circle")');
await page.mouse.click(cx - 30, cy + 90); await page.mouse.click(cx - 5, cy + 90);
await page.click('.tool:has-text("Dimension")');
await page.mouse.click(cx - 30, cy + 140);
await page.waitForSelector(".dimedit input");
await page.fill(".dimedit input", "W*0.75");
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
await shot("09-sketch");
console.log("sketch:", JSON.stringify(await page.evaluate(() => { const s = window.forgecad.design.sketcher; return { ents: s.sk.entities.length, cons: s.sk.constraints.length, dof: s.dofCount, ok: s.solveOk }; })));
await page.click('button:has-text("Finish")');
await page.waitForTimeout(500);
await page.click('.tool:has-text("Extrude")');
await page.waitForTimeout(1500);
await page.fill('.sheet .num', "15");
await page.waitForTimeout(1500);
await shot("10-extrude-preview");
await page.click('.sheet .btn.primary:has-text("OK")');
await page.waitForTimeout(1500);
console.log("final errors:", JSON.stringify(await page.evaluate(() => window.forgecad.result.errors)), "bodies", await page.evaluate(() => window.forgecad.result.bodies.length));
await shot("11-after-extrude");
console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
