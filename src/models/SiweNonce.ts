import mongoose, { Schema, Document } from "mongoose";

export interface ISiweNonce extends Document {
  nonce: string;
  userId: string;
  createdAt: Date;
}

const SiweNonceSchema = new Schema<ISiweNonce>({
  nonce: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 },
});

export const SiweNonce = mongoose.model<ISiweNonce>("SiweNonce", SiweNonceSchema);
