import { Router, Request, Response } from "express";
import { calculateRarityBoost, getUpgradeCost } from "../lib/economy";
import { Player } from "../models/Player";
import { requireAuth } from "../middleware/auth";
import { getPlayerEconomy } from "../services/economy";
import { fetchWalletNfts } from "../services/nft";
import { FURNITURE_CATALOG } from "../data/furniture";

const router = Router();

function serializePlayer(
  player: InstanceType<typeof Player>,
  economy: ReturnType<typeof getPlayerEconomy>
) {
  return {
    id: player._id,
    twitterHandle: player.twitterHandle,
    profilePicUrl: player.profilePicUrl,
    walletAddress: player.walletAddress,
    zCoins: player.zCoins,
    powerLvl: player.powerLvl,
    speedLvl: player.speedLvl,
    powerUpgradeCost: getUpgradeCost(player.powerLvl),
    speedUpgradeCost: getUpgradeCost(player.speedLvl),
    lastClaimedAt: player.lastClaimedAt,
    cachedNftCount: economy.breakdown.nftCount,
    cachedTokenIds: player.cachedTokenIds,
    economy: {
      nftCount: economy.breakdown.nftCount,
      quantityBoost: economy.breakdown.quantityBoost,
      rarityBoost: economy.breakdown.rarityBoost,
      nftMultiplier: economy.breakdown.nftMultiplier,
      powerMultiplier: economy.breakdown.powerMultiplier,
      dailyRate: economy.breakdown.dailyRate,
      pendingEarnings: economy.pendingEarnings,
    },
  };
}

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const player = await Player.findById(req.auth!.playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(serializePlayer(player, getPlayerEconomy(player)));
});

router.post("/claim", requireAuth, async (req: Request, res: Response) => {
  const player = await Player.findById(req.auth!.playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  const economy = getPlayerEconomy(player);
  const earned = economy.pendingEarnings;
  player.zCoins += earned;
  player.lastClaimedAt = new Date();
  await player.save();
  const updated = getPlayerEconomy(player);
  res.json({
    success: true,
    earned,
    zCoins: player.zCoins,
    player: serializePlayer(player, updated),
  });
});

router.post("/sync-nfts", requireAuth, async (req: Request, res: Response) => {
  const player = await Player.findById(req.auth!.playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  if (!player.walletAddress) {
    res.status(400).json({ error: "Connect wallet first" });
    return;
  }
  try {
    const { nfts, count, raritySum } = await fetchWalletNfts(player.walletAddress);
    player.cachedNftCount = count;
    player.cachedTokenIds = nfts.map((n) => n.tokenId);
    player.cachedRaritySum = raritySum || calculateRarityBoost(nfts);
    await player.save();
    const economy = getPlayerEconomy(player);
    res.json({
      success: true,
      nftCount: count,
      tokenIds: player.cachedTokenIds,
      economy: economy.breakdown,
      player: serializePlayer(player, economy),
    });
  } catch (err) {
    console.error("NFT sync error:", err);
    res.status(500).json({ error: "Failed to read NFTs from blockchain" });
  }
});

router.post("/upgrade", requireAuth, async (req: Request, res: Response) => {
  const { stat } = req.body as { stat?: string };
  if (stat !== "power" && stat !== "speed") {
    res.status(400).json({ error: "stat must be power or speed" });
    return;
  }
  const player = await Player.findById(req.auth!.playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  const level = stat === "power" ? player.powerLvl : player.speedLvl;
  if (level >= 100) {
    res.status(400).json({ error: "Max level reached" });
    return;
  }
  const cost = getUpgradeCost(level);
  if (player.zCoins < cost) {
    res.status(400).json({ error: `Need ${cost} Z-Coins` });
    return;
  }
  player.zCoins -= cost;
  if (stat === "power") player.powerLvl += 1;
  else player.speedLvl += 1;
  await player.save();
  const economy = getPlayerEconomy(player);
  res.json({
    success: true,
    stat,
    level: stat === "power" ? player.powerLvl : player.speedLvl,
    zCoins: player.zCoins,
    player: serializePlayer(player, economy),
  });
});

router.get("/crib", requireAuth, async (req: Request, res: Response) => {
  const player = await Player.findById(req.auth!.playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json({
    catalog: FURNITURE_CATALOG,
    ownedFurniture: player.ownedFurniture,
    layout: player.cribLayout,
    zCoins: player.zCoins,
  });
});

router.post("/crib/buy", requireAuth, async (req: Request, res: Response) => {
  const { itemId } = req.body as { itemId?: string };
  const item = FURNITURE_CATALOG.find((f) => f.id === itemId);
  if (!item) {
    res.status(400).json({ error: "Unknown furniture item" });
    return;
  }
  const player = await Player.findById(req.auth!.playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  if (player.ownedFurniture.includes(item.id)) {
    res.status(400).json({ error: "Already owned" });
    return;
  }
  if (player.zCoins < item.price) {
    res.status(400).json({ error: `Need ${item.price} Z-Coins` });
    return;
  }
  player.zCoins -= item.price;
  player.ownedFurniture.push(item.id);
  await player.save();
  res.json({
    success: true,
    zCoins: player.zCoins,
    ownedFurniture: player.ownedFurniture,
  });
});

router.post("/crib/layout", requireAuth, async (req: Request, res: Response) => {
  const { layout } = req.body as {
    layout?: { itemId: string; x: number; y: number }[];
  };
  if (!Array.isArray(layout)) {
    res.status(400).json({ error: "layout array required" });
    return;
  }
  const player = await Player.findById(req.auth!.playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  for (const entry of layout) {
    if (!player.ownedFurniture.includes(entry.itemId)) {
      res.status(400).json({ error: `You do not own ${entry.itemId}` });
      return;
    }
  }
  player.cribLayout = layout;
  await player.save();
  res.json({ success: true, layout: player.cribLayout });
});

export default router;
