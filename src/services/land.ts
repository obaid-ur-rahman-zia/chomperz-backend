import { Land, type ILand } from "../models/Land";
import { debitBalance } from "./resources";
import { getWalletAddress } from "./wallet";
import { User } from "../models/User";

const MAX_RENTERS = 3;

export async function listLands() {
  return Land.find()
    .select("plotId type legendaryTokenId name ownerWallet landlordHandle status renters")
    .sort({ plotId: 1 })
    .lean();
}

export async function getLandDetail(plotId: number) {
  const plot = await Land.findOne({ plotId }).lean();
  if (!plot) return null;

  const sortedRenters = [...(plot.renters ?? [])].sort((a, b) => b.dailyBid - a.dailyBid);
  const minBid =
    sortedRenters.length > 0 ? sortedRenters[sortedRenters.length - 1].dailyBid + 1 : 1;

  return {
    ...plot,
    isLegendary: plot.type === "legendary",
    renters: sortedRenters,
    landType: plot.type === "legendary" ? "Legendary (Crown Land)" : "Frontier",
    displayId: String(plotId + 1).padStart(2, "0"),
    minBid,
    landlordTaxPct: 10,
  };
}

export async function placeBid(userId: string, plotId: number, amount: number) {
  const wallet = await getWalletAddress(userId);
  if (!wallet) throw new Error("Connect wallet before bidding");

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const plot = await Land.findOne({ plotId });
  if (!plot) throw new Error("Plot not found");

  const sorted = [...plot.renters].sort((a, b) => b.dailyBid - a.dailyBid);
  const minBid = sorted.length > 0 ? sorted[sorted.length - 1].dailyBid + 1 : 1;
  if (amount < minBid) throw new Error(`Minimum bid is ${minBid}`);

  const escrowDeposit = amount * 7;

  const normalizedWallet = wallet.toLowerCase();
  const existingIdx = plot.renters.findIndex(
    (r) => r.walletAddress.toLowerCase() === normalizedWallet
  );

  if (existingIdx < 0 && plot.renters.length >= MAX_RENTERS) {
    const lowest = sorted[sorted.length - 1];
    if (amount <= lowest.dailyBid) {
      throw new Error("Bid too low to outbid lowest renter");
    }
  }

  const zCoins = await debitBalance(userId, "zCoins", escrowDeposit, "plot_bid", {
    plotId,
    dailyBid: amount,
  });

  if (existingIdx >= 0) {
    plot.renters[existingIdx].dailyBid = amount;
    plot.renters[existingIdx].escrowBalance = escrowDeposit;
    plot.renters[existingIdx].twitterHandle = user.username;
  } else if (plot.renters.length < MAX_RENTERS) {
    plot.renters.push({
      walletAddress: normalizedWallet,
      twitterHandle: user.username,
      dailyBid: amount,
      escrowBalance: escrowDeposit,
    });
  } else {
    const lowest = sorted[sorted.length - 1];
    if (amount <= lowest.dailyBid) {
      throw new Error("Bid too low to outbid lowest renter");
    }
    const outIdx = plot.renters.findIndex(
      (r) => r.walletAddress === lowest.walletAddress
    );
    plot.renters[outIdx] = {
      walletAddress: normalizedWallet,
      twitterHandle: user.username,
      dailyBid: amount,
      escrowBalance: escrowDeposit,
    };
  }

  await plot.save();
  return { zCoins, plotId, dailyBid: amount };
}

export type { ILand };
