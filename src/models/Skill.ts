import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISkill extends Document {
  userId: Types.ObjectId;
  powerLvl: number;
  speedLvl: number;
}

const SkillSchema = new Schema<ISkill>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    powerLvl: { type: Number, default: 0, max: 100 },
    speedLvl: { type: Number, default: 0, max: 100 },
  },
  { timestamps: true }
);

export const Skill = mongoose.model<ISkill>("Skill", SkillSchema);
