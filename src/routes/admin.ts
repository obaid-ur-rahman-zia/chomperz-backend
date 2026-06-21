import { Router, Request, Response } from "express";
import { creditBalance } from "../services/resources";
import type { RarityTier } from "../lib/economy";
import type { ActiveSkillType } from "../models/Skill";
import {
  clearCrownBinding,
  getCollectionConfigPayload,
  removeRarityOverride,
  setCrownBinding,
  setRarityOverride,
} from "../services/collectionConfig";
import {
  findUserByHandle,
  getAdminCatalog,
  grantItemsToUser,
  grantSkillsToUser,
} from "../services/adminGrant";
import { reconcileAllCrownPlotOwnership } from "../services/legendaryLand";

const router = Router();

function verifyAdminSecret(req: Request, res: Response): boolean {
  const adminSecret = process.env.ADMIN_SECRET?.trim();
  if (!adminSecret) {
    res.status(503).json({ error: "ADMIN_SECRET is not configured on the server" });
    return false;
  }
  const { secret } = req.body as { secret?: string };
  if (!secret || secret !== adminSecret) {
    res.status(403).json({ error: "Invalid admin secret" });
    return false;
  }
  return true;
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

  try {
    const { user, username } = await findUserByHandle(handle);
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Grant failed";
    const status = message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

router.post("/catalog", async (req: Request, res: Response) => {
  if (!verifyAdminSecret(req, res)) return;
  res.json({ success: true, catalog: getAdminCatalog() });
});

router.post("/grant-items", async (req: Request, res: Response) => {
  if (!verifyAdminSecret(req, res)) return;
  const { handle, items } = req.body as { handle?: string; items?: Record<string, number> };
  if (!handle?.trim()) {
    res.status(400).json({ error: "handle is required (e.g. @username)" });
    return;
  }
  if (!items || typeof items !== "object") {
    res.status(400).json({ error: "items object is required" });
    return;
  }
  try {
    const { user, username } = await findUserByHandle(handle);
    const balances = await grantItemsToUser(user._id.toString(), items);
    res.json({ success: true, handle: username, balances });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Grant failed";
    const status = message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

router.post("/grant-skills", async (req: Request, res: Response) => {
  if (!verifyAdminSecret(req, res)) return;
  const { handle, skills } = req.body as {
    handle?: string;
    skills?: Partial<Record<ActiveSkillType, { level?: number; xp?: number }>>;
  };
  if (!handle?.trim()) {
    res.status(400).json({ error: "handle is required (e.g. @username)" });
    return;
  }
  if (!skills || typeof skills !== "object") {
    res.status(400).json({ error: "skills object is required" });
    return;
  }
  try {
    const { user, username } = await findUserByHandle(handle);
    const updated = await grantSkillsToUser(user._id.toString(), skills);
    res.json({ success: true, handle: username, skills: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Grant failed";
    const status = message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

router.post("/collection-config", async (req: Request, res: Response) => {
  if (!verifyAdminSecret(req, res)) return;
  try {
    res.json({ success: true, config: await getCollectionConfigPayload() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load config" });
  }
});

router.post("/collection-config/crown", async (req: Request, res: Response) => {
  if (!verifyAdminSecret(req, res)) return;
  const { plotId, tokenId } = req.body as { plotId?: number; tokenId?: number };
  if (plotId === undefined || tokenId === undefined) {
    res.status(400).json({ error: "plotId and tokenId are required" });
    return;
  }
  try {
    const config = await setCrownBinding(Number(plotId), Number(tokenId));
    res.json({ success: true, config });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to set crown binding" });
  }
});

router.post("/collection-config/crown/clear", async (req: Request, res: Response) => {
  if (!verifyAdminSecret(req, res)) return;
  const { plotId } = req.body as { plotId?: number };
  if (plotId === undefined) {
    res.status(400).json({ error: "plotId is required" });
    return;
  }
  try {
    const config = await clearCrownBinding(Number(plotId));
    res.json({ success: true, config });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to clear binding" });
  }
});

router.delete("/collection-config/crown/:plotId", async (req: Request, res: Response) => {
  const plotId = parseInt(String(req.params.plotId), 10);
  if (isNaN(plotId)) {
    res.status(400).json({ error: "Invalid plotId" });
    return;
  }
  const secret = req.headers["x-admin-secret"] as string | undefined;
  const adminSecret = process.env.ADMIN_SECRET?.trim();
  if (!adminSecret || secret !== adminSecret) {
    res.status(403).json({ error: "Invalid admin secret" });
    return;
  }
  try {
    const config = await clearCrownBinding(plotId);
    res.json({ success: true, config });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to clear binding" });
  }
});

router.post("/collection-config/rarity", async (req: Request, res: Response) => {
  if (!verifyAdminSecret(req, res)) return;
  const { tokenId, rarity } = req.body as { tokenId?: number; rarity?: RarityTier };
  const valid: RarityTier[] = ["common", "uncommon", "rare", "legendary"];
  if (tokenId === undefined || !rarity || !valid.includes(rarity)) {
    res.status(400).json({ error: "tokenId and valid rarity are required" });
    return;
  }
  try {
    const config = await setRarityOverride(Number(tokenId), rarity);
    res.json({ success: true, config });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to set rarity" });
  }
});

router.post("/collection-config/reconcile", async (req: Request, res: Response) => {
  if (!verifyAdminSecret(req, res)) return;
  try {
    await reconcileAllCrownPlotOwnership();
    res.json({ success: true, config: await getCollectionConfigPayload() });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to reconcile crown plots",
    });
  }
});

router.post("/collection-config/rarity/remove", async (req: Request, res: Response) => {
  if (!verifyAdminSecret(req, res)) return;
  const { tokenId } = req.body as { tokenId?: number };
  if (tokenId === undefined) {
    res.status(400).json({ error: "tokenId is required" });
    return;
  }
  try {
    const config = await removeRarityOverride(Number(tokenId));
    res.json({ success: true, config });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to remove rarity" });
  }
});

export default router;
