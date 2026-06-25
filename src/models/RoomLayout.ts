import mongoose, { Schema, Document, Types } from "mongoose";

export interface ILayoutEntry {
  itemId: string;
  x: number;
  y: number;
  instanceId?: string;
  rotated?: boolean;
  rotation?: number;
}

export interface IRoomLayout extends Document {
  userId: Types.ObjectId;
  ownedFurniture: string[];
  layout: ILayoutEntry[];
  floorId: string | null;
}

const LayoutEntrySchema = new Schema<ILayoutEntry>(
  {
    itemId: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    instanceId: { type: String },
    rotated: { type: Boolean, default: false },
    rotation: { type: Number, default: 0, min: 0, max: 3 },
  },
  { _id: false }
);

const RoomLayoutSchema = new Schema<IRoomLayout>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    ownedFurniture: { type: [String], default: [] },
    layout: { type: [LayoutEntrySchema], default: [] },
    floorId: { type: String, default: null },
  },
  { timestamps: true }
);

export const RoomLayout = mongoose.model<IRoomLayout>("RoomLayout", RoomLayoutSchema);
