import mongoose, { Schema, Document, Types } from "mongoose";

export type CurrencyType = "zCoins" | "coins";

export interface IResource extends Document {
  userId: Types.ObjectId;
  type: CurrencyType;
  balance: number;
}

const ResourceSchema = new Schema<IResource>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["zCoins", "coins"], required: true },
    balance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

ResourceSchema.index({ userId: 1, type: 1 }, { unique: true });

export const Resource = mongoose.model<IResource>("Resource", ResourceSchema);
