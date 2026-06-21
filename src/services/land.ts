import { Types } from "mongoose";
import { Land, type ILand } from "../models/Land";
import { User } from "../models/User";
import { debitBalance, creditBalance } from "./resources";
import { getWalletAddress } from "./wallet";
import { MS_PER_DAY } from "../lib/constants";
import { emitPlotPatch, emitTerritoryEvent, toPlotPatch } from "../socket/territory";
import { resolveDisplayAvatar } from "./avatar";
import { Nft } from "../models/Nft";
import { getCrownTokenForPlot } from "./collectionConfig";

const MAX_RENTERS = 3;
const MIN_SEVEN_DAY_BID = 7;
const LAND_PURCHASE_PRICE = 100;
/** FORMULAS.md: lose land if owner has not logged in within 7 days */
const LAND_INACTIVITY_MS = 7 * MS_PER_DAY;
const LANDLORD_DAILY_TAX_PCT = 0.1;

function isFrontier(plot: Pick<ILand, "type">): boolean {
  return plot.type === "frontier";
}

export function loginRemainingMs(lastLoginAt: Date | null | undefined): number {
  if (!lastLoginAt) return 0;
  const elapsed = Date.now() - new Date(lastLoginAt).getTime();
  return Math.max(0, LAND_INACTIVITY_MS - elapsed);
}

async function abandonPlot(plot: ILand): Promise<void> {
  const previousOwnerId = plot.ownerId?.toString() ?? null;
  plot.previousOwnerId = plot.ownerId;
  plot.ownerId = null;
  plot.ownerWallet = null;
  plot.landlordHandle = null;
  plot.landlordAvatarUrl = null;
  plot.status = "abandoned";
  plot.abandonedAt = new Date();
  plot.renters = [];
  await plot.save();

  emitTerritoryEvent("landLost", { plotId: plot.plotId, previousOwnerId });
  emitPlotPatch(toPlotPatch(plot));
}

/** Abandon all frontier plots for an owner who exceeded the 7-day login window. */
export async function abandonFrontierPlotsForOwner(ownerId: string): Promise<number> {
  const plots = await Land.find({
    type: "frontier",
    status: "owned",
    ownerId: new Types.ObjectId(ownerId),
  });

  for (const plot of plots) {
    await abandonPlot(plot);
  }
  return plots.length;
}

/** FORMULAS.md: owners inactive 7+ days (by lastLoginAt) lose frontier plots. */
export async function enforceLandInactivity(): Promise<number> {
  const cutoff = new Date(Date.now() - LAND_INACTIVITY_MS);
  const inactiveOwners = await User.find({
    $or: [{ lastLoginAt: { $lt: cutoff } }, { lastLoginAt: null }],
  }).select("_id");

  let count = 0;
  for (const owner of inactiveOwners) {
    count += await abandonFrontierPlotsForOwner(owner._id.toString());
  }
  return count;
}

async function expireStaleLeases() {
  const now = new Date();
  const plots = await Land.find({ "renters.0": { $exists: true } });
  for (const plot of plots) {
    const before = plot.renters.length;
    plot.renters = plot.renters.filter((r) => r.leaseExpiresAt && r.leaseExpiresAt > now);
    if (plot.renters.length !== before) {
      await plot.save();
      emitPlotPatch(toPlotPatch(plot));
    }
  }
}

function sortedRenters(plot: Pick<ILand, "renters">) {
  return [...plot.renters].sort(
    (a, b) =>
      (b.sevenDayBid ?? b.escrowBalance ?? b.dailyBid * 7) -
      (a.sevenDayBid ?? a.escrowBalance ?? a.dailyBid * 7)
  );
}

function minOutbidAmount(sorted: ILand["renters"]): number {
  if (sorted.length === 0) return MIN_SEVEN_DAY_BID;
  const lowest = sorted[sorted.length - 1];
  const bid = lowest.sevenDayBid ?? lowest.escrowBalance ?? lowest.dailyBid * 7;
  return Math.ceil(bid * 1.1);
}

export async function listLands() {
  await enforceLandInactivity();
  await expireStaleLeases();
  const plots = await Land.find()
    .select(
      "plotId type legendaryTokenId name ownerWallet landlordHandle landlordAvatarUrl status renters abandonedAt"
    )
    .sort({ plotId: 1 })
    .lean();

  const enriched = await Promise.all(
    plots.map(async (p) => {
      if (p.type !== "legendary") return p;
      const configured = await getCrownTokenForPlot(p.plotId);
      return {
        ...p,
        legendaryTokenId: p.legendaryTokenId ?? configured,
      };
    })
  );

  return enriched;
}

export async function getLandDetail(plotId: number, viewerUserId?: string) {
  await enforceLandInactivity();
  await expireStaleLeases();

  const plot = await Land.findOne({ plotId }).lean();
  if (!plot) return null;

  const renters = sortedRenters({ renters: plot.renters ?? [] });
  const minBid = minOutbidAmount(renters);
  const isOwner =
    viewerUserId && plot.ownerId && plot.ownerId.toString() === viewerUserId;

  let loginRemainingMs: number | null = null;
  if (isOwner && isFrontier(plot) && plot.status === "owned") {
    const owner = await User.findById(plot.ownerId).select("lastLoginAt").lean();
    loginRemainingMs = loginRemainingMsFromDate(owner?.lastLoginAt ?? null);
  }

  let legendaryTokenId = plot.legendaryTokenId;
  if (plot.type === "legendary") {
    const configured = await getCrownTokenForPlot(plotId);
    if (configured != null) legendaryTokenId = configured;
  }

  return {
    ...plot,
    legendaryTokenId,
    isLegendary: plot.type === "legendary",
    renters,
    landType: plot.type === "legendary" ? "Legendary (Crown Land)" : "Frontier",
    displayId: String(plotId + 1).padStart(2, "0"),
    minBid,
    purchasePrice:
      isFrontier(plot) && plot.status === "unclaimed" && plotId >= 10 && plotId <= 99
        ? LAND_PURCHASE_PRICE
        : null,
    canTakeover: isFrontier(plot) && plot.status === "abandoned",
    loginRemainingMs,
    landlordTaxPct: 10,
  };
}

function loginRemainingMsFromDate(lastLoginAt: Date | null): number {
  return loginRemainingMs(lastLoginAt);
}

export async function purchaseLand(userId: string, plotId: number) {
  if (plotId < 10 || plotId > 99) {
    throw new Error("Only frontier plots 11–100 can be purchased");
  }

  const wallet = await getWalletAddress(userId);
  if (!wallet) throw new Error("Connect wallet before purchasing land");

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const plot = await Land.findOne({ plotId });
  if (!plot) throw new Error("Plot not found");
  if (!isFrontier(plot) || plot.status !== "unclaimed" || plot.ownerId) {
    throw new Error("Plot is not available for purchase");
  }

  const zCoins = await debitBalance(userId, "zCoins", LAND_PURCHASE_PRICE, "plot_purchase", {
    plotId,
  });

  plot.ownerId = user._id;
  plot.ownerWallet = wallet.toLowerCase();
  plot.landlordHandle = user.username;
  const nfts = await Nft.find({ userId: user._id }).select("tokenId imageUrl").lean();
  plot.landlordAvatarUrl = resolveDisplayAvatar(user, nfts);
  plot.purchasePrice = LAND_PURCHASE_PRICE;
  plot.status = "owned";
  plot.abandonedAt = null;
  plot.previousOwnerId = null;
  plot.renters = [];
  await plot.save();

  emitTerritoryEvent("landPurchased", {
    plotId,
    ownerWallet: plot.ownerWallet,
    ownerId: userId,
    status: "owned",
  });
  emitPlotPatch(toPlotPatch(plot));

  return { zCoins, plotId };
}

export async function takeoverLand(userId: string, plotId: number) {
  if (plotId < 10 || plotId > 99) {
    throw new Error("Only frontier plots 11–100 can be taken over");
  }

  const wallet = await getWalletAddress(userId);
  if (!wallet) throw new Error("Connect wallet before taking over land");

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const plot = await Land.findOne({ plotId });
  if (!plot) throw new Error("Plot not found");
  if (!isFrontier(plot) || plot.status !== "abandoned") {
    throw new Error("Plot is not abandoned");
  }

  const zCoins = await debitBalance(userId, "zCoins", LAND_PURCHASE_PRICE, "plot_purchase", {
    plotId,
    takeover: true,
  });

  plot.previousOwnerId = plot.ownerId;
  plot.ownerId = user._id;
  plot.ownerWallet = wallet.toLowerCase();
  plot.landlordHandle = user.username;
  const nfts = await Nft.find({ userId: user._id }).select("tokenId imageUrl").lean();
  plot.landlordAvatarUrl = resolveDisplayAvatar(user, nfts);
  plot.status = "owned";
  plot.abandonedAt = null;
  plot.renters = [];
  await plot.save();

  emitTerritoryEvent("landCaptured", {
    plotId,
    ownerWallet: plot.ownerWallet,
    ownerId: userId,
    status: "owned",
  });
  emitPlotPatch(toPlotPatch(plot));

  return { zCoins, plotId };
}

export async function processRentPayoutsForOwner(ownerId: string) {
  const plots = await Land.find({ ownerId });
  const now = new Date();

  for (const plot of plots) {
    let plotChanged = false;
    for (const renter of plot.renters) {
      if (!renter.lastRentPayoutAt) {
        renter.lastRentPayoutAt = renter.leaseStartedAt ?? now;
        plotChanged = true;
      }
      const elapsed = now.getTime() - renter.lastRentPayoutAt.getTime();
      const daysDue = Math.floor(elapsed / MS_PER_DAY);
      if (daysDue <= 0) continue;

      const sevenDayBid =
        renter.sevenDayBid ?? renter.escrowBalance ?? (renter.dailyBid ?? 0) * 7;
      const dailyPayout = Math.floor(sevenDayBid * LANDLORD_DAILY_TAX_PCT);
      const totalPayout = dailyPayout * daysDue;

      if (totalPayout > 0) {
        await creditBalance(ownerId, "zCoins", totalPayout, "rent_income", {
          plotId: plot.plotId,
          renterWallet: renter.walletAddress,
          daysDue,
        });
      }

      renter.lastRentPayoutAt = new Date(
        renter.lastRentPayoutAt.getTime() + daysDue * MS_PER_DAY
      );
      plotChanged = true;
    }
    if (plotChanged) await plot.save();
  }
}

export async function placeBid(userId: string, plotId: number, sevenDayBid: number) {
  if (!Number.isInteger(sevenDayBid)) {
    throw new Error("Bid must be a whole number of Z-Coins");
  }

  const wallet = await getWalletAddress(userId);
  if (!wallet) throw new Error("Connect wallet before bidding");

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const plot = await Land.findOne({ plotId });
  if (!plot) throw new Error("Plot not found");
  if (plot.status !== "owned" || !plot.ownerId) {
    throw new Error("Cannot bid on unowned land");
  }

  await processRentPayoutsForOwner(plot.ownerId.toString());

  const sorted = sortedRenters(plot);
  const minBid = minOutbidAmount(sorted);
  if (sevenDayBid < minBid) {
    throw new Error(`Minimum 7-day bid is ${minBid} Z-Coins`);
  }

  const normalizedWallet = wallet.toLowerCase();
  const existingIdx = plot.renters.findIndex(
    (r) => r.walletAddress.toLowerCase() === normalizedWallet
  );

  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + 7 * MS_PER_DAY);

  const zCoins = await debitBalance(userId, "zCoins", sevenDayBid, "plot_bid", {
    plotId,
    sevenDayBid,
  });

  const renterEntry = {
    walletAddress: normalizedWallet,
    twitterHandle: user.username,
    sevenDayBid,
    dailyBid: Math.floor(sevenDayBid / 7),
    escrowBalance: sevenDayBid,
    leaseStartedAt: now,
    leaseExpiresAt,
    lastRentPayoutAt: now,
  };

  if (existingIdx >= 0) {
    plot.renters[existingIdx] = renterEntry;
  } else if (plot.renters.length < MAX_RENTERS) {
    plot.renters.push(renterEntry);
  } else {
    const lowest = sorted[sorted.length - 1];
    if (sevenDayBid < minBid) {
      throw new Error("Bid too low to outbid lowest renter");
    }
    const outIdx = plot.renters.findIndex(
      (r) => r.walletAddress.toLowerCase() === lowest.walletAddress.toLowerCase()
    );
    plot.renters[outIdx] = renterEntry;
  }

  await plot.save();

  const updatedRenters = sortedRenters(plot);
  emitTerritoryEvent("bidPlaced", {
    plotId,
    renters: updatedRenters,
    minBid: minOutbidAmount(updatedRenters),
  });
  emitPlotPatch(toPlotPatch(plot));

  return { zCoins, plotId, sevenDayBid };
}

export type { ILand };
