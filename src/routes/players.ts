import { Router, Request, Response } from "express";
import { User } from "../models/User";
import { findUserByHandle } from "../services/user";
import { getPublicRoomLayout } from "../services/room";
import { resolveDisplayAvatar } from "../services/avatar";
import { Nft } from "../models/Nft";

const router = Router();

router.get("/search", async (req: Request, res: Response) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) {
    res.json({ suggestions: [] });
    return;
  }
  try {
    const stem = q.replace(/^@+/, "");
    const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users = await User.find({
      username: { $regex: new RegExp(`^@${escaped}`, "i") },
    })
      .limit(8)
      .select("username profilePicUrl avatarSource avatarNftTokenId")
      .lean();

    const userIds = users.map((u) => u._id.toString());
    const allNfts = await Nft.find({ userId: { $in: userIds } })
      .select("userId tokenId imageUrl")
      .lean();
    const nftsByUser = new Map<string, typeof allNfts>();
    for (const nft of allNfts) {
      const uid = nft.userId.toString();
      const list = nftsByUser.get(uid) ?? [];
      list.push(nft);
      nftsByUser.set(uid, list);
    }

    res.json({
      suggestions: users.map((u) => {
        const userId = u._id.toString();
        return {
          userId,
          username: u.username,
          displayAvatarUrl: resolveDisplayAvatar(u, nftsByUser.get(userId) ?? []),
        };
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Search failed";
    res.status(500).json({ error: msg });
  }
});

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
