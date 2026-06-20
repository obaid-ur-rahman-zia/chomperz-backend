import mongoose, { Schema, Document, Types } from "mongoose";
import type { CurrencyType } from "./Resource";

export type TransactionKind =
  | "claim"
  | "claim_coins"
  | "upgrade"
  | "crib_buy"
  | "plot_bid"
  | "plot_purchase"
  | "rent_income"
  | "skill_reward";

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  type: TransactionKind;
  currency: CurrencyType;
  amount: number;
  balanceAfter: number;
  meta: Record<string, unknown>;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "claim",
        "claim_coins",
        "upgrade",
        "crib_buy",
        "plot_bid",
        "plot_purchase",
        "rent_income",
        "skill_reward",
      ],
      required: true,
    },
    currency: { type: String, enum: ["zCoins", "coins"], required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model<ITransaction>("Transaction", TransactionSchema);
