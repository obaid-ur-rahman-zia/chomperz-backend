const assert = require("assert");
const {
  getUpgradeTimerHours,
  woodcuttingYieldPct,
  miningYieldPct,
  xpToNextLevel,
  BASE_COINS_PER_DAY,
  actionDurationMs,
  GATHER_XP,
  CRAFT_XP,
  CARPENTRY_INPUT,
  SMITHING_INPUT,
} = require("../dist/lib/formulas");
const {
  calculateQuantityBoost,
  calculateRarityBoost,
  calculatePowerMultiplier,
  getUpgradeCost,
  buildNftListFromTokenIds,
} = require("../dist/lib/economy");
const { BASE_Z_COINS_PER_DAY } = require("../dist/lib/economy/types");
const { FURNITURE_CATALOG } = require("../dist/data/furniture");

// ── Stat upgrade timer ──
assert.ok(Math.abs(getUpgradeTimerHours(0) - 12) < 0.01, "L0 timer ~12h");
assert.ok(Math.abs(getUpgradeTimerHours(100) - 1) < 0.15, "L100 timer ~1h");

// ── Upgrade cost 1.065^L ──
assert.strictEqual(getUpgradeCost(0), 1);
assert.strictEqual(getUpgradeCost(1), 2);

// ── Power P = 1.015^L ──
assert.ok(Math.abs(calculatePowerMultiplier(0) - 1) < 0.0001);
assert.ok(Math.abs(calculatePowerMultiplier(10) - Math.pow(1.015, 10)) < 0.0001);

// ── Z-Coin base ──
assert.strictEqual(BASE_Z_COINS_PER_DAY, 1);

// ── Coins base ──
assert.strictEqual(BASE_COINS_PER_DAY, 5);

// ── NFT quantity boost ──
assert.strictEqual(calculateQuantityBoost(1), 0.25);
assert.strictEqual(calculateQuantityBoost(3), 0.75);
assert.ok(Math.abs(calculateQuantityBoost(5) - 1.05) < 0.001);

// ── NFT rarity boost ──
const nfts = buildNftListFromTokenIds([50, 500, 5000]);
assert.ok(Math.abs(calculateRarityBoost(nfts) - (0.25 + 0.12 + 0.05)) < 0.001);

// ── Skill yields L1 & L10 ──
assert.strictEqual(Math.round(woodcuttingYieldPct(1)), 10);
assert.strictEqual(Math.round(woodcuttingYieldPct(10)), 11);
assert.strictEqual(Math.round(miningYieldPct(1)), 5);

// ── Skill XP L1 ──
assert.strictEqual(xpToNextLevel("woodcutting", 1), 100);
assert.strictEqual(xpToNextLevel("mining", 1), 100);
assert.strictEqual(xpToNextLevel("carpentry", 1), 100);
assert.strictEqual(xpToNextLevel("smithing", 1), 100);

// ── Skill durations (FORMULAS.md fixed timers) ──
assert.strictEqual(actionDurationMs("woodcutting"), 4000);
assert.strictEqual(actionDurationMs("mining"), 4000);
assert.strictEqual(actionDurationMs("carpentry"), 60000);
assert.strictEqual(actionDurationMs("smithing"), 60000);

// ── Skill XP rewards ──
assert.strictEqual(GATHER_XP, 10);
assert.strictEqual(CRAFT_XP, 50);
assert.strictEqual(CARPENTRY_INPUT, 100);
assert.strictEqual(SMITHING_INPUT, 100);

// ── Store catalog (FORMULAS.md prices) ──
const byId = Object.fromEntries(FURNITURE_CATALOG.map((i) => [i.id, i]));
assert.deepStrictEqual(byId.wood_chair.cost, { coins: 10, plank: 25 });
assert.deepStrictEqual(byId.wood_table.cost, { coins: 50, plank: 100 });
assert.deepStrictEqual(byId.wood_floor.cost, { coins: 5, plank: 20 });
assert.deepStrictEqual(byId.iron_chair.cost, { coins: 20, ingot: 25 });
assert.deepStrictEqual(byId.iron_table.cost, { coins: 100, ingot: 100 });
assert.deepStrictEqual(byId.iron_floor.cost, { coins: 10, ingot: 20 });
assert.deepStrictEqual(byId.fancy_chair.cost, { zCoins: 15 });
assert.deepStrictEqual(byId.fancy_table.cost, { zCoins: 50 });
assert.deepStrictEqual(byId.fancy_floor.cost, { zCoins: 10 });
assert.deepStrictEqual(byId.fancy_statue.cost, { zCoins: 500 });

console.log("smoke-formulas: all 30+ checks passed");
