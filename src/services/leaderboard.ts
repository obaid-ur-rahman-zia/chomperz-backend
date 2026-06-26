import mongoose from "mongoose";
import { User } from "../models/User";
import { Resource } from "../models/Resource";
import { Skill } from "../models/Skill";
import { Nft } from "../models/Nft";
import { resolveDisplayAvatar } from "./avatar";

export type LeaderboardBoard = "zCoins" | "coins" | "power" | "nfts";

export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  profilePicUrl: string;
  displayAvatarUrl: string;
  value: number;
}

async function enrichLeaderboardRows(
  rows: Array<{ userId: string; username: string; profilePicUrl: string; value: number }>
): Promise<LeaderboardRow[]> {
  if (rows.length === 0) return [];

  const userIds = rows.map((r) => r.userId);
  const users = await User.find({ _id: { $in: userIds } }).lean();
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
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

  return rows.map((row, i) => {
    const user = userById.get(row.userId);
    const avatar = user
      ? resolveDisplayAvatar(user, nftsByUser.get(row.userId) ?? [])
      : row.profilePicUrl;
    return {
      rank: i + 1,
      userId: row.userId,
      username: row.username,
      profilePicUrl: avatar,
      displayAvatarUrl: avatar,
      value: row.value,
    };
  });
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

    return enrichLeaderboardRows(
      users.map((u) => ({
        userId: u._id.toString(),
        username: u.username,
        profilePicUrl: u.profilePicUrl,
        value: u.nftCount,
      }))
    );
  }

  if (board === "power") {
    const skills = await Skill.find({})
      .sort({ powerLvl: -1 })
      .limit(limit)
      .populate<{ userId: { username: string; profilePicUrl: string } }>("userId", "username profilePicUrl")
      .lean();

    return enrichLeaderboardRows(
      skills
        .filter((s) => s.userId && typeof s.userId === "object")
        .map((s) => {
          const user = s.userId as {
            _id: mongoose.Types.ObjectId;
            username: string;
            profilePicUrl: string;
          };
          return {
            userId: user._id.toString(),
            username: user.username,
            profilePicUrl: user.profilePicUrl,
            value: s.powerLvl,
          };
        })
    );
  }

  const currency = board === "zCoins" ? "zCoins" : "coins";
  const resources = await Resource.find({ type: currency })
    .sort({ balance: -1 })
    .limit(limit)
    .populate<{ userId: { username: string; profilePicUrl: string } }>("userId", "username profilePicUrl")
    .lean();

  return enrichLeaderboardRows(
    resources
      .filter((r) => r.userId && typeof r.userId === "object")
      .map((r) => {
        const user = r.userId as {
          _id: mongoose.Types.ObjectId;
          username: string;
          profilePicUrl: string;
        };
        return {
          userId: user._id.toString(),
          username: user.username,
          profilePicUrl: user.profilePicUrl,
          value: r.balance,
        };
      })
  );
}
