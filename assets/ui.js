/* Shared UI helpers for calculator pages. */
"use strict";
const $ = (id) => document.getElementById(id);
const money = (n, sym = "$") => sym + (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fval = (id) => { const e = $(id); const v = e ? parseFloat(e.value) : NaN; return Number.isFinite(v) ? v : 0; };
const sval = (id) => { const e = $(id); return e ? e.value : ""; };
const bval = (id) => { const e = $(id); return e ? !!e.checked : false };

/* Load values from ?query into fields, and keep the URL updated so results are shareable. */
function initShareable(formId) {
  const form = $(formId); if (!form) return;
  const params = new URLSearchParams(location.search);
  form.querySelectorAll("input,select").forEach(el => {
    if (!el.id) return;
    if (params.has(el.id)) { if (el.type === "checkbox") el.checked = params.get(el.id) === "1"; else el.value = params.get(el.id); }
  });
  const sync = () => {
    const p = new URLSearchParams();
    form.querySelectorAll("input,select").forEach(el => {
      if (!el.id) return;
      if (el.type === "checkbox") { if (el.checked) p.set(el.id, "1"); }
      else if (el.value !== "" && el.value !== el.defaultValue) p.set(el.id, el.value);
    });
    history.replaceState(null, "", p.toString() ? "?" + p : location.pathname);
  };
  form.addEventListener("input", sync); sync();
}

function renderLines(tbodyId, result, sym) {
  const tb = $(tbodyId); if (!tb) return;
  tb.innerHTML = result.lines.map(l =>
    `<tr><td>${l.label}</td><td>-${money(l.amount, sym)}</td></tr>`).join("") +
    `<tr class="total"><td>Net profit per sale</td><td class="${result.netProfit >= 0 ? "pos" : "neg"}">${money(result.netProfit, sym)}</td></tr>`;
}

function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1800);
}
function copyText(text, msg) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast(msg || "Copied"));
  else toast("Copy not available in this browser");
}
function onCalc(formId, fn) {
  const form = $(formId); if (!form) return;
  form.addEventListener("input", fn); form.addEventListener("change", fn); fn();
}
