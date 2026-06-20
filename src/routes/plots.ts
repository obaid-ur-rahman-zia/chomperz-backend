import { Router, Request, Response } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth";
import {
  listLands,
  getLandDetail,
  placeBid,
  purchaseLand,
  claimLand,
  takeoverLand,
} from "../services/land";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const plots = await listLands();
  res.json({
    plots: plots.map((p) => ({
      plotId: p.plotId,
      isLegendary: p.type === "legendary",
      legendaryTokenId: p.legendaryTokenId,
      name: p.name,
      ownerWallet: p.ownerWallet,
      landlordHandle: p.landlordHandle,
      status: p.status,
      lastClaimAt: p.lastClaimAt ? new Date(p.lastClaimAt).toISOString() : null,
      abandonedAt: p.abandonedAt ? new Date(p.abandonedAt).toISOString() : null,
      renters: p.renters,
    })),
  });
});

router.get("/:id", optionalAuth, async (req: Request, res: Response) => {
  const plotId = parseInt(String(req.params.id), 10);
  if (isNaN(plotId) || plotId < 0 || plotId > 99) {
    res.status(400).json({ error: "Invalid plot ID (0-99)" });
    return;
  }
  const viewerUserId = req.auth?.playerId;
  const plot = await getLandDetail(plotId, viewerUserId);
  if (!plot) {
    res.status(404).json({ error: "Plot not found" });
    return;
  }
  res.json({ plot });
});

router.post("/:id/purchase", requireAuth, async (req: Request, res: Response) => {
  const plotId = parseInt(String(req.params.id), 10);
  if (isNaN(plotId) || plotId < 0 || plotId > 99) {
    res.status(400).json({ error: "Invalid plot ID" });
    return;
  }
  try {
    const result = await purchaseLand(req.auth!.playerId, plotId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Purchase failed" });
  }
});

router.post("/:id/claim-land", requireAuth, async (req: Request, res: Response) => {
  const plotId = parseInt(String(req.params.id), 10);
  if (isNaN(plotId) || plotId < 0 || plotId > 99) {
    res.status(400).json({ error: "Invalid plot ID" });
    return;
  }
  try {
    const result = await claimLand(req.auth!.playerId, plotId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Claim failed" });
  }
});

router.post("/:id/takeover", requireAuth, async (req: Request, res: Response) => {
  const plotId = parseInt(String(req.params.id), 10);
  if (isNaN(plotId) || plotId < 0 || plotId > 99) {
    res.status(400).json({ error: "Invalid plot ID" });
    return;
  }
  try {
    const result = await takeoverLand(req.auth!.playerId, plotId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Takeover failed" });
  }
});

router.post("/:id/bid", requireAuth, async (req: Request, res: Response) => {
  const plotId = parseInt(String(req.params.id), 10);
  const { amount } = req.body as { amount?: number };
  if (isNaN(plotId) || plotId < 0 || plotId > 99) {
    res.status(400).json({ error: "Invalid plot ID" });
    return;
  }
  if (!amount || !Number.isInteger(amount) || amount < 7) {
    res.status(400).json({ error: "Valid whole-number 7-day bid required (min 7 Z-Coins)" });
    return;
  }

  try {
    const result = await placeBid(req.auth!.playerId, plotId, amount);
    res.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bid failed";
    res.status(400).json({ error: msg });
  }
});

export default router;
