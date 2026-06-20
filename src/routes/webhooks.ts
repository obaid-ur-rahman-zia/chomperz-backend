import { Router, Request, Response } from "express";
import crypto from "crypto";
import {
  syncLegendaryPlotOwner,
  clearLegendaryPlotOwner,
  legendaryTokenToPlotId,
} from "../services/legendaryLand";

const router = Router();

function getContractAddress(): string {
  return (process.env.CONTRACT_ADDRESS ?? "").toLowerCase();
}

function verifyAlchemySignature(body: string, signature: string | undefined): boolean {
  const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    console.warn("ALCHEMY_WEBHOOK_SIGNING_KEY not set — skipping signature verify (dev only)");
    return process.env.NODE_ENV !== "production";
  }
  if (!signature) return false;
  const hmac = crypto.createHmac("sha256", signingKey);
  hmac.update(body, "utf8");
  const digest = hmac.digest("hex");
  if (digest.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

interface AlchemyActivity {
  fromAddress?: string;
  toAddress?: string;
  erc721TokenId?: string;
  category?: string;
  rawContract?: { address?: string };
}

interface AlchemyWebhookBody {
  event?: {
    activity?: AlchemyActivity[];
  };
}

function parseTokenId(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.startsWith("0x") ? BigInt(raw).toString() : raw;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

router.post("/nft-transfer", async (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
  const signature = req.headers["x-alchemy-signature"] as string | undefined;

  if (!verifyAlchemySignature(rawBody, signature)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const contractAddress = getContractAddress();
  const body = req.body as AlchemyWebhookBody;
  const activities = body.event?.activity ?? [];

  const results: Array<{ tokenId: number; plotId: number; action: string }> = [];

  for (const activity of activities) {
    if (activity.category !== "erc721") continue;
    const activityContract = (activity.rawContract?.address ?? "").toLowerCase();
    if (contractAddress && activityContract && activityContract !== contractAddress) continue;

    const tokenId = parseTokenId(activity.erc721TokenId);
    if (tokenId === null || tokenId < 1 || tokenId > 10) continue;

    const to = activity.toAddress;
    const from = activity.fromAddress;
    const zero = "0x0000000000000000000000000000000000000000";

    try {
      if (to && to.toLowerCase() !== zero) {
        await syncLegendaryPlotOwner(tokenId, to);
        results.push({ tokenId, plotId: legendaryTokenToPlotId(tokenId), action: "transfer_in" });
      } else if (from && from.toLowerCase() !== zero) {
        await clearLegendaryPlotOwner(tokenId);
        results.push({ tokenId, plotId: legendaryTokenToPlotId(tokenId), action: "burn_or_out" });
      }
    } catch (err) {
      console.error("Legendary sync error:", err);
    }
  }

  res.json({ success: true, processed: results.length, results });
});

export default router;
