import { MS_PER_DAY } from "../constants";

export const BASE_COINS_PER_DAY = 5;

export function calculatePendingCoins(
  lastCoinsClaimAt: Date,
  now: Date = new Date()
): number {
  const msElapsed = Math.max(0, now.getTime() - lastCoinsClaimAt.getTime());
  return BASE_COINS_PER_DAY * (msElapsed / MS_PER_DAY);
}
