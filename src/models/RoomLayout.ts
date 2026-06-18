import mongoose, { Schema, Document, Types } from "mongoose";

export interface ILayoutEntry {
  itemId: string;
  x: number;
  y: number;
}

export interface IRoomLayout extends Document {
  userId: Types.ObjectId;
  ownedFurniture: string[];
  layout: ILayoutEntry[];
}

const LayoutEntrySchema = new Schema<ILayoutEntry>(
  {
    itemId: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false }
);

const RoomLayoutSchema = new Schema<IRoomLayout>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    ownedFurniture: { type: [String], default: [] },
    layout: { type: [LayoutEntrySchema], default: [] },
  },
  { timestamps: true }
);

export const RoomLayout = mongoose.model<IRoomLayout>("RoomLayout", RoomLayoutSchema);
