import { Router, Request, Response } from "express";
import { LandPlot } from "../models/LandPlot";
import { Player } from "../models/Player";
import { requireAuth } from "../middleware/auth";

const router = Router();
const MAX_RENTERS = 3;

router.get("/", async (_req: Request, res: Response) => {
  const plots = await LandPlot.find()
    .select(
      "plotId isLegendary legendaryTokenId name ownerWallet landlordHandle status renters"
    )
    .sort({ plotId: 1 })
    .lean();
  res.json({ plots });
});

router.get("/:id", async (req: Request, res: Response) => {
  const plotId = parseInt(String(req.params.id), 10);
  if (isNaN(plotId) || plotId < 0 || plotId > 99) {
    res.status(400).json({ error: "Invalid plot ID (0-99)" });
    return;
  }
  const plot = await LandPlot.findOne({ plotId }).lean();
  if (!plot) {
    res.status(404).json({ error: "Plot not found" });
    return;
  }
  const sortedRenters = [...(plot.renters ?? [])].sort(
    (a, b) => b.dailyBid - a.dailyBid
  );
  const minBid =
    sortedRenters.length > 0
      ? sortedRenters[sortedRenters.length - 1].dailyBid + 1
      : 1;

  res.json({
    plot: {
      ...plot,
      renters: sortedRenters,
      landType: plot.isLegendary ? "Legendary (Crown Land)" : "Frontier",
      displayId: String(plotId + 1).padStart(2, "0"),
      minBid,
      landlordTaxPct: 10,
    },
  });
});

router.post("/:id/bid", requireAuth, async (req: Request, res: Response) => {
  const plotId = parseInt(String(req.params.id), 10);
  const { amount } = req.body as { amount?: number };
  if (isNaN(plotId) || plotId < 0 || plotId > 99) {
    res.status(400).json({ error: "Invalid plot ID" });
    return;
  }
  if (!amount || amount < 1) {
    res.status(400).json({ error: "Valid bid amount required" });
    return;
  }

  const player = await Player.findById(req.auth!.playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  if (!player.walletAddress) {
    res.status(400).json({ error: "Connect wallet before bidding" });
    return;
  }

  const plot = await LandPlot.findOne({ plotId });
  if (!plot) {
    res.status(404).json({ error: "Plot not found" });
    return;
  }

  const sorted = [...plot.renters].sort((a, b) => b.dailyBid - a.dailyBid);
  const minBid = sorted.length > 0 ? sorted[sorted.length - 1].dailyBid + 1 : 1;
  if (amount < minBid) {
    res.status(400).json({ error: `Minimum bid is ${minBid}` });
    return;
  }

  const escrowDeposit = amount * 7;
  if (player.zCoins < escrowDeposit) {
    res.status(400).json({ error: `Need ${escrowDeposit} Z-Coins for 7-day escrow` });
    return;
  }

  const wallet = player.walletAddress.toLowerCase();
  const existingIdx = plot.renters.findIndex(
    (r) => r.walletAddress.toLowerCase() === wallet
  );

  if (existingIdx >= 0) {
    plot.renters[existingIdx].dailyBid = amount;
    plot.renters[existingIdx].escrowBalance = escrowDeposit;
    plot.renters[existingIdx].twitterHandle = player.twitterHandle;
  } else if (plot.renters.length < MAX_RENTERS) {
    plot.renters.push({
      walletAddress: wallet,
      twitterHandle: player.twitterHandle,
      dailyBid: amount,
      escrowBalance: escrowDeposit,
    });
  } else {
    const lowest = sorted[sorted.length - 1];
    if (amount <= lowest.dailyBid) {
      res.status(400).json({ error: "Bid too low to outbid lowest renter" });
      return;
    }
    const outIdx = plot.renters.findIndex(
      (r) => r.walletAddress === lowest.walletAddress
    );
    plot.renters[outIdx] = {
      walletAddress: wallet,
      twitterHandle: player.twitterHandle,
      dailyBid: amount,
      escrowBalance: escrowDeposit,
    };
  }

  player.zCoins -= escrowDeposit;
  await player.save();
  await plot.save();

  res.json({
    success: true,
    zCoins: player.zCoins,
    plotId,
    dailyBid: amount,
  });
});

export default router;
