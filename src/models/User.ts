import mongoose, { Schema, Document } from "mongoose";

export type AvatarSource = "default" | "twitter" | "nft";

export interface IUser extends Document {
  twitterId: string;
  username: string;
  profilePicUrl: string;
  avatarSource: AvatarSource;
  avatarNftTokenId: number | null;
  nftCount: number;
  multiplier: number;
  lastLoginAt: Date;
  lastClaimAt: Date;
  lastCoinsClaimAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    twitterId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    profilePicUrl: { type: String, default: "" },
    avatarSource: { type: String, enum: ["default", "twitter", "nft"], default: "default" },
    avatarNftTokenId: { type: Number, default: null },
    nftCount: { type: Number, default: 0 },
    multiplier: { type: Number, default: 1 },
    lastLoginAt: { type: Date, default: Date.now },
    lastClaimAt: { type: Date, default: Date.now },
    lastCoinsClaimAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
