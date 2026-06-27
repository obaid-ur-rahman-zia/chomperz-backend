import type { ActiveSkillType } from "../../models/Skill";

export const WOODCUT_MS = 4_000;
export const MINING_MS = 4_000;
export const CRAFT_MS = 60_000;
export const MIN_CRAFT_MS = 15_000;
export const CARPENTRY_INPUT = 100;
export const SMITHING_INPUT = 100;
export const GATHER_XP = 10;
export const CRAFT_XP = 50;

/** Yield(L) = 10 + 80 × ((L − 1) / 99)² */
export function woodcuttingYieldPct(level: number): number {
  const L = Math.max(1, level);
  return 10 + 80 * Math.pow((L - 1) / 99, 2);
}

/** Yield(L) = 5 + 85 × ((L − 1) / 99)² */
export function miningYieldPct(level: number): number {
  const L = Math.max(1, level);
  return 5 + 85 * Math.pow((L - 1) / 99, 2);
}

export function gatherYieldPct(skill: "woodcutting" | "mining", level: number): number {
  return skill === "woodcutting" ? woodcuttingYieldPct(level) : miningYieldPct(level);
}

/** XP required to advance from level L → L+1 */
export function xpToNextLevel(skill: ActiveSkillType, level: number): number {
  const L = Math.max(1, level);
  switch (skill) {
    case "woodcutting":
      return Math.floor(100 * Math.pow(1.4, L - 1));
    case "mining":
      return Math.floor(100 * Math.pow(2.14, L - 1));
    case "carpentry":
    case "smithing":
      return Math.floor(100 * Math.pow(1.22, L - 1));
  }
}

/**
 * Action timers. Gathering remains fixed; refining gets faster as the
 * matching skill levels up (60s at L1 -> 15s at L100).
 */
export function actionDurationMs(skill: ActiveSkillType, level = 1): number {
  switch (skill) {
    case "woodcutting":
      return WOODCUT_MS;
    case "mining":
      return MINING_MS;
    case "carpentry":
    case "smithing":
      return Math.round(CRAFT_MS - (CRAFT_MS - MIN_CRAFT_MS) * ((Math.max(1, Math.min(100, level)) - 1) / 99));
  }
}

export function skillUpgradeCost(level: number): number {
  return Math.max(2, Math.ceil(Math.max(1, level) * 2));
}

export function inputItemId(skill: ActiveSkillType): string | null {
  switch (skill) {
    case "carpentry":
      return "wood";
    case "smithing":
      return "ore";
    default:
      return null;
  }
}

export function inputQuantity(skill: ActiveSkillType): number {
  switch (skill) {
    case "carpentry":
      return CARPENTRY_INPUT;
    case "smithing":
      return SMITHING_INPUT;
    default:
      return 0;
  }
}
