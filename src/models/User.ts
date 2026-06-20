import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  twitterId: string;
  username: string;
  profilePicUrl: string;
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
    nftCount: { type: Number, default: 0 },
    multiplier: { type: Number, default: 1 },
    lastLoginAt: { type: Date, default: Date.now },
    lastClaimAt: { type: Date, default: Date.now },
    lastCoinsClaimAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
