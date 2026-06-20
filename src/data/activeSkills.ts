import type { ActiveSkillType } from "../models/Skill";

export interface ActiveSkillConfig {
  id: ActiveSkillType;
  label: string;
  rewardItemId: string;
  rewardItemLabel: string;
}

export const ACTIVE_SKILL_CONFIG: Record<ActiveSkillType, ActiveSkillConfig> = {
  woodcutting: {
    id: "woodcutting",
    label: "Woodcutting",
    rewardItemId: "wood",
    rewardItemLabel: "Wood",
  },
  mining: {
    id: "mining",
    label: "Mining",
    rewardItemId: "ore",
    rewardItemLabel: "Iron Ore",
  },
  carpentry: {
    id: "carpentry",
    label: "Carpentry",
    rewardItemId: "plank",
    rewardItemLabel: "Wooden Plank",
  },
  smithing: {
    id: "smithing",
    label: "Smithing",
    rewardItemId: "ingot",
    rewardItemLabel: "Iron Bar",
  },
};
