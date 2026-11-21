// Small DOM toolkit: element builder, toasts, dialogs, popover menus and form rows.
import { icon } from "./icons.js";
import { evaluate } from "../core/expr.js";

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.appendChild(typeof kid === "string" || typeof kid === "number" ? document.createTextNode(String(kid)) : kid);
  }
  return el;
}

export function ib(name, title, onclick, cls = "ib") {
  return h("button", { class: cls, title, "aria-label": title, html: icon(name), onclick });
}

let toastTimer = null;
export function toast(msg, kind = "") {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const t = h("div", { class: "toast " + kind }, msg);
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), kind === "err" ? 4200 : 2600);
}

export function modal({ title, body, buttons = [{ label: "OK", primary: true, value: true }], onOpen }) {
  return new Promise((resolve) => {
    const foot = h("div", { class: "mfoot" });
    const wrap = h("div", { class: "modal-wrap" }, h("div", { class: "modal" }, title ? h("h3", {}, title) : null, h("div", { class: "mbody" }, body), foot));
    const close = (v) => { wrap.remove(); resolve(v); };
    for (const b of buttons) {
      foot.appendChild(h("button", { class: "btn " + (b.primary ? "primary" : "") + (b.danger ? " danger" : ""), onclick: async () => {
        if (b.validate && !(await b.validate())) return;
        close(typeof b.value === "function" ? b.value() : b.value);
      } }, b.label));
    }
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(undefined); });
    document.body.appendChild(wrap);
    onOpen && onOpen(wrap);
  });
}

export function confirmBox(title, text, okLabel = "OK", danger = false) {
  return modal({ title, body: h("div", {}, text), buttons: [{ label: "Cancel", value: false }, { label: okLabel, primary: !danger, danger, value: true }] });
}

export function promptBox(title, value = "", { placeholder = "", label = "", numeric = false, params = {} } = {}) {
  const inp = h("input", { class: numeric ? "num" : "txt", value, placeholder, inputmode: numeric ? "decimal" : "text", autocomplete: "off" });
  const err = h("div", { class: "err-msg" });
  const body = h("div", {}, label ? h("div", { class: "note" }, label) : null, inp, err);
  const p = modal({
    title, body,
    buttons: [{ label: "Cancel", value: undefined }, {
      label: "OK", primary: true, value: () => inp.value.trim(),
      validate: () => {
        if (!numeric) return true;
        try { evaluate(inp.value, params); return true; } catch (e) { err.textContent = e.message; return false; }
      },
    }],
    onOpen: (w) => {
      setTimeout(() => { inp.focus(); inp.select(); }, 50);
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") w.querySelector(".btn.primary").click(); });
    },
  });
  return p;
}

export function popMenu(anchor, items) {
  document.querySelectorAll(".pop").forEach((p) => p.remove());
  const pop = h("div", { class: "pop" });
  for (const it of items) {
    if (it === "-") { pop.appendChild(h("div", { class: "menu-sep" })); continue; }
    if (!it) continue;
    pop.appendChild(h("button", { class: "menu-item", disabled: it.disabled, onclick: () => { close(); it.action(); }, html: (it.icon ? icon(it.icon) : "") + `<span>${it.label}</span>` }));
  }
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = Math.min(window.innerWidth - pw - 8, Math.max(8, r.right - pw));
  let y = r.bottom + 4;
  if (y + ph > window.innerHeight - 8) y = Math.max(8, r.top - ph - 4);
  pop.style.left = x + "px";
  pop.style.top = y + "px";
  const close = () => { pop.remove(); document.removeEventListener("pointerdown", outside, true); };
  const outside = (e) => { if (!pop.contains(e.target)) { e.stopPropagation(); close(); } };
  setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
  return close;
}

// ---- form rows ----
export function row(label, ctl, hint) {
  return h("div", { class: "row" }, h("label", {}, label, hint ? h("small", {}, hint) : null), h("div", { class: "ctl" }, ctl));
}

// Numeric field that accepts expressions and parameter names.
export function numField(value, onChange, { unit = "mm", params = () => ({}), min, max, step } = {}) {
  const inp = h("input", { class: "num", value: value ?? "", inputmode: "decimal", autocomplete: "off", enterkeyhint: "done" });
  const check = () => {
    try {
      const v = evaluate(inp.value, params());
      if ((min !== undefined && v < min) || (max !== undefined && v > max)) throw new Error("out of range");
      inp.classList.remove("bad");
      return true;
    } catch (_) { inp.classList.add("bad"); return false; }
  };
  inp.addEventListener("input", () => { if (check()) onChange(inp.value.trim()); });
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") inp.blur(); });
  inp.addEventListener("focus", () => setTimeout(() => inp.select(), 0));
  const wrap = h("div", { style: { display: "flex", alignItems: "center", gap: "6px", width: "100%" } }, inp, unit ? h("span", { class: "unit" }, unit) : null);
  if (step) {
    const bump = (d) => { let v = 0; try { v = evaluate(inp.value, params()); } catch (_) {} v = +(v + d).toFixed(6); if (min !== undefined) v = Math.max(min, v); if (max !== undefined) v = Math.min(max, v); inp.value = String(v); check(); onChange(inp.value); };
    wrap.prepend(h("button", { class: "btn small", onclick: () => bump(-step) }, "−"));
    wrap.insertBefore(h("button", { class: "btn small", onclick: () => bump(step) }, "+"), wrap.lastChild);
  }
  wrap.input = inp;
  return wrap;
}

export function textField(value, onChange, placeholder = "") {
  const inp = h("input", { class: "txt", value: value ?? "", placeholder, autocomplete: "off" });
  inp.addEventListener("input", () => onChange(inp.value));
  return inp;
}

export function selectField(value, options, onChange) {
  const s = h("select", { class: "sel" }, options.map(([v, l]) => h("option", { value: v }, l)));
  s.value = value;
  s.addEventListener("change", () => onChange(s.value));
  return s;
}

export function segField(value, options, onChange) {
  const box = h("div", { class: "seg" });
  const render = (v) => {
    box.innerHTML = "";
    for (const [val, label] of options) {
      box.appendChild(h("button", { class: val === v ? "on" : "", onclick: () => { render(val); onChange(val); } }, label));
    }
  };
  render(value);
  return box;
}

export function switchField(value, onChange) {
  const inp = h("input", { type: "checkbox", checked: !!value });
  inp.addEventListener("change", () => onChange(inp.checked));
  return h("label", { class: "sw" }, inp, h("span"));
}

export function fmt(n, d = 2) {
  if (!Number.isFinite(n)) return "–";
  const s = n.toFixed(d);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

export function fmtTime(sec) {
  sec = Math.round(sec);
  const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
  return hh ? `${hh}h ${mm}m` : mm ? `${mm}m ${ss}s` : `${ss}s`;
}
