// Safe arithmetic expression evaluator for numeric fields ("20*2", "width/2 + 3", "sqrt(2)*10").
// Supports + - * / ^ %, parentheses, unary minus, named parameters, functions and constants.

const FUNCS = {
  sqrt: Math.sqrt, sin: (d) => Math.sin((d * Math.PI) / 180), cos: (d) => Math.cos((d * Math.PI) / 180),
  tan: (d) => Math.tan((d * Math.PI) / 180), asin: (x) => (Math.asin(x) * 180) / Math.PI,
  acos: (x) => (Math.acos(x) * 180) / Math.PI, atan: (x) => (Math.atan(x) * 180) / Math.PI,
  abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max,
  ln: Math.log, log: Math.log10, exp: Math.exp,
};
const CONSTS = { pi: Math.PI, PI: Math.PI, e: Math.E };
const UNITS = { mm: 1, cm: 10, m: 1000, in: 25.4, inch: 25.4, ft: 304.8, deg: 1, "°": 1 };

function tokenize(s) {
  const t = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      if (s[j] === "e" || s[j] === "E") {
        let k = j + 1;
        if (s[k] === "+" || s[k] === "-") k++;
        if (/[0-9]/.test(s[k] || "")) { j = k; while (j < s.length && /[0-9]/.test(s[j])) j++; }
      }
      t.push({ k: "num", v: parseFloat(s.slice(i, j)) });
      i = j; continue;
    }
    if (/[A-Za-z_°]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z_0-9°]/.test(s[j])) j++;
      t.push({ k: "id", v: s.slice(i, j) });
      i = j; continue;
    }
    if ("+-*/^%(),".includes(c)) { t.push({ k: c }); i++; continue; }
    throw new Error(`Unexpected "${c}"`);
  }
  return t;
}

export function evaluate(src, params = {}) {
  if (typeof src === "number") return src;
  const str = String(src ?? "").trim();
  if (str === "") throw new Error("Empty value");
  const t = tokenize(str);
  let p = 0;
  const peek = () => t[p];
  const eat = (k) => { if (!t[p] || t[p].k !== k) throw new Error(`Expected ${k}`); return t[p++]; };
  function expr() {
    let v = term();
    while (peek() && (peek().k === "+" || peek().k === "-")) { const o = t[p++].k; const r = term(); v = o === "+" ? v + r : v - r; }
    return v;
  }
  function term() {
    let v = factor();
    for (;;) {
      const n = peek();
      if (n && (n.k === "*" || n.k === "/" || n.k === "%")) { p++; const r = factor(); v = n.k === "*" ? v * r : n.k === "/" ? v / r : v % r; }
      else if (n && (n.k === "num" || n.k === "(" || (n.k === "id" && !UNITS[n.v]))) { v *= factor(); } // implicit multiply: 2pi, 3(4)
      else break;
    }
    return v;
  }
  function factor() {
    let v = unary();
    if (peek() && peek().k === "^") { p++; v = Math.pow(v, factor()); }
    return v;
  }
  function unary() {
    if (peek() && peek().k === "-") { p++; return -unary(); }
    if (peek() && peek().k === "+") { p++; return unary(); }
    return postfix(primary());
  }
  function postfix(v) {
    const n = peek();
    if (n && n.k === "id" && UNITS[n.v] !== undefined) { p++; return v * UNITS[n.v]; }
    return v;
  }
  function primary() {
    const n = t[p++];
    if (!n) throw new Error("Incomplete expression");
    if (n.k === "num") return n.v;
    if (n.k === "(") { const v = expr(); eat(")"); return v; }
    if (n.k === "id") {
      if (peek() && peek().k === "(" && FUNCS[n.v]) {
        p++;
        const args = [];
        if (peek() && peek().k !== ")") { args.push(expr()); while (peek() && peek().k === ",") { p++; args.push(expr()); } }
        eat(")");
        return FUNCS[n.v](...args);
      }
      if (Object.prototype.hasOwnProperty.call(params, n.v)) return params[n.v];
      if (CONSTS[n.v] !== undefined) return CONSTS[n.v];
      throw new Error(`Unknown name "${n.v}"`);
    }
    throw new Error(`Unexpected "${n.k}"`);
  }
  const v = expr();
  if (p < t.length) throw new Error("Unexpected extra input");
  if (!Number.isFinite(v)) throw new Error("Not a finite number");
  return v;
}

// Resolve user parameters (which may reference each other) into numbers.
export function resolveParams(list) {
  const out = {};
  const errors = {};
  const pending = [...(list || [])];
  for (let pass = 0; pass < pending.length + 1 && pending.length; pass++) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const prm = pending[i];
      try { out[prm.name] = evaluate(prm.expr, out); pending.splice(i, 1); } catch (e) { errors[prm.name] = e.message; }
    }
  }
  for (const prm of pending) errors[prm.name] = errors[prm.name] || "Could not evaluate";
  for (const k of Object.keys(out)) delete errors[k];
  return { values: out, errors };
}

export function isValidName(n) { return /^[A-Za-z_][A-Za-z_0-9]*$/.test(n) && !FUNCS[n] && !CONSTS[n] && !UNITS[n]; }
