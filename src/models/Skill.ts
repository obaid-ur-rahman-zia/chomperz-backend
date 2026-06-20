import mongoose, { Schema, Document, Types } from "mongoose";

export type ActiveSkillType = "woodcutting" | "mining" | "carpentry" | "smithing";

export interface IActiveAction {
  skill: ActiveSkillType;
  startedAt: Date;
  durationMs: number;
}

export interface ISkill extends Document {
  userId: Types.ObjectId;
  powerLvl: number;
  speedLvl: number;
  selectedSkill: ActiveSkillType | null;
  woodcuttingLvl: number;
  miningLvl: number;
  carpentryLvl: number;
  smithingLvl: number;
  woodcuttingXp: number;
  miningXp: number;
  carpentryXp: number;
  smithingXp: number;
  speedUpgradingUntil: Date | null;
  powerUpgradingUntil: Date | null;
  activeAction: IActiveAction | null;
}

const ActiveActionSchema = new Schema<IActiveAction>(
  {
    skill: {
      type: String,
      enum: ["woodcutting", "mining", "carpentry", "smithing"],
      required: true,
    },
    startedAt: { type: Date, required: true },
    durationMs: { type: Number, required: true },
  },
  { _id: false }
);

const SkillSchema = new Schema<ISkill>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    powerLvl: { type: Number, default: 0, max: 100 },
    speedLvl: { type: Number, default: 0, max: 100 },
    selectedSkill: {
      type: String,
      enum: ["woodcutting", "mining", "carpentry", "smithing", null],
      default: "woodcutting",
    },
    woodcuttingLvl: { type: Number, default: 1 },
    miningLvl: { type: Number, default: 1 },
    carpentryLvl: { type: Number, default: 1 },
    smithingLvl: { type: Number, default: 1 },
    woodcuttingXp: { type: Number, default: 0 },
    miningXp: { type: Number, default: 0 },
    carpentryXp: { type: Number, default: 0 },
    smithingXp: { type: Number, default: 0 },
    speedUpgradingUntil: { type: Date, default: null },
    powerUpgradingUntil: { type: Date, default: null },
    activeAction: { type: ActiveActionSchema, default: null },
  },
  { timestamps: true }
);

export const Skill = mongoose.model<ISkill>("Skill", SkillSchema);

export const ACTIVE_SKILL_TYPES: ActiveSkillType[] = [
  "woodcutting",
  "mining",
  "carpentry",
  "smithing",
];

export function getSkillLevel(skill: ISkill, type: ActiveSkillType): number {
  switch (type) {
    case "woodcutting":
      return skill.woodcuttingLvl;
    case "mining":
      return skill.miningLvl;
    case "carpentry":
      return skill.carpentryLvl;
    case "smithing":
      return skill.smithingLvl;
  }
}

export function getSkillXp(skill: ISkill, type: ActiveSkillType): number {
  switch (type) {
    case "woodcutting":
      return skill.woodcuttingXp;
    case "mining":
      return skill.miningXp;
    case "carpentry":
      return skill.carpentryXp;
    case "smithing":
      return skill.smithingXp;
  }
}

export function setSkillLevel(skill: ISkill, type: ActiveSkillType, level: number): void {
  switch (type) {
    case "woodcutting":
      skill.woodcuttingLvl = level;
      break;
    case "mining":
      skill.miningLvl = level;
      break;
    case "carpentry":
      skill.carpentryLvl = level;
      break;
    case "smithing":
      skill.smithingLvl = level;
      break;
  }
}

export function addSkillXp(skill: ISkill, type: ActiveSkillType, xp: number): void {
  switch (type) {
    case "woodcutting":
      skill.woodcuttingXp += xp;
      break;
    case "mining":
      skill.miningXp += xp;
      break;
    case "carpentry":
      skill.carpentryXp += xp;
      break;
    case "smithing":
      skill.smithingXp += xp;
      break;
  }
}
