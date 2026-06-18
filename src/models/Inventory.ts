import mongoose, { Schema, Document, Types } from "mongoose";

export interface IInventory extends Document {
  userId: Types.ObjectId;
  itemId: string;
  quantity: number;
}

const InventorySchema = new Schema<IInventory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    itemId: { type: String, required: true },
    quantity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

InventorySchema.index({ userId: 1, itemId: 1 }, { unique: true });

export const Inventory = mongoose.model<IInventory>("Inventory", InventorySchema);
