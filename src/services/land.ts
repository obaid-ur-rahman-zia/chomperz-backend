import { Land, type ILand } from "../models/Land";
import { User } from "../models/User";
import { debitBalance, creditBalance } from "./resources";
import { getWalletAddress } from "./wallet";
import { MS_PER_DAY } from "../lib/constants";

const MAX_RENTERS = 3;
const MIN_SEVEN_DAY_BID = 7;
const LAND_PURCHASE_PRICE = 100;
const LAND_INACTIVITY_MS = 7 * MS_PER_DAY;
const LANDLORD_DAILY_TAX_PCT = 0.1;

export async function enforceLandInactivity() {
  const cutoff = new Date(Date.now() - LAND_INACTIVITY_MS);
  const staleOwners = await User.find({ lastLoginAt: { $lt: cutoff } }).select("_id").lean();
  const staleIds = staleOwners.map((u) => u._id);

  if (staleIds.length === 0) return;

  await Land.updateMany(
    { ownerId: { $in: staleIds }, status: "owned" },
    {
      $set: {
        ownerId: null,
        ownerWallet: null,
        landlordHandle: null,
        landlordAvatarUrl: null,
        status: "unclaimed",
        renters: [],
      },
    }
  );
}

export async function listLands() {
  await enforceLandInactivity();
  await expireStaleLeases();
  return Land.find()
    .select("plotId type legendaryTokenId name ownerWallet landlordHandle status renters")
    .sort({ plotId: 1 })
    .lean();
}

async function expireStaleLeases() {
  const now = new Date();
  const plots = await Land.find({ "renters.0": { $exists: true } });
  for (const plot of plots) {
    const before = plot.renters.length;
    plot.renters = plot.renters.filter((r) => r.leaseExpiresAt && r.leaseExpiresAt > now);
    if (plot.renters.length !== before) {
      await plot.save();
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

export async function getLandDetail(plotId: number) {
  await enforceLandInactivity();
  await expireStaleLeases();

  const plot = await Land.findOne({ plotId }).lean();
  if (!plot) return null;

  const renters = sortedRenters({ renters: plot.renters ?? [] });
  const minBid = minOutbidAmount(renters);

  return {
    ...plot,
    isLegendary: plot.type === "legendary",
    renters,
    landType: plot.type === "legendary" ? "Legendary (Crown Land)" : "Frontier",
    displayId: String(plotId + 1).padStart(2, "0"),
    minBid,
    purchasePrice: plot.status === "unclaimed" && plotId >= 10 && plotId <= 99 ? LAND_PURCHASE_PRICE : null,
    landlordTaxPct: 10,
  };
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
  if (plot.status !== "unclaimed" || plot.ownerId) {
    throw new Error("Plot is not available for purchase");
  }

  const zCoins = await debitBalance(userId, "zCoins", LAND_PURCHASE_PRICE, "plot_purchase", {
    plotId,
  });

  plot.ownerId = user._id;
  plot.ownerWallet = wallet.toLowerCase();
  plot.landlordHandle = user.username;
  plot.landlordAvatarUrl = user.profilePicUrl;
  plot.purchasePrice = LAND_PURCHASE_PRICE;
  plot.status = "owned";
  plot.renters = [];
  await plot.save();

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
  return { zCoins, plotId, sevenDayBid };
}

export type { ILand };
