import {
  Skill,
  type ISkill,
  type ActiveSkillType,
  ACTIVE_SKILL_TYPES,
  getSkillLevel,
  getSkillXp,
  setSkillLevel,
  addSkillXp,
  xpToNextLevel,
} from "../models/Skill";
import {
  ACTIVE_SKILL_CONFIG,
  activeSkillUpgradeCost,
  computeActionDurationMs,
} from "../data/activeSkills";
import { debitBalance } from "./resources";
import { addItem } from "./inventory";
import { applySpeedUpgradeIfReady } from "./skills";

export interface ActionStatus {
  state: "idle" | "running" | "completed";
  skill: ActiveSkillType | null;
  progressPct: number;
  secondsRemaining: number;
  startedAt: string | null;
  durationMs: number | null;
}

function resolveActionStatus(skill: ISkill): ActionStatus {
  const action = skill.activeAction;
  if (!action) {
    return {
      state: "idle",
      skill: skill.selectedSkill,
      progressPct: 0,
      secondsRemaining: 0,
      startedAt: null,
      durationMs: null,
    };
  }

  const elapsed = Date.now() - new Date(action.startedAt).getTime();
  const remaining = Math.max(0, action.durationMs - elapsed);
  const progressPct = Math.min(100, Math.round((elapsed / action.durationMs) * 100));
  const state = remaining <= 0 ? "completed" : "running";

  return {
    state,
    skill: action.skill,
    progressPct,
    secondsRemaining: Math.ceil(remaining / 1000),
    startedAt: new Date(action.startedAt).toISOString(),
    durationMs: action.durationMs,
  };
}

export function serializeSkillsState(skill: ISkill, inventoryQty = 0) {
  const selected = skill.selectedSkill ?? "woodcutting";
  const config = ACTIVE_SKILL_CONFIG[selected];
  const level = getSkillLevel(skill, selected);
  const xp = getSkillXp(skill, selected);

  return {
    selectedSkill: selected,
    skills: ACTIVE_SKILL_TYPES.map((id) => {
      const cfg = ACTIVE_SKILL_CONFIG[id];
      const lvl = getSkillLevel(skill, id);
      const skillXp = getSkillXp(skill, id);
      return {
        id,
        label: cfg.label,
        level: lvl,
        xp: skillXp,
        xpToNext: xpToNextLevel(lvl),
        upgradeCost: activeSkillUpgradeCost(lvl),
        rewardItemId: cfg.rewardItemId,
        rewardItemLabel: cfg.rewardItemLabel,
        successPct: cfg.successPct,
        failPct: cfg.failPct,
      };
    }),
    selected: {
      ...config,
      level,
      xp,
      xpToNext: xpToNextLevel(level),
      upgradeCost: activeSkillUpgradeCost(level),
      inventoryQty,
    },
    action: resolveActionStatus(skill),
  };
}

export async function getSkillsPayload(userId: string) {
  const skill = await Skill.findOne({ userId });
  if (!skill) throw new Error("Skill not found");

  await applySpeedUpgradeIfReady(skill);

  const selected = skill.selectedSkill ?? "woodcutting";
  const config = ACTIVE_SKILL_CONFIG[selected];
  const { getItemQuantity } = await import("./inventory");
  const inventoryQty = await getItemQuantity(userId, config.rewardItemId);

  return serializeSkillsState(skill, inventoryQty);
}

export async function selectSkill(userId: string, skillType: ActiveSkillType) {
  const skill = await Skill.findOne({ userId });
  if (!skill) throw new Error("Skill not found");
  if (skill.activeAction) {
    throw new Error("Cannot switch skills while an action is running");
  }
  skill.selectedSkill = skillType;
  await skill.save();
  return getSkillsPayload(userId);
}

export async function startAction(userId: string) {
  const skill = await Skill.findOne({ userId });
  if (!skill) throw new Error("Skill not found");

  await applySpeedUpgradeIfReady(skill);

  if (skill.activeAction) {
    const status = resolveActionStatus(skill);
    if (status.state === "completed") {
      throw new Error("Complete your current action first");
    }
    throw new Error("An action is already running");
  }

  const selected = skill.selectedSkill ?? "woodcutting";
  const config = ACTIVE_SKILL_CONFIG[selected];
  const durationMs = computeActionDurationMs(config.baseDurationMs, skill.speedLvl);

  skill.activeAction = {
    skill: selected,
    startedAt: new Date(),
    durationMs,
  };
  await skill.save();

  return getSkillsPayload(userId);
}

export async function completeAction(userId: string) {
  const skill = await Skill.findOne({ userId });
  if (!skill) throw new Error("Skill not found");

  const action = skill.activeAction;
  if (!action) {
    throw new Error("No active action");
  }

  const elapsed = Date.now() - new Date(action.startedAt).getTime();
  if (elapsed < action.durationMs) {
    throw new Error("Action not finished yet");
  }

  const config = ACTIVE_SKILL_CONFIG[action.skill];
  const success = Math.random() * 100 < config.successPct;

  let rewardQty = 0;
  if (success) {
    rewardQty = 1;
    await addItem(userId, config.rewardItemId, 1);
    addSkillXp(skill, action.skill, config.xpPerSuccess);

    const level = getSkillLevel(skill, action.skill);
    const xp = getSkillXp(skill, action.skill);
    const needed = xpToNextLevel(level);
    if (xp >= needed) {
      setSkillLevel(skill, action.skill, level + 1);
      switch (action.skill) {
        case "woodcutting":
          skill.woodcuttingXp = xp - needed;
          break;
        case "mining":
          skill.miningXp = xp - needed;
          break;
        case "carpentry":
          skill.carpentryXp = xp - needed;
          break;
        case "smithing":
          skill.smithingXp = xp - needed;
          break;
      }
    }
  }

  skill.activeAction = null;
  await skill.save();

  const payload = await getSkillsPayload(userId);
  return {
    ...payload,
    result: {
      success,
      rewardItemId: success ? config.rewardItemId : null,
      rewardQty,
      xpGained: success ? config.xpPerSuccess : 0,
    },
  };
}

export async function getActionStatus(userId: string) {
  const skill = await Skill.findOne({ userId });
  if (!skill) throw new Error("Skill not found");
  return resolveActionStatus(skill);
}

export async function upgradeActiveSkill(userId: string, skillType: ActiveSkillType) {
  const skill = await Skill.findOne({ userId });
  if (!skill) throw new Error("Skill not found");

  const level = getSkillLevel(skill, skillType);
  const cost = activeSkillUpgradeCost(level);

  await debitBalance(userId, "coins", cost, "active_skill_upgrade", {
    skill: skillType,
    fromLevel: level,
  });

  setSkillLevel(skill, skillType, level + 1);
  await skill.save();

  return getSkillsPayload(userId);
}
