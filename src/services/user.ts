import { Types } from "mongoose";
import { User, type IUser } from "../models/User";
import { Skill } from "../models/Skill";
import { RoomLayout } from "../models/RoomLayout";
import { ensureResources, creditBalance, getBalances } from "./resources";
import { DAILY_LOGIN_COINS, MS_PER_DAY } from "../lib/constants";

export async function findUserById(userId: string): Promise<IUser | null> {
  return User.findById(userId);
}

export async function findUserByTwitterId(twitterId: string): Promise<IUser | null> {
  return User.findOne({ twitterId });
}

export async function bootstrapUser(input: {
  twitterId: string;
  username: string;
  profilePicUrl?: string;
}): Promise<{ user: IUser; loginCoinsAwarded: number }> {
  const handle = input.username.startsWith("@") ? input.username : `@${input.username}`;
  let loginCoinsAwarded = 0;

  let user = await User.findOne({ twitterId: input.twitterId });
  const now = new Date();

  if (!user) {
    user = await User.create({
      twitterId: input.twitterId,
      username: handle,
      profilePicUrl: input.profilePicUrl ?? "",
      lastLoginAt: now,
      lastClaimAt: now,
    });
    await Skill.create({ userId: user._id });
    await RoomLayout.create({ userId: user._id });
    await ensureResources(user._id.toString());
    await creditBalance(user._id.toString(), "coins", DAILY_LOGIN_COINS, "daily_login");
    loginCoinsAwarded = DAILY_LOGIN_COINS;
  } else {
    user.username = handle;
    if (input.profilePicUrl) user.profilePicUrl = input.profilePicUrl;

    const elapsed = now.getTime() - user.lastLoginAt.getTime();
    if (elapsed >= MS_PER_DAY) {
      await creditBalance(user._id.toString(), "coins", DAILY_LOGIN_COINS, "daily_login");
      loginCoinsAwarded = DAILY_LOGIN_COINS;
    }

    user.lastLoginAt = now;
    await user.save();
    await ensureResources(user._id.toString());
  }

  return { user, loginCoinsAwarded };
}

export async function updateUserNftCache(
  userId: string,
  nftCount: number,
  multiplier: number
): Promise<void> {
  await User.updateOne({ _id: userId }, { $set: { nftCount, multiplier } });
}

export async function resetUserNftCache(userId: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $set: { nftCount: 0, multiplier: 1 } });
}

export async function claimDailyTask(userId: string): Promise<{ coins: number; awarded: number }> {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const now = new Date();
  if (user.lastDailyTaskAt) {
    const elapsed = now.getTime() - user.lastDailyTaskAt.getTime();
    if (elapsed < MS_PER_DAY) {
      throw new Error("Daily task already claimed. Try again later.");
    }
  }

  const { DAILY_TASK_COINS } = await import("../lib/constants");
  const balance = await creditBalance(userId, "coins", DAILY_TASK_COINS, "daily_task");
  user.lastDailyTaskAt = now;
  await user.save();
  return { coins: balance, awarded: DAILY_TASK_COINS };
}

export function userIdString(user: IUser | { _id: Types.ObjectId }): string {
  return user._id.toString();
}

export { getBalances };
