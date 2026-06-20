import mongoose, { Schema, Document, Types } from "mongoose";
import type { PlotStatus } from "../lib/economy";

export interface IRenter {
  walletAddress: string;
  twitterHandle: string;
  /** Whole Z-Coins paid for 7-day lease */
  sevenDayBid: number;
  /** Derived daily rate (sevenDayBid / 7) for display */
  dailyBid: number;
  escrowBalance: number;
  leaseStartedAt: Date;
  leaseExpiresAt: Date;
  lastRentPayoutAt: Date | null;
}

export interface ILand extends Document {
  plotId: number;
  type: "legendary" | "frontier";
  ownerId: Types.ObjectId | null;
  ownerWallet: string | null;
  landlordHandle: string | null;
  landlordAvatarUrl: string | null;
  legendaryTokenId: number | null;
  purchasePrice: number;
  lastClaimAt: Date | null;
  abandonedAt: Date | null;
  previousOwnerId: Types.ObjectId | null;
  status: PlotStatus;
  name: string;
  renters: IRenter[];
}

const RenterSchema = new Schema<IRenter>(
  {
    walletAddress: { type: String, required: true },
    twitterHandle: { type: String, default: "" },
    sevenDayBid: { type: Number, required: true },
    dailyBid: { type: Number, required: true },
    escrowBalance: { type: Number, required: true },
    leaseStartedAt: { type: Date, required: true },
    leaseExpiresAt: { type: Date, required: true },
    lastRentPayoutAt: { type: Date, default: null },
  },
  { _id: false }
);

const LandSchema = new Schema<ILand>({
  plotId: { type: Number, required: true, unique: true, min: 0, max: 99 },
  type: { type: String, enum: ["legendary", "frontier"], required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  ownerWallet: { type: String, default: null, lowercase: true },
  landlordHandle: { type: String, default: null },
  landlordAvatarUrl: { type: String, default: null },
  legendaryTokenId: { type: Number, default: null },
  purchasePrice: { type: Number, default: 0 },
  lastClaimAt: { type: Date, default: null },
  abandonedAt: { type: Date, default: null },
  previousOwnerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  status: {
    type: String,
    enum: ["unclaimed", "owned", "abandoned"],
    default: "unclaimed",
  },
  name: { type: String, required: true },
  renters: {
    type: [RenterSchema],
    validate: {
      validator: (v: IRenter[]) => v.length <= 3,
      message: "Maximum 3 renters per plot",
    },
  },
});

export const Land = mongoose.model<ILand>("Land", LandSchema);
