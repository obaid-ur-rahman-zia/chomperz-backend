import { Types } from "mongoose";
import { User, type IUser } from "../models/User";
import { Skill } from "../models/Skill";
import { RoomLayout } from "../models/RoomLayout";
import { ensureResources, getBalances } from "./resources";
import { abandonFrontierPlotsForOwner } from "./land";
import { ensureDevStartingBalances } from "./devEconomy";
import { MS_PER_DAY } from "../lib/constants";

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
    const inactivityCutoff = Date.now() - 7 * MS_PER_DAY;
    if (user.lastLoginAt && user.lastLoginAt.getTime() < inactivityCutoff) {
      await abandonFrontierPlotsForOwner(user._id.toString());
    }
    user.lastLoginAt = now;
    await user.save();
    await ensureResources(user._id.toString());
  }

  await ensureDevStartingBalances(user._id.toString());

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

export function normalizeHandle(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export async function findUserByHandle(handle: string) {
  const username = normalizeHandle(handle);
  const user = await User.findOne({ username });
  if (!user) {
    throw new Error(`User ${username} not found`);
  }
  return { user, username };
}

export { getBalances };
