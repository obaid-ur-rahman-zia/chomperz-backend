import mongoose, { Schema, Document } from "mongoose";

export interface IPlayer extends Document {
  twitterId: string;
  twitterHandle: string;
  profilePicUrl: string;
  walletAddress: string | null;
  zCoins: number;
  powerLvl: number;
  speedLvl: number;
  cooldownEndsAt: Date;
  lastClaimedAt: Date;
  cachedNftCount: number;
  cachedRaritySum: number;
  cachedTokenIds: number[];
  ownedFurniture: string[];
  cribLayout: { itemId: string; x: number; y: number }[];
}

const PlayerSchema = new Schema<IPlayer>(
  {
    twitterId: { type: String, required: true, unique: true },
    twitterHandle: { type: String, required: true },
    profilePicUrl: { type: String, default: "" },
    walletAddress: {
      type: String,
      lowercase: true,
      sparse: true,
      unique: true,
    },
    zCoins: { type: Number, default: 0 },
    powerLvl: { type: Number, default: 0, max: 100 },
    speedLvl: { type: Number, default: 0, max: 100 },
    cooldownEndsAt: { type: Date, default: Date.now },
    lastClaimedAt: { type: Date, default: Date.now },
    cachedNftCount: { type: Number, default: 0 },
    cachedRaritySum: { type: Number, default: 0 },
    cachedTokenIds: { type: [Number], default: [] },
    ownedFurniture: { type: [String], default: [] },
    cribLayout: {
      type: [
        {
          itemId: String,
          x: Number,
          y: Number,
          _id: false,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const Player = mongoose.model<IPlayer>("Player", PlayerSchema);
