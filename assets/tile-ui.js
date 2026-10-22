/* UI intentionally isolated from marketplace calculators. */
"use strict";
(function () {
  const form = document.getElementById("tile-form");
  const fields = ["area", "coverage", "waste", "costPerBox", "delivery", "labor", "margin"];
  const outputs = ["quote", "boxes", "materialCost", "totalCost", "profit", "grossMargin"];
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  function run() {
    const input = {};
    fields.forEach(key => { input[key] = form.elements[key].valueAsNumber; });
    const result = calculateTileQuote(input);
    fields.forEach(key => {
      form.elements[key].setAttribute("aria-invalid", result.errors[key] ? "true" : "false");
      document.getElementById(key + "-error").textContent = result.errors[key] || "";
    });
    const error = document.getElementById("tile-error");
    const hasErrors = Object.keys(result.errors).length > 0;
    error.hidden = !hasErrors;
    error.textContent = hasErrors ? result.errors.calculation || "Check the highlighted fields to calculate your quote." : "";
    if (hasErrors) {
      outputs.forEach(key => { document.getElementById(key).textContent = "—"; });
      document.getElementById("coverage-summary").textContent = "Results will update when all inputs are valid.";
      return;
    }
    ["quote", "materialCost", "totalCost", "profit"].forEach(key => { document.getElementById(key).textContent = money.format(result[key]); });
    document.getElementById("boxes").textContent = number.format(result.boxes);
    document.getElementById("grossMargin").textContent = result.grossMargin === null ? "N/A" : result.grossMargin.toFixed(2) + "%";
    document.getElementById("coverage-summary").textContent = number.format(result.requiredArea) + " sq ft needed including waste. " + number.format(result.boxes) + " full boxes cover " + number.format(result.orderedArea) + " sq ft. Full-box rounding is included in your costs.";
  }
  form.addEventListener("submit", event => event.preventDefault());
  form.addEventListener("input", run);
  form.addEventListener("change", run);
  form.addEventListener("reset", () => setTimeout(run, 0));
  run();
})();
