import { creditBalance, getBalances } from "./resources";

/** Dev-only starting balances — only when DEV_RICH_MODE is explicitly set in .env */
export function isDevRichMode(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const flag = process.env.DEV_RICH_MODE?.trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export function devStartingBalances(): { coins: number; zCoins: number } {
  return {
    coins: Math.max(0, Number(process.env.DEV_STARTING_COINS ?? "100000") || 0),
    zCoins: Math.max(0, Number(process.env.DEV_STARTING_ZCOINS ?? "100000") || 0),
  };
}

/** Top up coins/zCoins to at least dev minimums (no-op in production or when disabled). */
export async function ensureDevStartingBalances(userId: string): Promise<void> {
  if (!isDevRichMode()) return;

  const targets = devStartingBalances();
  const { coins, zCoins } = await getBalances(userId);

  if (coins < targets.coins) {
    await creditBalance(userId, "coins", targets.coins - coins, "dev_grant", { reason: "dev_rich_mode" });
  }
  if (zCoins < targets.zCoins) {
    await creditBalance(userId, "zCoins", targets.zCoins - zCoins, "dev_grant", { reason: "dev_rich_mode" });
  }
}
