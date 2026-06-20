import { Types } from "mongoose";
import { User, type IUser } from "../models/User";
import { Skill } from "../models/Skill";
import { RoomLayout } from "../models/RoomLayout";
import { ensureResources, getBalances } from "./resources";

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
  let user = await User.findOne({ twitterId: input.twitterId });
  const now = new Date();

  if (!user) {
    user = await User.create({
      twitterId: input.twitterId,
      username: handle,
      profilePicUrl: input.profilePicUrl ?? "",
      lastLoginAt: now,
      lastClaimAt: now,
      lastCoinsClaimAt: now,
    });
    await Skill.create({ userId: user._id });
    await RoomLayout.create({ userId: user._id });
    await ensureResources(user._id.toString());
  } else {
    user.username = handle;
    if (input.profilePicUrl) user.profilePicUrl = input.profilePicUrl;
    if (!user.lastCoinsClaimAt) {
      user.lastCoinsClaimAt = user.lastClaimAt ?? now;
    }
    user.lastLoginAt = now;
    await user.save();
    await ensureResources(user._id.toString());
  }

  return { user, loginCoinsAwarded: 0 };
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

export function userIdString(user: IUser | { _id: Types.ObjectId }): string {
  return user._id.toString();
}

export { getBalances };
