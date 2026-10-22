const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTileQuote } = require('../assets/tile-calculator.js');

const defaults = {
  area: 500,
  coverage: 15.5,
  waste: 10,
  costPerBox: 32,
  delivery: 150,
  labor: 600,
  margin: 35,
};

function calculate(overrides = {}) {
  return calculateTileQuote({ ...defaults, ...overrides });
}

function closeTo(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
}

test('default worked example returns full-box costs and rounded quote', () => {
  const result = calculate();
  assert.deepEqual(result.errors, {});
  assert.equal(result.boxes, 36);
  assert.equal(result.requiredArea, 550);
  assert.equal(result.orderedArea, 558);
  assert.equal(result.materialCost, 1152);
  assert.equal(result.totalCost, 1902);
  closeTo(result.exactQuote, 1902 / 0.65);
  assert.equal(result.quote, 2926.16);
  closeTo(result.profit, 1024.16);
  closeTo(result.grossMargin, 1024.16 / 2926.16 * 100);
});

test('supports no waste, zero labor, and a zero target margin', () => {
  const result = calculate({ area: 10, coverage: 6, waste: 0, costPerBox: 5, delivery: 2, labor: 0, margin: 0 });
  assert.deepEqual(result.errors, {});
  assert.equal(result.boxes, 2);
  assert.equal(result.requiredArea, 10);
  assert.equal(result.materialCost, 10);
  assert.equal(result.totalCost, 12);
  assert.equal(result.exactQuote, 12);
  assert.equal(result.quote, 12);
  assert.equal(result.profit, 0);
  assert.equal(result.grossMargin, 0);
});

test('uses the exact formula at a 99.9% margin and rounds the displayed quote upward to cents', () => {
  const result = calculate({ area: 1, coverage: 1, waste: 0, costPerBox: 10, delivery: 0, labor: 0, margin: 99.9 });
  assert.deepEqual(result.errors, {});
  assert.equal(result.totalCost, 10);
  closeTo(result.exactQuote, 10000, 2e-9);
  assert.equal(result.quote, 10000);
  assert.equal(result.profit, 9990);
  closeTo(result.grossMargin, 99.9);

  const fractional = calculate({ area: 1, coverage: 1, waste: 0, costPerBox: 1.001, delivery: 0, labor: 0, margin: 0 });
  assert.equal(fractional.exactQuote, 1.001);
  assert.equal(fractional.quote, 1.01);
  assert.equal(fractional.profit, 0.009000000000000119);
  closeTo(fractional.grossMargin, fractional.profit / fractional.quote * 100);
});

test('rejects 100% and negative margins', () => {
  assert.match(calculate({ margin: 100 }).errors.margin, /less than 100/);
  assert.match(calculate({ margin: -0.01 }).errors.margin, /cannot be negative/);
});

test('rejects empty, NaN, Infinity, and negative-cost inputs', () => {
  const empty = calculateTileQuote({});
  for (const key of Object.keys(defaults)) assert.ok(empty.errors[key], `missing error for ${key}`);

  for (const value of [NaN, Infinity, -Infinity]) {
    const result = calculate({ delivery: value });
    assert.match(result.errors.delivery, /valid number/);
  }

  for (const key of ['waste', 'costPerBox', 'delivery', 'labor']) {
    const result = calculate({ [key]: -1 });
    assert.match(result.errors[key], /cannot be negative/);
  }
});

test('rejects zero or negative project area and coverage', () => {
  for (const key of ['area', 'coverage']) {
    for (const value of [0, -1]) {
      const result = calculate({ [key]: value });
      assert.match(result.errors[key], /greater than zero/);
    }
  }
});

test('returns N/A gross margin when all costs and revenue are zero', () => {
  const result = calculate({ area: 1, coverage: 1, waste: 0, costPerBox: 0, delivery: 0, labor: 0, margin: 0 });
  assert.deepEqual(result.errors, {});
  assert.equal(result.boxes, 1);
  assert.equal(result.materialCost, 0);
  assert.equal(result.totalCost, 0);
  assert.equal(result.exactQuote, 0);
  assert.equal(result.quote, 0);
  assert.equal(result.profit, 0);
  assert.equal(result.grossMargin, null);
});

test('does not add a spurious box at the floating-point boundary', () => {
  const result = calculate({ area: 100, coverage: 10, waste: 10, costPerBox: 1, delivery: 0, labor: 0, margin: 0 });
  assert.deepEqual(result.errors, {});
  assert.equal(result.requiredArea, 110.00000000000001);
  assert.equal(result.boxes, 11);
});

test('handles decimal coverage with ordinary ceiling semantics', () => {
  const result = calculate({ area: 10, coverage: 3.3, waste: 0, costPerBox: 2, delivery: 0, labor: 0, margin: 0 });
  assert.deepEqual(result.errors, {});
  assert.equal(result.boxes, 4);
  assert.equal(result.orderedArea, 13.2);
  assert.equal(result.materialCost, 8);
});

test('fails safely for values too large to calculate reliably', () => {
  const result = calculate({ area: Number.MAX_VALUE, coverage: 1, waste: 0, costPerBox: 1, delivery: 0, labor: 0, margin: 0 });
  assert.equal(Object.keys(result.errors).length, 1);
  assert.match(result.errors.calculation, /too large to calculate reliably/);
  assert.equal(result.boxes, undefined);
});
