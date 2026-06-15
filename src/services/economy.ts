import {
  calculateDailyRate,
  calculateOfflineEarnings,
  getEconomyBreakdown,
  nftsFromCachedTokenIds,
  buildNftListFromCount,
} from "../lib/economy";
import type { IPlayer } from "../models/Player";

export function getPlayerNfts(player: IPlayer) {
  if (player.cachedTokenIds.length > 0) {
    return nftsFromCachedTokenIds(player.cachedTokenIds);
  }
  if (player.cachedNftCount > 0) {
    return buildNftListFromCount(player.cachedNftCount);
  }
  return [];
}

export function getPlayerEconomy(player: IPlayer) {
  const nfts = getPlayerNfts(player);
  const breakdown = getEconomyBreakdown({ nfts, powerLvl: player.powerLvl });
  const pendingEarnings = calculateOfflineEarnings(
    breakdown.dailyRate,
    player.lastClaimedAt
  );
  return { nfts, breakdown, pendingEarnings };
}

export function getDailyRate(player: IPlayer): number {
  const nfts = getPlayerNfts(player);
  return calculateDailyRate({ nfts, powerLvl: player.powerLvl });
}
