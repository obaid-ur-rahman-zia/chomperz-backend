const {
  getEconomyBreakdown,
  buildNftListFromCount,
  calculateOfflineEarnings,
} = require("../dist/lib/economy");

const nfts = buildNftListFromCount(5);
const breakdown = getEconomyBreakdown({ nfts, powerLvl: 0 });
console.log("5 NFT economy:", breakdown);

const earned = calculateOfflineEarnings(
  breakdown.dailyRate,
  new Date(Date.now() - 24 * 60 * 60 * 1000)
);
console.log("24h offline earnings:", earned.toFixed(4));
console.log("Economy smoke tests passed");
