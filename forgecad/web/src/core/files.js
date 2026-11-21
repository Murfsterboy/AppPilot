// Saving and opening files. Inside the Android app we hand files to the system "Save as" picker
// through the ForgeBridge JavaScript interface; in a browser we fall back to a download.

function toBase64(bytes) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function isAndroid() { return typeof window.ForgeBridge !== "undefined"; }

export async function saveFile(name, data, mime = "application/octet-stream") {
  let bytes;
  if (typeof data === "string") bytes = new TextEncoder().encode(data);
  else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
  else if (data instanceof Blob) bytes = new Uint8Array(await data.arrayBuffer());
  else bytes = new Uint8Array(data.buffer || data);
  if (isAndroid()) {
    return new Promise((resolve) => {
      window.__forgeSaveDone = (ok) => resolve(!!ok);
      window.ForgeBridge.saveFile(name, mime, toBase64(bytes));
    });
  }
  const blob = new Blob([bytes], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return true;
}

export function shareFile(name, data, mime) {
  if (isAndroid() && window.ForgeBridge.shareFile) {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data.buffer || data);
    window.ForgeBridge.shareFile(name, mime, toBase64(bytes));
    return true;
  }
  return false;
}

export function pickFile(accept = "*/*", multiple = false) {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = accept;
    inp.multiple = multiple;
    inp.style.display = "none";
    document.body.appendChild(inp);
    inp.onchange = () => { resolve([...inp.files]); inp.remove(); };
    // if the user cancels we never resolve; that's fine
    inp.click();
  });
}

export function f32ToBase64(arr) { return toBase64(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)); }
export function base64ToF32(s) {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Float32Array(u8.buffer);
}
