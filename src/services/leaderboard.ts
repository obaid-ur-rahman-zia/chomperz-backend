import mongoose from "mongoose";
import { User } from "../models/User";
import { Resource } from "../models/Resource";
import { Skill } from "../models/Skill";

export type LeaderboardBoard = "zCoins" | "coins" | "power" | "nfts";

export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  profilePicUrl: string;
  value: number;
}

export async function getLeaderboard(
  board: LeaderboardBoard,
  limit = 50
): Promise<LeaderboardRow[]> {
  if (board === "nfts") {
    const users = await User.find({})
      .sort({ nftCount: -1, username: 1 })
      .limit(limit)
      .select("username profilePicUrl nftCount")
      .lean();

    return users.map((u, i) => ({
      rank: i + 1,
      userId: u._id.toString(),
      username: u.username,
      profilePicUrl: u.profilePicUrl,
      value: u.nftCount,
    }));
  }

  if (board === "power") {
    const skills = await Skill.find({})
      .sort({ powerLvl: -1 })
      .limit(limit)
      .populate<{ userId: { username: string; profilePicUrl: string } }>("userId", "username profilePicUrl")
      .lean();

    return skills
      .filter((s) => s.userId && typeof s.userId === "object")
      .map((s, i) => {
        const user = s.userId as { _id: mongoose.Types.ObjectId; username: string; profilePicUrl: string };
        return {
          rank: i + 1,
          userId: user._id.toString(),
          username: user.username,
          profilePicUrl: user.profilePicUrl,
          value: s.powerLvl,
        };
      });
  }

  const currency = board === "zCoins" ? "zCoins" : "coins";
  const resources = await Resource.find({ type: currency })
    .sort({ balance: -1 })
    .limit(limit)
    .populate<{ userId: { username: string; profilePicUrl: string } }>("userId", "username profilePicUrl")
    .lean();

  return resources
    .filter((r) => r.userId && typeof r.userId === "object")
    .map((r, i) => {
      const user = r.userId as { _id: mongoose.Types.ObjectId; username: string; profilePicUrl: string };
      return {
        rank: i + 1,
        userId: user._id.toString(),
        username: user.username,
        profilePicUrl: user.profilePicUrl,
        value: r.balance,
      };
    });
}
