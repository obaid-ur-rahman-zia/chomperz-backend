import { Router, Request, Response } from "express";
import { User } from "../models/User";
import { creditBalance } from "../services/resources";

const router = Router();

function normalizeHandle(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

router.post("/grant", async (req: Request, res: Response) => {
  const { secret, handle, coins, zCoins } = req.body as {
    secret?: string;
    handle?: string;
    coins?: number;
    zCoins?: number;
  };

  const adminSecret = process.env.ADMIN_SECRET?.trim();
  if (!adminSecret) {
    res.status(503).json({ error: "ADMIN_SECRET is not configured on the server" });
    return;
  }

  if (!secret || secret !== adminSecret) {
    res.status(403).json({ error: "Invalid admin secret" });
    return;
  }

  if (!handle?.trim()) {
    res.status(400).json({ error: "handle is required (e.g. @username)" });
    return;
  }

  const coinAmount = Number(coins ?? 0);
  const zCoinAmount = Number(zCoins ?? 0);

  if (!Number.isFinite(coinAmount) || coinAmount < 0 || !Number.isFinite(zCoinAmount) || zCoinAmount < 0) {
    res.status(400).json({ error: "coins and zCoins must be non-negative numbers" });
    return;
  }

  if (coinAmount === 0 && zCoinAmount === 0) {
    res.status(400).json({ error: "Provide at least one of coins or zCoins" });
    return;
  }

  const username = normalizeHandle(handle);
  const user = await User.findOne({ username });
  if (!user) {
    res.status(404).json({ error: `User ${username} not found` });
    return;
  }

  const userId = user._id.toString();
  let newCoins: number | null = null;
  let newZCoins: number | null = null;

  if (coinAmount > 0) {
    newCoins = await creditBalance(userId, "coins", coinAmount, "dev_grant", {
      reason: "admin_grant",
      handle: username,
    });
  }

  if (zCoinAmount > 0) {
    newZCoins = await creditBalance(userId, "zCoins", zCoinAmount, "dev_grant", {
      reason: "admin_grant",
      handle: username,
    });
  }

  res.json({
    success: true,
    handle: username,
    granted: { coins: coinAmount, zCoins: zCoinAmount },
    balances: { coins: newCoins, zCoins: newZCoins },
  });
});

export default router;
