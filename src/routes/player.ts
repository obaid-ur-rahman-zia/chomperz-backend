import { Router, Request, Response } from "express";
import { calculateRarityBoost } from "../lib/economy";
import { Player } from "../models/Player";
import { requireAuth } from "../middleware/auth";
import { getPlayerEconomy } from "../services/economy";
import { fetchWalletNfts } from "../services/nft";

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
    lastClaimedAt: player.lastClaimedAt,
    cachedNftCount: economy.breakdown.nftCount,
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

export default router;
