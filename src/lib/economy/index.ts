import { BASE_Z_COINS_PER_DAY } from "./types";
import {
  buildNftListFromTokenIds,
  calculateNftMultiplier,
  calculatePowerMultiplier,
  calculateQuantityBoost,
  calculateRarityBoost,
} from "./economy";
import type { EconomyBreakdown, NftToken, PlayerEconomyInput } from "./types";

export function calculateDailyRate(input: PlayerEconomyInput): number {
  return (
    BASE_Z_COINS_PER_DAY *
    calculateNftMultiplier(input.nfts) *
    calculatePowerMultiplier(input.powerLvl)
  );
}

export function getEconomyBreakdown(input: PlayerEconomyInput): EconomyBreakdown {
  const nftCount = input.nfts.length;
  const quantityBoost = calculateQuantityBoost(nftCount);
  const rarityBoost = calculateRarityBoost(input.nfts);
  const nftMultiplier = calculateNftMultiplier(input.nfts);
  const powerMultiplier = calculatePowerMultiplier(input.powerLvl);
  return {
    nftCount,
    quantityBoost,
    rarityBoost,
    nftMultiplier,
    powerMultiplier,
    dailyRate: BASE_Z_COINS_PER_DAY * nftMultiplier * powerMultiplier,
  };
}

export function calculateOfflineEarnings(
  dailyRate: number,
  lastClaimedAt: Date,
  now: Date = new Date()
): number {
  const msElapsed = Math.max(0, now.getTime() - lastClaimedAt.getTime());
  return dailyRate * (msElapsed / (24 * 60 * 60 * 1000));
}

export function nftsFromCachedTokenIds(tokenIds: number[]): NftToken[] {
  return tokenIds.length > 0 ? buildNftListFromTokenIds(tokenIds) : [];
}

export * from "./types";
export * from "./economy";
