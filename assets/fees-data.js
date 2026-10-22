/* Fee schedules, versioned. Update this file when platforms change rates.
   Every rate carries its source context in the page copy; figures verified 2026-10-22. */
const FEES = {
  version: "2026.1",
  verified: "2026-10-22",

  amazon: {
    plans: { professional: 39.99, individualPerItem: 0.99 },
    referralMin: 0.30,
    closingMediaFee: 1.80, // books, DVD, music, software, video games, consoles
    fuelSurchargeRate: 0.035, // on FBA fulfillment fees, from 2026-04-17
    /* type flat: rate on (price + shipping charged)
       type priceBand: single rate chosen by total price band, applied to (price + shipping charged)
       type marginal: rates applied to portions of (price + shipping charged) */
    categories: [
      { id: "home",        label: "Home & Kitchen",                 type: "flat", rate: 0.15 },
      { id: "toys",        label: "Toys & Games",                   type: "flat", rate: 0.15 },
      { id: "sports",      label: "Sports & Outdoors",              type: "flat", rate: 0.15 },
      { id: "office",      label: "Office Products",                type: "flat", rate: 0.15 },
      { id: "tools",       label: "Tools & Home Improvement",       type: "flat", rate: 0.15 },
      { id: "everything",  label: "Everything Else",                type: "flat", rate: 0.15 },
      { id: "electronics", label: "Electronics",                    type: "flat", rate: 0.08 },
      { id: "computers",   label: "Computers",                      type: "flat", rate: 0.08 },
      { id: "automotive",  label: "Automotive & Powersports",       type: "flat", rate: 0.12 },
      { id: "grocery",     label: "Grocery & Gourmet",              type: "priceBand", bands: [{ upTo: 15, rate: 0.08 }, { upTo: Infinity, rate: 0.15 }] },
      { id: "beauty",      label: "Beauty, Health & Personal Care", type: "priceBand", bands: [{ upTo: 10, rate: 0.08 }, { upTo: Infinity, rate: 0.15 }] },
      { id: "clothing",    label: "Clothing & Accessories",         type: "priceBand", bands: [{ upTo: 15, rate: 0.05 }, { upTo: 20, rate: 0.10 }, { upTo: Infinity, rate: 0.17 }] },
      { id: "jewelry",     label: "Jewelry",                        type: "marginal", bands: [{ upTo: 250, rate: 0.20 }, { upTo: Infinity, rate: 0.05 }] },
      { id: "books",       label: "Books (media, +$1.80 closing)",  type: "flat", rate: 0.15, closing: true },
      { id: "giftcards",   label: "Gift Cards",                     type: "flat", rate: 0.20 },
      { id: "deviceacc",   label: "Amazon Device Accessories",      type: "flat", rate: 0.45 }
    ],
    /* 2026 published standard-size schedule, $10-$50 price band, rounded.
       Exact fees vary by price band (<$10 / $10-$50 / >$50) — verify in Seller Central. */
    fulfillment: {
      smallStandard: [ // by weight, oz
        { maxOz: 2, fee: 2.43 }, { maxOz: 4, fee: 2.66 }, { maxOz: 6, fee: 3.06 },
        { maxOz: 8, fee: 3.15 }, { maxOz: 10, fee: 3.30 }, { maxOz: 12, fee: 3.43 },
        { maxOz: 14, fee: 3.62 }, { maxOz: 16, fee: 3.86 }
      ],
      largeStandard: [ // by weight, lb
        { maxLb: 1.5, fee: 4.47 }, { maxLb: 2, fee: 4.90 }, { maxLb: 2.5, fee: 5.15 },
        { maxLb: 3, fee: 5.44 }, { maxLb: 4, fee: 6.05 }, { maxLb: 5, fee: 6.55 },
        { maxLb: 7, fee: 7.30 }, { maxLb: 10, fee: 8.35 }, { maxLb: 15, fee: 9.40 },
        { maxLb: 20, fee: 9.73 }
      ],
      smallOversize: { base: 9.73, baseLb: 1, perLb: 0.42, maxLb: 70 },
      largeOversize: { base: 89.98, baseLb: 90, perLb: 0.83, maxLb: 150 }
    },
    storagePerCuFt: { // monthly
      standard: { regular: 0.78, peak: 2.40 },   // Jan-Sep / Oct-Dec
      oversize: { regular: 0.56, peak: 1.40 }
    }
  },

  etsy: {
    listingFee: 0.20,
    transactionRate: 0.065, // on price + shipping charged + gift wrap
    offsiteRates: { under10k: 0.15, over10k: 0.12 },
    offsiteCap: 100,
    currencyConversionRate: 0.025,
    countries: [
      { id: "US", label: "United States",  symbol: "$", processingRate: 0.03, processingFixed: 0.25, regulatoryRate: 0 },
      { id: "UK", label: "United Kingdom", symbol: "£", processingRate: 0.04, processingFixed: 0.20, regulatoryRate: 0.0048 },
      { id: "CA", label: "Canada",         symbol: "$", processingRate: 0.03, processingFixed: 0.25, regulatoryRate: 0.0050 },
      { id: "AU", label: "Australia",      symbol: "$", processingRate: 0.03, processingFixed: 0.25, regulatoryRate: 0 },
      { id: "DE", label: "Germany",        symbol: "€", processingRate: 0.04, processingFixed: 0.30, regulatoryRate: 0 },
      { id: "FR", label: "France",         symbol: "€", processingRate: 0.04, processingFixed: 0.30, regulatoryRate: 0.0114 }
    ]
  },

  ebay: { // US site. Most sellers have no store; store plans mainly cut FVF by category-specific amounts.
    perOrderLow: 0.30, perOrderHigh: 0.40, perOrderThreshold: 10, // threshold applies to total incl. tax
    internationalRate: 0.0165,
    insertionFreePerMonth: 250, insertionFee: 0.35,
    defaultRate: 0.136,
    /* marginal = rate applies to the portion of the total within each band */
    categories: [
      { id: "most",        label: "Most categories",                    type: "flat", rate: 0.136 },
      { id: "clothing",    label: "Clothing, Shoes & Accessories",      type: "flat", rate: 0.136 },
      { id: "books",       label: "Books, Movies & Music (media)",      type: "flat", rate: 0.153 },
      { id: "cards",       label: "Trading Cards",                      type: "flat", rate: 0.130 },
      { id: "handbags",    label: "Women's Handbags",                   type: "marginal", bands: [{ upTo: 100, rate: 0.15 }, { upTo: Infinity, rate: 0.09 }] },
      { id: "watches",     label: "Watches",                            type: "marginal", bands: [{ upTo: 1000, rate: 0.15 }, { upTo: Infinity, rate: 0.065 }] },
      { id: "instruments", label: "Guitars & Basses",                   type: "flat", rate: 0.0635 }
    ]
  },

  shopify: {
    plans: [
      { id: "basic",    label: "Basic",    monthly: 39,  annualMonthly: 29,  cardRate: 0.029, cardFixed: 0.30, thirdPartyExtra: 0.02 },
      { id: "grow",     label: "Grow",     monthly: 105, annualMonthly: 79,  cardRate: 0.027, cardFixed: 0.30, thirdPartyExtra: 0.01 },
      { id: "advanced", label: "Advanced", monthly: 399, annualMonthly: 299, cardRate: 0.025, cardFixed: 0.30, thirdPartyExtra: 0.006 }
    ]
  },

  tiktok: { // US
    referralRate: 0.06,          // most categories; jewelry & pre-owned 0.05
    referralRateAlt: 0.05,
    refundAdminShare: 0.20,      // of the referral fee on refunded orders
    refundAdminCap: 5            // per SKU
  }
};
