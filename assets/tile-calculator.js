/* Seller-side tile estimating. No marketplace fee engine dependencies. */
(function (root) {
  "use strict";
  // Preserve the decimal values entered by the seller for ceiling operations.
  // Binary floating point can otherwise add a box or a cent at exact boundaries.
  function fraction(value) {
    const parts = String(value).toLowerCase().split("e");
    const decimal = parts[0].split(".");
    const places = (decimal[1] || "").length - Number(parts[1] || 0);
    const digits = BigInt(decimal.join(""));
    return places >= 0 ? { n: digits, d: 10n ** BigInt(places) } : { n: digits * 10n ** BigInt(-places), d: 1n };
  }
  function add(a, b) { return { n: a.n * b.d + b.n * a.d, d: a.d * b.d }; }
  function ceil(n, d) { return (n + d - 1n) / d; }
  function calculateTileQuote(input) {
    const labels = {
      area: "Project area", coverage: "Coverage per box", waste: "Waste allowance",
      costPerBox: "Cost per box", delivery: "Delivery / other costs", labor: "Labor cost", margin: "Target gross margin"
    };
    const errors = {};
    for (const key of Object.keys(labels)) {
      const value = input[key];
      if (typeof value !== "number" || !Number.isFinite(value)) errors[key] = labels[key] + " must be a valid number.";
      else if ((key === "area" || key === "coverage") && value <= 0) errors[key] = labels[key] + " must be greater than zero.";
      else if (value < 0) errors[key] = labels[key] + " cannot be negative.";
      else if (key === "margin" && value >= 100) errors[key] = "Target gross margin must be less than 100%.";
    }
    if (Object.keys(errors).length) return { errors };
    const tooLarge = () => ({ errors: { calculation: "These values are too large to calculate reliably. Please use smaller values." } });
    const a = fraction(input.area), w = fraction(input.waste), c = fraction(input.coverage);
    const boxCount = ceil(a.n * (100n * w.d + w.n) * c.d, a.d * 100n * w.d * c.n);
    if (boxCount > BigInt(Number.MAX_SAFE_INTEGER)) return tooLarge();
    const boxes = Number(boxCount);
    const requiredArea = input.area * (1 + input.waste / 100);
    const orderedArea = boxes * input.coverage;
    const materialCost = boxes * input.costPerBox;
    const totalCost = materialCost + input.delivery + input.labor;
    const exactQuote = totalCost / (1 - input.margin / 100);
    const cost = fraction(input.costPerBox);
    const total = add(add({ n: boxCount * cost.n, d: cost.d }, fraction(input.delivery)), fraction(input.labor));
    const margin = fraction(input.margin);
    const quoteCents = ceil(total.n * 10000n * margin.d, total.d * (100n * margin.d - margin.n));
    if (quoteCents > BigInt(Number.MAX_SAFE_INTEGER) || !Number.isFinite(requiredArea) || !Number.isFinite(orderedArea) || !Number.isFinite(exactQuote)) return tooLarge();
    const quote = Number(quoteCents) / 100;
    const profit = quote - totalCost;
    return { errors: {}, boxes, requiredArea, orderedArea, materialCost, totalCost, exactQuote, quote, profit, grossMargin: quote > 0 ? profit / quote * 100 : null };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { calculateTileQuote };
  else root.calculateTileQuote = calculateTileQuote;
})(typeof globalThis !== "undefined" ? globalThis : this);
