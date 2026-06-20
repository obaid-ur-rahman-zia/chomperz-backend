import { Types } from "mongoose";
import { Land } from "../models/Land";
import { Wallet } from "../models/Wallet";
import { User } from "../models/User";
import { emitPlotPatch, emitTerritoryEvent, toPlotPatch } from "../socket/territory";

const LEGENDARY_TOKEN_MIN = 1;
const LEGENDARY_TOKEN_MAX = 10;

export function legendaryTokenToPlotId(tokenId: number): number {
  if (tokenId < LEGENDARY_TOKEN_MIN || tokenId > LEGENDARY_TOKEN_MAX) {
    throw new Error(`Token ${tokenId} is not a legendary plot NFT`);
  }
  return tokenId - 1;
}

export function plotIdToLegendaryToken(plotId: number): number {
  if (plotId < 0 || plotId > 9) {
    throw new Error(`Plot ${plotId + 1} is not legendary`);
  }
  return plotId + 1;
}

async function resolveUserByWallet(walletAddress: string) {
  const normalized = walletAddress.toLowerCase();
  const wallet = await Wallet.findOne({ address: normalized });
  if (!wallet) return null;
  const user = await User.findById(wallet.userId);
  return user;
}

export async function syncLegendaryPlotOwner(
  tokenId: number,
  walletAddress: string
): Promise<{ plotId: number; previousOwnerId: string | null }> {
  const plotId = legendaryTokenToPlotId(tokenId);
  const plot = await Land.findOne({ plotId, type: "legendary" });
  if (!plot) throw new Error(`Legendary plot not found for token ${tokenId}`);

  const previousOwnerId = plot.ownerId?.toString() ?? null;
  const user = await resolveUserByWallet(walletAddress);
  const now = new Date();

  plot.legendaryTokenId = tokenId;
  plot.ownerWallet = walletAddress.toLowerCase();
  plot.status = "owned";
  plot.lastClaimAt = now;
  plot.abandonedAt = null;

  if (user) {
    plot.ownerId = user._id as Types.ObjectId;
    plot.landlordHandle = user.username;
    plot.landlordAvatarUrl = user.profilePicUrl;
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

  return { plotId, previousOwnerId };
}

export async function clearLegendaryPlotOwner(tokenId: number): Promise<void> {
  const plotId = legendaryTokenToPlotId(tokenId);
  const plot = await Land.findOne({ plotId, type: "legendary" });
  if (!plot) return;

  const previousOwnerId = plot.ownerId?.toString() ?? null;
  plot.previousOwnerId = plot.ownerId;
  plot.ownerId = null;
  plot.ownerWallet = null;
  plot.landlordHandle = null;
  plot.landlordAvatarUrl = null;
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
  const legendaryHeld = new Set(
    ownedTokenIds.filter((id) => id >= LEGENDARY_TOKEN_MIN && id <= LEGENDARY_TOKEN_MAX)
  );

  for (const tokenId of legendaryHeld) {
    await syncLegendaryPlotOwner(tokenId, walletAddress);
  }

  const plots = await Land.find({ type: "legendary", ownerId: userId });
  for (const plot of plots) {
    const tokenId = plot.legendaryTokenId ?? plotIdToLegendaryToken(plot.plotId);
    if (!legendaryHeld.has(tokenId)) {
      plot.ownerId = null;
      if (plot.ownerWallet?.toLowerCase() === walletAddress.toLowerCase()) {
  plot.ownerWallet = null;
  plot.landlordHandle = null;
  plot.landlordAvatarUrl = null;
  plot.status = "unclaimed";
        emitTerritoryEvent("landLost", {
          plotId: plot.plotId,
          previousOwnerId: userId,
          tokenId,
        });
        emitPlotPatch(toPlotPatch(plot));
      }
    }
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
    for (const tokenId of ownedTokenIds) {
      if (tokenId >= LEGENDARY_TOKEN_MIN && tokenId <= LEGENDARY_TOKEN_MAX) {
        await syncLegendaryPlotOwner(tokenId, walletAddress);
      }
    }
  }
}
