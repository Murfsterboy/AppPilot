// ForgeCAD entry point.
import { App } from "./app.js";

window.addEventListener("error", (e) => console.error("Uncaught:", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => console.error("Unhandled:", e.reason));

const app = new App(document.getElementById("app"));
window.forgecad = app;
app.start();

// Offline support for the browser version (the Android app serves everything from the APK)
if ("serviceWorker" in navigator && location.protocol === "https:" && !window.ForgeBridge && !location.hostname.endsWith("androidplatform.net")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
