import {
  calculateOfflineEarnings,
  getEconomyBreakdown,
  type NftToken,
} from "../lib/economy";
import { Nft } from "../models/Nft";
import type { IUser } from "../models/User";
import type { ISkill } from "../models/Skill";

export async function getUserNftsFromDb(userId: string): Promise<NftToken[]> {
  const docs = await Nft.find({ userId }).lean();
  return docs.map((n) => ({ tokenId: n.tokenId, rarity: n.rarity }));
}

export async function getUserEconomy(user: IUser, skill: ISkill) {
  const nfts = await getUserNftsFromDb(user._id.toString());
  const breakdown = getEconomyBreakdown({ nfts, powerLvl: skill.powerLvl });
  const pendingEarnings = calculateOfflineEarnings(breakdown.dailyRate, user.lastClaimAt);
  return { nfts, breakdown, pendingEarnings };
}
