import { Types } from "mongoose";
import { Land } from "../models/Land";
import { Wallet } from "../models/Wallet";
import { User } from "../models/User";
import { Nft } from "../models/Nft";
import { getPlotForToken, getCrownTokenForPlot, getAllCrownBindings } from "./collectionConfig";
import { resolveDisplayAvatar } from "./avatar";
import { getWalletAddress } from "./wallet";
import { emitPlotPatch, emitTerritoryEvent, toPlotPatch } from "../socket/territory";

async function resolveUserByWallet(walletAddress: string) {
  const normalized = walletAddress.toLowerCase();
  const wallet = await Wallet.findOne({ address: normalized });
  if (!wallet) return null;
  const user = await User.findById(wallet.userId);
  return user;
}

async function avatarForUser(userId: Types.ObjectId | string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await User.findById(userId);
  if (!user) return null;
  const nfts = await Nft.find({ userId: user._id }).select("tokenId imageUrl").lean();
  return resolveDisplayAvatar(user, nfts);
}

async function releaseLegendaryPlotAt(plotId: number): Promise<boolean> {
  const plot = await Land.findOne({ plotId, type: "legendary" });
  if (!plot || plot.status !== "owned") return false;

  const previousOwnerId = plot.ownerId?.toString() ?? null;
  const tokenId = plot.legendaryTokenId;

  plot.previousOwnerId = plot.ownerId;
  plot.ownerId = null;
  plot.ownerWallet = null;
  plot.landlordHandle = null;
  plot.landlordAvatarUrl = null;
  plot.legendaryTokenId = null;
  plot.status = "unclaimed";
  await plot.save();

  if (previousOwnerId) {
    emitTerritoryEvent("landLost", {
      plotId,
      previousOwnerId,
      tokenId: tokenId ?? undefined,
    });
    emitPlotPatch(toPlotPatch(plot));
  }

  return true;
}

async function shouldReleaseOwnedCrownPlot(
  plot: { plotId: number; legendaryTokenId: number | null; status: string },
  heldTokenIds: Set<number>
): Promise<boolean> {
  if (plot.status !== "owned") return false;

  const onPlotToken = plot.legendaryTokenId != null ? Number(plot.legendaryTokenId) : null;
  const configuredToken = await getCrownTokenForPlot(plot.plotId);

  if (configuredToken == null) return true;
  if (onPlotToken !== configuredToken) return true;
  if (onPlotToken == null || !heldTokenIds.has(onPlotToken)) return true;

  const boundPlotId = await getPlotForToken(onPlotToken);
  return boundPlotId !== plot.plotId;
}

/** Drop stale crown claims after admin rebinding (e.g. token moved from plot #02 → #03). */
export async function reconcileAllCrownPlotOwnership(): Promise<void> {
  const ownedLegendary = await Land.find({ type: "legendary", status: "owned" });

  for (const plot of ownedLegendary) {
    const configuredToken = await getCrownTokenForPlot(plot.plotId);
    const onPlotToken = plot.legendaryTokenId != null ? Number(plot.legendaryTokenId) : null;

    const shouldRelease =
      configuredToken == null ||
      onPlotToken !== configuredToken ||
      (onPlotToken != null && (await getPlotForToken(onPlotToken)) !== plot.plotId);

    if (shouldRelease) {
      await releaseLegendaryPlotAt(plot.plotId);
    }
  }

  const bindings = await getAllCrownBindings();
  for (const { tokenId } of bindings) {
    await resyncCrownPlotsForToken(Number(tokenId), { force: true });
  }
}

export async function syncLegendaryPlotOwner(
  tokenId: number,
  walletAddress: string
): Promise<{ plotId: number; previousOwnerId: string | null; changed: boolean }> {
  const plotId = await getPlotForToken(tokenId);
  if (plotId === null) {
    throw new Error(`Token ${tokenId} is not configured as a crown plot NFT`);
  }

  const plot = await Land.findOne({ plotId, type: "legendary" });
  if (!plot) throw new Error(`Legendary plot not found for token ${tokenId}`);

  const previousOwnerId = plot.ownerId?.toString() ?? null;
  const user = await resolveUserByWallet(walletAddress);
  const normalizedWallet = walletAddress.toLowerCase();
  const nextOwnerId = user?._id?.toString() ?? null;

  if (
    plot.status === "owned" &&
    plot.legendaryTokenId === tokenId &&
    plot.ownerWallet?.toLowerCase() === normalizedWallet &&
    previousOwnerId === nextOwnerId
  ) {
    return { plotId, previousOwnerId, changed: false };
  }

  const now = new Date();

  plot.legendaryTokenId = tokenId;
  plot.ownerWallet = normalizedWallet;
  plot.status = "owned";
  plot.lastClaimAt = now;
  plot.abandonedAt = null;

  if (user) {
    plot.ownerId = user._id as Types.ObjectId;
    plot.landlordHandle = user.username;
    const nfts = await Nft.find({ userId: user._id }).select("tokenId imageUrl").lean();
    plot.landlordAvatarUrl = resolveDisplayAvatar(user, nfts);
  } else {
    plot.ownerId = null;
    plot.landlordHandle = null;
    plot.landlordAvatarUrl = null;
  }

  await plot.save();

  if (previousOwnerId && previousOwnerId !== plot.ownerId?.toString()) {
    emitTerritoryEvent("landLost", { plotId, previousOwnerId, tokenId });
  }

  emitTerritoryEvent("landCaptured", {
    plotId,
    tokenId,
    ownerWallet: plot.ownerWallet,
    ownerId: plot.ownerId?.toString() ?? null,
  });
  emitPlotPatch(toPlotPatch(plot));

  return { plotId, previousOwnerId, changed: true };
}

export async function clearLegendaryPlotOwner(tokenId: number): Promise<void> {
  const plotId = await getPlotForToken(tokenId);
  if (plotId === null) return;

  const plot = await Land.findOne({ plotId, type: "legendary" });
  if (!plot) return;

  const previousOwnerId = plot.ownerId?.toString() ?? null;
  plot.previousOwnerId = plot.ownerId;
  plot.ownerId = null;
  plot.ownerWallet = null;
  plot.landlordHandle = null;
  plot.landlordAvatarUrl = null;
  plot.legendaryTokenId = null;
  plot.status = "unclaimed";
  await plot.save();

  if (previousOwnerId) {
    emitTerritoryEvent("landLost", { plotId, previousOwnerId, tokenId });
    emitPlotPatch(toPlotPatch(plot));
  }
}

export async function syncAllLegendaryForWallet(
  userId: string,
  walletAddress: string,
  ownedTokenIds: number[]
): Promise<void> {
  const bindings = await getAllCrownBindings();
  const ownedSet = new Set(ownedTokenIds.map((id) => Number(id)));
  const configuredHeld = bindings.filter((b) => ownedSet.has(Number(b.tokenId)));

  for (const { tokenId } of configuredHeld) {
    await syncLegendaryPlotOwner(Number(tokenId), walletAddress);
  }

  const heldTokenIds = new Set(configuredHeld.map((b) => Number(b.tokenId)));
  const normalizedWallet = walletAddress.toLowerCase();
  const plots = await Land.find({ type: "legendary", ownerId: userId });

  for (const plot of plots) {
    if (plot.ownerWallet?.toLowerCase() !== normalizedWallet) continue;
    if (!(await shouldReleaseOwnedCrownPlot(plot, heldTokenIds))) continue;

    const tokenId = plot.legendaryTokenId != null ? Number(plot.legendaryTokenId) : null;
    plot.ownerId = null;
    plot.ownerWallet = null;
    plot.landlordHandle = null;
    plot.landlordAvatarUrl = null;
    plot.legendaryTokenId = null;
    plot.status = "unclaimed";
    await plot.save();

    emitTerritoryEvent("landLost", {
      plotId: plot.plotId,
      previousOwnerId: userId,
      tokenId: tokenId ?? undefined,
    });
    emitPlotPatch(toPlotPatch(plot));
  }
}

/** Re-apply crown plot ownership from synced DB NFTs (e.g. after admin binding change). */
const crownResyncAt = new Map<string, number>();
const CROWN_RESYNC_COOLDOWN_MS = 30_000;

export async function resyncCrownPlotsForUser(
  userId: string,
  options?: { force?: boolean }
): Promise<void> {
  const force = options?.force ?? false;
  if (!force) {
    const last = crownResyncAt.get(userId) ?? 0;
    if (Date.now() - last < CROWN_RESYNC_COOLDOWN_MS) return;
  }
  crownResyncAt.set(userId, Date.now());

  const walletAddress = await getWalletAddress(userId);
  if (!walletAddress) return;

  const nftDocs = await Nft.find({ userId }).select("tokenId").lean();
  const ownedTokenIds = nftDocs.map((n) => Number(n.tokenId)).filter((id) => Number.isFinite(id));
  if (ownedTokenIds.length === 0) return;

  await syncAllLegendaryForWallet(userId, walletAddress, ownedTokenIds);
}

export async function resyncCrownPlotsForToken(
  tokenId: number,
  options?: { force?: boolean }
): Promise<void> {
  const holders = await Nft.find({ tokenId: Number(tokenId) }).select("userId").lean();
  const seen = new Set<string>();
  for (const doc of holders) {
    const userId = doc.userId.toString();
    if (seen.has(userId)) continue;
    seen.add(userId);
    await resyncCrownPlotsForUser(userId, options);
  }
}

export async function syncAllLegendaryForTokens(
  walletAddress: string,
  ownedTokenIds: number[]
): Promise<void> {
  const wallet = await Wallet.findOne({ address: walletAddress.toLowerCase() });
  const userId = wallet?.userId.toString();
  if (userId) {
    await syncAllLegendaryForWallet(userId, walletAddress, ownedTokenIds);
  } else {
    const bindings = await getAllCrownBindings();
    const ownedSet = new Set(ownedTokenIds);
    for (const { tokenId } of bindings) {
      if (ownedSet.has(tokenId)) {
        await syncLegendaryPlotOwner(tokenId, walletAddress);
      }
    }
  }
}

/** Refresh landlordAvatarUrl on all plots owned by a user (after avatar change). */
export async function refreshLandlordAvatarsForUser(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  const nfts = await Nft.find({ userId: user._id }).select("tokenId imageUrl").lean();
  const avatarUrl = resolveDisplayAvatar(user, nfts);

  const plots = await Land.find({ ownerId: user._id, status: "owned" });
  for (const plot of plots) {
    plot.landlordAvatarUrl = avatarUrl;
    await plot.save();
    emitPlotPatch(toPlotPatch(plot));
  }
}

export { avatarForUser };
