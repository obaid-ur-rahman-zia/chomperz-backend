import { Router, Request, Response } from "express";
import { findUserByHandle } from "../services/user";
import { getPublicRoomLayout } from "../services/room";
import { resolveDisplayAvatar } from "../services/avatar";
import { Nft } from "../models/Nft";

const router = Router();

router.get("/by-handle/:handle", async (req: Request, res: Response) => {
  const raw = decodeURIComponent(String(req.params.handle ?? ""));
  if (!raw.trim()) {
    res.status(400).json({ error: "handle is required" });
    return;
  }
  try {
    const { user, username } = await findUserByHandle(raw);
    const userId = user._id.toString();
    const nfts = await Nft.find({ userId }).select("tokenId imageUrl").lean();
    res.json({
      userId,
      username,
      displayAvatarUrl: resolveDisplayAvatar(user, nfts),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lookup failed";
    res.status(404).json({ error: msg });
  }
});

router.get("/:userId/crib", async (req: Request, res: Response) => {
  const userId = String(req.params.userId ?? "").trim();
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  try {
    const crib = await getPublicRoomLayout(userId);
    res.json(crib);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Crib not found";
    res.status(404).json({ error: msg });
  }
});

export default router;
