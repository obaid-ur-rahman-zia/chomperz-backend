import { User } from "../models/User";
import { ITEM_CATALOG, ITEM_IDS } from "../data/items";
import { addItem } from "./inventory";
import { ensureSkill } from "./skills";
import { findUserByHandle, normalizeHandle } from "./user";
import {
  ACTIVE_SKILL_TYPES,
  type ActiveSkillType,
  setSkillLevel,
  setSkillXp,
  syncLegacyFieldsFromPlayerSkills,
} from "../models/Skill";
import { ACTIVE_SKILL_CONFIG } from "../data/activeSkills";

export { findUserByHandle, normalizeHandle };

export async function grantItemsToUser(
  userId: string,
  items: Record<string, number>
): Promise<Record<string, number>> {
  const granted: Record<string, number> = {};

  for (const [itemId, rawQty] of Object.entries(items)) {
    if (!ITEM_IDS.includes(itemId)) {
      throw new Error(`Unknown item: ${itemId}`);
    }
    const quantity = Number(rawQty);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    granted[itemId] = await addItem(userId, itemId, Math.floor(quantity));
  }

  if (Object.keys(granted).length === 0) {
    throw new Error("Provide at least one item with quantity > 0");
  }

  return granted;
}

export interface SkillGrantInput {
  level?: number;
  xp?: number;
}

export async function grantSkillsToUser(
  userId: string,
  skills: Partial<Record<ActiveSkillType, SkillGrantInput>>
) {
  const skill = await ensureSkill(userId);
  const updated: Record<string, { level: number; xp: number }> = {};

  for (const skillType of ACTIVE_SKILL_TYPES) {
    const input = skills[skillType];
    if (!input) continue;

    const hasLevel = input.level !== undefined;
    const hasXp = input.xp !== undefined;
    if (!hasLevel && !hasXp) continue;

    if (hasLevel) {
      const level = Number(input.level);
      if (!Number.isInteger(level) || level < 1 || level > 100) {
        throw new Error(`${skillType} level must be 1–100`);
      }
      setSkillLevel(skill, skillType, level);
      if (!hasXp) {
        setSkillXp(skill, skillType, 0);
      }
    }

    if (hasXp) {
      const xp = Number(input.xp);
      if (!Number.isFinite(xp) || xp < 0) {
        throw new Error(`${skillType} xp must be a non-negative number`);
      }
      setSkillXp(skill, skillType, Math.floor(xp));
    }

    const entry = skill.playerSkills.find((s) => s.skillName === skillType);
    if (entry) {
      updated[skillType] = { level: entry.level, xp: entry.xp };
    }
  }

  syncLegacyFieldsFromPlayerSkills(skill);
  await skill.save();

  if (Object.keys(updated).length === 0) {
    throw new Error("Provide at least one skill with level and/or xp");
  }

  return updated;
}

export function getAdminCatalog() {
  return {
    items: ITEM_IDS.map((id) => ({
      id,
      name: ITEM_CATALOG[id].name,
      shortLabel: ITEM_CATALOG[id].shortLabel,
    })),
    skills: ACTIVE_SKILL_TYPES.map((id) => ({
      id,
      label: ACTIVE_SKILL_CONFIG[id].label,
      rewardItemId: ACTIVE_SKILL_CONFIG[id].rewardItemId,
    })),
  };
}
