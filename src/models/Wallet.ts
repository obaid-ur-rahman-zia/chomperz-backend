import mongoose, { Schema, Document, Types } from "mongoose";

export interface IWallet extends Document {
  userId: Types.ObjectId;
  address: string;
  linkedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    address: { type: String, required: true, unique: true, lowercase: true },
    linkedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Wallet = mongoose.model<IWallet>("Wallet", WalletSchema);
