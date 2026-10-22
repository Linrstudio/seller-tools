/* Shared two-platform comparison widget for /compare/ pages.
   Canonical profile (stated on each page): COGS = 35% of price, inbound $1.20,
   packaging $0.30, own shipping $4.80, ads 10% of price, returns 5%, 300 units/mo. */
"use strict";
const VS_NAMES = { "amazon-fba": "Amazon FBA", "amazon-fbm": "Amazon FBM", etsy: "Etsy", ebay: "eBay", shopify: "Shopify", tiktok: "TikTok Shop" };
function vsCalc(id, price) {
  const cogs = Math.round(price * 0.35 * 100) / 100;
  const base = { price, shippingCharged: 0, cogs, inboundPerUnit: 1.20, packaging: 0.30, adRate: 10, returnRate: 5, monthlyUnits: 300 };
  switch (id) {
    case "amazon-fba": return calcAmazon({ ...base, method: "fba", category: "home", tier: "largeStandard", weightLb: 1.2, plan: "professional", placementFee: 0.27, fuelSurcharge: true, lengthIn: 0, widthIn: 0, heightIn: 0, monthsStored: 0 });
    case "amazon-fbm": return calcAmazon({ ...base, method: "fbm", category: "home", ownShippingCost: 4.80, plan: "professional" });
    case "etsy": return calcEtsy({ ...base, country: "US", shippingCostActual: 4.80, giftWrap: 0, offsiteMode: "none" });
    case "ebay": return calcEbay({ ...base, category: "most", ownShippingCost: 4.80 });
    case "shopify": return calcShopify({ ...base, plan: "basic", billing: "monthly", payments: "shopify", ownShippingCost: 4.80, appsMonthly: 30 });
    case "tiktok": return calcTiktok({ ...base, referralRatePct: 6, affiliateRate: 10, shippingMode: "self", shippingCost: 4.80 });
  }
}
function initVs(rootId) {
  const root = $(rootId); if (!root) return;
  const a = root.dataset.a, b = root.dataset.b;
  const run = () => {
    const price = Math.max(fval("vs-price"), 1);
    const ra = vsCalc(a, price), rb = vsCalc(b, price);
    $("vs-a-name").textContent = VS_NAMES[a]; $("vs-b-name").textContent = VS_NAMES[b];
    renderLines("vs-a-lines", ra, "$"); renderLines("vs-b-lines", rb, "$");
    const diff = Math.round((ra.netProfit - rb.netProfit) * 100) / 100;
    $("vs-verdict").innerHTML = diff === 0 ? "Dead heat at this price."
      : `<strong>${VS_NAMES[diff > 0 ? a : b]}</strong> keeps <strong>${money(Math.abs(diff))}</strong> more per sale at ${money(price)}.`;
    $("vs-bands").innerHTML = [10, 25, 50, 100, 250].map(p => {
      const x = vsCalc(a, p), y = vsCalc(b, p);
      const w = x.netProfit === y.netProfit ? "tie" : (x.netProfit > y.netProfit ? VS_NAMES[a] : VS_NAMES[b]);
      return `<tr><td>${money(p)}</td><td class="${x.netProfit >= y.netProfit ? "pos" : ""}">${money(x.netProfit)}</td><td class="${y.netProfit >= x.netProfit ? "pos" : ""}">${money(y.netProfit)}</td><td>${w}</td></tr>`;
    }).join("");
  };
  $("vs-price").addEventListener("input", run); run();
}
