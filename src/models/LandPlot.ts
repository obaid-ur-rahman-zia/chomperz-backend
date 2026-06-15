import mongoose, { Schema, Document } from "mongoose";
import type { PlotStatus } from "../lib/economy";

export interface IRenter {
  walletAddress: string;
  twitterHandle: string;
  dailyBid: number;
  escrowBalance: number;
}

export interface ILandPlot extends Document {
  plotId: number;
  isLegendary: boolean;
  legendaryTokenId: number | null;
  name: string;
  ownerWallet: string | null;
  landlordHandle: string | null;
  landlordAvatarUrl: string | null;
  status: PlotStatus;
  renters: IRenter[];
}

const RenterSchema = new Schema<IRenter>(
  {
    walletAddress: { type: String, required: true },
    twitterHandle: { type: String, default: "" },
    dailyBid: { type: Number, required: true },
    escrowBalance: { type: Number, required: true },
  },
  { _id: false }
);

const LandPlotSchema = new Schema<ILandPlot>({
  plotId: { type: Number, required: true, unique: true, min: 0, max: 99 },
  isLegendary: { type: Boolean, default: false },
  legendaryTokenId: { type: Number, default: null },
  name: { type: String, required: true },
  ownerWallet: { type: String, default: null, lowercase: true },
  landlordHandle: { type: String, default: null },
  landlordAvatarUrl: { type: String, default: null },
  status: {
    type: String,
    enum: ["unclaimed", "owned", "abandoned"],
    default: "unclaimed",
  },
  renters: {
    type: [RenterSchema],
    validate: {
      validator: (v: IRenter[]) => v.length <= 3,
      message: "Maximum 3 renters per plot",
    },
  },
});

export const LandPlot = mongoose.model<ILandPlot>("LandPlot", LandPlotSchema);
