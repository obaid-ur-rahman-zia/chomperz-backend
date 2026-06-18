import type { ActiveSkillType } from "../models/Skill";

export interface ActiveSkillConfig {
  id: ActiveSkillType;
  label: string;
  baseDurationMs: number;
  rewardItemId: string;
  rewardItemLabel: string;
  successPct: number;
  failPct: number;
  xpPerSuccess: number;
}

export const ACTIVE_SKILL_CONFIG: Record<ActiveSkillType, ActiveSkillConfig> = {
  woodcutting: {
    id: "woodcutting",
    label: "Woodcutting",
    baseDurationMs: 30_000,
    rewardItemId: "wood",
    rewardItemLabel: "Wood",
    successPct: 60,
    failPct: 40,
    xpPerSuccess: 10,
  },
  mining: {
    id: "mining",
    label: "Mining",
    baseDurationMs: 35_000,
    rewardItemId: "ore",
    rewardItemLabel: "Ore",
    successPct: 55,
    failPct: 45,
    xpPerSuccess: 10,
  },
  carpentry: {
    id: "carpentry",
    label: "Carpentry",
    baseDurationMs: 40_000,
    rewardItemId: "plank",
    rewardItemLabel: "Plank",
    successPct: 50,
    failPct: 50,
    xpPerSuccess: 12,
  },
  smithing: {
    id: "smithing",
    label: "Smithing",
    baseDurationMs: 45_000,
    rewardItemId: "ingot",
    rewardItemLabel: "Ingot",
    successPct: 45,
    failPct: 55,
    xpPerSuccess: 12,
  },
};

export const SPEED_UPGRADE_DURATION_MS = 12 * 60 * 60 * 1000;

export function computeActionDurationMs(baseMs: number, speedLvl: number): number {
  return Math.max(5_000, Math.round(baseMs * Math.pow(0.985, speedLvl)));
}

export function activeSkillUpgradeCost(level: number): number {
  return 5 * level;
}
