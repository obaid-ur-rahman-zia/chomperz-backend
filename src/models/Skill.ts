import mongoose, { Schema, Document, Types } from "mongoose";

export type ActiveSkillType = "woodcutting" | "mining" | "carpentry" | "smithing";

/** Gather skills — live actions only per FORMULAS.md (no offline skill engine). */
export const OFFLINE_SKILL_TYPES: ActiveSkillType[] = [];

export interface IPlayerSkillEntry {
  skillName: ActiveSkillType;
  level: number;
  xp: number;
  active: boolean;
}

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
  /** Per-skill records — source of truth for levels, XP, offline state */
  playerSkills: IPlayerSkillEntry[];
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

const PlayerSkillEntrySchema = new Schema<IPlayerSkillEntry>(
  {
    skillName: {
      type: String,
      enum: ["woodcutting", "mining", "carpentry", "smithing"],
      required: true,
    },
    level: { type: Number, default: 1, min: 1 },
    xp: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: false },
  },
  { _id: false }
);

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
    playerSkills: { type: [PlayerSkillEntrySchema], default: [] },
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

function legacyLevel(skill: ISkill, type: ActiveSkillType): number {
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

function legacyXp(skill: ISkill, type: ActiveSkillType): number {
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

export function ensurePlayerSkills(skill: ISkill): IPlayerSkillEntry[] {
  if (skill.playerSkills?.length === ACTIVE_SKILL_TYPES.length) {
    return skill.playerSkills;
  }

  const selected = skill.selectedSkill ?? "woodcutting";
  skill.playerSkills = ACTIVE_SKILL_TYPES.map((skillName) => ({
    skillName,
    level: legacyLevel(skill, skillName),
    xp: legacyXp(skill, skillName),
    active: skillName === selected,
  }));

  return skill.playerSkills;
}

export function getPlayerSkillEntry(skill: ISkill, type: ActiveSkillType): IPlayerSkillEntry {
  ensurePlayerSkills(skill);
  const entry = skill.playerSkills.find((s) => s.skillName === type);
  if (!entry) throw new Error(`Skill entry missing: ${type}`);
  return entry;
}

export function syncLegacyFieldsFromPlayerSkills(skill: ISkill): void {
  for (const entry of ensurePlayerSkills(skill)) {
    switch (entry.skillName) {
      case "woodcutting":
        skill.woodcuttingLvl = entry.level;
        skill.woodcuttingXp = entry.xp;
        break;
      case "mining":
        skill.miningLvl = entry.level;
        skill.miningXp = entry.xp;
        break;
      case "carpentry":
        skill.carpentryLvl = entry.level;
        skill.carpentryXp = entry.xp;
        break;
      case "smithing":
        skill.smithingLvl = entry.level;
        skill.smithingXp = entry.xp;
        break;
    }
  }
}

export function getSkillLevel(skill: ISkill, type: ActiveSkillType): number {
  return getPlayerSkillEntry(skill, type).level;
}

export function getSkillXp(skill: ISkill, type: ActiveSkillType): number {
  return getPlayerSkillEntry(skill, type).xp;
}

export function setSkillLevel(skill: ISkill, type: ActiveSkillType, level: number): void {
  getPlayerSkillEntry(skill, type).level = level;
  syncLegacyFieldsFromPlayerSkills(skill);
}

export function setSkillXp(skill: ISkill, type: ActiveSkillType, xp: number): void {
  getPlayerSkillEntry(skill, type).xp = xp;
  syncLegacyFieldsFromPlayerSkills(skill);
}

export function addSkillXp(skill: ISkill, type: ActiveSkillType, xp: number): void {
  const entry = getPlayerSkillEntry(skill, type);
  entry.xp += xp;
  syncLegacyFieldsFromPlayerSkills(skill);
}

export function getActiveOfflineSkill(_skill: ISkill): IPlayerSkillEntry | null {
  return null;
}
