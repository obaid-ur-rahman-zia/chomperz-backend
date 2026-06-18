import type { IUser } from "../models/User";
import type { ISkill } from "../models/Skill";
import { getChomperLabel } from "../lib/chomper";
import { getUserEconomy } from "./economy";
import { getBalances } from "./resources";
import { getWalletAddress } from "./wallet";
import { getUpgradeCosts } from "./skills";
import { Nft } from "../models/Nft";

export async function serializePlayer(user: IUser, skill: ISkill) {
  const userId = user._id.toString();
  const economy = await getUserEconomy(user, skill);
  const { zCoins, coins } = await getBalances(userId);
  const walletAddress = await getWalletAddress(userId);
  const tokenDocs = await Nft.find({ userId }).select("tokenId rarity").lean();
  const costs = getUpgradeCosts(skill);
  const nfts = tokenDocs.map((n) => ({ tokenId: n.tokenId, rarity: n.rarity }));

  return {
    id: user._id,
    twitterId: user.twitterId,
    twitterHandle: user.username,
    username: user.username,
    profilePicUrl: user.profilePicUrl,
    walletAddress,
    nftCount: user.nftCount,
    multiplier: user.multiplier,
    zCoins,
    coins,
    lastLoginAt: user.lastLoginAt,
    lastClaimedAt: user.lastClaimAt,
    lastClaimAt: user.lastClaimAt,
    powerLvl: skill.powerLvl,
    speedLvl: skill.speedLvl,
    powerUpgradeCost: costs.powerUpgradeCost,
    speedUpgradeCost: costs.speedUpgradeCost,
    cachedNftCount: economy.breakdown.nftCount,
    cachedTokenIds: tokenDocs.map((t) => t.tokenId),
    nfts,
    chomperLabel: getChomperLabel(economy.nfts),
    economy: {
      nftCount: economy.breakdown.nftCount,
      quantityBoost: economy.breakdown.quantityBoost,
      rarityBoost: economy.breakdown.rarityBoost,
      nftMultiplier: economy.breakdown.nftMultiplier,
      powerMultiplier: economy.breakdown.powerMultiplier,
      dailyRate: economy.breakdown.dailyRate,
      pendingEarnings: economy.pendingEarnings,
    },
  };
}
