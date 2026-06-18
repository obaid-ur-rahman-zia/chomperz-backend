import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { findUserById, claimDailyTask } from "../services/user";
import { ensureSkill, upgradeSkill } from "../services/skills";
import { serializePlayer } from "../services/player";
import { getUserEconomy } from "../services/economy";
import { creditBalance } from "../services/resources";
import { getWalletAddress } from "../services/wallet";
import { syncUserNfts, validateChainConfig } from "../services/nft";
import { getRoomLayout, buyFurniture, saveLayout } from "../services/room";

const router = Router();

async function loadUserContext(userId: string) {
  const user = await findUserById(userId);
  if (!user) return null;
  const skill = await ensureSkill(userId);
  return { user, skill };
}

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const ctx = await loadUserContext(req.auth!.playerId);
  if (!ctx) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(await serializePlayer(ctx.user, ctx.skill));
});

router.post("/claim", requireAuth, async (req: Request, res: Response) => {
  const ctx = await loadUserContext(req.auth!.playerId);
  if (!ctx) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const economy = await getUserEconomy(ctx.user, ctx.skill);
  const earned = economy.pendingEarnings;

  const zCoins = await creditBalance(
    ctx.user._id.toString(),
    "zCoins",
    earned,
    "claim",
    { earned }
  );

  ctx.user.lastClaimAt = new Date();
  await ctx.user.save();

  const updated = await getUserEconomy(ctx.user, ctx.skill);
  res.json({
    success: true,
    earned,
    zCoins,
    player: await serializePlayer(ctx.user, ctx.skill),
  });
});

router.post("/sync-nfts", requireAuth, async (req: Request, res: Response) => {
  const ctx = await loadUserContext(req.auth!.playerId);
  if (!ctx) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const walletAddress = await getWalletAddress(ctx.user._id.toString());
  if (!walletAddress) {
    res.status(400).json({ error: "Connect wallet first" });
    return;
  }

  try {
    validateChainConfig();
    const { nfts, count } = await syncUserNfts(ctx.user._id.toString(), walletAddress);
    const economy = await getUserEconomy(ctx.user, ctx.skill);
    res.json({
      success: true,
      nftCount: count,
      tokenIds: nfts.map((n) => n.tokenId),
      economy: economy.breakdown,
      player: await serializePlayer(ctx.user, ctx.skill),
    });
  } catch (err) {
    console.error("NFT sync error:", err);
    const msg = err instanceof Error ? err.message : "Failed to read NFTs from blockchain";
    res.status(500).json({ error: msg });
  }
});

router.post("/daily-task", requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await claimDailyTask(req.auth!.playerId);
    const ctx = await loadUserContext(req.auth!.playerId);
    if (!ctx) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      success: true,
      awarded: result.awarded,
      coins: result.coins,
      player: await serializePlayer(ctx.user, ctx.skill),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Daily task failed" });
  }
});

router.post("/upgrade", requireAuth, async (req: Request, res: Response) => {
  const { stat } = req.body as { stat?: string };
  if (stat !== "power" && stat !== "speed") {
    res.status(400).json({ error: "stat must be power or speed" });
    return;
  }

  try {
    const { skill, zCoins } = await upgradeSkill(req.auth!.playerId, stat);
    const user = await findUserById(req.auth!.playerId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      success: true,
      stat,
      level: stat === "power" ? skill.powerLvl : skill.speedLvl,
      zCoins,
      player: await serializePlayer(user, skill),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upgrade failed";
    res.status(400).json({ error: msg });
  }
});

router.get("/crib", requireAuth, async (req: Request, res: Response) => {
  const data = await getRoomLayout(req.auth!.playerId);
  res.json(data);
});

router.post("/crib/buy", requireAuth, async (req: Request, res: Response) => {
  const { itemId } = req.body as { itemId?: string };
  if (!itemId) {
    res.status(400).json({ error: "itemId required" });
    return;
  }
  try {
    const result = await buyFurniture(req.auth!.playerId, itemId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Purchase failed" });
  }
});

router.post("/crib/layout", requireAuth, async (req: Request, res: Response) => {
  const { layout } = req.body as {
    layout?: { itemId: string; x: number; y: number }[];
  };
  if (!Array.isArray(layout)) {
    res.status(400).json({ error: "layout array required" });
    return;
  }
  try {
    const saved = await saveLayout(req.auth!.playerId, layout);
    res.json({ success: true, layout: saved });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Save failed" });
  }
});

export default router;
