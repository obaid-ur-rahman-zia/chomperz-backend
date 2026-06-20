import {
  Skill,
  type ISkill,
  type ActiveSkillType,
  ACTIVE_SKILL_TYPES,
  getSkillLevel,
  getSkillXp,
  setSkillLevel,
  addSkillXp,
  ensurePlayerSkills,
  getPlayerSkillEntry,
  syncLegacyFieldsFromPlayerSkills,
} from "../models/Skill";
import { ACTIVE_SKILL_CONFIG } from "../data/activeSkills";
import {
  actionDurationMs,
  gatherYieldPct,
  xpToNextLevel,
  GATHER_XP,
  CRAFT_XP,
  inputItemId,
  inputQuantity,
} from "../lib/formulas";
import { addItem, removeItem, getItemQuantity } from "./inventory";
import { applyPendingStatUpgrades } from "./skills";

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

function skillSuccessPct(skillId: ActiveSkillType, level: number): number {
  if (skillId === "carpentry" || skillId === "smithing") return 100;
  return gatherYieldPct(skillId, level);
}

function levelUpIfReady(skill: ISkill, skillType: ActiveSkillType): void {
  let level = getSkillLevel(skill, skillType);
  let xp = getSkillXp(skill, skillType);
  let needed = xpToNextLevel(skillType, level);
  while (xp >= needed && level < 100) {
    level += 1;
    xp -= needed;
    setSkillLevel(skill, skillType, level);
    getPlayerSkillEntry(skill, skillType).xp = xp;
    syncLegacyFieldsFromPlayerSkills(skill);
    needed = xpToNextLevel(skillType, level);
  }
}

function serializePlayerSkills(skill: ISkill) {
  ensurePlayerSkills(skill);
  return skill.playerSkills.map((entry) => ({
    skillName: entry.skillName,
    level: entry.level,
    xp: entry.xp,
    active: entry.active,
    actionDurationMs: actionDurationMs(entry.skillName),
    successPct:
      entry.skillName === "carpentry" || entry.skillName === "smithing"
        ? 100
        : Math.round(gatherYieldPct(entry.skillName, entry.level) * 10) / 10,
  }));
}

export function serializeSkillsState(skill: ISkill, inventoryQty = 0, inputQty = 0) {
  ensurePlayerSkills(skill);
  const selected = skill.selectedSkill ?? "woodcutting";
  const config = ACTIVE_SKILL_CONFIG[selected];
  const level = getSkillLevel(skill, selected);
  const xp = getSkillXp(skill, selected);
  const successPct = skillSuccessPct(selected, level);
  const durationMs = actionDurationMs(selected);

  return {
    selectedSkill: selected,
    playerSkills: serializePlayerSkills(skill),
    skills: ACTIVE_SKILL_TYPES.map((id) => {
      const cfg = ACTIVE_SKILL_CONFIG[id];
      const lvl = getSkillLevel(skill, id);
      const skillXp = getSkillXp(skill, id);
      const pct = skillSuccessPct(id, lvl);
      return {
        id,
        label: cfg.label,
        level: lvl,
        xp: skillXp,
        xpToNext: xpToNextLevel(id, lvl),
        rewardItemId: cfg.rewardItemId,
        rewardItemLabel: cfg.rewardItemLabel,
        successPct: Math.round(pct * 10) / 10,
        failPct: Math.round((100 - pct) * 10) / 10,
        inputItemId: inputItemId(id),
        inputQuantity: inputQuantity(id),
        actionDurationMs: actionDurationMs(id),
      };
    }),
    selected: {
      ...config,
      level,
      xp,
      xpToNext: xpToNextLevel(selected, level),
      inventoryQty,
      inputQty,
      successPct: Math.round(successPct * 10) / 10,
      failPct: Math.round((100 - successPct) * 10) / 10,
      inputItemId: inputItemId(selected),
      inputQuantity: inputQuantity(selected),
      actionDurationMs: durationMs,
      actionDurationSec: durationMs / 1000,
    },
    action: resolveActionStatus(skill),
  };
}

export async function getSkillsPayload(userId: string) {
  const skill = await Skill.findOne({ userId });
  if (!skill) throw new Error("Skill not found");

  await applyPendingStatUpgrades(skill);
  ensurePlayerSkills(skill);

  const selected = skill.selectedSkill ?? "woodcutting";
  const config = ACTIVE_SKILL_CONFIG[selected];
  const inventoryQty = await getItemQuantity(userId, config.rewardItemId);
  const inputId = inputItemId(selected);
  const inputQty = inputId ? await getItemQuantity(userId, inputId) : 0;

  return serializeSkillsState(skill, inventoryQty, inputQty);
}

export async function selectSkill(userId: string, skillType: ActiveSkillType) {
  const skill = await Skill.findOne({ userId });
  if (!skill) throw new Error("Skill not found");
  if (skill.activeAction) {
    throw new Error("Cannot switch skills while an action is running");
  }

  skill.selectedSkill = skillType;
  ensurePlayerSkills(skill);
  for (const entry of skill.playerSkills) {
    entry.active = entry.skillName === skillType;
  }
  syncLegacyFieldsFromPlayerSkills(skill);
  await skill.save();
  return getSkillsPayload(userId);
}

export async function startAction(userId: string) {
  const skill = await Skill.findOne({ userId });
  if (!skill) throw new Error("Skill not found");

  await applyPendingStatUpgrades(skill);

  if (skill.activeAction) {
    const status = resolveActionStatus(skill);
    if (status.state === "completed") {
      throw new Error("Complete your current action first");
    }
    throw new Error("An action is already running");
  }

  const selected = skill.selectedSkill ?? "woodcutting";
  const matId = inputItemId(selected);
  const matQty = inputQuantity(selected);

  if (matId && matQty > 0) {
    const have = await getItemQuantity(userId, matId);
    if (have < matQty) {
      throw new Error(`Need ${matQty} ${matId} to start`);
    }
    await removeItem(userId, matId, matQty);
  }

  const durationMs = actionDurationMs(selected);

  skill.activeAction = {
    skill: selected,
    startedAt: new Date(),
    durationMs,
  };
  syncLegacyFieldsFromPlayerSkills(skill);
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
  const level = getSkillLevel(skill, action.skill);
  const isCraft = action.skill === "carpentry" || action.skill === "smithing";
  const successPct = skillSuccessPct(action.skill, level);
  const success = isCraft || Math.random() * 100 < successPct;

  let rewardQty = 0;
  let xpGained = 0;

  if (success) {
    rewardQty = 1;
    await addItem(userId, config.rewardItemId, 1);
    xpGained = isCraft ? CRAFT_XP : GATHER_XP;
    addSkillXp(skill, action.skill, xpGained);
    levelUpIfReady(skill, action.skill);
  }

  skill.activeAction = null;
  syncLegacyFieldsFromPlayerSkills(skill);
  await skill.save();

  const payload = await getSkillsPayload(userId);
  return {
    ...payload,
    result: {
      success,
      rewardItemId: success ? config.rewardItemId : null,
      rewardQty,
      xpGained,
    },
  };
}

export async function getActionStatus(userId: string) {
  const skill = await Skill.findOne({ userId });
  if (!skill) throw new Error("Skill not found");
  return resolveActionStatus(skill);
}
