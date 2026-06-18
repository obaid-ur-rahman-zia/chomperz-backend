import mongoose, { Schema, Document, Types } from "mongoose";
import type { RarityTier } from "../lib/economy";

export interface INft extends Document {
  userId: Types.ObjectId;
  contractAddress: string;
  tokenId: number;
  rarity: RarityTier;
  metadataUri: string;
  lastSyncedAt: Date;
}

const NftSchema = new Schema<INft>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    contractAddress: { type: String, required: true, lowercase: true },
    tokenId: { type: Number, required: true },
    rarity: {
      type: String,
      enum: ["common", "uncommon", "rare", "legendary"],
      required: true,
    },
    metadataUri: { type: String, default: "" },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

NftSchema.index({ contractAddress: 1, tokenId: 1 }, { unique: true });

export const Nft = mongoose.model<INft>("Nft", NftSchema);
