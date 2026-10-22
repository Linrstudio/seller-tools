/* Pure calculation engine. No DOM. Shared by every calculator page.
   Money model: all fee lines positive = money taken away from the seller.
   returnsLoss = returnRate x (landed product cost + outbound delivery cost):
   a returned unit loses its product cost and the outbound fulfillment/shipping,
   while platform percentage fees are assumed refunded by the platform. */
"use strict";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const clampPct = (v) => Math.min(Math.max(num(v), 0), 100) / 100;

function summarize(buyerTotal, feeLines, costLines) {
  const totalFees = feeLines.reduce((s, l) => s + l.amount, 0);
  const totalCosts = costLines.reduce((s, l) => s + l.amount, 0);
  const payout = buyerTotal - totalFees;
  const net = payout - totalCosts;
  return {
    buyerTotal: round2(buyerTotal), lines: [...feeLines, ...costLines],
    totalFees: round2(totalFees), totalCosts: round2(totalCosts),
    payout: round2(payout), netProfit: round2(net),
    margin: buyerTotal > 0 ? round2((net / buyerTotal) * 100) : 0,
    takeRate: buyerTotal > 0 ? round2((totalFees / buyerTotal) * 100) : 0
  };
}

/* ---------- Amazon ---------- */
function amazonCategory(id) { return FEES.amazon.categories.find(c => c.id === id) || FEES.amazon.categories[0]; }

function amazonReferral(catId, total) {
  const cat = amazonCategory(catId);
  let fee = 0;
  if (cat.type === "flat") fee = total * cat.rate;
  else if (cat.type === "priceBand") {
    const band = cat.bands.find(b => total <= b.upTo) || cat.bands[cat.bands.length - 1];
    fee = total * band.rate;
  } else if (cat.type === "marginal") {
    let prev = 0;
    for (const b of cat.bands) { const slice = Math.min(total, b.upTo) - prev; if (slice > 0) fee += slice * b.rate; prev = b.upTo; if (total <= b.upTo) break; }
  }
  fee = Math.max(fee, FEES.amazon.referralMin);
  if (cat.closing) fee += FEES.amazon.closingMediaFee;
  return round2(fee);
}

function amazonFulfillment(tier, weightLb, surchargeOn) {
  const F = FEES.amazon.fulfillment; const oz = weightLb * 16;
  let fee;
  if (tier === "smallStandard") fee = (F.smallStandard.find(b => oz <= b.maxOz) || F.smallStandard.at(-1)).fee;
  else if (tier === "largeStandard") fee = (F.largeStandard.find(b => weightLb <= b.maxLb) || F.largeStandard.at(-1)).fee;
  else if (tier === "smallOversize") { const o = F.smallOversize; fee = o.base + Math.max(0, Math.ceil(weightLb) - o.baseLb) * o.perLb; }
  else { const o = F.largeOversize; fee = o.base + Math.max(0, Math.ceil(weightLb) - o.baseLb) * o.perLb; }
  const surcharge = surchargeOn ? fee * FEES.amazon.fuelSurchargeRate : 0;
  return { fee: round2(fee), surcharge: round2(surcharge) };
}

function calcAmazon(i) {
  const price = num(i.price), ship = num(i.shippingCharged);
  const buyerTotal = price + ship;
  const adRate = clampPct(i.adRate), retRate = clampPct(i.returnRate);
  const fees = [];
  fees.push({ label: "Referral fee", amount: amazonReferral(i.category, buyerTotal) });
  let outbound = 0;
  if (i.method === "fba") {
    const f = amazonFulfillment(i.tier, num(i.weightLb, 1), i.fuelSurcharge !== false);
    fees.push({ label: "FBA fulfillment fee", amount: f.fee });
    if (f.surcharge > 0) fees.push({ label: "Fuel & logistics surcharge (3.5%)", amount: f.surcharge });
    outbound = f.fee + f.surcharge;
    const vol = num(i.lengthIn) * num(i.widthIn) * num(i.heightIn) / 1728;
    if (vol > 0) {
      const zone = (i.tier === "smallOversize" || i.tier === "largeOversize") ? "oversize" : "standard";
      const rate = FEES.amazon.storagePerCuFt[zone][i.seasonPeak ? "peak" : "regular"];
      const storage = vol * rate * num(i.monthsStored, 1);
      if (storage > 0.005) fees.push({ label: "Storage (avg. per unit sold)", amount: round2(storage) });
    }
    if (num(i.placementFee) > 0) fees.push({ label: "Inbound placement fee", amount: round2(num(i.placementFee)) });
  } else {
    outbound = num(i.ownShippingCost);
    if (outbound > 0) fees.push({ label: "Your shipping cost (FBM)", amount: round2(outbound) });
  }
  if (i.plan === "professional" && num(i.monthlyUnits) > 0)
    fees.push({ label: "Professional plan (per unit)", amount: round2(FEES.amazon.plans.professional / num(i.monthlyUnits)) });
  if (i.plan === "individual") fees.push({ label: "Individual plan fee", amount: FEES.amazon.plans.individualPerItem });

  const landed = num(i.cogs) + num(i.inboundPerUnit) + num(i.packaging);
  const costs = [
    { label: "Product cost (COGS)", amount: round2(num(i.cogs)) },
    { label: "Inbound shipping to platform", amount: round2(num(i.inboundPerUnit)) },
    { label: "Packaging", amount: round2(num(i.packaging)) },
    { label: "Advertising", amount: round2(adRate * price) },
    { label: "Expected returns loss", amount: round2(retRate * (landed + outbound)) }
  ];
  const r = summarize(buyerTotal, fees, costs);
  r.roi = (num(i.cogs) + num(i.inboundPerUnit)) > 0 ? round2(r.netProfit / (num(i.cogs) + num(i.inboundPerUnit)) * 100) : 0;
  r.profitBeforeAds = round2(r.netProfit + adRate * price);
  r.breakEvenAcos = price > 0 ? round2(Math.max(0, r.profitBeforeAds) / price * 100) : 0;
  return r;
}

/* ---------- Etsy ---------- */
function calcEtsy(i) {
  const c = FEES.etsy.countries.find(x => x.id === i.country) || FEES.etsy.countries[0];
  const price = num(i.price), ship = num(i.shippingCharged), gift = num(i.giftWrap);
  const buyerTotal = price + ship + gift;
  const adRate = clampPct(i.adRate), retRate = clampPct(i.returnRate);
  const fees = [{ label: "Listing fee", amount: FEES.etsy.listingFee }];
  fees.push({ label: "Transaction fee (6.5%)", amount: round2(buyerTotal * FEES.etsy.transactionRate) });
  fees.push({ label: `Payment processing (${(c.processingRate * 100).toFixed(1)}% + ${c.symbol}${c.processingFixed.toFixed(2)})`,
              amount: round2(buyerTotal * c.processingRate + c.processingFixed) });
  if (c.regulatoryRate > 0) fees.push({ label: "Regulatory operating fee", amount: round2(buyerTotal * c.regulatoryRate) });
  if (i.offsiteMode && i.offsiteMode !== "none") {
    const rate = FEES.etsy.offsiteRates[i.shopTier === "over10k" ? "over10k" : "under10k"];
    let off = Math.min(buyerTotal * rate, FEES.etsy.offsiteCap);
    if (i.offsiteMode === "amortized") off *= clampPct(i.offsiteSharePct ?? 20); // spread across all orders by the share that comes from Offsite Ads
    if (off > 0.004) fees.push({ label: `Offsite Ads (${(rate * 100)}%${i.offsiteMode === "amortized" ? ", amortized" : ""})`, amount: round2(off) });
  }
  if (i.currencyConversion) fees.push({ label: "Currency conversion (2.5%)", amount: round2(buyerTotal * FEES.etsy.currencyConversionRate) });

  const shipCost = num(i.shippingCostActual);
  const costs = [
    { label: "Product cost (COGS)", amount: round2(num(i.cogs)) },
    { label: "Your actual shipping cost", amount: round2(shipCost) },
    { label: "Packaging", amount: round2(num(i.packaging)) },
    { label: "Advertising (Etsy Ads / other)", amount: round2(adRate * price) },
    { label: "Expected returns loss", amount: round2(retRate * (num(i.cogs) + shipCost + num(i.packaging))) }
  ];
  const r = summarize(buyerTotal, fees, costs);
  r.profitBeforeAds = round2(r.netProfit + adRate * price);
  r.breakEvenAcos = price > 0 ? round2(Math.max(0, r.profitBeforeAds) / price * 100) : 0;
  return r;
}

/* ---------- Comparison (lite per-platform models) ---------- */
function calcComparison(i) {
  const price = num(i.price), ship = num(i.shippingCharged);
  const buyerTotal = price + ship;
  const adRate = clampPct(i.adRate), retRate = clampPct(i.returnRate), affRate = clampPct(i.affiliateRate);
  const shared = { cogs: i.cogs, inboundPerUnit: i.inboundPerUnit, packaging: i.packaging };

  const amazonFBA = calcAmazon({ ...i, ...shared, method: "fba", category: "home", tier: num(i.weightLb, 1) <= 1 ? "smallStandard" : "largeStandard",
    plan: num(i.monthlyUnits) > 0 ? "professional" : "none", lengthIn: 0, widthIn: 0, heightIn: 0, monthsStored: 1, placementFee: 0, fuelSurcharge: true });
  const amazonFBM = calcAmazon({ ...i, ...shared, method: "fbm", category: "home", ownShippingCost: i.ownShippingCost,
    plan: num(i.monthlyUnits) > 0 ? "professional" : "none" });
  const etsy = calcEtsy({ ...i, ...shared, country: "US", shippingCostActual: i.ownShippingCost, giftWrap: 0, offsiteMode: "none" });

  const ebayFees = [
    { label: "Final value fee (13.6% on total incl. shipping)", amount: round2(buyerTotal * FEES.ebay.defaultRate) },
    { label: "Per-order fee", amount: buyerTotal <= FEES.ebay.perOrderThreshold ? FEES.ebay.perOrderLow : FEES.ebay.perOrderHigh }
  ];
  const ebay = summarize(buyerTotal, ebayFees, [
    { label: "Product cost (COGS)", amount: round2(num(i.cogs)) },
    { label: "Inbound shipping", amount: round2(num(i.inboundPerUnit)) },
    { label: "Packaging", amount: round2(num(i.packaging)) },
    { label: "Your shipping cost", amount: round2(num(i.ownShippingCost)) },
    { label: "Advertising", amount: round2(adRate * price) },
    { label: "Expected returns loss", amount: round2(retRate * (num(i.cogs) + num(i.inboundPerUnit) + num(i.packaging) + num(i.ownShippingCost))) }
  ]);

  const plan = FEES.shopify.plans.find(p => p.id === i.shopifyPlan) || FEES.shopify.plans[0];
  const shopFees = [
    { label: "Card processing (Shopify Payments)", amount: round2(buyerTotal * plan.cardRate + plan.cardFixed) }
  ];
  if (num(i.monthlyUnits) > 0) shopFees.push({ label: `${plan.label.split(" (")[0]} plan (per order)`, amount: round2(plan.monthly / num(i.monthlyUnits)) });
  const shopify = summarize(buyerTotal, shopFees, [
    { label: "Product cost (COGS)", amount: round2(num(i.cogs)) },
    { label: "Inbound shipping", amount: round2(num(i.inboundPerUnit)) },
    { label: "Packaging", amount: round2(num(i.packaging)) },
    { label: "Your shipping cost", amount: round2(num(i.ownShippingCost)) },
    { label: "Advertising", amount: round2(adRate * price) },
    { label: "Expected returns loss", amount: round2(retRate * (num(i.cogs) + num(i.inboundPerUnit) + num(i.packaging) + num(i.ownShippingCost))) }
  ]);

  const tiktokFees = [{ label: "Referral fee (6%)", amount: round2(buyerTotal * FEES.tiktok.referralRate) }];
  if (affRate > 0) tiktokFees.push({ label: "Creator affiliate commission", amount: round2(price * affRate) });
  const tiktok = summarize(buyerTotal, tiktokFees, [
    { label: "Product cost (COGS)", amount: round2(num(i.cogs)) },
    { label: "Inbound shipping", amount: round2(num(i.inboundPerUnit)) },
    { label: "Packaging", amount: round2(num(i.packaging)) },
    { label: "Your shipping cost (or TikTok logistics)", amount: round2(num(i.ownShippingCost)) },
    { label: "Advertising", amount: round2(adRate * price) },
    { label: "Expected returns loss", amount: round2(retRate * (num(i.cogs) + num(i.inboundPerUnit) + num(i.packaging) + num(i.ownShippingCost))) }
  ]);

  return [
    { id: "amazon-fba", name: "Amazon FBA", result: amazonFBA },
    { id: "amazon-fbm", name: "Amazon FBM", result: amazonFBM },
    { id: "etsy", name: "Etsy", result: etsy },
    { id: "ebay", name: "eBay", result: ebay },
    { id: "shopify", name: "Shopify", result: shopify },
    { id: "tiktok", name: "TikTok Shop", result: tiktok }
  ].sort((a, b) => b.result.netProfit - a.result.netProfit);
}

/* Generic break-even price solver: find price where netProfit = 0 (binary search). */
function breakEvenPrice(calcFn, baseInput) {
  const f = (p) => calcFn({ ...baseInput, price: p }).netProfit;
  let lo = 0.01, hi = 100000;
  if (f(hi) < 0) return null;
  for (let n = 0; n < 60; n++) { const mid = (lo + hi) / 2; (f(mid) >= 0 ? hi = mid : lo = mid); }
  return round2(hi);
}

/* ---------- eBay ---------- */
function ebayCategory(id) { return FEES.ebay.categories.find(c => c.id === id) || FEES.ebay.categories[0]; }
function ebayFVF(catId, base, rateOverride) {
  if (rateOverride > 0) return round2(base * rateOverride);
  const cat = ebayCategory(catId);
  if (cat.type === "flat") return round2(base * cat.rate);
  let fee = 0, prev = 0;
  for (const b of cat.bands) { const slice = Math.min(base, b.upTo) - prev; if (slice > 0) fee += slice * b.rate; prev = b.upTo; if (base <= b.upTo) break; }
  return round2(fee);
}
function calcEbay(i) {
  const price = num(i.price), ship = num(i.shippingCharged);
  const taxedTotal = (price + ship) * (1 + clampPct(i.taxRatePct));
  const adRate = clampPct(i.adRate), retRate = clampPct(i.returnRate);
  let fvf = ebayFVF(i.category, taxedTotal, num(i.rateOverridePct) > 0 ? num(i.rateOverridePct) / 100 : 0);
  if (i.topRatedPlus) fvf = round2(fvf * 0.9);
  const fees = [{ label: `Final value fee${i.topRatedPlus ? " (Top Rated Plus −10%)" : ""}`, amount: fvf }];
  fees.push({ label: "Per-order fee", amount: taxedTotal <= FEES.ebay.perOrderThreshold ? FEES.ebay.perOrderLow : FEES.ebay.perOrderHigh });
  if (clampPct(i.promotedRatePct) > 0) fees.push({ label: "Promoted Listings fee", amount: round2(taxedTotal * clampPct(i.promotedRatePct)) });
  if (i.international) fees.push({ label: "International fee (1.65%)", amount: round2(taxedTotal * FEES.ebay.internationalRate) });
  if (num(i.monthlyOrders) > 0 && num(i.monthlyListings) > FEES.ebay.insertionFreePerMonth)
    fees.push({ label: "Insertion fees (amortized)", amount: round2((num(i.monthlyListings) - FEES.ebay.insertionFreePerMonth) * FEES.ebay.insertionFee / num(i.monthlyOrders)) });
  const shipCost = num(i.ownShippingCost);
  const costs = [
    { label: "Product cost (COGS)", amount: round2(num(i.cogs)) },
    { label: "Inbound shipping", amount: round2(num(i.inboundPerUnit)) },
    { label: "Packaging", amount: round2(num(i.packaging)) },
    { label: "Your shipping cost", amount: round2(shipCost) },
    { label: "Advertising (off-eBay)", amount: round2(adRate * price) },
    { label: "Expected returns loss", amount: round2(retRate * (num(i.cogs) + num(i.inboundPerUnit) + num(i.packaging) + shipCost)) }
  ];
  const r = summarize(price + ship, fees, costs);
  r.fvfBase = round2(taxedTotal);
  return r;
}

/* ---------- TikTok Shop ---------- */
function calcTiktok(i) {
  const price = num(i.price), ship = num(i.shippingCharged);
  const buyerTotal = price + ship;
  const adRate = clampPct(i.adRate), retRate = clampPct(i.returnRate), affRate = clampPct(i.affiliateRate);
  const refRate = num(i.referralRatePct, 6) / 100;
  const referral = round2(buyerTotal * refRate);
  const fees = [{ label: `Referral fee (${num(i.referralRatePct, 6)}%)`, amount: referral }];
  if (affRate > 0) fees.push({ label: "Creator affiliate commission", amount: round2(price * affRate) });
  const shipCost = num(i.shippingCost);
  const costs = [
    { label: "Product cost (COGS)", amount: round2(num(i.cogs)) },
    { label: "Inbound freight (to FBT / warehouse)", amount: round2(num(i.inboundPerUnit)) },
    { label: "Packaging", amount: round2(num(i.packaging)) },
    { label: i.shippingMode === "fbt" ? "FBT fulfillment & delivery" : "Your shipping cost", amount: round2(shipCost) },
    { label: "Shop ads", amount: round2(adRate * price) },
    { label: "Expected returns loss", amount: round2(retRate * (num(i.cogs) + num(i.inboundPerUnit) + num(i.packaging) + shipCost)) },
    { label: "Expected refund admin fees", amount: round2(retRate * Math.min(referral * FEES.tiktok.refundAdminShare, FEES.tiktok.refundAdminCap)) }
  ];
  return summarize(buyerTotal, fees, costs);
}

/* ---------- Shopify ---------- */
function shopifyPlan(id) { return FEES.shopify.plans.find(p => p.id === id) || FEES.shopify.plans[0]; }
function calcShopify(i) {
  const plan = shopifyPlan(i.plan);
  const price = num(i.price), ship = num(i.shippingCharged);
  const buyerTotal = price + ship;
  const adRate = clampPct(i.adRate), retRate = clampPct(i.returnRate);
  const planMonthly = i.billing === "annual" ? plan.annualMonthly : plan.monthly;
  const fees = [{ label: `Card processing (${(plan.cardRate * 100).toFixed(1)}% + $0.30)`, amount: round2(buyerTotal * plan.cardRate + plan.cardFixed) }];
  if (i.payments === "thirdparty") fees.push({ label: "Third-party gateway extra fee", amount: round2(buyerTotal * plan.thirdPartyExtra) });
  if (num(i.monthlyUnits) > 0) {
    fees.push({ label: `${plan.label} plan (per order)`, amount: round2(planMonthly / num(i.monthlyUnits)) });
    if (num(i.appsMonthly) > 0) fees.push({ label: "Apps (per order)", amount: round2(num(i.appsMonthly) / num(i.monthlyUnits)) });
  }
  const shipCost = num(i.ownShippingCost);
  const costs = [
    { label: "Product cost (COGS)", amount: round2(num(i.cogs)) },
    { label: "Inbound shipping", amount: round2(num(i.inboundPerUnit)) },
    { label: "Packaging", amount: round2(num(i.packaging)) },
    { label: "Your shipping cost", amount: round2(shipCost) },
    { label: "Advertising", amount: round2(adRate * price) },
    { label: "Expected returns loss", amount: round2(retRate * (num(i.cogs) + num(i.inboundPerUnit) + num(i.packaging) + shipCost)) }
  ];
  return summarize(buyerTotal, fees, costs);
}
function shopifyPlanComparison(i) {
  return FEES.shopify.plans.map(p => {
    const r = calcShopify({ ...i, plan: p.id });
    const units = Math.max(num(i.monthlyUnits), 0);
    return { plan: p.label, perOrder: r.netProfit, monthly: round2(r.netProfit * units), feesPerOrder: r.totalFees };
  }).sort((a, b) => b.perOrder - a.perOrder);
}

/* Solve the price that hits a target: mode "profit" ($ per sale) or "margin" (% of buyer total). */
function solvePrice(calcFn, baseInput, mode, target) {
  const f = (p) => { const r = calcFn({ ...baseInput, price: p }); return mode === "margin" ? r.netProfit - (target / 100) * r.buyerTotal : r.netProfit - target; };
  let lo = 0.01, hi = 100000;
  if (f(hi) < 0) return null;
  for (let n = 0; n < 60; n++) { const mid = (lo + hi) / 2; (f(mid) >= 0 ? hi = mid : lo = mid); }
  const price = round2(hi);
  return { price, result: calcFn({ ...baseInput, price }) };
}

if (typeof module !== "undefined" && module.exports) module.exports = { calcAmazon, calcEtsy, calcComparison, calcEbay, calcTiktok, calcShopify, shopifyPlanComparison, solvePrice, breakEvenPrice, amazonReferral, amazonFulfillment, ebayFVF };
