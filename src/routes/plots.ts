import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { listLands, getLandDetail, placeBid } from "../services/land";

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
      renters: p.renters,
    })),
  });
});

router.get("/:id", async (req: Request, res: Response) => {
  const plotId = parseInt(String(req.params.id), 10);
  if (isNaN(plotId) || plotId < 0 || plotId > 99) {
    res.status(400).json({ error: "Invalid plot ID (0-99)" });
    return;
  }
  const plot = await getLandDetail(plotId);
  if (!plot) {
    res.status(404).json({ error: "Plot not found" });
    return;
  }
  res.json({ plot });
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

  try {
    const result = await placeBid(req.auth!.playerId, plotId, amount);
    res.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bid failed";
    const status = msg.includes("Need") || msg.includes("Minimum") ? 400 : 400;
    res.status(status).json({ error: msg });
  }
});

export default router;
