import { Router, Request, Response } from "express";
import { LandPlot } from "../models/LandPlot";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const plots = await LandPlot.find()
    .select("plotId isLegendary legendaryTokenId name ownerWallet status renters")
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
  res.json({
    plot: {
      ...plot,
      landType: plot.isLegendary ? "Legendary (Crown Land)" : "Frontier",
      displayId: String(plotId + 1).padStart(2, "0"),
    },
  });
});

export default router;
