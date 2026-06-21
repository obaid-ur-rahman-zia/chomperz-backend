import mongoose, { Schema, Document } from "mongoose";
import type { RarityTier } from "../lib/economy";

export interface ICrownBinding {
  plotId: number;
  tokenId: number;
}

export interface IRarityOverride {
  tokenId: number;
  rarity: RarityTier;
}

export interface ICollectionConfig extends Document {
  contractAddress: string;
  crownBindings: ICrownBinding[];
  rarityOverrides: IRarityOverride[];
}

const CrownBindingSchema = new Schema<ICrownBinding>(
  {
    plotId: { type: Number, required: true, min: 0, max: 9 },
    tokenId: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const RarityOverrideSchema = new Schema<IRarityOverride>(
  {
    tokenId: { type: Number, required: true, min: 1 },
    rarity: {
      type: String,
      enum: ["common", "uncommon", "rare", "legendary"],
      required: true,
    },
  },
  { _id: false }
);

const CollectionConfigSchema = new Schema<ICollectionConfig>({
  contractAddress: { type: String, required: true, unique: true, lowercase: true },
  crownBindings: { type: [CrownBindingSchema], default: [] },
  rarityOverrides: { type: [RarityOverrideSchema], default: [] },
});

export const CollectionConfig = mongoose.model<ICollectionConfig>(
  "CollectionConfig",
  CollectionConfigSchema
);
