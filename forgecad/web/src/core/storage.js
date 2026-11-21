// Projects are kept on the device in IndexedDB (works offline, inside the Android WebView too).
const DB = "forgecad";
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains("projects")) d.createObjectStore("projects", { keyPath: "id" });
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "key" });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
    t.onerror = () => rej(t.error);
  });
}
export async function listProjects() {
  const all = await tx("projects", "readonly", (s) => s.getAll());
  return (all || []).map(({ id, name, updated, thumb }) => ({ id, name, updated, thumb })).sort((a, b) => b.updated - a.updated);
}
export async function loadProject(id) { return tx("projects", "readonly", (s) => s.get(id)); }
export async function saveProject(rec) { rec.updated = Date.now(); await tx("projects", "readwrite", (s) => s.put(rec)); return rec; }
export async function deleteProject(id) { await tx("projects", "readwrite", (s) => s.delete(id)); }
export async function getMeta(key, def = null) { const r = await tx("meta", "readonly", (s) => s.get(key)); return r ? r.value : def; }
export async function setMeta(key, value) { await tx("meta", "readwrite", (s) => s.put({ key, value })); }
export async function requestPersistence() { try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {} }
